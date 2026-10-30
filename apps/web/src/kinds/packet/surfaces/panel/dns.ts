import { Array, Option, Order, Result, pipe } from 'effect'

import { addRecord, removeRecord, setRecord } from '../../../../net/build'
import { zonesOf } from '../../../../net/dns'
import { findDevice, normalizeRecord } from '../../../../net/doc'
import type { NetMessage } from '../../../../net/message'
import type {
  DeviceId,
  DnsRecord,
  DnsZone,
  RecordType,
} from '../../../../net/model'
import type { PacketDoc } from '../../doc'
import * as Check from './fields'
import {
  type Choice,
  type PanelContext,
  type PanelDefinition,
  type PanelTab,
  choice,
  gather,
  gatherAll,
  rowsOf,
  values,
} from './schema'

// Панель DNS-провайдера (`dns-panel`, урок 10): записи домена A, AAAA,
// CNAME, MX, TXT с TTL. «Сохранить» меняет только изменённые группы
// «имя + тип»: одна запись — `setRecord`, несколько — удаление и `addRecord`.

// DEVICE

const labelsOf = (zone: DnsZone): number =>
  zone.name === '' ? 0 : zone.name.split('.').length

const byDepth = Order.flip(Order.mapInput(Order.Number, labelsOf))

type Hosted = Readonly<{ device: DeviceId; zone: DnsZone }>

/** Зоны, за которые отвечают устройства доски (не справочные). */
const hostedZones = (world: PacketDoc): ReadonlyArray<Hosted> =>
  Array.flatMap(world.doc.devices, device =>
    device._tag === 'Host' && device.resolver
      ? []
      : Array.map(zonesOf(device), zone => ({ device: device.id, zone })),
  )

/** Домен панели: самая длинная зона устройства `dns-panel:<id>` или доски. */
const zoneFor = (world: PacketDoc, device: DeviceId): Option.Option<DnsZone> =>
  pipe(
    findDevice(world.doc, device),
    Option.flatMap(found => Array.head(Array.sort(zonesOf(found), byDepth))),
  )

const dnsDevice = (
  world: PacketDoc,
  target: string,
): Option.Option<DeviceId> =>
  target === ''
    ? pipe(
        Array.sort(
          hostedZones(world),
          Order.mapInput(byDepth, ({ zone }: Hosted) => zone),
        ),
        Array.head,
        Option.map(hosted => hosted.device),
      )
    : Option.map(
        Option.filter(findDevice(world.doc, target), found =>
          Array.isReadonlyArrayNonEmpty(zonesOf(found)),
        ),
        found => found.id,
      )

// RECORDS

const TYPES: ReadonlyArray<RecordType> = ['A', 'AAAA', 'CNAME', 'MX', 'TXT']

const TTLS: ReadonlyArray<Choice> = [
  choice('300', strings => strings.dns.ttlAuto),
  choice('3600', strings => strings.dns.ttlHour),
  choice('86400', strings => strings.dns.ttlDay),
]

const typeOf = (value: string): RecordType =>
  Option.getOrElse(
    Array.findFirst(TYPES, type => type === value),
    () => 'A',
  )

const groupKey = (record: DnsRecord): string => `${record.name} ${record.rtype}`

const sameGroup = (
  left: ReadonlyArray<DnsRecord>,
  right: ReadonlyArray<DnsRecord>,
): boolean =>
  left.length === right.length &&
  Array.every(left, (record, index) => {
    const other = right[index]
    return (
      other !== undefined &&
      other.value === record.value &&
      other.ttl === record.ttl
    )
  })

/** Операции, которые превращают записи зоны в нужные: только изменённые
    группы «имя + тип», в порядке строк панели. */
const recordOps = (
  device: DeviceId,
  zone: string,
  current: ReadonlyArray<DnsRecord>,
  wanted: ReadonlyArray<DnsRecord>,
) => {
  const groupOf = (records: ReadonlyArray<DnsRecord>, key: string) =>
    Array.filter(records, record => groupKey(record) === key)
  const keys = Array.dedupe([
    ...Array.map(current, groupKey),
    ...Array.map(wanted, groupKey),
  ])
  return Array.flatMap(keys, key => {
    const before = groupOf(current, key)
    const after = groupOf(wanted, key)
    if (sameGroup(before, after)) {
      return []
    }
    const spec = (record: DnsRecord) => ({
      type: record.rtype,
      name: record.name,
      value: record.value,
      ttl: record.ttl,
    })
    return Array.match(after, {
      onEmpty: () =>
        Array.match(before, {
          onEmpty: () => [],
          onNonEmpty: ([first]) => [
            removeRecord(device, zone, first.name, first.rtype),
          ],
        }),
      onNonEmpty: records =>
        records.length === 1
          ? [setRecord(device, zone, spec(records[0]))]
          : [
              ...(Array.isReadonlyArrayNonEmpty(before)
                ? [
                    removeRecord(
                      device,
                      zone,
                      records[0].name,
                      records[0].rtype,
                    ),
                  ]
                : []),
              ...Array.map(records, record =>
                addRecord(device, zone, spec(record)),
              ),
            ],
    })
  })
}

