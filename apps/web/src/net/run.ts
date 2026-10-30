import { Array, Option, Result, pipe } from 'effect'

import { type NetMessage } from './message'
import {
  type DeviceId,
  type Ip,
  type LinkId,
  type Mac,
  type NetState,
  type RecordType,
} from './model'
import {
  type Hop,
  Outcome,
  type RouteMatch,
  type RuleMatch,
  TableChange,
} from './packet'

// Плумбинг трассы: накопленные хопы, состояние сети, отказы как итог и
// таблицы устройств. Всё чистое, без мутаций.

/** Константы движка: задержки по виду связи (мс), TTL, ответ сервера. */
export const netRules = {
  cableMs: 1,
  radioMs: 3,
  cellularMs: 15,
  virtualMs: 0,
  internetMs: 20,
  ttl: 64,
  pageStatus: 200,
  maxDeliveries: 2000,
  tracerouteMaxHops: 12,
  tracerouteStars: 3,
  vpnPort: 51820,
  relayPort: 443,
  dnsTtl: 300,
  maxRedirects: 3,
}

// RUN

export type Run = Readonly<{
  state: NetState
  hops: ReadonlyArray<Hop>
  packets: number
}>

/** Шаг трассы: либо значение, либо итог отказа, который обрывает трассу. */
export type Step<A> = Readonly<{ run: Run; result: Result.Result<A, Outcome> }>

export const succeed = <A>(run: Run, value: A): Step<A> => ({
  run,
  result: Result.succeed(value),
})

export const dropped = (
  run: Run,
  at: DeviceId,
  reason: NetMessage,
): Step<never> => ({
  run,
  result: Result.fail(Outcome.Dropped({ at, reason })),
})

export const refused = (
  run: Run,
  at: DeviceId,
  reason: NetMessage,
): Step<never> => ({
  run,
  result: Result.fail(Outcome.Refused({ at, reason })),
})

export const andThen = <A, B>(
  step: Step<A>,
  next: (run: Run, value: A) => Step<B>,
): Step<B> =>
  Result.match(step.result, {
    onFailure: outcome => ({ run: step.run, result: Result.fail(outcome) }),
    onSuccess: value => next(step.run, value),
  })

export const nextPacket = (run: Run): readonly [Run, number] => [
  { ...run, packets: run.packets + 1 },
  run.packets + 1,
]

export const nextPort = (run: Run): readonly [Run, number] => [
  { ...run, state: { ...run.state, nextPort: run.state.nextPort + 1 } },
  run.state.nextPort,
]

export const editHop = (
  run: Run,
  maybeIndex: Option.Option<number>,
  edit: Readonly<{
    note?: NetMessage
    changes?: ReadonlyArray<TableChange>
    route?: RouteMatch
    rule?: RuleMatch
  }>,
): Run =>
  Option.match(maybeIndex, {
    onNone: () => run,
    onSome: index => ({
      ...run,
      hops: Array.map(run.hops, (hop, position) =>
        position === index
          ? {
              ...hop,
              note: edit.note ?? hop.note,
              changes: [...hop.changes, ...(edit.changes ?? [])],
              maybeRoute:
                edit.route === undefined
                  ? hop.maybeRoute
                  : Option.some(edit.route),
              maybeRule:
                edit.rule === undefined
                  ? hop.maybeRule
                  : Option.some(edit.rule),
            }
          : hop,
      ),
    }),
  })

/** Отказ на устройстве, куда пришёл кадр: причина пишется и в хоп. */
export const dropAt = (
  run: Run,
  at: DeviceId,
  maybeHop: Option.Option<number>,
  reason: NetMessage,
): Step<never> => dropped(editHop(run, maybeHop, { note: reason }), at, reason)

// TABLES

export const learnMac = (
  state: NetState,
  device: DeviceId,
  mac: Mac,
  link: LinkId,
): readonly [NetState, Option.Option<TableChange>] => {
  const maybePrevious = Array.findFirst(
    state.macTables,
    entry => entry.device === device && entry.mac === mac,
  )
  return Option.exists(maybePrevious, entry => entry.link === link)
    ? [state, Option.none()]
    : [
        {
          ...state,
          macTables: [
            ...Array.filter(
              state.macTables,
              entry => !(entry.device === device && entry.mac === mac),
            ),
            { device, mac, link },
          ],
        },
        Option.some(
          TableChange.MacLearned({
            device,
            mac,
            link,
            maybePrevious: Option.map(maybePrevious, entry => entry.link),
          }),
        ),
      ]
}

export const learnArp = (
  state: NetState,
  device: DeviceId,
  ip: Ip,
  mac: Mac,
): readonly [NetState, Option.Option<TableChange>] => {
  const maybePrevious = Array.findFirst(
    state.arp,
    entry => entry.device === device && entry.ip === ip,
  )
  return Option.exists(maybePrevious, entry => entry.mac === mac)
    ? [state, Option.none()]
    : [
        {
          ...state,
          arp: [
            ...Array.filter(
              state.arp,
              entry => !(entry.device === device && entry.ip === ip),
            ),
            { device, ip, mac },
          ],
        },
        Option.some(
          TableChange.ArpLearned({
            device,
            ip,
            mac,
            maybePrevious: Option.map(maybePrevious, entry => entry.mac),
          }),
        ),
      ]
}

/** Память DNS устройства: строки одного имени и типа заменяются целиком,
    каждая живёт до `expiresAt`. */
export const cacheRecords = (
  state: NetState,
  device: DeviceId,
  name: string,
  rtype: RecordType,
  records: ReadonlyArray<Readonly<{ value: string; expiresAt: number }>>,
): readonly [NetState, ReadonlyArray<TableChange>] => [
  {
    ...state,
    dnsCache: [
      ...Array.filter(
        state.dnsCache,
        entry =>
          !(
            entry.device === device &&
            entry.name === name &&
            entry.rtype === rtype
          ),
      ),
      ...Array.map(records, record => ({ device, name, rtype, ...record })),
    ],
  },
  Array.map(records, record =>
    TableChange.DnsCached({ device, name, rtype, ...record }),
  ),
]

export const macPort = (
  state: NetState,
  device: DeviceId,
  mac: Mac,
): Option.Option<LinkId> =>
  pipe(
    state.macTables,
    Array.findFirst(entry => entry.device === device && entry.mac === mac),
    Option.map(entry => entry.link),
  )

export const arpMac = (
  state: NetState,
  device: DeviceId,
  ip: Ip,
): Option.Option<Mac> =>
  pipe(
    state.arp,
    Array.findFirst(entry => entry.device === device && entry.ip === ip),
    Option.map(entry => entry.mac),
  )
