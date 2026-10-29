import { Array, Option, Order, Result, pipe } from 'effect'

import {
  ANY_ADDRESS,
  LOCALHOST,
  LOOPBACK,
  type Url,
  isIp,
  isLoopback,
  parseUrl,
} from './address'
import { type Ready, attached, dhcpExchange, prepare } from './dhcp'
import { arpExchange } from './frames'
import { NetMessage } from './message'
import {
  type Device,
  type DeviceId,
  type Host,
  type Ip,
  type Listener,
  type NetDoc,
  type NetState,
  type Proto,
} from './model'
import { Answer, type Hop, Intent, Layer, Outcome, type Trace } from './packet'
import { type Arrival, portsOf, reply, send } from './packets'
import {
  type Run,
  type Step,
  andThen,
  cacheName,
  dropAt,
  dropped,
  editHop,
  netRules,
  nextPort,
  refused,
  succeed,
} from './run'
import { hostIface } from './topology'

// DNS

type Lookup = Readonly<{ ip: Ip; resolver: DeviceId; at: number }>

const listenerFor = (
  device: Device,
  proto: Proto,
  port: number,
  dst: Ip,
): Option.Option<Listener> =>
  device._tag === 'Host'
    ? Array.findFirst(
        device.listeners,
        listener =>
          listener.proto === proto &&
          listener.port === port &&
          (listener.bind === ANY_ADDRESS ||
            listener.bind === dst ||
            (isLoopback(listener.bind) && isLoopback(dst))),
      )
    : Option.none()

const refusalOf = (
  device: Device,
  proto: Proto,
  port: number,
  dst: Ip,
): NetMessage =>
  device._tag === 'Host' &&
  !isLoopback(dst) &&
  Array.some(
    device.listeners,
    listener =>
      listener.proto === proto &&
      listener.port === port &&
      isLoopback(listener.bind),
  )
    ? NetMessage.ListensOnlyOnLoopback({ device: device.id, port })
    : NetMessage.PortClosed({ device: device.id, proto, port })

const answerQuery = (
  doc: NetDoc,
  run: Run,
  client: Host,
  arrival: Arrival,
  name: string,
): Step<Lookup> => {
  const resolver = arrival.device
  if (Option.isNone(listenerFor(resolver, 'udp', 53, arrival.packet.dst))) {
    return dropAt(
      run,
      resolver.id,
      arrival.maybeHop,
      refusalOf(resolver, 'udp', 53, arrival.packet.dst),
    )
  }
  const maybeIp =
    resolver._tag === 'Host'
      ? pipe(
          Array.findFirst(resolver.dnsRecords, record => record.name === name),
          Option.map(record => record.ip),
        )
      : Option.none()
  const notFound = NetMessage.NameNotFound({ name })
  const answered = Option.isSome(maybeIp)
    ? run
    : editHop(run, arrival.maybeHop, { note: notFound })
  return andThen(
    reply(doc, answered, arrival, [
      Layer.Udp({ src: 53, dst: portsOf(arrival.packet).src }),
      Layer.Dns({
        kind: Option.isSome(maybeIp) ? 'answer' : 'nxdomain',
        name,
        maybeIp,
      }),
    ]),
    (back, returned) =>
      Option.match(maybeIp, {
        onNone: () => refused(back, resolver.id, notFound),
        onSome: ip => {
          const [state, cached] = cacheName(back.state, client.id, name, ip)
          return succeed(
            editHop({ ...back, state }, returned.maybeHop, {
              changes: Option.toArray(cached),
            }),
            { ip, resolver: resolver.id, at: returned.at },
          )
        },
      }),
  )
}

/** Имя в адрес: IP как есть, `localhost` — сам хост, иначе кэш или вопрос
    резолверу по UDP 53. */
const lookup = (
  doc: NetDoc,
  run: Run,
  ready: Ready,
  rawName: string,
  useCache: boolean,
): Step<Lookup> => {
  const name = rawName.trim().toLowerCase()
  const local = (ip: Ip): Step<Lookup> =>
    succeed(run, { ip, resolver: ready.host.id, at: ready.at })
  if (isIp(name)) {
    return local(name)
  }
  if (name === LOCALHOST) {
    return local(LOOPBACK)
  }
  const maybeCached = useCache
    ? Array.findFirst(
        run.state.dnsCache,
        entry => entry.device === ready.host.id && entry.name === name,
      )
    : Option.none()
  return Option.match(maybeCached, {
    onSome: entry => local(entry.ip),
    onNone: () =>
      Option.match(ready.iface.maybeDns, {
        onNone: () =>
          dropped(
            run,
            ready.host.id,
            NetMessage.NoDnsServer({ device: ready.host.id }),
          ),
        onSome: server => {
          const [portRun, port] = nextPort(run)
          return andThen(
            send(
              doc,
              portRun,
              ready.host,
              ready.iface.ip,
              server,
              [
                Layer.Udp({ src: port, dst: 53 }),
                Layer.Dns({ kind: 'query', name, maybeIp: Option.none() }),
              ],
              ready.at,
            ),
            (reached, arrival) =>
              answerQuery(doc, reached, ready.host, arrival, name),
          )
        },
      }),
  })
}

