import { Array, Option, Schema } from 'effect'

import { findDevice } from '../../net/doc'
import { type Goal, checkGoal } from '../../net/goals'
import { kindOf } from '../../net/model'
import { StackLevel, sourceOf } from '../../net/packet'
import { runCommand } from '../../net/terminal'
import { renderNetMessage } from '../../net/text'
import type { BoardKind } from '../contract'
import { BoardMessage, BoardState, KindMessage, KindOp } from '../state'
import type { PacketTypes } from '../types'
import * as PacketBoard from './board'
import {
  type PacketDoc,
  type PacketOp,
  type PacketRun,
  applyPacketOp,
  emptyPacketDoc,
  runPacket,
} from './doc'
import type { PacketStage } from './dsl'
import { panelSurfaces } from './surfaces/panel/surfaces'
import { browserPicture } from './surfaces/screen/browser'
import { browserSurface, wifiSurface } from './surfaces/screen/surface'
import { terminalSurface } from './surfaces/terminal/surface'

// Вид доски курса сетей (design D6). Модель пакетов — `src/net/`; здесь
// только её подключение к контракту. Доска — заготовка, поверхность одна.

// TARGETS

const LINK_PREFIX = 'link:'
const ENVELOPE_PREFIX = 'env:'

const isStackLevel = Schema.is(StackLevel)

/** Устройство по id, связь `link:<id>`, слой конверта `env:<уровень>`.
    Зоны (`zone:…`) появятся вместе с планом квартиры. */
const resolveTarget = (
  world: PacketDoc,
  target: string,
): Option.Option<string> =>
  target.startsWith(LINK_PREFIX)
    ? Array.some(world.doc.links, link => `${LINK_PREFIX}${link.id}` === target)
      ? Option.some(target)
      : Option.none()
    : target.startsWith(ENVELOPE_PREFIX)
      ? isStackLevel(target.slice(ENVELOPE_PREFIX.length))
        ? Option.some(target)
        : Option.none()
      : Option.map(findDevice(world.doc, target), device => device.id)

const stageTargets = (item: PacketStage): ReadonlyArray<string> =>
  item._tag === 'Highlight' || item._tag === 'Annotate'
    ? [item.target]
    : item._tag === 'Play'
      ? [sourceOf(item.intent)]
      : item._tag === 'OpenEnvelope'
        ? [`${ENVELOPE_PREFIX}${item.level}`]
        : [item.device]

// JOURNAL

const fieldsText = (value: object): string =>
  Array.getSomes(
    Array.map(Object.entries(value), ([key, field]) =>
      key !== '_tag' &&
      (typeof field === 'string' ||
        typeof field === 'number' ||
        typeof field === 'boolean')
        ? Option.some(`${field}`)
        : Option.none(),
    ),
  ).join(' · ')

const opText = (op: PacketOp): string =>
  op._tag === 'AddDevice'
    ? `AddDevice ${op.device.id} · ${kindOf(op.device)}`
    : op._tag === 'Send'
      ? `Send ${op.intent._tag} ${fieldsText(op.intent)}`
      : `${op._tag} ${fieldsText(op)}`

// MOVES

/** Ход ученика со своей сценой: открытая страница или трассы команды
    терминала (`ping`, `curl`) проигрываются на доске. */
const moveStage = (
  before: PacketDoc,
  op: PacketOp,
): ReadonlyArray<PacketStage> =>
  op._tag === 'Send'
    ? [{ _tag: 'Play', intent: op.intent }]
    : op._tag === 'RunCommand'
      ? Array.map(
          runCommand(before.doc, before.state, op.device, op.line).traces,
          (traced): PacketStage => ({ _tag: 'Play', intent: traced.intent }),
        )
      : []

// KIND

export const packet: BoardKind<PacketTypes> = {
  id: 'packet',

  empty: emptyPacketDoc,
  apply: applyPacketOp,
  run: runPacket,

  checkGoal: (world: PacketDoc, run: PacketRun, goal: Goal) => {
    const check = checkGoal(world.doc, run.settled, goal)
    return {
      met: check.met,
      maybeFailure: check.maybeFailure,
      focusNodes: check.focusDevices,
      focusEdges: check.focusLinks,
    }
  },
  isHiddenGoal: () => false,
  solvedGoalText: () => Option.none(),
  outcome: () => [],

  proseContext: (doc, run) => ({ doc, run }),
  annotationInput: (doc, run) => ({ doc, run }),
  resolveTarget,
  stage: {
    targets: stageTargets,
    annotationKey: item =>
      item._tag === 'Annotate' ? Option.some(item.key) : Option.none(),
    describe: item => `${item._tag} ${fieldsText(item)}`,
  },
  targetName: (_doc, target) => target,
  describeOp: opText,
  moveStage,
  renderMessage: (locale, _ui, message, name) =>
    renderNetMessage(locale, message, name),

  op: {
    wrap: op => KindOp.PacketOp({ op }),
    unwrap: stored =>
      stored._tag === 'PacketOp' ? Option.some(stored.op) : Option.none(),
  },
  message: {
    wrap: message => KindMessage.PacketMessage({ message }),
    unwrap: stored =>
      stored._tag === 'PacketMessage'
        ? Option.some(stored.message)
        : Option.none(),
  },

  board: {
    init: PacketBoard.initialModel,
    state: {
      wrap: model => BoardState.PacketBoard({ model }),
      unwrap: stored =>
        stored._tag === 'PacketBoard'
          ? Option.some(stored.model)
          : Option.none(),
    },
    message: {
      wrap: message => BoardMessage.GotPacketBoardMessage({ message }),
      unwrap: stored =>
        stored._tag === 'GotPacketBoardMessage'
          ? Option.some(stored.message)
          : Option.none(),
    },
    update: PacketBoard.update,
    pressDelete: PacketBoard.pressDelete,
    interrupt: PacketBoard.interrupt,
    replay: PacketBoard.replay,
    frame: PacketBoard.frame,
    view: PacketBoard.view,
    instruments: PacketBoard.instruments,
  },
  surfaces: [wifiSurface, browserSurface, terminalSurface, ...panelSurfaces],

  // NOTE: `NextHop`, `PickLinks`, `PickLayer`, `PlaceChips`, `SpotFault` и
  // картинки вариантов (экраны браузера) добавляет add-network-board.
  quizzes: ['PickDevice'],
  picture: browserPicture,
}
