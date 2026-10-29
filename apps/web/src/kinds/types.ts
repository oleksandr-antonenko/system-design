import type { BoardDoc, BoardOp } from '../domain/board'
import type { ComponentKind } from '../domain/catalog'
import type { Goal as FlowGoal } from '../domain/goals'
import type { SimResult } from '../domain/simulate'
import type { DomainMessage } from '../i18n/domainMessage'
import type { Goal as NetGoal } from '../net/goals'
import type { NetMessage } from '../net/message'
import type { DeviceKind } from '../net/model'
import type * as FlowBoard from './flow/board'
import type { FlowStage, StepContext } from './flow/dsl'
import type * as PacketBoard from './packet/board'
import type {
  PacketContext,
  PacketDoc,
  PacketOp,
  PacketRun,
} from './packet/doc'
import type { PacketStage, PacketSurface } from './packet/dsl'

/** Типы вида System Design. */
export type FlowTypes = Readonly<{
  Id: 'flow'
  Doc: BoardDoc
  Op: BoardOp
  Goal: FlowGoal
  Run: SimResult
  Stage: FlowStage
  Palette: ComponentKind
  Message: DomainMessage
  Prose: StepContext
  Annotation: SimResult
  Surface: 'board'
  BoardModel: FlowBoard.Model
  BoardMessage: FlowBoard.Message
}>

/** Типы вида сетей. */
export type PacketTypes = Readonly<{
  Id: 'packet'
  Doc: PacketDoc
  Op: PacketOp
  Goal: NetGoal
  Run: PacketRun
  Stage: PacketStage
  Palette: DeviceKind
  Message: NetMessage
  Prose: PacketContext
  Annotation: PacketContext
  Surface: PacketSurface
  BoardModel: PacketBoard.Model
  BoardMessage: PacketBoard.Message
}>

/** Виды доски по id из `defineCourse({ board })`. Новый вид — новая строка. */
export type KindTypesById = Readonly<{
  flow: FlowTypes
  packet: PacketTypes
}>
