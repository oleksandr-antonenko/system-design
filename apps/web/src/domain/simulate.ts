import { Array, Number, Option, Order, pipe } from 'effect'

import {
  type BoardDoc,
  type BoardNode,
  capacityOf,
  edgeKey,
  nodesOfKind,
  rankOf,
  targetsOf,
} from './board'
import { type ComponentKind, catalog } from './catalog'

export type NodeFlow = Readonly<{
  incoming: number
  served: number
  dropped: number
  rejected: number
  backlog: number
  utilization: number
  isDown: boolean
}>

export type SimResult = Readonly<{
  load: number
  nodes: Readonly<Record<string, NodeFlow>>
  edges: Readonly<Record<string, number>>
  errorRate: number
  p95: Option.Option<number>
  databaseLoad: number
  costPerHour: number
  rejected: number
  backlog: number
}>

export type SimulationRules = Readonly<{
  writeShare: number
  cdnStaticShare: number
  cacheHitShare: number
  balancerHopMs: number
  cdnMs: number
  cacheHitMs: number
  regionCrossingMs: number
}>

/** Константы потока из design D2–D6. Уроки опираются на них в текстах. */
export const simulationRules: SimulationRules = {
  writeShare: 0.2,
  cdnStaticShare: 0.6,
  cacheHitShare: 0.8,
  balancerHopMs: 6,
  cdnMs: 12,
  cacheHitMs: 2,
  regionCrossingMs: 70,
}

const serverLatency = (utilization: number): number =>
  18 + 26 / (1 - Math.min(utilization, 0.98))

const databaseLatency = (utilization: number): number =>
  4 + 9 / (1 - Math.min(utilization, 0.98))

// Сервер без базы на доске хранит данные у себя: задержка как у пустой базы,
// ровно как в ядре.
const IN_MEMORY_MS = databaseLatency(0)

// FLOW

/** Часть пользовательского потока с уже набранной задержкой пути. */
type Parcel = Readonly<{ delay: number; amount: number }>

type Arrival = Readonly<{
  total: number
  user: number
  parcels: ReadonlyArray<Parcel>
}>

type Send = Readonly<{
  to: string
  amount: number
  isUser: boolean
  parcels: ReadonlyArray<Parcel>
}>

/** Куда уходит доля обслуженных сервером запросов и что она платит за данные. */
type Branch = Readonly<{
  weight: number
  fixedMs: number
  maybeStore: Option.Option<string>
  crossings: number
}>

type LatencyPlan = Readonly<{
  parcels: ReadonlyArray<Parcel>
  maybeServer: Option.Option<string>
  branches: ReadonlyArray<Branch>
}>

type Handled = Readonly<{
  served: number
  dropped: number
  rejected: number
  backlog: number
  sends: ReadonlyArray<Send>
  plans: ReadonlyArray<LatencyPlan>
}>

type Flow = Readonly<{
  arrivals: Readonly<Record<string, Arrival>>
  handled: Readonly<Record<string, Handled>>
  edges: Readonly<Record<string, number>>
  plans: ReadonlyArray<LatencyPlan>
}>

type Context = Readonly<{
  doc: BoardDoc
  byId: Readonly<Record<string, BoardNode>>
  hasDatabase: boolean
}>

type Handler = (
  context: Context,
  node: BoardNode,
  arrival: Arrival,
  flow: Flow,
) => Handled

const noArrival: Arrival = { total: 0, user: 0, parcels: [] }

const handled = (fields: Partial<Handled>): Handled => ({
  served: 0,
  dropped: 0,
  rejected: 0,
  backlog: 0,
  sends: [],
  plans: [],
  ...fields,
})

const ratio = (part: number, whole: number): number =>
  whole > 0 ? part / whole : 0

const amountOf = (parcels: ReadonlyArray<Parcel>): number =>
  Number.sumAll(Array.map(parcels, parcel => parcel.amount))

