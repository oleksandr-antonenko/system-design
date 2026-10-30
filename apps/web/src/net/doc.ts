import { Array, Option, Result, Schema, pipe } from 'effect'
import { type LazyArg } from 'effect/Function'
import { defineTaggedUnion } from 'foldkit/schema'

import {
  compareIp,
  formatIp,
  inSubnet,
  isCidr,
  isIp,
  isMac,
  isUsableHost,
  isValidPrefix,
  macFromId,
  networkAddress,
  networkOf,
  parseIp,
  shiftIp,
} from './address'
import { NetMessage } from './message'
import {
  type AccessPoint,
  Addressing,
  Cert,
  Cidr,
  ComposeFile,
  type ComposeService,
  Device,
  DeviceId,
  type DhcpConfig,
  DnsRecord,
  type DnsZone,
  DockerBridge,
  Firewall,
  type FirewallRule,
  type Host,
  Ip,
  type Lan,
  type Link,
  type Listener,
  Mac,
  Medium,
  MeshMember,
  type NetDoc,
  Port,
  PortForward,
  Proto,
  type Publish,
  RecordType,
  type Reservation,
  type Router,
  type Transit,
  TransitRoute,
  TunnelAgent,
  Upstream,
  VpnClient,
  VpnMode,
  Wall,
  WifiConfig,
  linkIdOf,
} from './model'
import { Intent } from './packet'
import { wifiProblem } from './wifi'

// LOOKUPS

export const isHost = (device: Device): device is Host => device._tag === 'Host'

export const isRouter = (device: Device): device is Router =>
  device._tag === 'Router'

export const isProvider = (device: Device): boolean =>
  device._tag === 'Internet' || device._tag === 'Transit'

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

export const isProviderDevice = (doc: NetDoc, id: DeviceId): boolean =>
  Option.exists(findDevice(doc, id), isProvider)

/** Связь точка-точка третьего уровня без ARP: к узлу провайдера (облако,
    транзит) или виртуальная связь хоста Docker с контейнером. */
export const isPointToPoint = (doc: NetDoc, link: Link): boolean =>
  link.medium === 'virtual' ||
  isProviderDevice(doc, link.a) ||
  isProviderDevice(doc, link.b)

/** WAN роутера: связь с узлом провайдера или с роутером, в LAN которого
    лежит WAN-адрес (роутер за роутером). */
export const isWanOf = (doc: NetDoc, link: Link, id: DeviceId): boolean =>
  (link.a === id || link.b === id) &&
  Option.exists(findRouter(doc, id), router =>
    Option.exists(
      findDevice(doc, otherEnd(link, id)),
      peer =>
        isProvider(peer) ||
        (peer._tag === 'Router' &&
          inSubnet(router.wan.ip, peer.lan.ip, peer.lan.prefix)),
    ),
  )

/** Связь не мостит второй уровень: точка-точка или чей-то WAN. */
export const isL3Boundary = (doc: NetDoc, link: Link): boolean =>
  isPointToPoint(doc, link) ||
  isWanOf(doc, link, link.a) ||
  isWanOf(doc, link, link.b)

