import { Array, Option, Order, pipe } from 'effect'

import { inCidr, inSubnet, networkAddress } from './address'
import {
  findDevice,
  findRouter,
  isL3Boundary,
  isRouter,
  isWanOf,
  linksOf,
  otherEnd,
  reach,
} from './doc'
import { NetMessage } from './message'
import {
  type Band,
  type Device,
  type DeviceId,
  type Host,
  type Ip,
  type Link,
  type Mac,
  type NetDoc,
  type NetState,
  type Router,
  type Security,
  type WifiConfig,
} from './model'
import {
  type Association,
  associate,
  bandsOf,
  channelsOverlap,
  signalBars,
  wifiRules,
} from './wifi'

// RADIO

export const wifiOf = (device: Device): Option.Option<WifiConfig> =>
  device._tag === 'Router' || device._tag === 'AccessPoint'
    ? device.maybeWifi
    : Option.none()

const distance = (left: Device, right: Device): number =>
  Math.hypot(left.x - right.x, left.y - right.y)

const cross = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)

/** Сколько стен пересекает прямая между двумя устройствами. */
export const wallsBetween = (
  doc: NetDoc,
  left: Device,
  right: Device,
): number =>
  Array.filter(doc.walls, wall => {
    const d1 = cross(wall.x1, wall.y1, wall.x2, wall.y2, left.x, left.y)
    const d2 = cross(wall.x1, wall.y1, wall.x2, wall.y2, right.x, right.y)
    const d3 = cross(left.x, left.y, right.x, right.y, wall.x1, wall.y1)
    const d4 = cross(left.x, left.y, right.x, right.y, wall.x2, wall.y2)
    return d1 * d2 < 0 && d3 * d4 < 0
  }).length

/** Расстояние для радио: по прямой плюс штраф за каждую стену. */
export const radioDistance = (
  doc: NetDoc,
  left: Device,
  right: Device,
): number =>
  distance(left, right) + wallsBetween(doc, left, right) * wifiRules.wallPenalty

/** Подключение по радиосвязи; для других связей — `none`. */
export const associationOf = (
  doc: NetDoc,
  link: Link,
): Option.Option<Association> =>
  link.medium !== 'radio'
    ? Option.none()
    : pipe(
        Option.all([findDevice(doc, link.a), findDevice(doc, link.b)]),
        Option.flatMap(([left, right]) =>
          left._tag === 'Host'
            ? Option.some({ station: left, ap: right })
            : right._tag === 'Host'
              ? Option.some({ station: right, ap: left })
              : Option.none(),
        ),
        Option.map(({ station, ap }) =>
          associate(
            station,
            ap.id,
            wifiOf(ap),
            radioDistance(doc, station, ap),
          ),
        ),
      )

/** Почему по связи не идут кадры: выдернута или радио не подключилось. */
export const linkFault = (
  doc: NetDoc,
  link: Link,
  device: DeviceId,
): Option.Option<NetMessage> =>
  link.up
    ? Option.flatMap(associationOf(doc, link), association =>
        association._tag === 'NotAssociated'
          ? Option.some(association.reason)
          : Option.none(),
      )
    : Option.some(NetMessage.LinkDown({ device, link: link.id }))

export const isLinkActive = (doc: NetDoc, link: Link): boolean =>
  Option.isNone(linkFault(doc, link, link.a))

export const activeLinksOf = (doc: NetDoc, id: DeviceId): ReadonlyArray<Link> =>
  Array.filter(linksOf(doc, id), link => isLinkActive(doc, link))

/** Порты LAN роутера: всё, кроме WAN, и только живые. */
export const lanLinksOf = (doc: NetDoc, id: DeviceId): ReadonlyArray<Link> =>
  Array.filter(activeLinksOf(doc, id), link => !isWanOf(doc, link, id))

export const wanLinkOf = (doc: NetDoc, id: DeviceId): Option.Option<Link> =>
  Array.findFirst(linksOf(doc, id), link => isWanOf(doc, link, id))

/** Разъём хоста: единственная связь, кроме виртуальных связей хоста
    Docker с контейнерами (у контейнера это его связь с хостом). */
export const hostLinkOf = (doc: NetDoc, id: DeviceId): Option.Option<Link> =>
  pipe(
    findDevice(doc, id),
    Option.flatMap(device =>
      device._tag === 'Host' && Option.isSome(device.maybeContainer)
        ? Array.head(linksOf(doc, id))
        : Array.findFirst(linksOf(doc, id), link => link.medium !== 'virtual'),
    ),
  )

