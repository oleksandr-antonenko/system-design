import { Array, Number, Option, Order, Schema, pipe } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { isIp, normalizeUrl, parseUrl } from './address'
import { scanPorts } from './answers'
import { addressesIn, normalizeName, zonesOf } from './dns'
import {
  NetOp,
  findDevice,
  findHost,
  isPointToPoint,
  linkBetween,
  normalizeRecord,
} from './doc'
import { NetMessage } from './message'
import {
  type Device,
  DeviceId,
  Fault,
  Ip,
  type LinkId,
  Medium,
  type NetDoc,
  type NetState,
  Port,
  Proto,
  RecordType,
  Security,
} from './model'
import {
  Intent,
  Outcome,
  type Trace,
  failingHop,
  pathOf,
  sourceOf,
} from './packet'
import { decidingRung, evidenceVerdict, lastReport, wasChecked } from './report'
import {
  associationOf,
  channelConflicts,
  hostIface,
  hostLinkOf,
  segmentOf,
  wanLinkOf,
  wifiOf,
} from './topology'
import { settle, trace, traceNoFollow } from './trace'

export const AllowedPort = Schema.Struct({ proto: Proto, port: Port })
export type AllowedPort = typeof AllowedPort.Type

export const Goal = defineTaggedUnion({
  Linked: {
    a: DeviceId,
    b: DeviceId,
    maybeMedium: Schema.Option(Medium),
  },
  Associated: { device: DeviceId, ap: DeviceId },
  WifiSecurity: { ap: DeviceId, min: Security },
  ChannelClear: { ap: DeviceId },
  HasAddress: { device: DeviceId, maybeIp: Schema.Option(Ip) },
  NoAddressConflict: {},
  HasDnsServer: { device: DeviceId },
  CanReach: { intent: Intent },
  CannotReach: { intent: Intent },
  Performed: {
    from: DeviceId,
    maybeIntent: Schema.Option(Schema.String),
    at: DeviceId,
    reaches: Schema.Boolean,
    maybePort: Schema.Option(Port),
  },
  Via: { intent: Intent, device: DeviceId, through: Schema.Boolean },
  Listening: {
    device: DeviceId,
    proto: Proto,
    port: Port,
    maybeBind: Schema.Option(Ip),
  },
  Resolves: {
    device: DeviceId,
    name: Schema.String,
    maybeIp: Schema.Option(Ip),
    maybeAt: Schema.Option(Schema.String),
  },
  HasRecord: {
    zone: Schema.String,
    name: Schema.String,
    rtype: RecordType,
    maybeValue: Schema.Option(Schema.String),
  },
  ValidCert: { from: DeviceId, url: Schema.String },
  RedirectsToHttps: { from: DeviceId, url: Schema.String },
  OnlyOpenPorts: {
    target: Schema.String,
    from: DeviceId,
    allow: Schema.Array(AllowedPort),
    exact: Schema.Boolean,
  },
  RanCommand: {
    device: DeviceId,
    commands: Schema.Array(Schema.String),
    maybeName: Schema.Option(Schema.String),
    maybeSaw: Schema.Option(Schema.String),
  },
  /** Отчёт для ИИ (урок 15): последний отчёт называет поломку `fault` и
      приводит строку вывода с одной из меток `evidence`. `traps` — неверные
      диагнозы, на которые у урока свой ответ (`ReportTrap`); `symptom` — что
      не работает; `fix` — исправление, которое предлагает ассистент на
      точный отчёт (кнопка «Применить»). */
  Reported: {
    fault: Fault,
    evidence: Schema.Array(Schema.String),
    traps: Schema.Array(Fault),
    symptom: Intent,
    fix: Schema.Array(NetOp),
  },
})
export type Goal = typeof Goal.Type

/** Результат проверки цели: код сообщения и фокус на доске. Для целей по
    трассе — сама трасса и хоп, где погиб пакет. */
export type GoalCheck = Readonly<{
  met: boolean
  maybeFailure: Option.Option<NetMessage>
  focusDevices: ReadonlyArray<DeviceId>
  focusLinks: ReadonlyArray<LinkId>
  maybeHop: Option.Option<number>
  maybeTrace: Option.Option<Trace>
}>

const met: GoalCheck = {
  met: true,
  maybeFailure: Option.none(),
  focusDevices: [],
  focusLinks: [],
  maybeHop: Option.none(),
  maybeTrace: Option.none(),
}

