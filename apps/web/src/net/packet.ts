import { Array, Option, Schema, pipe } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { NetMessage } from './message'
import {
  Cert,
  DeviceId,
  DnsRecord,
  FirewallAction,
  FirewallScope,
  Ip,
  LinkId,
  Mac,
  NatKind,
  NatProto,
  Port,
  RecordType,
} from './model'

// INTENT

/** Четыре уровня TCP/IP: канальный, сетевой, транспортный, прикладной. */
export const StackLevel = Schema.Literals([
  'link',
  'internet',
  'transport',
  'application',
])
export type StackLevel = typeof StackLevel.Type

export const FormField = Schema.Struct({
  name: Schema.String,
  value: Schema.String,
})
export type FormField = typeof FormField.Type

/** Что делает устройство. Трасса намерения — все кадры, которые оно
    порождает, включая DHCP, ARP и DNS по дороге. `host` — адрес или имя.
    `Fetch` — открыть адрес без перехода по 301 (как `curl`).
    `Send` — один конверт без портов («фото», «документ») на адрес или на
    устройство по id. */
export const Intent = defineTaggedUnion({
  Browse: { from: DeviceId, url: Schema.String },
  Fetch: { from: DeviceId, url: Schema.String },
  Submit: {
    from: DeviceId,
    url: Schema.String,
    fields: Schema.Array(FormField),
  },
  Ping: { from: DeviceId, host: Schema.String },
  Traceroute: { from: DeviceId, host: Schema.String },
  Resolve: { from: DeviceId, name: Schema.String },
  Query: {
    from: DeviceId,
    name: Schema.String,
    rtype: RecordType,
    maybeServer: Schema.Option(Schema.String),
  },
  Connect: { from: DeviceId, host: Schema.String, port: Port },
  Send: { from: DeviceId, to: Schema.String, what: Schema.String },
  DhcpJoin: { device: DeviceId },
  Arp: { from: DeviceId, ip: Ip },
  TunnelUp: { device: DeviceId },
  MeshUp: { device: DeviceId },
  Raw: { from: DeviceId, url: Schema.String, order: Schema.Array(StackLevel) },
})
export type Intent = typeof Intent.Type

export const sourceOf = (intent: Intent): DeviceId =>
  Intent.match(intent, {
    Browse: ({ from }) => from,
    Fetch: ({ from }) => from,
    Submit: ({ from }) => from,
    Ping: ({ from }) => from,
    Traceroute: ({ from }) => from,
    Resolve: ({ from }) => from,
    Query: ({ from }) => from,
    Connect: ({ from }) => from,
    Send: ({ from }) => from,
    DhcpJoin: ({ device }) => device,
    Arp: ({ from }) => from,
    TunnelUp: ({ device }) => device,
    MeshUp: ({ device }) => device,
    Raw: ({ from }) => from,
  })

// ENVELOPE

export const TcpFlags = Schema.Literals([
  'SYN',
  'SYN-ACK',
  'ACK',
  'RST',
  'DATA',
])
export type TcpFlags = typeof TcpFlags.Type

export const ArpKind = Schema.Literals(['request', 'reply'])
export const IcmpKind = Schema.Literals([
  'echo-request',
  'echo-reply',
  'time-exceeded',
  'unreachable',
])
export type IcmpKind = typeof IcmpKind.Type
export const DhcpKind = Schema.Literals(['discover', 'offer', 'request', 'ack'])
export const DnsKind = Schema.Literals(['query', 'answer', 'nxdomain'])
export const TlsKind = Schema.Literals(['client-hello', 'server-hello', 'data'])
export const TunnelKind = Schema.Literals(['vpn', 'relay', 'mesh'])
export type TunnelKind = typeof TunnelKind.Type

/** Заголовки исходного пакета внутри ошибки ICMP: по ним ошибка проходит
    NAT обратно к отправителю. */
export const Quote = Schema.Struct({
  proto: NatProto,
  src: Ip,
  dst: Ip,
  srcPort: Port,
  dstPort: Port,
})
export type Quote = typeof Quote.Type

/** Слой конверта. Конверт хопа идёт снаружи внутрь: кадр, IP, транспорт,
    приложение. У туннеля после слоя `Tunnel` идёт внутренний IP-пакет. */
