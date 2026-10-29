import { Array, Option, Result, Schema, pipe } from 'effect'
import { type LazyArg } from 'effect/Function'
import { defineTaggedUnion } from 'foldkit/schema'

import {
  compareIp,
  inSubnet,
  isIp,
  isMac,
  isUsableHost,
  isValidPrefix,
  networkAddress,
  networkOf,
  parseIp,
  shiftIp,
} from './address'
import { NetMessage } from './message'
import {
  type AccessPoint,
  Addressing,
  Device,
  DeviceId,
  type DhcpConfig,
  type DnsRecord,
  type Host,
  Ip,
  type Lan,
  type Link,
  type Listener,
  Mac,
  Medium,
  type NetDoc,
  Port,
  Proto,
  type Reservation,
  type Router,
  WifiConfig,
  linkIdOf,
} from './model'
import { wifiProblem } from './wifi'

// LOOKUPS

export const isHost = (device: Device): device is Host => device._tag === 'Host'

export const isRouter = (device: Device): device is Router =>
  device._tag === 'Router'

export const findDevice = (doc: NetDoc, id: DeviceId): Option.Option<Device> =>
  Array.findFirst(doc.devices, device => device.id === id)

export const findHost = (doc: NetDoc, id: DeviceId): Option.Option<Host> =>
  Option.filter(findDevice(doc, id), isHost)

export const findRouter = (doc: NetDoc, id: DeviceId): Option.Option<Router> =>
  Option.filter(findDevice(doc, id), isRouter)

export const linksOf = (doc: NetDoc, id: DeviceId): ReadonlyArray<Link> =>
  Array.filter(doc.links, link => link.a === id || link.b === id)

export const otherEnd = (link: Link, id: DeviceId): DeviceId =>
  link.a === id ? link.b : link.a

export const linkBetween = (
  doc: NetDoc,
  a: DeviceId,
  b: DeviceId,
): Option.Option<Link> =>
  Array.findFirst(
    doc.links,
    link => (link.a === a && link.b === b) || (link.a === b && link.b === a),
  )

export const isInternetDevice = (doc: NetDoc, id: DeviceId): boolean =>
  Option.exists(findDevice(doc, id), device => device._tag === 'Internet')

/** Связь с облаком «Интернет»: точка-точка, без ARP. Для роутера это WAN. */
export const isWan = (doc: NetDoc, link: Link): boolean =>
  isInternetDevice(doc, link.a) || isInternetDevice(doc, link.b)

export const macsOf = (device: Device): ReadonlyArray<string> =>
  Device.match(device, {
    Host: host => [host.mac],
    Switch: () => [],
    AccessPoint: () => [],
    Router: router => [router.lan.mac, router.wan.mac],
    Internet: internet => [internet.mac],
  })

/** Обход в ширину: все устройства, достижимые от `start` через `neighbors`. */
export const reach = (
  start: DeviceId,
  neighbors: (id: DeviceId) => ReadonlyArray<DeviceId>,
): ReadonlyArray<DeviceId> => {
  const visit = (
    visited: ReadonlyArray<DeviceId>,
    queue: ReadonlyArray<DeviceId>,
  ): ReadonlyArray<DeviceId> =>
    Array.match(queue, {
      onEmpty: () => visited,
      onNonEmpty: ([head, ...rest]) => {
        const fresh = pipe(
          neighbors(head),
          Array.filter(id => !Array.contains(visited, id)),
          Array.dedupe,
        )
        return visit([...visited, ...fresh], [...rest, ...fresh])
      },
    })
  return visit([start], [start])
}

/** Кабели и радио без учёта состояния, кроме связей с облаком: по ним доска
    ищет петли второго уровня. */
const physicalReach = (doc: NetDoc, start: DeviceId): ReadonlyArray<DeviceId> =>
  reach(start, id =>
    isInternetDevice(doc, id)
      ? []
      : pipe(
          linksOf(doc, id),
          Array.filter(link => !isWan(doc, link)),
          Array.map(link => otherEnd(link, id)),
        ),
  )

// OPERATIONS