const failed = (
  failure: NetMessage,
  focus: Partial<Omit<GoalCheck, 'met' | 'maybeFailure'>> = {},
): GoalCheck => ({
  met: false,
  maybeFailure: Option.some(failure),
  focusDevices: focus.focusDevices ?? [],
  focusLinks: focus.focusLinks ?? [],
  maybeHop: focus.maybeHop ?? Option.none(),
  maybeTrace: focus.maybeTrace ?? Option.none(),
})

const metWith = (result: Trace): GoalCheck => ({
  ...met,
  maybeTrace: Option.some(result),
})

const checkLinked = (
  doc: NetDoc,
  a: DeviceId,
  b: DeviceId,
  maybeMedium: Option.Option<Medium>,
): GoalCheck =>
  Option.match(linkBetween(doc, a, b), {
    onNone: () =>
      failed(NetMessage.GoalNotLinked({ a, b }), { focusDevices: [a, b] }),
    onSome: link =>
      Option.exists(maybeMedium, want => want !== link.medium)
        ? failed(
            NetMessage.GoalWrongMedium({
              a,
              b,
              want: Option.getOrElse(maybeMedium, () => link.medium),
            }),
            { focusDevices: [a, b], focusLinks: [link.id] },
          )
        : link.up
          ? met
          : failed(NetMessage.GoalLinkDown({ a, b }), {
              focusDevices: [a, b],
              focusLinks: [link.id],
            }),
  })

const checkAssociated = (
  doc: NetDoc,
  device: DeviceId,
  ap: DeviceId,
): GoalCheck =>
  pipe(
    linkBetween(doc, device, ap),
    Option.filter(link => link.medium === 'radio'),
    Option.match({
      onNone: () =>
        failed(NetMessage.GoalNoRadioLink({ device, ap }), {
          focusDevices: [device, ap],
        }),
      onSome: link => {
        const focus = { focusDevices: [device, ap], focusLinks: [link.id] }
        if (!link.up) {
          return failed(NetMessage.LinkDown({ device, link: link.id }), focus)
        }
        return Option.match(associationOf(doc, link), {
          onNone: () => met,
          onSome: association =>
            association._tag === 'Associated'
              ? met
              : failed(association.reason, focus),
        })
      },
    }),
  )

const strength: Readonly<Record<'open' | 'wpa2' | 'wpa3', number>> = {
  open: 0,
  wpa2: 1,
  wpa3: 2,
}

const checkWifiSecurity = (
  doc: NetDoc,
  ap: DeviceId,
  min: 'open' | 'wpa2' | 'wpa3',
): GoalCheck =>
  Option.match(Option.flatMap(findDevice(doc, ap), wifiOf), {
    onNone: () => failed(NetMessage.WifiOff({ ap }), { focusDevices: [ap] }),
    onSome: wifi =>
      strength[wifi.security] >= strength[min]
        ? met
        : failed(
            NetMessage.GoalWifiTooWeak({
              ap,
              security: wifi.security,
              want: min,
            }),
            { focusDevices: [ap] },
          ),
  })

const checkChannelClear = (doc: NetDoc, ap: DeviceId): GoalCheck => {
  const others = channelConflicts(doc, ap)
  return Array.isReadonlyArrayEmpty(others)
    ? met
    : failed(NetMessage.GoalChannelBusy({ ap, others }), {
        focusDevices: [ap, ...others],
      })
}

const checkHasAddress = (
  doc: NetDoc,
  state: NetState,
  device: DeviceId,
  maybeIp: Option.Option<string>,
): GoalCheck =>
  Option.match(findHost(doc, device), {
    onNone: () =>
      failed(NetMessage.NotAHost({ id: device }), { focusDevices: [device] }),
    onSome: current => {
      const settled = settle(doc, state)
      return Option.match(hostIface(doc, settled, current), {
        onNone: () => {
          const [join] = trace(doc, settled, Intent.DhcpJoin({ device }))
          return Outcome.match(join.outcome, {
            Delivered: () =>
              failed(NetMessage.NoAddress({ device }), {
                focusDevices: [device],
              }),
            Dropped: ({ at, reason }) =>
              failed(reason, {
                focusDevices: Array.dedupe([device, at]),
                maybeTrace: Option.some(join),
              }),
            Refused: ({ at, reason }) =>
              failed(reason, {
                focusDevices: Array.dedupe([device, at]),
                maybeTrace: Option.some(join),
              }),
          })
        },
        onSome: iface =>
          Option.exists(maybeIp, want => want !== iface.ip)
            ? failed(
                NetMessage.GoalWrongAddress({
                  device,
                  have: iface.ip,
                  want: Option.getOrElse(maybeIp, () => iface.ip),
                }),
                { focusDevices: [device] },
              )
            : met,
      })
    },
  })