/** Точки доступа поблизости, чей канал пересекается с каналом `id`. */
export const channelConflicts = (
  doc: NetDoc,
  id: DeviceId,
): ReadonlyArray<DeviceId> =>
  Option.match(
    Option.flatMap(findDevice(doc, id), device =>
      Option.map(wifiOf(device), wifi => ({ device, wifi })),
    ),
    {
      onNone: () => [],
      onSome: ({ device, wifi }) =>
        pipe(
          doc.devices,
          Array.filter(
            other =>
              other.id !== id &&
              distance(device, other) <= wifiRules.range24 &&
              Option.exists(wifiOf(other), otherWifi =>
                channelsOverlap(wifi, otherWifi),
              ),
          ),
          Array.map(other => other.id),
        ),
    },
  )

/** Сеть Wi-Fi, которую видит устройство: имя, защита, общие диапазоны и
    сигнал 1–3 (по лучшему диапазону). */
export type NearbyNetwork = Readonly<{
  ap: DeviceId
  ssid: string
  security: Security
  bands: ReadonlyArray<Band>
  signal: number
  linked: boolean
}>

export const nearbyNetworks = (
  doc: NetDoc,
  id: DeviceId,
): ReadonlyArray<NearbyNetwork> =>
  Option.match(
    Option.filter(findDevice(doc, id), device => device._tag === 'Host'),
    {
      onNone: () => [],
      onSome: device => {
        const bands = device._tag === 'Host' ? device.wifiBands : []
        return pipe(
          doc.devices,
          Array.flatMap(ap =>
            Option.match(wifiOf(ap), {
              onNone: () => [],
              onSome: (wifi): ReadonlyArray<NearbyNetwork> => {
                const common = Array.filter(bandsOf(wifi.band), band =>
                  Array.contains(bands, band),
                )
                const reach = radioDistance(doc, device, ap)
                const signal = Array.reduce(common, 0, (best, band) =>
                  Math.max(best, signalBars(reach, band)),
                )
                return signal > 0
                  ? [
                      {
                        ap: ap.id,
                        ssid: wifi.ssid,
                        security: wifi.security,
                        bands: common,
                        signal,
                        linked: Array.some(
                          linksOf(doc, id),
                          link =>
                            link.medium === 'radio' &&
                            otherEnd(link, id) === ap.id,
                        ),
                      },
                    ]
                  : []
              },
            }),
          ),
          Array.sort(
            Order.mapInput(
              Order.flip(Order.Number),
              (network: NearbyNetwork) => network.signal,
            ),
          ),
        )
      },
    },
  )

/** Подключится ли устройство к сети с этим паролем. Своя сеть — та, к чьей
    точке у устройства есть радиосвязь; чужая открытая и чужая закрытая
    сети дают разные коды, как объяснение без подключения. */
export const checkJoin = (
  doc: NetDoc,
  id: DeviceId,
  ssid: string,
  password: string,
): Option.Option<NetMessage> =>
  Option.match(
    Array.findFirst(nearbyNetworks(doc, id), network => network.ssid === ssid),
    {
      onNone: () =>
        Option.some(NetMessage.NetworkNotFound({ device: id, ssid })),
      onSome: network =>
        network.linked
          ? pipe(
              Option.all([
                Option.filter(
                  findDevice(doc, id),
                  (device): device is Host => device._tag === 'Host',
                ),
                findDevice(doc, network.ap),
              ]),
              Option.flatMap(([host, ap]) => {
                const association = associate(
                  {
                    ...host,
                    maybeWifiProfile: Option.some({ ssid, password }),
                  },
                  ap.id,
                  wifiOf(ap),
                  radioDistance(doc, host, ap),
                )
                return association._tag === 'NotAssociated'
                  ? Option.some(association.reason)
                  : Option.none()
              }),
            )
          : Option.some(
              network.security === 'open'
                ? NetMessage.ForeignOpenNetwork({ device: id, ssid })
                : NetMessage.ForeignNetwork({ device: id, ssid }),
            ),
    },
  )

// SEGMENTS

/** Широковещательный сегмент: кого достанет broadcast от `id` по живым
    связям через коммутаторы, точки доступа и LAN роутеров. */
export const segmentOf = (doc: NetDoc, id: DeviceId): ReadonlyArray<DeviceId> =>
  reach(id, current =>
    pipe(
      activeLinksOf(doc, current),
      Array.filter(link => !isL3Boundary(doc, link)),
      Array.map(link => otherEnd(link, current)),
    ),
  )

