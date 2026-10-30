import { Array, Option, Order, Result, pipe } from 'effect'

import {
  ANY_ADDRESS,
  LOCALHOST,
  LOOPBACK,
  type Url,
  isIp,
  isLoopback,
  nameMatches,
  parseUrl,
  urlText,
} from './address'
import { type Ready, attached, dhcpExchange, prepare } from './dhcp'
import {
  addressesIn,
  authorityFor,
  cachedAnswer,
  normalizeName,
  zoneAnswer,
  zonesOf,
} from './dns'
import { findDevice, findHost } from './doc'
import { arpExchange } from './frames'
import { NetMessage } from './message'
import {
  type Cert,
  type Device,
  type DeviceId,
  type DnsRecord,
  type Host,
  type Ip,
  type Listener,
  type NetDoc,
  type NetState,
  type Proto,
  type RecordType,
} from './model'
import {
  Answer,
  type FormField,
  type Hop,
  Intent,
  Layer,
  Outcome,
  type RouteLine,
  type StackLevel,
  TableChange,
  type Trace,
} from './packet'
import {
  type Arrival,
  PUBLIC_RESOLVERS,
  portsOf,
  reply,
  send,
  sourceAddress,
} from './packets'
import {
  type Run,
  type Step,
  andThen,
  cacheRecords,
  dropAt,
  dropped,
  editHop,
  netRules,
  nextPort,
  refused,
  succeed,
} from './run'
import { certFor, certProblem } from './tls'
import { hostIface } from './topology'

// LISTENERS

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

// SOURCE

/** Хост контейнера: DNS и путь наружу идут через него. */
const dockerHostOf = (doc: NetDoc, host: Host): Option.Option<Host> =>
  Option.flatMap(host.maybeContainer, container =>
    findHost(doc, container.host),
  )

/** Готовность хоста слать IP; адрес отправителя зависит от получателя. */
const sourceFor = (doc: NetDoc, run: Run, ready: Ready, dst: Ip): Ip =>
  Option.getOrElse(
    sourceAddress(doc, run.state, ready.host, dst),
    () => ready.iface.ip,
  )

// DNS

type Answered = Readonly<{
  records: ReadonlyArray<DnsRecord>
  authoritative: boolean
}>

type Lookup = Readonly<{
  ip: Ip
  ips: ReadonlyArray<Ip>
  resolver: DeviceId
  at: number
}>

const scratch = (run: Run): Run => ({ ...run, hops: [], packets: 0 })

/** Справочная без своей зоны спрашивает того, кто отвечает за имя, и
    помнит ответ до конца TTL. CNAME наружу своей зоны раскручивается
    новым вопросом. */
const resolveAt = (
  doc: NetDoc,
  run: Run,
  resolver: Device,
  name: string,
  rtype: RecordType,
  at: number,
  depth: number,
): Step<Readonly<{ answered: Answered; at: number }>> => {
  const own = zoneAnswer(zonesOf(resolver), name, rtype)
  if (Option.isSome(own)) {
    return succeed(run, {
      answered: { records: own.value, authoritative: true },
      at,
    })
  }
  const recursive =
    resolver._tag === 'Host' ? resolver.resolver : resolver._tag !== 'Router'
  if (!recursive) {
    return succeed(run, { answered: { records: [], authoritative: false }, at })
  }
  const remembered = cachedAnswer(run.state, resolver.id, name, rtype)
  if (Option.isSome(remembered)) {
    return succeed(run, {
      answered: { records: remembered.value, authoritative: false },
      at,
    })
  }
  return Option.match(
    Option.filter(
      authorityFor(doc, name),
      authority => authority.id !== resolver.id,
    ),
    {
      onNone: () =>
        succeed(run, { answered: { records: [], authoritative: false }, at }),
      onSome: authority => {
        if (resolver._tag !== 'Host') {
          const direct = zoneAnswer(zonesOf(authority), name, rtype)
          return succeed(run, {
            answered: {
              records: Option.getOrElse(direct, () => []),
              authoritative: false,
            },
            at,
          })
        }
        return andThen(
          askServer(
            doc,
            run,
            resolver,
            authorityIp(doc, run.state, authority),
            name,
            rtype,
            at,
            depth + 1,
          ),
          (asked, result) => {
            const tail = Array.last(result.answered.records)
            const chase =
              rtype !== 'CNAME' &&
              Option.exists(tail, record => record.rtype === 'CNAME') &&
              depth < 4
            const cached = cacheAnswer(
              asked,
              resolver.id,
              result.answered.records,
              result.lastHop,
            )
            return chase
              ? andThen(
                  resolveAt(
                    doc,
                    cached,
                    resolver,
                    Option.getOrElse(
                      Option.map(tail, record => record.value),
                      () => name,
                    ),
                    rtype,
                    result.at,
                    depth + 1,
                  ),
                  (more, rest) =>
                    succeed(more, {
                      answered: {
                        records: [
                          ...result.answered.records,
                          ...rest.answered.records,
                        ],
                        authoritative: false,
                      },
                      at: rest.at,
                    }),
                )
              : succeed(cached, {
                  answered: {
                    records: result.answered.records,
                    authoritative: false,
                  },
                  at: result.at,
                })
          },
        )
      },
    },
  )
}

const authorityIp = (doc: NetDoc, state: NetState, device: Device): Ip =>
  device._tag === 'Router'
    ? device.lan.ip
    : device._tag === 'Host'
      ? Option.getOrElse(
          Option.map(hostIface(doc, state, device), iface => iface.ip),
          () => '',
        )
      : ''