type Claim = Readonly<{ device: DeviceId; ip: string; scope: string }>

const INTERNET_SCOPE = 'internet'

// Адреса сравниваются внутри своего сегмента: два дома могут оба жить в
// 192.168.1.0/24. Публичные адреса в интернете должны быть уникальны все.
const claimsOf = (doc: NetDoc, state: NetState): ReadonlyArray<Claim> => {
  const scopeOf = (device: DeviceId): string =>
    pipe(
      segmentOf(doc, device),
      Array.sort(Order.String),
      Array.head,
      Option.getOrElse(() => device),
    )
  return Array.flatMap(doc.devices, (device): ReadonlyArray<Claim> => {
    if (device._tag === 'Host') {
      const onProvider = Option.exists(
        hostLinkOf(doc, device.id),
        link => isPointToPoint(doc, link) && link.medium !== 'virtual',
      )
      return Option.match(hostIface(doc, state, device), {
        onNone: () => [],
        onSome: iface => [
          {
            device: device.id,
            ip: iface.ip,
            scope: onProvider ? INTERNET_SCOPE : scopeOf(device.id),
          },
        ],
      })
    }
    if (device._tag === 'Router') {
      const lan = {
        device: device.id,
        ip: device.lan.ip,
        scope: scopeOf(device.id),
      }
      return Option.exists(wanLinkOf(doc, device.id), link =>
        isPointToPoint(doc, link),
      )
        ? [lan, { device: device.id, ip: device.wan.ip, scope: INTERNET_SCOPE }]
        : [lan]
    }
    if (device._tag === 'Transit') {
      return [{ device: device.id, ip: device.ip, scope: INTERNET_SCOPE }]
    }
    return []
  })
}

const checkNoConflict = (doc: NetDoc, state: NetState): GoalCheck => {
  const claims = claimsOf(doc, settle(doc, state))
  return pipe(
    claims,
    Array.map(claim => ({
      ip: claim.ip,
      devices: pipe(
        claims,
        Array.filter(
          other => other.ip === claim.ip && other.scope === claim.scope,
        ),
        Array.map(other => other.device),
        Array.dedupe,
      ),
    })),
    Array.findFirst(group => group.devices.length > 1),
    Option.match({
      onNone: () => met,
      onSome: ({ ip, devices }) =>
        failed(NetMessage.AddressConflict({ ip, devices }), {
          focusDevices: devices,
        }),
    }),
  )
}

const checkHasDns = (
  doc: NetDoc,
  state: NetState,
  device: DeviceId,
): GoalCheck =>
  Option.exists(findHost(doc, device), host =>
    Option.exists(hostIface(doc, settle(doc, state), host), iface =>
      Option.isSome(iface.maybeDns),
    ),
  )
    ? met
    : failed(NetMessage.NoDnsServer({ device }), { focusDevices: [device] })

const traceOf = (doc: NetDoc, state: NetState, intent: Intent): Trace =>
  trace(doc, settle(doc, state), intent)[0]

const failure = (
  result: Trace,
  at: DeviceId,
  reason: NetMessage,
): GoalCheck => {
  const maybeHop = failingHop(result)
  return failed(reason, {
    focusDevices: [at],
    focusLinks: pipe(
      maybeHop,
      Option.flatMap(index => Array.get(result.hops, index)),
      Option.map(hop => hop.link),
      Option.toArray,
    ),
    maybeHop,
    maybeTrace: Option.some(result),
  })
}

/** Доставлено и, если это страница, со статусом ниже 400. */
const reached = (result: Trace): GoalCheck =>
  Outcome.match(result.outcome, {
    Delivered: ({ at, answer }) =>
      answer._tag === 'Page' && answer.status >= 400
        ? failure(
            result,
            at,
            Option.getOrElse(answer.maybeProblem, () =>
              NetMessage.HttpError({ device: at, status: answer.status }),
            ),
          )
        : metWith(result),
    Dropped: ({ at, reason }) => failure(result, at, reason),
    Refused: ({ at, reason }) => failure(result, at, reason),
  })

