import { Array, Option, pipe } from 'effect'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import {
  annotate,
  highlight,
  packet,
  room,
  walk,
} from '../../../../kinds/packet/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import {
  add,
  cable,
  configureWifi,
  host,
  move,
  radio,
  router,
  wall,
  wifi,
} from '../../../../net/build'
import { Goal } from '../../../../net/goals'
import { associationOf, hostLinkOf } from '../../../../net/topology'

// Урок 5 (docs/plans/networks-lessons/05-wifi-range.md): план квартиры,
// стены и два диапазона. Роутер в комнате, кухня за двумя стенами: 5 ГГц
// (дальность 280) туда не достаёт, 2,4 ГГц (450) достаёт. Телефон на кухне —
// 345 по прямой и +40 за каждую стену: 425; лампочка — 349 и 429.
//
// Задача решается на панели роутера, вкладка «Wi-Fi»: «Сохранить» пишет в
// журнал `configureWifi` с тем же каналом, что и эталон.

const SSID = 'Router-7C21'
const PASSWORD = '12345678'

const remembered = { ssid: SSID, password: PASSWORD }

/** Кандидат квиза, чья радиосвязь с роутером не подключается. */
const notConnected =
  (candidates: ReadonlyArray<string>) =>
  (world: PacketDoc): string =>
    pipe(
      candidates,
      Array.findFirst(candidate =>
        pipe(
          hostLinkOf(world.doc, candidate),
          Option.flatMap(link => associationOf(world.doc, link)),
          Option.exists(association => association._tag === 'NotAssociated'),
        ),
      ),
      Option.getOrElse(() => ''),
    )

const QUIZ_CANDIDATES = ['laptop', 'printer', 'phone'] as const

/** Комнаты плана (сценарий, раздел 2): подписи — `labels['zone:…']`. */
const rooms = [
  room('room', 20, 40, 450, 520),
  room('hall', 470, 40, 90, 520),
  room('kitchen', 560, 40, 380, 520),
]

/** Телефон идёт из комнаты на кухню: полоски сигнала меняются на ходу. */
const toKitchen = walk('phone', [
  [400, 220],
  [515, 250],
  [640, 260],
])

export default defineLesson(packet, {
  slug: 'wifi-range',
  labels: [
    'router',
    'phone',
    'laptop',
    'printer',
    'bulb',
    'zone:room',
    'zone:hall',
    'zone:kitchen',
  ],
  steps: [
    {
      id: 'floor-plan',
      ops: [
        add(
          router('router', 300, 320, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.7',
            dns: '192.0.2.53',
            wifi: wifi(SSID, PASSWORD),
            reservations: [{ mac: '3c:22:fb:4a:10:42', ip: '192.168.1.42' }],
          }),
        ),
        add(host('phone', 'phone', 400, 220, { wifi: remembered })),
        add(
          host('laptop', 'laptop', 420, 400, {
            mac: '3c:22:fb:4a:10:42',
            wifi: remembered,
          }),
        ),
        add(host('printer', 'printer', 180, 440)),
        radio('phone', 'router'),
        radio('laptop', 'router'),
        cable('printer', 'router'),
        wall(470, 40, 470, 470),
        wall(560, 40, 560, 470),
      ],
      stage: [...rooms, highlight('router', 'info'), toKitchen],
    },
    {
      id: 'walls',
      ops: [move('phone', 640, 260)],
      stage: [
        ...rooms,
        annotate('phone', 'behindWalls', 'warn'),
        highlight('wall:0', 'warn'),
        highlight('wall:1', 'warn'),
      ],
    },
    {
      id: 'two-bands',
      ops: [],
      stage: [...rooms, annotate('phone', 'onBand24', 'info'), toKitchen],
    },
    {
      id: 'who-drops',
      ops: [
        configureWifi(
          'router',
          wifi(SSID, PASSWORD, { band: '5', channel: 36 }),
        ),
      ],
      stage: rooms,
      quiz: {
        id: 'who-drops',
        kind: 'PickDevice',
        candidates: QUIZ_CANDIDATES,
        answer: notConnected(QUIZ_CANDIDATES),
        hideUntilAnswered: ['links'],
      },
    },
    {
      id: 'kitchen-wifi',
      ops: [
        add(host('bulb', 'bulb', 640, 400, { wifi: remembered })),
        radio('bulb', 'router'),
      ],
      stage: rooms,
      task: {
        id: 'kitchen-wifi',
        palette: [],
        surfaces: ['board', 'router'],
        goals: [
          {
            id: 'phone',
            goal: Goal.Associated({ device: 'phone', ap: 'router' }),
          },
          {
            id: 'bulb',
            goal: Goal.Associated({ device: 'bulb', ap: 'router' }),
          },
          {
            id: 'password',
            goal: Goal.WifiSecurity({ ap: 'router', min: 'wpa2' }),
          },
        ],
        solution: [
          configureWifi('router', wifi(SSID, PASSWORD, { band: 'dual' })),
        ],
      },
    },
    {
      id: 'summary',
      ops: [],
      stage: [...rooms, annotate('bulb', 'bulbOn', 'ok')],
    },
  ],
})
