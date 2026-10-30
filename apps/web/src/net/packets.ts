import { Array, Match, Option, Result, pipe } from 'effect'

import {
  LOOPBACK,
  inCidr,
  inSubnet,
  isLoopback,
  isRoutable,
  isShared,
} from './address'
import {
  findDevice,
  findHost,
  findRouter,
  isPointToPoint,
  isProvider,
  isWanOf,
  otherEnd,
} from './doc'
import { judge, openerOf } from './firewall'
import { egressOf, resolveMac, sendFrame } from './frames'
import { NetMessage } from './message'
import {
  Device,
  type DeviceId,
  type Firewall,
  type FirewallScope,
  type Host,
  type Ip,
  type Link,
  type Mac,
  type NatKind,
  type NatProto,
  type NetDoc,
  type NetState,
  type Provider,
  type Router,
  type Transit,
} from './model'
import {
  Layer,
  type Quote,
  type RouteMatch,
  TableChange,
  type TunnelKind,
} from './packet'
import {
  type Run,
  type Step,
  andThen,
  dropAt,
  dropped,
  editHop,
  netRules,
  nextPacket,
  refused,
  succeed,
} from './run'
import {
  activeLinksOf,
  ethernetWanOf,
  hostIface,
  hostLinkOf,
  isLinkActive,
  lanLinksOf,
  linkFault,
  ownAddresses,
  wanLinkOf,
} from './topology'

// L3: PACKETS

export type Packet = Readonly<{
  id: number
  src: Ip
  dst: Ip
  ttl: number
  payload: ReadonlyArray<Layer>
}>

/** Пакет дошёл до устройства, которому он адресован. `maybePublished` —
    хост Docker, который пропустил его в контейнер через публикацию. */
export type Arrival = Readonly<{
  device: Device
  packet: Packet
  at: number
  maybeHop: Option.Option<number>
  maybePublished: Option.Option<DeviceId>
}>

type Ports = Readonly<{ src: number; dst: number }>

export const portsOf = (packet: Packet): Ports =>
  pipe(
    Array.head(packet.payload),
    Option.flatMap(layer =>
      Match.value(layer).pipe(
        Match.tag('Tcp', 'Udp', transport =>
          Option.some({ src: transport.src, dst: transport.dst }),
        ),
        Match.tag('Icmp', icmp => Option.some({ src: icmp.id, dst: icmp.id })),
        Match.orElse(() => Option.none<Ports>()),
      ),
    ),
    Option.getOrElse(() => ({ src: 0, dst: 0 })),
  )

const protoOf = (packet: Packet): Option.Option<NatProto> =>
  pipe(
    Array.head(packet.payload),
    Option.flatMap(layer =>
      layer._tag === 'Tcp'
        ? Option.some<NatProto>('tcp')
        : layer._tag === 'Udp'
          ? Option.some<NatProto>('udp')
          : layer._tag === 'Icmp'
            ? Option.some<NatProto>('icmp')
            : Option.none(),
    ),
  )

