import { Array, Option, Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import { kindOf } from '../../net/model'
import { sendIntent } from '../../net/world'
import { type BoardInput, BoardOutMessage, type BoardSlot } from '../contract'
import type { PacketTypes } from '../types'
import type { PacketOp } from './doc'

// Подмодуль доски сетей — заготовка (design D6). Настоящую доску с
// устройствами, связями, конвертом и транспортом делает add-network-board;
// здесь только то, что доказывает контракт: проигрывание трассы по кадрам,
// выбор устройства в квизе и кнопки плеера под доской.

// MODEL

export const Model = Schema.Struct({
  /** Сколько миллисекунд трассы сцены уже проиграно. */
  playhead: Schema.Number,
})
export type Model = typeof Model.Type

export const initialModel: Model = { playhead: 0 }

// MESSAGE

export const Message = defineMessageUnion({
  ClickedDevice: { id: Schema.String },
  ClickedRun: {},
})
export type Message = typeof Message.Type

export type OutMessage = BoardOutMessage<PacketOp>

// UPDATE

type Input = BoardInput<PacketTypes>

export type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage
>

export const update =
  (input: Input) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedDevice: ({ id }) =>
        input.mode === 'Pick'
          ? { model, outMessage: BoardOutMessage.PickedTarget(id) }
          : { model },
      ClickedRun: () => ({
        model: modifyFields(model, { playhead: () => 0 }),
      }),
    })

export const pressDelete =
  (_input: Input) =>
  (model: Model): UpdateReturn => ({ model })

export const interrupt = (model: Model): Model => model

/** Ход ученика со своей сценой: трасса проигрывается с начала. */
export const replay = (model: Model): Model =>
  modifyFields(model, { playhead: () => 0 })

export const frame = (
  model: Model,
  deltaMs: number,
  input: Readonly<{ isReducedMotion: boolean }>,
): Model =>
  modifyFields(model, {
    playhead: playhead =>
      input.isReducedMotion
        ? globalThis.Number.MAX_SAFE_INTEGER
        : Math.min(playhead + deltaMs, globalThis.Number.MAX_SAFE_INTEGER),
  })

// VIEW

type Slot<ParentMessage> = BoardSlot<PacketTypes, ParentMessage>

const deviceName = <ParentMessage>(
  slot: Slot<ParentMessage>,
  id: string,
): string =>
  Option.match(slot.context.label(id), {
    onNone: () => id,
    onSome: label => label.name,
  })

/** Трассы сцены шага: `play(intent)` считается от документа, состояние
    сети при этом не запоминается. */
const sceneHops = <ParentMessage>(
  slot: Slot<ParentMessage>,
): ReadonlyArray<string> =>
  Array.flatMap(slot.context.stage, item =>
    item._tag === 'Play'
      ? Array.map(
          sendIntent(slot.context.stageDoc, item.intent)[0].hops,
          hop => `${hop.from} → ${hop.to}`,
        )
      : [],
  )

export const view = <ParentMessage>(
  slot: Slot<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { context } = slot
  const candidates = Option.match(context.maybeQuiz, {
    onNone: () => [],
    onSome: quiz => quiz.candidates,
  })
  return h.div(
    [
      h.Class('packet-board board-surface'),
      h.AriaLabel(context.ui.network.boardLabel),
    ],
    [
      h.p([h.Class('packet-note')], [context.ui.network.placeholder]),
      h.ul(
        [h.Class('packet-devices')],
        Array.map(context.doc.doc.devices, device =>
          h.keyed('li')(
            device.id,
            [
              h.DataAttribute('device', device.id),
              h.Class(
                Option.exists(context.maybeHoveredRef, ref => ref === device.id)
                  ? 'selected'
                  : '',
              ),
            ],
            [
              context.mode === 'Pick' && Array.contains(candidates, device.id)
                ? h.button(
                    [
                      h.Type('button'),
                      h.Class('btn'),
                      h.OnClick(
                        slot.toParentMessage(
                          Message.ClickedDevice({ id: device.id }),
                        ),
                      ),
                    ],
                    [deviceName(slot, device.id)],
                  )
                : h.span([], [deviceName(slot, device.id)]),
              h.code([], [kindOf(device)]),
            ],
          ),
        ),
      ),
      h.pre(
        [h.Class('packet-hops')],
        [
          Array.take(
            sceneHops(slot),
            Math.floor(slot.model.playhead / 400) + 1,
          ).join('\n'),
        ],
      ),
    ],
  )
}

export const instruments = <ParentMessage>(
  slot: Slot<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { context } = slot
  return h.section(
    [h.AriaLabel(context.ui.lesson.instrumentsRegion), h.Class('hud')],
    [
      h.div(
        [h.Class('controls')],
        [
          ...(Array.contains(context.unlocked, 'transport.run')
            ? [
                h.button(
                  [
                    h.Type('button'),
                    h.Class('btn'),
                    h.OnClick(slot.toParentMessage(Message.ClickedRun())),
                  ],
                  [`▶ ${context.ui.network.run}`],
                ),
                h.span([h.Class('separator'), h.AriaHidden(true)]),
              ]
            : []),
          ...slot.controls(),
        ],
      ),
    ],
  )
}