export const Layer = defineTaggedUnion({
  Ethernet: { src: Mac, dst: Mac },
  WiFi: { src: Mac, dst: Mac },
  Arp: {
    kind: ArpKind,
    senderMac: Mac,
    senderIp: Ip,
    targetMac: Mac,
    targetIp: Ip,
  },
  Ip: { src: Ip, dst: Ip, ttl: Schema.Number },
  Icmp: { kind: IcmpKind, id: Schema.Number, maybeQuote: Schema.Option(Quote) },
  Udp: { src: Port, dst: Port },
  Tcp: { src: Port, dst: Port, flags: TcpFlags },
  Dhcp: { kind: DhcpKind, clientMac: Mac, maybeIp: Schema.Option(Ip) },
  Dns: {
    kind: DnsKind,
    name: Schema.String,
    rtype: RecordType,
    records: Schema.Array(DnsRecord),
    authoritative: Schema.Boolean,
  },
  Tls: { kind: TlsKind, sni: Schema.String, maybeCert: Schema.Option(Cert) },
  Http: {
    method: Schema.Literals(['GET', 'POST']),
    host: Schema.String,
    path: Schema.String,
    maybeStatus: Schema.Option(Schema.Number),
    maybeLocation: Schema.Option(Schema.String),
    fields: Schema.Array(FormField),
  },
  Tunnel: { kind: TunnelKind },
  Payload: {
    protocol: Schema.String,
    kind: Schema.Literals(['request', 'response']),
  },
})
export type Layer = typeof Layer.Type

const levels: Readonly<Record<Layer['_tag'], StackLevel>> = {
  Ethernet: 'link',
  WiFi: 'link',
  Arp: 'link',
  Ip: 'internet',
  Icmp: 'internet',
  Udp: 'transport',
  Tcp: 'transport',
  Dhcp: 'application',
  Dns: 'application',
  Tls: 'application',
  Http: 'application',
  Tunnel: 'application',
  Payload: 'application',
}

export const levelOf = (layer: Layer): StackLevel => levels[layer._tag]

const stackOrder: ReadonlyArray<StackLevel> = [
  'link',
  'internet',
  'transport',
  'application',
]

/** Задача «Соберите конверт»: заголовки снаружи внутрь — кадр, IP,
    транспорт, приложение. Первый не на своём месте — отказ. */
export const envelopeOrderProblem = (
  order: ReadonlyArray<StackLevel>,
): Option.Option<NetMessage> =>
  pipe(
    stackOrder,
    Array.findFirstIndex(
      (expected, index) => Array.get(order, index) !== Option.some(expected),
    ),
    Option.flatMap(position =>
      Option.map(Array.get(stackOrder, position), expected =>
        NetMessage.EnvelopeMisordered({
          position: position + 1,
          expected,
          found: Option.getOrElse(Array.get(order, position), () => ''),
        }),
      ),
    ),
  )

// TABLES

/** Изменение таблицы устройства на хопе: на доске эта строка мигает. */
export const TableChange = defineTaggedUnion({
  MacLearned: {
    device: DeviceId,
    mac: Mac,
    link: LinkId,
    maybePrevious: Schema.Option(LinkId),
  },
  ArpLearned: {
    device: DeviceId,
    ip: Ip,
    mac: Mac,
    maybePrevious: Schema.Option(Mac),
  },
  LeaseGranted: { router: DeviceId, device: DeviceId, mac: Mac, ip: Ip },
  NatAdded: {
    router: DeviceId,
    kind: NatKind,
    proto: NatProto,
    inside: Ip,
    insidePort: Port,
    outside: Ip,
    outsidePort: Port,
    remote: Ip,
    remotePort: Port,
  },
  DnsCached: {
    device: DeviceId,
    name: Schema.String,
    rtype: RecordType,
    value: Schema.String,
    expiresAt: Schema.Number,
  },
  VpnSessionLearned: {
    server: DeviceId,
    address: Ip,
    endpoint: Ip,
    endpointPort: Port,
  },
  RelayOpened: {
    relay: DeviceId,
    agent: DeviceId,
    kind: Schema.Literals(['tunnel', 'mesh']),
    key: Schema.String,
  },
})
export type TableChange = typeof TableChange.Type

// TRACE

/** Строка таблицы маршрутов, по которой устройство выбрало путь. */
export const RouteMatch = Schema.Struct({
  device: DeviceId,
  kind: Schema.Literals([
    'connected',
    'static',
    'default',
    'vpn',
    'tunnel',
    'transit',
  ]),
  network: Ip,
  prefix: Schema.Number,
  maybeVia: Schema.Option(Schema.String),
})
export type RouteMatch = typeof RouteMatch.Type

/** Сработавшая строка правил файрвола: номер с 1 или умолчание. */
export const RuleMatch = Schema.Struct({
  device: DeviceId,
  scope: FirewallScope,
  maybeRule: Schema.Option(Schema.Number),
  action: FirewallAction,
})
export type RuleMatch = typeof RuleMatch.Type