const arrived = (
  device: Device,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Arrival => ({
  device,
  packet,
  at,
  maybeHop,
  maybePublished: Option.none(),
})

// NAT

type NatKey = Readonly<{
  proto: NatProto
  port: number
  remotePort: number
  maybeQuote: Option.Option<Quote>
}>

// Наружу ключ NAT — порт отправителя, внутрь — порт получателя. У ICMP эхо
// роль порта играет идентификатор; ошибка ICMP несёт цитату исходного
// пакета и находит строку по ней.
const natKey = (
  payload: ReadonlyArray<Layer>,
  direction: 'out' | 'in',
): Option.Option<NatKey> =>
  pipe(
    Array.head(payload),
    Option.flatMap(layer =>
      Match.value(layer).pipe(
        Match.tag('Tcp', tcp =>
          Option.some<NatKey>({
            proto: 'tcp',
            port: direction === 'out' ? tcp.src : tcp.dst,
            remotePort: direction === 'out' ? tcp.dst : tcp.src,
            maybeQuote: Option.none(),
          }),
        ),
        Match.tag('Udp', udp =>
          Option.some<NatKey>({
            proto: 'udp',
            port: direction === 'out' ? udp.src : udp.dst,
            remotePort: direction === 'out' ? udp.dst : udp.src,
            maybeQuote: Option.none(),
          }),
        ),
        Match.tag('Icmp', icmp =>
          Option.some<NatKey>(
            Option.match(icmp.maybeQuote, {
              onNone: () => ({
                proto: 'icmp',
                port: icmp.id,
                remotePort: 0,
                maybeQuote: Option.none(),
              }),
              onSome: quote => ({
                proto: quote.proto,
                port: quote.srcPort,
                remotePort: quote.dstPort,
                maybeQuote: Option.some(quote),
              }),
            }),
          ),
        ),
        Match.orElse(() => Option.none<NatKey>()),
      ),
    ),
  )

const withPort = (
  payload: ReadonlyArray<Layer>,
  side: 'src' | 'dst',
  port: number,
): ReadonlyArray<Layer> =>
  Array.map(payload, (layer, index): Layer =>
    index > 0
      ? layer
      : Match.value(layer).pipe(
          Match.tag('Tcp', tcp =>
            side === 'src' ? { ...tcp, src: port } : { ...tcp, dst: port },
          ),
          Match.tag('Udp', udp =>
            side === 'src' ? { ...udp, src: port } : { ...udp, dst: port },
          ),
          Match.tag('Icmp', icmp =>
            Option.isSome(icmp.maybeQuote) ? icmp : { ...icmp, id: port },
          ),
          Match.orElse(() => layer),
        ),
  )

// Ошибка ICMP, вернувшаяся через NAT: в цитате снова внутренний адрес.
const withQuoteSource = (
  payload: ReadonlyArray<Layer>,
  src: Ip,
  port: number,
): ReadonlyArray<Layer> =>
  Array.map(payload, (layer): Layer =>
    layer._tag === 'Icmp'
      ? {
          ...layer,
          maybeQuote: Option.map(layer.maybeQuote, quote => ({
            ...quote,
            src,
            srcPort: port,
          })),
        }
      : layer,
  )

type Translated = Readonly<{
  state: NetState
  packet: Packet
  changes: ReadonlyArray<TableChange>
}>

/** Исходящий NAT: адрес `outside` и порт из счётчика, строка в таблице
    устройства. Тот же поток получает ту же строку. */
const natOut = (
  state: NetState,
  device: DeviceId,
  outside: Ip,
  packet: Packet,
  kind: NatKind = 'dynamic',
): Translated =>
  Option.match(natKey(packet.payload, 'out'), {
    onNone: () => ({ state, packet, changes: [] }),
    onSome: key => {
      if (Option.isSome(key.maybeQuote)) {
        return {
          state,
          packet: { ...packet, src: outside },
          changes: [],
        }
      }
      const maybeEntry = Array.findFirst(
        state.nat,
        entry =>
          entry.router === device &&
          entry.proto === key.proto &&
          entry.inside === packet.src &&
          entry.insidePort === key.port &&
          entry.remote === packet.dst &&
          entry.remotePort === key.remotePort,
      )
      const outsidePort = Option.match(maybeEntry, {
        onNone: () => state.nextNatPort,
        onSome: entry => entry.outsidePort,
      })
      const translated: Packet = {
        ...packet,
        src: Option.match(maybeEntry, {
          onNone: () => outside,
          onSome: entry => entry.outside,
        }),
        payload: withPort(packet.payload, 'src', outsidePort),
      }
      const entry = {
        router: device,
        kind,
        proto: key.proto,
        inside: packet.src,
        insidePort: key.port,
        outside,
        outsidePort,
        remote: packet.dst,
        remotePort: key.remotePort,
      }
      return Option.isSome(maybeEntry)
        ? { state, packet: translated, changes: [] }
        : {
            state: {
              ...state,
              nat: [...state.nat, entry],
              nextNatPort: state.nextNatPort + 1,
            },
            packet: translated,
            changes: [TableChange.NatAdded(entry)],
          }
    },
  })

/** Входящий по строке NAT: ответ на исходящее соединение или поток
    проброса. */
const natIn = (
  state: NetState,
  device: DeviceId,
  packet: Packet,
): Option.Option<Packet> =>
  Option.flatMap(natKey(packet.payload, 'in'), key =>
    pipe(
      state.nat,
      Array.findFirst(
        entry =>
          entry.router === device &&
          entry.proto === key.proto &&
          entry.outside === packet.dst &&
          entry.outsidePort === key.port &&
          entry.remotePort === key.remotePort &&
          entry.remote ===
            Option.match(key.maybeQuote, {
              onNone: () => packet.src,
              onSome: quote => quote.dst,
            }),
      ),
      Option.map(entry =>
        Option.isSome(key.maybeQuote)
          ? {
              ...packet,
              dst: entry.inside,
              payload: withQuoteSource(
                packet.payload,
                entry.inside,
                entry.insidePort,
              ),
            }
          : {
              ...packet,
              dst: entry.inside,
              payload: withPort(packet.payload, 'dst', entry.insidePort),
            },
      ),
    ),
  )

/** Ответ из-за NAT наружу по строке проброса или публикации: адрес и порт
    снова внешние. */
const reverseNat = (
  state: NetState,
  device: DeviceId,
  packet: Packet,
  dstAlias: Option.Option<Ip>,
): Option.Option<Packet> =>
  Option.flatMap(natKey(packet.payload, 'out'), key =>
    pipe(
      state.nat,
      Array.findFirst(
        entry =>
          entry.router === device &&
          entry.kind !== 'dynamic' &&
          entry.proto === key.proto &&
          entry.inside === packet.src &&
          entry.insidePort === key.port &&
          entry.remotePort === key.remotePort &&
          (entry.remote === packet.dst ||
            Option.contains(dstAlias, packet.dst)),
      ),
      Option.map(entry => ({
        ...packet,
        src: entry.outside,
        dst: entry.remote,
        payload: withPort(
          withPort(packet.payload, 'src', entry.outsidePort),
          'dst',
          entry.remotePort,
        ),
      })),
    ),
  )

/** Входящий на проброшенный или опубликованный порт: строка вида
    `forward`/`publish` и пакет с внутренним адресом. */
const dnat = (
  state: NetState,
  device: DeviceId,
  kind: NatKind,
  packet: Packet,
  inside: Ip,
  insidePort: number,
  masquerade: Option.Option<Ip>,
): Translated => {
  const ports = portsOf(packet)
  const entry = {
    router: device,
    kind,
    proto: Option.getOrElse(protoOf(packet), (): NatProto => 'tcp'),
    inside,
    insidePort,
    outside: packet.dst,
    outsidePort: ports.dst,
    remote: packet.src,
    remotePort: ports.src,
  }
  const known = Array.some(
    state.nat,
    current =>
      current.router === device &&
      current.kind === kind &&
      current.inside === inside &&
      current.insidePort === insidePort &&
      current.remote === entry.remote &&
      current.remotePort === entry.remotePort,
  )
  return {
    state: known ? state : { ...state, nat: [...state.nat, entry] },
    packet: {
      ...packet,
      src: Option.getOrElse(masquerade, () => packet.src),
      dst: inside,
      payload: withPort(packet.payload, 'dst', insidePort),
    },
    changes: known ? [] : [TableChange.NatAdded(entry)],
  }
}

// TUNNELS

/** Конверт в конверте: внешний IP и транспорт, слой туннеля, внутренний
    IP-пакет целиком. Номер пакета на доске остаётся тот же. */
export const encapsulate = (
  inner: Packet,
  src: Ip,
  dst: Ip,
  transport: Layer,
  kind: TunnelKind,
): Packet => ({
  id: inner.id,
  src,
  dst,
  ttl: netRules.ttl,
  payload: [
    transport,
    Layer.Tunnel({ kind }),
    Layer.Ip({ src: inner.src, dst: inner.dst, ttl: inner.ttl }),
    ...inner.payload,
  ],
})

export type Unwrapped = Readonly<{ kind: TunnelKind; inner: Packet }>

export const decapsulate = (packet: Packet): Option.Option<Unwrapped> =>
  pipe(
    Array.findFirstIndex(packet.payload, layer => layer._tag === 'Tunnel'),
    Option.flatMap(index =>
      Option.all([
        Array.get(packet.payload, index),
        Array.get(packet.payload, index + 1),
      ]).pipe(
        Option.flatMap(([tunnel, ip]) =>
          tunnel._tag === 'Tunnel' && ip._tag === 'Ip'
            ? Option.some({
                kind: tunnel.kind,
                inner: {
                  id: packet.id,
                  src: ip.src,
                  dst: ip.dst,
                  ttl: ip.ttl,
                  payload: Array.drop(packet.payload, index + 2),
                },
              })
            : Option.none(),
        ),
      ),
    ),
  )

export const tunnelOf = (packet: Packet): Option.Option<TunnelKind> =>
  pipe(
    Array.findFirst(packet.payload, layer => layer._tag === 'Tunnel'),
    Option.flatMap(layer =>
      layer._tag === 'Tunnel' ? Option.some(layer.kind) : Option.none(),
    ),
  )

// SENDING

/** MAC, на который шлют кадр точка-точка соседу. */
const p2pMac = (device: Device): Mac =>
  Device.match(device, {
    Host: host => host.mac,
    Switch: () => '',
    AccessPoint: () => '',
    Router: router => router.wan.mac,
    Transit: transit => transit.mac,
    Internet: internet => internet.mac,
  })

const transmit = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  ports: ReadonlyArray<Link>,
  src: Mac,
  dst: Mac,
  packet: Packet,
  at: number,
  maybeRoute: Option.Option<RouteMatch>,
): Step<Arrival> => {
  const first = run.hops.length
  const walked = sendFrame(
    doc,
    run,
    from,
    ports,
    {
      packet: packet.id,
      src,
      dst,
      payload: [
        Layer.Ip({ src: packet.src, dst: packet.dst, ttl: packet.ttl }),
        ...packet.payload,
      ],
    },
    at,
  )
  const routed = Option.match(maybeRoute, {
    onNone: () => walked.run,
    onSome: route =>
      first < walked.run.hops.length
        ? editHop(walked.run, Option.some(first), { route })
        : walked.run,
  })
  return Option.match(Array.head(walked.received), {
    onNone: () => dropped(routed, from, NetMessage.FrameLost({ device: from })),
    onSome: reception =>
      forward(
        doc,
        routed,
        reception.device,
        Option.some(reception.link),
        packet,
        reception.at,
        Option.some(reception.hop),
      ),
  })
}

