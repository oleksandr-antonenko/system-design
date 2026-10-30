import { Array, Option, Result, pipe } from 'effect'

import {
  add,
  cable,
  host,
  internet,
  radio,
  router,
  tcp,
  udp,
  wifi,
} from './build'
import { type NetOp, applyAll } from './doc'
import { type NetDoc, emptyNet, emptyState } from './model'
import { type Hop, type Layer, type Trace } from './packet'
import { type World, applyAllWorld } from './world'

// Сети и помощники для тестов модели пакетов. Адреса только
// документационные (RFC 5737) и частные, домены — в зоне .example.

export const HOME_SSID = 'Router-7C21'
export const HOME_PASSWORD = '12345678'
export const LAPTOP_MAC = '3c:22:fb:4a:10:42'

/** Домашний роутер всех уроков: `Router-7C21`, DNS провайдера, ноутбук
    закреплён на .42. */
export const homeRouter: NetOp = add(
  router('router', 340, 360, {
    lan: '192.168.1.1/24',
    wan: '203.0.113.7',
    dns: '192.0.2.53',
    wifi: wifi(HOME_SSID, HOME_PASSWORD),
    reservations: [{ mac: LAPTOP_MAC, ip: '192.168.1.42' }],
  }),
)

/** Дом из урока 1: телефон и ноутбук по Wi-Fi у роутера, роутер кабелем в
    облако, в облаке магазин и справочная. */
export const homeOps: ReadonlyArray<NetOp> = [
  add(internet('internet', 590, 360)),
  homeRouter,
  add(
    host('phone', 'phone', 200, 300, {
      wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
    }),
  ),
  add(
    host('laptop', 'laptop', 200, 450, {
      mac: LAPTOP_MAC,
      wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
    }),
  ),
  add(
    host('shop', 'server', 820, 360, {
      address: '198.51.100.10/24',
      listeners: [tcp(80), tcp(443)],
      certs: [
        {
          names: ['shop.example'],
          issuer: 'Example CA',
          notAfter: '2027-03-14',
        },
      ],
    }),
  ),
  add(
    host('dns', 'server', 590, 140, {
      address: '192.0.2.53/24',
      listeners: [udp(53)],
      records: [{ name: 'shop.example', ip: '198.51.100.10' }],
    }),
  ),
  radio('phone', 'router'),
  radio('laptop', 'router'),
  cable('router', 'internet'),
  cable('internet', 'shop'),
  cable('internet', 'dns'),
]

/** Строгая сборка: тест падает на первой отказанной операции. */
export const buildNet = (
  ops: ReadonlyArray<NetOp>,
  doc: NetDoc = emptyNet,
): NetDoc =>
  Result.getOrThrowWith(
    applyAll(doc, ops),
    refusal => new Error(`refused: ${JSON.stringify(refusal)}`),
  )

export const homeNet = (): NetDoc => buildNet(homeOps)

/** Строгая сборка мира: документ и состояние после операций. */
export const buildWorld = (
  ops: ReadonlyArray<NetOp>,
  doc: NetDoc = emptyNet,
): World =>
  Result.getOrThrowWith(
    applyAllWorld({ doc, state: emptyState }, ops),
    refusal => new Error(`refused: ${JSON.stringify(refusal)}`),
  )

export const tagsOf = (hop: Hop): ReadonlyArray<Layer['_tag']> =>
  Array.map(hop.envelope, layer => layer._tag)

/** Тег самого внутреннего слоя: по нему видно, чей это пакет. */
export const innerTag = (hop: Hop): Layer['_tag'] =>
  pipe(
    Array.last(hop.envelope),
    Option.map(layer => layer._tag),
    Option.getOrElse((): Layer['_tag'] => 'Ethernet'),
  )

export const layerOf = <Tag extends Layer['_tag']>(
  hop: Hop,
  tag: Tag,
): Extract<Layer, { readonly _tag: Tag }> =>
  Option.getOrThrowWith(
    Array.findFirst(
      hop.envelope,
      (layer): layer is Extract<Layer, { readonly _tag: Tag }> =>
        layer._tag === tag,
    ),
    () => new Error(`no ${tag} in hop ${hop.from}->${hop.to}`),
  )

/** Хопы одного пакета по порядку. */
export const hopsOfPacket = (
  trace: Trace,
  packet: number,
): ReadonlyArray<Hop> => Array.filter(trace.hops, hop => hop.packet === packet)

/** Первый пакет, в конверте которого есть слой с тегом и условием. */
export const firstPacketWith = (
  trace: Trace,
  predicate: (layer: Layer) => boolean,
): number =>
  Option.getOrThrowWith(
    pipe(
      trace.hops,
      Array.findFirst(hop => Array.some(hop.envelope, predicate)),
      Option.map(hop => hop.packet),
    ),
    () => new Error('no such packet'),
  )

/** Маршрут пакета как «откуда>куда» по хопам. */
export const routeOf = (trace: Trace, packet: number): ReadonlyArray<string> =>
  Array.map(hopsOfPacket(trace, packet), hop => `${hop.from}>${hop.to}`)
