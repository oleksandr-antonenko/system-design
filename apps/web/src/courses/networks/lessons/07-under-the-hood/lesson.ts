import { Array, Option, pipe } from 'effect'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import {
  builder,
  openEnvelope,
  packet,
  pauseAt,
  play,
} from '../../../../kinds/packet/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import {
  add,
  cable,
  host,
  internet,
  radio,
  router,
  send,
  tcp,
  udp,
  wifi,
} from '../../../../net/build'
import { goals } from '../../../../net/goals'
import { Intent, type StackLevel, levelOf } from '../../../../net/packet'
import { sendIntent } from '../../../../net/world'

// Урок 7 «TCP/IP. Конверт в конверте» по сценарию
// docs/plans/networks-lessons/07-under-the-hood.md: конверт из урока 1 — это
// несколько вложенных конвертов (layers). Внешний (frame с MAC) меняется на
// каждом хопе, IP-адрес получателя, port и просьба доезжают до сайта. Дом —
// тот же, что в уроке 6, без dev-сервера.

const HOME_SSID = 'Router-7C21'
const HOME_PASSWORD = '12345678'
const LAPTOP_MAC = '3c:22:fb:4a:10:42'
const SHOP_URL = 'https://shop.example/'

const homeWifi = { ssid: HOME_SSID, password: HOME_PASSWORD }

const shopPage = Intent.Browse({ from: 'phone', url: SHOP_URL })

/** Итог: полная трасса первого открытия страницы. Телефон после задачи
    уже помнит MAC address роутера и адрес сайта, поэтому весь путь — с
    поиском MAC и вопросом справочной — показывает ноутбук. */
const laptopFirstVisit = Intent.Browse({ from: 'laptop', url: SHOP_URL })

/** Только запрос страницы и ответ: без справочной, поиска MAC и рукопожатий. */
const request = play(shopPage, { show: 'request' })

/** Эталон задачи: слои снаружи внутрь. */
export const STACK_ORDER: ReadonlyArray<StackLevel> = [
  'link',
  'internet',
  'transport',
  'application',
]

/** Слой поля 443 в конверте запроса страницы: считает движок. */
const portLevel = (world: PacketDoc): string =>
  pipe(
    sendIntent(world, shopPage)[0].hops,
    Array.findFirst(hop =>
      Array.some(hop.envelope, layer => layer._tag === 'Http'),
    ),
    Option.flatMap(hop =>
      Array.findFirst(
        hop.envelope,
        layer =>
          (layer._tag === 'Tcp' || layer._tag === 'Udp') && layer.dst === 443,
      ),
    ),
    Option.match({
      onNone: () => '',
      onSome: layer => `env:${levelOf(layer)}`,
    }),
  )

export default defineLesson(packet, {
  slug: 'under-the-hood',
  labels: ['phone', 'laptop', 'printer', 'router', 'internet', 'dns', 'shop'],
  steps: [
    {
      id: 'open-envelope',
      ops: [
        add(
          router('router', 352, 325, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.7',
            dns: '192.0.2.53',
            wifi: wifi(HOME_SSID, HOME_PASSWORD),
            reservations: [{ mac: LAPTOP_MAC, ip: '192.168.1.42' }],
          }),
        ),
        add(host('phone', 'phone', 130, 210, { wifi: homeWifi })),
        add(
          host('laptop', 'laptop', 130, 440, {
            mac: LAPTOP_MAC,
            wifi: homeWifi,
          }),
        ),
        add(host('printer', 'printer', 300, 500)),
        add(internet('internet', 606, 325)),
        add(
          host('dns', 'server', 606, 120, {
            address: '192.0.2.53/24',
            listeners: [udp(53)],
            records: [{ name: 'shop.example', ip: '198.51.100.10' }],
          }),
        ),
        add(
          host('shop', 'server', 818, 325, {
            address: '198.51.100.10/24',
            listeners: [tcp(80), tcp(443)],
            certs: [
              {
                names: ['shop.example'],
                issuer: 'Example CA',
                notAfter: '2030-12-31',
              },
            ],
          }),
        ),
        radio('phone', 'router'),
        radio('laptop', 'router'),
        cable('printer', 'router'),
        cable('router', 'internet'),
        cable('internet', 'dns'),
        cable('internet', 'shop'),
      ],
      stage: [request, pauseAt('router')],
    },
    {
      id: 'four-layers',
      ops: [],
      stage: [request, pauseAt('router'), openEnvelope('application')],
    },
    {
      id: 'mac',
      ops: [],
      stage: [request, pauseAt('router'), openEnvelope('link')],
    },
    {
      id: 'which-layer',
      ops: [],
      stage: [request, pauseAt('router'), openEnvelope('transport')],
      quiz: {
        id: 'which-layer',
        kind: 'PickLayer',
        candidates: [
          'env:link',
          'env:internet',
          'env:transport',
          'env:application',
        ],
        answer: portLevel,
      },
    },
    {
      id: 'pack',
      ops: [],
      stage: [builder('phone', SHOP_URL)],
      task: {
        id: 'pack',
        palette: [],
        surfaces: ['board'],
        goals: [
          {
            id: 'router-reads',
            goal: goals.performed('phone', 'internet', {
              intent: 'Raw',
              reaches: true,
            }),
          },
          {
            id: 'shop-gets',
            goal: goals.performed('phone', 'shop', { intent: 'Raw' }),
          },
        ],
        solution: [
          send(
            Intent.Raw({ from: 'phone', url: SHOP_URL, order: STACK_ORDER }),
          ),
        ],
      },
    },
    {
      id: 'summary',
      ops: [],
      stage: [play(laptopFirstVisit)],
    },
  ],
})