/** Точка-точка: кадр соседу по связи, без ARP. */
const transmitP2P = (
  doc: NetDoc,
  run: Run,
  from: Device,
  link: Link,
  packet: Packet,
  at: number,
  maybeRoute: Option.Option<RouteMatch>,
): Step<Arrival> =>
  Option.match(findDevice(doc, otherEnd(link, from.id)), {
    onNone: () =>
      dropped(run, from.id, NetMessage.FrameLost({ device: from.id })),
    onSome: peer =>
      transmit(
        doc,
        run,
        from.id,
        [link],
        p2pMac(from),
        p2pMac(peer),
        packet,
        at,
        maybeRoute,
      ),
  })

const route = (
  device: DeviceId,
  kind: RouteMatch['kind'],
  network: Ip,
  prefix: number,
  maybeVia: Option.Option<string>,
): Option.Option<RouteMatch> =>
  Option.some({ device, kind, network, prefix, maybeVia })

// FIREWALL

type Guard = Readonly<{
  firewall: Firewall
  scope: FirewallScope
}>

/** Проверка входящего, открывающего соединение: правило пишется в хоп,
    drop — молчаливая гибель, reject — быстрый отказ. */
const guard = (
  run: Run,
  device: DeviceId,
  guards: ReadonlyArray<Guard>,
  packet: Packet,
  maybeHop: Option.Option<number>,
  next: (run: Run) => Step<Arrival>,
): Step<Arrival> =>
  Option.match(openerOf(packet.payload), {
    onNone: () => next(run),
    onSome: opener =>
      Array.reduceRight(
        guards,
        (current: Run): Step<Arrival> => next(current),
        (rest, { firewall, scope }) =>
          (current: Run): Step<Arrival> =>
            Option.match(judge(firewall, 'in', opener, packet.src), {
              onNone: () => rest(current),
              onSome: verdict => {
                const rule = {
                  device,
                  scope,
                  maybeRule: verdict.maybeRule,
                  action: verdict.action,
                }
                const message = {
                  device,
                  scope,
                  maybeRule: verdict.maybeRule,
                }
                return verdict.action === 'allow'
                  ? rest(
                      editHop(current, maybeHop, {
                        rule,
                        note: NetMessage.FirewallAllowed(message),
                      }),
                    )
                  : verdict.action === 'drop'
                    ? dropAt(
                        editHop(current, maybeHop, { rule }),
                        device,
                        maybeHop,
                        NetMessage.FirewallDropped(message),
                      )
                    : refused(
                        editHop(current, maybeHop, {
                          rule,
                          note: NetMessage.FirewallRejected(message),
                        }),
                        device,
                        NetMessage.FirewallRejected(message),
                      )
              },
            }),
      )(run),
  })

// ICMP

/** Истёк TTL: устройство отвечает отправителю ICMP Time Exceeded со своего
    адреса (облако молчит) и выбрасывает пакет. */
const timeExceeded = (
  doc: NetDoc,
  run: Run,
  device: Device,
  from: Option.Option<Ip>,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Step<Arrival> => {
  const reason = NetMessage.TtlExpired({ device: device.id })
  const noted = editHop(run, maybeHop, { note: reason })
  const isError = Array.some(
    packet.payload,
    layer => layer._tag === 'Icmp' && Option.isSome(layer.maybeQuote),
  )
  return Option.match(isError ? Option.none() : from, {
    onNone: () => dropped(noted, device.id, reason),
    onSome: src => {
      const key = natKey(packet.payload, 'out')
      const quote: Quote = {
        proto: Option.match(key, {
          onNone: (): NatProto => 'icmp',
          onSome: found => found.proto,
        }),
        src: packet.src,
        dst: packet.dst,
        srcPort: Option.match(key, {
          onNone: () => 0,
          onSome: found => found.port,
        }),
        dstPort: Option.match(key, {
          onNone: () => 0,
          onSome: found => found.remotePort,
        }),
      }
      const errored = send(
        doc,
        noted,
        device,
        src,
        packet.src,
        [
          Layer.Icmp({
            kind: 'time-exceeded',
            id: quote.srcPort,
            maybeQuote: Option.some(quote),
          }),
        ],
        at,
      )
      return dropped(errored.run, device.id, reason)
    },
  })
}

// HOSTS

/** Кто отправил пакет с этим адресом: для причины «шлюз — не роутер». */
const senderOf = (
  doc: NetDoc,
  state: NetState,
  ip: Ip,
): Option.Option<DeviceId> =>
  pipe(
    doc.devices,
    Array.findFirst(
      device =>
        device._tag === 'Host' &&
        Array.contains(ownAddresses(doc, state, device), ip),
    ),
    Option.map(device => device.id),
  )

const containerOwning = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  ip: Ip,
): Option.Option<Readonly<{ container: Host; link: Link }>> =>
  pipe(
    activeLinksOf(doc, host.id),
    Array.filter(link => link.medium === 'virtual'),
    Array.findFirst(link =>
      Option.exists(findHost(doc, otherEnd(link, host.id)), container =>
        Option.exists(
          hostIface(doc, state, container),
          iface => iface.ip === ip,
        ),
      ),
    ),
    Option.flatMap(link =>
      Option.map(findHost(doc, otherEnd(link, host.id)), container => ({
        container,
        link,
      })),
    ),
  )

const inBridge = (host: Host, ip: Ip): boolean =>
  Option.exists(host.maybeDocker, bridge =>
    inSubnet(ip, bridge.ip, bridge.prefix),
  )

/** Публикация Docker для входящего на порт хоста: адрес и порт контейнера. */
const publishFor = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  packet: Packet,
): Option.Option<
  Readonly<{ container: Host; link: Link; ip: Ip; port: number }>
> =>
  Option.flatMap(protoOf(packet), proto =>
    pipe(
      host.publishes,
      Array.findFirst(
        publish =>
          publish.proto === proto &&
          publish.hostPort === portsOf(packet).dst &&
          (publish.bind === '0.0.0.0' ||
            publish.bind === packet.dst ||
            (isLoopback(publish.bind) && isLoopback(packet.dst))),
      ),
      Option.flatMap(publish =>
        pipe(
          findHost(doc, publish.container),
          Option.flatMap(container =>
            Option.all([
              hostIface(doc, state, container),
              Option.flatMap(
                Array.findFirst(
                  activeLinksOf(doc, host.id),
                  link => otherEnd(link, host.id) === container.id,
                ),
                link => Option.some(link),
              ),
            ]).pipe(
              Option.map(([iface, link]) => ({
                container,
                link,
                ip: iface.ip,
                port: publish.containerPort,
              })),
            ),
          ),
        ),
      ),
    ),
  )

const toContainer = (
  doc: NetDoc,
  run: Run,
  host: Host,
  link: Link,
  packet: Packet,
  at: number,
  maybeRoute: Option.Option<RouteMatch>,
  published: boolean,
): Step<Arrival> =>
  andThen(
    transmitP2P(doc, run, host, link, packet, at, maybeRoute),
    (next, arrival) =>
      succeed(
        next,
        published
          ? { ...arrival, maybePublished: Option.some(host.id) }
          : arrival,
      ),
  )

