import { Array, Match, Option, pipe } from 'effect'

import { inSubnet, isLoopback, isPrivate } from './address'
import { findDevice, isWan, otherEnd } from './doc'
import { egressOf, resolveMac, sendFrame } from './frames'
import { NetMessage } from './message'
import {
  Device,
  type DeviceId,
  type Host,
  type Internet,
  type Ip,
  type Link,
  type Mac,
  type NatProto,
  type NetDoc,
  type NetState,
  type Router,
} from './model'
import { Layer, TableChange } from './packet'
import {
  type Run,
  type Step,
  andThen,
  dropAt,
  dropped,
  editHop,
  netRules,
  nextPacket,
  succeed,
} from './run'
import {
  activeLinksOf,
  hostIface,
  hostLinkOf,
  isLinkActive,
  lanLinksOf,
  linkFault,
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

export type Arrival = Readonly<{
  device: Device
  packet: Packet
  at: number
  maybeHop: Option.Option<number>
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

type NatKey = Readonly<{
  proto: NatProto
  port: number
  remotePort: number
}>

// Наружу ключ NAT — порт отправителя, внутрь — порт получателя. У ICMP эхо
// роль порта играет идентификатор.
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
          }),
        ),
        Match.tag('Udp', udp =>
          Option.some<NatKey>({
            proto: 'udp',
            port: direction === 'out' ? udp.src : udp.dst,
            remotePort: direction === 'out' ? udp.dst : udp.src,
          }),
        ),
        Match.tag('Icmp', icmp =>
          Option.some<NatKey>({ proto: 'icmp', port: icmp.id, remotePort: 0 }),
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
  Array.map(payload, (layer): Layer =>
    Match.value(layer).pipe(
      Match.tag('Tcp', tcp =>
        side === 'src' ? { ...tcp, src: port } : { ...tcp, dst: port },
      ),
      Match.tag('Udp', udp =>
        side === 'src' ? { ...udp, src: port } : { ...udp, dst: port },
      ),
      Match.tag('Icmp', icmp => ({ ...icmp, id: port })),
      Match.orElse(() => layer),
    ),
  )

// Скрытый NAT роутера: исходящий пакет из LAN получает WAN-адрес и порт из
// счётчика, ответ возвращается по строке таблицы. Чужой входящий пакет без
// строки выбрасывается.
const natOut = (
  state: NetState,
  router: Router,
  packet: Packet,
): Readonly<{
  state: NetState
  packet: Packet
  changes: ReadonlyArray<TableChange>
}> =>
  Option.match(natKey(packet.payload, 'out'), {
    onNone: () => ({ state, packet, changes: [] }),
    onSome: key => {
      const maybeEntry = Array.findFirst(
        state.nat,
        entry =>
          entry.router === router.id &&
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
        src: router.wan.ip,
        payload: withPort(packet.payload, 'src', outsidePort),
      }
      const entry = {
        router: router.id,
        proto: key.proto,
        inside: packet.src,
        insidePort: key.port,
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
            changes: [
              TableChange.NatAdded({ ...entry, outside: router.wan.ip }),
            ],
          }
    },
  })

const natIn = (
  state: NetState,
  router: Router,
  packet: Packet,
  key: NatKey,
): Option.Option<Packet> =>
  pipe(
    state.nat,
    Array.findFirst(
      entry =>
        entry.router === router.id &&
        entry.proto === key.proto &&
        entry.outsidePort === key.port &&
        entry.remote === packet.src &&
        entry.remotePort === key.remotePort,
    ),
    Option.map(entry => ({
      ...packet,
      dst: entry.inside,
      payload: withPort(packet.payload, 'dst', entry.insidePort),
    })),
  )

const cloudBehind = (
  doc: NetDoc,
  link: Link,
  self: DeviceId,
): Option.Option<Internet> =>
  Option.filter(
    findDevice(doc, otherEnd(link, self)),
    (device): device is Internet => device._tag === 'Internet',
  )

const transmit = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  ports: ReadonlyArray<Link>,
  src: Mac,
  dst: Mac,
  packet: Packet,
  at: number,
): Step<Arrival> => {
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
  return Option.match(Array.head(walked.received), {
    onNone: () =>
      dropped(walked.run, from, NetMessage.FrameLost({ device: from })),
    onSome: reception =>
      forward(
        doc,
        walked.run,
        reception.device,
        Option.some(reception.link),
        packet,
        reception.at,
        Option.some(reception.hop),
      ),
  })
}