/** Один кадр на одной связи. `note` — что получатель `to` с ним сделал,
    `maybeRoute` — строка маршрутов отправителя `from`, `maybeRule` —
    правило файрвола получателя. */
export const Hop = Schema.Struct({
  packet: Schema.Number,
  from: DeviceId,
  to: DeviceId,
  link: LinkId,
  envelope: Schema.Array(Layer),
  note: NetMessage,
  changes: Schema.Array(TableChange),
  maybeRoute: Schema.Option(RouteMatch),
  maybeRule: Schema.Option(RuleMatch),
  sentAt: Schema.Number,
  arrivedAt: Schema.Number,
})
export type Hop = typeof Hop.Type

/** Строка вывода traceroute: кто ответил на пробу с этим TTL. */
export const RouteLine = Schema.Struct({
  ttl: Schema.Number,
  maybeIp: Schema.Option(Ip),
  maybeDevice: Schema.Option(DeviceId),
  ms: Schema.Number,
  unreachable: Schema.Boolean,
})
export type RouteLine = typeof RouteLine.Type

export const Answer = defineTaggedUnion({
  Page: {
    url: Schema.String,
    status: Schema.Number,
    seenFrom: Ip,
    secure: Schema.Boolean,
    maybeCert: Schema.Option(Cert),
    redirects: Schema.Array(Schema.String),
    maybeProblem: Schema.Option(NetMessage),
  },
  EchoReply: { ip: Ip, ttl: Schema.Number, ms: Schema.Number },
  Route: {
    ip: Ip,
    reached: Schema.Boolean,
    lines: Schema.Array(RouteLine),
  },
  Resolved: { name: Schema.String, ip: Ip, ips: Schema.Array(Ip) },
  Records: {
    name: Schema.String,
    rtype: RecordType,
    records: Schema.Array(DnsRecord),
    server: Ip,
    authoritative: Schema.Boolean,
  },
  Connected: { ip: Ip, port: Port, seenFrom: Ip },
  Received: { ip: Ip, what: Schema.String },
  Leased: {
    ip: Ip,
    prefix: Schema.Number,
    gateway: Ip,
    maybeDns: Schema.Option(Ip),
  },
  MacFound: { ip: Ip, macs: Schema.Array(Mac) },
  TunnelOpened: { url: Schema.String },
  MeshJoined: { ip: Ip },
})
export type Answer = typeof Answer.Type

/** Итог намерения. `Dropped` — пакет погиб молча (у отправителя это
    таймаут или «нет сети»), `Refused` — получатель ответил отказом. */
export const Outcome = defineTaggedUnion({
  Delivered: { at: DeviceId, answer: Answer },
  Dropped: { at: DeviceId, reason: NetMessage },
  Refused: { at: DeviceId, reason: NetMessage },
})
export type Outcome = typeof Outcome.Type

export const Trace = Schema.Struct({
  intent: Intent,
  hops: Schema.Array(Hop),
  outcome: Outcome,
})
export type Trace = typeof Trace.Type

export const isDelivered = (trace: Trace): boolean =>
  trace.outcome._tag === 'Delivered'

/** Сколько разных пакетов в трассе: копии одного кадра при флуде — один пакет. */
export const packetCount = (trace: Trace): number =>
  Array.dedupe(Array.map(trace.hops, hop => hop.packet)).length

export const durationOf = (trace: Trace): number =>
  Array.reduce(trace.hops, 0, (latest, hop) => Math.max(latest, hop.arrivedAt))

export const sameMessage = (left: NetMessage, right: NetMessage): boolean =>
  left._tag === right._tag && JSON.stringify(left) === JSON.stringify(right)

/** Хоп, на котором погиб пакет: движок пишет причину отказа в заметку
    этого хопа. Если пакет не ушёл с устройства, такого хопа нет. */
export const failingHop = (trace: Trace): Option.Option<number> =>
  Outcome.match(trace.outcome, {
    Delivered: () => Option.none(),
    Dropped: ({ reason }) => hopWithNote(trace, reason),
    Refused: ({ reason }) => hopWithNote(trace, reason),
  })

const hopWithNote = (trace: Trace, reason: NetMessage): Option.Option<number> =>
  Array.findLastIndex(trace.hops, hop => sameMessage(hop.note, reason))

/** Устройства и связи, по которым прошла трасса, в порядке хопов. */
export const pathOf = (
  trace: Trace,
): Readonly<{
  devices: ReadonlyArray<DeviceId>
  links: ReadonlyArray<LinkId>
}> => ({
  devices: pipe(
    trace.hops,
    Array.flatMap(hop => [hop.from, hop.to]),
    Array.dedupe,
  ),
  links: Array.dedupe(Array.map(trace.hops, hop => hop.link)),
})
