import { Array, Option, Result, Schema, pipe } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { DomainMessage } from '../i18n/domainMessage'
import {
  CacheMode,
  ComponentKind,
  Region,
  cacheStoreKinds,
  canConnect,
  catalog,
  isSink,
} from './catalog'
import {
  TrafficPatch,
  TrafficProfile,
  defaultTraffic,
  invalidKnob,
} from './traffic'

// MODEL

export const BoardNode = Schema.Struct({
  id: Schema.String,
  kind: ComponentKind,
  x: Schema.Number,
  y: Schema.Number,
  locked: Schema.Boolean,
  maybeCapacity: Schema.Option(Schema.Number),
  maybeRegion: Schema.Option(Region),
})
export type BoardNode = typeof BoardNode.Type

export const Edge = Schema.Struct({ from: Schema.String, to: Schema.String })
export type Edge = typeof Edge.Type

export const BoardDoc = Schema.Struct({
  nodes: Schema.Array(BoardNode),
  edges: Schema.Array(Edge),
  load: Schema.Number,
  failed: Schema.Array(Schema.String),
  /** Вес группы пользователей в общей нагрузке по id блока «Users». Нет
      записи — вес 1, поэтому без `SetShare` группы делят нагрузку поровну. */
  shares: Schema.Record(Schema.String, Schema.Number),
  /** Из чего состоит обслуженный запрос; по умолчанию прежние константы. */
  traffic: TrafficProfile,
  /** Кто читает базу при промахе кеша, для всех кешей доски. По умолчанию
      `read-through`, как в уроках 1–13. */
  cacheMode: CacheMode,
})
export type BoardDoc = typeof BoardDoc.Type

export const emptyBoard: BoardDoc = {
  nodes: [],
  edges: [],
  load: 0,
  failed: [],
  shares: {},
  traffic: defaultTraffic,
  cacheMode: 'read-through',
}

const DEFAULT_SHARE = 1

/** Вес группы пользователей: свой из `SetShare`, иначе 1. */
export const shareOf = (doc: BoardDoc, id: string): number =>
  doc.shares[id] ?? DEFAULT_SHARE

export const edgeKey = (edge: Edge): string => `${edge.from}>${edge.to}`

// OPERATIONS

export const BoardOp = defineTaggedUnion({
  AddNode: {
    id: Schema.String,
    kind: ComponentKind,
    x: Schema.Number,
    y: Schema.Number,
    locked: Schema.Boolean,
    maybeCapacity: Schema.Option(Schema.Number),
    maybeRegion: Schema.Option(Region),
  },
  RemoveNode: { id: Schema.String },
  MoveNode: { id: Schema.String, x: Schema.Number, y: Schema.Number },
  Connect: { from: Schema.String, to: Schema.String },
  Disconnect: { from: Schema.String, to: Schema.String },
  /** Перенести конец связи `from → to` на другой блок: одна операция, одна
      строка журнала и одна отмена. Новая связь проверяется теми же правилами,
      что и `Connect`, и встаёт на место старой. */
  Reconnect: {
    from: Schema.String,
    to: Schema.String,
    nextFrom: Schema.String,
    nextTo: Schema.String,
  },
  SetLoad: { rps: Schema.Number },
  FailNode: { id: Schema.String },
  RecoverNode: { id: Schema.String },
  FailRegion: { region: Region },
  RecoverRegion: { region: Region },
  /** Вес группы пользователей в общей нагрузке
      (D2 add-flow-reset-shares-and-block-goals). */
  SetShare: { id: Schema.String, share: Schema.Number },
  /** Начать с пустой доски: шаг строит общую эталонную схему заново. */
  Reset: {},
  /** Меняет названные ручки профиля трафика (add-flow-traffic-profile). */
  SetTraffic: { traffic: TrafficPatch },
  /** Режим всех кешей доски (add-flow-labels-and-cache-modes). */
  SetCacheMode: { mode: CacheMode },
})
export type BoardOp = typeof BoardOp.Type

