import { Array, Option, Schema } from 'effect'
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

/** Сеть с маской: `10.0.0.0/8`. */
export const Cidr = Schema.String
export type Cidr = typeof Cidr.Type

export const Port = Schema.Number
export type Port = typeof Port.Type

export const HostKind = Schema.Literals([
  'pc',
  'phone',
  'laptop',
  'server',
  'printer',
  'bulb',
  'container',
])
export type HostKind = typeof HostKind.Type

/** Иконка устройства на доске. */
export const DeviceKind = Schema.Literals([
  'pc',
  'phone',
  'laptop',
  'server',
  'printer',
  'bulb',
  'container',
  'resolver',
  'relay',
  'switch',
  'router',
  'vpn-gateway',
  'ap',
  'transit',
  'internet',
])
export type DeviceKind = typeof DeviceKind.Type

/** `cellular` — сотовая связь телефона с оператором (как кабель, без
    пароля); `virtual` — мост Docker между хостом и контейнером. */
export const Medium = Schema.Literals(['cable', 'radio', 'cellular', 'virtual'])
export type Medium = typeof Medium.Type

export const Band = Schema.Literals(['2.4', '5'])
export type Band = typeof Band.Type

export const WifiBand = Schema.Literals(['2.4', '5', 'dual'])
export type WifiBand = typeof WifiBand.Type

export const Security = Schema.Literals(['open', 'wpa2', 'wpa3'])
export type Security = typeof Security.Type

export const Proto = Schema.Literals(['tcp', 'udp'])
export type Proto = typeof Proto.Type

export const RecordType = Schema.Literals([
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'TXT',
  'NS',
])
export type RecordType = typeof RecordType.Type

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

/** Запись зоны DNS. Имя относительно зоны: `@` — сама зона, `*` — любое
    имя на уровень ниже. TTL — секунды. */
export const DnsRecord = Schema.Struct({
  name: Schema.String,
  rtype: RecordType,
  value: Schema.String,
  ttl: Schema.Number,
})
export type DnsRecord = typeof DnsRecord.Type

export const DnsZone = Schema.Struct({
  name: Schema.String,
  records: Schema.Array(DnsRecord),
})
export type DnsZone = typeof DnsZone.Type

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

/** Статический маршрут роутера: сеть — через адрес в его LAN. */
export const StaticRoute = Schema.Struct({
  network: Ip,
  prefix: Schema.Number,
  via: Ip,
})
export type StaticRoute = typeof StaticRoute.Type

/** Строка таблицы транзитного роутера: сеть — соседу или «прямо». */
export const TransitRoute = Schema.Struct({
  network: Ip,
  prefix: Schema.Number,
  maybeVia: Schema.Option(DeviceId),
})
export type TransitRoute = typeof TransitRoute.Type

/** Проброс порта: внешний порт роутера — адресу и порту в LAN. */
export const PortForward = Schema.Struct({
  proto: Proto,
  outsidePort: Port,
  insideIp: Ip,
  insidePort: Port,
})
export type PortForward = typeof PortForward.Type

export const FirewallAction = Schema.Literals(['allow', 'drop', 'reject'])
export type FirewallAction = typeof FirewallAction.Type

export const FirewallProto = Schema.Literals(['tcp', 'udp', 'any'])
export type FirewallProto = typeof FirewallProto.Type

export const Direction = Schema.Literals(['in', 'out'])
export type Direction = typeof Direction.Type

/** Строка правил: откуда (сеть или «все»), протокол, порт, что делать. */
export const FirewallRule = Schema.Struct({
  direction: Direction,
  action: FirewallAction,
  proto: FirewallProto,
  maybePort: Schema.Option(Port),
  maybeFrom: Schema.Option(Cidr),
})
export type FirewallRule = typeof FirewallRule.Type

export const Firewall = Schema.Struct({
  enabled: Schema.Boolean,
  defaultIn: FirewallAction,
  defaultOut: FirewallAction,
  rules: Schema.Array(FirewallRule),
})
export type Firewall = typeof Firewall.Type

