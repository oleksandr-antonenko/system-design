import { Array, Option, Schema } from 'effect'
import { Update } from 'foldkit'

import { findDevice } from '../../net/doc'
import { type Goal, checkGoal } from '../../net/goals'
import type { NetMessage } from '../../net/message'
import { kindOf } from '../../net/model'
import { StackLevel, sourceOf } from '../../net/packet'
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
import {
  type PacketDoc,
  PacketOp,
  type PacketRun,
  applyPacketOp,
  emptyPacketDoc,
  runPacket,
} from './doc'
import type { PacketStage } from './dsl'
import * as Wifi from './wifi'

// Вид доски курса сетей (design D6). Модель пакетов — `src/net/`; здесь
// только её подключение к контракту. Доска — заготовка, поверхность одна.

// TARGETS

const LINK_PREFIX = 'link:'
const ENVELOPE_PREFIX = 'env:'

const isStackLevel = Schema.is(StackLevel)

/** Устройство по id, связь `link:<id>`, слой конверта `env:<уровень>`.
    Зоны (`zone:…`) появятся вместе с планом квартиры. */
const resolveTarget = (
  doc: PacketDoc,
  target: string,
): Option.Option<string> =>
  target.startsWith(LINK_PREFIX)
    ? Array.some(doc.net.links, link => `${LINK_PREFIX}${link.id}` === target)
      ? Option.some(target)
      : Option.none()
    : target.startsWith(ENVELOPE_PREFIX)
      ? isStackLevel(target.slice(ENVELOPE_PREFIX.length))
        ? Option.some(target)
        : Option.none()
      : Option.map(findDevice(doc.net, target), device => device.id)

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
  PacketOp.match(op, {
    Edit: ({ op: netOp }) =>
      netOp._tag === 'AddDevice'
        ? `AddDevice ${netOp.device.id} · ${kindOf(netOp.device)}`
        : `${netOp._tag} ${fieldsText(netOp)}`,
    Send: ({ intent }) => `Send ${intent._tag} ${fieldsText(intent)}`,
  })

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
    Update.foldChild({
      update: Wifi.update(context),
      read: readWifi,
      write: (_state: SurfaceState, model: Wifi.Model) =>
        SurfaceState.WifiSurface({ model }),
      toParentMessage: toWifiMessage,
      toParentOutMessage: (outMessage: Wifi.OutMessage) => outMessage,
    })(state, message.message),
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

  checkGoal: (doc: PacketDoc, run: PacketRun, goal: Goal) => {
    const check = checkGoal(doc.net, run.settled, goal)
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
  describeOp: opText,
  // NOTE: тексты кодов `NetMessage` на четырёх языках приходят с изменением
  // extend-packet-model (`renderNetMessage`); до него показывается код.
  renderMessage: (_ui, message: NetMessage) => message._tag,

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
    view: PacketBoard.view,
    instruments: PacketBoard.instruments,
  },
  surfaces: [wifiSurface],
}
