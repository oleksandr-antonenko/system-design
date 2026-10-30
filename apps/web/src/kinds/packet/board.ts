import { Array, Option, Record, Schema } from 'effect'
import type { Update } from 'foldkit'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'

import { DomainMessage } from '../../i18n/domainMessage'
import { isIp } from '../../net/address'
import { cable, move, send, unplug } from '../../net/build'
import { Intent, StackLevel } from '../../net/packet'
import { type BoardInput, BoardOutMessage } from '../contract'
import type { PacketTypes } from '../types'
import type { PacketOp } from './doc'
import { Message } from './message'

// Подмодуль доски сетей (design D1 add-network-board). Model хранит только
// то, что сделал ученик: где проигрыватель, что открыто, что выделено. Всё
// остальное — устройства, зоны, трасса, конверт — считается из документа и
// сцены шага при показе. Где остановиться, считает вид (у него есть трасса)
// и передаёт в сообщении: так `frame` не пересчитывает трассы.

// MODEL

export const Tool = defineTaggedUnion({
  Pointer: {},
  Cable: { maybeFrom: Schema.Option(Schema.String) },
})
export type Tool = typeof Tool.Type

/** Что ученик несёт по доске. */
export const Grab = defineTaggedUnion({
  Envelope: {},
  Chip: { chip: Schema.String },
  Header: { level: StackLevel },
  Device: {
    id: Schema.String,
    x: Schema.Number,
    y: Schema.Number,
    hasMoved: Schema.Boolean,
  },
})
export type Grab = typeof Grab.Type

