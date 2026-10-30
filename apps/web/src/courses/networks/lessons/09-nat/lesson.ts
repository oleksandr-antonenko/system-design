import { Option } from 'effect'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import {
  annotate,
  highlight,
  openEnvelope,
  packet,
  pauseAt,
  play,
  showTable,
} from '../../../../kinds/packet/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import { macFromId } from '../../../../net/address'
import { sourceAddressSeenBy } from '../../../../net/answers'
import {
  add,
  cable,
  forward,
  host,
  internet,
  radio,
  reserve,
  router,
  send,
  tcp,
  udp,
  wifi,
} from '../../../../net/build'
import { Goal, goals } from '../../../../net/goals'
import { Intent } from '../../../../net/packet'
import { sendIntent } from '../../../../net/world'

// Урок 9 «NAT и port forwarding» по сценарию
// docs/plans/networks-lessons/09-nat.md: домашние адреса работают только
// дома (у друга тот же 192.168.1.100), на выходе router ставит на конверт свой
// обратный адрес 203.0.113.7 и записывает это в NAT table, поэтому снаружи в
// дом не зайти. Задача — закрепить за игровым PC адрес и пробросить на него
// только port 25565.

const HOME_SSID = 'Router-7C21'
const HOME_PASSWORD = '12345678'
const LAPTOP_MAC = '3c:22:fb:4a:10:42'
const FRIEND_SSID = 'Friend-Home'
const FRIEND_PASSWORD = 'friend2024'

const homeWifi = { ssid: HOME_SSID, password: HOME_PASSWORD }
const friendWifi = { ssid: FRIEND_SSID, password: FRIEND_PASSWORD }

/** Внешний адрес домашнего router: так дом виден из интернета. */
const HOME_WAN = '203.0.113.7'
const GAME_PORT = 25565
const DATABASE_PORT = 5432
const PC_ADDRESS = '192.168.1.50'

const friendToLaptop = Intent.Ping({ from: 'friend', host: '192.168.1.42' })
export const shopPage = Intent.Browse({
  from: 'laptop',
  url: 'https://shop.example/',
})
export const friendGame = Intent.Connect({
  from: 'friend',
  host: HOME_WAN,
  port: GAME_PORT,
})

/** Ноутбук уже знает адрес сайта: разговор с сайтом на доске идёт без
    вопроса справочной, и в NAT table появляется одна строка — к сайту. */
const knowsShop = [
  send(Intent.Resolve({ from: 'laptop', name: 'shop.example' })),
]

/** Обратный адрес, который видит сайт магазина: считает движок по трассе. */
const addressSeenByShop = (world: PacketDoc): string =>
  Option.getOrElse(
    sourceAddressSeenBy(sendIntent(world, shopPage)[0], 'shop'),
    () => '',
  )

export default defineLesson(packet, {
  slug: 'nat',
  labels: [
    'phone',
    'laptop',
    'printer',
    'pc',
    'router',
    'internet',
    'dns',
    'shop',
    'friend-router',
    'friend',
    'zone:friend-router',
  ],
  steps: [
    {
      id: 'home-only',
      ops: [
        add(
          router('router', 300, 300, {
            lan: '192.168.1.1/24',
            wan: HOME_WAN,
            dns: '192.0.2.53',
            wifi: wifi(HOME_SSID, HOME_PASSWORD),
            reservations: [{ mac: LAPTOP_MAC, ip: '192.168.1.42' }],
          }),
        ),
        add(host('phone', 'phone', 110, 90, { wifi: homeWifi })),
        add(
          host('laptop', 'laptop', 110, 230, {
            mac: LAPTOP_MAC,
            wifi: homeWifi,
          }),
        ),
        add(host('printer', 'printer', 110, 370)),
        add(
          host('pc', 'pc', 110, 510, {
            listeners: [tcp(GAME_PORT), tcp(DATABASE_PORT)],
          }),
        ),
        add(internet('internet', 520, 300)),
        add(
          host('dns', 'server', 520, 110, {
            address: '192.0.2.53/24',
            listeners: [udp(53)],
            records: [{ name: 'shop.example', ip: '198.51.100.10' }],
          }),
        ),
        add(
          host('shop', 'server', 740, 200, {
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
        add(
          router('friend-router', 740, 460, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.77',
            dns: '192.0.2.53',
            wifi: wifi(FRIEND_SSID, FRIEND_PASSWORD),
          }),
        ),
        add(host('friend', 'laptop', 900, 460, { wifi: friendWifi })),
        radio('phone', 'router'),
        radio('laptop', 'router'),
        cable('printer', 'router'),
        cable('pc', 'router'),
        cable('router', 'internet'),
        cable('internet', 'dns'),
        cable('internet', 'shop'),
        cable('friend-router', 'internet'),
        radio('friend', 'friend-router'),
      ],
      stage: [
        play(friendToLaptop),
        annotate('phone', 'sameAsFriend', 'info'),
        annotate('friend', 'sameAsPhone', 'info'),
        annotate('router', 'outside', 'info'),
      ],
    },
    {
      id: 'nat',
      ops: [],
      stage: [
        play(shopPage, { show: 'letters', after: knowsShop }),
        pauseAt('router'),
        pauseAt('internet'),
        openEnvelope('internet'),
        showTable('router', 'nat'),
      ],
    },
    {
      id: 'no-way-in',
      ops: [],
      stage: [
        play(friendGame, { show: 'letters' }),
        annotate('friend', 'timedOut', 'bad'),
        annotate('pc', 'gameServer', 'info'),
      ],
    },
    {
      id: 'what-site-sees',
      ops: [],
      // NOTE: без проигрывания: у квиза `Choice` доска не прячет его до
      // ответа (`hideUntilAnswered` работает только в квизах на доске), а
      // конверт за router показал бы ответ.
      stage: [highlight('laptop', 'info'), highlight('shop', 'info')],
      quiz: {
        id: 'what-site-sees',
        kind: 'Choice',
        candidates: ['192.168.1.42', '192.168.1.1', HOME_WAN, '198.51.100.10'],
        answer: addressSeenByShop,
      },
    },
    {
      id: 'let-friend-in',
      ops: [],
      stage: [play(friendGame, { show: 'letters' })],
      task: {
        id: 'let-friend-in',
        palette: [],
        surfaces: ['board', 'router'],
        goals: [
          {
            id: 'pc-address',
            goal: Goal.HasAddress({
              device: 'pc',
              maybeIp: Option.some(PC_ADDRESS),
            }),
          },
          { id: 'friend-in', goal: Goal.CanReach({ intent: friendGame }) },
          {
            id: 'only-game',
            goal: goals.onlyOpenPorts(HOME_WAN, 'friend', [GAME_PORT]),
          },
        ],
        solution: [
          reserve('router', macFromId('pc'), PC_ADDRESS),
          forward('router', {
            proto: 'tcp',
            outsidePort: GAME_PORT,
            insideIp: PC_ADDRESS,
            insidePort: GAME_PORT,
          }),
        ],
      },
    },
    {
      id: 'summary',
      ops: [],
      stage: [
        play(friendGame, { show: 'letters' }),
        annotate('pc', 'friendPlays', 'ok'),
      ],
    },
  ],
})