export const FirewallScope = Schema.Literals(['os', 'cloud', 'router'])
export type FirewallScope = typeof FirewallScope.Type

/** Сертификат сайта: имена, кто выдал и до какого дня (`YYYY-MM-DD`). */
export const Cert = Schema.Struct({
  names: Schema.Array(Schema.String),
  issuer: Schema.String,
  notAfter: Schema.String,
})
export type Cert = typeof Cert.Type

/** Раздельный DNS VPN: имена зоны — к серверу офиса. */
export const VpnDns = Schema.Struct({ zone: Schema.String, server: Ip })
export type VpnDns = typeof VpnDns.Type

export const VpnMode = Schema.Literals(['full', 'split'])
export type VpnMode = typeof VpnMode.Type

export const VpnClient = Schema.Struct({
  connected: Schema.Boolean,
  gateway: DeviceId,
  address: Ip,
  mode: VpnMode,
  networks: Schema.Array(Cidr),
  maybeDns: Schema.Option(VpnDns),
})
export type VpnClient = typeof VpnClient.Type

/** VPN-сервер роутера: сеть туннеля (`pool`), его адрес в ней и порт UDP. */
export const VpnServer = Schema.Struct({
  network: Ip,
  prefix: Schema.Number,
  address: Ip,
  port: Port,
})
export type VpnServer = typeof VpnServer.Type

/** Агент туннеля: публичное имя у ретранслятора и локальный порт. */
export const TunnelAgent = Schema.Struct({
  relay: DeviceId,
  name: Schema.String,
  port: Port,
})
export type TunnelAgent = typeof TunnelAgent.Type

/** Член mesh-сети: координатор, адрес `100.100.0.x` и короткое имя. */
export const MeshMember = Schema.Struct({
  relay: DeviceId,
  ip: Ip,
  name: Schema.String,
})
export type MeshMember = typeof MeshMember.Type

/** Зависимость приложения: без соединения с ней оно не работает. */
export const Upstream = Schema.Struct({ host: Schema.String, port: Port })
export type Upstream = typeof Upstream.Type

export const ContainerInfo = Schema.Struct({
  host: DeviceId,
  network: Schema.String,
  image: Schema.String,
  maybeNeeds: Schema.Option(Upstream),
})
export type ContainerInfo = typeof ContainerInfo.Type

/** Мост Docker: адрес хоста в сети контейнеров и имя сети. */
export const DockerBridge = Schema.Struct({
  ip: Ip,
  prefix: Schema.Number,
  network: Schema.String,
})
export type DockerBridge = typeof DockerBridge.Type

/** Публикация `-p [bind:]hostPort:containerPort`. */
export const Publish = Schema.Struct({
  proto: Proto,
  bind: Ip,
  hostPort: Port,
  container: DeviceId,
  containerPort: Port,
})
export type Publish = typeof Publish.Type

export const EnvVar = Schema.Struct({
  key: Schema.String,
  value: Schema.String,
})
export type EnvVar = typeof EnvVar.Type

/** Сервис compose: образ, порт приложения в контейнере, переменные,
    публикации `снаружи:внутри` и переменная с адресом зависимости. */
export const ComposeService = Schema.Struct({
  name: Schema.String,
  image: Schema.String,
  port: Port,
  environment: Schema.Array(EnvVar),
  ports: Schema.Array(Schema.String),
  maybeNeedsEnv: Schema.Option(Schema.String),
})
export type ComposeService = typeof ComposeService.Type

export const ComposeFile = Schema.Struct({
  services: Schema.Array(ComposeService),
})
export type ComposeFile = typeof ComposeFile.Type

// DEVICES

/** Хост — устройство с одним сетевым разъёмом: кабель, радио или сотовая
    связь (у хоста Docker ещё виртуальные связи с контейнерами). Роутер —
    LAN (встроенный коммутатор и точка доступа), DHCP, NAT и маршрут по
    умолчанию через WAN. Транзит — роутер провайдера внутри интернета. */
