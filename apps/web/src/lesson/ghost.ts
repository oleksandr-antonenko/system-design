import { Array, Option, pipe } from 'effect'

import type { GhostPlan } from '../board/view'
import { type BoardDoc, BoardOp, edgeKey, findNode } from '../domain/board'
import type { Point } from '../domain/geometry'

type Resolved = Readonly<{ point: Point; maybeActualId: Option.Option<string> }>

const addedNodes = (solution: ReadonlyArray<BoardOp>) =>
  Array.getSomes(
    Array.map(solution, op =>
      BoardOp.match(op, {
        AddNode: added => Option.some(added),
        RemoveNode: () => Option.none(),
        MoveNode: () => Option.none(),
        Connect: () => Option.none(),
        Disconnect: () => Option.none(),
        SetLoad: () => Option.none(),
        FailNode: () => Option.none(),
        RecoverNode: () => Option.none(),
        FailRegion: () => Option.none(),
        RecoverRegion: () => Option.none(),
      }),
    ),
  )

const resolveNode = (
  doc: BoardDoc,
  solution: ReadonlyArray<BoardOp>,
  id: string,
): Option.Option<Resolved> =>
  Option.match(findNode(doc, id), {
    onSome: node =>
      Option.some({
        point: { x: node.x, y: node.y },
        maybeActualId: Option.some(node.id),
      }),
    onNone: () =>
      pipe(
        addedNodes(solution),
        Array.findFirst(added => added.id === id),
        Option.map(added =>
          pipe(
            Array.findFirst(
              doc.nodes,
              node => node.kind === added.kind && !node.locked,
            ),
            Option.match({
              onSome: node => ({
                point: { x: node.x, y: node.y },
                maybeActualId: Option.some(node.id),
              }),
              onNone: () => ({
                point: { x: added.x, y: added.y },
                maybeActualId: Option.none<string>(),
              }),
            }),
          ),
        ),
      ),
  })

const hasEdge = (doc: BoardDoc, from: string, to: string): boolean =>
  Array.some(doc.edges, edge => edge.from === from && edge.to === to)

export const ghostPlan = (
  doc: BoardDoc,
  solution: ReadonlyArray<BoardOp>,
): GhostPlan => {
  const nodes = pipe(
    addedNodes(solution),
    Array.filter(added =>
      Option.exists(resolveNode(doc, solution, added.id), resolved =>
        Option.isNone(resolved.maybeActualId),
      ),
    ),
    Array.map(added => ({ kind: added.kind, x: added.x, y: added.y })),
  )
  const edges = Array.getSomes(
    Array.map(solution, op =>
      op._tag !== 'Connect'
        ? Option.none()
        : pipe(
            Option.all([
              resolveNode(doc, solution, op.from),
              resolveNode(doc, solution, op.to),
            ]),
            Option.filter(
              ([from, to]) =>
                !Option.exists(
                  Option.all([from.maybeActualId, to.maybeActualId]),
                  ([fromId, toId]) => hasEdge(doc, fromId, toId),
                ),
            ),
            Option.map(([from, to]) => ({ from: from.point, to: to.point })),
          ),
    ),
  )
  const removeEdges = Array.getSomes(
    Array.map(solution, op =>
      op._tag === 'Disconnect' && hasEdge(doc, op.from, op.to)
        ? Option.some(edgeKey({ from: op.from, to: op.to }))
        : Option.none(),
    ),
  )
  return { nodes, edges, removeEdges }
}
