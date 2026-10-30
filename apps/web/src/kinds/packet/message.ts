import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { StackLevel } from '../../net/packet'

// Сообщения доски сетей (add-network-board): что сделал ученик на доске и
// под ней. Где остановить проигрыватель, считает вид и кладёт в сообщение.

export const Message = defineMessageUnion({
  ClickedRun: {
    startAt: Schema.Number,
    stopAt: Schema.Number,
    total: Schema.Number,
  },
  ClickedStep: {
    startAt: Schema.Number,
    stopAt: Schema.Number,
    total: Schema.Number,
  },
  ClickedBack: { at: Schema.Number, total: Schema.Number },
  ClickedRestart: {},
  ClickedSpeed: {},
  ClickedLegend: {},
  ClickedEnvelope: {},
  ClickedCloseEnvelope: {},
  HoveredLayer: { position: Schema.Number },
  LeftLayer: {},
  ClickedDevice: { id: Schema.String },
  ClickedCloseCard: {},
  ClickedSticker: {},
  ClickedCloseSticker: {},
  ClickedCloud: { isOpen: Schema.Boolean },
  ClickedCandidate: {
    id: Schema.String,
    playTo: Schema.Number,
    total: Schema.Number,
  },
  ToggledCandidate: { id: Schema.String },
  ClickedDone: { playTo: Schema.Number, total: Schema.Number },
  PressedEnvelope: {},
  ReleasedOnCandidate: {
    id: Schema.String,
    playTo: Schema.Number,
    total: Schema.Number,
  },
  ReleasedPointer: {},
  ClickedChip: { chip: Schema.String },
  DraggedChip: { chip: Schema.String },
  ClickedSlot: { slot: Schema.String },
  DroppedOnSlot: { slot: Schema.String },
  ClickedCableTool: {},
  ClickedCableEnd: { id: Schema.String },
  ClickedUnplug: { a: Schema.String, b: Schema.String },
  PressedMoveKey: { id: Schema.String, x: Schema.Number, y: Schema.Number },
  GrabbedDevice: { id: Schema.String, x: Schema.Number, y: Schema.Number },
  MovedDevice: { x: Schema.Number, y: Schema.Number },
  DroppedDevice: {},
  UpdatedSendAddress: { value: Schema.String },
  SubmittedSend: { from: Schema.String, what: Schema.String },
  ClickedHeader: { level: StackLevel },
  DraggedHeader: { level: StackLevel },
  ClickedHeaderSlot: { position: Schema.Number },
  DroppedOnHeaderSlot: { position: Schema.Number },
  ClickedBuilderReset: {},
  ClickedBuilderSend: { from: Schema.String, url: Schema.String },
})
export type Message = typeof Message.Type