export const Device = defineTaggedUnion({
  Host: {
    id: DeviceId,
    x: Schema.Number,
    y: Schema.Number,
    kind: HostKind,
    mac: Mac,
    addressing: Addressing,
    maybeDnsOverride: Schema.Option(Schema.Array(Ip)),
    wifiBands: Schema.Array(Band),
    maybeWifiProfile: Schema.Option(WifiProfile),
    /** Стартовая страница браузера: открывается, когда устройство в сети. */
    maybeHomePage: Schema.Option(Schema.String),
    listeners: Schema.Array(Listener),
    zones: Schema.Array(DnsZone),
    resolver: Schema.Boolean,
    httpsRedirect: Schema.Boolean,
    certs: Schema.Array(Cert),
    firewall: Firewall,
    maybeSecurityGroup: Schema.Option(Firewall),
    maybeVpn: Schema.Option(VpnClient),
    maybeTunnel: Schema.Option(TunnelAgent),
    maybeMesh: Schema.Option(MeshMember),
    maybeRelayDomain: Schema.Option(Schema.String),
    maybeCaIssuer: Schema.Option(Schema.String),
    maybeProxy: Schema.Option(Upstream),
    maybeDocker: Schema.Option(DockerBridge),
    publishes: Schema.Array(Publish),
    maybeCompose: Schema.Option(ComposeFile),
    maybeContainer: Schema.Option(ContainerInfo),
  },
  Switch: { id: DeviceId, x: Schema.Number, y: Schema.Number },
  AccessPoint: {
    id: DeviceId,
    x: Schema.Number,
    y: Schema.Number,
    maybeWifi: Schema.Option(WifiConfig),
    onBoard: Schema.Boolean,
  },
  Router: {
    id: DeviceId,
    x: Schema.Number,
    y: Schema.Number,
    lan: Lan,
    wan: Wan,
    dhcp: DhcpConfig,
    maybeWifi: Schema.Option(WifiConfig),
    routes: Schema.Array(StaticRoute),
    nat: Schema.Boolean,
    forwards: Schema.Array(PortForward),
    firewall: Firewall,
    maybeVpnServer: Schema.Option(VpnServer),
    zones: Schema.Array(DnsZone),
  },
  Transit: {
    id: DeviceId,
    x: Schema.Number,
    y: Schema.Number,
    mac: Mac,
    ip: Ip,
    name: Schema.String,
    routes: Schema.Array(TransitRoute),
    maybeCgnat: Schema.Option(Ip),
  },
  Internet: { id: DeviceId, x: Schema.Number, y: Schema.Number, mac: Mac },
})
export type Device = typeof Device.Type
export type Host = Extract<Device, { readonly _tag: 'Host' }>
export type Router = Extract<Device, { readonly _tag: 'Router' }>
export type AccessPoint = Extract<Device, { readonly _tag: 'AccessPoint' }>
export type Transit = Extract<Device, { readonly _tag: 'Transit' }>
export type Internet = Extract<Device, { readonly _tag: 'Internet' }>
/** Узел провайдера: облако или транзитный роутер. */
export type Provider = Transit | Internet

const hostIcon = (host: Host): DeviceKind =>
  host.kind === 'server' && Option.isSome(host.maybeRelayDomain)
    ? 'relay'
    : host.kind === 'server' &&
        Array.some(
          host.listeners,
          listener => listener.proto === 'udp' && listener.port === 53,
        )
      ? 'resolver'
      : host.kind

export const kindOf = (device: Device): DeviceKind =>
  Device.match(device, {
    Host: hostIcon,
    Switch: (): DeviceKind => 'switch',
    AccessPoint: (): DeviceKind => 'ap',
    Router: (router): DeviceKind =>
      Option.isSome(router.maybeVpnServer) ? 'vpn-gateway' : 'router',
    Transit: (): DeviceKind => 'transit',
    Internet: (): DeviceKind => 'internet',
  })

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

/** Стена на плане: отрезок, который сокращает дальность Wi-Fi. */
export const Wall = Schema.Struct({
  x1: Schema.Number,
  y1: Schema.Number,
  x2: Schema.Number,
  y2: Schema.Number,
})
export type Wall = typeof Wall.Type

