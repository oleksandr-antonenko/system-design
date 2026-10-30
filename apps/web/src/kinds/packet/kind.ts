import { Array, Option, Result } from 'effect'

import { type Goal, checkGoal } from '../../net/goals'
import { kindOf } from '../../net/model'
import { Intent } from '../../net/packet'
import { runCommand } from '../../net/terminal'
import { renderNetMessage } from '../../net/text'
import { addressOf } from '../../net/topology'
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

/** Хосты, которые получили адрес только благодаря новой связи. */
const joinedBy = (before: PacketDoc, op: PacketOp): ReadonlyArray<string> =>
  op._tag !== 'Connect'
    ? []
    : Result.match(applyPacketOp(before, op), {
        onFailure: () => [],
        onSuccess: after => {
          const was = runPacket(before).settled
          const now = runPacket(after).settled
          return Array.filter(
            [op.a, op.b],
            id =>
              Array.some(
                after.doc.devices,
                device =>
                  device.id === id &&
                  device._tag === 'Host' &&
                  device.addressing._tag === 'Dhcp',
              ) &&
              Option.isNone(addressOf(before.doc, was, id)) &&
              Option.isSome(addressOf(after.doc, now, id)),
          )
        },
      })

const playsOf = (
  before: PacketDoc,
  op: PacketOp,
): ReadonlyArray<PacketStage> =>
  op._tag === 'Send'
    ? op.intent._tag === 'Raw'
      ? [
          { _tag: 'Builder', from: op.intent.from, url: op.intent.url },
          { _tag: 'Play', intent: op.intent, show: 'request' },
        ]
      : [{ _tag: 'Play', intent: op.intent }]
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
      : Array.map(joinedBy(before, op), (device): PacketStage => ({
          _tag: 'Play',
          intent: Intent.DhcpJoin({ device }),
          after: [op],
        }))

/** Ход ученика со своей сценой: открытая страница или трассы команды
    терминала (`ping`, `curl`) проигрываются на доске; кабель, по которому
    устройство получило адрес, показывает выдачу адреса. Одинаковые конверты
    команды (три эха ping) проигрываются один раз: доска показывает первое
    эхо, остальные строки печатает терминал. Если в облаке настоящие
    транзитные роутеры, оно раскрыто: конверт идёт через них хоп за хопом.
    Собранный конверт (`Raw`, урок 7) летит сам, без справочной и
    рукопожатий, а сборщик остаётся под доской для новой попытки. */
const moveStage = (
  before: PacketDoc,
  op: PacketOp,
): ReadonlyArray<PacketStage> => {
  const plays = playsOf(before, op)
  return Array.isReadonlyArrayNonEmpty(plays) &&
    Array.some(before.doc.devices, device => device._tag === 'Transit')
    ? [{ _tag: 'Expand', target: 'internet' }, ...plays]
    : plays
}

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
