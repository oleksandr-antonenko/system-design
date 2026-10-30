import { Array, Option, Schema, pipe } from 'effect'

import type { UiStrings } from '../../i18n/ui'
import { findDevice, isProvider } from '../../net/doc'
import {
  type Device,
  type NetDoc,
  deviceKindName,
  kindOf,
} from '../../net/model'
import { StackLevel, sourceOf } from '../../net/packet'
import { wifiOf } from '../../net/topology'
import type { PacketDoc } from './doc'
import type { DeviceTable, PacketStage } from './dsl'

// Цели доски сетей (design D4 add-network-board): что можно подсветить,
// подписать, на что ссылается текст и что выбирают в квизах. И какие
// элементы интерфейса (`UiFeature`) нужны, чтобы цель или элемент сцены
// были видны: по ним тест контента проверяет, что урок пользуется только
// открытым к нему.

export const LINK_PREFIX = 'link:'
export const ENVELOPE_PREFIX = 'env:'
export const ZONE_PREFIX = 'zone:'
export const RULE_PREFIX = 'rule:'
export const DRAFT_PREFIX = 'draft:'
export const STICKER = 'sticker'
export const WALL_PREFIX = 'wall:'

const isStackLevel = Schema.is(StackLevel)

export type TargetRef =
  | Readonly<{ _tag: 'Device'; device: Device }>
  | Readonly<{ _tag: 'Link'; link: string }>
  | Readonly<{ _tag: 'Envelope'; level: StackLevel }>
  | Readonly<{ _tag: 'Zone'; zone: string }>
  | Readonly<{ _tag: 'Sticker' }>
  | Readonly<{ _tag: 'Rule'; device: string; rule: number }>
  | Readonly<{ _tag: 'Draft'; index: number }>
  | Readonly<{ _tag: 'Wall'; index: number }>

const hasCloud = (doc: NetDoc): boolean => Array.some(doc.devices, isProvider)

/** Номер строки правил: `rule:shop:3`; `rule:shop:default` — «все остальные» (0). */
const parseRule = (doc: NetDoc, target: string): Option.Option<TargetRef> => {
  const [device = '', number = ''] = target.slice(RULE_PREFIX.length).split(':')
  return pipe(
    findDevice(doc, device),
    Option.flatMap(found => {
      const rules =
        found._tag === 'Host' || found._tag === 'Router'
          ? found.firewall.rules
          : []
      const index = number === 'default' ? 0 : globalThis.Number(number)
      return globalThis.Number.isInteger(index) &&
        index >= 0 &&
        index <= rules.length
        ? Option.some<TargetRef>({ _tag: 'Rule', device, rule: index })
        : Option.none()
    }),
  )
}

export const parseTarget = (
  doc: NetDoc,
  target: string,
): Option.Option<TargetRef> => {
  if (target.startsWith(LINK_PREFIX)) {
    return Array.some(doc.links, link => `${LINK_PREFIX}${link.id}` === target)
      ? Option.some({ _tag: 'Link', link: target.slice(LINK_PREFIX.length) })
      : Option.none()
  }
  if (target.startsWith(ENVELOPE_PREFIX)) {
    const level = target.slice(ENVELOPE_PREFIX.length)
    return isStackLevel(level)
      ? Option.some({ _tag: 'Envelope', level })
      : Option.none()
  }
  if (target.startsWith(ZONE_PREFIX)) {
    const zone = target.slice(ZONE_PREFIX.length)
    const isZone =
      (zone === 'internet' && hasCloud(doc)) ||
      Array.some(
        doc.devices,
        device =>
          device.id === zone &&
          (device._tag === 'Router' ||
            (device._tag === 'Host' && Option.isSome(device.maybeDocker))),
      ) ||
      Array.isReadonlyArrayNonEmpty(doc.walls)
    return isZone ? Option.some({ _tag: 'Zone', zone }) : Option.none()
  }
  if (target === STICKER) {
    return Array.some(doc.devices, device => Option.isSome(wifiOf(device)))
      ? Option.some({ _tag: 'Sticker' })
      : Option.none()
  }
  if (target.startsWith(RULE_PREFIX)) {
    return parseRule(doc, target)
  }
  if (target.startsWith(WALL_PREFIX)) {
    const index = globalThis.Number(target.slice(WALL_PREFIX.length))
    return globalThis.Number.isInteger(index) &&
      index >= 0 &&
      index < doc.walls.length
      ? Option.some({ _tag: 'Wall', index })
      : Option.none()
  }
  if (target.startsWith(DRAFT_PREFIX)) {
    const index = globalThis.Number(target.slice(DRAFT_PREFIX.length))
    return globalThis.Number.isInteger(index) && index >= 0
      ? Option.some({ _tag: 'Draft', index })
      : Option.none()
  }
  return pipe(
    findDevice(doc, target),
    Option.map((device): TargetRef => ({ _tag: 'Device', device })),
    Option.orElse(() =>
      target === 'internet' && hasCloud(doc)
        ? Option.some<TargetRef>({ _tag: 'Zone', zone: 'internet' })
        : Option.none(),
    ),
  )
}

/** Цель ссылки, подсветки, подписи или кандидата квиза на доске. */
export const resolveTarget = (
  world: PacketDoc,
  target: string,
): Option.Option<string> =>
  Option.map(parseTarget(world.doc, target), () => target)