export const NetDoc = Schema.Struct({
  devices: Schema.Array(Device),
  links: Schema.Array(Link),
  walls: Schema.Array(Wall),
})
export type NetDoc = typeof NetDoc.Type

export const emptyNet: NetDoc = { devices: [], links: [], walls: [] }

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

/** `dynamic` — исходящее соединение, `forward` — проброс порта,
    `publish` — публикация порта Docker. `router` — устройство с таблицей
    (роутер, транзит с CGNAT или хост Docker). */
export const NatKind = Schema.Literals(['dynamic', 'forward', 'publish'])
export type NatKind = typeof NatKind.Type

export const NatEntry = Schema.Struct({
  router: DeviceId,
  kind: NatKind,
  proto: NatProto,
  inside: Ip,
  insidePort: Port,
  outside: Ip,
  outsidePort: Port,
  remote: Ip,
  remotePort: Port,
})
export type NatEntry = typeof NatEntry.Type

/** Строка памяти DNS устройства: живёт до `expiresAt` по часам сети. */
export const DnsCacheEntry = Schema.Struct({
  device: DeviceId,
  name: Schema.String,
  rtype: RecordType,
  value: Schema.String,
  expiresAt: Schema.Number,
})
export type DnsCacheEntry = typeof DnsCacheEntry.Type

/** Конечная точка клиента VPN, как её видит сервер (после NAT). */
export const VpnSession = Schema.Struct({
  server: DeviceId,
  address: Ip,
  endpoint: Ip,
  endpointPort: Port,
})
export type VpnSession = typeof VpnSession.Type

/** Открытая линия агента к ретранслятору: туннель или член mesh. */
export const RelaySession = Schema.Struct({
  relay: DeviceId,
  agent: DeviceId,
  kind: Schema.Literals(['tunnel', 'mesh']),
  key: Schema.String,
  endpoint: Ip,
  endpointPort: Port,
  agentPort: Port,
})
export type RelaySession = typeof RelaySession.Type

/** Выполненная команда терминала: что напечатано, для цели `RanCommand`. */
export const CommandRecord = Schema.Struct({
  device: DeviceId,
  line: Schema.String,
  program: Schema.String,
  maybeTarget: Schema.Option(Schema.String),
  saw: Schema.Array(Schema.String),
})
export type CommandRecord = typeof CommandRecord.Type

/** Отправленное учеником намерение и где оно оказалось: для цели
    `Performed`. */
export const PerformedRecord = Schema.Struct({
  intent: Schema.String,
  from: DeviceId,
  maybeAt: Schema.Option(DeviceId),
  delivered: Schema.Boolean,
  maybePort: Schema.Option(Port),
  devices: Schema.Array(DeviceId),
})
export type PerformedRecord = typeof PerformedRecord.Type

/** Состояние сети — не документ: это свёртка трасс и операций мира по
    порядку. Счётчики выдают эфемерные порты и порты NAT без случайности,
    часы `clock` идут только операцией «подождать». */
export const NetState = Schema.Struct({
  macTables: Schema.Array(MacEntry),
  arp: Schema.Array(ArpEntry),
  leases: Schema.Array(Lease),
  nat: Schema.Array(NatEntry),
  dnsCache: Schema.Array(DnsCacheEntry),
  vpnSessions: Schema.Array(VpnSession),
  relaySessions: Schema.Array(RelaySession),
  commandLog: Schema.Array(CommandRecord),
  performed: Schema.Array(PerformedRecord),
  nextPort: Port,
  nextNatPort: Port,
  clock: Schema.Number,
})
export type NetState = typeof NetState.Type

export const emptyState: NetState = {
  macTables: [],
  arp: [],
  leases: [],
  nat: [],
  dnsCache: [],
  vpnSessions: [],
  relaySessions: [],
  commandLog: [],
  performed: [],
  nextPort: 51514,
  nextNatPort: 40001,
  clock: 0,
}
