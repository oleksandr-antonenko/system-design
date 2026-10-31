import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'

import { BoardOp } from '../domain/board'
import { DomainMessage } from '../i18n/domainMessage'
import { NetOp } from '../net/doc'
import { NetMessage } from '../net/message'
import * as FlowBoard from './flow/board'
import * as PacketBoard from './packet/board'
import * as PanelSurface from './packet/surfaces/panel/panel'
import * as ReportMessage from './packet/surfaces/report/message'
import * as ReportSurface from './packet/surfaces/report/report'
import * as ScreenMessage from './packet/surfaces/screen/message'
import * as ScreenSurface from './packet/surfaces/screen/screen'
import * as TerminalMessage from './packet/surfaces/terminal/message'
import * as TerminalSurface from './packet/surfaces/terminal/terminal'
import * as ScenarioBoard from './scenario/board'
import { ScenarioMessage, ScenarioOp } from './scenario/doc'
import * as AssistantSurface from './scenario/surfaces/assistant'
import * as AuthSurface from './scenario/surfaces/auth'
import * as ChatSurface from './scenario/surfaces/chat'
import * as CrmSurface from './scenario/surfaces/crm'
import * as KeepassSurface from './scenario/surfaces/keepass'
import * as MailSurface from './scenario/surfaces/mail'
import * as PhoneSurface from './scenario/surfaces/phone'
import * as TraySurface from './scenario/surfaces/tray'
import * as VaultSurface from './scenario/surfaces/vault'

// Model плеера строится только из Schema (FOLDKIT.md), поэтому значения,
// тип которых зависит от вида доски, хранятся в union по виду (design D2).
// Новый вид доски или новая поверхность — новый вариант здесь.

/** Ход в журнале задачи. */
export const KindOp = defineTaggedUnion({
  FlowOp: { op: BoardOp },
  PacketOp: { op: NetOp },
  ScenarioOp: { op: ScenarioOp },
})
export type KindOp = typeof KindOp.Type

/** Отказ операции или невыполненная цель. */
export const KindMessage = defineTaggedUnion({
  FlowMessage: { message: DomainMessage },
  PacketMessage: { message: NetMessage },
  ScenarioMessage: { message: ScenarioMessage },
})
export type KindMessage = typeof KindMessage.Type

/** Состояние подмодуля доски. */
export const BoardState = defineTaggedUnion({
  FlowBoard: { model: FlowBoard.Model },
  PacketBoard: { model: PacketBoard.Model },
  ScenarioBoard: { model: ScenarioBoard.Model },
})
export type BoardState = typeof BoardState.Type

export const BoardMessage = defineMessageUnion({
  GotFlowBoardMessage: { message: FlowBoard.Message },
  GotPacketBoardMessage: { message: PacketBoard.Message },
  GotScenarioBoardMessage: { message: ScenarioBoard.Message },
})
export type BoardMessage = typeof BoardMessage.Type

/** Состояние поверхности задачи. */
export const SurfaceState = defineTaggedUnion({
  ScreenSurface: { model: ScreenSurface.Model },
  TerminalSurface: { model: TerminalSurface.Model },
  PanelSurface: { model: PanelSurface.Model },
  ReportSurface: { model: ReportSurface.Model },
  ScenarioPhoneSurface: { model: PhoneSurface.Model },
  ScenarioMailSurface: { model: MailSurface.Model },
  ScenarioVaultSurface: { model: VaultSurface.Model },
  ScenarioAuthSurface: { model: AuthSurface.Model },
  ScenarioChatSurface: { model: ChatSurface.Model },
  ScenarioAssistantSurface: { model: AssistantSurface.Model },
  ScenarioCrmSurface: { model: CrmSurface.Model },
  ScenarioKeepassSurface: { model: KeepassSurface.Model },
  ScenarioTraySurface: { model: TraySurface.Model },
})
export type SurfaceState = typeof SurfaceState.Type

export const SurfaceMessage = defineMessageUnion({
  GotScreenSurfaceMessage: { message: ScreenMessage.Message },
  GotTerminalSurfaceMessage: { message: TerminalMessage.Message },
  GotPanelSurfaceMessage: { message: PanelSurface.Message },
  GotReportSurfaceMessage: { message: ReportMessage.Message },
  GotScenarioPhoneMessage: { message: PhoneSurface.Message },
  GotScenarioMailMessage: { message: MailSurface.Message },
  GotScenarioVaultMessage: { message: VaultSurface.Message },
  GotScenarioAuthMessage: { message: AuthSurface.Message },
  GotScenarioChatMessage: { message: ChatSurface.Message },
  GotScenarioAssistantMessage: { message: AssistantSurface.Message },
  GotScenarioCrmMessage: { message: CrmSurface.Message },
  GotScenarioKeepassMessage: { message: KeepassSurface.Message },
  GotScenarioTrayMessage: { message: TraySurface.Message },
})
export type SurfaceMessage = typeof SurfaceMessage.Type
