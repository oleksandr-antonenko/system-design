import { Array, Match, Option, Schema, pipe } from 'effect'
import { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'

import type { UiStrings } from '../../../i18n/ui'
import {
  type SurfaceContext,
  type SurfaceDefinition,
  SurfaceOutMessage,
} from '../../contract'
import {
  lockIcon,
  signalIcon,
  wifiIcon,
} from '../../packet/surfaces/screen/icons'
import { SurfaceMessage, SurfaceState } from '../../state'
import type { ScenarioTypes } from '../../types'
import {
  type Network,
  type Phone,
  ScenarioOp,
  isOnline,
  joinedNetwork,
  pendingPortal,
} from '../doc'
import { classes, ghostOps, nameOf } from './parts'

// Экран телефона `phone:<владелец>` (design D6 add-security-course): Wi-Fi,
// страница входа сети, VPN и «Почта» с письмом. Облик и части — у экрана
// телефона курса сетей (классы `device`, `screen-*`, значки). Сеть, VPN и
// отправка — в документе; здесь только открытый экран и лист поверх него.

type Context = SurfaceContext<ScenarioTypes>

// MODEL

export const Screen = Schema.Literals(['home', 'wifi', 'mail'])
export type Screen = typeof Screen.Type

export const Sheet = defineTaggedUnion({
  Closed: {},
  Locked: { ssid: Schema.String },
  Leaked: {},
  NeedsNetwork: {},
  NeedsVpn: {},
})
export type Sheet = typeof Sheet.Type

export const Model = Schema.Struct({ screen: Screen, sheet: Sheet })
export type Model = typeof Model.Type

export const initialModel: Model = { screen: 'home', sheet: Sheet.Closed() }

// MESSAGE

export const Message = defineMessageUnion({
  ClickedWifi: {},
  ClickedHome: {},
  ClickedNetwork: { ssid: Schema.String },
  ClickedAcceptPortal: {},
  ClickedPortalSignIn: {},
  ClickedLeavePortal: {},
  ClickedVpn: {},
  ClickedMailApp: {},
  ClickedTurnOnVpn: {},
  ClickedOpenWithoutVpn: {},
  ClickedSend: {},
  ClickedCloseSheet: {},
})
export type Message = typeof Message.Type

export type OutMessage = SurfaceOutMessage<ScenarioOp>

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

// UPDATE

const produce = (
  context: Context,
  model: Model,
  ops: ReadonlyArray<ScenarioOp>,
): UpdateReturn =>
  context.mode === 'Edit'
    ? { model, outMessage: SurfaceOutMessage.ProducedOps(ops) }
    : { model }

const withSheet = (model: Model, sheet: Sheet): Model =>
  modifyFields(model, { sheet: () => sheet })

const phoneOf = (context: Context): Option.Option<Phone> =>
  context.doc.maybePhone

const pickNetwork = (
  context: Context,
  model: Model,
  ssid: string,
): UpdateReturn =>
  Option.match(
    Option.flatMap(phoneOf(context), phone =>
      Array.findFirst(phone.networks, network => network.ssid === ssid),
    ),
    {
      onNone: () => ({ model }),
      onSome: network =>
        network.isLocked
          ? { model: withSheet(model, Sheet.Locked({ ssid })) }
          : Option.exists(phoneOf(context), phone =>
                Option.exists(phone.maybeJoined, joined => joined === ssid),
              )
            ? { model }
            : produce(context, model, [ScenarioOp.JoinNetwork({ ssid })]),
    },
  )

const openMail = (context: Context, model: Model): UpdateReturn =>
  Option.match(phoneOf(context), {
    onNone: () => ({ model }),
    onSome: phone =>
      !isOnline(phone)
        ? { model: withSheet(model, Sheet.NeedsNetwork()) }
        : !phone.isVpnOn
          ? { model: withSheet(model, Sheet.NeedsVpn()) }
          : { model: modifyFields(model, { screen: () => 'mail' }) },
  })

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedWifi: () => ({
        model: modifyFields(model, { screen: () => 'wifi' }),
      }),
      ClickedHome: () => ({
        model: modifyFields(model, {
          screen: () => 'home',
          sheet: () => Sheet.Closed(),
        }),
      }),
      ClickedNetwork: ({ ssid }) => pickNetwork(context, model, ssid),
      ClickedAcceptPortal: () =>
        produce(context, modifyFields(model, { screen: () => 'home' }), [
          ScenarioOp.PassPortal(),
        ]),
      ClickedPortalSignIn: () =>
        produce(context, withSheet(model, Sheet.Leaked()), [
          ScenarioOp.GiveAwayPassword(),
        ]),
      ClickedLeavePortal: () =>
        produce(context, model, [ScenarioOp.LeaveNetwork()]),
      ClickedVpn: () =>
        Option.match(phoneOf(context), {
          onNone: () => ({ model }),
          onSome: phone =>
            isOnline(phone)
              ? produce(context, model, [
                  ScenarioOp.SetVpn({ isOn: !phone.isVpnOn }),
                ])
              : { model: withSheet(model, Sheet.NeedsNetwork()) },
        }),
      ClickedMailApp: () => openMail(context, model),
      ClickedTurnOnVpn: () =>
        produce(
          context,
          modifyFields(model, {
            screen: () => 'mail',
            sheet: () => Sheet.Closed(),
          }),
          [ScenarioOp.SetVpn({ isOn: true })],
        ),
      ClickedOpenWithoutVpn: () =>
        produce(
          context,
          modifyFields(model, {
            screen: () => 'mail',
            sheet: () => Sheet.Closed(),
          }),
          [ScenarioOp.OpenMailWithoutVpn()],
        ),
      ClickedSend: () => produce(context, model, [ScenarioOp.SendMail()]),
      ClickedCloseSheet: () => ({ model: withSheet(model, Sheet.Closed()) }),
    })

