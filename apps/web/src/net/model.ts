import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

// PRIMITIVES

export const DeviceId = Schema.String
export type DeviceId = typeof DeviceId.Type

export const LinkId = Schema.String
export type LinkId = typeof LinkId.Type

export const Mac = Schema.String
export type Mac = typeof Mac.Type

export const Ip = Schema.String
export type Ip = typeof Ip.Type

export const Port = Schema.Number
export type Port = typeof Port.Type

export const HostKind = Schema.Literals(['pc', 'phone', 'laptop', 'server'])
export type HostKind = typeof HostKind.Type

export const DeviceKind = Schema.Literals([
  'pc',
  'phone',
  'laptop',
  'switch',
  'router',
  'ap',
  'server',
  'internet',
])
export type DeviceKind = typeof DeviceKind.Type

export const Medium = Schema.Literals(['cable', 'radio'])
export type Medium = typeof Medium.Type

export const Band = Schema.Literals(['2.4', '5'])
export type Band = typeof Band.Type

export const WifiBand = Schema.Literals(['2.4', '5', 'dual'])
export type WifiBand = typeof WifiBand.Type

export const Security = Schema.Literals(['open', 'wpa2', 'wpa3'])
export type Security = typeof Security.Type

export const Proto = Schema.Literals(['tcp', 'udp'])
export type Proto = typeof Proto.Type

// CONFIGURATION

/** Как хост получает адрес: вручную, по DHCP или никак. */
export const Addressing = defineTaggedUnion({
  Static: {
    ip: Ip,
    prefix: Schema.Number,
    maybeGateway: Schema.Option(Ip),
    maybeDns: Schema.Option(Ip),
  },
  Dhcp: {},
  Unset: {},
})
export type Addressing = typeof Addressing.Type

/** Программа, которая ждёт соединений: `0.0.0.0` — на всех адресах,
    `127.0.0.1` — только «сам себе». */
export const Listener = Schema.Struct({ proto: Proto, bind: Ip, port: Port })
export type Listener = typeof Listener.Type

/** Запись A статической таблицы DNS-lite. */
export const DnsRecord = Schema.Struct({ name: Schema.String, ip: Ip })
export type DnsRecord = typeof DnsRecord.Type

/** Сеть Wi-Fi, которую помнит устройство. */
export const WifiProfile = Schema.Struct({
  ssid: Schema.String,
  password: Schema.String,
})
export type WifiProfile = typeof WifiProfile.Type

/** Точка доступа: `channel` — канал 2.4 ГГц для `2.4` и `dual`, канал
    5 ГГц для `5`. */
export const WifiConfig = Schema.Struct({
  ssid: Schema.String,
  password: Schema.String,
  security: Security,
  band: WifiBand,
  channel: Schema.Number,
})
export type WifiConfig = typeof WifiConfig.Type

export const Reservation = Schema.Struct({ mac: Mac, ip: Ip })
export type Reservation = typeof Reservation.Type

export const DhcpConfig = Schema.Struct({
  enabled: Schema.Boolean,
  start: Ip,
  end: Ip,
  maybeDns: Schema.Option(Ip),
  reservations: Schema.Array(Reservation),
})
export type DhcpConfig = typeof DhcpConfig.Type

export const Lan = Schema.Struct({ mac: Mac, ip: Ip, prefix: Schema.Number })
export type Lan = typeof Lan.Type

export const Wan = Schema.Struct({ mac: Mac, ip: Ip })
export type Wan = typeof Wan.Type

// DEVICES

/** Хост — устройство с одним сетевым разъёмом: кабель или радио.
    Роутер — LAN (встроенный коммутатор и точка доступа), DHCP, скрытый NAT
    и маршрут по умолчанию в облако «Интернет» через WAN. */
