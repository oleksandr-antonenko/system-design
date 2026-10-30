import { Array, Option, pipe } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { isSurfaceOpen } from '../../../../courses/unlocks'
import type { UiStrings } from '../../../../i18n/ui'
import { maskOf } from '../../../../net/address'
import type { NetOp } from '../../../../net/doc'
import type { NetMessage } from '../../../../net/message'
import type { SurfaceContext } from '../../../contract'
import type { PacketTypes } from '../../../types'
import { ghostOps, nameOf } from '../history'
import { browserView } from './browser'
import { wifiIcon } from './icons'
import { type AddressField, type App, Message } from './message'
import { addressSettings, currentPage, isPhone, wifiStatus } from './network'
import { type Parts, classes } from './parts'
import { type AddressDraft, type Model, canonicalUrl } from './screen'
import { settingsView } from './settings'

type Context = SurfaceContext<PacketTypes>

/** Приложения экрана: те, чьи поверхности объявила задача и открыл курс.
    Без задачи (вне шага задачи) — приложение самой поверхности. */
export const appsOf = (context: Context, own: App): ReadonlyArray<App> => {
  const declared = Array.filter(
    [
      ['settings', 'wifi'],
      ['browser', 'browser'],
    ] satisfies ReadonlyArray<readonly [App, string]>,
    ([, type]) =>
      Array.contains(context.surfaces, `${type}:${context.target}`) &&
      isSurfaceOpen(context.unlocked, type),
  )
  return Array.match(declared, {
    onEmpty: () => [own],
    onNonEmpty: apps => Array.map(apps, ([app]) => app),
  })
}

export const tabLabel = (context: Context, ui: UiStrings): string =>
  ui.device.screenTab(nameOf(context.label, context.target))

// GHOST

const addressFields: ReadonlyArray<AddressField> = [
  'ip',
  'mask',
  'gateway',
  'dns',
]

/** Поля адреса, которые эталон задаёт не так, как сейчас. */
const changedFields = (
  current: Option.Option<AddressDraft>,
  wanted: Readonly<Record<AddressField, string>>,
): ReadonlyArray<string> =>
  Array.getSomes(
    Array.map(addressFields, field =>
      Option.exists(current, settings => settings[field] === wanted[field])
        ? Option.none()
        : Option.some(`address-field:${field}`),
    ),
  )

/** Что обвести для хода эталона на этом устройстве (без значений). */
const ghostOf = (context: Context, op: NetOp): ReadonlyArray<string> => {
  const target = context.target
  if (op._tag === 'JoinWifi' && op.device === target) {
    return ['app:settings', `network:${op.ssid}`]
  }
  if (op._tag === 'ForgetWifi' && op.device === target) {
    return ['app:settings', 'info', 'forget']
  }
  if (op._tag === 'SetDns' && op.device === target) {
    return Option.match(op.maybeServers, {
      onNone: () => ['app:settings', 'info', 'dns', 'dns-mode:auto'],
      onSome: () => [
        'app:settings',
        'info',
        'dns',
        'dns-mode:manual',
        'dns-servers',
        'dns-save',
      ],
    })
  }
  if (op._tag === 'SetAddressing' && op.device === target) {
    const wanted = op.addressing
    return wanted._tag === 'Static'
      ? [
          'app:settings',
          'info',
          'address',
          'address-mode:static',
          ...changedFields(addressSettings(context), {
            ip: wanted.ip,
            mask: maskOf(wanted.prefix),
            gateway: Option.getOrElse(wanted.maybeGateway, () => ''),
            dns: Option.getOrElse(wanted.maybeDns, () => ''),
          }),
          'address-save',
        ]
      : ['app:settings', 'info', 'address', 'address-mode:dhcp', 'address-save']
  }
  if (
    op._tag === 'Send' &&
    (op.intent._tag === 'Browse' || op.intent._tag === 'Submit') &&
    op.intent.from === target
  ) {
    const url = canonicalUrl(op.intent.url)
    return op.intent._tag === 'Submit'
      ? ['app:browser', 'form']
      : Option.exists(
            currentPage(context),
            page => canonicalUrl(page.url) === url,
          )
        ? ['app:browser', 'reload']
        : ['app:browser', 'url']
  }
  return []
}