export type BoardResult = Result.Result<BoardDoc, DomainMessage>

export const findNode = (doc: BoardDoc, id: string): Option.Option<BoardNode> =>
  Array.findFirst(doc.nodes, node => node.id === id)

const hasNode = (doc: BoardDoc, id: string): boolean =>
  Option.isSome(findNode(doc, id))

const connectRefusal = (
  doc: BoardDoc,
  from: BoardNode,
  to: BoardNode,
): Option.Option<DomainMessage> => {
  if (from.id === to.id) {
    return Option.some(DomainMessage.ConnectSelf())
  }
  if (
    Array.some(doc.edges, edge => edge.from === from.id && edge.to === to.id)
  ) {
    return Option.some(DomainMessage.ConnectDuplicate())
  }
  if (
    from.kind === 'cache' &&
    doc.cacheMode === 'cache-aside' &&
    Array.contains(cacheStoreKinds, to.kind)
  ) {
    return Option.some(DomainMessage.ConnectCacheAside())
  }
  if (canConnect(from.kind, to.kind)) {
    return Option.none()
  }
  if (to.kind === 'client') {
    return Option.some(DomainMessage.ConnectIntoClients())
  }
  if (from.kind === 'client' && to.kind === 'db') {
    return Option.some(DomainMessage.ConnectClientsToDatabase())
  }
  if (from.kind === 'server' && to.kind === 'server') {
    return Option.some(DomainMessage.ConnectServerToServer())
  }
  if (from.kind === 'lb' && to.kind === 'db') {
    return Option.some(DomainMessage.ConnectBalancerToDatabase())
  }
  if (catalog[to.kind].rank < catalog[from.kind].rank) {
    return Option.some(DomainMessage.ConnectWrongDirection())
  }
  if (isSink(from.kind)) {
    return Option.some(DomainMessage.ConnectFromSink({ from: from.kind }))
  }
  return Option.some(
    DomainMessage.ConnectNotAllowed({
      from: from.kind,
      to: to.kind,
      allowed: catalog[from.kind].connectsTo,
    }),
  )
}

const withNode = (
  doc: BoardDoc,
  id: string,
  apply: (node: BoardNode) => BoardResult,
): BoardResult =>
  Option.match(findNode(doc, id), {
    onNone: () => Result.fail(DomainMessage.UnknownNode({ id })),
    onSome: apply,
  })

// Отказ региона роняет его инфраструктуру. Пользователи региона остаются:
// они не исчезают вместе с дата-центром, а уходят в живой регион (D6).
const regionBlocks = (doc: BoardDoc, region: Region): ReadonlyArray<string> =>
  pipe(
    doc.nodes,
    Array.filter(
      node =>
        node.kind !== 'client' &&
        Option.exists(node.maybeRegion, nodeRegion => nodeRegion === region),
    ),
    Array.map(node => node.id),
  )

const withRegion = (
  doc: BoardDoc,
  region: Region,
  apply: (ids: Array.NonEmptyReadonlyArray<string>) => BoardResult,
): BoardResult =>
  Array.match(regionBlocks(doc, region), {
    onEmpty: () => Result.fail(DomainMessage.RegionHasNoBlocks({ region })),
    onNonEmpty: apply,
  })

const isValidShare = (share: number): boolean =>
  globalThis.Number.isFinite(share) && share > 0

const isValidCapacity = (maybeCapacity: Option.Option<number>): boolean =>
  Option.match(maybeCapacity, {
    onNone: () => true,
    onSome: capacity => globalThis.Number.isFinite(capacity) && capacity > 0,
  })

const hasEdge = (doc: BoardDoc, edge: Edge): boolean =>
  Array.some(
    doc.edges,
    candidate => candidate.from === edge.from && candidate.to === edge.to,
  )