export const Model = Schema.Struct({
  /** Сколько миллисекунд трассы сцены уже проиграно. */
  playhead: Schema.Number,
  /** До какого момента идёт проигрыватель: пауза, хоп или конец. */
  stopAt: Schema.Number,
  hasStarted: Schema.Boolean,
  /** Длина трассы, которую запустили: другая трасса (ученик поменял сеть)
      начинается заново. */
  playedTotal: Schema.Number,
  isSlow: Schema.Boolean,
  isLegendOpen: Schema.Boolean,
  isEnvelopeOpen: Schema.Boolean,
  /** Ученик закрыл конверт, который открыла сцена (`openEnvelope`): на
      телефоне шторка иначе закрывает кнопки урока. */
  isEnvelopeDismissed: Schema.Boolean,
  maybeLayer: Schema.Option(Schema.Number),
  maybeCard: Schema.Option(Schema.String),
  isStickerOpen: Schema.Boolean,
  /** Облако раскрыто или свёрнуто нажатием; без нажатия решает сцена. */
  maybeCloudOpen: Schema.Option(Schema.Boolean),
  tool: Tool,
  maybeGrab: Schema.Option(Grab),
  /** Выделенные варианты квиза с несколькими ответами. */
  selection: Schema.Array(Schema.String),
  /** Чипы на местах (`Match`, `PlaceChips`): место → чип. */
  placements: Schema.Record(Schema.String, Schema.String),
  maybeChip: Schema.Option(Schema.String),
  /** Сборка конверта: заголовки по местам снаружи внутрь. */
  headers: Schema.Array(StackLevel),
  maybeHeader: Schema.Option(StackLevel),
  sendAddress: Schema.String,
  /** Почему «Отправить» в карточке не ушло: ввели не IP-адрес. */
  maybeSendRefusal: Schema.Option(DomainMessage),
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  playhead: 0,
  stopAt: 0,
  hasStarted: false,
  playedTotal: 0,
  isSlow: false,
  isLegendOpen: false,
  isEnvelopeOpen: false,
  isEnvelopeDismissed: false,
  maybeLayer: Option.none(),
  maybeCard: Option.none(),
  isStickerOpen: false,
  maybeCloudOpen: Option.none(),
  tool: Tool.Pointer(),
  maybeGrab: Option.none(),
  selection: [],
  placements: {},
  maybeChip: Option.none(),
  headers: [],
  maybeHeader: Option.none(),
  sendAddress: '',
  maybeSendRefusal: Option.none(),
}

// MESSAGE

export { Message } from './message'

export type OutMessage = BoardOutMessage<PacketOp>

// UPDATE

type Input = BoardInput<PacketTypes>

export type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage
>

/** Начать проигрывание с `startAt` до `stopAt`. */
const playFrom = (
  model: Model,
  startAt: number,
  stopAt: number,
  total: number,
): Model =>
  modifyFields(model, {
    playhead: () => startAt,
    stopAt: () => stopAt,
    hasStarted: () => true,
    playedTotal: () => total,
  })

const propose = (model: Model, ops: ReadonlyArray<PacketOp>): UpdateReturn => ({
  model,
  outMessage: BoardOutMessage.ProposedOps(ops),
})

const toggle = (
  values: ReadonlyArray<string>,
  value: string,
): ReadonlyArray<string> =>
  Array.contains(values, value)
    ? Array.filter(values, other => other !== value)
    : [...values, value]

const pick = (
  model: Model,
  input: Input,
  id: string,
  playTo: number,
  total: number,
): UpdateReturn =>
  input.mode === 'Pick'
    ? {
        model: modifyFields(playFrom(model, 0, playTo, total), {
          maybeGrab: () => Option.none(),
        }),
        outMessage: BoardOutMessage.PickedTarget(id),
      }
    : { model }

/** Чип на место: место занято — чип меняется; тот же чип с другого места
    переезжает. */
const placeChip = (model: Model, slot: string, chip: string): Model =>
  modifyFields(model, {
    placements: placements =>
      Record.set(
        Record.filter(placements, placed => placed !== chip),
        slot,
        chip,
      ),
    maybeChip: () => Option.none(),
    maybeGrab: () => Option.none(),
  })

const placeHeader = (model: Model, position: number, level: StackLevel) =>
  modifyFields(model, {
    headers: headers => {
      const without = Array.filter(headers, header => header !== level)
      return Array.isReadonlyArrayEmpty(without) && position === 0
        ? [level]
        : [
            ...Array.take(without, position),
            level,
            ...Array.drop(without, position),
          ]
    },
    maybeHeader: () => Option.none(),
    maybeGrab: () => Option.none(),
  })

export const update =
  (input: Input) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedRun: ({ startAt, stopAt, total }) => ({
        model: playFrom(model, startAt, stopAt, total),
      }),
      ClickedStep: ({ startAt, stopAt, total }) => ({
        model: playFrom(model, startAt, stopAt, total),
      }),
      ClickedBack: ({ at, total }) => ({
        model: playFrom(model, at, at, total),
      }),
      ClickedRestart: () => ({
        model: playFrom(model, 0, 0, model.playedTotal),
      }),
      ClickedSpeed: () => ({
        model: modifyFields(model, { isSlow: isSlow => !isSlow }),
      }),
      ClickedLegend: () => ({
        model: modifyFields(model, { isLegendOpen: isOpen => !isOpen }),
      }),
      ClickedEnvelope: () => ({
        model: modifyFields(model, {
          isEnvelopeOpen: isOpen => !isOpen,
          isEnvelopeDismissed: () => false,
        }),
      }),
      ClickedCloseEnvelope: () => ({
        model: modifyFields(model, {
          isEnvelopeOpen: () => false,
          isEnvelopeDismissed: () => true,
          maybeLayer: () => Option.none(),
        }),
      }),
      HoveredLayer: ({ position }) => ({
        model: modifyFields(model, { maybeLayer: () => Option.some(position) }),
      }),
      LeftLayer: () => ({
        model: modifyFields(model, { maybeLayer: () => Option.none() }),
      }),
      ClickedDevice: ({ id }) => ({
        model: modifyFields(model, {
          maybeCard: current =>
            Option.exists(current, open => open === id)
              ? Option.none()
              : Option.some(id),
          sendAddress: () => '',
          maybeSendRefusal: () => Option.none(),
        }),
      }),
      ClickedCloseCard: () => ({
        model: modifyFields(model, { maybeCard: () => Option.none() }),
      }),
      ClickedSticker: () => ({
        model: modifyFields(model, { isStickerOpen: isOpen => !isOpen }),
      }),
      ClickedCloseSticker: () => ({
        model: modifyFields(model, { isStickerOpen: () => false }),
      }),
      ClickedCloud: ({ isOpen }) => ({
        model: modifyFields(model, {
          maybeCloudOpen: () => Option.some(isOpen),
          playhead: () => 0,
          stopAt: () => 0,
          hasStarted: () => false,
        }),
      }),
      ClickedCandidate: ({ id, playTo, total }) =>
        Array.contains(input.pickable, id)
          ? pick(model, input, id, playTo, total)
          : { model },
      ToggledCandidate: ({ id }) =>
        input.mode === 'Pick' && Array.contains(input.pickable, id)
          ? {
              model: modifyFields(model, {
                selection: selection => toggle(selection, id),
              }),
            }
          : { model },
      ClickedDone: ({ playTo, total }) =>
        Array.match(model.selection, {
          onEmpty: () =>
            Record.isEmptyRecord(model.placements)
              ? { model }
              : pick(
                  model,
                  input,
                  Array.map(
                    Object.entries(model.placements),
                    ([slot, chip]) => `${slot}=${chip}`,
                  ).join('+'),
                  playTo,
                  total,
                ),
          onNonEmpty: selection =>
            pick(model, input, selection.join('+'), playTo, total),
        }),
      PressedEnvelope: () => ({
        model: modifyFields(model, {
          maybeGrab: () => Option.some(Grab.Envelope()),
        }),
      }),
      ReleasedOnCandidate: ({ id, playTo, total }) =>
        Option.exists(model.maybeGrab, grab => grab._tag === 'Envelope')
          ? pick(model, input, id, playTo, total)
          : { model },
      ReleasedPointer: () => ({
        model: modifyFields(model, {
          maybeGrab: grab =>
            Option.exists(grab, held => held._tag === 'Device')
              ? grab
              : Option.none(),
        }),
      }),
      ClickedChip: ({ chip }) => ({
        model: modifyFields(model, {
          maybeChip: current =>
            Option.exists(current, picked => picked === chip)
              ? Option.none()
              : Option.some(chip),
        }),
      }),
      DraggedChip: ({ chip }) => ({
        model: modifyFields(model, {
          maybeGrab: () => Option.some(Grab.Chip({ chip })),
        }),
      }),
      ClickedSlot: ({ slot }) =>
        Option.match(model.maybeChip, {
          onSome: chip => ({ model: placeChip(model, slot, chip) }),
          onNone: () => ({
            model: modifyFields(model, {
              placements: placements => Record.remove(placements, slot),
            }),
          }),
        }),
      DroppedOnSlot: ({ slot }) =>
        Option.match(model.maybeGrab, {
          onSome: grab =>
            grab._tag === 'Chip'
              ? { model: placeChip(model, slot, grab.chip) }
              : { model },
          onNone: () => ({ model }),
        }),
      ClickedCableTool: () => ({
        model: modifyFields(model, {
          tool: tool =>
            tool._tag === 'Cable'
              ? Tool.Pointer()
              : Tool.Cable({ maybeFrom: Option.none() }),
          maybeCard: () => Option.none(),
        }),
      }),
      ClickedCableEnd: ({ id }) =>
        model.tool._tag !== 'Cable' || input.mode !== 'Edit'
          ? { model }
          : Option.match(model.tool.maybeFrom, {
              onNone: () => ({
                model: modifyFields(model, {
                  tool: () => Tool.Cable({ maybeFrom: Option.some(id) }),
                }),
              }),
              onSome: from =>
                from === id
                  ? {
                      model: modifyFields(model, {
                        tool: () => Tool.Cable({ maybeFrom: Option.none() }),
                      }),
                    }
                  : propose(
                      modifyFields(model, {
                        tool: () => Tool.Cable({ maybeFrom: Option.none() }),
                      }),
                      [cable(from, id)],
                    ),
            }),
      ClickedUnplug: ({ a, b }) =>
        input.mode === 'Edit' ? propose(model, [unplug(a, b)]) : { model },
      PressedMoveKey: ({ id, x, y }) =>
        input.mode === 'Edit' ? propose(model, [move(id, x, y)]) : { model },
      GrabbedDevice: ({ id, x, y }) =>
        input.mode === 'Edit'
          ? {
              model: modifyFields(model, {
                maybeGrab: () =>
                  Option.some(Grab.Device({ id, x, y, hasMoved: false })),
              }),
            }
          : { model },
      MovedDevice: ({ x, y }) => ({
        model: modifyFields(model, {
          maybeGrab: grab =>
            Option.map(grab, held =>
              held._tag === 'Device'
                ? Grab.Device({ id: held.id, x, y, hasMoved: true })
                : held,
            ),
        }),
      }),
      DroppedDevice: () =>
        Option.match(model.maybeGrab, {
          onSome: grab =>
            grab._tag === 'Device' && grab.hasMoved && input.mode === 'Edit'
              ? propose(
                  modifyFields(model, { maybeGrab: () => Option.none() }),
                  [move(grab.id, Math.round(grab.x), Math.round(grab.y))],
                )
              : {
                  model: modifyFields(model, {
                    maybeGrab: () => Option.none(),
                  }),
                },
          onNone: () => ({ model }),
        }),
      UpdatedSendAddress: ({ value }) => ({
        model: modifyFields(model, {
          sendAddress: () => value,
          maybeSendRefusal: () => Option.none(),
        }),
      }),
      // Карточка отправляет только на IP-адрес: имя устройства («laptop»)
      // движок понял бы, но урок 2 учит находить адрес.
      SubmittedSend: ({ from, what }) =>
        input.mode !== 'Edit' || model.sendAddress.trim() === ''
          ? { model }
          : isIp(model.sendAddress.trim())
            ? propose(
                modifyFields(model, {
                  sendAddress: () => '',
                  maybeSendRefusal: () => Option.none(),
                }),
                [
                  send(
                    Intent.Send({ from, to: model.sendAddress.trim(), what }),
                  ),
                ],
              )
            : {
                model: modifyFields(model, {
                  maybeSendRefusal: () =>
                    Option.some(DomainMessage.SendNeedsIp()),
                }),
              },
      ClickedHeader: ({ level }) => ({
        model: modifyFields(model, {
          maybeHeader: current =>
            Option.exists(current, picked => picked === level)
              ? Option.none()
              : Option.some(level),
        }),
      }),
      DraggedHeader: ({ level }) => ({
        model: modifyFields(model, {
          maybeGrab: () => Option.some(Grab.Header({ level })),
        }),
      }),
      ClickedHeaderSlot: ({ position }) =>
        Option.match(model.maybeHeader, {
          onSome: level => ({ model: placeHeader(model, position, level) }),
          onNone: () => ({
            model: modifyFields(model, {
              headers: headers =>
                Array.filter(headers, (_header, index) => index !== position),
            }),
          }),
        }),
      DroppedOnHeaderSlot: ({ position }) =>
        Option.match(model.maybeGrab, {
          onSome: grab =>
            grab._tag === 'Header'
              ? { model: placeHeader(model, position, grab.level) }
              : { model },
          onNone: () => ({ model }),
        }),
      ClickedBuilderReset: () => ({
        model: modifyFields(model, {
          headers: () => [],
          maybeHeader: () => Option.none(),
        }),
      }),
      ClickedBuilderSend: ({ from, url }) =>
        input.mode === 'Edit' && Array.isReadonlyArrayNonEmpty(model.headers)
          ? propose(model, [
              send(Intent.Raw({ from, url, order: model.headers })),
            ])
          : { model },
    })