// INTENTS

const delivered = (run: Run, at: DeviceId, answer: Answer): Step<Outcome> =>
  succeed(run, Outcome.Delivered({ at, answer }))

const appLayers = (
  url: Url,
  maybeStatus: Option.Option<number>,
): ReadonlyArray<Layer> => [
  ...(url.scheme === 'https' ? [Layer.Tls({ sni: url.host })] : []),
  Layer.Http({ method: 'GET', host: url.host, path: url.path, maybeStatus }),
]

const urlText = (url: Url): string => {
  const defaultPort = url.scheme === 'https' ? 443 : 80
  return `${url.scheme}://${url.host}${url.port === defaultPort ? '' : `:${url.port}`}${url.path}`
}

// TCP: SYN, SYN-ACK, ACK, запрос, ответ. Порт без слушателя отвечает RST.
const openPage = (
  doc: NetDoc,
  run: Run,
  ready: Ready,
  url: Url,
  ip: Ip,
  at: number,
): Step<Outcome> => {
  const [portRun, clientPort] = nextPort(run)
  const src = isLoopback(ip) ? LOOPBACK : ready.iface.ip
  const fromClient = (
    flags: 'SYN' | 'ACK' | 'DATA',
    rest: ReadonlyArray<Layer>,
  ): ReadonlyArray<Layer> => [
    Layer.Tcp({ src: clientPort, dst: url.port, flags }),
    ...rest,
  ]
  const fromServer = (
    arrival: Arrival,
    flags: 'SYN-ACK' | 'RST' | 'DATA',
    rest: ReadonlyArray<Layer>,
  ): ReadonlyArray<Layer> => [
    Layer.Tcp({ src: url.port, dst: portsOf(arrival.packet).src, flags }),
    ...rest,
  ]
  return andThen(
    send(doc, portRun, ready.host, src, ip, fromClient('SYN', []), at),
    (reached, syn) => {
      const server = syn.device
      if (Option.isNone(listenerFor(server, 'tcp', url.port, syn.packet.dst))) {
        const reason = refusalOf(server, 'tcp', url.port, syn.packet.dst)
        return andThen(
          reply(
            doc,
            editHop(reached, syn.maybeHop, { note: reason }),
            syn,
            fromServer(syn, 'RST', []),
          ),
          back => refused(back, server.id, reason),
        )
      }
      return andThen(
        reply(doc, reached, syn, fromServer(syn, 'SYN-ACK', [])),
        (afterSynAck, synAck) =>
          andThen(
            send(
              doc,
              afterSynAck,
              ready.host,
              src,
              ip,
              fromClient('ACK', []),
              synAck.at,
            ),
            (afterAck, ack) =>
              andThen(
                send(
                  doc,
                  afterAck,
                  ready.host,
                  src,
                  ip,
                  fromClient('DATA', appLayers(url, Option.none())),
                  ack.at,
                ),
                (afterRequest, request) =>
                  andThen(
                    reply(
                      doc,
                      afterRequest,
                      request,
                      fromServer(
                        request,
                        'DATA',
                        appLayers(url, Option.some(netRules.pageStatus)),
                      ),
                    ),
                    afterResponse =>
                      delivered(
                        afterResponse,
                        server.id,
                        Answer.Page({
                          url: urlText(url),
                          status: netRules.pageStatus,
                        }),
                      ),
                  ),
              ),
          ),
      )
    },
  )
}

const traceBrowse = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  url: string,
): Step<Outcome> =>
  Option.match(parseUrl(url), {
    onNone: () => dropped(run, from, NetMessage.InvalidUrl({ url })),
    onSome: target =>
      andThen(prepare(doc, run, from), (prepared, source) =>
        andThen(
          lookup(doc, prepared, source, target.host, true),
          (named, name) =>
            openPage(doc, named, source, target, name.ip, name.at),
        ),
      ),
  })

const tracePing = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  ip: Ip,
): Step<Outcome> =>
  isIp(ip)
    ? andThen(prepare(doc, run, from), (prepared, source) => {
        const [idRun, id] = nextPort(prepared)
        return andThen(
          send(
            doc,
            idRun,
            source.host,
            isLoopback(ip) ? LOOPBACK : source.iface.ip,
            ip,
            [Layer.Icmp({ kind: 'echo-request', id })],
            source.at,
          ),
          (reached, echo) =>
            andThen(
              reply(doc, reached, echo, [
                Layer.Icmp({
                  kind: 'echo-reply',
                  id: portsOf(echo.packet).src,
                }),
              ]),
              (back, returned) =>
                delivered(
                  back,
                  echo.device.id,
                  Answer.EchoReply({
                    ip,
                    ttl: returned.packet.ttl,
                    ms: returned.at - source.at,
                  }),
                ),
            ),
        )
      })
    : dropped(run, from, NetMessage.InvalidIp({ value: ip }))