const reconnect = (doc: BoardDoc, edge: Edge, next: Edge): BoardResult => {
  if (!hasEdge(doc, edge)) {
    return Result.fail(
      DomainMessage.UnknownEdge({ from: edge.from, to: edge.to }),
    )
  }
  if (edge.from === next.from && edge.to === next.to) {
    return Result.succeed(doc)
  }
  const isMoved = (candidate: Edge) =>
    candidate.from === edge.from && candidate.to === edge.to
  const without = {
    ...doc,
    edges: Array.filter(doc.edges, candidate => !isMoved(candidate)),
  }
  return Result.map(
    applyOp(without, BoardOp.Connect({ from: next.from, to: next.to })),
    () => ({
      ...doc,
      edges: Array.map(doc.edges, candidate =>
        isMoved(candidate) ? { from: next.from, to: next.to } : candidate,
      ),
    }),
  )
}

export const applyOp = (doc: BoardDoc, op: BoardOp): BoardResult =>
  BoardOp.match(op, {
    AddNode: node =>
      hasNode(doc, node.id)
        ? Result.fail(DomainMessage.DuplicateNodeId({ id: node.id }))
        : isValidCapacity(node.maybeCapacity)
          ? Result.succeed({
              ...doc,
              nodes: [
                ...doc.nodes,
                {
                  id: node.id,
                  kind: node.kind,
                  x: node.x,
                  y: node.y,
                  locked: node.locked,
                  maybeCapacity: node.maybeCapacity,
                  maybeRegion: node.maybeRegion,
                },
              ],
            })
          : Result.fail(DomainMessage.InvalidCapacity({ id: node.id })),
    RemoveNode: ({ id }) =>
      withNode(doc, id, node =>
        node.locked
          ? Result.fail(DomainMessage.NodeIsPartOfTask({ id }))
          : Result.succeed({
              ...doc,
              nodes: Array.filter(doc.nodes, candidate => candidate.id !== id),
              edges: Array.filter(
                doc.edges,
                edge => edge.from !== id && edge.to !== id,
              ),
              failed: Array.filter(doc.failed, failedId => failedId !== id),
              shares: Object.fromEntries(
                Object.entries(doc.shares).filter(([group]) => group !== id),
              ),
            }),
      ),
    MoveNode: ({ id, x, y }) =>
      withNode(doc, id, () =>
        Result.succeed({
          ...doc,
          nodes: Array.map(doc.nodes, node =>
            node.id === id ? { ...node, x, y } : node,
          ),
        }),
      ),
    Connect: ({ from, to }) =>
      withNode(doc, from, fromNode =>
        withNode(doc, to, toNode =>
          Option.match(connectRefusal(doc, fromNode, toNode), {
            onNone: () =>
              Result.succeed({ ...doc, edges: [...doc.edges, { from, to }] }),
            onSome: Result.fail,
          }),
        ),
      ),
    Reconnect: ({ from, to, nextFrom, nextTo }) =>
      reconnect(doc, { from, to }, { from: nextFrom, to: nextTo }),
    Disconnect: ({ from, to }) =>
      Result.succeed({
        ...doc,
        edges: Array.filter(
          doc.edges,
          edge => !(edge.from === from && edge.to === to),
        ),
      }),
    SetLoad: ({ rps }) => Result.succeed({ ...doc, load: rps }),
    FailNode: ({ id }) =>
      withNode(doc, id, () =>
        Result.succeed({
          ...doc,
          failed: Array.contains(doc.failed, id)
            ? doc.failed
            : [...doc.failed, id],
        }),
      ),
    RecoverNode: ({ id }) =>
      Result.succeed({
        ...doc,
        failed: Array.filter(doc.failed, failedId => failedId !== id),
      }),
    FailRegion: ({ region }) =>
      withRegion(doc, region, ids =>
        Result.succeed({
          ...doc,
          failed: Array.union(doc.failed, ids),
        }),
      ),
    RecoverRegion: ({ region }) =>
      withRegion(doc, region, ids =>
        Result.succeed({
          ...doc,
          failed: Array.difference(doc.failed, ids),
        }),
      ),
    SetShare: ({ id, share }) =>
      withNode(doc, id, node =>
        node.kind !== 'client'
          ? Result.fail(DomainMessage.ShareNotForUsers({ id }))
          : isValidShare(share)
            ? Result.succeed({ ...doc, shares: { ...doc.shares, [id]: share } })
            : Result.fail(DomainMessage.InvalidShare({ id })),
      ),
    Reset: () => Result.succeed(emptyBoard),
    SetTraffic: ({ traffic }) => {
      const next: TrafficProfile = { ...doc.traffic, ...traffic }
      return Option.match(invalidKnob(next), {
        onNone: () => Result.succeed({ ...doc, traffic: next }),
        onSome: knob => Result.fail(DomainMessage.InvalidTraffic({ knob })),
      })
    },
    SetCacheMode: ({ mode }) => Result.succeed({ ...doc, cacheMode: mode }),
  })