export const NetOp = defineTaggedUnion({
  AddDevice: { device: Device },
  RemoveDevice: { id: DeviceId },
  MoveDevice: { id: DeviceId, x: Schema.Number, y: Schema.Number },
  Connect: { a: DeviceId, b: DeviceId, medium: Medium },
  Disconnect: { a: DeviceId, b: DeviceId },
  SetLinkUp: { a: DeviceId, b: DeviceId, up: Schema.Boolean },
  SetAddressing: { device: DeviceId, addressing: Addressing },
  JoinWifi: { device: DeviceId, ssid: Schema.String, password: Schema.String },
  ForgetWifi: { device: DeviceId },
  ConfigureWifi: { device: DeviceId, maybeWifi: Schema.Option(WifiConfig) },
  SetLan: { router: DeviceId, ip: Ip, prefix: Schema.Number },
  SetDhcpEnabled: { router: DeviceId, enabled: Schema.Boolean },
  SetDhcpPool: { router: DeviceId, start: Ip, end: Ip },
  ReserveAddress: { router: DeviceId, mac: Mac, ip: Ip },
  RemoveReservation: { router: DeviceId, mac: Mac },
  Listen: { device: DeviceId, proto: Proto, bind: Ip, port: Port },
  StopListening: { device: DeviceId, proto: Proto, port: Port },
  SetDnsRecord: { device: DeviceId, name: Schema.String, ip: Ip },
})
export type NetOp = typeof NetOp.Type

export type NetResult = Result.Result<NetDoc, NetMessage>

// VALIDATION

type Problem = Option.Option<NetMessage>

const ok: Problem = Option.none()

const firstProblem = (...checks: ReadonlyArray<LazyArg<Problem>>): Problem =>
  Array.reduce(checks, ok, (found, check) => Option.orElse(found, check))

const eachProblem = <A>(
  items: ReadonlyArray<A>,
  check: (item: A) => Problem,
): Problem =>
  Array.reduce(items, ok, (found, item) =>
    Option.orElse(found, () => check(item)),
  )

const when = (condition: boolean, message: LazyArg<NetMessage>): Problem =>
  condition ? Option.some(message()) : ok

const ipProblem = (value: string): Problem =>
  when(!isIp(value), () => NetMessage.InvalidIp({ value }))

const optionalIpProblem = (maybeIp: Option.Option<string>): Problem =>
  Option.flatMap(maybeIp, ipProblem)

const prefixProblem = (value: number, min: number, max: number): Problem =>
  when(!isValidPrefix(value) || value < min || value > max, () =>
    NetMessage.InvalidPrefix({ value }),
  )

const usableProblem = (ip: string, prefix: number): Problem =>
  when(!isUsableHost(ip, prefix), () =>
    NetMessage.AddressNotUsable({ ip, prefix }),
  )

const portProblem = (value: number): Problem =>
  when(!globalThis.Number.isInteger(value) || value < 1 || value > 65535, () =>
    NetMessage.InvalidPort({ value }),
  )

const macProblem = (doc: NetDoc, self: DeviceId, mac: string): Problem =>
  isMac(mac)
    ? pipe(
        doc.devices,
        Array.findFirst(
          device => device.id !== self && Array.contains(macsOf(device), mac),
        ),
        Option.map(owner => NetMessage.DuplicateMac({ mac, owner: owner.id })),
      )
    : Option.some(NetMessage.InvalidMac({ value: mac }))

const addressingProblem = (addressing: Addressing): Problem =>
  Addressing.match(addressing, {
    Static: ({ ip, prefix, maybeGateway, maybeDns }) =>
      firstProblem(
        () => ipProblem(ip),
        () => prefixProblem(prefix, 1, 32),
        () => usableProblem(ip, prefix),
        () => optionalIpProblem(maybeGateway),
        () =>
          Option.flatMap(maybeGateway, gateway =>
            when(!inSubnet(gateway, ip, prefix), () =>
              NetMessage.GatewayOutsideSubnet({ gateway, ip, prefix }),
            ),
          ),
        () => optionalIpProblem(maybeDns),
      ),
    Dhcp: () => ok,
    Unset: () => ok,
  })

const listenerProblem = (listener: Listener): Problem =>
  firstProblem(
    () => ipProblem(listener.bind),
    () => portProblem(listener.port),
  )

const recordProblem = (record: DnsRecord): Problem =>
  firstProblem(
    () => when(record.name.trim() === '', () => NetMessage.EmptyName()),
    () => ipProblem(record.ip),
  )

const lanProblem = (lan: Lan): Problem =>
  firstProblem(
    () => ipProblem(lan.ip),
    () => prefixProblem(lan.prefix, 8, 30),
    () => usableProblem(lan.ip, lan.prefix),
  )

const isInLan = (lan: Lan, ip: string): boolean =>
  inSubnet(ip, lan.ip, lan.prefix) && isUsableHost(ip, lan.prefix)

const reservationProblem = (lan: Lan, reservation: Reservation): Problem =>
  firstProblem(
    () =>
      when(!isMac(reservation.mac), () =>
        NetMessage.InvalidMac({ value: reservation.mac }),
      ),
    () => ipProblem(reservation.ip),
    () =>
      when(!isInLan(lan, reservation.ip), () =>
        NetMessage.ReservationOutsideSubnet(reservation),
      ),
    () =>
      when(reservation.ip === lan.ip, () =>
        NetMessage.ReservationTaken({ ip: reservation.ip, mac: lan.mac }),
      ),
  )