// GHOST

/** Что обвести для первого ещё не сделанного хода эталона (без значений). */
const ghostKey = (model: Model, op: ScenarioOp): Option.Option<string> =>
  Match.value(op).pipe(
    Match.tag('JoinNetwork', ({ ssid }) =>
      Option.some(model.screen === 'wifi' ? `network:${ssid}` : 'wifi-row'),
    ),
    Match.tag('PassPortal', () => Option.some('accept')),
    Match.tag('LeaveNetwork', () => Option.some('leave')),
    Match.tag('SetVpn', () =>
      Option.some(model.screen === 'home' ? 'vpn' : 'home'),
    ),
    Match.tag('SendMail', () =>
      Option.some(model.screen === 'mail' ? 'send' : 'mail-app'),
    ),
    Match.orElse(() => Option.none()),
  )

const ghostOf = (context: Context, model: Model): Option.Option<string> =>
  pipe(
    ghostOps(context.maybeGhost, context.journal),
    Array.findFirst(op => ghostKey(model, op)),
  )

// VIEW

type Parts<ParentMessage> = Readonly<{
  model: Model
  phone: Phone
  context: Context
  ui: UiStrings
  maybeGhost: Option.Option<string>
  send: (message: Message) => ParentMessage
  h: HtmlBuilder<ParentMessage>
}>

const isGhost = <ParentMessage>(
  parts: Parts<ParentMessage>,
  key: string,
): boolean => Option.exists(parts.maybeGhost, ghost => ghost === key)

const labelName = <ParentMessage>(
  parts: Parts<ParentMessage>,
  id: string,
): string => nameOf(parts.context.label, id)

const labelNote = <ParentMessage>(
  parts: Parts<ParentMessage>,
  id: string,
): string =>
  Option.match(parts.context.label(id), {
    onNone: () => '',
    onSome: found => found.note ?? '',
  })

const isOpen = <ParentMessage>(
  parts: Parts<ParentMessage>,
  feature: string,
): boolean => Array.contains(parts.context.unlocked, feature)