const checkCannotReach = (
  doc: NetDoc,
  state: NetState,
  intent: Intent,
): GoalCheck => {
  const result = traceOf(doc, state, intent)
  return reached(result).met
    ? Outcome.match(result.outcome, {
        Delivered: ({ at }) => {
          const path = pathOf(result)
          return failed(
            NetMessage.GoalReachable({ from: sourceOf(intent), at }),
            {
              focusDevices: Array.dedupe([...path.devices, at]),
              focusLinks: path.links,
              maybeTrace: Option.some(result),
            },
          )
        },
        Dropped: () => metWith(result),
        Refused: () => metWith(result),
      })
    : metWith(result)
}

const checkPerformed = (
  state: NetState,
  from: DeviceId,
  maybeIntent: Option.Option<string>,
  at: DeviceId,
  reaches: boolean,
  maybePort: Option.Option<number>,
): GoalCheck =>
  Array.some(
    state.performed,
    record =>
      record.from === from &&
      (reaches
        ? Array.contains(record.devices, at)
        : record.delivered && Option.contains(record.maybeAt, at)) &&
      Option.match(maybeIntent, {
        onNone: () => true,
        onSome: intent => record.intent === intent,
      }) &&
      Option.match(maybePort, {
        onNone: () => true,
        onSome: port => Option.contains(record.maybePort, port),
      }),
  )
    ? met
    : failed(NetMessage.GoalNotPerformed({ from, at }), {
        focusDevices: [from, at],
      })

const checkVia = (
  doc: NetDoc,
  state: NetState,
  intent: Intent,
  device: DeviceId,
  through: boolean,
): GoalCheck => {
  const result = traceOf(doc, state, intent)
  const delivered = reached(result)
  if (!delivered.met) {
    return delivered
  }
  const passes = Array.contains(pathOf(result).devices, device)
  return passes === through
    ? metWith(result)
    : failed(
        through
          ? NetMessage.GoalNotThrough({ device })
          : NetMessage.GoalThrough({ device }),
        { focusDevices: [device], maybeTrace: Option.some(result) },
      )
}

const checkListening = (
  doc: NetDoc,
  device: DeviceId,
  proto: 'tcp' | 'udp',
  port: number,
  maybeBind: Option.Option<string>,
): GoalCheck =>
  pipe(
    findHost(doc, device),
    Option.flatMap(current =>
      Array.findFirst(
        current.listeners,
        listener => listener.proto === proto && listener.port === port,
      ),
    ),
    Option.match({
      onNone: () =>
        failed(NetMessage.GoalNotListening({ device, proto, port }), {
          focusDevices: [device],
        }),
      onSome: listener =>
        Option.exists(maybeBind, want => want !== listener.bind)
          ? failed(
              NetMessage.GoalListeningOnWrongAddress({
                device,
                port,
                bind: listener.bind,
                want: Option.getOrElse(maybeBind, () => listener.bind),
              }),
              { focusDevices: [device] },
            )
          : met,
    }),
  )

/** Адрес устройства по id или имя/адрес как есть: для `at` и целей. */
const addressFor = (doc: NetDoc, state: NetState, target: string): string =>
  pipe(
    findDevice(doc, target),
    Option.flatMap(device =>
      device._tag === 'Host'
        ? Option.map(
            hostIface(doc, settle(doc, state), device),
            iface => iface.ip,
          )
        : device._tag === 'Router'
          ? Option.some(device.wan.ip)
          : device._tag === 'Transit'
            ? Option.some(device.ip)
            : Option.none(),
    ),
    Option.getOrElse(() => target),
  )