const dhcpProblem = (lan: Lan, dhcp: DhcpConfig): Problem =>
  firstProblem(
    () => ipProblem(dhcp.start),
    () => ipProblem(dhcp.end),
    () => optionalIpProblem(dhcp.maybeDns),
    () =>
      when(!isInLan(lan, dhcp.start) || !isInLan(lan, dhcp.end), () =>
        NetMessage.DhcpPoolOutsideSubnet({
          start: dhcp.start,
          end: dhcp.end,
          network: networkAddress(lan.ip, lan.prefix),
          prefix: lan.prefix,
        }),
      ),
    () =>
      when(compareIp(dhcp.start, dhcp.end) > 0, () =>
        NetMessage.DhcpPoolReversed({ start: dhcp.start, end: dhcp.end }),
      ),
    () =>
      when(
        compareIp(dhcp.start, lan.ip) <= 0 && compareIp(lan.ip, dhcp.end) <= 0,
        () => NetMessage.DhcpPoolIncludesRouter({ ip: lan.ip }),
      ),
    () =>
      eachProblem(dhcp.reservations, reservation =>
        reservationProblem(lan, reservation),
      ),
  )

const deviceProblem = (doc: NetDoc, device: Device): Problem =>
  Device.match(device, {
    Host: host =>
      firstProblem(
        () => macProblem(doc, host.id, host.mac),
        () => addressingProblem(host.addressing),
        () => eachProblem(host.listeners, listenerProblem),
        () => eachProblem(host.dnsRecords, recordProblem),
      ),
    Switch: () => ok,
    AccessPoint: ap => Option.flatMap(ap.maybeWifi, wifiProblem),
    Router: router =>
      firstProblem(
        () => macProblem(doc, router.id, router.lan.mac),
        () => macProblem(doc, router.id, router.wan.mac),
        () =>
          when(router.lan.mac === router.wan.mac, () =>
            NetMessage.DuplicateMac({ mac: router.wan.mac, owner: router.id }),
          ),
        () => lanProblem(router.lan),
        () => ipProblem(router.wan.ip),
        () => dhcpProblem(router.lan, router.dhcp),
        () => Option.flatMap(router.maybeWifi, wifiProblem),
      ),
    Internet: internet =>
      firstProblem(
        () => macProblem(doc, internet.id, internet.mac),
        () =>
          when(
            Array.some(
              doc.devices,
              other => other.id !== internet.id && other._tag === 'Internet',
            ),
            () => NetMessage.OnlyOneInternet(),
          ),
      ),
  })

type Station = Readonly<{ station: Host; ap: Router | AccessPoint }>

const stationOf = (left: Device, right: Device): Option.Option<Station> =>
  left._tag === 'Host' &&
  (right._tag === 'Router' || right._tag === 'AccessPoint')
    ? Option.some({ station: left, ap: right })
    : right._tag === 'Host' &&
        (left._tag === 'Router' || left._tag === 'AccessPoint')
      ? Option.some({ station: right, ap: left })
      : Option.none()

const radioProblem = (left: Device, right: Device): Problem =>
  Option.match(stationOf(left, right), {
    onNone: () =>
      Option.some(
        NetMessage.RadioNeedsAccessPoint({ a: left.id, b: right.id }),
      ),
    onSome: ({ station }) =>
      when(Array.isReadonlyArrayEmpty(station.wifiBands), () =>
        NetMessage.NoWifiOnDevice({ device: station.id }),
      ),
  })

const internetPeerProblem = (doc: NetDoc, peer: Device): Problem =>
  peer._tag === 'Router'
    ? when(
        Array.some(linksOf(doc, peer.id), link => isWan(doc, link)),
        () => NetMessage.SecondWanLink({ router: peer.id }),
      )
    : when(peer._tag !== 'Host', () =>
        NetMessage.InternetNeedsRouter({ device: peer.id }),
      )

const cableProblem = (doc: NetDoc, left: Device, right: Device): Problem =>
  left._tag === 'Internet'
    ? internetPeerProblem(doc, right)
    : right._tag === 'Internet'
      ? internetPeerProblem(doc, left)
      : ok

const busyProblem = (doc: NetDoc, device: Device): Problem =>
  when(
    device._tag === 'Host' &&
      Array.isReadonlyArrayNonEmpty(linksOf(doc, device.id)),
    () => NetMessage.PortBusy({ device: device.id }),
  )

