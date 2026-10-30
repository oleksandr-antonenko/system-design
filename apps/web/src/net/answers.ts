import { Array, Option, pipe } from 'effect'

import { authorityFor, normalizeName, zoneAnswer, zonesOf } from './dns'
import { findDevice, isWanOf, linkBetween } from './doc'
import { type Opener, judge } from './firewall'
import {
  type DeviceId,
  type Firewall,
  type Ip,
  type NetDoc,
  type NetState,
} from './model'
import {
  type Hop,
  Intent,
  type Layer,
  type RuleMatch,
  type Trace,
  durationOf,
  pathOf,
} from './packet'
import { associationOf, dhcpServerFor, hostIface } from './topology'
import { settle, trace } from './trace'

// Ответы квизов и помощники доски: всё считается из документа, состояния
// и трасс, поэтому автор не может ошибиться в ответе.

const traceOn = (doc: NetDoc, state: NetState, intent: Intent): Trace =>
  trace(doc, settle(doc, state), intent)[0]

/** Устройство, через которое трасса выходит из дома: отправитель первого
    кадра по WAN роутера. */
export const exitOf = (doc: NetDoc, result: Trace): Option.Option<DeviceId> =>
  pipe(
    result.hops,
    Array.findFirst(hop =>
      Option.exists(
        Option.flatMap(findDevice(doc, hop.from), device =>
          device._tag === 'Router'
            ? linkBetween(doc, hop.from, hop.to)
            : Option.none(),
        ),
        link => isWanOf(doc, link, hop.from),
      ),
    ),
    Option.map(hop => hop.from),
  )

/** Кто выдаёт адреса устройству: роутер с DHCP в его сегменте. */
export const dhcpServerOf = (
  doc: NetDoc,
  device: DeviceId,
): Option.Option<DeviceId> =>
  Option.map(dhcpServerFor(doc, device), router => router.id)

const ipOf = (hop: Hop): Option.Option<Extract<Layer, { _tag: 'Ip' }>> =>
  Array.findFirst(
    hop.envelope,
    (layer): layer is Extract<Layer, { _tag: 'Ip' }> => layer._tag === 'Ip',
  )

/** Кому адресован первый IP-конверт трассы (поиск MAC и DHCP не в счёт):
    при пустых «контактах» это справочная. */
export const firstAddressee = (result: Trace): Option.Option<DeviceId> =>
  pipe(
    result.hops,
    Array.findFirst(hop =>
      Option.exists(
        ipOf(hop),
        ip => ip.dst !== '255.255.255.255' && ip.src !== '0.0.0.0',
      ),
    ),
    Option.flatMap(first =>
      Array.findLast(result.hops, hop => hop.packet === first.packet),
    ),
    Option.map(hop => hop.to),
  )

/** Кто из кандидатов не подключится к Wi-Fi. */
export const notConnected = (
  doc: NetDoc,
  candidates: ReadonlyArray<DeviceId>,
): ReadonlyArray<DeviceId> =>
  Array.filter(candidates, id =>
    Array.some(
      doc.links,
      link =>
        (link.a === id || link.b === id) &&
        Option.exists(
          associationOf(doc, link),
          association => association._tag === 'NotAssociated',
        ),
    ),
  )

/** Куда пакет пойдёт после устройства (квиз `NextHop`): первый пакет
    трассы, побывавший на `device`. */
export const nextHopAfter = (
  result: Trace,
  device: DeviceId,
  packet?: number,
): Option.Option<DeviceId> =>
  pipe(
    result.hops,
    Array.findFirst(
      hop =>
        hop.from === device && (packet === undefined || hop.packet === packet),
    ),
    Option.map(hop => hop.to),
  )

/** Последнее устройство, ответившее на пробу traceroute. */
export const lastReplyOf = (result: Trace): Option.Option<DeviceId> =>
  result.outcome._tag === 'Delivered' && result.outcome.answer._tag === 'Route'
    ? pipe(
        result.outcome.answer.lines,
        Array.findLast(
          line => Option.isSome(line.maybeDevice) && !line.unreachable,
        ),
        Option.flatMap(line => line.maybeDevice),
      )
    : Option.none()

/** Устройство, где трасса закончилась отказом или потерей. */
export const deathDeviceOf = (result: Trace): Option.Option<DeviceId> =>
  result.outcome._tag === 'Delivered'
    ? Option.none()
    : Option.some(result.outcome.at)

/** Адрес отправителя, который видит устройство: внутренний IP на последнем
    хопе к нему (за NAT и туннелями). */
export const sourceAddressSeenBy = (
  result: Trace,
  device: DeviceId,
): Option.Option<Ip> =>
  pipe(
    Array.findLast(result.hops, hop => hop.to === device),
    Option.flatMap(hop =>
      Array.findLast(
        hop.envelope,
        (layer): layer is Extract<Layer, { _tag: 'Ip' }> => layer._tag === 'Ip',
      ),
    ),
    Option.map(layer => layer.src),
  )

/** Справочная на пути вопроса, которая отвечает из памяти не тем, что
    сейчас записано у сервера имени. */
