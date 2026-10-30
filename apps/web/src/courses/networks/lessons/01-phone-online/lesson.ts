import { Option } from 'effect'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import { expand, packet, pauseAt, play } from '../../../../kinds/packet/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import { exitOf } from '../../../../net/answers'
import {
  add,
  cable,
  forgetWifi,
  host,
  internet,
  joinWifi,
  nearbyAp,
  radio,
  router,
  tcp,
  udp,
  wifi,
} from '../../../../net/build'
import { Goal } from '../../../../net/goals'
import { Intent } from '../../../../net/packet'
import { sendIntent } from '../../../../net/world'

// Урок 1 «Как телефон попадает в интернет» (план, раздел 5; макет
// docs/mockups/networks-lesson-1.html). Новые слова — «роутер» и
// «интернет»; адресов, портов и слоёв на доске нет. Справочная (DNS) есть
// в документе, чтобы имя сайта работало, но доска покажет её с урока 3.

const SSID = 'Router-7C21'
const PASSWORD = '12345678'

const browse = Intent.Browse({ from: 'phone', url: 'https://shop.example/' })
const photo = Intent.Send({ from: 'laptop', to: 'phone', what: 'photo' })

/** Через какое устройство конверт выходит из дома: считает движок. */
const wayOut = (world: PacketDoc): string =>
  Option.getOrElse(exitOf(world.doc, sendIntent(world, browse)[0]), () => '')

export default defineLesson(packet, {
  slug: 'phone-online',
  labels: ['phone', 'laptop', 'router', 'internet', 'shop'],
  steps: [
    {
      id: 'at-home',
      ops: [
        add(
          host('phone', 'phone', 130, 210, {
            wifi: { ssid: SSID, password: PASSWORD },
          }),
        ),
        add(
          host('laptop', 'laptop', 130, 440, {
            wifi: { ssid: SSID, password: PASSWORD },
          }),
        ),
        add(
          router('router', 352, 325, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.7',
            dns: '192.0.2.53',
            wifi: wifi(SSID, PASSWORD),
          }),
        ),
        radio('phone', 'router'),
        radio('laptop', 'router'),
      ],
      stage: [play(photo)],
    },
    {
      id: 'to-the-site',
      ops: [
        add(internet('internet', 606, 325)),
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
        add(
          host('dns', 'server', 606, 110, {
            address: '192.0.2.53/24',
            listeners: [udp(53)],
            records: [{ name: 'shop.example', ip: '198.51.100.10' }],
          }),
        ),
        cable('router', 'internet'),
        cable('internet', 'shop'),
        cable('internet', 'dns'),
      ],
      stage: [play(browse)],
    },
    {
      id: 'many-networks',
      ops: [],
      stage: [expand('internet'), play(browse)],
    },
    {
      id: 'way-out',
      ops: [],
      stage: [expand('internet'), play(browse), pauseAt('internet')],
      quiz: {
        id: 'way-out',
        kind: 'PickDevice',
        candidates: ['laptop', 'router', 'shop'],
        answer: wayOut,
        hideUntilAnswered: ['play'],
      },
    },
    {
      id: 'join-wifi',
      ops: [
        add(nearbyAp('cafe', 40, 120, wifi('Кафе Утро', ''))),
        add(
          nearbyAp(
            'neighbour',
            480,
            40,
            wifi('Router-3A90', 'their-own-secret', {
              band: '2.4',
              channel: 1,
            }),
          ),
        ),
        forgetWifi('phone'),
      ],
      stage: [play(browse)],
      task: {
        id: 'join-wifi',
        palette: [],
        surfaces: ['board', 'wifi:phone', 'browser:phone'],
        goals: [
          {
            id: 'wifi',
            goal: Goal.Associated({ device: 'phone', ap: 'router' }),
          },
          { id: 'opens', goal: Goal.CanReach({ intent: browse }) },
        ],
        solution: [joinWifi('phone', SSID, PASSWORD)],
      },
    },
    {
      id: 'summary',
      ops: [],
      stage: [play(browse)],
    },
  ],
})