const connectProblem = (
  doc: NetDoc,
  left: Device,
  right: Device,
  medium: Medium,
): Problem =>
  firstProblem(
    () =>
      when(left.id === right.id, () => NetMessage.ConnectSelf({ id: left.id })),
    () =>
      when(
        Option.isSome(linkBetween(doc, left.id, right.id)) ||
          Array.some(
            doc.links,
            link => link.id === linkIdOf(left.id, right.id),
          ),
        () => NetMessage.AlreadyLinked({ a: left.id, b: right.id }),
      ),
    () =>
      medium === 'radio'
        ? radioProblem(left, right)
        : cableProblem(doc, left, right),
    () => busyProblem(doc, left),
    () => busyProblem(doc, right),
    () =>
      when(
        left._tag !== 'Internet' &&
          right._tag !== 'Internet' &&
          Array.contains(physicalReach(doc, left.id), right.id),
        () => NetMessage.LinkMakesLoop({ a: left.id, b: right.id }),
      ),
  )

// APPLY

const validated = (
  doc: NetDoc,
  device: Device,
  next: LazyArg<NetDoc>,
): NetResult =>
  Option.match(deviceProblem(doc, device), {
    onNone: () => Result.succeed(next()),
    onSome: Result.fail,
  })

const replaceDevice = (doc: NetDoc, device: Device): NetResult =>
  validated(doc, device, () => ({
    ...doc,
    devices: Array.map(doc.devices, current =>
      current.id === device.id ? device : current,
    ),
  }))

const withDevice = (
  doc: NetDoc,
  id: DeviceId,
  next: (device: Device) => NetResult,
): NetResult =>
  Option.match(findDevice(doc, id), {
    onNone: () => Result.fail(NetMessage.UnknownDevice({ id })),
    onSome: next,
  })

const withHost = (
  doc: NetDoc,
  id: DeviceId,
  next: (host: Host) => NetResult,
): NetResult =>
  withDevice(doc, id, device =>
    device._tag === 'Host'
      ? next(device)
      : Result.fail(NetMessage.NotAHost({ id })),
  )

const withRouter = (
  doc: NetDoc,
  id: DeviceId,
  next: (router: Router) => NetResult,
): NetResult =>
  withDevice(doc, id, device =>
    device._tag === 'Router'
      ? next(device)
      : Result.fail(NetMessage.NotARouter({ id })),
  )

const withLink = (
  doc: NetDoc,
  a: DeviceId,
  b: DeviceId,
  next: (link: Link) => NetResult,
): NetResult =>
  Option.match(linkBetween(doc, a, b), {
    onNone: () => Result.fail(NetMessage.UnknownLink({ a, b })),
    onSome: next,
  })

const withDhcp = (
  doc: NetDoc,
  router: Router,
  dhcp: Partial<DhcpConfig>,
): NetResult =>
  replaceDevice(doc, { ...router, dhcp: { ...router.dhcp, ...dhcp } })

// При смене сети LAN пул и резервы сдвигаются вместе с ней, как в
// настоящих роутерах: «.100–.199» остаётся «.100–.199».
const movedLan = (router: Router, ip: string, prefix: number): Router => {
  const delta =
    networkOf(
      Option.getOrElse(parseIp(ip), () => 0),
      prefix,
    ) -
    networkOf(
      Option.getOrElse(parseIp(router.lan.ip), () => 0),
      router.lan.prefix,
    )
  return {
    ...router,
    lan: { ...router.lan, ip, prefix },
    dhcp: {
      ...router.dhcp,
      start: shiftIp(router.dhcp.start, delta),
      end: shiftIp(router.dhcp.end, delta),
      reservations: Array.map(router.dhcp.reservations, reservation => ({
        ...reservation,
        ip: shiftIp(reservation.ip, delta),
      })),
    },
  }
}