const header = <ParentMessage>(
  parts: Parts<ParentMessage>,
  title: string,
  hasBack: boolean,
): Html => {
  const { h, ui, send } = parts
  return h.div(
    [h.Class('screen-head')],
    [
      ...(hasBack
        ? [
            h.button(
              [
                h.Type('button'),
                h.Class(
                  classes('screen-back', isGhost(parts, 'home') && 'ghost'),
                ),
                h.OnClick(send(Message.ClickedHome())),
              ],
              [`‹ ${ui.scenario.phone.title}`],
            ),
          ]
        : []),
      h.h3([], [title]),
    ],
  )
}

const status = <ParentMessage>(
  parts: Parts<ParentMessage>,
  text: string,
  tone: 'on' | 'bad' | '',
): Html =>
  parts.h.span(
    [parts.h.Class(classes('screen-network-status', tone !== '' && tone))],
    [text],
  )

const wifiRow = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, phone, send } = parts
  const joined = Option.getOrElse(phone.maybeJoined, () => '')
  return h.li(
    [],
    [
      h.button(
        [
          h.Type('button'),
          h.Class(
            classes(
              'screen-network scenario-row',
              isGhost(parts, 'wifi-row') && 'ghost',
            ),
          ),
          h.OnClick(send(Message.ClickedWifi())),
        ],
        [
          h.span(
            [h.Class('screen-network-name')],
            [
              ui.device.wifiTitle,
              Option.isSome(phone.maybeJoined)
                ? status(parts, joined, isOnline(phone) ? 'on' : 'bad')
                : status(parts, ui.device.notConnected, ''),
            ],
          ),
          h.span([h.Class('scenario-chevron'), h.AriaHidden(true)], ['›']),
        ],
      ),
    ],
  )
}

const vpnRow = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, phone, send, context } = parts
  const online = isOnline(phone)
  const text = phone.isVpnOn
    ? ui.scenario.phone.vpnOn
    : online
      ? ui.scenario.phone.vpnOffStatus
      : ui.scenario.phone.vpnNeedsInternet
  return h.li(
    [],
    [
      h.div(
        [h.Class('screen-network scenario-row')],
        [
          h.span(
            [h.Class('screen-network-name')],
            [
              ui.scenario.phone.vpnRow(labelName(parts, phone.vpn)),
              status(parts, text, phone.isVpnOn ? 'on' : ''),
            ],
          ),
          h.button([
            h.Type('button'),
            h.Role('switch'),
            h.AriaChecked(phone.isVpnOn),
            h.AriaLabel('VPN'),
            h.Class(
              classes(
                'scenario-switch',
                phone.isVpnOn && 'on',
                isGhost(parts, 'vpn') && 'ghost',
              ),
            ),
            ...(context.mode === 'Edit'
              ? [h.OnClick(send(Message.ClickedVpn()))]
              : [h.Disabled(true)]),
          ]),
        ],
      ),
    ],
  )
}

const homeScreen = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, phone, send } = parts
  return [
    header(parts, ui.scenario.phone.title, false),
    h.div(
      [h.Class('screen-body')],
      [
        h.p([h.Class('screen-group')], [ui.scenario.phone.settings]),
        h.ul(
          [h.Class('screen-networks')],
          [
            wifiRow(parts),
            ...(isOpen(parts, 'phone.vpn') ? [vpnRow(parts)] : []),
          ],
        ),
        ...(isOpen(parts, 'phone.mail')
          ? [
              h.p([h.Class('screen-group')], [ui.scenario.phone.apps]),
              h.div(
                [h.Class('scenario-apps')],
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.Class(
                        classes(
                          'scenario-app',
                          isGhost(parts, 'mail-app') && 'ghost',
                        ),
                      ),
                      h.OnClick(send(Message.ClickedMailApp())),
                    ],
                    [
                      h.span(
                        [h.Class('scenario-app-icon'), h.AriaHidden(true)],
                        ['✉'],
                      ),
                      ui.scenario.phone.mailApp,
                    ],
                  ),
                ],
              ),
            ]
          : []),
        h.p(
          [h.Class('screen-note')],
          [
            phone.isSent
              ? ui.scenario.phone.sentNote
              : phone.isVpnOn
                ? ui.scenario.phone.homeNoteVpn
                : ui.scenario.phone.homeNote,
          ],
        ),
      ],
    ),
  ]
}

