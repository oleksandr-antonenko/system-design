import { Array, Option, Schema, pipe } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { NetMessage } from './message'
import { DeviceId, Ip, LinkId, Mac, NatProto, Port } from './model'

// INTENT

/** Что делает устройство. Трасса намерения — все кадры, которые оно
    порождает, включая DHCP, ARP и DNS по дороге. */
export const Intent = defineTaggedUnion({
  Browse: { from: DeviceId, url: Schema.String },
  Ping: { from: DeviceId, ip: Ip },
  Resolve: { from: DeviceId, name: Schema.String },
  DhcpJoin: { device: DeviceId },
  Arp: { from: DeviceId, ip: Ip },
})
export type Intent = typeof Intent.Type

export const sourceOf = (intent: Intent): DeviceId =>
  Intent.match(intent, {
    Browse: ({ from }) => from,
    Ping: ({ from }) => from,
    Resolve: ({ from }) => from,
    DhcpJoin: ({ device }) => device,
    Arp: ({ from }) => from,
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
export const IcmpKind = Schema.Literals(['echo-request', 'echo-reply'])
export const DhcpKind = Schema.Literals(['discover', 'offer', 'request', 'ack'])
export const DnsKind = Schema.Literals(['query', 'answer', 'nxdomain'])

/** Слой конверта. Конверт хопа идёт снаружи внутрь: кадр, IP, транспорт,
    приложение. */
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
  Icmp: { kind: IcmpKind, id: Schema.Number },
  Udp: { src: Port, dst: Port },
  Tcp: { src: Port, dst: Port, flags: TcpFlags },
  Dhcp: { kind: DhcpKind, clientMac: Mac, maybeIp: Schema.Option(Ip) },
  Dns: { kind: DnsKind, name: Schema.String, maybeIp: Schema.Option(Ip) },
  Tls: { sni: Schema.String },
  Http: {
    method: Schema.Literal('GET'),
    host: Schema.String,
    path: Schema.String,
    maybeStatus: Schema.Option(Schema.Number),
  },
})
export type Layer = typeof Layer.Type

/** Четыре уровня TCP/IP: канальный, сетевой, транспортный, прикладной. */
export const StackLevel = Schema.Literals([
  'link',
  'internet',
  'transport',
  'application',
])
export type StackLevel = typeof StackLevel.Type

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
}

export const levelOf = (layer: Layer): StackLevel => levels[layer._tag]

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
    proto: NatProto,
    inside: Ip,
    insidePort: Port,
    outside: Ip,
    outsidePort: Port,
    remote: Ip,
    remotePort: Port,
  },
  DnsCached: { device: DeviceId, name: Schema.String, ip: Ip },
})
export type TableChange = typeof TableChange.Type

// TRACE

/** Один кадр на одной связи. `note` — что получатель `to` с ним сделал. */
export const Hop = Schema.Struct({
  packet: Schema.Number,
  from: DeviceId,
  to: DeviceId,
  link: LinkId,
  envelope: Schema.Array(Layer),
  note: NetMessage,
  changes: Schema.Array(TableChange),
  sentAt: Schema.Number,
  arrivedAt: Schema.Number,
})
export type Hop = typeof Hop.Type

export const Answer = defineTaggedUnion({
  Page: { url: Schema.String, status: Schema.Number },
  EchoReply: { ip: Ip, ttl: Schema.Number, ms: Schema.Number },
  Resolved: { name: Schema.String, ip: Ip },
  Leased: {
    ip: Ip,
    prefix: Schema.Number,
    gateway: Ip,
    maybeDns: Schema.Option(Ip),
  },
  MacFound: { ip: Ip, macs: Schema.Array(Mac) },
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