export const pressDelete =
  (_input: Input) =>
  (model: Model): UpdateReturn => ({ model })

/** Шаг сменился, ход отменён или показывается решение: проигрыватель в
    начало, всё открытое закрыть, жесты бросить. Скорость остаётся. */
export const interrupt = (model: Model): Model =>
  modifyFields(initialModel, { isSlow: () => model.isSlow })

/** Метка «играть всю трассу хода»: длину трассы знает только вид. */
export const AUTO_PLAY = -1

/** Сколько миллисекунд проигрывать ход сам; длинная трасса встанет на
    паузу, «Дальше» доиграет её. */
const AUTO_PLAY_MS = 30000

/** Ход ученика со своей сценой (открытая страница, `ping`): доска сама
    проигрывает его трассу с начала. */
export const replay = (model: Model): Model =>
  modifyFields(interrupt(model), {
    playhead: () => 0,
    stopAt: () => AUTO_PLAY_MS,
    hasStarted: () => true,
    playedTotal: () => AUTO_PLAY,
  })

const SLOW = 0.25

export const frame = (
  model: Model,
  deltaMs: number,
  _input: Readonly<{ isReducedMotion: boolean }>,
): Model =>
  model.playhead >= model.stopAt
    ? model
    : modifyFields(model, {
        playhead: playhead =>
          Math.min(
            model.stopAt,
            playhead + Math.min(deltaMs, 100) * (model.isSlow ? SLOW : 1),
          ),
      })