const networkRow = <ParentMessage>(
  parts: Parts<ParentMessage>,
  network: Network,
): Html => {
  const { h, ui, phone, send, context } = parts
  const isJoined = Option.exists(
    phone.maybeJoined,
    joined => joined === network.ssid,
  )
  const text = isJoined
    ? ui.device.connected
    : network.isLocked
      ? ui.device.secured
      : ui.device.openNetwork
  return h.keyed('li')(
    network.ssid,
    [],
    [
      h.button(
        [
          h.Type('button'),
          h.Class(
            classes(
              'screen-network',
              isGhost(parts, `network:${network.ssid}`) && 'ghost',
            ),
          ),
          h.AriaLabel(`${network.ssid}, ${text}`),
          ...(context.mode === 'Edit'
            ? [h.OnClick(send(Message.ClickedNetwork({ ssid: network.ssid })))]
            : [h.Disabled(true)]),
        ],
        [
          h.span(
            [h.Class('screen-network-name')],
            [network.ssid, status(parts, text, isJoined ? 'on' : '')],
          ),
          network.isLocked ? lockIcon(h) : h.span([]),
          h.span(
            [h.Title(ui.device.signal(network.signal))],
            [signalIcon(network.signal, h)],
          ),
        ],
      ),
    ],
  )
}

const wifiScreen = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, phone } = parts
  return [
    header(parts, ui.device.wifiTitle, true),
    h.div(
      [h.Class('screen-body')],
      [
        h.p([h.Class('screen-group')], [ui.device.nearby]),
        h.ul(
          [h.Class('screen-networks')],
          Array.map(phone.networks, network => networkRow(parts, network)),
        ),
        h.p([h.Class('screen-note')], [ui.scenario.phone.wifiNote]),
      ],
    ),
  ]
}

const mailScreen = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, phone, send, context } = parts
  const canSend =
    context.mode === 'Edit' && isOnline(phone) && phone.isVpnOn && !phone.isSent
  const banner = phone.isSent
    ? h.p(
        [h.Class('scenario-banner ok'), h.Role('status')],
        [ui.scenario.phone.mailSent],
      )
    : isOnline(phone) && phone.isVpnOn
      ? h.p([h.Class('scenario-banner ok')], [ui.scenario.phone.mailThroughVpn])
      : h.p(
          [h.Class('scenario-banner bad'), h.Role('alert')],
          [ui.scenario.phone.mailWithoutVpn],
        )
  return [
    header(parts, ui.scenario.phone.mailTitle, true),
    h.div(
      [h.Class('screen-body')],
      [
        banner,
        h.div(
          [h.Class('scenario-draft')],
          [
            h.span(
              [h.Class('scenario-draft-to')],
              [ui.scenario.phone.to(phone.to)],
            ),
            h.strong([], [labelName(parts, phone.draft)]),
            h.span([], [labelNote(parts, phone.draft)]),
            h.span(
              [h.Class('scenario-attachment')],
              [`📎 ${labelName(parts, `${phone.draft}:file`)}`],
            ),
            h.div(
              [h.Class('screen-actions')],
              [
                h.button(
                  [
                    h.Type('button'),
                    h.Class(
                      classes(
                        'screen-button primary',
                        isGhost(parts, 'send') && 'ghost',
                      ),
                    ),
                    ...(canSend
                      ? [h.OnClick(send(Message.ClickedSend()))]
                      : [h.Disabled(true)]),
                  ],
                  [
                    phone.isSent
                      ? ui.scenario.phone.sentButton
                      : ui.scenario.phone.send,
                  ],
                ),
              ],
            ),
          ],
        ),
      ],
    ),
  ]
}

// SHEETS

const sheet = <ParentMessage>(
  parts: Parts<ParentMessage>,
  title: string,
  body: ReadonlyArray<Html>,
  actions: ReadonlyArray<Html>,
  isAlert = false,
): ReadonlyArray<Html> => {
  const { h, send } = parts
  return [
    h.div([
      h.Class('screen-scrim'),
      h.AriaHidden(true),
      h.OnClick(send(Message.ClickedCloseSheet())),
    ]),
    h.div(
      [
        h.Class('screen-sheet'),
        h.Role(isAlert ? 'alertdialog' : 'dialog'),
        h.AriaLabel(title),
      ],
      [
        h.div([h.Class('screen-grab'), h.AriaHidden(true)]),
        h.h4([], [title]),
        ...body,
        h.div([h.Class('screen-actions')], actions),
      ],
    ),
  ]
}