export const macsOf = (device: Device): ReadonlyArray<string> =>
  Device.match(device, {
    Host: host => [host.mac],
    Switch: () => [],
    AccessPoint: () => [],
    Router: router => [router.lan.mac, router.wan.mac],
    Transit: transit => [transit.mac],
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

/** Кабели и радио без учёта состояния, кроме границ третьего уровня: по
    ним доска ищет петли второго уровня. */
const physicalReach = (doc: NetDoc, start: DeviceId): ReadonlyArray<DeviceId> =>
  reach(start, id =>
    pipe(
      linksOf(doc, id),
      Array.filter(link => !isL3Boundary(doc, link)),
      Array.map(link => otherEnd(link, id)),
    ),
  )

// OPERATIONS

export const ZoneRecord = Schema.Struct({
  zone: Schema.String,
  record: DnsRecord,
})

/** Операции документа и мира. `Send`, `Wait`, `FastForward`, `FlushDns`,
    `RunCommand` и `IssueCertificate` меняют состояние сети или зависят от
    него: их применяет `applyWorld` (`world.ts`), а `apply` оставляет
    документ без изменений. */
export const NetOp = defineTaggedUnion({
  AddDevice: { device: Device },
  RemoveDevice: { id: DeviceId },
  MoveDevice: { id: DeviceId, x: Schema.Number, y: Schema.Number },
  Connect: { a: DeviceId, b: DeviceId, medium: Medium },
  Disconnect: { a: DeviceId, b: DeviceId },
  SetLinkUp: { a: DeviceId, b: DeviceId, up: Schema.Boolean },
  AddWall: { wall: Wall },
  RemoveWall: { wall: Wall },
  SetAddressing: { device: DeviceId, addressing: Addressing },
  SetDns: { device: DeviceId, maybeServers: Schema.Option(Schema.Array(Ip)) },
  JoinWifi: { device: DeviceId, ssid: Schema.String, password: Schema.String },
  ForgetWifi: { device: DeviceId },
  ConfigureWifi: { device: DeviceId, maybeWifi: Schema.Option(WifiConfig) },
  SetLan: { router: DeviceId, ip: Ip, prefix: Schema.Number },
  SetDhcpEnabled: { router: DeviceId, enabled: Schema.Boolean },
  SetDhcpPool: { router: DeviceId, start: Ip, end: Ip },
  SetDhcpDns: { router: DeviceId, maybeDns: Schema.Option(Ip) },
  ReserveAddress: { router: DeviceId, mac: Mac, ip: Ip },
  RemoveReservation: { router: DeviceId, mac: Mac },
  AddRoute: { router: DeviceId, network: Ip, prefix: Schema.Number, via: Ip },
  RemoveRoute: { router: DeviceId, network: Ip, prefix: Schema.Number },
  SetTransitRoutes: { transit: DeviceId, routes: Schema.Array(TransitRoute) },
  SetNat: { router: DeviceId, enabled: Schema.Boolean },
  Forward: { router: DeviceId, forward: PortForward },
  Unforward: { router: DeviceId, proto: Proto, outsidePort: Port },
  Listen: { device: DeviceId, proto: Proto, bind: Ip, port: Port },
  StopListening: { device: DeviceId, proto: Proto, port: Port },
  SetRecord: { device: DeviceId, zone: Schema.String, record: DnsRecord },
  AddRecord: { device: DeviceId, zone: Schema.String, record: DnsRecord },
  RemoveRecord: {
    device: DeviceId,
    zone: Schema.String,
    name: Schema.String,
    rtype: RecordType,
  },
  SetFirewall: { device: DeviceId, firewall: Firewall },
  SetSecurityGroup: {
    device: DeviceId,
    maybeFirewall: Schema.Option(Firewall),
  },
  SetCert: { device: DeviceId, cert: Cert },
  SetRedirect: { device: DeviceId, enabled: Schema.Boolean },
  SetVpn: { device: DeviceId, maybeVpn: Schema.Option(VpnClient) },
  UpdateVpn: {
    device: DeviceId,
    maybeConnected: Schema.Option(Schema.Boolean),
    maybeMode: Schema.Option(VpnMode),
    maybeNetworks: Schema.Option(Schema.Array(Cidr)),
  },
  SetTunnel: { device: DeviceId, maybeTunnel: Schema.Option(TunnelAgent) },
  SetMesh: { device: DeviceId, maybeMesh: Schema.Option(MeshMember) },
  JoinMesh: {
    device: DeviceId,
    relay: DeviceId,
    maybeName: Schema.Option(Schema.String),
  },
  SetProxy: { device: DeviceId, maybeUpstream: Schema.Option(Upstream) },
  SetDocker: { device: DeviceId, maybeBridge: Schema.Option(DockerBridge) },
  Publish: {
    device: DeviceId,
    proto: Proto,
    bind: Ip,
    hostPort: Port,
    container: DeviceId,
    containerPort: Port,
  },
  Unpublish: { device: DeviceId, proto: Proto, hostPort: Port },
  SetCompose: { device: DeviceId, file: ComposeFile },
  ComposeUp: { device: DeviceId },
  Send: { intent: Intent },
  Wait: { seconds: Schema.Number },
  FastForward: { maybeDevice: Schema.Option(DeviceId) },
  FlushDns: { device: DeviceId },
  RunCommand: { device: DeviceId, line: Schema.String },
  IssueCertificate: { device: DeviceId, names: Schema.Array(Schema.String) },
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

const cidrProblem = (value: string): Problem =>
  when(!isCidr(value), () => NetMessage.InvalidCidr({ value }))

const optionalIpProblem = (maybeIp: Option.Option<string>): Problem =>
  Option.flatMap(maybeIp, ipProblem)

const prefixProblem = (value: number, min: number, max: number): Problem =>
  when(
    !globalThis.Number.isInteger(value) ||
      value < min ||
      value > max ||
      (min > 0 && !isValidPrefix(value)),
    () => NetMessage.InvalidPrefix({ value }),
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

const HOSTNAME =
  /^[a-z0-9*]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.?$/

const recordProblem = (zone: string, record: DnsRecord): Problem =>
  firstProblem(
    () =>
      when(record.name.trim() === '' || record.value.trim() === '', () =>
        NetMessage.EmptyName(),
      ),
    () =>
      when(record.rtype === 'A' && !isIp(record.value), () =>
        NetMessage.RecordNeedsAddress({
          rtype: record.rtype,
          value: record.value,
        }),
      ),
    () =>
      when(record.rtype === 'AAAA' && !record.value.includes(':'), () =>
        NetMessage.RecordNeedsAddress({
          rtype: record.rtype,
          value: record.value,
        }),
      ),
    () =>
      when(
        record.rtype === 'CNAME' &&
          (isIp(record.value) || !HOSTNAME.test(record.value)),
        () => NetMessage.CnameNeedsName({ value: record.value }),
      ),
    () =>
      when(record.rtype === 'CNAME' && record.name === '@', () =>
        NetMessage.CnameAtApex({ zone }),
      ),
    () =>
      when(!globalThis.Number.isInteger(record.ttl) || record.ttl < 0, () =>
        NetMessage.InvalidPort({ value: record.ttl }),
      ),
  )

const zoneProblem = (zone: DnsZone): Problem =>
  firstProblem(
    () => when(zone.name.trim() === '', () => NetMessage.EmptyName()),
    () => eachProblem(zone.records, record => recordProblem(zone.name, record)),
    () =>
      eachProblem(zone.records, record =>
        when(
          record.rtype === 'CNAME' &&
            Array.some(
              zone.records,
              other => other.name === record.name && other.rtype !== 'CNAME',
            ),
          () => NetMessage.CnameConflict({ name: record.name }),
        ),
      ),
  )

const ruleProblem = (rule: FirewallRule): Problem =>
  firstProblem(
    () => Option.flatMap(rule.maybePort, portProblem),
    () => Option.flatMap(rule.maybeFrom, cidrProblem),
  )

const firewallProblem = (firewall: Firewall): Problem =>
  eachProblem(firewall.rules, ruleProblem)

const vpnProblem = (doc: NetDoc, vpn: VpnClient): Problem =>
  firstProblem(
    () => ipProblem(vpn.address),
    () => eachProblem(vpn.networks, cidrProblem),
    () =>
      when(
        vpn.mode === 'split' && Array.isReadonlyArrayEmpty(vpn.networks),
        () => NetMessage.SplitTunnelEmpty(),
      ),
    () =>
      when(
        !Option.exists(findRouter(doc, vpn.gateway), router =>
          Option.isSome(router.maybeVpnServer),
        ),
        () => NetMessage.NotAVpnGateway({ id: vpn.gateway }),
      ),
    () => Option.flatMap(vpn.maybeDns, dns => ipProblem(dns.server)),
  )

const certProblem = (cert: Cert): Problem =>
  firstProblem(
    () =>
      when(Array.isReadonlyArrayEmpty(cert.names), () =>
        NetMessage.EmptyName(),
      ),
    () =>
      eachProblem(cert.names, name =>
        when(isIp(name), () => NetMessage.NameIsAddress({ value: name })),
      ),
  )

const hostProblem = (doc: NetDoc, host: Host): Problem =>
  firstProblem(
    () => macProblem(doc, host.id, host.mac),
    () => addressingProblem(host.addressing),
    () =>
      Option.flatMap(host.maybeDnsOverride, servers =>
        eachProblem(servers, ipProblem),
      ),
    () => eachProblem(host.listeners, listenerProblem),
    () => eachProblem(host.zones, zoneProblem),
    () => eachProblem(host.certs, certProblem),
    () => firewallProblem(host.firewall),
    () => Option.flatMap(host.maybeSecurityGroup, firewallProblem),
    () => Option.flatMap(host.maybeVpn, vpn => vpnProblem(doc, vpn)),
    () => Option.flatMap(host.maybeMesh, mesh => ipProblem(mesh.ip)),
    () =>
      Option.flatMap(host.maybeDocker, bridge =>
        firstProblem(
          () => ipProblem(bridge.ip),
          () => prefixProblem(bridge.prefix, 8, 30),
        ),
      ),
    () =>
      Option.flatMap(host.maybeCompose, file =>
        eachProblem(file.services, service =>
          eachProblem(service.ports, mapping =>
            when(Option.isNone(parseMapping(mapping)), () =>
              NetMessage.InvalidPortMapping({ value: mapping }),
            ),
          ),
        ),
      ),
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

const routerProblem = (doc: NetDoc, router: Router): Problem =>
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
    () =>
      eachProblem(router.routes, route =>
        firstProblem(
          () => ipProblem(route.network),
          () => prefixProblem(route.prefix, 0, 32),
          () => ipProblem(route.via),
          () =>
            when(!inSubnet(route.via, router.lan.ip, router.lan.prefix), () =>
              NetMessage.RouteViaOutsideLan({ via: route.via }),
            ),
        ),
      ),
    () =>
      eachProblem(router.forwards, forward =>
        firstProblem(
          () => portProblem(forward.outsidePort),
          () => portProblem(forward.insidePort),
          () => ipProblem(forward.insideIp),
          () =>
            when(!isInLan(router.lan, forward.insideIp), () =>
              NetMessage.ForwardOutsideLan({ ip: forward.insideIp }),
            ),
        ),
      ),
    () => firewallProblem(router.firewall),
    () =>
      Option.flatMap(router.maybeVpnServer, server =>
        firstProblem(
          () => ipProblem(server.network),
          () => ipProblem(server.address),
          () => prefixProblem(server.prefix, 8, 30),
          () => portProblem(server.port),
        ),
      ),
    () => eachProblem(router.zones, zoneProblem),
  )

const transitProblem = (doc: NetDoc, transit: Transit): Problem =>
  firstProblem(
    () => macProblem(doc, transit.id, transit.mac),
    () => ipProblem(transit.ip),
    () => optionalIpProblem(transit.maybeCgnat),
    () =>
      eachProblem(transit.routes, route =>
        firstProblem(
          () => ipProblem(route.network),
          () => prefixProblem(route.prefix, 0, 32),
        ),
      ),
  )

const deviceProblem = (doc: NetDoc, device: Device): Problem =>
  Device.match(device, {
    Host: host => hostProblem(doc, host),
    Switch: () => ok,
    AccessPoint: ap => Option.flatMap(ap.maybeWifi, wifiProblem),
    Router: router => routerProblem(doc, router),
    Transit: transit => transitProblem(doc, transit),
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

const cellularProblem = (left: Device, right: Device): Problem =>
  when(
    !(
      (left._tag === 'Host' &&
        (right._tag === 'Router' || right._tag === 'Transit')) ||
      (right._tag === 'Host' &&
        (left._tag === 'Router' || left._tag === 'Transit'))
    ),
    () => NetMessage.CellularNeedsOperator({ a: left.id, b: right.id }),
  )

const containerOf = (device: Device): Option.Option<DeviceId> =>
  device._tag === 'Host'
    ? Option.map(device.maybeContainer, container => container.host)
    : Option.none()

const virtualProblem = (left: Device, right: Device): Problem =>
  when(
    !(
      Option.contains(containerOf(left), right.id) ||
      Option.contains(containerOf(right), left.id)
    ),
    () => NetMessage.VirtualNeedsContainer({ a: left.id, b: right.id }),
  )

const hasWan = (doc: NetDoc, router: DeviceId): boolean =>
  Array.some(linksOf(doc, router), link => isWanOf(doc, link, router))

const providerPeerProblem = (doc: NetDoc, peer: Device): Problem =>
  peer._tag === 'Router'
    ? when(hasWan(doc, peer.id), () =>
        NetMessage.SecondWanLink({ router: peer.id }),
      )
    : when(peer._tag !== 'Host' && !isProvider(peer), () =>
        NetMessage.InternetNeedsRouter({ device: peer.id }),
      )

const cableProblem = (doc: NetDoc, left: Device, right: Device): Problem =>
  isProvider(left) && isProvider(right)
    ? ok
    : isProvider(left)
      ? providerPeerProblem(doc, right)
      : isProvider(right)
        ? providerPeerProblem(doc, left)
        : left._tag === 'Router' &&
            right._tag === 'Router' &&
            ((inSubnet(left.wan.ip, right.lan.ip, right.lan.prefix) &&
              hasWan(doc, left.id)) ||
              (inSubnet(right.wan.ip, left.lan.ip, left.lan.prefix) &&
                hasWan(doc, right.id)))
          ? Option.some(
              NetMessage.SecondWanLink({
                router: inSubnet(left.wan.ip, right.lan.ip, right.lan.prefix)
                  ? left.id
                  : right.id,
              }),
            )
          : ok

/** У хоста один разъём; виртуальные связи хоста Docker не считаются, у
    контейнера — только связь с его хостом. */
const busyProblem = (doc: NetDoc, device: Device, medium: Medium): Problem =>
  when(
    device._tag === 'Host' &&
      (Option.isSome(device.maybeContainer)
        ? Array.isReadonlyArrayNonEmpty(linksOf(doc, device.id))
        : medium !== 'virtual' &&
          Array.some(
            linksOf(doc, device.id),
            link => link.medium !== 'virtual',
          )),
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
        : medium === 'cellular'
          ? cellularProblem(left, right)
          : medium === 'virtual'
            ? virtualProblem(left, right)
            : cableProblem(doc, left, right),
    () => busyProblem(doc, left, medium),
    () => busyProblem(doc, right, medium),
    () =>
      when(
        medium !== 'virtual' &&
          !isProvider(left) &&
          !isProvider(right) &&
          Array.contains(physicalReach(doc, left.id), right.id),
        () => NetMessage.LinkMakesLoop({ a: left.id, b: right.id }),
      ),
  )

// COMPOSE

/** `8080:3000` или `127.0.0.1:8080:3000` → публикация. */
export const parseMapping = (
  value: string,
): Option.Option<Readonly<{ bind: Ip; hostPort: number; port: number }>> => {
  const parts = value
    .trim()
    .replace(/\/tcp$/, '')
    .split(':')
  const port = (text: string | undefined): Option.Option<number> =>
    text !== undefined && /^\d{1,5}$/.test(text)
      ? Option.liftPredicate(
          globalThis.Number(text),
          number => number >= 1 && number <= 65535,
        )
      : Option.none()
  const [first, second, third] = parts
  return parts.length === 2
    ? Option.map(
        Option.all([port(first), port(second)]),
        ([hostPort, inner]) => ({
          bind: '0.0.0.0',
          hostPort,
          port: inner,
        }),
      )
    : parts.length === 3 && first !== undefined && isIp(first)
      ? Option.map(
          Option.all([port(second), port(third)]),
          ([hostPort, inner]) => ({ bind: first, hostPort, port: inner }),
        )
      : Option.none()
}

/** `postgres://user:pass@db:5432/shop` → `db:5432`. */
export const parseUpstreamUrl = (
  value: string,
): Option.Option<Readonly<{ host: string; port: number }>> =>
  pipe(
    Option.fromNullishOr(
      /^[a-z]+:\/\/(?:[^@/]*@)?([^:/]+):(\d{1,5})/i.exec(value),
    ),
    Option.flatMap(([, host, port]) =>
      host === undefined || port === undefined
        ? Option.none()
        : Option.some({
            host: host.toLowerCase(),
            port: globalThis.Number(port),
          }),
    ),
  )

const nextFreeIp = (bridge: DockerBridge, taken: ReadonlyArray<Ip>): Ip =>
  pipe(
    Array.range(2, 250),
    Array.map(offset =>
      formatIp(
        networkOf(
          Option.getOrElse(parseIp(bridge.ip), () => 0),
          bridge.prefix,
        ) + offset,
      ),
    ),
    Array.findFirst(ip => ip !== bridge.ip && !Array.contains(taken, ip)),
    Option.getOrElse(() => bridge.ip),
  )

const containersOf = (doc: NetDoc, id: DeviceId): ReadonlyArray<Host> =>
  Array.filter(
    doc.devices,
    (device): device is Host =>
      device._tag === 'Host' &&
      Option.exists(device.maybeContainer, container => container.host === id),
  )

const needsOf = (
  service: ComposeService,
): Option.Option<Readonly<{ host: string; port: number }>> =>
  pipe(
    service.maybeNeedsEnv,
    Option.flatMap(key =>
      Array.findFirst(service.environment, variable => variable.key === key),
    ),
    Option.flatMap(variable => parseUpstreamUrl(variable.value)),
  )

/** Контейнер сервиса: прежний (тот же адрес и место) или новый со
    следующим свободным адресом моста. */
const serviceContainer = (
  host: Host,
  bridge: DockerBridge,
  existing: ReadonlyArray<Host>,
  taken: ReadonlyArray<Ip>,
  service: ComposeService,
  index: number,
): Host => {
  const maybeOld = Array.findFirst(existing, old => old.id === service.name)
  const ip = Option.match(maybeOld, {
    onNone: () => nextFreeIp(bridge, taken),
    onSome: old =>
      old.addressing._tag === 'Static'
        ? old.addressing.ip
        : nextFreeIp(bridge, taken),
  })
  return {
    ...emptyHostFields,
    id: service.name,
    x: Option.match(maybeOld, {
      onNone: () => host.x - 70 + 140 * index,
      onSome: old => old.x,
    }),
    y: Option.match(maybeOld, {
      onNone: () => host.y + 170,
      onSome: old => old.y,
    }),
    mac: Option.match(maybeOld, {
      onNone: () => macFromId(`${host.id}/${service.name}`),
      onSome: old => old.mac,
    }),
    addressing: Addressing.Static({
      ip,
      prefix: bridge.prefix,
      maybeGateway: Option.some(bridge.ip),
      maybeDns: Option.none(),
    }),
    listeners: [{ proto: 'tcp', bind: '0.0.0.0', port: service.port }],
    maybeContainer: Option.some({
      host: host.id,
      network: bridge.network,
      image: service.image,
      maybeNeeds: needsOf(service),
    }),
  }
}

/** Поля хоста по умолчанию: без адреса, Wi-Fi, служб и ролей. */
export const emptyHostFields: Omit<Host, 'id' | 'x' | 'y' | 'mac'> = {
  _tag: 'Host',
  kind: 'container',
  addressing: Addressing.Unset(),
  maybeDnsOverride: Option.none(),
  wifiBands: [],
  maybeWifiProfile: Option.none(),
  listeners: [],
  zones: [],
  resolver: false,
  httpsRedirect: false,
  certs: [],
  firewall: {
    enabled: false,
    defaultIn: 'drop',
    defaultOut: 'allow',
    rules: [],
  },
  maybeSecurityGroup: Option.none(),
  maybeVpn: Option.none(),
  maybeTunnel: Option.none(),
  maybeMesh: Option.none(),
  maybeRelayDomain: Option.none(),
  maybeCaIssuer: Option.none(),
  maybeProxy: Option.none(),
  maybeDocker: Option.none(),
  publishes: [],
  maybeCompose: Option.none(),
  maybeContainer: Option.none(),
}

/** `docker compose up`: контейнеры и публикации — по файлу. Контейнеры
    сервисов, которых в файле нет, остаются: compose удаляет их только с
    `--remove-orphans`. */
const composeUp = (doc: NetDoc, host: Host): NetResult =>
  Option.match(Option.all([host.maybeDocker, host.maybeCompose]), {
    onNone: () => Result.fail(NetMessage.NotADockerHost({ id: host.id })),
    onSome: ([bridge, file]) => {
      const existing = containersOf(doc, host.id)
      type Built = Readonly<{
        containers: ReadonlyArray<Host>
        taken: ReadonlyArray<Ip>
      }>
      const built = Array.reduce(
        file.services,
        {
          containers: [],
          taken: Array.flatMap(existing, old =>
            old.addressing._tag === 'Static' ? [old.addressing.ip] : [],
          ),
        },
        (current: Built, service, index): Built => {
          const container = serviceContainer(
            host,
            bridge,
            existing,
            current.taken,
            service,
            index,
          )
          return {
            containers: [...current.containers, container],
            taken:
              container.addressing._tag === 'Static'
                ? [...current.taken, container.addressing.ip]
                : current.taken,
          }
        },
      )
      const ids = Array.map(built.containers, container => container.id)
      const publishes = Array.flatMap(file.services, service =>
        Array.flatMap(service.ports, mapping =>
          Option.toArray(
            Option.map(parseMapping(mapping), (parsed): Publish => ({
              proto: 'tcp',
              bind: parsed.bind,
              hostPort: parsed.hostPort,
              container: service.name,
              containerPort: parsed.port,
            })),
          ),
        ),
      )
      const duplicate = Array.findFirst(publishes, (publish, index) =>
        Array.some(
          publishes,
          (other, otherIndex) =>
            otherIndex < index && other.hostPort === publish.hostPort,
        ),
      )
      if (Option.isSome(duplicate)) {
        return Result.fail(
          NetMessage.HostPortTaken({ port: duplicate.value.hostPort }),
        )
      }
      const kept = Array.filter(
        doc.devices,
        device => !Array.contains(ids, device.id),
      )
      const updatedHost: Host = {
        ...host,
        publishes: [
          ...Array.filter(
            host.publishes,
            publish => !Array.contains(ids, publish.container),
          ),
          ...publishes,
        ],
      }
      const devices = [
        ...Array.map(kept, device =>
          device.id === host.id ? updatedHost : device,
        ),
        ...built.containers,
      ]
      const links = [
        ...doc.links,
        ...pipe(
          built.containers,
          Array.filter(container =>
            Option.isNone(linkBetween(doc, host.id, container.id)),
          ),
          Array.map((container): Link => ({
            id: linkIdOf(host.id, container.id),
            a: host.id,
            b: container.id,
            medium: 'virtual',
            up: true,
          })),
        ),
      ]
      return Result.succeed({ ...doc, devices, links })
    },
  })

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

/** Следующий адрес mesh у координатора: `100.100.0.2`, `.3`… по порядку. */
const nextMeshIp = (doc: NetDoc, relay: DeviceId): Ip => {
  const taken = Array.flatMap(doc.devices, device =>
    device._tag === 'Host'
      ? Option.toArray(
          pipe(
            device.maybeMesh,
            Option.filter(mesh => mesh.relay === relay),
            Option.map(mesh => mesh.ip),
          ),
        )
      : [],
  )
  return pipe(
    Array.range(2, 254),
    Array.map(offset => `100.100.0.${offset}`),
    Array.findFirst(ip => !Array.contains(taken, ip)),
    Option.getOrElse(() => '100.100.0.254'),
  )
}

const sameWall = (left: Wall, right: Wall): boolean =>
  left.x1 === right.x1 &&
  left.y1 === right.y1 &&
  left.x2 === right.x2 &&
  left.y2 === right.y2

/** Запись в зону: имя относительно зоны (`myapp.example` → `@`,
    `www.myapp.example` → `www`), тип в верхнем регистре, без кавычек. */
export const normalizeRecord = (zone: string, record: DnsRecord): DnsRecord => {
  const raw = record.name.trim().toLowerCase().replace(/\.$/, '')
  const name =
    raw === zone || raw === ''
      ? '@'
      : raw.endsWith(`.${zone}`)
        ? raw.slice(0, raw.length - zone.length - 1)
        : raw
  const value = record.value.trim().replace(/^"(.*)"$/, '$1')
  return {
    ...record,
    name,
    value:
      record.rtype === 'TXT' ? value : value.toLowerCase().replace(/\.$/, ''),
  }
}

type ZoneEdit = (
  records: ReadonlyArray<DnsRecord>,
) => Result.Result<ReadonlyArray<DnsRecord>, NetMessage>

const editZone = (
  doc: NetDoc,
  device: DeviceId,
  rawZone: string,
  edit: ZoneEdit,
  create: boolean,
): NetResult => {
  const zoneName = rawZone.trim().toLowerCase().replace(/\.$/, '')
  const change = (
    zones: ReadonlyArray<DnsZone>,
  ): Result.Result<ReadonlyArray<DnsZone>, NetMessage> =>
    Option.match(
      Array.findFirst(zones, zone => zone.name === zoneName),
      {
        onNone: () =>
          create
            ? Result.map(edit([]), records => [
                ...zones,
                { name: zoneName, records },
              ])
            : Result.fail(NetMessage.UnknownZone({ zone: zoneName })),
        onSome: () =>
          Result.all(
            Array.map(zones, zone =>
              zone.name === zoneName
                ? Result.map(edit(zone.records), records => ({
                    ...zone,
                    records,
                  }))
                : Result.succeed(zone),
            ),
          ),
      },
    )
  return withDevice(doc, device, current =>
    current._tag === 'Host'
      ? Result.flatMap(change(current.zones), zones =>
          replaceDevice(doc, { ...current, zones }),
        )
      : current._tag === 'Router'
        ? Result.flatMap(change(current.zones), zones =>
            replaceDevice(doc, { ...current, zones }),
          )
        : Result.fail(NetMessage.NotAHost({ id: device })),
  )
}

const setFirewall = (
  doc: NetDoc,
  device: DeviceId,
  firewall: Firewall,
): NetResult =>
  withDevice(doc, device, current =>
    current._tag === 'Host'
      ? replaceDevice(doc, { ...current, firewall })
      : current._tag === 'Router'
        ? replaceDevice(doc, { ...current, firewall })
        : Result.fail(NetMessage.NotAHost({ id: device })),
  )

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
          ...doc,
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
    AddWall: ({ wall }) =>
      Result.succeed({ ...doc, walls: [...doc.walls, wall] }),
    RemoveWall: ({ wall }) =>
      Result.succeed({
        ...doc,
        walls: Array.filter(doc.walls, current => !sameWall(current, wall)),
      }),
    SetAddressing: ({ device, addressing }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, { ...host, addressing }),
      ),
    SetDns: ({ device, maybeServers }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, { ...host, maybeDnsOverride: maybeServers }),
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
    SetDhcpDns: ({ router, maybeDns }) =>
      withRouter(doc, router, current => withDhcp(doc, current, { maybeDns })),
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
    AddRoute: ({ router, network, prefix, via }) =>
      withRouter(doc, router, current =>
        replaceDevice(doc, {
          ...current,
          routes: [
            ...Array.filter(
              current.routes,
              route => !(route.network === network && route.prefix === prefix),
            ),
            { network: networkAddress(network, prefix), prefix, via },
          ],
        }),
      ),
    RemoveRoute: ({ router, network, prefix }) =>
      withRouter(doc, router, current =>
        replaceDevice(doc, {
          ...current,
          routes: Array.filter(
            current.routes,
            route => !(route.network === network && route.prefix === prefix),
          ),
        }),
      ),
    SetTransitRoutes: ({ transit, routes }) =>
      withDevice(doc, transit, current =>
        current._tag === 'Transit'
          ? Option.match(
              Array.findFirst(routes, route =>
                Option.exists(route.maybeVia, via =>
                  Option.isNone(linkBetween(doc, transit, via)),
                ),
              ),
              {
                onSome: route =>
                  Result.fail(
                    NetMessage.NotANeighbour({
                      device: transit,
                      via: Option.getOrElse(route.maybeVia, () => ''),
                    }),
                  ),
                onNone: () => replaceDevice(doc, { ...current, routes }),
              },
            )
          : Result.fail(NetMessage.NotATransit({ id: transit })),
      ),
    SetNat: ({ router, enabled }) =>
      withRouter(doc, router, current =>
        replaceDevice(doc, { ...current, nat: enabled }),
      ),
    Forward: ({ router, forward }) =>
      withRouter(doc, router, current =>
        Array.some(
          current.forwards,
          other =>
            other.proto === forward.proto &&
            other.outsidePort === forward.outsidePort,
        )
          ? Result.fail(
              NetMessage.ForwardPortTaken({
                proto: forward.proto,
                port: forward.outsidePort,
              }),
            )
          : replaceDevice(doc, {
              ...current,
              forwards: [...current.forwards, forward],
            }),
      ),
    Unforward: ({ router, proto, outsidePort }) =>
      withRouter(doc, router, current =>
        Array.some(
          current.forwards,
          forward =>
            forward.proto === proto && forward.outsidePort === outsidePort,
        )
          ? replaceDevice(doc, {
              ...current,
              forwards: Array.filter(
                current.forwards,
                forward =>
                  !(
                    forward.proto === proto &&
                    forward.outsidePort === outsidePort
                  ),
              ),
            })
          : Result.fail(
              NetMessage.UnknownForward({ proto, port: outsidePort }),
            ),
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
    SetRecord: ({ device, zone, record }) =>
      editZone(
        doc,
        device,
        zone,
        records => {
          const normal = normalizeRecord(zone.trim().toLowerCase(), record)
          return Result.succeed([
            ...Array.filter(
              records,
              current =>
                !(
                  current.name === normal.name && current.rtype === normal.rtype
                ),
            ),
            normal,
          ])
        },
        true,
      ),
    AddRecord: ({ device, zone, record }) =>
      editZone(
        doc,
        device,
        zone,
        records =>
          Result.succeed([
            ...records,
            normalizeRecord(zone.trim().toLowerCase(), record),
          ]),
        true,
      ),
    RemoveRecord: ({ device, zone, name, rtype }) =>
      editZone(
        doc,
        device,
        zone,
        records => {
          const normal = normalizeRecord(zone.trim().toLowerCase(), {
            name,
            rtype,
            value: '-',
            ttl: 0,
          })
          return Array.some(
            records,
            record => record.name === normal.name && record.rtype === rtype,
          )
            ? Result.succeed(
                Array.filter(
                  records,
                  record =>
                    !(record.name === normal.name && record.rtype === rtype),
                ),
              )
            : Result.fail(NetMessage.UnknownRecord({ name, rtype }))
        },
        false,
      ),
    SetFirewall: ({ device, firewall }) => setFirewall(doc, device, firewall),
    SetSecurityGroup: ({ device, maybeFirewall }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, { ...host, maybeSecurityGroup: maybeFirewall }),
      ),
    SetCert: ({ device, cert }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, {
          ...host,
          certs: [
            {
              ...cert,
              names: Array.map(cert.names, name => name.trim().toLowerCase()),
            },
          ],
        }),
      ),
    SetRedirect: ({ device, enabled }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, { ...host, httpsRedirect: enabled }),
      ),
    SetVpn: ({ device, maybeVpn }) =>
      withHost(doc, device, host => replaceDevice(doc, { ...host, maybeVpn })),
    UpdateVpn: ({ device, maybeConnected, maybeMode, maybeNetworks }) =>
      withHost(doc, device, host =>
        Option.match(host.maybeVpn, {
          onNone: () => Result.fail(NetMessage.NoVpnClient({ device })),
          onSome: vpn =>
            replaceDevice(doc, {
              ...host,
              maybeVpn: Option.some({
                ...vpn,
                connected: Option.getOrElse(
                  maybeConnected,
                  () => vpn.connected,
                ),
                mode: Option.getOrElse(maybeMode, () => vpn.mode),
                networks: Option.getOrElse(maybeNetworks, () => vpn.networks),
              }),
            }),
        }),
      ),
    SetTunnel: ({ device, maybeTunnel }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, { ...host, maybeTunnel }),
      ),
    SetMesh: ({ device, maybeMesh }) =>
      withHost(doc, device, host => replaceDevice(doc, { ...host, maybeMesh })),
    JoinMesh: ({ device, relay, maybeName }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, {
          ...host,
          maybeMesh: Option.some({
            relay,
            ip: Option.match(host.maybeMesh, {
              onSome: mesh => mesh.ip,
              onNone: () => nextMeshIp(doc, relay),
            }),
            name: Option.getOrElse(maybeName, () => host.id),
          }),
        }),
      ),
    SetProxy: ({ device, maybeUpstream }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, { ...host, maybeProxy: maybeUpstream }),
      ),
    SetDocker: ({ device, maybeBridge }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, { ...host, maybeDocker: maybeBridge }),
      ),
    Publish: ({ device, proto, bind, hostPort, container, containerPort }) =>
      withHost(doc, device, host =>
        Option.isNone(host.maybeDocker)
          ? Result.fail(NetMessage.NotADockerHost({ id: device }))
          : Array.some(
                host.publishes,
                publish =>
                  publish.proto === proto &&
                  publish.hostPort === hostPort &&
                  publish.container !== container,
              )
            ? Result.fail(NetMessage.HostPortTaken({ port: hostPort }))
            : replaceDevice(doc, {
                ...host,
                publishes: [
                  ...Array.filter(
                    host.publishes,
                    publish =>
                      !(
                        publish.proto === proto && publish.hostPort === hostPort
                      ),
                  ),
                  { proto, bind, hostPort, container, containerPort },
                ],
              }),
      ),
    Unpublish: ({ device, proto, hostPort }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, {
          ...host,
          publishes: Array.filter(
            host.publishes,
            publish =>
              !(publish.proto === proto && publish.hostPort === hostPort),
          ),
        }),
      ),
    SetCompose: ({ device, file }) =>
      withHost(doc, device, host =>
        replaceDevice(doc, { ...host, maybeCompose: Option.some(file) }),
      ),
    ComposeUp: ({ device }) =>
      withHost(doc, device, host => composeUp(doc, host)),
    Send: () => Result.succeed(doc),
    Wait: () => Result.succeed(doc),
    FastForward: () => Result.succeed(doc),
    FlushDns: () => Result.succeed(doc),
    RunCommand: () => Result.succeed(doc),
    IssueCertificate: () => Result.succeed(doc),
  })

/** Свёртка операций документа: отказанная операция пропускается, как на
    доске. Операции мира здесь ничего не меняют — их сворачивает
    `foldWorld`. */
export const foldNet = (doc: NetDoc, ops: ReadonlyArray<NetOp>): NetDoc =>
  Array.reduce(ops, doc, (current, op) =>
    Result.getOrElse(apply(current, op), () => current),
  )

/** Строгая свёртка: первый отказ останавливает её (для контента и тестов). */
export const applyAll = (doc: NetDoc, ops: ReadonlyArray<NetOp>): NetResult =>
  Array.reduce(ops, Result.succeed(doc), (current: NetResult, op) =>
    Result.flatMap(current, next => apply(next, op)),
  )