/** Сервер DHCP сегмента: первый по документу роутер с включённым DHCP. */
export const dhcpServerFor = (
  doc: NetDoc,
  id: DeviceId,
): Option.Option<Router> => {
  const segment = segmentOf(doc, id)
  return Array.findFirst(
    doc.devices,
    (device): device is Router =>
      isRouter(device) &&
      device.dhcp.enabled &&
      Array.contains(segment, device.id),
  )
}

// ADDRESSES

/** Сетевые настройки хоста, которыми он пользуется прямо сейчас. */
export type Iface = Readonly<{
  device: DeviceId
  mac: Mac
  ip: Ip
  prefix: number
  maybeGateway: Option.Option<Ip>
  maybeDns: Option.Option<Ip>
}>

export const leaseIface = (host: Host, router: Router, ip: Ip): Iface => ({
  device: host.id,
  mac: host.mac,
  ip,
  prefix: router.lan.prefix,
  maybeGateway: Option.some(router.lan.ip),
  maybeDns: router.dhcp.maybeDns,
})

/** Ручной DNS поверх адреса: «вручную» с пустым списком — DNS нет. */
const withDnsOverride = (host: Host, iface: Iface): Iface =>
  Option.match(host.maybeDnsOverride, {
    onNone: () => iface,
    onSome: servers => ({ ...iface, maybeDns: Array.head(servers) }),
  })

/** Адрес хоста: ручной или аренда DHCP у роутера своего сегмента. Аренда у
    чужого роутера (хост переехал) или вне его сети не считается. */
export const hostIface = (
  doc: NetDoc,
  state: NetState,
  host: Host,
): Option.Option<Iface> => {
  if (host.addressing._tag === 'Static') {
    return Option.some(
      withDnsOverride(host, {
        device: host.id,
        mac: host.mac,
        ip: host.addressing.ip,
        prefix: host.addressing.prefix,
        maybeGateway: host.addressing.maybeGateway,
        maybeDns: host.addressing.maybeDns,
      }),
    )
  }
  if (host.addressing._tag === 'Unset') {
    return Option.none()
  }
  const segment = segmentOf(doc, host.id)
  return pipe(
    state.leases,
    Array.filter(lease => lease.mac === host.mac),
    Array.findFirst(lease =>
      pipe(
        findRouter(doc, lease.router),
        Option.filter(
          router =>
            Array.contains(segment, router.id) &&
            inSubnet(lease.ip, router.lan.ip, router.lan.prefix),
        ),
        Option.map(router =>
          withDnsOverride(host, leaseIface(host, router, lease.ip)),
        ),
      ),
    ),
  )
}

export const addressOf = (
  doc: NetDoc,
  state: NetState,
  id: DeviceId,
): Option.Option<Ip> =>
  Option.flatMap(findDevice(doc, id), device =>
    device._tag === 'Host'
      ? Option.map(hostIface(doc, state, device), iface => iface.ip)
      : device._tag === 'Router'
        ? Option.some(device.lan.ip)
        : device._tag === 'Transit'
          ? Option.some(device.ip)
          : Option.none(),
  )

/** Адреса, по которым хост принимает конверты как свои: основной, адрес
    в туннеле VPN, адрес mesh и шлюз моста Docker. */
export const ownAddresses = (
  doc: NetDoc,
  state: NetState,
  host: Host,
): ReadonlyArray<Ip> => [
  ...Option.toArray(Option.map(hostIface(doc, state, host), iface => iface.ip)),
  ...Option.toArray(
    pipe(
      host.maybeVpn,
      Option.filter(vpn => vpn.connected),
      Option.map(vpn => vpn.address),
    ),
  ),
  ...Option.toArray(Option.map(host.maybeMesh, mesh => mesh.ip)),
  ...Option.toArray(Option.map(host.maybeDocker, bridge => bridge.ip)),
]

/** WAN роутера за роутером: связь, шлюз (LAN верхнего роутера) и маска. */
export type EthernetWan = Readonly<{
  link: Link
  upstream: Router
  gateway: Ip
  prefix: number
}>

export const ethernetWanOf = (
  doc: NetDoc,
  router: Router,
): Option.Option<EthernetWan> =>
  pipe(
    wanLinkOf(doc, router.id),
    Option.flatMap(link =>
      pipe(
        findRouter(doc, otherEnd(link, router.id)),
        Option.map(upstream => ({
          link,
          upstream,
          gateway: upstream.lan.ip,
          prefix: upstream.lan.prefix,
        })),
      ),
    ),
  )