const scaled = (
  parcels: ReadonlyArray<Parcel>,
  factor: number,
): ReadonlyArray<Parcel> =>
  Array.map(parcels, parcel => ({
    delay: parcel.delay,
    amount: parcel.amount * factor,
  }))

const delayed = (
  parcels: ReadonlyArray<Parcel>,
  ms: number,
): ReadonlyArray<Parcel> =>
  Array.map(parcels, parcel => ({
    delay: parcel.delay + ms,
    amount: parcel.amount,
  }))

const mergeParcels = (parcels: ReadonlyArray<Parcel>): ReadonlyArray<Parcel> =>
  Array.map(
    Object.values(Array.groupBy(parcels, parcel => `${parcel.delay}`)),
    group => ({
      delay: Array.headNonEmpty(group).delay,
      amount: amountOf(group),
    }),
  )

const isDown = (context: Context, id: string): boolean =>
  Array.contains(context.doc.failed, id)

const targetNodes = (
  context: Context,
  node: BoardNode,
): ReadonlyArray<BoardNode> =>
  Array.getSomes(
    Array.map(targetsOf(context.doc, node.id), id =>
      Option.fromNullishOr(context.byId[id]),
    ),
  )

const ofKinds = (
  nodes: ReadonlyArray<BoardNode>,
  kinds: ReadonlyArray<ComponentKind>,
): ReadonlyArray<BoardNode> =>
  Array.filter(nodes, node => Array.contains(kinds, node.kind))

const alive = (
  context: Context,
  nodes: ReadonlyArray<BoardNode>,
): ReadonlyArray<BoardNode> =>
  Array.filter(nodes, node => !isDown(context, node.id))

/** Связь между блоками разных регионов. Блок без региона — общий. */
const crossings = (from: BoardNode, to: BoardNode): number =>
  Option.exists(
    Option.all([from.maybeRegion, to.maybeRegion]),
    ([fromRegion, toRegion]) => fromRegion !== toRegion,
  )
    ? 1
    : 0

const forwardRequests = (
  from: BoardNode,
  parcels: ReadonlyArray<Parcel>,
  targets: ReadonlyArray<BoardNode>,
  hopMs: number,
): ReadonlyArray<Send> =>
  Array.map(targets, target => {
    const share = scaled(parcels, 1 / targets.length)
    return {
      to: target.id,
      amount: amountOf(share),
      isUser: true,
      parcels: delayed(
        share,
        hopMs + simulationRules.regionCrossingMs * crossings(from, target),
      ),
    }
  })

const spread = (
  amount: number,
  targets: ReadonlyArray<BoardNode>,
  isUser: boolean,
): ReadonlyArray<Send> =>
  Array.map(targets, target => ({
    to: target.id,
    amount: amount / targets.length,
    isUser,
    parcels: [],
  }))

const roomOf = (flow: Flow, node: BoardNode): number =>
  Math.max(0, capacityOf(node) - (flow.arrivals[node.id]?.total ?? 0))

/** Делит `amount` поровну, но не больше места у каждого получателя. */
const waterFill = (
  amount: number,
  rooms: ReadonlyArray<number>,
): ReadonlyArray<number> => {
  const start: Readonly<{
    left: number
    remaining: number
    given: Readonly<Record<number, number>>
  }> = { left: amount, remaining: rooms.length, given: {} }
  const filled = Array.reduce(
    Array.sort(
      Array.map(rooms, (room, index) => ({ room, index })),
      Order.mapInput(Order.Number, (entry: { room: number }) => entry.room),
    ),
    start,
    (state, { room, index }) => {
      const share = Math.min(room, state.left / state.remaining)
      return {
        left: state.left - share,
        remaining: state.remaining - 1,
        given: { ...state.given, [index]: share },
      }
    },
  )
  return Array.map(rooms, (_room, index) => filled.given[index] ?? 0)
}

// HANDLERS