const zoneOf = (context: PanelContext): Option.Option<DnsZone> =>
  zoneFor(context.world, context.device)

const recordsTab: PanelTab = {
  id: 'records',
  feature: 'dnsPanel.records',
  label: strings => strings.dns.tab,
  fields: context => {
    const ttls = Option.match(zoneOf(context), {
      onNone: () => TTLS,
      onSome: zone =>
        Array.dedupeWith(
          [
            ...TTLS,
            ...Array.map(zone.records, record =>
              choice(`${record.ttl}`, strings =>
                strings.dns.ttlSeconds(record.ttl),
              ),
            ),
          ],
          (left: Choice, right: Choice) => left.value === right.value,
        ),
    })
    return [
      {
        _tag: 'List',
        id: 'records',
        label: strings => strings.dns.records,
        columns: [
          {
            _tag: 'Select',
            id: 'type',
            label: strings => strings.dns.type,
            choices: Array.map(TYPES, type => choice(type, () => type)),
          },
          {
            _tag: 'Input',
            id: 'name',
            label: strings => strings.dns.name,
            input: 'text',
            placeholder: strings => strings.dns.namePlaceholder,
          },
          {
            _tag: 'Input',
            id: 'value',
            label: strings => strings.dns.value,
            input: 'text',
          },
          {
            _tag: 'Select',
            id: 'ttl',
            label: strings => strings.dns.ttl,
            choices: ttls,
          },
        ],
        newRow: { type: 'A', name: '@', value: '', ttl: '300' },
      },
    ]
  },
  read: context =>
    values(
      {},
      {
        records: Option.match(zoneOf(context), {
          onNone: () => [],
          onSome: zone =>
            Array.map(zone.records, (record, index) => ({
              id: `r${index}`,
              cells: {
                type: record.rtype,
                name: record.name,
                value: record.value,
                ttl: `${record.ttl}`,
              },
            })),
        }),
      },
    ),
  save: (context, draft) =>
    Option.match(zoneOf(context), {
      onNone: () => Result.succeed([]),
      onSome: zone =>
        Result.map(
          gatherAll(
            Array.map(rowsOf(draft, 'records'), row => {
              const cell = Check.cell<string>('records', row)
              return Result.map(
                gather({
                  name: cell('name', Check.text),
                  value: cell('value', Check.text),
                }),
                ({ name, value }): DnsRecord =>
                  normalizeRecord(zone.name, {
                    name,
                    rtype: typeOf(row.cells['type'] ?? ''),
                    value,
                    ttl: globalThis.Number(row.cells['ttl'] ?? '300'),
                  }),
              )
            }),
          ),
          wanted => recordOps(context.device, zone.name, zone.records, wanted),
        ),
    }),
  blame: (message: NetMessage) =>
    Array.contains(
      [
        'RecordNeedsAddress',
        'CnameNeedsName',
        'CnameAtApex',
        'CnameConflict',
        'EmptyName',
        'UnknownRecord',
      ],
      message._tag,
    )
      ? Option.some('records')
      : Option.none(),
}

// PANEL

export const dnsPanel: PanelDefinition = {
  type: 'dns-panel',
  feature: 'dnsPanel',
  device: dnsDevice,
  tabLabel: (maybeContext, strings) =>
    Option.match(Option.flatMap(maybeContext, zoneOf), {
      onNone: () => strings.dns.surfaceTab('DNS'),
      onSome: zone => strings.dns.surfaceTab(zone.name),
    }),
  heading: context =>
    Option.match(zoneOf(context), {
      onNone: () => context.name(context.device),
      onSome: zone => `${zone.name} · ${context.name(context.device)}`,
    }),
  tabs: [recordsTab],
}