export const apply = (doc: NetDoc, op: NetOp): NetResult =>
  NetOp.match(op, {
    AddDevice: ({ device }) =>
      Option.isSome(findDevice(doc, device.id))
        ? Result.fail(NetMessage.DuplicateDeviceId({ id: device.id }))
        : validated(doc, device, () => ({
            ...doc,
            devices: [...doc.devices, device],
          })),
    RemoveDevice: ({ id }) =>
      withDevice(doc, id, () =>
        Result.succeed({
          devices: Array.filter(doc.devices, device => device.id !== id),
          links: Array.filter(
            doc.links,
            link => link.a !== id && link.b !== id,
          ),
        }),
      ),
    MoveDevice: ({ id, x, y }) =>
      withDevice(doc, id, device => replaceDevice(doc, { ...device, x, y })),
    Connect: ({ a, b, medium }) =>
      withDevice(doc, a, left =>
        withDevice(doc, b, right =>
          Option.match(connectProblem(doc, left, right, medium), {
            onNone: () =>
              Result.succeed({
                ...doc,
                links: [
                  ...doc.links,
                  { id: linkIdOf(a, b), a, b, medium, up: true },
                ],
              }),
            onSome: Result.fail,
          }),
        ),
      ),
    Disconnect: ({ a, b }) =>
      withLink(doc, a, b, link =>
        Result.succeed({
          ...doc,
          links: Array.filter(doc.links, current => current.id !== link.id),
        }),
      ),
    SetLinkUp: ({ a, b, up }) =>
      withLink(doc, a, b, link =>
        Result.succeed({
          ...doc,
          links: Array.map(doc.links, current =>
            current.id === link.id ? { ...current, up } : current,
          ),
        }),
      ),
    SetAddressing: ({ device, addressing }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, { ...host, addressing }),
      ),
    JoinWifi: ({ device, ssid, password }) =>
      withHost(doc, device, host =>
        Array.isReadonlyArrayEmpty(host.wifiBands)
          ? Result.fail(NetMessage.NoWifiOnDevice({ device }))
          : replaceDevice(doc, {
              ...host,
              maybeWifiProfile: Option.some({ ssid, password }),
            }),
      ),
    ForgetWifi: ({ device }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, { ...host, maybeWifiProfile: Option.none() }),
      ),
    ConfigureWifi: ({ device, maybeWifi }) =>
      withDevice(doc, device, current =>
        current._tag === 'Router' || current._tag === 'AccessPoint'
          ? replaceDevice(doc, { ...current, maybeWifi })
          : Result.fail(NetMessage.NotAnAccessPoint({ id: device })),
      ),
    SetLan: ({ router, ip, prefix }) =>
      withRouter(doc, router, current =>
        replaceDevice(doc, movedLan(current, ip, prefix)),
      ),
    SetDhcpEnabled: ({ router, enabled }) =>
      withRouter(doc, router, current => withDhcp(doc, current, { enabled })),
    SetDhcpPool: ({ router, start, end }) =>
      withRouter(doc, router, current =>
        withDhcp(doc, current, { start, end }),
      ),
    ReserveAddress: ({ router, mac, ip }) =>
      withRouter(doc, router, current =>
        Option.match(
          Array.findFirst(
            current.dhcp.reservations,
            reservation => reservation.ip === ip && reservation.mac !== mac,
          ),
          {
            onSome: taken =>
              Result.fail(NetMessage.ReservationTaken({ ip, mac: taken.mac })),
            onNone: () =>
              withDhcp(doc, current, {
                reservations: [
                  ...Array.filter(
                    current.dhcp.reservations,
                    reservation => reservation.mac !== mac,
                  ),
                  { mac, ip },
                ],
              }),
          },
        ),
      ),
    RemoveReservation: ({ router, mac }) =>
      withRouter(doc, router, current =>
        withDhcp(doc, current, {
          reservations: Array.filter(
            current.dhcp.reservations,
            reservation => reservation.mac !== mac,
          ),
        }),
      ),
    Listen: ({ device, proto, bind, port }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, {
          ...host,
          listeners: [
            ...Array.filter(
              host.listeners,
              listener => !(listener.proto === proto && listener.port === port),
            ),
            { proto, bind, port },
          ],
        }),
      ),
    StopListening: ({ device, proto, port }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, {
          ...host,
          listeners: Array.filter(
            host.listeners,
            listener => !(listener.proto === proto && listener.port === port),
          ),
        }),
      ),
    SetDnsRecord: ({ device, name, ip }) =>
      withHost(doc, device, host => {
        const key = name.trim().toLowerCase()
        return replaceDevice(doc, {
          ...host,
          dnsRecords: [
            ...Array.filter(host.dnsRecords, record => record.name !== key),
            { name: key, ip },
          ],
        })
      }),
  })

/** Свёртка операций: отказанная операция пропускается, как на доске. */
export const foldNet = (doc: NetDoc, ops: ReadonlyArray<NetOp>): NetDoc =>
  Array.reduce(ops, doc, (current, op) =>
    Result.getOrElse(apply(current, op), () => current),
  )

/** Строгая свёртка: первый отказ останавливает её (для контента и тестов). */
export const applyAll = (doc: NetDoc, ops: ReadonlyArray<NetOp>): NetResult =>
  Array.reduce(ops, Result.succeed(doc), (current: NetResult, op) =>
    Result.flatMap(current, next => apply(next, op)),
  )