// Пользователи шлют живым целям своего региона, иначе любым живым (D6).
// Если живых целей нет, запросы уходят в упавшие цели и теряются там (D5).
const handleClient: Handler = (context, node, arrival) => {
  const targets = targetNodes(context, node)
  const live = alive(context, targets)
  const home = Option.match(node.maybeRegion, {
    onNone: () => live,
    onSome: region =>
      Array.filter(live, target =>
        Option.exists(
          target.maybeRegion,
          targetRegion => targetRegion === region,
        ),
      ),
  })
  const chosen = Array.isReadonlyArrayNonEmpty(home)
    ? home
    : Array.isReadonlyArrayNonEmpty(live)
      ? live
      : targets
  return Array.isReadonlyArrayNonEmpty(chosen)
    ? handled({
        served: arrival.total,
        sends: forwardRequests(node, arrival.parcels, chosen, 0),
      })
    : handled({ dropped: arrival.total })
}

const handleCdn: Handler = (context, node, arrival) => {
  const accepted = Math.min(arrival.total, capacityOf(node))
  const acceptedParcels = scaled(
    arrival.parcels,
    ratio(accepted, arrival.total),
  )
  const statics = accepted * simulationRules.cdnStaticShare
  const forwarded = accepted - statics
  const live = alive(context, targetNodes(context, node))
  const staticPlan: LatencyPlan = {
    parcels: scaled(acceptedParcels, simulationRules.cdnStaticShare),
    maybeServer: Option.none(),
    branches: [
      {
        weight: 1,
        fixedMs: simulationRules.cdnMs,
        maybeStore: Option.none(),
        crossings: 0,
      },
    ],
  }
  return Array.isReadonlyArrayNonEmpty(live)
    ? handled({
        served: accepted,
        dropped: arrival.total - accepted,
        sends: forwardRequests(
          node,
          scaled(acceptedParcels, 1 - simulationRules.cdnStaticShare),
          live,
          0,
        ),
        plans: [staticPlan],
      })
    : handled({
        served: statics,
        dropped: arrival.total - accepted + forwarded,
        plans: [staticPlan],
      })
}

const handleLimiter: Handler = (context, node, arrival) => {
  const passed = Math.min(arrival.total, capacityOf(node))
  const rejected = arrival.total - passed
  const live = alive(context, targetNodes(context, node))
  return Array.isReadonlyArrayNonEmpty(live)
    ? handled({
        served: passed,
        rejected,
        sends: forwardRequests(
          node,
          scaled(arrival.parcels, ratio(passed, arrival.total)),
          live,
          0,
        ),
      })
    : handled({ dropped: passed, rejected })
}

const handleBalancer: Handler = (context, node, arrival) => {
  const live = alive(context, targetNodes(context, node))
  const accepted = Math.min(arrival.total, capacityOf(node))
  return Array.isReadonlyArrayNonEmpty(live)
    ? handled({
        served: accepted,
        dropped: arrival.total - accepted,
        sends: forwardRequests(
          node,
          scaled(arrival.parcels, ratio(accepted, arrival.total)),
          live,
          simulationRules.balancerHopMs,
        ),
      })
    : handled({ dropped: arrival.total })
}

const storeBranches = (
  from: BoardNode,
  weight: number,
  stores: ReadonlyArray<BoardNode>,
  crossingsSoFar: number,
): ReadonlyArray<Branch> =>
  Array.match(stores, {
    onEmpty: () => [
      {
        weight,
        fixedMs: IN_MEMORY_MS,
        maybeStore: Option.none(),
        crossings: crossingsSoFar,
      },
    ],
    onNonEmpty: nonEmpty =>
      Array.map(nonEmpty, store => ({
        weight: weight / nonEmpty.length,
        fixedMs: 0,
        maybeStore: Option.some(store.id),
        crossings: crossingsSoFar + crossings(from, store),
      })),
  })

const cacheStores = (
  context: Context,
  cache: BoardNode,
): ReadonlyArray<BoardNode> =>
  alive(context, ofKinds(targetNodes(context, cache), ['db', 'replica']))