const understoodButton = <ParentMessage>(parts: Parts<ParentMessage>): Html =>
  parts.h.button(
    [
      parts.h.Type('button'),
      parts.h.Class('screen-button primary'),
      parts.h.OnClick(parts.send(Message.ClickedCloseSheet())),
    ],
    [parts.ui.scenario.phone.understood],
  )

const portalPage = <ParentMessage>(
  parts: Parts<ParentMessage>,
  network: Network,
): ReadonlyArray<Html> => {
  const { h, ui, phone, send, context } = parts
  const isEditable = context.mode === 'Edit'
  const button = (
    label: string,
    message: Message,
    style: string,
    ghost: string,
  ) =>
    h.button(
      [
        h.Type('button'),
        h.Class(
          classes('screen-button', style, isGhost(parts, ghost) && 'ghost'),
        ),
        ...(isEditable ? [h.OnClick(send(message))] : [h.Disabled(true)]),
      ],
      [label],
    )
  const brand = labelName(parts, `net:${network.ssid}`)
  return [
    h.div(
      [
        h.Class(
          classes(
            'screen-sheet scenario-portal',
            network.portal === 'login' && 'is-twin',
          ),
        ),
        h.Role('dialog'),
        h.AriaLabel(brand),
      ],
      [
        h.div(
          [h.Class('scenario-portal-brand')],
          [
            h.span(
              [h.Class('scenario-portal-logo'), h.AriaHidden(true)],
              ['✈'],
            ),
            brand,
          ],
        ),
        h.span([h.Class('scenario-portal-url')], [network.portalUrl]),
        h.p([], [labelNote(parts, `net:${network.ssid}`)]),
        ...(network.portal === 'consent'
          ? [
              h.p(
                [h.Class('screen-note')],
                [ui.scenario.phone.portalConsentNote],
              ),
              h.div(
                [h.Class('screen-actions')],
                [
                  button(
                    ui.scenario.phone.accept,
                    Message.ClickedAcceptPortal(),
                    'primary',
                    'accept',
                  ),
                ],
              ),
            ]
          : [
              h.div(
                [h.Class('screen-field')],
                [
                  ui.scenario.phone.portalEmail,
                  h.span([h.Class('scenario-fake-input')], [phone.account]),
                ],
              ),
              h.div(
                [h.Class('screen-field')],
                [
                  ui.scenario.phone.portalPassword,
                  h.span([h.Class('scenario-fake-input')], ['••••••••••']),
                ],
              ),
              h.div(
                [h.Class('screen-actions')],
                [
                  button(
                    ui.scenario.phone.leave,
                    Message.ClickedLeavePortal(),
                    '',
                    'leave',
                  ),
                  button(
                    ui.scenario.phone.signIn,
                    Message.ClickedPortalSignIn(),
                    'primary',
                    'portal-sign-in',
                  ),
                ],
              ),
            ]),
      ],
    ),
  ]
}