// ROUTE TABLES

/** Строка таблицы маршрутов для карточки устройства и `ip route`. */
export type RouteRow = Readonly<{
  kind: 'connected' | 'static' | 'default' | 'vpn' | 'tunnel' | 'transit'
  network: Ip
  prefix: number
  maybeVia: Option.Option<string>
  iface: string
}>

const row = (
  kind: RouteRow['kind'],
  network: Ip,
  prefix: number,
  maybeVia: Option.Option<string>,
  iface: string,
): RouteRow => ({ kind, network, prefix, maybeVia, iface })

/** Имя интерфейса хоста в выводе терминала. */
export const IFACE = 'en0'

const hostRoutes = (
  doc: NetDoc,
  state: NetState,
  host: Host,
): ReadonlyArray<RouteRow> =>
  Option.match(hostIface(doc, state, host), {
    onNone: () => [],
    onSome: iface => {
      const vpn = pipe(
        host.maybeVpn,
        Option.filter(client => client.connected),
        Option.map(client =>
          client.mode === 'full'
            ? [row('vpn', '0.0.0.0', 0, Option.some(client.gateway), 'wg0')]
            : [
                ...Array.flatMap(client.networks, cidr => {
                  const [network = '', prefix = '0'] = cidr.split('/')
                  return [
                    row(
                      'vpn',
                      network,
                      globalThis.Number(prefix),
                      Option.some(client.gateway),
                      'wg0',
                    ),
                  ]
                }),
                ...Option.toArray(
                  pipe(
                    client.maybeDns,
                    Option.filter(
                      dns =>
                        !Array.some(client.networks, cidr =>
                          inCidr(dns.server, cidr),
                        ),
                    ),
                    Option.map(dns =>
                      row(
                        'vpn',
                        dns.server,
                        32,
                        Option.some(client.gateway),
                        'wg0',
                      ),
                    ),
                  ),
                ),
              ],
        ),
        Option.getOrElse((): ReadonlyArray<RouteRow> => []),
      )
      const docker = Option.toArray(
        Option.map(host.maybeDocker, bridge =>
          row(
            'connected',
            networkAddress(bridge.ip, bridge.prefix),
            bridge.prefix,
            Option.none(),
            'docker0',
          ),
        ),
      )
      return [
        ...vpn,
        ...Option.toArray(
          Option.map(iface.maybeGateway, gateway =>
            row('default', '0.0.0.0', 0, Option.some(gateway), IFACE),
          ),
        ),
        row(
          'connected',
          networkAddress(iface.ip, iface.prefix),
          iface.prefix,
          Option.none(),
          IFACE,
        ),
        ...docker,
      ]
    },
  })

const routerRoutes = (doc: NetDoc, router: Router): ReadonlyArray<RouteRow> => [
  row(
    'connected',
    networkAddress(router.lan.ip, router.lan.prefix),
    router.lan.prefix,
    Option.none(),
    'lan',
  ),
  ...Array.map(router.routes, route =>
    row('static', route.network, route.prefix, Option.some(route.via), 'lan'),
  ),
  ...Option.toArray(
    Option.map(router.maybeVpnServer, server =>
      row('tunnel', server.network, server.prefix, Option.none(), 'wg0'),
    ),
  ),
  row(
    'default',
    '0.0.0.0',
    0,
    Option.match(ethernetWanOf(doc, router), {
      onNone: () =>
        Option.map(wanLinkOf(doc, router.id), link =>
          otherEnd(link, router.id),
        ),
      onSome: wan => Option.some(wan.gateway),
    }),
    'wan',
  ),
]

/** Таблица маршрутов устройства. У транзита без своих строк — пустая:
    он ведёт конверт кратчайшим путём. */
export const routeTable = (
  doc: NetDoc,
  state: NetState,
  id: DeviceId,
): ReadonlyArray<RouteRow> =>
  Option.match(findDevice(doc, id), {
    onNone: () => [],
    onSome: device =>
      device._tag === 'Host'
        ? hostRoutes(doc, state, device)
        : device._tag === 'Router'
          ? routerRoutes(doc, device)
          : device._tag === 'Transit'
            ? Array.map(device.routes, route =>
                row(
                  'transit',
                  route.network,
                  route.prefix,
                  route.maybeVia,
                  'eth0',
                ),
              )
            : [],
  })