const readBranches = (
  context: Context,
  server: BoardNode,
  caches: ReadonlyArray<BoardNode>,
  readTargets: ReadonlyArray<BoardNode>,
): ReadonlyArray<Branch> => {
  const readShare = 1 - simulationRules.writeShare
  const hitShare = simulationRules.cacheHitShare
  return Array.match(caches, {
    onEmpty: () => storeBranches(server, readShare, readTargets, 0),
    onNonEmpty: nonEmpty =>
      Array.flatMap(nonEmpty, cache => {
        const weight = readShare / nonEmpty.length
        const toCache = crossings(server, cache)
        return [
          {
            weight: weight * hitShare,
            fixedMs: simulationRules.cacheHitMs,
            maybeStore: Option.none(),
            crossings: toCache,
          },
          ...storeBranches(
            cache,
            weight * (1 - hitShare),
            cacheStores(context, cache),
            toCache,
          ),
        ]
      }),
  })
}

// Сервер (D2): 20 % записи в свои живые базы, 80 % чтения в кеши или
// поровну в базы и реплики, по сообщению в каждую очередь и шину. Если все
// его базы упали, запись принимает живая реплика (D5). Если на доске есть
// база, а писать некуда, сервер теряет все запросы.
const handleServer: Handler = (context, node, arrival) => {
  const targets = targetNodes(context, node)
  const live = alive(context, targets)
  const databases = ofKinds(targets, ['db'])
  const liveDatabases = ofKinds(live, ['db'])
  const liveReplicas = ofKinds(live, ['replica'])
  const caches = ofKinds(live, ['cache'])
  const writeTargets = Array.isReadonlyArrayNonEmpty(liveDatabases)
    ? liveDatabases
    : Array.isReadonlyArrayNonEmpty(databases)
      ? liveReplicas
      : []
  const readTargets = [...liveDatabases, ...liveReplicas]
  const canAnswer =
    !context.hasDatabase || Array.isReadonlyArrayNonEmpty(writeTargets)
  const served = canAnswer ? Math.min(arrival.total, capacityOf(node)) : 0
  const writes = served * simulationRules.writeShare
  const reads = served - writes
  const readSends = Array.isReadonlyArrayNonEmpty(caches)
    ? spread(reads, caches, true)
    : spread(reads, readTargets, true)
  const taskSends = Array.map(ofKinds(live, ['queue', 'events']), target => ({
    to: target.id,
    amount: served,
    isUser: false,
    parcels: [],
  }))
  return handled({
    served,
    dropped: arrival.total - served,
    sends: [...spread(writes, writeTargets, true), ...readSends, ...taskSends],
    plans:
      served > 0
        ? [
            {
              parcels: scaled(arrival.parcels, served / arrival.total),
              maybeServer: Option.some(node.id),
              branches: [
                ...storeBranches(
                  node,
                  simulationRules.writeShare,
                  writeTargets,
                  0,
                ),
                ...readBranches(context, node, caches, readTargets),
              ],
            },
          ]
        : [],
  })
}

const handleCache: Handler = (context, node, arrival) => {
  const accepted = Math.min(arrival.total, capacityOf(node))
  const misses = accepted * (1 - simulationRules.cacheHitShare)
  const stores = cacheStores(context, node)
  return Array.isReadonlyArrayNonEmpty(stores)
    ? handled({
        served: accepted,
        dropped: arrival.total - accepted,
        sends: spread(misses, stores, true),
      })
    : handled({
        served: accepted - misses,
        dropped: arrival.total - accepted + misses,
      })
}

// Очередь (D3): отдаёт обработчикам не больше, чем у них есть места;
// остальное — рост очереди, не ошибка.
const handleQueue: Handler = (context, node, arrival, flow) => {
  const accepted = Math.min(arrival.total, capacityOf(node))
  const workers = alive(context, targetNodes(context, node))
  const delivered = waterFill(
    accepted,
    Array.map(workers, worker => roomOf(flow, worker)),
  )
  return handled({
    served: accepted,
    dropped: arrival.total - accepted,
    backlog: accepted - Number.sumAll(delivered),
    sends: Array.zipWith(workers, delivered, (worker, amount) => ({
      to: worker.id,
      amount,
      isUser: false,
      parcels: [],
    })),
  })
}