/** Цели элемента сцены: каждая должна быть на доске своего шага. */
export const stageTargets = (item: PacketStage): ReadonlyArray<string> =>
  item._tag === 'Highlight' || item._tag === 'Annotate'
    ? [item.target]
    : item._tag === 'Play'
      ? [sourceOf(item.intent)]
      : item._tag === 'OpenEnvelope'
        ? [`${ENVELOPE_PREFIX}${item.level}`]
        : item._tag === 'PauseAt' ||
            item._tag === 'ShowTable' ||
            item._tag === 'Printout' ||
            item._tag === 'Walk' ||
            item._tag === 'ShowCert'
          ? [item.device]
          : item._tag === 'Scan'
            ? [item.from, item.target]
            : item._tag === 'RunAll'
              ? Array.map(item.rows, row => sourceOf(row.intent))
              : item._tag === 'Fog'
                ? item.visible
                : item._tag === 'Builder'
                  ? [item.from]
                  : []

// FEATURES

const tableFeature: Readonly<Record<DeviceTable, string>> = {
  mac: 'board.deviceMac',
  arp: 'board.deviceMac',
  routes: 'board.routes',
  leases: 'board.natTable',
  nat: 'board.natTable',
  dns: 'board.resolverCache',
  contacts: 'board.contacts',
  records: 'board.resolverCache',
  ports: 'board.ports',
  rules: 'board.firewall',
}

/** Что должно быть открыто, чтобы элемент сцены был виден (план 3.4). */
const elementFeatures = (item: PacketStage): ReadonlyArray<string> =>
  item._tag === 'Play' || item._tag === 'PauseAt'
    ? ['transport.run', 'board.envelope']
    : item._tag === 'OpenEnvelope'
      ? ['board.envelopeLayers']
      : item._tag === 'ShowTable'
        ? ['board.deviceCard', tableFeature[item.table]]
        : item._tag === 'Printout'
          ? ['board.printout']
          : item._tag === 'Scan'
            ? ['board.portScan']
            : item._tag === 'Preview'
              ? ['board.draft']
              : item._tag === 'RunAll'
                ? ['board.finalRun']
                : item._tag === 'Fog'
                  ? ['board.fog']
                  : item._tag === 'Ladder'
                    ? ['board.checkLadder']
                    : item._tag === 'Walk' || item._tag === 'Room'
                      ? ['board.floorPlan']
                      : item._tag === 'Builder'
                        ? ['envelope.builder']
                        : item._tag === 'Place'
                          ? ['board.sandbox']
                          : ['board.devices']

/** Элемент сцены и то, что он показывает: договорённость о шифре в показе
    — часть запечатанного конверта, паспорт сайта на доске — тот же просмотр
    certificate, что и в браузере (урок 11). */
export const stageFeatures = (item: PacketStage): ReadonlyArray<string> => [
  ...elementFeatures(item),
  ...(item._tag === 'Play' && item.show === 'handshake'
    ? ['board.sealedEnvelope']
    : []),
  ...(item._tag === 'ShowCert' ? ['browser.certificate'] : []),
]

/** Что должно быть открыто, чтобы цель ссылки была видна на доске. */
export const targetFeatures = (
  doc: NetDoc,
  target: string,
): ReadonlyArray<string> =>
  Option.match(parseTarget(doc, target), {
    onNone: () => [],
    onSome: ref =>
      ref._tag === 'Sticker'
        ? ['board.routerSticker']
        : ref._tag === 'Envelope'
          ? ['board.envelopeLayers']
          : ref._tag === 'Rule'
            ? ['board.firewall']
            : ref._tag === 'Draft'
              ? ['board.draft']
              : ref._tag === 'Wall'
                ? ['board.floorPlan']
                : ref._tag === 'Device'
                  ? ref.device._tag === 'Transit'
                    ? ['board.routerChain']
                    : kindOf(ref.device) === 'resolver'
                      ? ['board.dnsServer']
                      : ref.device._tag === 'Switch'
                        ? ['board.switch']
                        : ['board.devices']
                  : ['board.devices'],
  })

// NAMES

/** Как назвать цель, если урок не дал ей подписи: вид устройства, связь
    «a — b», слой конверта, строка правил. */
export const targetName = (
  world: PacketDoc,
  target: string,
  ui: UiStrings,
): string =>
  target.includes('+')
    ? Array.map(target.split('+'), part => targetName(world, part, ui)).join(
        ', ',
      )
    : Option.match(parseTarget(world.doc, target), {
        onNone: () => target,
        onSome: ref =>
          ref._tag === 'Device'
            ? deviceKindName[kindOf(ref.device)]
            : ref._tag === 'Link'
              ? ref.link.replace('-', ' — ')
              : ref._tag === 'Envelope'
                ? ui.packetBoard.envelope.levels[ref.level]
                : ref._tag === 'Sticker'
                  ? ui.packetBoard.sticker.title
                  : ref._tag === 'Rule'
                    ? ref.rule === 0
                      ? ui.packetBoard.card.defaultRule
                      : `${ui.packetBoard.card.tables.rules} · ${ref.rule}`
                    : ref._tag === 'Zone'
                      ? ref.zone === 'internet'
                        ? ui.packetBoard.zone.internet
                        : ref.zone
                      : ref._tag === 'Wall'
                        ? `${ui.packetBoard.zone.wall} ${ref.index + 1}`
                        : `${ui.packetBoard.draft} ${ref.index + 1}`,
      })