/** Память DNS: каждая запись ответа отдельной строкой до конца её TTL. */
const cacheAnswer = (
  run: Run,
  device: DeviceId,
  records: ReadonlyArray<DnsRecord>,
  maybeHop: Option.Option<number>,
): Run => {
  const groups = Array.dedupe(
    Array.map(records, record => `${record.name} ${record.rtype}`),
  )
  return Array.reduce(groups, run, (current, group) => {
    const members = Array.filter(
      records,
      record => `${record.name} ${record.rtype}` === group,
    )
    return Option.match(Array.head(members), {
      onNone: () => current,
      onSome: first => {
        const [state, changes] = cacheRecords(
          current.state,
          device,
          first.name,
          first.rtype,
          Array.map(members, record => ({
            value: record.value,
            expiresAt: current.state.clock + record.ttl,
          })),
        )
        return editHop({ ...current, state }, maybeHop, { changes })
      },
    })
  })
}

type Asked = Readonly<{
  answered: Answered
  server: DeviceId
  at: number
  lastHop: Option.Option<number>
}>

/** Вопрос серверу DNS по UDP 53 и его ответ; сервер-справочная может по
    дороге спросить других. */
const askServer = (
  doc: NetDoc,
  run: Run,
  client: Device,
  server: Ip,
  rawName: string,
  rtype: RecordType,
  at: number,
  depth: number,
): Step<Asked> => {
  const name = normalizeName(rawName)
  const [portRun, port] = nextPort(run)
  const src =
    client._tag === 'Host'
      ? Option.getOrElse(
          sourceAddress(doc, portRun.state, client, server),
          () => '',
        )
      : client._tag === 'Router'
        ? client.lan.ip
        : ''
  return andThen(
    send(
      doc,
      portRun,
      client,
      src,
      server,
      [
        Layer.Udp({ src: port, dst: 53 }),
        Layer.Dns({
          kind: 'query',
          name,
          rtype,
          records: [],
          authoritative: false,
        }),
      ],
      at,
    ),
    (reached, arrival) => {
      const device = arrival.device
      const serves =
        device._tag === 'Host'
          ? Option.isSome(listenerFor(device, 'udp', 53, arrival.packet.dst))
          : device._tag === 'Router'
            ? Array.isReadonlyArrayNonEmpty(device.zones)
            : Array.contains(PUBLIC_RESOLVERS, arrival.packet.dst)
      if (!serves) {
        return dropAt(
          reached,
          device.id,
          arrival.maybeHop,
          refusalOf(device, 'udp', 53, arrival.packet.dst),
        )
      }
      return andThen(
        resolveAt(doc, reached, device, name, rtype, arrival.at, depth),
        (resolved, { answered, at: answeredAt }) => {
          const found = Array.isReadonlyArrayNonEmpty(answered.records)
          const notFound = NetMessage.NameNotFound({ name })
          return andThen(
            reply(
              doc,
              found
                ? resolved
                : editHop(resolved, arrival.maybeHop, { note: notFound }),
              { ...arrival, at: answeredAt },
              [
                Layer.Udp({ src: 53, dst: portsOf(arrival.packet).src }),
                Layer.Dns({
                  kind: found ? 'answer' : 'nxdomain',
                  name,
                  rtype,
                  records: answered.records,
                  authoritative: answered.authoritative,
                }),
              ],
            ),
            (back, returned) =>
              found
                ? succeed(back, {
                    answered,
                    server: device.id,
                    at: returned.at,
                    lastHop: returned.maybeHop,
                  })
                : refused(back, device.id, notFound),
          )
        },
      )
    },
  )
}

/** Какой сервер спрашивать: имена зоны офиса — у DNS VPN, остальные — у
    DNS хоста (контейнер — у DNS своего хоста). */
const dnsServerFor = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  name: string,
): Option.Option<Ip> => {
  const vpnDns = pipe(
    host.maybeVpn,
    Option.filter(vpn => vpn.connected),
    Option.flatMap(vpn => vpn.maybeDns),
    Option.filter(dns => name === dns.zone || name.endsWith(`.${dns.zone}`)),
    Option.map(dns => dns.server),
  )
  return Option.orElse(vpnDns, () =>
    Option.flatMap(
      Option.orElse(dockerHostOf(doc, host), () => Option.some(host)),
      owner =>
        Option.flatMap(hostIface(doc, state, owner), iface => iface.maybeDns),
    ),
  )
}

/** Имена без сети: свой сервис compose, `host.docker.internal`, член mesh. */
const localName = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  name: string,
): Option.Option<Ip> => {
  const docker = Option.flatMap(host.maybeContainer, container =>
    Option.flatMap(findHost(doc, container.host), owner =>
      name === 'host.docker.internal'
        ? Option.map(owner.maybeDocker, bridge => bridge.ip)
        : Option.exists(
              owner.maybeDocker,
              bridge => bridge.network === 'bridge',
            )
          ? Option.none()
          : pipe(
              findHost(doc, name),
              Option.filter(peer =>
                Option.exists(
                  peer.maybeContainer,
                  other => other.host === container.host,
                ),
              ),
              Option.flatMap(peer =>
                Option.map(hostIface(doc, state, peer), iface => iface.ip),
              ),
            ),
    ),
  )
  const mesh = Option.flatMap(host.maybeMesh, own =>
    pipe(
      doc.devices,
      Array.findFirst(
        (device): device is Host =>
          device._tag === 'Host' &&
          Option.exists(
            device.maybeMesh,
            other => other.relay === own.relay && other.name === name,
          ),
      ),
      Option.flatMap(peer => Option.map(peer.maybeMesh, other => other.ip)),
    ),
  )
  return Option.orElse(docker, () => mesh)
}

/** Имя в адрес: IP как есть, `localhost` — сам хост, свои имена Docker и
    mesh, память устройства, иначе вопрос серверу DNS. */