/** Публикация: пакет уходит в контейнер с внутренним адресом; локальный
    клиент виден контейнеру как шлюз моста. */
const publishInto = (
  doc: NetDoc,
  run: Run,
  host: Host,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
  local: boolean,
): Option.Option<Step<Arrival>> =>
  Option.map(publishFor(doc, run.state, host, packet), target => {
    const masquerade = local
      ? Option.map(host.maybeDocker, bridge => bridge.ip)
      : Option.none()
    const translated = dnat(
      run.state,
      host.id,
      'publish',
      packet,
      target.ip,
      target.port,
      masquerade,
    )
    return toContainer(
      doc,
      editHop({ ...run, state: translated.state }, maybeHop, {
        note: NetMessage.PortPublished({
          device: host.id,
          port: portsOf(packet).dst,
          container: target.container.id,
        }),
        changes: translated.changes,
      }),
      host,
      target.link,
      translated.packet,
      at,
      Option.none(),
      true,
    )
  })

const vpnGatewayOf = (
  doc: NetDoc,
  host: Host,
): Option.Option<Readonly<{ router: Router; address: Ip; port: number }>> =>
  pipe(
    host.maybeVpn,
    Option.filter(vpn => vpn.connected),
    Option.flatMap(vpn =>
      pipe(
        findRouter(doc, vpn.gateway),
        Option.flatMap(router =>
          Option.map(router.maybeVpnServer, server => ({
            router,
            address: vpn.address,
            port: server.port,
          })),
        ),
      ),
    ),
  )

/** Идёт ли пакет в туннель VPN: маршруты VPN раньше подключённой сети,
    кроме адреса самого шлюза. */
export const viaVpn = (doc: NetDoc, host: Host, dst: Ip): boolean =>
  Option.exists(
    host.maybeVpn,
    vpn =>
      vpn.connected &&
      Option.exists(
        findRouter(doc, vpn.gateway),
        router => router.wan.ip !== dst,
      ) &&
      (vpn.mode === 'full' ||
        Array.some(vpn.networks, cidr => inCidr(dst, cidr))),
  )

/** Член mesh, которому принадлежит адрес, у того же координатора. */
const meshPeer = (doc: NetDoc, host: Host, dst: Ip): Option.Option<Host> =>
  Option.flatMap(host.maybeMesh, mesh =>
    Array.findFirst(
      doc.devices,
      (device): device is Host =>
        device._tag === 'Host' &&
        device.id !== host.id &&
        Option.exists(
          device.maybeMesh,
          other => other.relay === mesh.relay && other.ip === dst,
        ),
    ),
  )

/** Адрес отправителя для нового соединения: адрес mesh, туннеля VPN или
    основной. */
export const sourceAddress = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  dst: Ip,
): Option.Option<Ip> =>
  isLoopback(dst)
    ? Option.some(LOOPBACK)
    : Option.isSome(meshPeer(doc, host, dst))
      ? Option.map(host.maybeMesh, mesh => mesh.ip)
      : viaVpn(doc, host, dst)
        ? Option.map(host.maybeVpn, vpn => vpn.address)
        : Option.map(hostIface(doc, state, host), iface => iface.ip)

const relaySessionOf = (
  state: NetState,
  agent: DeviceId,
  kind: 'tunnel' | 'mesh',
) =>
  Array.findFirst(
    state.relaySessions,
    session => session.agent === agent && session.kind === kind,
  )

// Хост сам отправляет пакет: петля и свои адреса — без сети; контейнер —
// хосту Docker; хост Docker — в свой контейнер; mesh и VPN — в туннель;
// иначе своя сеть напрямую, чужая — шлюзу.
const originateFromHost = (
  doc: NetDoc,
  run: Run,
  host: Host,
  packet: Packet,
  at: number,
): Step<Arrival> => {
  const own = ownAddresses(doc, run.state, host)
  const isContainer = Option.isSome(host.maybeContainer)
  if (isLoopback(packet.dst) || Array.contains(own, packet.dst)) {
    return isContainer
      ? succeed(run, arrived(host, packet, at, Option.none()))
      : Option.getOrElse(
          publishInto(doc, run, host, packet, at, Option.none(), true),
          () => succeed(run, arrived(host, packet, at, Option.none())),
        )
  }
  return Option.match(hostLinkOf(doc, host.id), {
    onNone: () => dropped(run, host.id, NetMessage.NoLink({ device: host.id })),
    onSome: link =>
      Option.match(linkFault(doc, link, host.id), {
        onSome: fault => dropped(run, host.id, fault),
        onNone: () => {
          if (isContainer) {
            return transmitP2P(doc, run, host, link, packet, at, Option.none())
          }
          if (inBridge(host, packet.dst)) {
            return Option.match(
              containerOwning(doc, run.state, host, packet.dst),
              {
                onNone: () =>
                  dropped(
                    run,
                    host.id,
                    NetMessage.ArpNoReply({ device: host.id, ip: packet.dst }),
                  ),
                onSome: target =>
                  toContainer(
                    doc,
                    run,
                    host,
                    target.link,
                    packet,
                    at,
                    Option.none(),
                    false,
                  ),
              },
            )
          }
          const peer = meshPeer(doc, host, packet.dst)
          if (Option.isSome(peer)) {
            return meshOut(doc, run, host, packet, at)
          }
          if (viaVpn(doc, host, packet.dst)) {
            return vpnOut(doc, run, host, packet, at)
          }
          return hostEgress(doc, run, host, link, packet, at)
        },
      }),
  })
}

const hostEgress = (
  doc: NetDoc,
  run: Run,
  host: Host,
  link: Link,
  packet: Packet,
  at: number,
): Step<Arrival> => {
  if (isPointToPoint(doc, link)) {
    return transmitP2P(
      doc,
      run,
      host,
      link,
      packet,
      at,
      route(
        host.id,
        'default',
        '0.0.0.0',
        0,
        Option.some(otherEnd(link, host.id)),
      ),
    )
  }
  return Option.match(hostIface(doc, run.state, host), {
    onNone: () =>
      dropped(run, host.id, NetMessage.NoAddress({ device: host.id })),
    onSome: iface => {
      const direct = inSubnet(packet.dst, iface.ip, iface.prefix)
      const nextHop = direct ? Option.some(packet.dst) : iface.maybeGateway
      return Option.match(nextHop, {
        onNone: () =>
          dropped(
            run,
            host.id,
            NetMessage.NoGateway({ device: host.id, ip: packet.dst }),
          ),
        onSome: hop => {
          if (!direct && hop === iface.ip) {
            return dropped(
              run,
              host.id,
              NetMessage.GatewayIsSelf({ device: host.id }),
            )
          }
          const matched = direct
            ? route(host.id, 'connected', iface.ip, iface.prefix, Option.none())
            : route(host.id, 'default', '0.0.0.0', 0, Option.some(hop))
          const resolved = resolveMac(doc, run, iface, [link], hop, at)
          if (!direct && Result.isFailure(resolved.result)) {
            return dropped(
              resolved.run,
              host.id,
              NetMessage.GatewayUnreachable({ device: host.id, gateway: hop }),
            )
          }
          return andThen(resolved, (next, mac) =>
            transmit(
              doc,
              next,
              host.id,
              [link],
              host.mac,
              mac.mac,
              packet,
              mac.at,
              matched,
            ),
          )
        },
      })
    },
  })
}