const sheetView = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, model, phone, send } = parts
  return Option.match(pendingPortal(phone), {
    onSome: network => portalPage(parts, network),
    onNone: () =>
      Sheet.match(model.sheet, {
        Closed: () => [],
        Locked: ({ ssid }) =>
          sheet(
            parts,
            ui.scenario.phone.lockedTitle(ssid),
            [
              h.p([], [labelNote(parts, `net:${ssid}`)]),
              h.p([], [ui.scenario.phone.lockedHint]),
            ],
            [understoodButton(parts)],
          ),
        Leaked: () =>
          sheet(
            parts,
            ui.scenario.phone.leakedTitle,
            [
              h.p([h.Class('screen-problem')], [ui.scenario.phone.leakedBody]),
              h.p([], [ui.scenario.phone.leakedNext]),
            ],
            [understoodButton(parts)],
            true,
          ),
        NeedsNetwork: () =>
          sheet(
            parts,
            ui.scenario.phone.needsNetworkTitle,
            [h.p([], [ui.scenario.phone.needsNetworkBody])],
            [understoodButton(parts)],
          ),
        NeedsVpn: () =>
          sheet(
            parts,
            ui.scenario.phone.needsVpnTitle,
            [h.p([], [ui.scenario.phone.needsVpnBody])],
            [
              h.button(
                [
                  h.Type('button'),
                  h.Class('screen-button scenario-danger'),
                  h.OnClick(send(Message.ClickedOpenWithoutVpn())),
                ],
                [ui.scenario.phone.openWithoutVpn],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.Class('screen-button primary'),
                  h.OnClick(send(Message.ClickedTurnOnVpn())),
                ],
                [ui.scenario.phone.turnOnVpn],
              ),
            ],
          ),
      }),
  })
}

const statusBar = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, phone } = parts
  return h.div(
    [h.Class('device-status')],
    [
      h.span([], ['14:20']),
      h.span(
        [h.Class('scenario-status-right')],
        [
          ...(phone.isVpnOn
            ? [
                h.span(
                  [h.Class('scenario-vpn-badge')],
                  [ui.scenario.phone.vpnBadge],
                ),
              ]
            : []),
          isOnline(phone)
            ? h.span(
                [
                  h.Class('device-online'),
                  h.Role('img'),
                  h.AriaLabel(
                    ui.device.wifiJoined(
                      Option.getOrElse(
                        Option.map(
                          joinedNetwork(phone),
                          network => network.ssid,
                        ),
                        () => '',
                      ),
                    ),
                  ),
                ],
                [wifiIcon(h)],
              )
            : h.span([h.Class('device-offline')], [ui.device.noNetwork]),
        ],
      ),
    ],
  )
}

export const view = <ParentMessage>(
  model: Model,
  context: Context,
  ui: UiStrings,
  send: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  Option.match(context.doc.maybePhone, {
    onNone: () => h.empty,
    onSome: phone => {
      const parts: Parts<ParentMessage> = {
        model,
        phone,
        context,
        ui,
        maybeGhost: ghostOf(context, model),
        send,
        h,
      }
      const screen =
        model.screen === 'wifi'
          ? wifiScreen(parts)
          : model.screen === 'mail'
            ? mailScreen(parts)
            : homeScreen(parts)
      return h.section(
        [
          h.Class('device is-phone scenario-phone'),
          h.AriaLabel(
            ui.device.screenLabel(nameOf(context.label, phone.owner)),
          ),
        ],
        [
          h.div([h.Class('device-notch'), h.AriaHidden(true)]),
          statusBar(parts),
          h.div(
            [h.Class(`device-screen scenario-screen-${model.screen}`)],
            [...screen, ...sheetView(parts)],
          ),
        ],
      )
    },
  })

// SURFACE

const read = (state: SurfaceState): Option.Option<Model> =>
  state._tag === 'ScenarioPhoneSurface'
    ? Option.some(state.model)
    : Option.none()

const toSurfaceMessage = (message: Message): SurfaceMessage =>
  SurfaceMessage.GotScenarioPhoneMessage({ message })

export const phoneSurface: SurfaceDefinition<ScenarioTypes> = {
  type: 'phone',
  feature: 'phone',
  init: () => SurfaceState.ScenarioPhoneSurface({ model: initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotScenarioPhoneMessage'
      ? Update.foldChild({
          update: update(context),
          read,
          write: (_state: SurfaceState, model: Model): SurfaceState =>
            SurfaceState.ScenarioPhoneSurface({ model }),
          toParentMessage: toSurfaceMessage,
          toParentOutMessage: (outMessage: OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: (context, ui) =>
    ui.device.screenTab(nameOf(context.label, context.target)),
  view: (slot, h) =>
    Option.match(read(slot.state), {
      onNone: () => h.empty,
      onSome: model =>
        view(
          model,
          slot.context,
          slot.ui,
          message => slot.toParentMessage(toSurfaceMessage(message)),
          h,
        ),
    }),
}