/** Призрак обводит первый ещё не сделанный ход эталона на устройстве. */
export const ghostKeys = (context: Context): ReadonlyArray<string> =>
  pipe(
    ghostOps(context.maybeGhost, context.journal),
    Array.map(op => ghostOf(context, op)),
    Array.findFirst(Array.isReadonlyArrayNonEmpty),
    Option.getOrElse((): ReadonlyArray<string> => []),
  )

// VIEW

const appLabel = (ui: UiStrings, app: App, phone: boolean): string =>
  app === 'browser'
    ? ui.device.appBrowser
    : phone
      ? ui.device.appSettings
      : ui.device.appNetwork

const switcher = <ParentMessage>(
  parts: Parts<ParentMessage>,
  apps: ReadonlyArray<App>,
  shown: App,
  phone: boolean,
): ReadonlyArray<Html> => {
  const { h, ui, send } = parts
  return apps.length < 2
    ? []
    : [
        h.div(
          [
            h.Class(phone ? 'device-dock' : 'device-apps'),
            h.Role('tablist'),
            h.AriaLabel(ui.device.apps),
          ],
          Array.map(apps, app =>
            h.keyed('button')(
              app,
              [
                h.Type('button'),
                h.Role('tab'),
                h.AriaSelected(app === shown),
                h.Class(
                  classes(
                    'device-app',
                    app === shown && 'active',
                    app !== shown &&
                      Array.contains(parts.ghost, `app:${app}`) &&
                      'ghost',
                  ),
                ),
                h.OnClick(send(Message.ClickedApp({ app }))),
              ],
              [appLabel(ui, app, phone)],
            ),
          ),
        ),
      ]
}

const statusBar = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, context } = parts
  const maybeOnline = pipe(
    wifiStatus(context),
    Option.filter(status => Option.isNone(status.maybeProblem)),
  )
  return h.div(
    [h.Class('device-status')],
    [
      h.span([], ['9:41']),
      Option.match(maybeOnline, {
        onNone: () =>
          h.span([h.Class('device-offline')], [ui.device.noNetwork]),
        onSome: status =>
          h.span(
            [
              h.Class('device-online'),
              h.Role('img'),
              h.AriaLabel(ui.device.wifiJoined(status.network.ssid)),
            ],
            [wifiIcon(h)],
          ),
      }),
    ],
  )
}

export const view = <ParentMessage>(
  model: Model,
  context: Context,
  own: App,
  render: Readonly<{
    ui: UiStrings
    renderMessage: (message: NetMessage) => string
  }>,
  toParentMessage: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const apps = appsOf(context, own)
  const shown = Array.contains(apps, model.app)
    ? model.app
    : Option.getOrElse(Array.head(apps), () => own)
  const phone = isPhone(context)
  const parts: Parts<ParentMessage> = {
    model,
    context,
    ui: render.ui,
    renderMessage: render.renderMessage,
    send: toParentMessage,
    ghost: ghostKeys(context),
    isEditable: context.mode === 'Edit',
    h,
  }
  const name = nameOf(context.label, context.target)
  const screen = h.div(
    [h.Class(`device-screen app-${shown}`)],
    shown === 'browser' ? browserView(parts) : settingsView(parts),
  )
  return h.section(
    [
      h.Class(phone ? 'device is-phone' : 'device is-desktop'),
      h.AriaLabel(render.ui.device.screenLabel(name)),
    ],
    phone
      ? [
          h.div([h.Class('device-notch'), h.AriaHidden(true)]),
          statusBar(parts),
          screen,
          ...switcher(parts, apps, shown, phone),
        ]
      : [
          h.div(
            [h.Class('device-titlebar')],
            [
              h.span([h.Class('device-dots'), h.AriaHidden(true)]),
              h.span([h.Class('device-name')], [name]),
              ...switcher(parts, apps, shown, phone),
            ],
          ),
          screen,
        ],
  )
}