const lookup = (
  doc: NetDoc,
  run: Run,
  ready: Ready,
  rawName: string,
  useCache: boolean,
): Step<Lookup> => {
  const name = normalizeName(rawName)
  const local = (ip: Ip): Step<Lookup> =>
    succeed(run, { ip, ips: [ip], resolver: ready.host.id, at: ready.at })
  if (isIp(name)) {
    return local(name)
  }
  if (name === LOCALHOST) {
    return local(LOOPBACK)
  }
  const known = localName(doc, run.state, ready.host, name)
  if (Option.isSome(known)) {
    return local(known.value)
  }
  const remembered = useCache
    ? Option.filter(
        Option.map(
          cachedAnswer(run.state, ready.host.id, name, 'A'),
          addressesIn,
        ),
        Array.isReadonlyArrayNonEmpty,
      )
    : Option.none()
  if (Option.isSome(remembered)) {
    return succeed(run, {
      ip: Array.headNonEmpty(remembered.value),
      ips: remembered.value,
      resolver: ready.host.id,
      at: ready.at,
    })
  }
  return Option.match(dnsServerFor(doc, run.state, ready.host, name), {
    onNone: () =>
      dropped(
        run,
        ready.host.id,
        NetMessage.NoDnsServer({ device: ready.host.id }),
      ),
    onSome: server =>
      andThen(
        askServer(doc, run, ready.host, server, name, 'A', ready.at, 0),
        (asked, result) => {
          const ips = addressesIn(result.answered.records)
          const cached = cacheAnswer(
            asked,
            ready.host.id,
            result.answered.records,
            result.lastHop,
          )
          return Option.match(Array.head(ips), {
            onNone: () =>
              refused(cached, result.server, NetMessage.NameNotFound({ name })),
            onSome: ip =>
              succeed(cached, {
                ip,
                ips,
                resolver: result.server,
                at: result.at,
              }),
          })
        },
      ),
  })
}

// TCP

type Connected = Readonly<{
  server: Device
  syn: Arrival
  at: number
  src: Ip
  clientPort: number
}>

/** Приложение с зависимостью работает, только если достаёт до неё
    (проверка без хопов: это состояние, а не трасса). */
const healthy = (
  doc: NetDoc,
  run: Run,
  device: Device,
  depth: number,
): Option.Option<NetMessage> =>
  device._tag !== 'Host' || depth > 2
    ? Option.none()
    : Option.flatMap(
        Option.flatMap(
          device.maybeContainer,
          container => container.maybeNeeds,
        ),
        needs => {
          const step = andThen(
            prepare(doc, scratch(run), device.id),
            (prepared, ready) =>
              andThen(
                lookup(doc, prepared, ready, needs.host, true),
                (named, found) =>
                  tcpConnect(
                    doc,
                    named,
                    ready,
                    found.ip,
                    needs.port,
                    found.at,
                    depth + 1,
                  ),
              ),
          )
          return Result.isSuccess(step.result)
            ? Option.none()
            : Option.some(
                NetMessage.AppDown({
                  device: device.id,
                  host: needs.host,
                  port: needs.port,
                }),
              )
        },
      )

/** Рукопожатие TCP: SYN, SYN-ACK, ACK. Нет слушателя (или приложение
    упало) — RST и отказ. */
const tcpConnect = (
  doc: NetDoc,
  run: Run,
  ready: Ready,
  ip: Ip,
  port: number,
  at: number,
  depth = 0,
): Step<Connected> => {
  const [portRun, clientPort] = nextPort(run)
  const src = sourceFor(doc, portRun, ready, ip)
  const fromClient = (flags: 'SYN' | 'ACK'): ReadonlyArray<Layer> => [
    Layer.Tcp({ src: clientPort, dst: port, flags }),
  ]
  return andThen(
    send(doc, portRun, ready.host, src, ip, fromClient('SYN'), at),
    (reached, syn) => {
      const server = syn.device
      const listening = Option.isSome(
        listenerFor(server, 'tcp', port, syn.packet.dst),
      )
      const refusal = listening
        ? healthy(doc, reached, server, depth)
        : Option.some(
            Option.isSome(syn.maybePublished)
              ? NetMessage.PublishedPortClosed({ device: server.id, port })
              : refusalOf(server, 'tcp', port, syn.packet.dst),
          )
      if (Option.isSome(refusal)) {
        const reason = refusal.value
        return andThen(
          reply(doc, editHop(reached, syn.maybeHop, { note: reason }), syn, [
            Layer.Tcp({
              src: port,
              dst: portsOf(syn.packet).src,
              flags: 'RST',
            }),
          ]),
          back => refused(back, server.id, reason),
        )
      }
      return andThen(
        reply(doc, reached, syn, [
          Layer.Tcp({
            src: port,
            dst: portsOf(syn.packet).src,
            flags: 'SYN-ACK',
          }),
        ]),
        (afterSynAck, synAck) =>
          andThen(
            send(
              doc,
              afterSynAck,
              ready.host,
              src,
              ip,
              fromClient('ACK'),
              synAck.at,
            ),
            (afterAck, ack) =>
              succeed(afterAck, { server, syn, at: ack.at, src, clientPort }),
          ),
      )
    },
  )
}

// HTTP

const ACME_PATH = '/.well-known/acme-challenge/'

const delivered = (run: Run, at: DeviceId, answer: Answer): Step<Outcome> =>
  succeed(run, Outcome.Delivered({ at, answer }))

type Request = Readonly<{
  method: 'GET' | 'POST'
  fields: ReadonlyArray<FormField>
}>

type Served = Readonly<{
  status: number
  maybeLocation: Option.Option<string>
  maybeReason: Option.Option<NetMessage>
  run: Run
  at: number
}>

const http = (
  url: Url,
  request: Request,
  maybeStatus: Option.Option<number>,
  maybeLocation: Option.Option<string>,
): Layer =>
  Layer.Http({
    method: request.method,
    host: url.host,
    path: url.path,
    maybeStatus,
    maybeLocation,
    fields: Option.isSome(maybeStatus) ? [] : request.fields,
  })