// Шина (D3): каждому подписчику полная копия; чего он не успевает взять
// (или всё, если он упал), копится у шины как рост очереди.
const handleEvents: Handler = (context, node, arrival, flow) => {
  const accepted = Math.min(arrival.total, capacityOf(node))
  const subscribers = targetNodes(context, node)
  const delivered = Array.map(subscribers, subscriber =>
    isDown(context, subscriber.id)
      ? 0
      : Math.min(accepted, roomOf(flow, subscriber)),
  )
  return handled({
    served: accepted,
    dropped: arrival.total - accepted,
    backlog: Number.sumAll(Array.map(delivered, amount => accepted - amount)),
    sends: Array.zipWith(subscribers, delivered, (subscriber, amount) => ({
      to: subscriber.id,
      amount,
      isUser: false,
      parcels: [],
    })),
  })
}

const handleWorker: Handler = (context, node, arrival) => {
  const served = Math.min(arrival.total, capacityOf(node))
  return handled({
    served,
    dropped: arrival.total - served,
    sends: spread(
      served,
      alive(context, ofKinds(targetNodes(context, node), ['db'])),
      false,
    ),
  })
}

const handleStore: Handler = (_context, node, arrival) => {
  const served = Math.min(arrival.total, capacityOf(node))
  return handled({ served, dropped: arrival.total - served })
}

const handlers: Readonly<Record<ComponentKind, Handler>> = {
  client: handleClient,
  cdn: handleCdn,
  limiter: handleLimiter,
  lb: handleBalancer,
  server: handleServer,
  cache: handleCache,
  queue: handleQueue,
  events: handleEvents,
  worker: handleWorker,
  db: handleStore,
  replica: handleStore,
  search: handleStore,
}

const receive = (arrivals: Flow['arrivals'], send: Send): Flow['arrivals'] => {
  const before = arrivals[send.to] ?? noArrival
  return {
    ...arrivals,
    [send.to]: {
      total: before.total + send.amount,
      user: before.user + (send.isUser ? send.amount : 0),
      parcels: mergeParcels([...before.parcels, ...send.parcels]),
    },
  }
}

const flowThrough =
  (context: Context) =>
  (flow: Flow, node: BoardNode): Flow => {
    const arrival = flow.arrivals[node.id] ?? noArrival
    const result = isDown(context, node.id)
      ? handled({ dropped: arrival.total })
      : handlers[node.kind](context, node, arrival, flow)
    return {
      arrivals: Array.reduce(result.sends, flow.arrivals, receive),
      handled: { ...flow.handled, [node.id]: result },
      edges: Array.reduce(
        targetsOf(context.doc, node.id),
        flow.edges,
        (edges, target) => ({
          ...edges,
          [edgeKey({ from: node.id, to: target })]: Number.sumAll(
            pipe(
              result.sends,
              Array.filter(send => send.to === target),
              Array.map(send => send.amount),
            ),
          ),
        }),
      ),
      plans: [...flow.plans, ...result.plans],
    }
  }

// LATENCY

type LatencySample = Readonly<{ latency: number; weight: number }>

const weightedP95 = (
  samples: ReadonlyArray<LatencySample>,
): Option.Option<number> => {
  const sorted = Array.sort(
    samples,
    Order.mapInput(Order.Number, (sample: LatencySample) => sample.latency),
  )
  const total = Number.sumAll(Array.map(sorted, sample => sample.weight))
  const cumulative = Array.scan(sorted, 0, (sum, sample) => sum + sample.weight)

  return pipe(
    Array.zip(sorted, Array.drop(cumulative, 1)),
    Array.findFirst(([, reached]) => total > 0 && reached >= total * 0.95),
    Option.map(([sample]) => sample.latency),
  )
}

