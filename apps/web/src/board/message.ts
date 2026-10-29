import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'

import { BoardOp } from '../domain/board'
import { ComponentKind } from '../domain/catalog'

export const BoardPoint = Schema.Struct({ x: Schema.Number, y: Schema.Number })

export const PointerTarget = defineTaggedUnion({
  Node: { id: Schema.String },
  Port: { id: Schema.String },
  Edge: { from: Schema.String, to: Schema.String },
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
})
export type Message = typeof Message.Type

export const OutMessage = defineTaggedUnion({
  ProposedOp: { op: BoardOp },
})
export type OutMessage = typeof OutMessage.Type