const sealed = (
  url: Url,
  layers: ReadonlyArray<Layer>,
): ReadonlyArray<Layer> =>
  url.scheme === 'https'
    ? [
        Layer.Tls({ kind: 'data', sni: url.host, maybeCert: Option.none() }),
        ...layers,
      ]
    : layers

/** Ретранслятор отправляет запрос вниз по линии агента; агент отдаёт его
    своему локальному порту (или публикации Docker) и отвечает наверх. */
const throughTunnel = (
  doc: NetDoc,
  run: Run,
  relay: Host,
  url: Url,
  request: Request,
  at: number,
): Served => {
  const session = Array.findFirst(
    run.state.relaySessions,
    current =>
      current.relay === relay.id &&
      current.kind === 'tunnel' &&
      current.key === url.host,
  )
  return Option.match(
    Option.flatMap(session, current =>
      Option.map(findHost(doc, current.agent), agent => ({ current, agent })),
    ),
    {
      onNone: () => ({
        status: 404,
        maybeLocation: Option.none(),
        maybeReason: Option.some(NetMessage.TunnelNotFound({ name: url.host })),
        run,
        at,
      }),
      onSome: ({ current, agent }) => {
        const relayIp = Option.getOrElse(
          Option.map(hostIface(doc, run.state, relay), iface => iface.ip),
          () => '',
        )
        const down = send(
          doc,
          run,
          relay,
          relayIp,
          current.endpoint,
          [
            Layer.Tcp({
              src: netRules.relayPort,
              dst: current.endpointPort,
              flags: 'DATA',
            }),
            Layer.Tunnel({ kind: 'relay' }),
            http(url, request, Option.none(), Option.none()),
          ],
          at,
        )
        return Result.match(down.result, {
          onFailure: () => ({
            status: 502,
            maybeLocation: Option.none(),
            maybeReason: Option.some(
              NetMessage.UpstreamFailed({ device: relay.id, port: url.port }),
            ),
            run: down.run,
            at,
          }),
          onSuccess: arrival => {
            const port = Option.getOrElse(
              Option.map(agent.maybeTunnel, tunnel => tunnel.port),
              () => 80,
            )
            const local = andThen(
              prepare(doc, scratch(down.run), agent.id),
              (prepared, ready) =>
                tcpConnect(doc, prepared, ready, LOOPBACK, port, arrival.at),
            )
            const status = Result.isSuccess(local.result) ? 200 : 502
            const up = reply(doc, down.run, arrival, [
              Layer.Tcp({
                src: current.agentPort,
                dst: netRules.relayPort,
                flags: 'DATA',
              }),
              Layer.Tunnel({ kind: 'relay' }),
              http(url, request, Option.some(status), Option.none()),
            ])
            return {
              status,
              maybeLocation: Option.none(),
              maybeReason:
                status === 200
                  ? Option.none()
                  : Option.some(
                      NetMessage.UpstreamFailed({ device: agent.id, port }),
                    ),
              run: up.run,
              at: Result.match(up.result, {
                onFailure: () => arrival.at,
                onSuccess: back => back.at,
              }),
            }
          },
        })
      },
    },
  )
}

/** Что сервер отвечает на запрос: ретранслятор — через туннель, проверка
    ACME — 200 только своему серверу, перенаправление на HTTPS, прокси к
    локальному приложению (502, если его нет), иначе 200. */
const serve = (
  doc: NetDoc,
  run: Run,
  server: Device,
  url: Url,
  request: Request,
  at: number,
): Served => {
  const plain = (status: number, maybeReason: Option.Option<NetMessage>) => ({
    status,
    maybeLocation: Option.none(),
    maybeReason,
    run,
    at,
  })
  if (server._tag !== 'Host') {
    return plain(netRules.pageStatus, Option.none())
  }
  if (
    Option.exists(server.maybeRelayDomain, domain =>
      nameMatches(`*.${domain}`, url.host),
    )
  ) {
    return throughTunnel(doc, run, server, url, request, at)
  }
  if (url.path.startsWith(ACME_PATH)) {
    return url.path === `${ACME_PATH}${server.id}`
      ? plain(200, Option.none())
      : plain(
          404,
          Option.some(NetMessage.HttpError({ device: server.id, status: 404 })),
        )
  }
  if (url.scheme === 'http' && server.httpsRedirect) {
    return {
      status: 301,
      maybeLocation: Option.some(
        urlText({ ...url, scheme: 'https', port: 443 }),
      ),
      maybeReason: Option.none(),
      run,
      at,
    }
  }
  return Option.match(server.maybeProxy, {
    onNone: () => plain(netRules.pageStatus, Option.none()),
    onSome: upstream => {
      const step = andThen(
        prepare(doc, scratch(run), server.id),
        (prepared, ready) =>
          andThen(
            lookup(doc, prepared, ready, upstream.host, true),
            (named, found) =>
              tcpConnect(
                doc,
                named,
                ready,
                found.ip,
                upstream.port,
                found.at,
                1,
              ),
          ),
      )
      return Result.isSuccess(step.result)
        ? plain(netRules.pageStatus, Option.none())
        : plain(
            502,
            Option.some(
              NetMessage.UpstreamFailed({
                device: server.id,
                port: upstream.port,
              }),
            ),
          )
    },
  })
}

/** Страница: TCP, для https ещё ClientHello и ServerHello с сертификатом,
    запрос и ответ; 301 браузер проходит сам (не больше трёх раз). */
