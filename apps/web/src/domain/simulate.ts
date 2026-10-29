import { Array, Number, Option, Order, pipe } from 'effect'

import {
  type BoardDoc,
  type BoardNode,
  edgeKey,
  rankOf,
  targetsOf,
} from './board'
import { catalog } from './catalog'

export type NodeFlow = Readonly<{
  incoming: number
  served: number
  dropped: number
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
}>

const BALANCER_HOP_MS = 6

const serverLatency = (utilization: number): number =>
  18 + 26 / (1 - Math.min(utilization, 0.98))

const databaseLatency = (utilization: number): number =>
  4 + 9 / (1 - Math.min(utilization, 0.98))

type Flow = Readonly<{
  inflow: Readonly<Record<string, number>>
  nodes: Readonly<Record<string, NodeFlow>>
  edges: Readonly<Record<string, number>>
  viaBalancer: ReadonlyArray<string>
}>

const activeTargets = (doc: BoardDoc, node: BoardNode, isDown: boolean) => {
  const targets = targetsOf(doc, node.id)
  if (isDown) {
    return []
  }
  return node.kind === 'lb'
    ? Array.filter(targets, target => !Array.contains(doc.failed, target))
    : targets
}

const servedBy = (
  node: BoardNode,
  incoming: number,
  isDown: boolean,
  targetCount: number,
): number => {
  if (isDown) {
    return 0
  }
  if (node.kind === 'client' || node.kind === 'lb') {
    return targetCount > 0 ? Math.min(incoming, catalog[node.kind].capacity) : 0
  }
  return Math.min(incoming, catalog[node.kind].capacity)
}

const flowThrough =
  (doc: BoardDoc) =>
  (flow: Flow, node: BoardNode): Flow => {
    const incoming = flow.inflow[node.id] ?? 0
    const isDown = Array.contains(doc.failed, node.id)
    const targets = activeTargets(doc, node, isDown)
    const served = servedBy(node, incoming, isDown, targets.length)
    const share = Array.isReadonlyArrayNonEmpty(targets)
      ? served / targets.length
      : 0
    const capacity = catalog[node.kind].capacity

    return {
      inflow: Array.reduce(targets, flow.inflow, (inflow, target) => ({
        ...inflow,
        [target]: (inflow[target] ?? 0) + share,
      })),
      edges: Array.reduce(
        targetsOf(doc, node.id),
        flow.edges,
        (edges, target) => ({
          ...edges,
          [edgeKey({ from: node.id, to: target })]: Array.contains(
            targets,
            target,
          )
            ? share
            : 0,
        }),
      ),
      nodes: {
        ...flow.nodes,
        [node.id]: {
          incoming,
          served,
          dropped: incoming - served,
          utilization: globalThis.Number.isFinite(capacity)
            ? incoming / capacity
            : 0,
          isDown,
        },
      },
      viaBalancer:
        node.kind === 'lb'
          ? [...flow.viaBalancer, ...targets]
          : flow.viaBalancer,
    }
  }

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

export const simulate = (doc: BoardDoc, load: number): SimResult => {
  const clients = Array.filter(doc.nodes, node => node.kind === 'client')
  const start: Flow = {
    inflow: Object.fromEntries(
      Array.map(clients, client => [
        client.id,
        load / Math.max(clients.length, 1),
      ]),
    ),
    nodes: {},
    edges: {},
    viaBalancer: [],
  }
  const ordered = Array.sort(doc.nodes, Order.mapInput(Order.Number, rankOf))
  const flow = Array.reduce(ordered, start, flowThrough(doc))

  const flowOf = (node: BoardNode): NodeFlow =>
    flow.nodes[node.id] ?? {
      incoming: 0,
      served: 0,
      dropped: 0,
      utilization: 0,
      isDown: false,
    }
  const databases = Array.filter(doc.nodes, node => node.kind === 'db')
  const databaseUtilization = Math.max(
    0,
    ...Array.map(databases, node => flowOf(node).utilization),
  )
  const samples = pipe(
    doc.nodes,
    Array.filter(node => node.kind === 'server' && flowOf(node).served > 0),
    Array.map(node => ({
      latency:
        serverLatency(flowOf(node).utilization) +
        databaseLatency(databaseUtilization) +
        (Array.contains(flow.viaBalancer, node.id) ? BALANCER_HOP_MS : 0),
      weight: flowOf(node).served,
    })),
  )
  const dropped = Number.sumAll(
    Array.map(doc.nodes, node => flowOf(node).dropped),
  )

  return {
    load,
    nodes: flow.nodes,
    edges: flow.edges,
    errorRate: load > 0 ? dropped / load : 0,
    p95: weightedP95(samples),
    databaseLoad: Number.sumAll(
      Array.map(databases, node => flowOf(node).incoming),
    ),
    costPerHour: Number.sumAll(
      Array.map(doc.nodes, node => catalog[node.kind].costPerHour),
    ),
  }
}

export const overloadedNodes = (result: SimResult): ReadonlyArray<string> =>
  pipe(
    Object.entries(result.nodes),
    Array.filter(([, node]) => node.dropped > 1),
    Array.map(([id]) => id),
  )