export const Device = defineTaggedUnion({
  Host: {
    id: DeviceId,
    x: Schema.Number,
    y: Schema.Number,
    kind: HostKind,
    mac: Mac,
    addressing: Addressing,
    wifiBands: Schema.Array(Band),
    maybeWifiProfile: Schema.Option(WifiProfile),
    listeners: Schema.Array(Listener),
    dnsRecords: Schema.Array(DnsRecord),
  },
  Switch: { id: DeviceId, x: Schema.Number, y: Schema.Number },
  AccessPoint: {
    id: DeviceId,
    x: Schema.Number,
    y: Schema.Number,
    maybeWifi: Schema.Option(WifiConfig),
  },
  Router: {
    id: DeviceId,
    x: Schema.Number,
    y: Schema.Number,
    lan: Lan,
    wan: Wan,
    dhcp: DhcpConfig,
    maybeWifi: Schema.Option(WifiConfig),
  },
  Internet: { id: DeviceId, x: Schema.Number, y: Schema.Number, mac: Mac },
})
export type Device = typeof Device.Type
export type Host = Extract<Device, { readonly _tag: 'Host' }>
export type Router = Extract<Device, { readonly _tag: 'Router' }>
export type AccessPoint = Extract<Device, { readonly _tag: 'AccessPoint' }>
export type Internet = Extract<Device, { readonly _tag: 'Internet' }>

const infrastructureKinds: Readonly<
  Record<Exclude<Device['_tag'], 'Host'>, DeviceKind>
> = {
  Switch: 'switch',
  AccessPoint: 'ap',
  Router: 'router',
  Internet: 'internet',
}

export const kindOf = (device: Device): DeviceKind =>
  device._tag === 'Host' ? device.kind : infrastructureKinds[device._tag]

// DOCUMENT

/** Связь без направления. `up: false` — кабель выдернут из порта, но лежит
    на доске. */
export const Link = Schema.Struct({
  id: LinkId,
  a: DeviceId,
  b: DeviceId,
  medium: Medium,
  up: Schema.Boolean,
})
export type Link = typeof Link.Type

export const NetDoc = Schema.Struct({
  devices: Schema.Array(Device),
  links: Schema.Array(Link),
})
export type NetDoc = typeof NetDoc.Type

export const emptyNet: NetDoc = { devices: [], links: [] }

export const linkIdOf = (a: DeviceId, b: DeviceId): LinkId => `${a}-${b}`

// STATE

export const MacEntry = Schema.Struct({
  device: DeviceId,
  mac: Mac,
  link: LinkId,
})
export type MacEntry = typeof MacEntry.Type

export const ArpEntry = Schema.Struct({ device: DeviceId, ip: Ip, mac: Mac })
export type ArpEntry = typeof ArpEntry.Type

export const Lease = Schema.Struct({ router: DeviceId, mac: Mac, ip: Ip })
export type Lease = typeof Lease.Type

export const NatProto = Schema.Literals(['tcp', 'udp', 'icmp'])
export type NatProto = typeof NatProto.Type

export const NatEntry = Schema.Struct({
  router: DeviceId,
  proto: NatProto,
  inside: Ip,
  insidePort: Port,
  outsidePort: Port,
  remote: Ip,
  remotePort: Port,
})
export type NatEntry = typeof NatEntry.Type

export const DnsCacheEntry = Schema.Struct({
  device: DeviceId,
  name: Schema.String,
  ip: Ip,
})
export type DnsCacheEntry = typeof DnsCacheEntry.Type

/** Состояние сети — не документ: это свёртка трасс по порядку. Счётчики
    выдают эфемерные порты и порты NAT без случайности. */
export const NetState = Schema.Struct({
  macTables: Schema.Array(MacEntry),
  arp: Schema.Array(ArpEntry),
  leases: Schema.Array(Lease),
  nat: Schema.Array(NatEntry),
  dnsCache: Schema.Array(DnsCacheEntry),
  nextPort: Port,
  nextNatPort: Port,
})
export type NetState = typeof NetState.Type

export const emptyState: NetState = {
  macTables: [],
  arp: [],
  leases: [],
  nat: [],
  dnsCache: [],
  nextPort: 51514,
  nextNatPort: 40001,
}
