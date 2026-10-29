import { Array, Option, pipe } from 'effect'

import {
  ANY_ADDRESS,
  BROADCAST_MAC,
  LIMITED_BROADCAST,
  compareIp,
  formatIp,
  parseIp,
} from './address'
import { findDevice, isWan } from './doc'
import { egressOf, receptionAt, sendFrame } from './frames'
import { NetMessage } from './message'
import {
  type DeviceId,
  type Host,
  type Ip,
  type Link,
  type Mac,
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
  type Iface,
  hostIface,
  hostLinkOf,
  leaseIface,
  linkFault,
} from './topology'

// SOURCE

export type Attached = Readonly<{ host: Host; link: Link }>

export type Ready = Readonly<{
  host: Host
  link: Link
  iface: Iface
  at: number
}>

/** Хост существует, у него есть связь и (для радио) он в Wi-Fi. */
export const attached = (doc: NetDoc, run: Run, id: DeviceId): Step<Attached> =>
  Option.match(findDevice(doc, id), {
    onNone: () => dropped(run, id, NetMessage.UnknownDevice({ id })),
    onSome: device =>
      device._tag === 'Host'
        ? Option.match(hostLinkOf(doc, id), {
            onNone: () => dropped(run, id, NetMessage.NoLink({ device: id })),
            onSome: link =>
              Option.match(linkFault(doc, link, id), {
                onSome: fault => dropped(run, id, fault),
                onNone: () => succeed(run, { host: device, link }),
              }),
          })
        : dropped(run, id, NetMessage.NotAHost({ id })),
  })

// DHCP

type Server = Readonly<{ router: Router; at: number; hop: number }>

export type Joined = Readonly<{ iface: Iface; router: Router; at: number }>

const dhcpPayload = (
  kind: 'discover' | 'offer' | 'request' | 'ack',
  mac: Mac,
  maybeIp: Option.Option<Ip>,
  src: Ip,
): ReadonlyArray<Layer> => {
  const fromClient = kind === 'discover' || kind === 'request'
  return [
    Layer.Ip({ src, dst: LIMITED_BROADCAST, ttl: netRules.ttl }),
    Layer.Udp(fromClient ? { src: 68, dst: 67 } : { src: 67, dst: 68 }),
    Layer.Dhcp({ kind, clientMac: mac, maybeIp }),
  ]
}

const lowestFree = (
  start: Ip,
  end: Ip,
  isFree: (ip: Ip) => boolean,
): Option.Option<Ip> =>
  pipe(
    Option.all([parseIp(start), parseIp(end)]),
    Option.filter(([low, high]) => low <= high),
    Option.flatMap(([low, high]) =>
      pipe(
        Array.range(low, high),
        Array.map(formatIp),
        Array.findFirst(isFree),
      ),
    ),
  )

/** Адрес для клиента: резерв, его прежняя аренда или наименьший свободный
    адрес пула. Ручные адреса других устройств сервер не видит: так и
    случается конфликт. */
export const pickAddress = (
  state: NetState,
  router: Router,
  mac: Mac,
): Option.Option<Ip> => {
  const { dhcp, lan } = router
  const takenByOther = (ip: Ip): boolean =>
    ip === lan.ip ||
    Array.some(
      state.leases,
      lease =>
        lease.router === router.id && lease.ip === ip && lease.mac !== mac,
    ) ||
    Array.some(
      dhcp.reservations,
      reservation => reservation.ip === ip && reservation.mac !== mac,
    )
  const inPool = (ip: Ip): boolean =>
    compareIp(dhcp.start, ip) <= 0 && compareIp(ip, dhcp.end) <= 0
  return pipe(
    Array.findFirst(dhcp.reservations, reservation => reservation.mac === mac),
    Option.map(reservation => reservation.ip),
    Option.orElse(() =>
      pipe(
        state.leases,
        Array.findFirst(
          lease => lease.router === router.id && lease.mac === mac,
        ),
        Option.map(lease => lease.ip),
        Option.filter(ip => inPool(ip) && !takenByOther(ip)),
      ),
    ),
    Option.orElse(() =>
      lowestFree(dhcp.start, dhcp.end, ip => !takenByOther(ip)),
    ),
  )
}

const grantLease = (
  state: NetState,
  router: DeviceId,
  mac: Mac,
  ip: Ip,
): NetState => ({
  ...state,
  leases: [
    ...Array.filter(
      state.leases,
      lease => !(lease.router === router && lease.mac === mac),
    ),
    { router, mac, ip },
  ],
})