const openPage = (
  doc: NetDoc,
  run: Run,
  ready: Ready,
  url: Url,
  ip: Ip,
  at: number,
  request: Request,
  follow: boolean,
  redirects: ReadonlyArray<string>,
): Step<Outcome> =>
  andThen(tcpConnect(doc, run, ready, ip, url.port, at), (connected, tcp) => {
    const server = tcp.server
    const src = tcp.src
    const fromClient = (layers: ReadonlyArray<Layer>): ReadonlyArray<Layer> => [
      Layer.Tcp({ src: tcp.clientPort, dst: url.port, flags: 'DATA' }),
      ...layers,
    ]
    const toClient = (
      arrival: Arrival,
      layers: ReadonlyArray<Layer>,
    ): ReadonlyArray<Layer> => [
      Layer.Tcp({
        src: url.port,
        dst: portsOf(arrival.packet).src,
        flags: 'DATA',
      }),
      ...layers,
    ]
    const exchange = (
      afterTls: Run,
      startAt: number,
      maybeCert: Option.Option<Cert>,
    ): Step<Outcome> =>
      andThen(
        send(
          doc,
          afterTls,
          ready.host,
          src,
          ip,
          fromClient(
            sealed(url, [http(url, request, Option.none(), Option.none())]),
          ),
          startAt,
        ),
        (afterRequest, arrival) => {
          const served = serve(
            doc,
            afterRequest,
            server,
            url,
            request,
            arrival.at,
          )
          return andThen(
            reply(
              doc,
              served.run,
              { ...arrival, at: served.at },
              toClient(
                arrival,
                sealed(url, [
                  http(
                    url,
                    request,
                    Option.some(served.status),
                    served.maybeLocation,
                  ),
                ]),
              ),
            ),
            (afterResponse, back) => {
              const page = Answer.Page({
                url: urlText(url),
                status: served.status,
                seenFrom: arrival.packet.src,
                secure: url.scheme === 'https',
                maybeCert,
                redirects,
                maybeProblem: Option.filter(
                  served.maybeReason,
                  () => served.status >= 400,
                ),
              })
              const next = pipe(
                served.maybeLocation,
                Option.filter(
                  () => follow && redirects.length < netRules.maxRedirects,
                ),
                Option.flatMap(parseUrl),
              )
              return Option.match(next, {
                onNone: () => delivered(afterResponse, server.id, page),
                onSome: target =>
                  andThen(
                    lookup(
                      doc,
                      afterResponse,
                      { ...ready, at: back.at },
                      target.host,
                      true,
                    ),
                    (named, found) =>
                      openPage(
                        doc,
                        named,
                        ready,
                        target,
                        found.ip,
                        found.at,
                        request,
                        follow,
                        [...redirects, urlText(url)],
                      ),
                  ),
              })
            },
          )
        },
      )
    if (url.scheme === 'http') {
      return exchange(connected, tcp.at, Option.none())
    }
    return andThen(
      send(
        doc,
        connected,
        ready.host,
        src,
        ip,
        fromClient([
          Layer.Tls({
            kind: 'client-hello',
            sni: url.host,
            maybeCert: Option.none(),
          }),
        ]),
        tcp.at,
      ),
      (afterHello, hello) => {
        const maybeCert =
          server._tag === 'Host' ? certFor(server, url.host) : Option.none()
        if (Option.isNone(maybeCert) || server._tag !== 'Host') {
          const reason = NetMessage.TlsNotConfigured({
            device: server.id,
            port: url.port,
          })
          return andThen(
            reply(
              doc,
              editHop(afterHello, hello.maybeHop, { note: reason }),
              hello,
              [
                Layer.Tcp({
                  src: url.port,
                  dst: portsOf(hello.packet).src,
                  flags: 'RST',
                }),
              ],
            ),
            back => refused(back, server.id, reason),
          )
        }
        return andThen(
          reply(
            doc,
            afterHello,
            hello,
            toClient(hello, [
              Layer.Tls({ kind: 'server-hello', sni: url.host, maybeCert }),
            ]),
          ),
          (afterServerHello, serverHello) =>
            Option.match(
              certProblem(
                doc,
                afterServerHello.state.clock,
                server,
                url.host,
                maybeCert.value,
              ),
              {
                onSome: reason =>
                  refused(
                    editHop(afterServerHello, serverHello.maybeHop, {
                      note: reason,
                    }),
                    server.id,
                    reason,
                  ),
                onNone: () =>
                  exchange(afterServerHello, serverHello.at, maybeCert),
              },
            ),
        )
      },
    )
  })

// INTENTS

const traceBrowse = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  url: string,
  request: Request,
  follow: boolean,
): Step<Outcome> =>
  Option.match(parseUrl(url), {
    onNone: () => dropped(run, from, NetMessage.InvalidUrl({ url })),
    onSome: target =>
      andThen(prepare(doc, run, from), (prepared, source) =>
        andThen(
          lookup(doc, prepared, source, target.host, true),
          (named, name) =>
            openPage(
              doc,
              named,
              source,
              target,
              name.ip,
              name.at,
              request,
              follow,
              [],
            ),
        ),
      ),
  })

const GET: Request = { method: 'GET', fields: [] }

/** Время эха: от выхода пакета с устройства до прихода ответа (поиск MAC
    перед отправкой не считается). */
const departureOf = (
  run: Run,
  from: number,
  kind: 'echo-request',
  fallback: number,
): number =>
  pipe(
    Array.drop(run.hops, from),
    Array.findFirst(hop =>
      Array.some(
        hop.envelope,
        layer => layer._tag === 'Icmp' && layer.kind === kind,
      ),
    ),
    Option.map(hop => hop.sentAt),
    Option.getOrElse(() => fallback),
  )

const tracePing = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  host: string,
): Step<Outcome> =>
  andThen(prepare(doc, run, from), (prepared, source) =>
    andThen(lookup(doc, prepared, source, host, true), (named, found) => {
      const [idRun, id] = nextPort(named)
      const start = idRun.hops.length
      return andThen(
        send(
          doc,
          idRun,
          source.host,
          sourceFor(doc, idRun, source, found.ip),
          found.ip,
          [Layer.Icmp({ kind: 'echo-request', id, maybeQuote: Option.none() })],
          found.at,
        ),
        (reached, echo) =>
          andThen(
            reply(doc, reached, echo, [
              Layer.Icmp({
                kind: 'echo-reply',
                id: portsOf(echo.packet).src,
                maybeQuote: Option.none(),
              }),
            ]),
            (back, returned) =>
              delivered(
                back,
                echo.device.id,
                Answer.EchoReply({
                  ip: found.ip,
                  ttl: returned.packet.ttl,
                  ms:
                    returned.at -
                    departureOf(back, start, 'echo-request', found.at),
                }),
              ),
          ),
      )
    }),
  )

