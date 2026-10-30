import { Array, Option, Result, pipe } from 'effect'

import {
  addRoute,
  configureWifi,
  forward,
  reserve,
  setDhcpPool,
  unforward,
  wifi,
} from '../../../../net/build'
import { NetOp, findDevice, isHost } from '../../../../net/doc'
import type { NetMessage } from '../../../../net/message'
import {
  type DeviceId,
  type PortForward,
  type Proto,
  type Reservation,
  type Router,
  type StaticRoute,
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
import * as Check from './fields'
import {
  type Choice,
  type PanelContext,
  type PanelDefinition,
  type PanelTab,
  type Values,
  choice,
  fieldOf,
  gather,
  gatherAll,
  rowsOf,
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

// ADDRESSES

const blameOn =
  (field: string, tags: ReadonlyArray<NetMessage['_tag']>) =>
  (message: NetMessage): Option.Option<string> =>
    Array.contains(tags, message._tag) ? Option.some(field) : Option.none()

/** Устройства доски, которым можно закрепить адрес: по MAC, с подписью. */
const deviceChoices = (
  context: PanelContext,
  router: Router,
): ReadonlyArray<Choice> => {
  const hosts = Array.filter(
    context.world.doc.devices,
    (device): device is Extract<typeof device, { _tag: 'Host' }> =>
      isHost(device) && Option.isNone(device.maybeContainer),
  )
  const known = Array.map(hosts, host => host.mac)
  return [
    ...Array.map(hosts, host => choice(host.mac, () => context.name(host.id))),
    ...Array.map(
      Array.filter(
        router.dhcp.reservations,
        reservation => !Array.contains(known, reservation.mac),
      ),
      reservation =>
        choice(reservation.mac, strings =>
          strings.addresses.otherMac(reservation.mac),
        ),
    ),
  ]
}

const sameReservation = (left: Reservation, right: Reservation): boolean =>
  left.mac === right.mac && left.ip === right.ip

const addressesTab: PanelTab = {
  id: 'addresses',
  feature: 'router.addresses',
  label: strings => strings.addresses.tab,
  fields: context =>
    Option.match(routerOf(context), {
      onNone: () => [],
      onSome: router => {
        const devices = deviceChoices(context, router)
        return [
          {
            _tag: 'Input',
            id: 'poolStart',
            label: strings => strings.addresses.poolStart,
            input: 'ip',
          },
          {
            _tag: 'Input',
            id: 'poolEnd',
            label: strings => strings.addresses.poolEnd,
            input: 'ip',
          },
          {
            _tag: 'List',
            id: 'reservations',
            label: strings => strings.addresses.reservations,
            columns: [
              {
                _tag: 'Select',
                id: 'device',
                label: strings => strings.addresses.device,
                choices: devices,
              },
              {
                _tag: 'Input',
                id: 'ip',
                label: strings => strings.addresses.address,
                input: 'ip',
              },
            ],
            newRow: {
              device: Option.getOrElse(
                Option.map(Array.head(devices), first => first.value),
                () => '',
              ),
              ip: '',
            },
          },
        ]
      },
    }),
  read: context =>
    readRouter(context, router =>
      values(
        { poolStart: router.dhcp.start, poolEnd: router.dhcp.end },
        {
          reservations: Array.map(router.dhcp.reservations, reservation => ({
            id: reservation.mac,
            cells: { device: reservation.mac, ip: reservation.ip },
          })),
        },
      ),
    ),
  save: (context, draft, base) =>
    Option.match(routerOf(context), {
      onNone: () => Result.succeed([]),
      onSome: router =>
        Result.map(
          gather({
            start: Check.ip('poolStart', fieldOf(draft, 'poolStart')),
            end: Check.ip('poolEnd', fieldOf(draft, 'poolEnd')),
            reservations: gatherAll(
              Array.map(rowsOf(draft, 'reservations'), row => {
                const cell = Check.cell<string>('reservations', row)
                return Result.map(
                  gather({
                    mac: cell('device', Check.text),
                    ip: cell('ip', Check.ip),
                  }),
                  ({ mac, ip }): Reservation => ({ mac, ip }),
                )
              }),
            ),
          }),
          ({ start, end, reservations }) => {
            const poolChanged =
              fieldOf(base, 'poolStart') !== fieldOf(draft, 'poolStart') ||
              fieldOf(base, 'poolEnd') !== fieldOf(draft, 'poolEnd')
            const current = router.dhcp.reservations
            return [
              ...(poolChanged ? [setDhcpPool(router.id, start, end)] : []),
              ...Array.map(
                Check.missingFrom(
                  current,
                  reservations,
                  reservation => reservation.mac,
                  reservation => reservation.mac,
                ),
                reservation =>
                  NetOp.RemoveReservation({
                    router: router.id,
                    mac: reservation.mac,
                  }),
              ),
              ...Array.map(
                Array.filter(
                  reservations,
                  reservation =>
                    !Array.some(current, other =>
                      sameReservation(other, reservation),
                    ),
                ),
                reservation =>
                  reserve(router.id, reservation.mac, reservation.ip),
              ),
            ]
          },
        ),
    }),
  blame: message =>
    Option.orElse(
      blameOn('poolStart', [
        'DhcpPoolOutsideSubnet',
        'DhcpPoolReversed',
        'DhcpPoolIncludesRouter',
      ])(message),
      () =>
        blameOn('reservations', [
          'ReservationOutsideSubnet',
          'ReservationTaken',
          'DuplicateMac',
          'InvalidMac',
        ])(message),
    ),
}

// PORTS

const protoChoices: ReadonlyArray<Choice> = [
  choice('tcp', () => 'TCP'),
  choice('udp', () => 'UDP'),
]

const protoOf = (value: string): Proto => (value === 'udp' ? 'udp' : 'tcp')

const forwardKey = (rule: PortForward): string =>
  `${rule.proto}:${rule.outsidePort}:${rule.insideIp}:${rule.insidePort}`

const portsTab: PanelTab = {
  id: 'ports',
  feature: 'router.ports',
  label: strings => strings.ports.tab,
  fields: () => [
    {
      _tag: 'List',
      id: 'forwards',
      label: strings => strings.ports.rules,
      columns: [
        {
          _tag: 'Select',
          id: 'proto',
          label: strings => strings.ports.proto,
          choices: protoChoices,
        },
        {
          _tag: 'Input',
          id: 'outsidePort',
          label: strings => strings.ports.outsidePort,
          input: 'port',
        },
        {
          _tag: 'Input',
          id: 'insideIp',
          label: strings => strings.ports.insideIp,
          input: 'ip',
        },
        {
          _tag: 'Input',
          id: 'insidePort',
          label: strings => strings.ports.insidePort,
          input: 'port',
        },
      ],
      newRow: { proto: 'tcp', outsidePort: '', insideIp: '', insidePort: '' },
    },
  ],
  read: context =>
    readRouter(context, router =>
      values(
        {},
        {
          forwards: Array.map(router.forwards, rule => ({
            id: `${rule.proto}:${rule.outsidePort}`,
            cells: {
              proto: rule.proto,
              outsidePort: `${rule.outsidePort}`,
              insideIp: rule.insideIp,
              insidePort: `${rule.insidePort}`,
            },
          })),
        },
      ),
    ),
  save: (context, draft) =>
    Option.match(routerOf(context), {
      onNone: () => Result.succeed([]),
      onSome: router =>
        Result.map(
          gatherAll(
            Array.map(rowsOf(draft, 'forwards'), row => {
              const port = Check.cell<number>('forwards', row)
              return Result.map(
                gather({
                  outsidePort: port('outsidePort', Check.port),
                  insideIp: Check.cell<string>('forwards', row)(
                    'insideIp',
                    Check.ip,
                  ),
                  insidePort: port('insidePort', Check.port),
                }),
                (parsed): PortForward => ({
                  proto: protoOf(row.cells['proto'] ?? ''),
                  ...parsed,
                }),
              )
            }),
          ),
          rules => [
            ...Array.map(
              Check.missingFrom(router.forwards, rules, forwardKey, forwardKey),
              rule => unforward(router.id, rule.proto, rule.outsidePort),
            ),
            ...Array.map(
              Check.missingFrom(rules, router.forwards, forwardKey, forwardKey),
              rule => forward(router.id, rule),
            ),
          ],
        ),
    }),
  blame: blameOn('forwards', [
    'ForwardOutsideLan',
    'ForwardPortTaken',
    'InvalidPort',
    'InvalidIp',
  ]),
}

// ROUTES

const routeKey = (route: StaticRoute): string =>
  `${route.network}/${route.prefix}>${route.via}`

const routesTab: PanelTab = {
  id: 'routes',
  feature: 'router.routes',
  label: strings => strings.routes.tab,
  fields: () => [
    {
      _tag: 'List',
      id: 'routes',
      label: strings => strings.routes.rules,
      columns: [
        {
          _tag: 'Input',
          id: 'network',
          label: strings => strings.routes.network,
          input: 'cidr',
          placeholder: () => '10.0.0.0/8',
        },
        {
          _tag: 'Input',
          id: 'via',
          label: strings => strings.routes.via,
          input: 'ip',
        },
      ],
      newRow: { network: '', via: '' },
    },
  ],
  read: context =>
    readRouter(context, router =>
      values(
        {},
        {
          routes: Array.map(router.routes, route => ({
            id: `${route.network}/${route.prefix}`,
            cells: {
              network: `${route.network}/${route.prefix}`,
              via: route.via,
            },
          })),
        },
      ),
    ),
  save: (context, draft) =>
    Option.match(routerOf(context), {
      onNone: () => Result.succeed([]),
      onSome: router =>
        Result.map(
          gatherAll(
            Array.map(rowsOf(draft, 'routes'), row => {
              const cell = Check.cell<string>('routes', row)
              return gather({
                network: cell('network', Check.cidr),
                via: cell('via', Check.ip),
              })
            }),
          ),
          rows => {
            const wanted = Array.map(rows, row => {
              const [network = '', prefix = '0'] = row.network.split('/')
              return {
                network,
                prefix: globalThis.Number(prefix),
                via: row.via,
                cidr: row.network,
              }
            })
            return [
              ...Array.map(
                Check.missingFrom(router.routes, wanted, routeKey, routeKey),
                route =>
                  NetOp.RemoveRoute({
                    router: router.id,
                    network: route.network,
                    prefix: route.prefix,
                  }),
              ),
              ...Array.map(
                Check.missingFrom(wanted, router.routes, routeKey, routeKey),
                route => addRoute(router.id, route.cidr, route.via),
              ),
            ]
          },
        ),
    }),
  blame: blameOn('routes', [
    'RouteViaOutsideLan',
    'InvalidIp',
    'InvalidPrefix',
  ]),
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
  tabs: [wifiTab, devicesTab, addressesTab, portsTab, routesTab],
}