const checkResolves = (
  doc: NetDoc,
  state: NetState,
  device: DeviceId,
  rawName: string,
  maybeIp: Option.Option<string>,
  maybeAt: Option.Option<string>,
): GoalCheck => {
  const name = normalizeName(rawName)
  const result = Option.match(maybeAt, {
    onNone: () => traceOf(doc, state, Intent.Resolve({ from: device, name })),
    onSome: at =>
      traceOf(
        doc,
        state,
        Intent.Query({
          from: device,
          name,
          rtype: 'A',
          maybeServer: Option.some(addressFor(doc, state, at)),
        }),
      ),
  })
  const ips =
    result.outcome._tag === 'Delivered'
      ? result.outcome.answer._tag === 'Resolved'
        ? result.outcome.answer.ips
        : result.outcome.answer._tag === 'Records'
          ? addressesIn(result.outcome.answer.records)
          : []
      : []
  const fail = (at: DeviceId, reason: NetMessage): GoalCheck =>
    failed(reason, {
      focusDevices: Array.dedupe([device, at]),
      maybeHop: failingHop(result),
      maybeTrace: Option.some(result),
    })
  return Outcome.match(result.outcome, {
    Delivered: ({ at }) =>
      Option.match(Array.head(ips), {
        onNone: () => fail(at, NetMessage.NameNotFound({ name })),
        onSome: first =>
          Option.isSome(maybeIp) && ips.length > 1
            ? failed(NetMessage.SeveralAddresses({ name, ips }), {
                focusDevices: [device, at],
                maybeTrace: Option.some(result),
              })
            : Option.exists(maybeIp, want => want !== first)
              ? failed(
                  NetMessage.GoalResolvesElsewhere({
                    name,
                    have: first,
                    want: Option.getOrElse(maybeIp, () => first),
                  }),
                  { focusDevices: [device], maybeTrace: Option.some(result) },
                )
              : metWith(result),
      }),
    Dropped: ({ at, reason }) => fail(at, reason),
    Refused: ({ at, reason }) => fail(at, reason),
  })
}

const checkHasRecord = (
  doc: NetDoc,
  rawZone: string,
  rawName: string,
  rtype: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS',
  maybeValue: Option.Option<string>,
): GoalCheck => {
  const zone = normalizeName(rawZone)
  const wanted = normalizeRecord(zone, {
    name: rawName,
    rtype,
    value: Option.getOrElse(maybeValue, () => '-'),
    ttl: 0,
  })
  const holders = Array.filter(doc.devices, device =>
    Array.some(zonesOf(device), current => current.name === zone),
  )
  const records = pipe(
    holders,
    Array.flatMap(device => zonesOf(device)),
    Array.filter(current => current.name === zone),
    Array.flatMap(current => current.records),
    Array.filter(
      record => record.name === wanted.name && record.rtype === rtype,
    ),
  )
  const focus = { focusDevices: Array.map(holders, device => device.id) }
  if (Array.isReadonlyArrayEmpty(records)) {
    return failed(
      NetMessage.GoalNoRecord({ zone, name: wanted.name, rtype }),
      focus,
    )
  }
  return Option.isSome(maybeValue) &&
    !Array.some(records, record => record.value === wanted.value)
    ? failed(
        NetMessage.GoalRecordValue({
          zone,
          name: wanted.name,
          rtype,
          have: Array.map(records, record => record.value),
          want: wanted.value,
        }),
        focus,
      )
    : met
}

const checkValidCert = (
  doc: NetDoc,
  state: NetState,
  from: DeviceId,
  url: string,
): GoalCheck => {
  const result = traceOf(doc, state, Intent.Browse({ from, url }))
  const check = reached(result)
  if (!check.met) {
    return check
  }
  return result.outcome._tag === 'Delivered' &&
    result.outcome.answer._tag === 'Page' &&
    result.outcome.answer.secure
    ? check
    : failed(
        NetMessage.TlsNotConfigured({
          device:
            result.outcome._tag === 'Delivered' ? result.outcome.at : from,
          port: 443,
        }),
        {
          maybeTrace: Option.some(result),
        },
      )
}

const checkRedirects = (
  doc: NetDoc,
  state: NetState,
  from: DeviceId,
  url: string,
): GoalCheck => {
  const result = traceNoFollow(doc, settle(doc, state), from, url)
  return Outcome.match(result.outcome, {
    Delivered: ({ answer }) =>
      answer._tag === 'Page' && answer.status === 301
        ? metWith(result)
        : failed(
            NetMessage.GoalNotRedirected({
              url,
              status: answer._tag === 'Page' ? answer.status : 0,
            }),
            { maybeTrace: Option.some(result) },
          ),
    Dropped: ({ at, reason }) => failure(result, at, reason),
    Refused: ({ at, reason }) => failure(result, at, reason),
  })
}

