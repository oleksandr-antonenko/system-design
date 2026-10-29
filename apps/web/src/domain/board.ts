import { Array, Option, Result, Schema, pipe } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { DomainMessage } from '../i18n/domainMessage'
import { ComponentKind, canConnect, catalog } from './catalog'

// MODEL

export const BoardNode = Schema.Struct({
  id: Schema.String,
  kind: ComponentKind,
  x: Schema.Number,
  y: Schema.Number,
  locked: Schema.Boolean,
})
export type BoardNode = typeof BoardNode.Type

export const Edge = Schema.Struct({ from: Schema.String, to: Schema.String })
export type Edge = typeof Edge.Type

export const BoardDoc = Schema.Struct({
  nodes: Schema.Array(BoardNode),
  edges: Schema.Array(Edge),
  load: Schema.Number,
  failed: Schema.Array(Schema.String),
})
export type BoardDoc = typeof BoardDoc.Type

export const emptyBoard: BoardDoc = {
  nodes: [],
  edges: [],
  load: 0,
  failed: [],
}

export const edgeKey = (edge: Edge): string => `${edge.from}>${edge.to}`

// OPERATIONS

export const BoardOp = defineTaggedUnion({
  AddNode: {
    id: Schema.String,
    kind: ComponentKind,
    x: Schema.Number,
    y: Schema.Number,
    locked: Schema.Boolean,
  },
  RemoveNode: { id: Schema.String },
  MoveNode: { id: Schema.String, x: Schema.Number, y: Schema.Number },
  Connect: { from: Schema.String, to: Schema.String },
  Disconnect: { from: Schema.String, to: Schema.String },
  SetLoad: { rps: Schema.Number },
  FailNode: { id: Schema.String },
  RecoverNode: { id: Schema.String },
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
  return Option.some(DomainMessage.ConnectWrongDirection())
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

export const applyOp = (doc: BoardDoc, op: BoardOp): BoardResult =>
  BoardOp.match(op, {
    AddNode: ({ id, kind, x, y, locked }) =>
      hasNode(doc, id)
        ? Result.fail(DomainMessage.DuplicateNodeId({ id }))
        : Result.succeed({
            ...doc,
            nodes: [...doc.nodes, { id, kind, x, y, locked }],
          }),
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

export const nextNodeId = (doc: BoardDoc, kind: ComponentKind): string =>
  kind === 'lb'
    ? nextFreeId(doc, 'lb-', 1)
    : kind === 'server'
      ? nextFreeId(doc, 'app', 1)
      : kind === 'db'
        ? nextFreeId(doc, 'db', 2)
        : nextFreeId(doc, 'users', 2)

export const rankOf = (node: BoardNode): number => catalog[node.kind].rank