const offerAndAck = (
  doc: NetDoc,
  run: Run,
  host: Host,
  link: Link,
  server: Server,
  ip: Ip,
): Step<Joined> => {
  const { router } = server
  const [offerRun, offerPacket] = nextPacket(run)
  const offer = sendFrame(
    doc,
    offerRun,
    router.id,
    egressOf(doc, offerRun.state, router, host.mac),
    {
      packet: offerPacket,
      src: router.lan.mac,
      dst: host.mac,
      payload: dhcpPayload('offer', host.mac, Option.some(ip), router.lan.ip),
    },
    server.at,
  )
  return Option.match(receptionAt(offer.received, host.id), {
    onNone: () =>
      dropped(
        offer.run,
        router.id,
        NetMessage.FrameLost({ device: router.id }),
      ),
    onSome: offered => {
      const [requestRun, requestPacket] = nextPacket(offer.run)
      const request = sendFrame(
        doc,
        requestRun,
        host.id,
        [link],
        {
          packet: requestPacket,
          src: host.mac,
          dst: BROADCAST_MAC,
          payload: dhcpPayload(
            'request',
            host.mac,
            Option.some(ip),
            ANY_ADDRESS,
          ),
        },
        offered.at,
      )
      const noted = Array.reduce(
        request.received,
        request.run,
        (current, reception) =>
          reception.device.id === router.id
            ? current
            : editHop(current, Option.some(reception.hop), {
                note: NetMessage.PacketIgnored({ device: reception.device.id }),
              }),
      )
      return Option.match(receptionAt(request.received, router.id), {
        onNone: () =>
          dropped(noted, host.id, NetMessage.NoDhcpServer({ device: host.id })),
        onSome: requested => {
          const granted = editHop(
            {
              ...noted,
              state: grantLease(noted.state, router.id, host.mac, ip),
            },
            Option.some(requested.hop),
            {
              changes: [
                TableChange.LeaseGranted({
                  router: router.id,
                  device: host.id,
                  mac: host.mac,
                  ip,
                }),
              ],
            },
          )
          const [ackRun, ackPacket] = nextPacket(granted)
          const ack = sendFrame(
            doc,
            ackRun,
            router.id,
            egressOf(doc, ackRun.state, router, host.mac),
            {
              packet: ackPacket,
              src: router.lan.mac,
              dst: host.mac,
              payload: dhcpPayload(
                'ack',
                host.mac,
                Option.some(ip),
                router.lan.ip,
              ),
            },
            requested.at,
          )
          return Option.match(receptionAt(ack.received, host.id), {
            onNone: () =>
              dropped(
                ack.run,
                router.id,
                NetMessage.FrameLost({ device: router.id }),
              ),
            onSome: acked =>
              succeed(ack.run, {
                iface: leaseIface(host, router, ip),
                router,
                at: acked.at,
              }),
          })
        },
      })
    },
  })
}

// Discover и Request — broadcast от клиента, Offer и Ack — ответ сервера.
export const dhcpExchange = (
  doc: NetDoc,
  run: Run,
  host: Host,
  link: Link,
  at: number,
): Step<Joined> => {
  const [discoverRun, discoverPacket] = nextPacket(run)
  const discover = sendFrame(
    doc,
    discoverRun,
    host.id,
    [link],
    {
      packet: discoverPacket,
      src: host.mac,
      dst: BROADCAST_MAC,
      payload: dhcpPayload('discover', host.mac, Option.none(), ANY_ADDRESS),
    },
    at,
  )
  type Found = Readonly<{ run: Run; servers: ReadonlyArray<Server> }>
  const found = Array.reduce(
    discover.received,
    { run: discover.run, servers: [] },
    (current: Found, reception): Found => {
      const device = reception.device
      if (device._tag === 'Router' && !isWan(doc, reception.link)) {
        return device.dhcp.enabled
          ? {
              ...current,
              servers: [
                ...current.servers,
                { router: device, at: reception.at, hop: reception.hop },
              ],
            }
          : {
              ...current,
              run: editHop(current.run, Option.some(reception.hop), {
                note: NetMessage.DhcpServerOff({ router: device.id }),
              }),
            }
      }
      return {
        ...current,
        run: editHop(current.run, Option.some(reception.hop), {
          note: NetMessage.PacketIgnored({ device: device.id }),
        }),
      }
    },
  )
  return Option.match(Array.head(found.servers), {
    onNone: () =>
      dropped(found.run, host.id, NetMessage.NoDhcpServer({ device: host.id })),
    onSome: server =>
      Option.match(pickAddress(found.run.state, server.router, host.mac), {
        onNone: () =>
          dropAt(
            found.run,
            server.router.id,
            Option.some(server.hop),
            NetMessage.DhcpPoolExhausted({ router: server.router.id }),
          ),
        onSome: ip => offerAndAck(doc, found.run, host, link, server, ip),
      }),
  })
}

/** Хост готов слать IP: подключён и с адресом. Хост на DHCP без аренды
    сначала получает адрес — это часть трассы. */
export const prepare = (doc: NetDoc, run: Run, id: DeviceId): Step<Ready> =>
  andThen(attached(doc, run, id), (next, { host, link }) =>
    Option.match(hostIface(doc, next.state, host), {
      onSome: iface => succeed(next, { host, link, iface, at: 0 }),
      onNone: () =>
        host.addressing._tag === 'Dhcp'
          ? andThen(dhcpExchange(doc, next, host, link, 0), (joined, lease) =>
              succeed(joined, { host, link, iface: lease.iface, at: lease.at }),
            )
          : dropped(next, id, NetMessage.NoAddress({ device: id })),
    }),
  )