/** Порты, которые проверяет сканер: разрешённые, слушатели и пробросы
    на устройстве за целью и постоянный список. */
const probePorts = (
  doc: NetDoc,
  target: string,
  allow: ReadonlyArray<AllowedPort>,
): ReadonlyArray<number> => {
  const device = Array.findFirst(
    doc.devices,
    (current: Device) =>
      current.id === target ||
      (current._tag === 'Router' && current.wan.ip === target) ||
      (current._tag === 'Host' &&
        current.addressing._tag === 'Static' &&
        current.addressing.ip === target),
  )
  const own = Option.match(device, {
    onNone: () => [],
    onSome: (current): ReadonlyArray<number> =>
      current._tag === 'Host'
        ? [
            ...Array.map(current.listeners, listener => listener.port),
            ...Array.map(current.publishes, publish => publish.hostPort),
          ]
        : current._tag === 'Router'
          ? Array.map(current.forwards, rule => rule.outsidePort)
          : [],
  })
  return pipe(
    [
      ...Array.map(allow, port => port.port),
      ...own,
      22,
      80,
      443,
      3000,
      3389,
      5173,
      5432,
      8080,
      25565,
    ],
    Array.dedupe,
    Array.sort(Order.Number),
  )
}

const checkOnlyOpen = (
  doc: NetDoc,
  state: NetState,
  target: string,
  from: DeviceId,
  allow: ReadonlyArray<AllowedPort>,
  exact: boolean,
): GoalCheck => {
  const address = addressFor(doc, state, target)
  const scan = scanPorts(
    doc,
    state,
    from,
    address,
    probePorts(doc, target, allow),
  )
  const allowed = (port: number): boolean =>
    Array.some(allow, entry => entry.port === port)
  const extra = Array.findFirst(
    scan,
    entry => entry.status === 'open' && !allowed(entry.port),
  )
  if (Option.isSome(extra)) {
    const at =
      extra.value.trace.outcome._tag === 'Delivered'
        ? extra.value.trace.outcome.at
        : target
    return failed(
      NetMessage.GoalExtraOpenPort({
        target,
        port: extra.value.port,
        device: at,
      }),
      { focusDevices: [at], maybeTrace: Option.some(extra.value.trace) },
    )
  }
  const missing = Array.findFirst(
    scan,
    entry => exact && allowed(entry.port) && entry.status !== 'open',
  )
  return Option.match(missing, {
    onNone: () => met,
    onSome: entry =>
      failed(NetMessage.GoalPortNotOpen({ target, port: entry.port }), {
        maybeTrace: Option.some(entry.trace),
      }),
  })
}

const checkRanCommand = (
  state: NetState,
  device: DeviceId,
  commands: ReadonlyArray<string>,
  maybeName: Option.Option<string>,
  maybeSaw: Option.Option<string>,
): GoalCheck => {
  const runs = Array.filter(
    state.commandLog,
    record =>
      record.device === device &&
      Array.contains(commands, record.program) &&
      Option.match(maybeName, {
        onNone: () => true,
        onSome: name =>
          Option.exists(
            record.maybeTarget,
            target => normalizeName(target) === normalizeName(name),
          ),
      }),
  )
  if (Array.isReadonlyArrayEmpty(runs)) {
    return failed(NetMessage.GoalCommandNotRun({ device, commands }), {
      focusDevices: [device],
    })
  }
  return Option.match(maybeSaw, {
    onNone: () => met,
    onSome: want =>
      Array.some(runs, record => Array.contains(record.saw, want))
        ? met
        : failed(
            NetMessage.GoalCommandSawOther({
              device,
              name: Option.getOrElse(maybeName, () => ''),
              saw: Option.getOrElse(
                Option.map(Array.last(runs), record => record.saw),
                () => [],
              ),
              want,
            }),
            { focusDevices: [device] },
          ),
  })
}

/** Устройства, на которые ссылается цель: если их ещё нет на доске, цель
    не выполнена с понятным кодом. */
