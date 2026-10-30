import { Option } from 'effect'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import {
  annotate,
  expand,
  openEnvelope,
  packet,
  pauseAt,
  play,
  printout,
  showTable,
} from '../../../../kinds/packet/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import { inSubnet } from '../../../../net/address'
import { lastReplyOf } from '../../../../net/answers'
import {
  add,
  cable,
  host,
  radio,
  router,
  send,
  setLinkUp,
  setStatic,
  tcp,
  transit,
  transitRoute,
  udp,
  wifi,
} from '../../../../net/build'
import { Goal } from '../../../../net/goals'
import { Intent } from '../../../../net/packet'
import { sendIntent } from '../../../../net/world'

// Урок 8 «Маршрутизация и шлюз» по сценарию
// docs/plans/networks-lessons/08-routing.md: всё «не в наш дом» ноутбук
// отдаёт gateway — домашнему router; дальше каждый router по своей routing
// table знает только следующий шаг; traceroute показывает отделения по
// порядку. Цепочка — та же, что в уроке 4 (id, подписи, координаты и
// задержки), теперь с адресами, именами для traceroute и таблицами.

const HOME_SSID = 'Router-7C21'
const HOME_PASSWORD = '12345678'
const LAPTOP_MAC = '3c:22:fb:4a:10:42'
const SHOP_IP = '198.51.100.10'

const homeWifi = { ssid: HOME_SSID, password: HOME_PASSWORD }

/** Принтер получает адрес по DHCP вторым, после телефона. */
export const PRINTER_IP = '192.168.1.101'

/** Адрес из домашней сети 192.168.1.0/24: по нему тексты задачи отличают
    чужой gateway в доме от адреса из другой сети. */
export const isHomeAddress = (ip: string): boolean =>
  inSubnet(ip, '192.168.1.1', 24)

/** Первые три числа адреса — номер сети /24: «192.168.0.». */
export const networkPrefixOf = (ip: string): string =>
  `${ip.split('.').slice(0, 3).join('.')}.`

const shopPage = Intent.Browse({ from: 'laptop', url: 'https://shop.example/' })
const pingPrinter = Intent.Ping({ from: 'laptop', host: PRINTER_IP })
const pingShop = Intent.Ping({ from: 'laptop', host: SHOP_IP })
const traceShop = Intent.Traceroute({ from: 'laptop', host: 'shop.example' })

/** Последнее отделение, ответившее traceroute: ответ квиза считает движок. */
const lastReply = (world: PacketDoc): string =>
  Option.getOrElse(lastReplyOf(sendIntent(world, traceShop)[0]), () => '')

export default defineLesson(packet, {
  slug: 'routing',
  labels: [
    'phone',
    'laptop',
    'printer',
    'router',
    'isp',
    'core',
    'hosting',
    'dns',
    'shop',
  ],
  steps: [
    {
      id: 'gateway',
      ops: [
        add(
          router('router', 300, 300, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.7',
            dns: '192.0.2.53',
            wifi: wifi(HOME_SSID, HOME_PASSWORD),
            reservations: [{ mac: LAPTOP_MAC, ip: '192.168.1.42' }],
          }),
        ),
        add(host('phone', 'phone', 110, 170, { wifi: homeWifi })),
        add(
          host('laptop', 'laptop', 110, 300, {
            mac: LAPTOP_MAC,
            wifi: homeWifi,
          }),
        ),
        add(host('printer', 'printer', 110, 430)),
        add(
          transit('isp', 530, 300, {
            ip: '203.0.113.1',
            name: 'gw.isp.example',
            routes: [
              transitRoute('203.0.113.0/24'),
              transitRoute('0.0.0.0/0', 'core'),
            ],
          }),
        ),
        add(
          transit('core', 715, 300, {
            ip: '192.0.2.1',
            name: 'core.isp.example',
            routes: [
              transitRoute('192.0.2.0/24'),
              transitRoute('203.0.113.0/24', 'isp'),
              transitRoute('198.51.100.0/24', 'hosting'),
            ],
          }),
        ),
        add(
          transit('hosting', 900, 300, {
            ip: '198.51.100.1',
            name: 'gw.hosting.example',
            routes: [
              transitRoute('198.51.100.0/24'),
              transitRoute('0.0.0.0/0', 'core'),
            ],
          }),
        ),
        add(
          host('dns', 'server', 715, 130, {
            address: '192.0.2.53/24',
            listeners: [udp(53)],
            records: [{ name: 'shop.example', ip: SHOP_IP }],
          }),
        ),
        add(
          host('shop', 'server', 900, 490, {
            address: `${SHOP_IP}/24`,
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
        cable('router', 'isp'),
        cable('isp', 'core'),
        cable('core', 'dns'),
        cable('core', 'hosting'),
        cable('hosting', 'shop'),
        // Сайт уже открывали: адрес shop.example в контактах ноутбука,
        // поэтому на доске нет вопроса справочной, а traceroute по имени
        // сразу шлёт пробы.
        send(shopPage),
      ],
      stage: [
        expand('internet'),
        play(pingPrinter, { show: 'letters' }),
        play(pingShop, { show: 'letters' }),
        openEnvelope('link'),
        pauseAt('router'),
        annotate('router', 'gatewayTag', 'info'),
      ],
    },
    {
      id: 'route-tables',
      ops: [],
      stage: [
        expand('internet'),
        play(shopPage, { show: 'letters' }),
        pauseAt('router'),
        pauseAt('isp'),
        pauseAt('core'),
        pauseAt('hosting'),
        showTable('router', 'routes'),
        showTable('isp', 'routes'),
        showTable('core', 'routes'),
        showTable('hosting', 'routes'),
      ],
    },
    {
      id: 'traceroute',
      ops: [],
      stage: [
        expand('internet'),
        play(traceShop, { show: 'letters' }),
        printout('laptop', 'traceroute shop.example'),
      ],
    },
    {
      id: 'where-it-breaks',
      ops: [setLinkUp('core', 'hosting', false)],
      stage: [
        expand('internet'),
        printout('laptop', 'traceroute shop.example'),
        play(pingShop, { show: 'letters' }),
      ],
      quiz: {
        id: 'where-it-breaks',
        kind: 'PickDevice',
        candidates: ['router', 'isp', 'core', 'hosting', 'shop'],
        answer: lastReply,
        hideUntilAnswered: ['play', 'links'],
      },
    },
    {
      id: 'fix-gateway',
      ops: [
        setLinkUp('core', 'hosting', true),
        setStatic('laptop', '192.168.1.42/24', '192.168.1.254', '192.0.2.53'),
      ],
      stage: [expand('internet'), play(pingShop, { show: 'letters' })],
      task: {
        id: 'fix-gateway',
        palette: [],
        surfaces: ['board', 'terminal:laptop', 'wifi:laptop'],
        goals: [
          { id: 'out', goal: Goal.CanReach({ intent: pingShop }) },
          { id: 'site', goal: Goal.CanReach({ intent: shopPage }) },
          { id: 'printer', goal: Goal.CanReach({ intent: pingPrinter }) },
        ],
        solution: [
          setStatic('laptop', '192.168.1.42/24', '192.168.1.1', '192.0.2.53'),
        ],
      },
    },
    {
      id: 'summary',
      ops: [],
      stage: [
        expand('internet'),
        play(traceShop, { show: 'letters' }),
        printout('laptop', 'traceroute shop.example'),
      ],
    },
  ],
})