type Probing = Readonly<{
  run: Run
  lines: ReadonlyArray<RouteLine>
  stars: number
  done: boolean
  reached: Option.Option<DeviceId>
}>

/** traceroute: эхо-пробы с TTL 1, 2, 3…; на каждой — кто прислал «время
    вышло» или ответил сам. Конец: ответ цели, предел хопов, три молчания
    подряд или `!H` (шлюз не отвечает). */
const traceTraceroute = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  host: string,
): Step<Outcome> =>
  andThen(prepare(doc, run, from), (prepared, source) =>
    andThen(lookup(doc, prepared, source, host, true), (named, found) => {
      const [idRun, id] = nextPort(named)
      const probe = (current: Probing, ttl: number): Probing => {
        if (current.done) {
          return current
        }
        const start = current.run.hops.length
        const sent = sendWithTtl(
          doc,
          current.run,
          source.host,
          sourceFor(doc, current.run, source, found.ip),
          found.ip,
          [Layer.Icmp({ kind: 'echo-request', id, maybeQuote: Option.none() })],
          found.at,
          ttl,
        )
        const departure = departureOf(sent.run, start, 'echo-request', found.at)
        return Result.match(sent.result, {
          onSuccess: echo => {
            const back = reply(doc, sent.run, echo, [
              Layer.Icmp({
                kind: 'echo-reply',
                id: portsOf(echo.packet).src,
                maybeQuote: Option.none(),
              }),
            ])
            const at = Result.match(back.result, {
              onFailure: () => echo.at,
              onSuccess: returned => returned.at,
            })
            return {
              run: back.run,
              lines: [
                ...current.lines,
                {
                  ttl,
                  maybeIp: Option.some(found.ip),
                  maybeDevice: Option.some(echo.device.id),
                  ms: at - departure,
                  unreachable: false,
                },
              ],
              stars: 0,
              done: true,
              reached: Option.some(echo.device.id),
            }
          },
          onFailure: outcome => {
            if (
              outcome._tag !== 'Delivered' &&
              outcome.reason._tag === 'GatewayUnreachable'
            ) {
              return {
                ...current,
                run: sent.run,
                lines: [
                  ...current.lines,
                  {
                    ttl,
                    maybeIp: Option.some(source.iface.ip),
                    maybeDevice: Option.some(source.host.id),
                    ms: 3000,
                    unreachable: true,
                  },
                ],
                done: true,
              }
            }
            const answer = pipe(
              Array.drop(sent.run.hops, start),
              Array.findFirst(
                hop =>
                  hop.to === source.host.id &&
                  Array.some(
                    hop.envelope,
                    layer =>
                      layer._tag === 'Icmp' && layer.kind === 'time-exceeded',
                  ),
              ),
            )
            return Option.match(answer, {
              onNone: () => ({
                ...current,
                run: sent.run,
                lines: [
                  ...current.lines,
                  {
                    ttl,
                    maybeIp: Option.none(),
                    maybeDevice: Option.none(),
                    ms: 0,
                    unreachable: false,
                  },
                ],
                stars: current.stars + 1,
                done: current.stars + 1 >= netRules.tracerouteStars,
              }),
              onSome: hop => ({
                ...current,
                run: sent.run,
                lines: [
                  ...current.lines,
                  {
                    ttl,
                    maybeIp: pipe(
                      Array.findFirst(
                        hop.envelope,
                        layer => layer._tag === 'Ip',
                      ),
                      Option.flatMap(layer =>
                        layer._tag === 'Ip'
                          ? Option.some(layer.src)
                          : Option.none(),
                      ),
                    ),
                    maybeDevice:
                      outcome._tag === 'Delivered'
                        ? Option.none()
                        : Option.some(outcome.at),
                    ms: hop.arrivedAt - departure,
                    unreachable: false,
                  },
                ],
                stars: 0,
              }),
            })
          },
        })
      }
      const done = Array.reduce(
        Array.range(1, netRules.tracerouteMaxHops),
        {
          run: idRun,
          lines: [],
          stars: 0,
          done: false,
          reached: Option.none(),
        },
        probe,
      )
      return delivered(
        done.run,
        Option.getOrElse(done.reached, () => source.host.id),
        Answer.Route({
          ip: found.ip,
          reached: Option.isSome(done.reached),
          lines: done.lines,
        }),
      )
    }),
  )

const sendWithTtl = (
  doc: NetDoc,
  run: Run,
  from: Device,
  src: Ip,
  dst: Ip,
  payload: ReadonlyArray<Layer>,
  at: number,
  ttl: number,
): Step<Arrival> => send(doc, run, from, src, dst, payload, at, ttl)

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
        Answer.Resolved({
          name: normalizeName(name),
          ip: found.ip,
          ips: found.ips,
        }),
      ),
    ),
  )

const traceQuery = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  rawName: string,
  rtype: RecordType,
  maybeServer: Option.Option<string>,
): Step<Outcome> =>
  andThen(prepare(doc, run, from), (prepared, source) => {
    const name = normalizeName(rawName)
    const server: Step<Ip> = Option.match(maybeServer, {
      onNone: () =>
        Option.match(dnsServerFor(doc, prepared.state, source.host, name), {
          onNone: () =>
            dropped(prepared, from, NetMessage.NoDnsServer({ device: from })),
          onSome: ip => succeed(prepared, ip),
        }),
      onSome: given =>
        andThen(lookup(doc, prepared, source, given, true), (named, found) =>
          succeed(named, found.ip),
        ),
    })
    return andThen(server, (ready, ip) =>
      andThen(
        askServer(doc, ready, source.host, ip, name, rtype, source.at, 0),
        (asked, result) =>
          delivered(
            asked,
            result.server,
            Answer.Records({
              name,
              rtype,
              records: result.answered.records,
              server: ip,
              authoritative: result.answered.authoritative,
            }),
          ),
      ),
    )
  })

