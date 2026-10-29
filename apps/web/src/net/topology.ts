import { Array, Option, pipe } from 'effect'

import { inSubnet } from './address'
import {
  findDevice,
  findRouter,
  isRouter,
  isWan,
  linksOf,
  otherEnd,
  reach,
} from './doc'
import { NetMessage } from './message'
import {
  type Device,
  type DeviceId,
  type Host,
  type Ip,
  type Link,
  type Mac,
  type NetDoc,
  type NetState,
  type Router,
  type WifiConfig,
} from './model'
import { type Association, associate, channelsOverlap, wifiRules } from './wifi'

// RADIO

export const wifiOf = (device: Device): Option.Option<WifiConfig> =>
  device._tag === 'Router' || device._tag === 'AccessPoint'
    ? device.maybeWifi
    : Option.none()

const distance = (left: Device, right: Device): number =>
  Math.hypot(left.x - right.x, left.y - right.y)

/** Подключение по радиосвязи; для кабеля — `none`. */
export const associationOf = (
  doc: NetDoc,
  link: Link,
): Option.Option<Association> =>
  link.medium === 'cable'
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
          associate(station, ap.id, wifiOf(ap), distance(station, ap)),
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
  Array.filter(activeLinksOf(doc, id), link => !isWan(doc, link))

export const wanLinkOf = (doc: NetDoc, id: DeviceId): Option.Option<Link> =>
  Array.findFirst(linksOf(doc, id), link => isWan(doc, link))

/** Единственная связь хоста (у хоста один разъём). */
export const hostLinkOf = (doc: NetDoc, id: DeviceId): Option.Option<Link> =>
  Array.head(linksOf(doc, id))

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

// SEGMENTS

/** Широковещательный сегмент: кого достанет broadcast от `id` по живым
    связям через коммутаторы, точки доступа и LAN роутеров. */
export const segmentOf = (doc: NetDoc, id: DeviceId): ReadonlyArray<DeviceId> =>
  reach(id, current =>
    pipe(
      activeLinksOf(doc, current),
      Array.filter(link => !isWan(doc, link)),
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

/** Адрес хоста: ручной или аренда DHCP у роутера своего сегмента. Аренда у
    чужого роутера (хост переехал) или вне его сети не считается. */
export const hostIface = (
  doc: NetDoc,
  state: NetState,
  host: Host,
): Option.Option<Iface> => {
  if (host.addressing._tag === 'Static') {
    return Option.some({
      device: host.id,
      mac: host.mac,
      ip: host.addressing.ip,
      prefix: host.addressing.prefix,
      maybeGateway: host.addressing.maybeGateway,
      maybeDns: host.addressing.maybeDns,
    })
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
        Option.map(router => leaseIface(host, router, lease.ip)),
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
        : Option.none(),
  )