export const staleAnswerOn = (
  doc: NetDoc,
  state: NetState,
  from: DeviceId,
  rawName: string,
): Option.Option<DeviceId> => {
  const name = normalizeName(rawName)
  const truth = pipe(
    authorityFor(doc, name),
    Option.flatMap(authority => zoneAnswer(zonesOf(authority), name, 'A')),
    Option.map(records =>
      Array.map(
        Array.filter(records, record => record.rtype === 'A'),
        record => record.value,
      ),
    ),
    Option.getOrElse((): ReadonlyArray<string> => []),
  )
  const stale = (device: DeviceId): boolean => {
    const remembered = Array.filter(
      state.dnsCache,
      entry =>
        entry.device === device &&
        entry.rtype === 'A' &&
        entry.expiresAt > state.clock,
    )
    return (
      Array.isReadonlyArrayNonEmpty(remembered) &&
      Array.some(remembered, entry => !Array.contains(truth, entry.value))
    )
  }
  const server = pipe(
    findDevice(doc, from),
    Option.flatMap(device =>
      device._tag === 'Host'
        ? hostIface(doc, settle(doc, state), device)
        : Option.none(),
    ),
    Option.flatMap(iface => iface.maybeDns),
    Option.flatMap(ip =>
      Array.findFirst(
        doc.devices,
        device =>
          device._tag === 'Host' &&
          Option.exists(
            hostIface(doc, state, device),
            iface => iface.ip === ip,
          ),
      ),
    ),
    Option.map(device => device.id),
  )
  return stale(from) ? Option.some(from) : Option.filter(server, stale)
}

/** Первое правило файрвола, которое сработает на открывающий пакет. */
export const firstMatchingRule = (
  firewall: Firewall,
  opener: Opener,
  remote: Ip,
): Option.Option<number> =>
  Option.flatMap(
    judge({ ...firewall, enabled: true }, 'in', opener, remote),
    verdict => verdict.maybeRule,
  )

/** Правило, сработавшее на устройстве в трассе намерения. */
export const ruleHitBy = (
  doc: NetDoc,
  state: NetState,
  intent: Intent,
  device: DeviceId,
): Option.Option<RuleMatch> =>
  pipe(
    traceOn(doc, state, intent).hops,
    Array.findLast(hop =>
      Option.exists(hop.maybeRule, rule => rule.device === device),
    ),
    Option.flatMap(hop => hop.maybeRule),
  )

export type PortStatus = 'open' | 'closed' | 'filtered'

/** Сканер портов: открыт (рукопожатие), закрыт (отказ) или тишина. */
export const scanPorts = (
  doc: NetDoc,
  state: NetState,
  from: DeviceId,
  target: string,
  ports: ReadonlyArray<number> = [
    22, 80, 443, 3000, 3389, 5173, 5432, 8080, 25565,
  ],
): ReadonlyArray<
  Readonly<{ port: number; status: PortStatus; trace: Trace }>
> =>
  Array.map(ports, port => {
    const result = traceOn(
      doc,
      state,
      Intent.Connect({ from, host: target, port }),
    )
    return {
      port,
      status:
        result.outcome._tag === 'Delivered'
          ? 'open'
          : result.outcome._tag === 'Refused'
            ? 'closed'
            : 'filtered',
      trace: result,
    }
  })

/** Финальный прогон: каждое намерение — путь, число хопов и время. */
export const runAll = (
  doc: NetDoc,
  state: NetState,
  intents: ReadonlyArray<Intent>,
): ReadonlyArray<
  Readonly<{
    intent: Intent
    delivered: boolean
    devices: ReadonlyArray<DeviceId>
    hops: number
    ms: number
    trace: Trace
  }>
> =>
  Array.map(intents, intent => {
    const result = traceOn(doc, state, intent)
    return {
      intent,
      delivered: result.outcome._tag === 'Delivered',
      devices: pathOf(result).devices,
      hops: result.hops.length,
      ms: durationOf(result),
      trace: result,
    }
  })

/** Что видит посторонний на связи: адреса, порты и имя сайта; путь, поля
    формы и пароль — только в открытом HTTP. */
export type ObserverView = Readonly<{
  src: Option.Option<Ip>
  dst: Option.Option<Ip>
  srcPort: Option.Option<number>
  dstPort: Option.Option<number>
  maybeSni: Option.Option<string>
  sealed: boolean
  maybeHttp: Option.Option<Extract<Layer, { _tag: 'Http' }>>
}>

export const observerView = (hop: Hop): ObserverView => {
  const ip = ipOf(hop)
  const transport = Array.findFirst(
    hop.envelope,
    (layer): layer is Extract<Layer, { _tag: 'Tcp' | 'Udp' }> =>
      layer._tag === 'Tcp' || layer._tag === 'Udp',
  )
  const tls = Array.findFirst(
    hop.envelope,
    (layer): layer is Extract<Layer, { _tag: 'Tls' }> => layer._tag === 'Tls',
  )
  const tunnel = Array.some(hop.envelope, layer => layer._tag === 'Tunnel')
  return {
    src: Option.map(ip, layer => layer.src),
    dst: Option.map(ip, layer => layer.dst),
    srcPort: Option.map(transport, layer => layer.src),
    dstPort: Option.map(transport, layer => layer.dst),
    maybeSni: tunnel ? Option.none() : Option.map(tls, layer => layer.sni),
    sealed: Option.isSome(tls) || tunnel,
    maybeHttp:
      Option.isSome(tls) || tunnel
        ? Option.none()
        : Array.findFirst(
            hop.envelope,
            (layer): layer is Extract<Layer, { _tag: 'Http' }> =>
              layer._tag === 'Http',
          ),
  }
}