// Хост: свой адрес — пакет дошёл; своя сеть — ARP получателя; чужая — ARP
// шлюза. Хост, подключённый прямо к облаку, отдаёт всё облаку.
const forwardFromHost = (
  doc: NetDoc,
  run: Run,
  host: Host,
  maybeIngress: Option.Option<Link>,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Step<Arrival> => {
  const maybeIface = hostIface(doc, run.state, host)
  if (
    isLoopback(packet.dst) ||
    Option.exists(maybeIface, iface => iface.ip === packet.dst)
  ) {
    return succeed(run, { device: host, packet, at, maybeHop })
  }
  if (Option.isSome(maybeIngress)) {
    return dropAt(
      run,
      host.id,
      maybeHop,
      NetMessage.FrameNotForMe({ device: host.id }),
    )
  }
  return Option.match(hostLinkOf(doc, host.id), {
    onNone: () => dropped(run, host.id, NetMessage.NoLink({ device: host.id })),
    onSome: link =>
      Option.match(linkFault(doc, link, host.id), {
        onSome: fault => dropped(run, host.id, fault),
        onNone: () =>
          isWan(doc, link)
            ? Option.match(cloudBehind(doc, link, host.id), {
                onNone: () =>
                  dropped(
                    run,
                    host.id,
                    NetMessage.FrameLost({ device: host.id }),
                  ),
                onSome: cloud =>
                  transmit(
                    doc,
                    run,
                    host.id,
                    [link],
                    host.mac,
                    cloud.mac,
                    packet,
                    at,
                  ),
              })
            : Option.match(maybeIface, {
                onNone: () =>
                  dropped(
                    run,
                    host.id,
                    NetMessage.NoAddress({ device: host.id }),
                  ),
                onSome: iface =>
                  Option.match(
                    inSubnet(packet.dst, iface.ip, iface.prefix)
                      ? Option.some(packet.dst)
                      : iface.maybeGateway,
                    {
                      onNone: () =>
                        dropped(
                          run,
                          host.id,
                          NetMessage.NoGateway({
                            device: host.id,
                            ip: packet.dst,
                          }),
                        ),
                      onSome: nextHop =>
                        andThen(
                          resolveMac(doc, run, iface, [link], nextHop, at),
                          (next, resolved) =>
                            transmit(
                              doc,
                              next,
                              host.id,
                              [link],
                              host.mac,
                              resolved.mac,
                              packet,
                              resolved.at,
                            ),
                        ),
                    },
                  ),
              }),
      }),
  })
}

const routeToLan = (
  doc: NetDoc,
  run: Run,
  router: Router,
  packet: Packet,
  at: number,
): Step<Arrival> =>
  andThen(
    resolveMac(
      doc,
      run,
      { device: router.id, mac: router.lan.mac, ip: router.lan.ip },
      lanLinksOf(doc, router.id),
      packet.dst,
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
  return pipe(
    wanLinkOf(doc, router.id),
    Option.filter(link => isLinkActive(doc, link)),
    Option.flatMap(link =>
      Option.map(cloudBehind(doc, link, router.id), cloud => ({ link, cloud })),
    ),
    Option.match({
      onNone: () => dropAt(run, router.id, maybeHop, noWan),
      onSome: ({ link, cloud }) => {
        const translated = inSubnet(
          packet.src,
          router.lan.ip,
          router.lan.prefix,
        )
          ? natOut(run.state, router, packet)
          : { state: run.state, packet, changes: [] }
        return transmit(
          doc,
          editHop({ ...run, state: translated.state }, maybeHop, {
            note: NetMessage.PacketRouted({ device: router.id }),
            changes: translated.changes,
          }),
          router.id,
          [link],
          router.wan.mac,
          cloud.mac,
          translated.packet,
          at,
        )
      },
    }),
  )
}

// Роутер: из WAN пускает только ответы по таблице NAT; из LAN свою сеть
// отдаёт в LAN, всё остальное — по маршруту по умолчанию в облако.
const forwardFromRouter = (
  doc: NetDoc,
  run: Run,
  router: Router,
  maybeIngress: Option.Option<Link>,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Step<Arrival> => {
  const fromWan = Option.exists(maybeIngress, link => isWan(doc, link))
  if (
    !fromWan &&
    (packet.dst === router.lan.ip || packet.dst === router.wan.ip)
  ) {
    return succeed(run, { device: router, packet, at, maybeHop })
  }
  const ttl = Option.isSome(maybeIngress) ? packet.ttl - 1 : packet.ttl
  if (ttl <= 0) {
    return dropAt(
      run,
      router.id,
      maybeHop,
      NetMessage.TtlExpired({ device: router.id }),
    )
  }
  if (fromWan) {
    return Option.match(natKey(packet.payload, 'in'), {
      onNone: () =>
        dropAt(
          run,
          router.id,
          maybeHop,
          NetMessage.FrameLost({ device: router.id }),
        ),
      onSome: key =>
        Option.match(natIn(run.state, router, packet, key), {
          onNone: () =>
            dropAt(
              run,
              router.id,
              maybeHop,
              NetMessage.NatNoMapping({
                router: router.id,
                proto: key.proto,
                port: key.port,
              }),
            ),
          onSome: inside =>
            routeToLan(
              doc,
              editHop(run, maybeHop, {
                note: NetMessage.PacketRouted({ device: router.id }),
              }),
              router,
              { ...inside, ttl },
              at,
            ),
        }),
    })
  }
  return inSubnet(packet.dst, router.lan.ip, router.lan.prefix)
    ? routeToLan(
        doc,
        editHop(run, maybeHop, {
          note: NetMessage.PacketRouted({ device: router.id }),
        }),
        router,
        { ...packet, ttl },
        at,
      )
    : routeToWan(doc, run, router, { ...packet, ttl }, at, maybeHop)
}

const publicOwner = (
  doc: NetDoc,
  state: NetState,
  cloud: Internet,
  ip: Ip,
): Option.Option<Readonly<{ link: Link; mac: Mac }>> =>
  Array.findFirst(activeLinksOf(doc, cloud.id), link =>
    pipe(
      findDevice(doc, otherEnd(link, cloud.id)),
      Option.flatMap(device =>
        device._tag === 'Router' && device.wan.ip === ip
          ? Option.some({ link, mac: device.wan.mac })
          : device._tag === 'Host' &&
              Option.exists(
                hostIface(doc, state, device),
                iface => iface.ip === ip,
              )
            ? Option.some({ link, mac: device.mac })
            : Option.none(),
      ),
    ),
  )

// Облако «Интернет» знает все публичные адреса на доске и не возит частные.
const forwardFromCloud = (
  doc: NetDoc,
  run: Run,
  cloud: Internet,
  packet: Packet,
  at: number,
  maybeHop: Option.Option<number>,
): Step<Arrival> => {
  const ttl = packet.ttl - 1
  if (ttl <= 0) {
    return dropAt(
      run,
      cloud.id,
      maybeHop,
      NetMessage.TtlExpired({ device: cloud.id }),
    )
  }
  if (isPrivate(packet.dst) || isLoopback(packet.dst)) {
    return dropAt(
      run,
      cloud.id,
      maybeHop,
      NetMessage.PrivateAddressNotRoutable({ ip: packet.dst }),
    )
  }
  return Option.match(publicOwner(doc, run.state, cloud, packet.dst), {
    onNone: () =>
      dropAt(
        run,
        cloud.id,
        maybeHop,
        NetMessage.NoRouteToHost({ ip: packet.dst }),
      ),
    onSome: ({ link, mac }) =>
      transmit(
        doc,
        editHop(run, maybeHop, {
          note: NetMessage.PacketRouted({ device: cloud.id }),
        }),
        cloud.id,
        [link],
        cloud.mac,
        mac,
        { ...packet, ttl },
        at,
      ),
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
      forwardFromHost(doc, run, host, maybeIngress, packet, at, maybeHop),
    Router: router =>
      forwardFromRouter(doc, run, router, maybeIngress, packet, at, maybeHop),
    Internet: cloud => forwardFromCloud(doc, run, cloud, packet, at, maybeHop),
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
): Step<Arrival> => {
  const [next, id] = nextPacket(run)
  return forward(
    doc,
    next,
    from,
    Option.none(),
    { id, src, dst, ttl: netRules.ttl, payload },
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
