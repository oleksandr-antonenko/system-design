import { Array, Option } from 'effect'
import type { Html } from 'foldkit/html'

import { maskOf } from '../../../../net/address'
import type { NetMessage } from '../../../../net/message'
import {
  type Iface,
  type NearbyNetwork,
  nearbyNetworks,
} from '../../../../net/topology'
import { isOpen } from '../unlocks'
import { eyeIcon, infoIcon, lockIcon, signalIcon } from './icons'
import { type AddressField, Message, type Page } from './message'
import {
  addressSettings,
  dnsSettings,
  ifaceOf,
  isWired,
  wifiStatus,
} from './network'
import { type Parts, classes, isGhost } from './parts'
import type { AddressDraft, DnsDraft } from './screen'

// Приложение «Настройки» экрана устройства: Wi-Fi (сети рядом, пароль,
// объяснение чужой сети), сведения о сети (адрес, роутер, DNS), DNS и адрес
// вручную. Что видно — открывают уроки (`wifi.*`).

type Back = Readonly<{ page: Page; label: string }>

const header = <ParentMessage>(
  parts: Parts<ParentMessage>,
  title: string,
  maybeBack: Option.Option<Back>,
): Html => {
  const { h, send } = parts
  return h.div(
    [h.Class('screen-head')],
    [
      ...Option.match(maybeBack, {
        onNone: () => [],
        onSome: back => [
          h.button(
            [
              h.Type('button'),
              h.Class('screen-back'),
              h.OnClick(send(Message.ClickedPage({ page: back.page }))),
            ],
            [`‹ ${back.label}`],
          ),
        ],
      }),
      h.h3([], [title]),
    ],
  )
}

const group = <ParentMessage>(
  parts: Parts<ParentMessage>,
  title: string,
): Html => parts.h.p([parts.h.Class('screen-group')], [title])

/** Название текущей сети: Wi-Fi или кабель. */
const connectionName = <ParentMessage>(parts: Parts<ParentMessage>): string =>
  Option.match(wifiStatus(parts.context), {
    onNone: () => parts.ui.device.ethernet,
    onSome: status => status.network.ssid,
  })

const isInfoOpen = <ParentMessage>(parts: Parts<ParentMessage>): boolean =>
  isOpen(parts.context.unlocked, 'wifi.networkInfo') ||
  isOpen(parts.context.unlocked, 'wifi.addressing')

// WI-FI

const networkRow = <ParentMessage>(
  parts: Parts<ParentMessage>,
  network: NearbyNetwork,
): Html => {
  const { h, ui, send, isEditable } = parts
  const status =
    network.security === 'open' ? ui.device.openNetwork : ui.device.secured
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
          h.AriaLabel(`${network.ssid}, ${status}`),
          ...(isEditable
            ? [h.OnClick(send(Message.ClickedNetwork({ ssid: network.ssid })))]
            : [h.Disabled(true)]),
        ],
        [
          h.span(
            [h.Class('screen-network-name')],
            [
              network.ssid,
              h.span([h.Class('screen-network-status')], [status]),
            ],
          ),
          network.security === 'open' ? h.span([]) : lockIcon(h),
          h.span(
            [h.Title(ui.device.signal(network.signal))],
            [signalIcon(network.signal, h)],
          ),
        ],
      ),
    ],
  )
}

const infoButton = <ParentMessage>(
  parts: Parts<ParentMessage>,
  name: string,
): ReadonlyArray<Html> => {
  const { h, ui, send } = parts
  return isInfoOpen(parts)
    ? [
        h.button(
          [
            h.Type('button'),
            h.Class(classes('screen-info', isGhost(parts, 'info') && 'ghost')),
            h.AriaLabel(ui.device.networkInfo(name)),
            h.OnClick(send(Message.ClickedPage({ page: 'info' }))),
          ],
          [infoIcon(h)],
        ),
      ]
    : []
}