const latencySamples = (
  plans: ReadonlyArray<LatencyPlan>,
  utilizationOf: (id: string) => number,
): ReadonlyArray<LatencySample> =>
  Array.flatMap(plans, plan => {
    const serverMs = Option.match(plan.maybeServer, {
      onNone: () => 0,
      onSome: id => serverLatency(utilizationOf(id)),
    })
    return Array.flatMap(plan.parcels, parcel =>
      pipe(
        plan.branches,
        Array.map(branch => ({
          latency:
            parcel.delay +
            serverMs +
            branch.fixedMs +
            Option.match(branch.maybeStore, {
              onNone: () => 0,
              onSome: id => databaseLatency(utilizationOf(id)),
            }) +
            simulationRules.regionCrossingMs * branch.crossings,
          weight: parcel.amount * branch.weight,
        })),
        Array.filter(sample => sample.weight > 0),
      ),
    )
  })

// SIMULATION

export const costOf = (doc: BoardDoc): number =>
  Number.sumAll(Array.map(doc.nodes, node => catalog[node.kind].costPerHour))

export const simulate = (doc: BoardDoc, load: number): SimResult => {
  const context: Context = {
    doc,
    byId: Object.fromEntries(Array.map(doc.nodes, node => [node.id, node])),
    hasDatabase: Array.isReadonlyArrayNonEmpty(nodesOfKind(doc, 'db')),
  }
  const clients = nodesOfKind(doc, 'client')
  const perClient = load / Math.max(clients.length, 1)
  const start: Flow = {
    arrivals: Object.fromEntries(
      Array.map(clients, client => [
        client.id,
        {
          total: perClient,
          user: perClient,
          parcels: [{ delay: 0, amount: perClient }],
        },
      ]),
    ),
    handled: {},
    edges: {},
    plans: [],
  }
  const ordered = Array.sort(doc.nodes, Order.mapInput(Order.Number, rankOf))
  const flow = Array.reduce(ordered, start, flowThrough(context))

  const arrivalOf = (node: BoardNode): Arrival =>
    flow.arrivals[node.id] ?? noArrival
  const handledOf = (node: BoardNode): Handled =>
    flow.handled[node.id] ?? handled({})
  const nodes: Readonly<Record<string, NodeFlow>> = Object.fromEntries(
    Array.map(ordered, node => {
      const capacity = capacityOf(node)
      const result = handledOf(node)
      return [
        node.id,
        {
          incoming: arrivalOf(node).total,
          served: result.served,
          dropped: result.dropped,
          rejected: result.rejected,
          backlog: result.backlog,
          utilization: globalThis.Number.isFinite(capacity)
            ? arrivalOf(node).total / capacity
            : 0,
          isDown: isDown(context, node.id),
        },
      ]
    }),
  )
  // Ошибка — потерянный пользовательский запрос. Задачи, события и запись
  // обработчиков к ошибкам пользователей не относятся (D3).
  const userLost = Number.sumAll(
    Array.map(
      doc.nodes,
      node =>
        handledOf(node).dropped *
        ratio(arrivalOf(node).user, arrivalOf(node).total),
    ),
  )
  const rejected = Number.sumAll(
    Array.map(doc.nodes, node => handledOf(node).rejected),
  )

  return {
    load,
    nodes,
    edges: flow.edges,
    errorRate: load > 0 ? (userLost + rejected) / load : 0,
    p95: weightedP95(
      latencySamples(flow.plans, id => nodes[id]?.utilization ?? 0),
    ),
    databaseLoad: Number.sumAll(
      Array.map(nodesOfKind(doc, 'db'), node => arrivalOf(node).total),
    ),
    costPerHour: costOf(doc),
    rejected,
    backlog: Number.sumAll(
      Array.map(doc.nodes, node => handledOf(node).backlog),
    ),
  }
}

/** Блоки, которые теряют или отклоняют запросы. */
export const overloadedNodes = (result: SimResult): ReadonlyArray<string> =>
  pipe(
    Object.entries(result.nodes),
    Array.filter(([, node]) => node.dropped + node.rejected > 1),
    Array.map(([id]) => id),
  )
