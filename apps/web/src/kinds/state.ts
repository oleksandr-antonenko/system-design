import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'

import { BoardOp } from '../domain/board'
import { DomainMessage } from '../i18n/domainMessage'
import { NetMessage } from '../net/message'
import * as FlowBoard from './flow/board'
import * as PacketBoard from './packet/board'
import { PacketOp } from './packet/doc'
import * as WifiSurface from './packet/wifi'

// Model плеера строится только из Schema (FOLDKIT.md), поэтому значения,
// тип которых зависит от вида доски, хранятся в union по виду (design D2).
// Новый вид доски или новая поверхность — новый вариант здесь.

/** Ход в журнале задачи. */
export const KindOp = defineTaggedUnion({
  FlowOp: { op: BoardOp },
  PacketOp: { op: PacketOp },
})
export type KindOp = typeof KindOp.Type

/** Отказ операции или невыполненная цель. */
export const KindMessage = defineTaggedUnion({
  FlowMessage: { message: DomainMessage },
  PacketMessage: { message: NetMessage },
})
export type KindMessage = typeof KindMessage.Type

/** Состояние подмодуля доски. */
export const BoardState = defineTaggedUnion({
  FlowBoard: { model: FlowBoard.Model },
  PacketBoard: { model: PacketBoard.Model },
})
export type BoardState = typeof BoardState.Type

export const BoardMessage = defineMessageUnion({
  GotFlowBoardMessage: { message: FlowBoard.Message },
  GotPacketBoardMessage: { message: PacketBoard.Message },
})
export type BoardMessage = typeof BoardMessage.Type

/** Состояние поверхности задачи. */
export const SurfaceState = defineTaggedUnion({
  WifiSurface: { model: WifiSurface.Model },
})
export type SurfaceState = typeof SurfaceState.Type

export const SurfaceMessage = defineMessageUnion({
  GotWifiSurfaceMessage: { message: WifiSurface.Message },
})
export type SurfaceMessage = typeof SurfaceMessage.Type