const devicesOf = (goal: Goal): ReadonlyArray<DeviceId> =>
  Goal.match(goal, {
    Linked: ({ a, b }) => [a, b],
    Associated: ({ device, ap }) => [device, ap],
    WifiSecurity: ({ ap }) => [ap],
    ChannelClear: ({ ap }) => [ap],
    HasAddress: ({ device }) => [device],
    NoAddressConflict: () => [],
    HasDnsServer: ({ device }) => [device],
    CanReach: ({ intent }) => [sourceOf(intent)],
    CannotReach: ({ intent }) => [sourceOf(intent)],
    Performed: ({ from, at }) => [from, at],
    Via: ({ intent, device }) => [sourceOf(intent), device],
    Listening: ({ device }) => [device],
    Resolves: ({ device }) => [device],
    HasRecord: () => [],
    ValidCert: ({ from }) => [from],
    RedirectsToHttps: ({ from }) => [from],
    OnlyOpenPorts: ({ from, target }) =>
      isIp(target) ? [from] : [from, target],
    RanCommand: ({ device }) => [device],
    Reported: ({ symptom }) => [sourceOf(symptom)],
  })

// REPORT

/** Имя и port, которые не открываются: подставляются в совет ассистента. */
const symptomTarget = (
  intent: Intent,
): Readonly<{ host: string; port: number }> =>
  intent._tag === 'Browse' ||
  intent._tag === 'Fetch' ||
  intent._tag === 'Submit' ||
  intent._tag === 'Raw'
    ? Option.match(parseUrl(normalizeUrl(intent.url)), {
        onNone: () => ({ host: intent.url, port: 0 }),
        onSome: url => ({ host: url.host, port: url.port }),
      })
    : intent._tag === 'Connect'
      ? { host: intent.host, port: intent.port }
      : intent._tag === 'Ping' || intent._tag === 'Traceroute'
        ? { host: intent.host, port: 0 }
        : { host: '', port: 0 }

/** Симптом ушёл: то, что не открывалось, открывается. */
export const isSymptomGone = (
  doc: NetDoc,
  state: NetState,
  symptom: Intent,
): boolean => reached(traceOf(doc, state, symptom)).met

const checkReported = (
  doc: NetDoc,
  state: NetState,
  goal: Extract<Goal, Readonly<{ _tag: 'Reported' }>>,
): GoalCheck => {
  const focus = { focusDevices: [sourceOf(goal.symptom)] }
  return Option.match(lastReport(state.reports), {
    onNone: () =>
      failed(
        isSymptomGone(doc, state, goal.symptom)
          ? NetMessage.ReportAfterFix()
          : NetMessage.ReportMissing(),
        focus,
      ),
    onSome: report => {
      if (report.fault !== goal.fault) {
        const fields = {
          picked: report.fault,
          expected: goal.fault,
          ran: wasChecked(
            state.commandLog,
            decidingRung(report.fault, goal.fault),
          ),
          ...symptomTarget(goal.symptom),
        }
        return failed(
          Array.contains(goal.traps, report.fault)
            ? NetMessage.ReportTrap(fields)
            : NetMessage.ReportWrongFault(fields),
          focus,
        )
      }
      const verdicts = Array.map(report.evidence, evidence =>
        evidenceVerdict(evidence, goal.fault, goal.evidence),
      )
      return Array.contains(verdicts, 'accepted')
        ? met
        : failed(
            Option.match(Array.head(verdicts), {
              onNone: () => NetMessage.ReportNoEvidence(),
              onSome: verdict =>
                verdict === 'ok'
                  ? NetMessage.ReportEvidenceOk()
                  : verdict === 'symptom'
                    ? NetMessage.ReportEvidenceSymptom()
                    : verdict === 'above'
                      ? NetMessage.ReportEvidenceAbove()
                      : NetMessage.ReportEvidenceOther(),
            }),
            focus,
          )
    },
  })
}

/** Цели проверяются по документу и состоянию сети, в котором хосты на DHCP
    уже получили адреса, а туннели подключились (`settle`). */
