import { Array, Option, Result, pipe } from 'effect'

import { configureWifi, wifi } from '../../../../net/build'
import { findDevice, isHost } from '../../../../net/doc'
import type { NetMessage } from '../../../../net/message'
import {
  type DeviceId,
  type Router,
  type WifiBand,
} from '../../../../net/model'
import {
  addressOf,
  associationOf,
  hostLinkOf,
  segmentOf,
} from '../../../../net/topology'
import { isValidChannel } from '../../../../net/wifi'
import type { PacketDoc } from '../../doc'
import {
  type PanelContext,
  type PanelDefinition,
  type PanelTab,
  type Values,
  choice,
  fieldOf,
  values,
} from './schema'

// Админка роутера (план 3.2, 3.4): вкладки открываются уроками курса —
// «Wi-Fi» (урок 5), «Устройства» (7), «Адреса» и «Порты» (9), «Маршруты»
// (13). Вид нейтральный: ни одного производителя она не повторяет.

// DEVICE

const ROUTER_ID = 'router'

const routersOf = (world: PacketDoc): ReadonlyArray<Router> =>
  Array.filter(
    world.doc.devices,
    (device): device is Router =>
      device._tag === 'Router' && Option.isNone(device.maybeVpnServer),
  )

/** Роутер панели: `router:<id>` или домашний роутер доски (`router`, иначе
    первый роутер без VPN-сервера). */
const routerDevice = (
  world: PacketDoc,
  target: string,
): Option.Option<DeviceId> => {
  const routers = routersOf(world)
  const wanted = target === '' ? ROUTER_ID : target
  return pipe(
    Array.findFirst(routers, router => router.id === wanted),
    Option.orElse(() => (target === '' ? Array.head(routers) : Option.none())),
    Option.map(router => router.id),
  )
}

export const routerOf = (context: PanelContext): Option.Option<Router> =>
  pipe(
    findDevice(context.world.doc, context.device),
    Option.filter((device): device is Router => device._tag === 'Router'),
  )

const readRouter = (
  context: PanelContext,
  read: (router: Router) => Values,
): Values =>
  Option.match(routerOf(context), {
    onNone: () => values({}),
    onSome: read,
  })

// WI-FI

const SECURED = 'secured'
const OPEN = 'open'

const defaultChannel = (band: WifiBand): number => (band === '5' ? 36 : 6)

const bandOf = (value: string): WifiBand =>
  value === '2.4' || value === '5' ? value : 'dual'

const wifiTab: PanelTab = {
  id: 'wifi',
  feature: 'router.wifi',
  label: strings => strings.wifi.tab,
  fields: () => [
    {
      _tag: 'Input',
      id: 'ssid',
      label: strings => strings.wifi.ssid,
      input: 'text',
    },
    {
      _tag: 'Input',
      id: 'password',
      label: strings => strings.wifi.password,
      input: 'password',
    },
    {
      _tag: 'Segmented',
      id: 'security',
      label: strings => strings.wifi.security,
      choices: [
        choice(SECURED, strings => strings.wifi.secured),
        choice(OPEN, strings => strings.wifi.open),
      ],
    },
    {
      _tag: 'Select',
      id: 'band',
      label: strings => strings.wifi.band,
      choices: [
        choice('2.4', strings => strings.wifi.band24),
        choice('5', strings => strings.wifi.band5),
        choice('dual', strings => strings.wifi.bandDual),
      ],
    },
  ],
  read: context =>
    readRouter(context, router =>
      Option.match(router.maybeWifi, {
        onNone: () =>
          values({ ssid: '', password: '', security: SECURED, band: 'dual' }),
        onSome: config =>
          values({
            ssid: config.ssid,
            password: config.password,
            security: config.security === 'open' ? OPEN : SECURED,
            band: config.band,
          }),
      }),
    ),
  save: (context, draft) =>
    Result.succeed(
      Option.match(routerOf(context), {
        onNone: () => [],
        onSome: router => {
          const band = bandOf(fieldOf(draft, 'band'))
          const current = router.maybeWifi
          const channel = pipe(
            current,
            Option.map(config => config.channel),
            Option.filter(channel => isValidChannel(band, channel)),
            Option.getOrElse(() => defaultChannel(band)),
          )
          const secured = pipe(
            current,
            Option.map(config => config.security),
            Option.filter(security => security !== 'open'),
            Option.getOrElse(() => 'wpa2' as const),
          )
          return [
            configureWifi(
              router.id,
              wifi(fieldOf(draft, 'ssid'), fieldOf(draft, 'password'), {
                security:
                  fieldOf(draft, 'security') === OPEN ? 'open' : secured,
                band,
                channel,
              }),
            ),
          ]
        },
      }),
    ),
  blame: (message: NetMessage) =>
    message._tag === 'EmptySsid'
      ? Option.some('ssid')
      : message._tag === 'WifiPasswordTooShort'
        ? Option.some('password')
        : message._tag === 'InvalidChannel'
          ? Option.some('band')
          : Option.none(),
}

// DEVICES

const CABLE = 'cable'

/** Код подключения: `cable`, диапазон Wi-Fi (`5`, `2.4`) или пусто. */
const connectionOf = (context: PanelContext, id: DeviceId): string =>
  Option.match(hostLinkOf(context.world.doc, id), {
    onNone: () => '',
    onSome: link =>
      Option.match(associationOf(context.world.doc, link), {
        onNone: () => CABLE,
        onSome: association =>
          association._tag === 'Associated' ? association.band : '',
      }),
  })

/** Устройства в сети роутера: хосты его сегмента по живым связям. */
const devicesTab: PanelTab = {
  id: 'devices',
  feature: 'router.devices',
  label: strings => strings.devices.tab,
  fields: () => [
    {
      _tag: 'Table',
      id: 'devices',
      label: strings => strings.devices.title,
      columns: [
        { id: 'name', label: strings => strings.devices.device },
        { id: 'ip', label: strings => strings.devices.address },
        { id: 'mac', label: strings => strings.devices.mac },
        {
          id: 'link',
          label: strings => strings.devices.connection,
          format: (strings, value) =>
            value === CABLE
              ? strings.devices.cable
              : value === '5' || value === '2.4'
                ? strings.devices.radio(
                    value === '5' ? strings.wifi.band5 : strings.wifi.band24,
                  )
                : '—',
        },
      ],
      empty: strings => strings.devices.empty,
    },
  ],
  read: context =>
    values(
      {},
      {
        devices: pipe(
          context.world.doc.devices,
          Array.filter(isHost),
          Array.filter(
            host =>
              Option.isNone(host.maybeContainer) &&
              Array.contains(
                segmentOf(context.world.doc, context.device),
                host.id,
              ),
          ),
          Array.map(host => ({
            id: host.id,
            cells: {
              name: context.name(host.id),
              ip: Option.getOrElse(
                addressOf(context.world.doc, context.run.settled, host.id),
                () => '—',
              ),
              mac: host.mac,
              link: connectionOf(context, host.id),
            },
          })),
        ),
      },
    ),
  save: () => Result.succeed([]),
}

// PANEL

export const routerPanel: PanelDefinition = {
  type: 'router',
  feature: 'router',
  device: routerDevice,
  tabLabel: (_maybeContext, strings) => strings.routerTab,
  heading: (context, strings) =>
    Option.match(routerOf(context), {
      onNone: () => strings.routerTab,
      onSome: router => `${context.name(router.id)} · ${router.lan.ip}`,
    }),
  tabs: [wifiTab, devicesTab],
}
