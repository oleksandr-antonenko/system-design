import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'

import { BoardOp } from '../domain/board'
import { ComponentKind } from '../domain/catalog'

export const BoardPoint = Schema.Struct({ x: Schema.Number, y: Schema.Number })

/** Конец связи: начало у блока-источника или острие у блока-получателя. */
export const EdgeEnd = Schema.Literals(['from', 'to'])
export type EdgeEnd = typeof EdgeEnd.Type

export const PointerTarget = defineTaggedUnion({
  Node: { id: Schema.String },
  Port: { id: Schema.String },
  Edge: { from: Schema.String, to: Schema.String },
  /** Ручка на конце выделенной связи: её тянут, чтобы перенести конец. */
  EdgeEnd: { from: Schema.String, to: Schema.String, end: EdgeEnd },
  DeleteNode: { id: Schema.String },
  DeleteEdge: { from: Schema.String, to: Schema.String },
  Palette: { kind: ComponentKind },
  Background: {},
  Outside: {},
})
export type PointerTarget = typeof PointerTarget.Type

// MESSAGE

export const Message = defineMessageUnion({
  PressedPointer: { target: PointerTarget, point: BoardPoint },
  MovedPointer: { point: BoardPoint, isOverBoard: Schema.Boolean },
  ReleasedPointer: {
    target: PointerTarget,
    point: BoardPoint,
    isOverBoard: Schema.Boolean,
  },
  CancelledPointer: {},
  ClickedPaletteItem: { kind: ComponentKind },
  PressedPickKey: { id: Schema.String },
  /** Enter или пробел на связи в фокусе: выделить её. */
  PressedEdgeKey: { from: Schema.String, to: Schema.String },
  /** Enter или пробел на ручке конца связи: выбрать блок для него с
      клавиатуры (`PressedPickKey` на блоке). */
  PressedEdgeEndKey: { from: Schema.String, to: Schema.String, end: EdgeEnd },
})
export type Message = typeof Message.Type

export const OutMessage = defineTaggedUnion({
  ProposedOp: { op: BoardOp },
  PickedNode: { id: Schema.String },
})
export type OutMessage = typeof OutMessage.Type