const traceConnect = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  host: string,
  port: number,
): Step<Outcome> =>
  andThen(prepare(doc, run, from), (prepared, source) =>
    andThen(lookup(doc, prepared, source, host, true), (named, found) =>
      andThen(
        tcpConnect(doc, named, source, found.ip, port, found.at),
        (connected, tcp) =>
          delivered(
            connected,
            tcp.server.id,
            Answer.Connected({
              ip: found.ip,
              port,
              seenFrom: tcp.syn.packet.src,
            }),
          ),
      ),
    ),
  )

/** Конверт «фото» или «документ» без портов: на адрес или на устройство
    по id; доставлен тому, у кого этот адрес. */
const traceSend = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  to: string,
  what: string,
): Step<Outcome> =>
  andThen(prepare(doc, run, from), (prepared, source) => {
    const target = to.trim()
    const ip: Step<Ip> = isIp(target)
      ? succeed(prepared, target)
      : Option.isSome(findDevice(doc, target))
        ? Option.match(
            Option.flatMap(findDevice(doc, target), device =>
              device._tag === 'Host'
                ? Option.map(
                    hostIface(doc, prepared.state, device),
                    iface => iface.ip,
                  )
                : device._tag === 'Router'
                  ? Option.some(device.lan.ip)
                  : device._tag === 'Transit'
                    ? Option.some(device.ip)
                    : Option.none(),
            ),
            {
              onNone: () =>
                dropped(
                  prepared,
                  from,
                  NetMessage.NoAddress({ device: target }),
                ),
              onSome: address => succeed(prepared, address),
            },
          )
        : dropped(prepared, from, NetMessage.InvalidIp({ value: target }))
    return andThen(ip, (ready, address) => {
      const [portRun, port] = nextPort(ready)
      return andThen(
        send(
          doc,
          portRun,
          source.host,
          sourceFor(doc, portRun, source, address),
          address,
          [
            Layer.Udp({ src: port, dst: 9 }),
            Layer.Payload({ protocol: what, kind: 'request' }),
          ],
          source.at,
        ),
        (reached, arrival) =>
          delivered(
            reached,
            arrival.device.id,
            Answer.Received({ ip: address, what }),
          ),
      )
    })
  })

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

/** Агент открывает линию к ретранслятору: строка NAT дома и запись у
    ретранслятора, по ней потом пойдут входящие. */
const traceRelayUp = (
  doc: NetDoc,
  run: Run,
  id: DeviceId,
  kind: 'tunnel' | 'mesh',
): Step<Outcome> =>
  Option.match(findHost(doc, id), {
    onNone: () => dropped(run, id, NetMessage.UnknownDevice({ id })),
    onSome: host => {
      const config =
        kind === 'tunnel'
          ? Option.map(host.maybeTunnel, tunnel => ({
              relay: tunnel.relay,
              name: tunnel.name,
            }))
          : Option.map(host.maybeMesh, mesh => ({
              relay: mesh.relay,
              name: mesh.ip,
            }))
      return Option.match(
        Option.flatMap(config, current =>
          Option.map(findHost(doc, current.relay), relay => ({
            ...current,
            relay,
          })),
        ),
        {
          onNone: () => dropped(run, id, NetMessage.NoRelay()),
          onSome: ({ relay, name }) => {
            const key =
              kind === 'tunnel'
                ? `${name}.${Option.getOrElse(relay.maybeRelayDomain, () => '')}`
                : name
            return andThen(prepare(doc, run, id), (prepared, source) =>
              Option.match(hostIface(doc, prepared.state, relay), {
                onNone: () =>
                  dropped(
                    prepared,
                    id,
                    NetMessage.NoAddress({ device: relay.id }),
                  ),
                onSome: relayIface =>
                  andThen(
                    tcpConnect(
                      doc,
                      prepared,
                      source,
                      relayIface.ip,
                      netRules.relayPort,
                      source.at,
                    ),
                    (connected, tcp) => {
                      const session = {
                        relay: relay.id,
                        agent: id,
                        kind,
                        key,
                        endpoint: tcp.syn.packet.src,
                        endpointPort: portsOf(tcp.syn.packet).src,
                        agentPort: tcp.clientPort,
                      }
                      const registered = editHop(
                        {
                          ...connected,
                          state: {
                            ...connected.state,
                            relaySessions: [
                              ...Array.filter(
                                connected.state.relaySessions,
                                current =>
                                  !(
                                    current.agent === id &&
                                    current.kind === kind
                                  ),
                              ),
                              session,
                            ],
                          },
                        },
                        tcp.syn.maybeHop,
                        {
                          changes: [
                            TableChange.RelayOpened({
                              relay: relay.id,
                              agent: id,
                              kind,
                              key,
                            }),
                          ],
                        },
                      )
                      return delivered(
                        registered,
                        relay.id,
                        kind === 'tunnel'
                          ? Answer.TunnelOpened({ url: `https://${key}` })
                          : Answer.MeshJoined({ ip: key }),
                      )
                    },
                  ),
              }),
            )
          },
        },
      )
    },
  })

const levelOrder: ReadonlyArray<StackLevel> = [
  'link',
  'internet',
  'transport',
  'application',
]

/** Конверт в порядке ученика: снаружи не связь — он не уходит с
    отправителя; под связью не адрес — гибнет у первого роутера; порт не
    на своём месте — отказ у получателя. Верный порядок — обычное открытие
    страницы. */
