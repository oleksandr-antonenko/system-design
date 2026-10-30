import { Array, Option, Order, pipe } from 'effect'

import { isIp } from './address'
import {
  type Device,
  type DnsRecord,
  type DnsZone,
  type NetDoc,
  type NetState,
  type RecordType,
} from './model'

// Записи DNS хранятся по зонам с именами относительно зоны (`@`, `www`,
// `*`). В ответах имена абсолютные.

export const normalizeName = (name: string): string =>
  name.trim().toLowerCase().replace(/\.$/, '')

const covers = (zone: string, name: string): boolean =>
  name === zone || name.endsWith(`.${zone}`)

/** Самая длинная своя зона, которой принадлежит имя. */
export const zoneOf = (
  zones: ReadonlyArray<DnsZone>,
  name: string,
): Option.Option<DnsZone> =>
  pipe(
    zones,
    Array.filter(zone => covers(zone.name, name)),
    Array.sort(
      Order.mapInput(
        Order.flip(Order.Number),
        (zone: DnsZone) => zone.name.length,
      ),
    ),
    Array.head,
  )

const labelOf = (zone: string, name: string): string =>
  name === zone ? '@' : name.slice(0, name.length - zone.length - 1)

const absolute = (
  zone: DnsZone,
  name: string,
  record: DnsRecord,
): DnsRecord => ({
  ...record,
  name,
  value:
    record.rtype === 'CNAME' || record.rtype === 'NS' || record.rtype === 'MX'
      ? record.value === '@'
        ? zone.name
        : record.value.includes('.')
          ? record.value
          : `${record.value}.${zone.name}`
      : record.value,
})

const MAX_CHAIN = 5

/** Ответ авторитативного сервера по своим зонам: `none` — имя не его,
    пустой список — такого имени нет. CNAME раскручивается внутри своих
    зон, `*` отвечает за любое имя на уровень ниже. */
export const zoneAnswer = (
  zones: ReadonlyArray<DnsZone>,
  rawName: string,
  rtype: RecordType,
  depth = 0,
): Option.Option<ReadonlyArray<DnsRecord>> => {
  const name = normalizeName(rawName)
  return Option.map(zoneOf(zones, name), zone => {
    const label = labelOf(zone.name, name)
    const exact = Array.filter(zone.records, record => record.name === label)
    const candidates =
      Array.isReadonlyArrayNonEmpty(exact) || label.includes('.')
        ? exact
        : Array.filter(zone.records, record => record.name === '*')
    const wanted = Array.filter(candidates, record => record.rtype === rtype)
    if (Array.isReadonlyArrayNonEmpty(wanted)) {
      return Array.map(wanted, record => absolute(zone, name, record))
    }
    return pipe(
      Array.findFirst(candidates, record => record.rtype === 'CNAME'),
      Option.filter(() => rtype !== 'CNAME' && depth < MAX_CHAIN),
      Option.match({
        onNone: () => [],
        onSome: cname => {
          const alias = absolute(zone, name, cname)
          return [
            alias,
            ...Option.getOrElse(
              zoneAnswer(zones, alias.value, rtype, depth + 1),
              () => [],
            ),
          ]
        },
      }),
    )
  })
}

/** Зоны устройства: у хоста — если он слушает UDP 53, у роутера — всегда. */
export const zonesOf = (device: Device): ReadonlyArray<DnsZone> =>
  device._tag === 'Host'
    ? Array.some(
        device.listeners,
        listener => listener.proto === 'udp' && listener.port === 53,
      )
      ? device.zones
      : []
    : device._tag === 'Router'
      ? device.zones
      : []

/** Кто на доске отвечает за имя: самая длинная зона, затем порядок
    документа. Так справочная «знает, у кого спросить». */
export const authorityFor = (
  doc: NetDoc,
  name: string,
): Option.Option<Device> =>
  pipe(
    doc.devices,
    Array.flatMap(device =>
      Option.match(zoneOf(zonesOf(device), name), {
        onNone: () => [],
        onSome: zone => [{ device, length: zone.name.length }],
      }),
    ),
    Array.reduce(
      Option.none<Readonly<{ device: Device; length: number }>>(),
      (best, candidate) =>
        Option.exists(best, current => current.length >= candidate.length)
          ? best
          : Option.some(candidate),
    ),
    Option.map(best => best.device),
  )

/** Память устройства: записи имени и типа, пока не вышел срок; CNAME
    раскручивается по той же памяти. TTL в ответе — остаток срока. */
export const cachedAnswer = (
  state: NetState,
  device: string,
  rawName: string,
  rtype: RecordType,
  depth = 0,
): Option.Option<ReadonlyArray<DnsRecord>> => {
  const name = normalizeName(rawName)
  const alive = (wanted: RecordType): ReadonlyArray<DnsRecord> =>
    pipe(
      state.dnsCache,
      Array.filter(
        entry =>
          entry.device === device &&
          entry.name === name &&
          entry.rtype === wanted &&
          entry.expiresAt > state.clock,
      ),
      Array.map(entry => ({
        name,
        rtype: wanted,
        value: entry.value,
        ttl: entry.expiresAt - state.clock,
      })),
    )
  const direct = alive(rtype)
  if (Array.isReadonlyArrayNonEmpty(direct)) {
    return Option.some(direct)
  }
  return pipe(
    Array.head(alive('CNAME')),
    Option.filter(() => rtype !== 'CNAME' && depth < MAX_CHAIN),
    Option.flatMap(alias =>
      Option.map(
        cachedAnswer(state, device, alias.value, rtype, depth + 1),
        rest => [alias, ...rest],
      ),
    ),
  )
}

/** Адреса из ответа: значения записей A. */
export const addressesIn = (
  records: ReadonlyArray<DnsRecord>,
): ReadonlyArray<string> =>
  pipe(
    records,
    Array.filter(record => record.rtype === 'A' && isIp(record.value)),
    Array.map(record => record.value),
    Array.dedupe,
  )

/** Самый короткий TTL ответа: столько живёт память о нём. */
export const minTtl = (records: ReadonlyArray<DnsRecord>): number =>
  Array.reduce(records, Number.POSITIVE_INFINITY, (least, record) =>
    Math.min(least, record.ttl),
  )