const vpnOut = (
  doc: NetDoc,
  run: Run,
  host: Host,
  packet: Packet,
  at: number,
): Step<Arrival> =>
  Option.match(
    Option.all([
      vpnGatewayOf(doc, host),
      Option.map(hostIface(doc, run.state, host), iface => iface.ip),
    ]),
    {
      onNone: () =>
        dropped(run, host.id, NetMessage.NotConnected({ device: host.id })),
      onSome: ([gateway, src]) =>
        originateFromHost(
          doc,
          run,
          host,
          encapsulate(
            packet,
            src,
            gateway.router.wan.ip,
            Layer.Udp({ src: netRules.vpnPort, dst: gateway.port }),
            'vpn',
          ),
          at,
        ),
    },
  )

const meshOut = (
  doc: NetDoc,
  run: Run,
  host: Host,
  packet: Packet,
  at: number,
): Step<Arrival> =>
  Option.match(
    Option.all([
      relaySessionOf(run.state, host.id, 'mesh'),
      Option.map(hostIface(doc, run.state, host), iface => iface.ip),
      Option.flatMap(host.maybeMesh, mesh =>
        Option.flatMap(findHost(doc, mesh.relay), relay =>
          Option.map(hostIface(doc, run.state, relay), iface => iface.ip),
        ),
      ),
    ]),
    {
      onNone: () =>
        dropped(run, host.id, NetMessage.NotConnected({ device: host.id })),
      onSome: ([session, src, relayIp]) =>
        originateFromHost(
          doc,
          run,
          host,
          encapsulate(
            packet,
            src,
            relayIp,
            Layer.Udp({ src: session.agentPort, dst: netRules.meshPort }),
            'mesh',
          ),
          at,
        ),
    },
  )