export const checkGoal = (
  doc: NetDoc,
  state: NetState,
  goal: Goal,
): GoalCheck =>
  Option.match(
    Array.findFirst(devicesOf(goal), id => Option.isNone(findDevice(doc, id))),
    {
      onSome: id => failed(NetMessage.GoalNoDevice({ id })),
      onNone: () =>
        Goal.match(goal, {
          Linked: ({ a, b, maybeMedium }) =>
            checkLinked(doc, a, b, maybeMedium),
          Associated: ({ device, ap }) => checkAssociated(doc, device, ap),
          WifiSecurity: ({ ap, min }) => checkWifiSecurity(doc, ap, min),
          ChannelClear: ({ ap }) => checkChannelClear(doc, ap),
          HasAddress: ({ device, maybeIp }) =>
            checkHasAddress(doc, state, device, maybeIp),
          NoAddressConflict: () => checkNoConflict(doc, state),
          HasDnsServer: ({ device }) => checkHasDns(doc, state, device),
          CanReach: ({ intent }) => reached(traceOf(doc, state, intent)),
          CannotReach: ({ intent }) => checkCannotReach(doc, state, intent),
          Performed: ({ from, maybeIntent, at, reaches, maybePort }) =>
            checkPerformed(state, from, maybeIntent, at, reaches, maybePort),
          Via: ({ intent, device, through }) =>
            checkVia(doc, state, intent, device, through),
          Listening: ({ device, proto, port, maybeBind }) =>
            checkListening(doc, device, proto, port, maybeBind),
          Resolves: ({ device, name, maybeIp, maybeAt }) =>
            checkResolves(doc, state, device, name, maybeIp, maybeAt),
          HasRecord: ({ zone, name, rtype, maybeValue }) =>
            checkHasRecord(doc, zone, name, rtype, maybeValue),
          ValidCert: ({ from, url }) => checkValidCert(doc, state, from, url),
          RedirectsToHttps: ({ from, url }) =>
            checkRedirects(doc, state, from, url),
          OnlyOpenPorts: ({ target, from, allow, exact }) =>
            checkOnlyOpen(doc, state, target, from, allow, exact),
          RanCommand: ({ device, commands, maybeName, maybeSaw }) =>
            checkRanCommand(state, device, commands, maybeName, maybeSaw),
          Reported: reported => checkReported(doc, state, reported),
        }),
    },
  )

export const firstFailedGoal = (
  doc: NetDoc,
  state: NetState,
  goals: ReadonlyArray<Goal>,
): Option.Option<Readonly<{ index: number; check: GoalCheck }>> =>
  pipe(
    goals,
    Array.map((goal, index) => ({ index, check: checkGoal(doc, state, goal) })),
    Array.findFirst(({ check }) => !check.met),
  )

export const allGoalsMet = (
  doc: NetDoc,
  state: NetState,
  goals: ReadonlyArray<Goal>,
): boolean => Option.isNone(firstFailedGoal(doc, state, goals))

export const countMet = (
  doc: NetDoc,
  state: NetState,
  goals: ReadonlyArray<Goal>,
): number =>
  Number.sumAll(
    Array.map(goals, goal => (checkGoal(doc, state, goal).met ? 1 : 0)),
  )

/** Короткие конструкторы целей для уроков. */
export const goals = {
  resolves: (device: DeviceId, name: string, ip?: Ip, at?: string): Goal =>
    Goal.Resolves({
      device,
      name,
      maybeIp: Option.fromNullishOr(ip),
      maybeAt: Option.fromNullishOr(at),
    }),
  performed: (
    from: DeviceId,
    at: DeviceId,
    options: Readonly<{
      intent?: Intent['_tag']
      port?: number
      /** Достаточно пройти через устройство, а не быть доставленным ему. */
      reaches?: boolean
    }> = {},
  ): Goal =>
    Goal.Performed({
      from,
      at,
      reaches: options.reaches ?? false,
      maybeIntent: Option.fromNullishOr(options.intent),
      maybePort: Option.fromNullishOr(options.port),
    }),
  onlyOpenPorts: (
    target: string,
    from: DeviceId,
    ports: ReadonlyArray<number>,
    exact = false,
  ): Goal =>
    Goal.OnlyOpenPorts({
      target,
      from,
      allow: Array.map(ports, port => ({ proto: 'tcp', port })),
      exact,
    }),
  hasRecord: (
    zone: string,
    name: string,
    rtype: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS',
    value?: string,
  ): Goal =>
    Goal.HasRecord({
      zone,
      name,
      rtype,
      maybeValue: Option.fromNullishOr(value),
    }),
  ranCommand: (
    device: DeviceId,
    commands: ReadonlyArray<string>,
    options: Readonly<{ name?: string; saw?: string }> = {},
  ): Goal =>
    Goal.RanCommand({
      device,
      commands,
      maybeName: Option.fromNullishOr(options.name),
      maybeSaw: Option.fromNullishOr(options.saw),
    }),
}
