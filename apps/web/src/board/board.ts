import { Array, Option, Schema, pipe } from 'effect'
import type { Update } from 'foldkit'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'

import { type BoardDoc, BoardOp, findNode, nextNodeId } from '../domain/board'
import { ComponentKind } from '../domain/catalog'
import {
  type Point,
  clampToBoard,
  isSpotFree,
  regionZones,
  zoneAt,
} from '../domain/geometry'
import { BoardPoint, Message, OutMessage, PointerTarget } from './message'

export { BoardPoint, Message, OutMessage, PointerTarget } from './message'

// MODEL

export const Selection = defineTaggedUnion({
  Node: { id: Schema.String },
  Edge: { from: Schema.String, to: Schema.String },
})
export type Selection = typeof Selection.Type

export const Gesture = defineTaggedUnion({
  Idle: {},
  DraggingNode: {
    id: Schema.String,
    start: BoardPoint,
    origin: BoardPoint,
    current: BoardPoint,
    hasMoved: Schema.Boolean,
  },
  Connecting: { from: Schema.String, pointer: BoardPoint },
  Placing: {
    kind: ComponentKind,
    start: BoardPoint,
    pointer: BoardPoint,
    hasMoved: Schema.Boolean,
    isOverBoard: Schema.Boolean,
  },
})
export type Gesture = typeof Gesture.Type

export const Model = Schema.Struct({
  gesture: Gesture,
  maybeSelection: Schema.Option(Selection),
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  gesture: Gesture.Idle(),
  maybeSelection: Option.none(),
}

// UPDATE

export type Input = Readonly<{
  doc: BoardDoc
  isEditable: boolean
  /** Квиз на доске: блоки, которые можно выбрать. */
  pickable?: ReadonlyArray<string>
}>

export type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage
>

const DRAG_THRESHOLD = 4
const PLACE_THRESHOLD = 6

const distance = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y)

const idle = (model: Model): Model =>
  modifyFields(model, { gesture: () => Gesture.Idle() })

const propose = (model: Model, op: BoardOp): UpdateReturn => ({
  model,
  outMessage: OutMessage.ProposedOp({ op }),
})

const defaultSpots: Readonly<Record<ComponentKind, ReadonlyArray<Point>>> = {
  client: [
    { x: 100, y: 130 },
    { x: 100, y: 430 },
  ],
  lb: [
    { x: 300, y: 280 },
    { x: 300, y: 130 },
    { x: 300, y: 430 },
  ],
  server: [
    { x: 520, y: 515 },
    { x: 300, y: 515 },
    { x: 740, y: 515 },
    { x: 740, y: 130 },
  ],
  db: [
    { x: 790, y: 430 },
    { x: 790, y: 130 },
  ],
  cdn: [
    { x: 230, y: 130 },
    { x: 230, y: 430 },
  ],
  limiter: [
    { x: 230, y: 280 },
    { x: 230, y: 430 },
  ],
  cache: [
    { x: 660, y: 200 },
    { x: 660, y: 360 },
    { x: 660, y: 515 },
  ],
  queue: [
    { x: 660, y: 515 },
    { x: 660, y: 130 },
  ],
  events: [
    { x: 660, y: 515 },
    { x: 660, y: 130 },
  ],
  worker: [
    { x: 790, y: 515 },
    { x: 790, y: 130 },
  ],
  replica: [
    { x: 790, y: 130 },
    { x: 790, y: 515 },
  ],
  search: [
    { x: 790, y: 515 },
    { x: 790, y: 130 },
  ],
  storage: [
    { x: 790, y: 515 },
    { x: 790, y: 130 },
    { x: 790, y: 280 },
  ],
}

const freeSpot = (doc: BoardDoc, kind: ComponentKind): Point =>
  pipe(
    defaultSpots[kind],
    Array.findFirst(spot => isSpotFree(doc.nodes, spot)),
    Option.getOrElse(() => ({ x: 450, y: 515 })),
  )