const mineRow = <ParentMessage>(
  parts: Parts<ParentMessage>,
  name: string,
  maybeProblem: Option.Option<NetMessage>,
  icons: ReadonlyArray<Html>,
): ReadonlyArray<Html> => {
  const { h, ui, renderMessage } = parts
  const isConnected = Option.isNone(maybeProblem)
  return [
    group(parts, ui.device.myNetwork),
    h.div(
      [h.Class(classes('screen-mine', !isConnected && 'failing'))],
      [
        h.span(
          [h.Class('screen-check'), h.AriaHidden(true)],
          [isConnected ? '✓' : '!'],
        ),
        h.span(
          [h.Class('screen-network-name')],
          [
            name,
            h.span(
              [
                h.Class(
                  classes('screen-network-status', isConnected ? 'on' : 'bad'),
                ),
              ],
              [isConnected ? ui.device.connected : ui.device.notConnected],
            ),
          ],
        ),
        ...icons,
        ...infoButton(parts, name),
      ],
    ),
    ...Option.match(maybeProblem, {
      onNone: () => [],
      onSome: problem => [
        h.p([h.Class('screen-problem')], [renderMessage(problem)]),
      ],
    }),
  ]
}

/** «Моя сеть»: к какой сети подключено устройство или что не так. */
const myNetwork = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, context } = parts
  return Option.match(wifiStatus(context), {
    onNone: () =>
      isWired(context)
        ? mineRow(parts, ui.device.ethernet, Option.none(), [])
        : [],
    onSome: status =>
      mineRow(parts, status.network.ssid, status.maybeProblem, [
        ...(status.network.security === 'open' ? [] : [lockIcon(h)]),
        signalIcon(status.network.signal, h),
      ]),
  })
}

const passwordSheet = <ParentMessage>(
  parts: Parts<ParentMessage>,
  sheet: Readonly<{
    ssid: string
    password: string
    isPasswordShown: boolean
    maybeProblem: Option.Option<NetMessage>
  }>,
): Html => {
  const { h, ui, send, renderMessage } = parts
  return h.form(
    [
      h.Class('screen-sheet'),
      h.Role('dialog'),
      h.AriaLabel(ui.device.passwordFor(sheet.ssid)),
      h.OnSubmit(send(Message.SubmittedWifiPassword())),
    ],
    [
      h.div([h.Class('screen-grab'), h.AriaHidden(true)]),
      h.h4([], [ui.device.passwordFor(sheet.ssid)]),
      h.div(
        [
          h.Class(
            classes(
              'screen-password',
              Option.isSome(sheet.maybeProblem) && 'bad',
            ),
          ),
        ],
        [
          h.input([
            h.Type(sheet.isPasswordShown ? 'text' : 'password'),
            h.Value(sheet.password),
            h.AriaLabel(ui.device.password),
            h.Placeholder(ui.device.password),
            h.Autocomplete('off'),
            h.Spellcheck(false),
            h.OnInput(value => send(Message.UpdatedWifiPassword({ value }))),
          ]),
          h.button(
            [
              h.Type('button'),
              h.Class('screen-eye'),
              h.AriaLabel(
                sheet.isPasswordShown
                  ? ui.device.hidePassword
                  : ui.device.showPassword,
              ),
              h.AriaPressed(sheet.isPasswordShown ? 'true' : 'false'),
              h.OnClick(send(Message.ClickedPasswordVisibility())),
            ],
            [eyeIcon(!sheet.isPasswordShown, h)],
          ),
        ],
      ),
      ...Option.match(sheet.maybeProblem, {
        onNone: () => [],
        onSome: problem => [
          h.p(
            [h.Class('screen-problem'), h.Role('alert')],
            [renderMessage(problem)],
          ),
        ],
      }),
      h.div(
        [h.Class('screen-actions')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('screen-button'),
              h.OnClick(send(Message.ClickedCloseSheet())),
            ],
            [ui.device.cancel],
          ),
          h.button(
            [h.Type('submit'), h.Class('screen-button primary')],
            [ui.device.join],
          ),
        ],
      ),
    ],
  )
}

const explainedSheet = <ParentMessage>(
  parts: Parts<ParentMessage>,
  ssid: string,
  problem: NetMessage,
): Html => {
  const { h, ui, send, renderMessage } = parts
  return h.div(
    [
      h.Class('screen-sheet'),
      h.Role('dialog'),
      h.AriaLabel(ui.device.foreignTitle(ssid)),
    ],
    [
      h.div([h.Class('screen-grab'), h.AriaHidden(true)]),
      h.h4([], [ui.device.foreignTitle(ssid)]),
      h.p([], [renderMessage(problem)]),
      h.div(
        [h.Class('screen-actions')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('screen-button primary'),
              h.OnClick(send(Message.ClickedCloseSheet())),
            ],
            [ui.device.understood],
          ),
        ],
      ),
    ],
  )
}