/** Координатор mesh пересылает пакет вниз по линии другого члена. */
const meshRelay = (
  doc: NetDoc,
  run: Run,
  relay: Host,
  packet: Packet,
  inner: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Step<Arrival> =>
  Option.match(
    pipe(
      doc.devices,
      Array.findFirst(
        (device): device is Host =>
          device._tag === 'Host' &&
          Option.exists(
            device.maybeMesh,
            mesh => mesh.relay === relay.id && mesh.ip === inner.dst,
          ),
      ),
      Option.flatMap(member => relaySessionOf(run.state, member.id, 'mesh')),
    ),
    {
      onNone: () =>
        dropAt(
          run,
          relay.id,
          maybeHop,
          NetMessage.NotConnected({ device: relay.id }),
        ),
      onSome: session =>
        originateFromHost(
          doc,
          editHop(run, maybeHop, {
            note: NetMessage.RelayPassed({ device: relay.id }),
          }),
          relay,
          encapsulate(
            inner,
            packet.dst,
            session.endpoint,
            Layer.Udp({ src: netRules.meshPort, dst: session.endpointPort }),
            'mesh',
          ),
          at,
        ),
    },
  )

// Хост получил пакет. Из контейнера: свой — себе, в мост — контейнеру,
// иначе маскарад наружу. Себе: security group, публикация Docker, ответ по
// NAT контейнеру, туннель, файрвол ОС.
const receiveAtHost = (
  doc: NetDoc,
  run: Run,
  host: Host,
  ingress: Link,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Step<Arrival> => {
  const own = ownAddresses(doc, run.state, host)
  const fromContainer =
    ingress.medium === 'virtual' && Option.isSome(host.maybeDocker)
  if (fromContainer) {
    const alias = Option.map(host.maybeDocker, bridge => bridge.ip)
    const reversed = reverseNat(run.state, host.id, packet, alias)
    if (Option.isSome(reversed)) {
      const back = reversed.value
      return isLoopback(back.dst) || Array.contains(own, back.dst)
        ? succeed(run, arrived(host, back, at, maybeHop))
        : originateFromHost(doc, run, host, back, at)
    }
    if (Array.contains(own, packet.dst)) {
      return succeed(run, arrived(host, packet, at, maybeHop))
    }
    if (inBridge(host, packet.dst)) {
      return originateFromHost(doc, run, host, packet, at)
    }
    return Option.match(hostIface(doc, run.state, host), {
      onNone: () =>
        dropAt(
          run,
          host.id,
          maybeHop,
          NetMessage.NoAddress({ device: host.id }),
        ),
      onSome: iface => {
        const translated = natOut(run.state, host.id, iface.ip, packet)
        return originateFromHost(
          doc,
          editHop({ ...run, state: translated.state }, maybeHop, {
            note: NetMessage.PacketRouted({ device: host.id }),
            changes: translated.changes,
          }),
          host,
          translated.packet,
          at,
        )
      },
    })
  }
  if (!Array.contains(own, packet.dst) && !isLoopback(packet.dst)) {
    return dropAt(
      run,
      host.id,
      maybeHop,
      Option.match(hostIface(doc, run.state, host), {
        onNone: () => NetMessage.FrameNotForMe({ device: host.id }),
        onSome: iface =>
          NetMessage.GatewayNotARouter({
            device: Option.getOrElse(
              senderOf(doc, run.state, packet.src),
              () => host.id,
            ),
            gateway: iface.ip,
          }),
      }),
    )
  }
  const cloud: ReadonlyArray<Guard> = Option.match(host.maybeSecurityGroup, {
    onNone: () => [],
    onSome: firewall => [{ firewall, scope: 'cloud' }],
  })
  return guard(run, host.id, cloud, packet, maybeHop, guarded => {
    const published = publishInto(
      doc,
      guarded,
      host,
      packet,
      at,
      maybeHop,
      false,
    )
    if (Option.isSome(published)) {
      return published.value
    }
    const back = natIn(guarded.state, host.id, packet)
    if (Option.isSome(back) && inBridge(host, back.value.dst)) {
      return originateFromHost(
        doc,
        editHop(guarded, maybeHop, {
          note: NetMessage.PacketRouted({ device: host.id }),
        }),
        host,
        back.value,
        at,
      )
    }
    return Option.match(decapsulate(packet), {
      onSome: ({ kind, inner }) =>
        kind === 'mesh' && Option.isSome(host.maybeRelayDomain)
          ? meshRelay(doc, guarded, host, packet, inner, at, maybeHop)
          : kind === 'relay'
            ? succeed(guarded, arrived(host, packet, at, maybeHop))
            : Array.contains(own, inner.dst)
              ? succeed(
                  editHop(guarded, maybeHop, {
                    note: NetMessage.TunnelUnwrapped({ device: host.id }),
                  }),
                  arrived(host, inner, at, maybeHop),
                )
              : dropAt(
                  guarded,
                  host.id,
                  maybeHop,
                  NetMessage.FrameNotForMe({ device: host.id }),
                ),
      onNone: () =>
        isLoopback(packet.src)
          ? succeed(guarded, arrived(host, packet, at, maybeHop))
          : guard(
              guarded,
              host.id,
              [{ firewall: host.firewall, scope: 'os' }],
              packet,
              maybeHop,
              checked => succeed(checked, arrived(host, packet, at, maybeHop)),
            ),
    })
  })
}

// ROUTERS

const routeToLan = (
  doc: NetDoc,
  run: Run,
  router: Router,
  packet: Packet,
  nextHop: Ip,
  at: number,
  maybeRoute: Option.Option<RouteMatch>,
): Step<Arrival> =>
  andThen(
    resolveMac(
      doc,
      run,
      { device: router.id, mac: router.lan.mac, ip: router.lan.ip },
      lanLinksOf(doc, router.id),
      nextHop,
      at,
    ),
    (next, resolved) =>
      transmit(
        doc,
        next,
        router.id,
        egressOf(doc, next.state, router, resolved.mac),
        router.lan.mac,
        resolved.mac,
        packet,
        resolved.at,
        maybeRoute,
      ),
  )

const routeToWan = (
  doc: NetDoc,
  run: Run,
  router: Router,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Step<Arrival> => {
  const noWan = NetMessage.NoWanLink({ router: router.id })
  const fromInside =
    inSubnet(packet.src, router.lan.ip, router.lan.prefix) ||
    Option.exists(router.maybeVpnServer, server =>
      inSubnet(packet.src, server.network, server.prefix),
    )
  const translated: Translated = Option.match(
    reverseNat(run.state, router.id, packet, Option.none()),
    {
      onSome: back => ({ state: run.state, packet: back, changes: [] }),
      onNone: () =>
        router.nat && fromInside
          ? natOut(run.state, router.id, router.wan.ip, packet)
          : { state: run.state, packet, changes: [] },
    },
  )
  const noted = editHop({ ...run, state: translated.state }, maybeHop, {
    note: NetMessage.PacketRouted({ device: router.id }),
    changes: translated.changes,
  })
  return pipe(
    wanLinkOf(doc, router.id),
    Option.filter(link => isLinkActive(doc, link)),
    Option.match({
      onNone: () => dropAt(run, router.id, maybeHop, noWan),
      onSome: link =>
        Option.match(ethernetWanOf(doc, router), {
          onNone: () =>
            transmitP2P(
              doc,
              noted,
              router,
              link,
              translated.packet,
              at,
              route(
                router.id,
                'default',
                '0.0.0.0',
                0,
                Option.some(otherEnd(link, router.id)),
              ),
            ),
          onSome: wan =>
            andThen(
              resolveMac(
                doc,
                noted,
                { device: router.id, mac: router.wan.mac, ip: router.wan.ip },
                [link],
                wan.gateway,
                at,
              ),
              (next, resolved) =>
                transmit(
                  doc,
                  next,
                  router.id,
                  [link],
                  router.wan.mac,
                  resolved.mac,
                  translated.packet,
                  resolved.at,
                  route(
                    router.id,
                    'default',
                    '0.0.0.0',
                    0,
                    Option.some(wan.gateway),
                  ),
                ),
            ),
        }),
    }),
  )
}

/** Сервер VPN заворачивает пакет обратно клиенту по его конечной точке. */
const vpnBack = (
  doc: NetDoc,
  run: Run,
  router: Router,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Step<Arrival> =>
  Option.match(
    Option.all([
      router.maybeVpnServer,
      Array.findFirst(
        run.state.vpnSessions,
        session =>
          session.server === router.id && session.address === packet.dst,
      ),
    ]),
    {
      onNone: () =>
        dropAt(
          run,
          router.id,
          maybeHop,
          NetMessage.TunnelNoRoute({ gateway: router.id, ip: packet.dst }),
        ),
      onSome: ([server, session]) =>
        routeToWan(
          doc,
          run,
          router,
          encapsulate(
            packet,
            router.wan.ip,
            session.endpoint,
            Layer.Udp({ src: server.port, dst: session.endpointPort }),
            'vpn',
          ),
          at,
          maybeHop,
        ),
    },
  )

/** Сервер VPN на WAN: внешний конверт снят, конечная точка клиента
    запомнена, внутренний пакет идёт дальше как из туннеля. */
const vpnIn = (
  doc: NetDoc,
  run: Run,
  router: Router,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Option.Option<Step<Arrival>> =>
  pipe(
    router.maybeVpnServer,
    Option.filter(server => portsOf(packet).dst === server.port),
    Option.flatMap(server =>
      Option.map(decapsulate(packet), ({ inner }) => {
        const session = {
          server: router.id,
          address: inner.src,
          endpoint: packet.src,
          endpointPort: portsOf(packet).src,
        }
        const known = Array.some(
          run.state.vpnSessions,
          current =>
            current.server === session.server &&
            current.address === session.address &&
            current.endpoint === session.endpoint &&
            current.endpointPort === session.endpointPort,
        )
        const learned = editHop(
          known
            ? run
            : {
                ...run,
                state: {
                  ...run.state,
                  vpnSessions: [
                    ...Array.filter(
                      run.state.vpnSessions,
                      current =>
                        !(
                          current.server === router.id &&
                          current.address === inner.src
                        ),
                    ),
                    session,
                  ],
                },
              },
          maybeHop,
          {
            note: NetMessage.TunnelUnwrapped({ device: router.id }),
            changes: known ? [] : [TableChange.VpnSessionLearned(session)],
          },
        )
        if (inner.dst === server.address || inner.dst === router.lan.ip) {
          return succeed(learned, arrived(router, inner, at, maybeHop))
        }
        return inner.ttl - 1 <= 0
          ? timeExceeded(
              doc,
              learned,
              router,
              Option.some(server.address),
              inner,
              at,
              maybeHop,
            )
          : routeFromRouter(
              doc,
              learned,
              router,
              { ...inner, ttl: inner.ttl - 1 },
              at,
              maybeHop,
              true,
            )
      }),
    ),
  )

// Маршрут роутера: своя LAN, статические маршруты (длиннейший префикс),
// сеть VPN — обратно в туннель, из туннеля в частную сеть — некуда,
// остальное — в WAN.
const routeFromRouter = (
  doc: NetDoc,
  run: Run,
  router: Router,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
  tunneled: boolean,
): Step<Arrival> => {
  const routed = editHop(run, maybeHop, {
    note: NetMessage.PacketRouted({ device: router.id }),
  })
  if (inSubnet(packet.dst, router.lan.ip, router.lan.prefix)) {
    return routeToLan(
      doc,
      routed,
      router,
      packet,
      packet.dst,
      at,
      route(
        router.id,
        'connected',
        router.lan.ip,
        router.lan.prefix,
        Option.none(),
      ),
    )
  }
  const staticRoute = pipe(
    router.routes,
    Array.filter(entry => inSubnet(packet.dst, entry.network, entry.prefix)),
    Array.reduce(
      Option.none<(typeof router.routes)[number]>(),
      (best, entry) =>
        Option.exists(best, current => current.prefix >= entry.prefix)
          ? best
          : Option.some(entry),
    ),
  )
  if (Option.isSome(staticRoute)) {
    const entry = staticRoute.value
    return routeToLan(
      doc,
      routed,
      router,
      packet,
      entry.via,
      at,
      route(
        router.id,
        'static',
        entry.network,
        entry.prefix,
        Option.some(entry.via),
      ),
    )
  }
  if (
    Option.exists(router.maybeVpnServer, server =>
      inSubnet(packet.dst, server.network, server.prefix),
    )
  ) {
    return vpnBack(doc, routed, router, packet, at, maybeHop)
  }
  if (tunneled && !isRoutable(packet.dst)) {
    return dropAt(
      run,
      router.id,
      maybeHop,
      NetMessage.TunnelNoRoute({ gateway: router.id, ip: packet.dst }),
    )
  }
  return routeToWan(doc, run, router, packet, at, maybeHop)
}

const forwardFromRouter = (
  doc: NetDoc,
  run: Run,
  router: Router,
  maybeIngress: Option.Option<Link>,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Step<Arrival> => {
  const fromWan = Option.exists(maybeIngress, link =>
    isWanOf(doc, link, router.id),
  )
  const own =
    packet.dst === router.lan.ip ||
    Option.exists(
      router.maybeVpnServer,
      server => server.address === packet.dst,
    )
  if (own || (!fromWan && packet.dst === router.wan.ip)) {
    return succeed(run, arrived(router, packet, at, maybeHop))
  }
  const ttl = Option.isSome(maybeIngress) ? packet.ttl - 1 : packet.ttl
  if (ttl <= 0) {
    return timeExceeded(
      doc,
      run,
      router,
      Option.some(fromWan ? router.wan.ip : router.lan.ip),
      packet,
      at,
      maybeHop,
    )
  }
  const live = { ...packet, ttl }
  if (!fromWan) {
    return routeFromRouter(doc, run, router, live, at, maybeHop, false)
  }
  const routerGuard: ReadonlyArray<Guard> = [
    { firewall: router.firewall, scope: 'router' },
  ]
  if (live.dst === router.wan.ip) {
    const vpn = vpnIn(doc, run, router, live, at, maybeHop)
    if (Option.isSome(vpn)) {
      return vpn.value
    }
    const back = natIn(run.state, router.id, live)
    if (Option.isSome(back)) {
      return routeFromRouter(doc, run, router, back.value, at, maybeHop, false)
    }
    const proto = protoOf(live)
    const forward = Array.findFirst(
      router.forwards,
      rule =>
        Option.contains(proto, rule.proto) &&
        rule.outsidePort === portsOf(live).dst,
    )
    return Option.match(forward, {
      onNone: () => {
        const key = natKey(live.payload, 'in')
        return dropAt(
          run,
          router.id,
          maybeHop,
          NetMessage.NatNoMapping({
            router: router.id,
            proto: Option.match(key, {
              onNone: (): NatProto => 'tcp',
              onSome: found => found.proto,
            }),
            port: Option.match(key, {
              onNone: () => 0,
              onSome: found => found.port,
            }),
          }),
        )
      },
      onSome: rule =>
        guard(run, router.id, routerGuard, live, maybeHop, checked => {
          const translated = dnat(
            checked.state,
            router.id,
            'forward',
            live,
            rule.insideIp,
            rule.insidePort,
            Option.none(),
          )
          return routeFromRouter(
            doc,
            editHop({ ...checked, state: translated.state }, maybeHop, {
              changes: translated.changes,
            }),
            router,
            translated.packet,
            at,
            maybeHop,
            false,
          )
        }),
    })
  }
  if (!router.nat && inSubnet(live.dst, router.lan.ip, router.lan.prefix)) {
    return guard(run, router.id, routerGuard, live, maybeHop, checked =>
      routeFromRouter(doc, checked, router, live, at, maybeHop, false),
    )
  }
  return dropAt(
    run,
    router.id,
    maybeHop,
    NetMessage.NoRouteToHost({ ip: live.dst }),
  )
}

// PROVIDERS

type Owner = Readonly<{ link: Link; mac: Mac }>

const ownerVia = (
  doc: NetDoc,
  state: NetState,
  node: DeviceId,
  link: Link,
  ip: Ip,
): Option.Option<Owner> =>
  Option.flatMap(findDevice(doc, otherEnd(link, node)), device =>
    Device.match(device, {
      Router: router =>
        router.wan.ip === ip && isWanOf(doc, link, router.id)
          ? Option.some({ link, mac: router.wan.mac })
          : Option.none(),
      Host: host =>
        Array.contains(ownAddresses(doc, state, host), ip)
          ? Option.some({ link, mac: host.mac })
          : Option.none(),
      Transit: transit =>
        transit.ip === ip || Option.contains(transit.maybeCgnat, ip)
          ? Option.some({ link, mac: transit.mac })
          : Option.none(),
      Internet: () => Option.none(),
      Switch: () => Option.none(),
      AccessPoint: () => Option.none(),
    }),
  )

/** Кто из прямых соседей узла провайдера владеет адресом. */
const attachedOwner = (
  doc: NetDoc,
  state: NetState,
  node: DeviceId,
  ip: Ip,
): Option.Option<Owner> =>
  Array.findFirst(activeLinksOf(doc, node), link =>
    ownerVia(doc, state, node, link, ip),
  )

type Frontier = Readonly<{ id: DeviceId; first: Link }>

/** Кратчайший путь по узлам провайдеров до того, у кого адрес: первая
    связь пути. Обход в ширину по порядку связей — детерминирован. */
const providerPath = (
  doc: NetDoc,
  state: NetState,
  start: DeviceId,
  ip: Ip,
): Option.Option<Link> => {
  const neighbours = (
    id: DeviceId,
  ): ReadonlyArray<Readonly<{ id: DeviceId; link: Link }>> =>
    pipe(
      activeLinksOf(doc, id),
      Array.filter(link =>
        Option.exists(findDevice(doc, otherEnd(link, id)), isProvider),
      ),
      Array.map(link => ({ id: otherEnd(link, id), link })),
    )
  const search = (
    visited: ReadonlyArray<DeviceId>,
    queue: ReadonlyArray<Frontier>,
  ): Option.Option<Link> =>
    Array.match(queue, {
      onEmpty: () => Option.none(),
      onNonEmpty: ([head, ...rest]) =>
        Option.isSome(attachedOwner(doc, state, head.id, ip)) ||
        Option.exists(
          findDevice(doc, head.id),
          device =>
            device._tag === 'Transit' &&
            (device.ip === ip || Option.contains(device.maybeCgnat, ip)),
        )
          ? Option.some(head.first)
          : (() => {
              const fresh = Array.filter(
                neighbours(head.id),
                next =>
                  !Array.contains(visited, next.id) &&
                  !Array.some(rest, queued => queued.id === next.id),
              )
              return search(
                [...visited, ...Array.map(fresh, next => next.id)],
                [
                  ...rest,
                  ...Array.map(fresh, next => ({
                    id: next.id,
                    first: head.first,
                  })),
                ],
              )
            })(),
    })
  return search(
    [start, ...Array.map(neighbours(start), next => next.id)],
    Array.map(neighbours(start), next => ({ id: next.id, first: next.link })),
  )
}

/** Общедоступные справочные: если их нет на доске, отвечает сам интернет. */
export const PUBLIC_RESOLVERS: ReadonlyArray<Ip> = ['1.1.1.1', '8.8.8.8']

const forwardFromProvider = (
  doc: NetDoc,
  run: Run,
  node: Provider,
  maybeIngress: Option.Option<Link>,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Step<Arrival> => {
  if (node._tag === 'Transit' && packet.dst === node.ip) {
    return succeed(run, arrived(node, packet, at, maybeHop))
  }
  const ttl = Option.isSome(maybeIngress) ? packet.ttl - 1 : packet.ttl
  if (ttl <= 0) {
    return timeExceeded(
      doc,
      run,
      node,
      node._tag === 'Transit' ? Option.some(node.ip) : Option.none(),
      packet,
      at,
      maybeHop,
    )
  }
  const cgnat = node._tag === 'Transit' ? node.maybeCgnat : Option.none()
  if (Option.contains(cgnat, packet.dst)) {
    return Option.match(natIn(run.state, node.id, { ...packet, ttl }), {
      onNone: () => {
        const key = natKey(packet.payload, 'in')
        return dropAt(
          run,
          node.id,
          maybeHop,
          NetMessage.NatNoMapping({
            router: node.id,
            proto: Option.match(key, {
              onNone: (): NatProto => 'tcp',
              onSome: found => found.proto,
            }),
            port: Option.match(key, {
              onNone: () => 0,
              onSome: found => found.port,
            }),
          }),
        )
      },
      onSome: inside =>
        deliverFromProvider(doc, run, node, inside, at, maybeHop),
    })
  }
  const translated = Option.match(cgnat, {
    onNone: () => ({ state: run.state, packet, changes: [] }),
    onSome: outside =>
      isShared(packet.src) && !isShared(packet.dst)
        ? natOut(run.state, node.id, outside, packet)
        : { state: run.state, packet, changes: [] },
  })
  return deliverFromProvider(
    doc,
    editHop({ ...run, state: translated.state }, maybeHop, {
      changes: translated.changes,
    }),
    node,
    { ...translated.packet, ttl },
    at,
    maybeHop,
  )
}

const longestTransitRoute = (transit: Transit, ip: Ip) =>
  pipe(
    transit.routes,
    Array.filter(entry => inSubnet(ip, entry.network, entry.prefix)),
    Array.reduce(
      Option.none<(typeof transit.routes)[number]>(),
      (best, entry) =>
        Option.exists(best, current => current.prefix >= entry.prefix)
          ? best
          : Option.some(entry),
    ),
  )

const deliverFromProvider = (
  doc: NetDoc,
  run: Run,
  node: Provider,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Step<Arrival> => {
  const direct = attachedOwner(doc, run.state, node.id, packet.dst)
  const noRoute = NetMessage.NoRouteToHost({ ip: packet.dst })
  const routed = editHop(run, maybeHop, {
    note: NetMessage.PacketRouted({ device: node.id }),
  })
  const toOwner = (
    owner: Owner,
    matched: Option.Option<RouteMatch>,
  ): Step<Arrival> =>
    transmit(
      doc,
      routed,
      node.id,
      [owner.link],
      node.mac,
      owner.mac,
      packet,
      at,
      matched,
    )
  if (Option.isSome(direct) && !isRoutable(packet.dst)) {
    return toOwner(direct.value, Option.none())
  }
  if (!isRoutable(packet.dst)) {
    return dropAt(
      run,
      node.id,
      maybeHop,
      NetMessage.PrivateAddressNotRoutable({ ip: packet.dst }),
    )
  }
  const explicit =
    node._tag === 'Transit' && Array.isReadonlyArrayNonEmpty(node.routes)
      ? Option.some(longestTransitRoute(node, packet.dst))
      : Option.none()
  return Option.match(explicit, {
    onNone: () =>
      Option.match(direct, {
        onSome: owner =>
          toOwner(
            owner,
            route(node.id, 'transit', packet.dst, 32, Option.none()),
          ),
        onNone: () =>
          Option.match(providerPath(doc, run.state, node.id, packet.dst), {
            onNone: () =>
              Array.contains(PUBLIC_RESOLVERS, packet.dst)
                ? succeed(run, arrived(node, packet, at, maybeHop))
                : dropAt(run, node.id, maybeHop, noRoute),
            onSome: link =>
              Option.match(findDevice(doc, otherEnd(link, node.id)), {
                onNone: () => dropAt(run, node.id, maybeHop, noRoute),
                onSome: next =>
                  toOwner(
                    { link, mac: p2pMac(next) },
                    route(
                      node.id,
                      'transit',
                      '0.0.0.0',
                      0,
                      Option.some(next.id),
                    ),
                  ),
              }),
          }),
      }),
    onSome: maybeEntry =>
      Option.match(maybeEntry, {
        onNone: () => dropAt(run, node.id, maybeHop, noRoute),
        onSome: entry => {
          const matched = route(
            node.id,
            'transit',
            entry.network,
            entry.prefix,
            entry.maybeVia,
          )
          return Option.match(entry.maybeVia, {
            onNone: () =>
              Option.match(direct, {
                onNone: () => dropAt(run, node.id, maybeHop, noRoute),
                onSome: owner => toOwner(owner, matched),
              }),
            onSome: via =>
              pipe(
                Array.findFirst(
                  activeLinksOf(doc, node.id),
                  link => otherEnd(link, node.id) === via,
                ),
                Option.flatMap(link =>
                  Option.map(findDevice(doc, via), next => ({ link, next })),
                ),
                Option.match({
                  onNone: () => dropAt(run, node.id, maybeHop, noRoute),
                  onSome: ({ link, next }) =>
                    toOwner({ link, mac: p2pMac(next) }, matched),
                }),
              ),
          })
        },
      }),
  })
}

const forward = (
  doc: NetDoc,
  run: Run,
  holder: Device,
  maybeIngress: Option.Option<Link>,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Step<Arrival> =>
  Device.match(holder, {
    Host: host =>
      Option.match(maybeIngress, {
        onNone: () => originateFromHost(doc, run, host, packet, at),
        onSome: ingress =>
          receiveAtHost(doc, run, host, ingress, packet, at, maybeHop),
      }),
    Router: router =>
      forwardFromRouter(doc, run, router, maybeIngress, packet, at, maybeHop),
    Transit: transit =>
      forwardFromProvider(
        doc,
        run,
        transit,
        maybeIngress,
        packet,
        at,
        maybeHop,
      ),
    Internet: cloud =>
      forwardFromProvider(doc, run, cloud, maybeIngress, packet, at, maybeHop),
    Switch: () =>
      dropped(run, holder.id, NetMessage.FrameLost({ device: holder.id })),
    AccessPoint: () =>
      dropped(run, holder.id, NetMessage.FrameLost({ device: holder.id })),
  })

export const send = (
  doc: NetDoc,
  run: Run,
  from: Device,
  src: Ip,
  dst: Ip,
  payload: ReadonlyArray<Layer>,
  at: number,
  ttl: number = netRules.ttl,
): Step<Arrival> => {
  const [next, id] = nextPacket(run)
  return forward(
    doc,
    next,
    from,
    Option.none(),
    { id, src, dst, ttl, payload },
    at,
    Option.none(),
  )
}

/** Ответ туда, откуда пришёл пакет (после NAT это WAN-адрес роутера). */
export const reply = (
  doc: NetDoc,
  run: Run,
  arrival: Arrival,
  payload: ReadonlyArray<Layer>,
): Step<Arrival> =>
  send(
    doc,
    run,
    arrival.device,
    arrival.packet.dst,
    arrival.packet.src,
    payload,
    arrival.at,
  )
