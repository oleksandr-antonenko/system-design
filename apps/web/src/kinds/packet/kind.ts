import { Array, Option } from 'effect'

import { type Goal, checkGoal } from '../../net/goals'
import { kindOf } from '../../net/model'
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
import * as PacketInstruments from './instruments'
import { panelSurfaces } from './surfaces/panel/surfaces'
import { browserPicture } from './surfaces/screen/browser'
import { browserSurface, wifiSurface } from './surfaces/screen/surface'
import { terminalSurface } from './surfaces/terminal/surface'
import { resolveTarget, stageTargets, targetName } from './targets'
import * as PacketView from './view'

// Вид доски курса сетей (design D6). Модель пакетов — `src/net/`; здесь
// только её подключение к контракту. Доска — `board.ts` (add-network-board),
// цели — `targets.ts`.

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
    терминала (`ping`, `curl`) проигрываются на доске. Одинаковые конверты
    команды (три эха ping) проигрываются один раз: доска показывает первое
    эхо, остальные строки печатает терминал. */
const moveStage = (
  before: PacketDoc,
  op: PacketOp,
): ReadonlyArray<PacketStage> =>
  op._tag === 'Send'
    ? [{ _tag: 'Play', intent: op.intent }]
    : op._tag === 'RunCommand'
      ? Array.map(
          Array.dedupeWith(
            Array.map(
              runCommand(before.doc, before.state, op.device, op.line).traces,
              traced => traced.intent,
            ),
            (left, right) => JSON.stringify(left) === JSON.stringify(right),
          ),
          (intent): PacketStage => ({ _tag: 'Play', intent }),
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
  taskHowTo: ui => ui.packetBoard.taskHowTo,

  proseContext: (doc, run) => ({ doc, run }),
  annotationInput: (doc, run) => ({ doc, run }),
  resolveTarget,
  stage: {
    targets: stageTargets,
    annotationKey: item =>
      item._tag === 'Annotate' ? Option.some(item.key) : Option.none(),
    describe: item => `${item._tag} ${fieldsText(item)}`,
  },
  targetName,
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
    view: PacketView.view,
    instruments: PacketInstruments.instruments,
  },
  surfaces: [wifiSurface, browserSurface, terminalSurface, ...panelSurfaces],

  quizzes: [
    'PickDevice',
    'NextHop',
    'PickLinks',
    'PickLayer',
    'SpotFault',
    'PickRule',
    'PlaceChips',
    'Match',
  ],
  picture: browserPicture,
}