const sheetView = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, model, send } = parts
  const scrim = h.div([
    h.Class('screen-scrim'),
    h.OnClick(send(Message.ClickedCloseSheet())),
  ])
  return model.sheet._tag === 'Password'
    ? [scrim, passwordSheet(parts, model.sheet)]
    : model.sheet._tag === 'Explained'
      ? [scrim, explainedSheet(parts, model.sheet.ssid, model.sheet.problem)]
      : []
}

const wifiPage = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, context } = parts
  const maybeMine = Option.map(
    wifiStatus(context),
    status => status.network.ssid,
  )
  const others = Array.filter(
    Array.dedupeWith(
      nearbyNetworks(context.doc.doc, context.target),
      (left, right) => left.ssid === right.ssid,
    ),
    network => !Option.contains(maybeMine, network.ssid),
  )
  return [
    header(parts, ui.device.wifiTitle, Option.none()),
    h.div(
      [h.Class('screen-body')],
      [
        h.div(
          [h.Class('screen-switch')],
          [
            h.span([], [ui.device.wifiTitle]),
            h.span([
              h.Class('screen-toggle'),
              h.Role('img'),
              h.AriaLabel(ui.device.wifiOn),
            ]),
          ],
        ),
        ...myNetwork(parts),
        ...(isOpen(context.unlocked, 'wifi.join')
          ? [
              group(
                parts,
                Option.isSome(maybeMine)
                  ? ui.device.otherNetworks
                  : ui.device.nearby,
              ),
              Array.match(others, {
                onEmpty: () =>
                  h.p([h.Class('screen-note')], [ui.device.noNetworks]),
                onNonEmpty: networks =>
                  h.ul(
                    [h.Class('screen-networks'), h.Role('list')],
                    Array.map(networks, network => networkRow(parts, network)),
                  ),
              }),
              h.p([h.Class('screen-note')], [ui.device.wifiNote]),
            ]
          : []),
      ],
    ),
    ...sheetView(parts),
  ]
}

// NETWORK INFO

const infoLine = <ParentMessage>(
  parts: Parts<ParentMessage>,
  label: string,
  value: string,
): Html =>
  parts.h.div(
    [parts.h.Class('screen-row')],
    [parts.h.dt([], [label]), parts.h.dd([], [value])],
  )

const linkRow = <ParentMessage>(
  parts: Parts<ParentMessage>,
  label: string,
  value: string,
  page: Page,
): Html => {
  const { h, send } = parts
  return h.button(
    [
      h.Type('button'),
      h.Class(classes('screen-link', isGhost(parts, page) && 'ghost')),
      h.OnClick(send(Message.ClickedPage({ page }))),
    ],
    [
      h.span([], [label]),
      h.span([h.Class('screen-link-value')], [`${value} ›`]),
    ],
  )
}

const infoPage = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, context, send, isEditable } = parts
  const iface = ifaceOf(context)
  const value = (pick: (current: Iface) => Option.Option<string>) =>
    Option.getOrElse(Option.flatMap(iface, pick), () => ui.device.none)
  const dns = Option.match(dnsSettings(context), {
    onNone: () => ui.device.none,
    onSome: settings =>
      Array.match(settings.servers, {
        onEmpty: () => ui.device.none,
        onNonEmpty: servers => servers.join(', '),
      }),
  })
  const isManualDns = Option.exists(
    dnsSettings(context),
    settings => settings.isManual,
  )
  const isStatic = Option.exists(
    addressSettings(context),
    settings => settings.mode === 'static',
  )
  return [
    header(
      parts,
      connectionName(parts),
      Option.some({ page: 'wifi', label: ui.device.wifiTitle }),
    ),
    h.div(
      [h.Class('screen-body')],
      [
        h.dl(
          [h.Class('screen-rows')],
          [
            infoLine(
              parts,
              ui.device.ipAddress,
              value(current => Option.some(current.ip)),
            ),
            ...(isOpen(context.unlocked, 'wifi.addressing')
              ? [
                  infoLine(
                    parts,
                    ui.device.mask,
                    value(current => Option.some(maskOf(current.prefix))),
                  ),
                ]
              : []),
            infoLine(
              parts,
              ui.device.router,
              value(current => current.maybeGateway),
            ),
            infoLine(parts, ui.device.dns, dns),
          ],
        ),
        ...(isOpen(context.unlocked, 'wifi.networkInfo')
          ? [
              linkRow(
                parts,
                ui.device.configureDns,
                isManualDns ? ui.device.manual : ui.device.automatic,
                'dns',
              ),
            ]
          : []),
        ...(isOpen(context.unlocked, 'wifi.addressing')
          ? [
              linkRow(
                parts,
                ui.device.configureAddress,
                isStatic ? ui.device.manual : ui.device.automatic,
                'address',
              ),
            ]
          : []),
        ...(Option.isSome(wifiStatus(context)) && isEditable
          ? [
              h.button(
                [
                  h.Type('button'),
                  h.Class(
                    classes(
                      'screen-danger',
                      isGhost(parts, 'forget') && 'ghost',
                    ),
                  ),
                  h.OnClick(send(Message.ClickedForget())),
                ],
                [ui.device.forget],
              ),
            ]
          : []),
      ],
    ),
  ]
}