export const foldOps = (doc: BoardDoc, ops: ReadonlyArray<BoardOp>): BoardDoc =>
  Array.reduce(ops, doc, (current, op) =>
    Result.getOrElse(applyOp(current, op), () => current),
  )

export const nodesOfKind = (
  doc: BoardDoc,
  kind: ComponentKind,
): ReadonlyArray<BoardNode> =>
  Array.filter(doc.nodes, node => node.kind === kind)

/** Связь кеша с базой или репликой, по которой в режиме cache-aside ничего не
    течёт: доска рисует её пунктиром, цель `NoLink` просит её убрать. */
export const isIdleCacheEdge = (doc: BoardDoc, edge: Edge): boolean =>
  doc.cacheMode === 'cache-aside' &&
  Option.exists(findNode(doc, edge.from), node => node.kind === 'cache') &&
  Option.exists(findNode(doc, edge.to), node =>
    Array.contains(cacheStoreKinds, node.kind),
  )

export const targetsOf = (doc: BoardDoc, id: string): ReadonlyArray<string> =>
  pipe(
    doc.edges,
    Array.filter(edge => edge.from === id),
    Array.map(edge => edge.to),
  )

const nextFreeId = (doc: BoardDoc, prefix: string, start: number): string =>
  pipe(
    Array.range(start, start + doc.nodes.length + 1),
    Array.map(index => `${prefix}${index}`),
    Array.findFirst(candidate => !hasNode(doc, candidate)),
    Option.getOrElse(() => `${prefix}${start}`),
  )

const idPattern: Readonly<
  Record<ComponentKind, readonly [prefix: string, start: number]>
> = {
  client: ['users', 2],
  cdn: ['cdn-', 1],
  limiter: ['limiter-', 1],
  lb: ['lb-', 1],
  server: ['app', 1],
  cache: ['cache-', 1],
  queue: ['queue-', 1],
  events: ['events-', 1],
  worker: ['worker-', 1],
  db: ['db', 2],
  replica: ['replica-', 1],
  search: ['search-', 1],
  storage: ['storage-', 1],
}

export const nextNodeId = (doc: BoardDoc, kind: ComponentKind): string => {
  const [prefix, start] = idPattern[kind]
  return nextFreeId(doc, prefix, start)
}

export const rankOf = (node: BoardNode): number => catalog[node.kind].rank

/** Ёмкость блока: своя из `AddNode`, иначе из каталога. */
export const capacityOf = (node: BoardNode): number =>
  Option.getOrElse(node.maybeCapacity, () => catalog[node.kind].capacity)

export const nodesInRegion = (
  doc: BoardDoc,
  region: Region,
): ReadonlyArray<BoardNode> =>
  Array.filter(doc.nodes, node =>
    Option.exists(node.maybeRegion, nodeRegion => nodeRegion === region),
  )

/** Регион упал: все его блоки, кроме пользователей, недоступны. */
export const isRegionDown = (doc: BoardDoc, region: Region): boolean =>
  Array.match(regionBlocks(doc, region), {
    onEmpty: () => false,
    onNonEmpty: ids => Array.every(ids, id => Array.contains(doc.failed, id)),
  })
