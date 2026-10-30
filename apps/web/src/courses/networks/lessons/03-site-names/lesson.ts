import { Option } from 'effect'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import {
  annotate,
  highlight,
  packet,
  play,
  showTable,
} from '../../../../kinds/packet/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import { firstAddressee } from '../../../../net/answers'
import {
  add,
  cable,
  host,
  internet,
  radio,
  router,
  send,
  setDns,
  tcp,
  udp,
  wifi,
} from '../../../../net/build'
import { Goal, goals } from '../../../../net/goals'
import { Intent } from '../../../../net/packet'
import { sendIntent } from '../../../../net/world'

// Урок 3 «Имя сайта и его адрес» по сценарию
// docs/plans/networks-lessons/03-site-names.md: людям удобны имена, сетям
// нужны адреса; перед первым конвертом сайту телефон спрашивает адрес у
// DNS server («справочной») и записывает ответ в DNS cache («контакты»).

const SSID = 'Router-7C21'
const PASSWORD = '12345678'
const LAPTOP_MAC = '3c:22:fb:4a:10:42'
const DNS_IP = '192.0.2.53'
const SHOP_IP = '198.51.100.10'

const homeWifi = { ssid: SSID, password: PASSWORD }

const browse = Intent.Browse({ from: 'phone', url: 'https://shop.example/' })

/** Шаг 1: справочной на доске ещё нет, поэтому конверт идёт сразу по адресу
    сайта — только запрос и ответ, как в уроках 1–2. */
const byAddress = Intent.Browse({
  from: 'phone',
  url: `http://${SHOP_IP}/`,
})

/** Кому телефон пишет первым: адресат первого IP-конверта, считает движок. */
const firstLetter = (world: PacketDoc): string =>
  Option.getOrElse(firstAddressee(sendIntent(world, browse)[0]), () => '')

export default defineLesson(packet, {
  slug: 'site-names',
  labels: ['phone', 'laptop', 'router', 'internet', 'dns', 'shop'],
  steps: [
    {
      id: 'names',
      ops: [
        add(
          router('router', 352, 325, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.7',
            dns: DNS_IP,
            wifi: wifi(SSID, PASSWORD),
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
        add(internet('internet', 606, 325)),
        add(
          host('shop', 'server', 818, 325, {
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
        cable('router', 'internet'),
        cable('internet', 'shop'),
      ],
      stage: [
        highlight('shop', 'info'),
        annotate('shop', 'siteName', 'info'),
        play(byAddress),
      ],
    },
    {
      id: 'ask-first',
      ops: [
        add(
          host('dns', 'server', 606, 120, {
            address: `${DNS_IP}/24`,
            listeners: [udp(53)],
            records: [{ name: 'shop.example', ip: SHOP_IP }],
          }),
        ),
        cable('internet', 'dns'),
      ],
      stage: [showTable('phone', 'contacts'), play(browse)],
    },
    {
      id: 'who-first',
      ops: [],
      stage: [play(browse)],
      quiz: {
        id: 'who-first',
        kind: 'PickDevice',
        candidates: ['router', 'dns', 'shop'],
        answer: firstLetter,
        hideUntilAnswered: ['play'],
      },
    },
    {
      id: 'no-dns',
      ops: [setDns('phone', { mode: 'manual', servers: [] }), send(browse)],
      stage: [play(browse)],
      task: {
        id: 'no-dns',
        palette: [],
        surfaces: ['board', 'browser:phone', 'wifi:phone'],
        goals: [
          { id: 'knows-dns', goal: Goal.HasDnsServer({ device: 'phone' }) },
          {
            id: 'resolves',
            goal: goals.resolves('phone', 'shop.example', SHOP_IP),
          },
          {
            id: 'opens',
            goal: goals.performed('phone', 'shop', { intent: 'Browse' }),
          },
        ],
        solution: [setDns('phone', { mode: 'auto' }), send(browse)],
      },
    },
    {
      id: 'summary',
      ops: [],
      stage: [
        showTable('phone', 'contacts'),
        annotate('phone', 'whereFrom', 'info'),
        play(browse),
      ],
    },
  ],
})