// DNS

const choice = <ParentMessage>(
  parts: Parts<ParentMessage>,
  label: string,
  isChosen: boolean,
  ghostKey: string,
  message: Message,
): Html => {
  const { h, send, isEditable } = parts
  return h.button(
    [
      h.Type('button'),
      h.Role('radio'),
      h.AriaChecked(isChosen),
      h.Class(
        classes(
          'screen-choice',
          isChosen && 'chosen',
          isGhost(parts, ghostKey) && 'ghost',
        ),
      ),
      ...(isEditable ? [h.OnClick(send(message))] : [h.Disabled(true)]),
    ],
    [h.span([h.Class('screen-radio'), h.AriaHidden(true)]), label],
  )
}

const serversEditor = <ParentMessage>(
  parts: Parts<ParentMessage>,
  draft: DnsDraft,
): ReadonlyArray<Html> => {
  const { h, ui, send, isEditable } = parts
  return [
    group(parts, ui.device.dnsServers),
    Array.match(draft.servers, {
      onEmpty: () => h.p([h.Class('screen-note')], [ui.device.dnsServersEmpty]),
      onNonEmpty: servers =>
        h.ul(
          [h.Class('screen-servers'), h.Role('list')],
          Array.map(servers, server =>
            h.keyed('li')(
              server,
              [],
              [
                h.span([], [server]),
                h.button(
                  [
                    h.Type('button'),
                    h.Class('screen-remove'),
                    h.AriaLabel(ui.device.removeServer(server)),
                    ...(isEditable
                      ? [
                          h.OnClick(
                            send(Message.ClickedRemoveDnsServer({ server })),
                          ),
                        ]
                      : [h.Disabled(true)]),
                  ],
                  ['−'],
                ),
              ],
            ),
          ),
        ),
    }),
    h.form(
      [
        h.Class(
          classes('screen-add', isGhost(parts, 'dns-servers') && 'ghost'),
        ),
        h.OnSubmit(send(Message.SubmittedDnsServer())),
      ],
      [
        h.input([
          h.Type('text'),
          h.Value(draft.server),
          h.AriaLabel(ui.device.newServer),
          h.Placeholder(ui.device.newServer),
          h.InputMode('decimal'),
          h.Autocomplete('off'),
          h.Spellcheck(false),
          ...(isEditable
            ? [h.OnInput(value => send(Message.UpdatedDnsServer({ value })))]
            : [h.Disabled(true)]),
        ]),
        h.button(
          [
            h.Type('submit'),
            h.Class('screen-button'),
            ...(isEditable ? [] : [h.Disabled(true)]),
          ],
          [ui.device.addServer],
        ),
      ],
    ),
    h.button(
      [
        h.Type('button'),
        h.Class(
          classes(
            'screen-button primary',
            isGhost(parts, 'dns-save') && 'ghost',
          ),
        ),
        ...(isEditable
          ? [h.OnClick(send(Message.ClickedSaveDns()))]
          : [h.Disabled(true)]),
      ],
      [ui.device.save],
    ),
  ]
}