const addNodeAt = (
  doc: BoardDoc,
  kind: ComponentKind,
  point: Point,
): BoardOp => {
  const spot = clampToBoard(point)
  return BoardOp.AddNode({
    id: nextNodeId(doc, kind),
    kind,
    x: spot.x,
    y: spot.y,
    locked: false,
    maybeCapacity: Option.none(),
    maybeRegion: Option.map(
      zoneAt(regionZones(doc.nodes), spot),
      zone => zone.region,
    ),
  })
}

const pressed = (
  model: Model,
  target: PointerTarget,
  point: Point,
  doc: BoardDoc,
): UpdateReturn =>
  PointerTarget.match(target, {
    Port: ({ id }) => ({
      model: modifyFields(model, {
        gesture: () => Gesture.Connecting({ from: id, pointer: point }),
        maybeSelection: () => Option.none(),
      }),
    }),
    Node: ({ id }) =>
      Option.match(findNode(doc, id), {
        onNone: () => ({ model }),
        onSome: node => ({
          model: modifyFields(model, {
            gesture: () =>
              Gesture.DraggingNode({
                id,
                start: point,
                origin: { x: node.x, y: node.y },
                current: { x: node.x, y: node.y },
                hasMoved: false,
              }),
          }),
        }),
      }),
    Edge: ({ from, to }) => ({
      model: modifyFields(model, {
        maybeSelection: () => Option.some(Selection.Edge({ from, to })),
      }),
    }),
    DeleteNode: ({ id }) =>
      propose(
        modifyFields(model, { maybeSelection: () => Option.none() }),
        BoardOp.RemoveNode({ id }),
      ),
    DeleteEdge: ({ from, to }) =>
      propose(
        modifyFields(model, { maybeSelection: () => Option.none() }),
        BoardOp.Disconnect({ from, to }),
      ),
    Palette: ({ kind }) => ({
      model: modifyFields(model, {
        gesture: () =>
          Gesture.Placing({
            kind,
            start: point,
            pointer: point,
            hasMoved: false,
            isOverBoard: false,
          }),
      }),
    }),
    Background: () => ({
      model: modifyFields(model, { maybeSelection: () => Option.none() }),
    }),
    Outside: () => ({ model }),
  })

const moved = (
  model: Model,
  point: Point,
  isOverBoard: boolean,
): UpdateReturn =>
  Gesture.match(model.gesture, {
    Idle: () => ({ model }),
    DraggingNode: dragging => {
      const hasMoved =
        dragging.hasMoved || distance(point, dragging.start) > DRAG_THRESHOLD
      return {
        model: modifyFields(model, {
          gesture: () =>
            Gesture.DraggingNode({
              ...dragging,
              hasMoved,
              current: clampToBoard({
                x: dragging.origin.x + point.x - dragging.start.x,
                y: dragging.origin.y + point.y - dragging.start.y,
              }),
            }),
        }),
      }
    },
    Connecting: ({ from }) => ({
      model: modifyFields(model, {
        gesture: () => Gesture.Connecting({ from, pointer: point }),
      }),
    }),
    Placing: placing => ({
      model: modifyFields(model, {
        gesture: () =>
          Gesture.Placing({
            ...placing,
            pointer: point,
            isOverBoard,
            hasMoved:
              placing.hasMoved ||
              distance(point, placing.start) > PLACE_THRESHOLD,
          }),
      }),
    }),
  })

const targetNodeId = (target: PointerTarget): Option.Option<string> =>
  PointerTarget.match(target, {
    Node: ({ id }) => Option.some(id),
    Port: ({ id }) => Option.some(id),
    Edge: () => Option.none(),
    DeleteNode: () => Option.none(),
    DeleteEdge: () => Option.none(),
    Palette: () => Option.none(),
    Background: () => Option.none(),
    Outside: () => Option.none(),
  })