const traceRaw = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  url: string,
  order: ReadonlyArray<StackLevel>,
): Step<Outcome> => {
  const page = traceBrowse(doc, run, from, url, GET, true)
  const misplaced = Array.findFirstIndex(
    levelOrder,
    (level, index) => !Option.contains(Array.get(order, index), level),
  )
  return Option.match(misplaced, {
    onNone: () => page,
    onSome: position => {
      if (position === 0) {
        return dropped(run, from, NetMessage.NoLinkLayer({ device: from }))
      }
      const syn = pipe(
        page.run.hops,
        Array.findFirst(hop =>
          Array.some(
            hop.envelope,
            layer => layer._tag === 'Tcp' && layer.flags === 'SYN',
          ),
        ),
        Option.map(hop => hop.packet),
      )
      const hops = Array.filter(page.run.hops, hop =>
        Option.contains(syn, hop.packet),
      )
      const stopAt =
        position === 1
          ? Array.findFirstIndex(hops, hop =>
              Option.exists(
                findDevice(doc, hop.to),
                device =>
                  device._tag !== 'Switch' &&
                  device._tag !== 'AccessPoint' &&
                  device._tag !== 'Host',
              ),
            )
          : Option.some(hops.length - 1)
      return Option.match(
        Option.flatMap(stopAt, index =>
          Option.map(Array.get(hops, index), hop => ({ index, hop })),
        ),
        {
          onNone: () => page,
          onSome: ({ index, hop }) => {
            const reason =
              position === 1
                ? NetMessage.NoAddressLayer({ device: hop.to })
                : NetMessage.NoPortLayer({ device: hop.to })
            const kept = {
              ...page.run,
              hops: Array.map(Array.take(hops, index + 1), (current, at) =>
                at === index ? { ...current, note: reason } : current,
              ),
            }
            return position === 1
              ? dropped(kept, hop.to, reason)
              : refused(kept, hop.to, reason)
          },
        },
      )
    },
  })
}

const byArrival = Order.mapInput(Order.Number, (hop: Hop) => hop.arrivedAt)

const traceStep = (doc: NetDoc, start: Run, intent: Intent): Step<Outcome> =>
  Intent.match(intent, {
    Browse: ({ from, url }) => traceBrowse(doc, start, from, url, GET, true),
    Fetch: ({ from, url }) => traceBrowse(doc, start, from, url, GET, false),
    Submit: ({ from, url, fields }) =>
      traceBrowse(doc, start, from, url, { method: 'POST', fields }, true),
    Ping: ({ from, host }) => tracePing(doc, start, from, host),
    Traceroute: ({ from, host }) => traceTraceroute(doc, start, from, host),
    Resolve: ({ from, name }) => traceResolve(doc, start, from, name),
    Query: ({ from, name, rtype, maybeServer }) =>
      traceQuery(doc, start, from, name, rtype, maybeServer),
    Connect: ({ from, host, port }) =>
      traceConnect(doc, start, from, host, port),
    Send: ({ from, to, what }) => traceSend(doc, start, from, to, what),
    DhcpJoin: ({ device }) => traceDhcpJoin(doc, start, device),
    Arp: ({ from, ip }) => traceArp(doc, start, from, ip),
    TunnelUp: ({ device }) => traceRelayUp(doc, start, device, 'tunnel'),
    MeshUp: ({ device }) => traceRelayUp(doc, start, device, 'mesh'),
    Raw: ({ from, url, order }) => traceRaw(doc, start, from, url, order),
  })

/** Трасса намерения: хопы по времени прихода, изменения таблиц и итог.
    Чистая и детерминированная: тот же документ, состояние и намерение дают
    ту же трассу. */
export const trace = (
  doc: NetDoc,
  state: NetState,
  intent: Intent,
): readonly [Trace, NetState] => {
  const step = traceStep(doc, { state, hops: [], packets: 0 }, intent)
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

/** Открытие без перехода по 301: для цели «перенаправляет на HTTPS». */
export const traceNoFollow = (
  doc: NetDoc,
  state: NetState,
  from: DeviceId,
  url: string,
): Trace => {
  const step = traceBrowse(
    doc,
    { state, hops: [], packets: 0 },
    from,
    url,
    GET,
    false,
  )
  return {
    intent: Intent.Browse({ from, url }),
    hops: numberPackets(Array.sort(step.run.hops, byArrival)),
    outcome: Result.match(step.result, {
      onFailure: failure => failure,
      onSuccess: success => success,
    }),
  }
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

/** Устройства «включились»: хосты на DHCP без аренды получают адрес по
    порядку документа, агенты туннеля и члены mesh открывают линию к
    ретранслятору. Цели проверяются на таком состоянии. */
export const settle = (doc: NetDoc, state: NetState): NetState => {
  const leased = Array.reduce(doc.devices, state, (current, device) =>
    device._tag === 'Host' &&
    device.addressing._tag === 'Dhcp' &&
    Option.isNone(hostIface(doc, current, device))
      ? trace(doc, current, Intent.DhcpJoin({ device: device.id }))[1]
      : current,
  )
  return Array.reduce(doc.devices, leased, (current, device) => {
    if (device._tag !== 'Host') {
      return current
    }
    const open = (kind: 'tunnel' | 'mesh') =>
      Array.some(
        current.relaySessions,
        session => session.agent === device.id && session.kind === kind,
      )
    const withTunnel =
      Option.isSome(device.maybeTunnel) && !open('tunnel')
        ? trace(doc, current, Intent.TunnelUp({ device: device.id }))[1]
        : current
    return Option.isSome(device.maybeMesh) &&
      !Array.some(
        withTunnel.relaySessions,
        session => session.agent === device.id && session.kind === 'mesh',
      )
      ? trace(doc, withTunnel, Intent.MeshUp({ device: device.id }))[1]
      : withTunnel
  })
}