const dnsPage = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, context, model } = parts
  const isManual = Option.isSome(model.maybeDnsDraft)
    ? true
    : Option.exists(dnsSettings(context), settings => settings.isManual)
  return [
    header(
      parts,
      ui.device.configureDns,
      Option.some({ page: 'info', label: connectionName(parts) }),
    ),
    h.div(
      [h.Class('screen-body')],
      [
        h.div(
          [h.Class('screen-choices'), h.Role('radiogroup')],
          [
            choice(
              parts,
              ui.device.dnsAutomatic,
              !isManual,
              'dns-mode:auto',
              Message.SelectedDnsMode({ mode: 'auto' }),
            ),
            choice(
              parts,
              ui.device.manual,
              isManual,
              'dns-mode:manual',
              Message.SelectedDnsMode({ mode: 'manual' }),
            ),
          ],
        ),
        ...Option.match(model.maybeDnsDraft, {
          onNone: () => [],
          onSome: draft => serversEditor(parts, draft),
        }),
      ],
    ),
  ]
}

// ADDRESS

const field = <ParentMessage>(
  parts: Parts<ParentMessage>,
  name: AddressField,
  label: string,
  value: string,
): Html => {
  const { h, send, isEditable } = parts
  return h.label(
    [
      h.Class(
        classes(
          'screen-field',
          isGhost(parts, `address-field:${name}`) && 'ghost',
        ),
      ),
    ],
    [
      h.span([], [label]),
      h.input([
        h.Type('text'),
        h.Value(value),
        h.InputMode('decimal'),
        h.Autocomplete('off'),
        h.Spellcheck(false),
        ...(isEditable
          ? [
              h.OnInput(next =>
                send(Message.UpdatedAddressField({ field: name, value: next })),
              ),
            ]
          : [h.Disabled(true)]),
      ]),
    ],
  )
}

const staticFields = <ParentMessage>(
  parts: Parts<ParentMessage>,
  draft: AddressDraft,
): ReadonlyArray<Html> => {
  const { ui } = parts
  return draft.mode === 'static'
    ? [
        field(parts, 'ip', ui.device.ipAddress, draft.ip),
        field(parts, 'mask', ui.device.mask, draft.mask),
        field(parts, 'gateway', ui.device.gateway, draft.gateway),
        field(parts, 'dns', ui.device.dns, draft.dns),
      ]
    : []
}

const addressPage = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, model, send, isEditable } = parts
  return [
    header(
      parts,
      ui.device.configureAddress,
      Option.some({ page: 'info', label: connectionName(parts) }),
    ),
    h.div(
      [h.Class('screen-body')],
      Option.match(model.maybeAddressDraft, {
        onNone: () => [],
        onSome: draft => [
          h.div(
            [h.Class('screen-choices'), h.Role('radiogroup')],
            [
              choice(
                parts,
                ui.device.addressAutomatic,
                draft.mode === 'dhcp',
                'address-mode:dhcp',
                Message.SelectedAddressMode({ mode: 'dhcp' }),
              ),
              choice(
                parts,
                ui.device.manual,
                draft.mode === 'static',
                'address-mode:static',
                Message.SelectedAddressMode({ mode: 'static' }),
              ),
            ],
          ),
          ...staticFields(parts, draft),
          h.div(
            [h.Class('screen-actions')],
            [
              h.button(
                [
                  h.Type('button'),
                  h.Class('screen-button'),
                  h.OnClick(send(Message.ClickedPage({ page: 'info' }))),
                ],
                [ui.device.cancel],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.Class(
                    classes(
                      'screen-button primary',
                      isGhost(parts, 'address-save') && 'ghost',
                    ),
                  ),
                  ...(isEditable
                    ? [h.OnClick(send(Message.ClickedSaveAddress()))]
                    : [h.Disabled(true)]),
                ],
                [ui.device.save],
              ),
            ],
          ),
        ],
      }),
    ),
  ]
}

/** Приложение «Настройки» на текущей странице. */
export const settingsView = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const pages: Readonly<
    Record<Page, (current: Parts<ParentMessage>) => ReadonlyArray<Html>>
  > = {
    wifi: wifiPage,
    info: infoPage,
    dns: dnsPage,
    address: addressPage,
  }
  return pages[parts.model.page](parts)
}
