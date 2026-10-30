import { Array, Option } from 'effect'
import { Update } from 'foldkit'

import { type Goal, checkGoal } from '../../net/goals'
import { kindOf } from '../../net/model'
import { renderNetMessage } from '../../net/text'
import type { BoardKind, SurfaceDefinition } from '../contract'
import {
  BoardMessage,
  BoardState,
  KindMessage,
  KindOp,
  SurfaceMessage,
  SurfaceState,
} from '../state'
import type { PacketTypes } from '../types'
import * as PacketBoard from './board'
import * as PacketInstruments from './instruments'
import {
  type PacketDoc,
  type PacketOp,
  type PacketRun,
  applyPacketOp,
  emptyPacketDoc,
  runPacket,
} from './doc'
import { panelSurfaces } from './surfaces/panel/surfaces'
import { resolveTarget, stageTargets, targetName } from './targets'
import * as PacketView from './view'
import * as Wifi from './wifi'

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

// SURFACES

const readWifi = (state: SurfaceState): Option.Option<Wifi.Model> =>
  state._tag === 'WifiSurface' ? Option.some(state.model) : Option.none()

const toWifiMessage = (message: Wifi.Message): SurfaceMessage =>
  SurfaceMessage.GotWifiSurfaceMessage({ message })

const wifiSurface: SurfaceDefinition<PacketTypes> = {
  type: 'wifi',
  feature: 'wifi',
  init: () => SurfaceState.WifiSurface({ model: Wifi.initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotWifiSurfaceMessage'
      ? Update.foldChild({
          update: Wifi.update(context),
          read: readWifi,
          write: (_state: SurfaceState, model: Wifi.Model): SurfaceState =>
            SurfaceState.WifiSurface({ model }),
          toParentMessage: toWifiMessage,
          toParentOutMessage: (outMessage: Wifi.OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: (context, ui) =>
    ui.network.wifiTab(
      Option.match(context.label(context.target), {
        onNone: () => context.target,
        onSome: label => label.name,
      }),
    ),
  view: (slot, h) =>
    Option.match(readWifi(slot.state), {
      onNone: () => h.empty,
      onSome: model =>
        Wifi.view(
          model,
          slot.context,
          slot.ui,
          message => slot.toParentMessage(toWifiMessage(message)),
          h,
        ),
    }),
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
    frame: PacketBoard.frame,
    view: PacketView.view,
    instruments: PacketInstruments.instruments,
  },
  surfaces: [wifiSurface, ...panelSurfaces],

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
  picture: () => Option.none(),
}