const traceResolve = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  name: string,
): Step<Outcome> =>
  andThen(prepare(doc, run, from), (prepared, source) =>
    andThen(lookup(doc, prepared, source, name, false), (named, found) =>
      delivered(
        named,
        found.resolver,
        Answer.Resolved({ name: name.trim().toLowerCase(), ip: found.ip }),
      ),
    ),
  )

const traceDhcpJoin = (doc: NetDoc, run: Run, id: DeviceId): Step<Outcome> =>
  andThen(attached(doc, run, id), (next, { host, link }) =>
    host.addressing._tag === 'Static'
      ? dropped(next, id, NetMessage.UsesStaticAddress({ device: id }))
      : host.addressing._tag === 'Unset'
        ? dropped(next, id, NetMessage.NoAddress({ device: id }))
        : andThen(dhcpExchange(doc, next, host, link, 0), (joined, lease) =>
            delivered(
              joined,
              lease.router.id,
              Answer.Leased({
                ip: lease.iface.ip,
                prefix: lease.iface.prefix,
                gateway: lease.router.lan.ip,
                maybeDns: lease.iface.maybeDns,
              }),
            ),
          ),
  )

const traceArp = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  ip: Ip,
): Step<Outcome> =>
  isIp(ip)
    ? andThen(prepare(doc, run, from), (prepared, source) =>
        andThen(
          arpExchange(
            doc,
            prepared,
            source.iface,
            [source.link],
            ip,
            source.at,
          ),
          (answered, answer) =>
            delivered(
              answered,
              Array.headNonEmpty(answer.owners),
              Answer.MacFound({ ip, macs: answer.macs }),
            ),
        ),
      )
    : dropped(run, from, NetMessage.InvalidIp({ value: ip }))

const byArrival = Order.mapInput(Order.Number, (hop: Hop) => hop.arrivedAt)

/** Трасса намерения: хопы по времени прихода, изменения таблиц и итог.
    Чистая и детерминированная: тот же документ, состояние и намерение дают
    ту же трассу. */
export const trace = (
  doc: NetDoc,
  state: NetState,
  intent: Intent,
): readonly [Trace, NetState] => {
  const start: Run = { state, hops: [], packets: 0 }
  const step = Intent.match(intent, {
    Browse: ({ from, url }) => traceBrowse(doc, start, from, url),
    Ping: ({ from, ip }) => tracePing(doc, start, from, ip),
    Resolve: ({ from, name }) => traceResolve(doc, start, from, name),
    DhcpJoin: ({ device }) => traceDhcpJoin(doc, start, device),
    Arp: ({ from, ip }) => traceArp(doc, start, from, ip),
  })
  const outcome = Result.match(step.result, {
    onFailure: failure => failure,
    onSuccess: success => success,
  })
  return [
    {
      intent,
      hops: numberPackets(Array.sort(step.run.hops, byArrival)),
      outcome,
    },
    step.run.state,
  ]
}

// Номер пакета выдаётся при отправке, а ARP по дороге вклинивается своими
// пакетами. Итоговая нумерация — по первому появлению на доске.
const numberPackets = (hops: ReadonlyArray<Hop>): ReadonlyArray<Hop> => {
  const order: Readonly<Record<number, number>> = Object.fromEntries(
    Array.map(
      Array.dedupe(Array.map(hops, hop => hop.packet)),
      (packet, index) => [packet, index + 1],
    ),
  )
  return Array.map(hops, hop => ({
    ...hop,
    packet: order[hop.packet] ?? hop.packet,
  }))
}

/** Свёртка намерений по порядку: так копится состояние сети. */
export const traceAll = (
  doc: NetDoc,
  state: NetState,
  intents: ReadonlyArray<Intent>,
): readonly [ReadonlyArray<Trace>, NetState] => {
  const start: readonly [ReadonlyArray<Trace>, NetState] = [[], state]
  return Array.reduce(intents, start, ([traces, current], intent) => {
    const [next, after] = trace(doc, current, intent)
    return [[...traces, next], after]
  })
}

/** Устройства «включились»: каждый хост на DHCP без аренды получает адрес
    по порядку документа. Цели проверяются на таком состоянии. */
export const settle = (doc: NetDoc, state: NetState): NetState =>
  Array.reduce(doc.devices, state, (current, device) =>
    device._tag === 'Host' &&
    device.addressing._tag === 'Dhcp' &&
    Option.isNone(hostIface(doc, current, device))
      ? trace(doc, current, Intent.DhcpJoin({ device: device.id }))[1]
      : current,
  )
