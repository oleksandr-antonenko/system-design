import { Array, Option, Schema, pipe } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import type { UiStrings } from '../../i18n/ui'
import { joinWifi } from '../../net/build'
import { findHost } from '../../net/doc'
import { wifiOf } from '../../net/topology'
import { type SurfaceContext, SurfaceOutMessage } from '../contract'
import type { PacketTypes } from '../types'
import { type PacketOp, PacketOp as PacketOpUnion } from './doc'

// Поверхность «настройки Wi-Fi» устройства (`wifi:<устройство>`, план 3.2) в
// самом простом виде: сети на доске, пароль и «Подключиться». Она доказывает
// механизм поверхностей; полный экран телефона (уровень сигнала, сети кафе и
// соседа, «показать пароль») — изменение add-terminal-and-browser.

// MODEL

export const Model = Schema.Struct({
  maybeSsid: Schema.Option(Schema.String),
  password: Schema.String,
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  maybeSsid: Option.none(),
  password: '',
}

// MESSAGE

export const Message = defineMessageUnion({
  SelectedNetwork: { ssid: Schema.String },
  UpdatedPassword: { value: Schema.String },
  ClickedJoin: {},
})
export type Message = typeof Message.Type

export type OutMessage = SurfaceOutMessage<PacketOp>

// UPDATE

type Context = SurfaceContext<PacketTypes>

export type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage
>

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      SelectedNetwork: ({ ssid }) => ({
        model: modifyFields(model, { maybeSsid: () => Option.some(ssid) }),
      }),
      UpdatedPassword: ({ value }) => ({
        model: modifyFields(model, { password: () => value }),
      }),
      ClickedJoin: () =>
        Option.match(model.maybeSsid, {
          onNone: () => ({ model }),
          onSome: ssid =>
            context.mode === 'Edit'
              ? {
                  model: modifyFields(model, { password: () => '' }),
                  outMessage: SurfaceOutMessage.ProducedOps([
                    PacketOpUnion.Edit({
                      op: joinWifi(context.target, ssid, model.password),
                    }),
                  ]),
                }
              : { model },
        }),
    })

// VIEW

/** Сети точек доступа и роутеров на доске, без повторов. */
export const networksOf = (context: Context): ReadonlyArray<string> =>
  Array.dedupe(
    Array.getSomes(
      Array.map(context.doc.net.devices, device =>
        Option.map(wifiOf(device), wifi => wifi.ssid),
      ),
    ),
  )

const joinedNetwork = (context: Context): Option.Option<string> =>
  pipe(
    findHost(context.doc.net, context.target),
    Option.flatMap(host => host.maybeWifiProfile),
    Option.map(profile => profile.ssid),
  )

/** Призрак третьей подсказки: какую сеть выбрать по эталону, без пароля. */
const ghostNetwork = (context: Context): Option.Option<string> =>
  Option.flatMap(context.maybeGhost, solution =>
    Array.findFirst(solution, op =>
      op._tag === 'Edit' &&
      op.op._tag === 'JoinWifi' &&
      op.op.device === context.target
        ? Option.some(op.op.ssid)
        : Option.none(),
    ),
  )

export const view = <ParentMessage>(
  model: Model,
  context: Context,
  ui: UiStrings,
  toParentMessage: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const isEditable = context.mode === 'Edit'
  const maybeGhost = ghostNetwork(context)
  return h.div(
    [h.Class('wifi-surface')],
    [
      ...Option.match(joinedNetwork(context), {
        onNone: () => [],
        onSome: ssid => [
          h.p([h.Class('wifi-joined')], [ui.network.wifiJoined(ssid)]),
        ],
      }),
      h.p([h.Class('wifi-title')], [ui.network.wifiNetworks]),
      Array.match(networksOf(context), {
        onEmpty: () => h.p([h.Class('wifi-empty')], [ui.network.wifiNone]),
        onNonEmpty: networks =>
          h.ul(
            [h.Class('wifi-networks'), h.Role('list')],
            Array.map(networks, ssid =>
              h.keyed('li')(
                ssid,
                [],
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.Class(
                        [
                          'wifi-network',
                          Option.exists(
                            model.maybeSsid,
                            picked => picked === ssid,
                          )
                            ? 'picked'
                            : '',
                          Option.exists(maybeGhost, ghost => ghost === ssid)
                            ? 'ghost'
                            : '',
                        ].join(' '),
                      ),
                      h.AriaPressed(
                        Option.exists(
                          model.maybeSsid,
                          picked => picked === ssid,
                        )
                          ? 'true'
                          : 'false',
                      ),
                      ...(isEditable
                        ? [
                            h.OnClick(
                              toParentMessage(
                                Message.SelectedNetwork({ ssid }),
                              ),
                            ),
                          ]
                        : [h.Disabled(true)]),
                    ],
                    [ssid],
                  ),
                ],
              ),
            ),
          ),
      }),
      h.label(
        [h.Class('wifi-password')],
        [
          h.span([], [ui.network.wifiPassword]),
          h.input([
            h.Type('password'),
            h.Value(model.password),
            ...(isEditable
              ? [
                  h.OnInput(value =>
                    toParentMessage(Message.UpdatedPassword({ value })),
                  ),
                ]
              : [h.Disabled(true)]),
          ]),
        ],
      ),
      h.button(
        [
          h.Type('button'),
          h.Class('btn primary'),
          ...(isEditable && Option.isSome(model.maybeSsid)
            ? [h.OnClick(toParentMessage(Message.ClickedJoin()))]
            : [h.Disabled(true)]),
        ],
        [ui.network.wifiJoin],
      ),
    ],
  )
}