const released = (
  model: Model,
  target: PointerTarget,
  point: Point,
  isOverBoard: boolean,
  doc: BoardDoc,
): UpdateReturn =>
  Gesture.match(model.gesture, {
    Idle: () => ({ model }),
    DraggingNode: ({ id, hasMoved, current }) =>
      hasMoved
        ? propose(
            idle(model),
            BoardOp.MoveNode({ id, x: current.x, y: current.y }),
          )
        : {
            model: modifyFields(idle(model), {
              maybeSelection: () => Option.some(Selection.Node({ id })),
            }),
          },
    Connecting: ({ from }) =>
      Option.match(
        Option.filter(targetNodeId(target), to => to !== from),
        {
          onNone: () => ({ model: idle(model) }),
          onSome: to => propose(idle(model), BoardOp.Connect({ from, to })),
        },
      ),
    Placing: ({ kind, hasMoved }) =>
      hasMoved && isOverBoard
        ? propose(idle(model), addNodeAt(doc, kind, point))
        : { model: idle(model) },
  })

const deleteSelection = (model: Model): UpdateReturn =>
  Option.match(model.maybeSelection, {
    onNone: () => ({ model }),
    onSome: selection =>
      propose(
        modifyFields(model, { maybeSelection: () => Option.none() }),
        Selection.match(selection, {
          Node: ({ id }) => BoardOp.RemoveNode({ id }),
          Edge: ({ from, to }) => BoardOp.Disconnect({ from, to }),
        }),
      ),
  })

const pickedBy = (
  message: Message,
  pickable: ReadonlyArray<string>,
): Option.Option<string> =>
  pipe(
    Message.match(message, {
      ReleasedPointer: ({ target }) => targetNodeId(target),
      PressedPickKey: ({ id }) => Option.some(id),
      PressedPointer: () => Option.none<string>(),
      MovedPointer: () => Option.none<string>(),
      CancelledPointer: () => Option.none<string>(),
      ClickedPaletteItem: () => Option.none<string>(),
    }),
    Option.filter(id => Array.contains(pickable, id)),
  )

export const update =
  ({ doc, isEditable, pickable = [] }: Input) =>
  (model: Model, message: Message): UpdateReturn => {
    if (!isEditable) {
      return Option.match(pickedBy(message, pickable), {
        onNone: () => ({ model: initialModel }),
        onSome: id => ({
          model: initialModel,
          outMessage: OutMessage.PickedNode({ id }),
        }),
      })
    }
    return Message.match<UpdateReturn>(message, {
      PressedPointer: ({ target, point }) => pressed(model, target, point, doc),
      MovedPointer: ({ point, isOverBoard }) =>
        moved(model, point, isOverBoard),
      ReleasedPointer: ({ target, point, isOverBoard }) =>
        released(model, target, point, isOverBoard, doc),
      CancelledPointer: () => ({ model: idle(model) }),
      ClickedPaletteItem: ({ kind }) =>
        propose(model, addNodeAt(doc, kind, freeSpot(doc, kind))),
      PressedPickKey: () => ({ model }),
    })
  }

export const pressDeleteKey =
  ({ isEditable }: Input) =>
  (model: Model): UpdateReturn =>
    isEditable ? deleteSelection(model) : { model: initialModel }

export const pressEscapeKey = (_model: Model): UpdateReturn => ({
  model: initialModel,
})

export const previewDoc = (doc: BoardDoc, gesture: Gesture): BoardDoc =>
  Gesture.match(gesture, {
    DraggingNode: ({ id, current, hasMoved }) =>
      hasMoved
        ? {
            ...doc,
            nodes: Array.map(doc.nodes, node =>
              node.id === id ? { ...node, x: current.x, y: current.y } : node,
            ),
          }
        : doc,
    Idle: () => doc,
    Connecting: () => doc,
    Placing: () => doc,
  })
