import { Option } from 'effect'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import { annotate, packet, play } from '../../../../kinds/packet/dsl'
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
  wifi,
} from '../../../../net/build'
import { Goal, goals } from '../../../../net/goals'
import { Intent } from '../../../../net/packet'
import { dhcpServerFor } from '../../../../net/topology'

// Урок 2 «У каждого свой адрес» (docs/plans/networks-lessons/02-addresses.md):
// тот же дом, что в уроке 1, но под устройствами — адреса, а на конвертах —
// номера. Адрес выдаёт роутер; новый принтер получает адрес по кабелю, и
// ноутбук печатает на него по номеру. Новое слово — «IP-адрес».

const SSID = 'Router-7C21'
const PASSWORD = '12345678'
const LAPTOP_MAC = '3c:22:fb:4a:10:42'

const homeWifi = { ssid: SSID, password: PASSWORD }

const photo = Intent.Send({ from: 'phone', to: '192.168.1.42', what: 'photo' })
const phoneJoins = Intent.DhcpJoin({ device: 'phone' })
const print = Intent.Send({ from: 'laptop', to: 'printer', what: 'document' })

/** Кто выдал телефону адрес: роутер его сегмента, считает движок. */
const addressGiver = (world: PacketDoc): string =>
  Option.match(dhcpServerFor(world.doc, 'phone'), {
    onNone: () => '',
    onSome: found => found.id,
  })

export default defineLesson(packet, {
  slug: 'addresses',
  labels: ['phone', 'laptop', 'router', 'internet', 'shop', 'printer'],
  steps: [
    {
      id: 'house-numbers',
      ops: [
        add(
          router('router', 352, 325, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.7',
            dns: '192.0.2.53',
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
            address: '198.51.100.10/24',
            listeners: [tcp(80), tcp(443)],
          }),
        ),
        radio('phone', 'router'),
        radio('laptop', 'router'),
        cable('router', 'internet'),
        cable('internet', 'shop'),
      ],
      stage: [play(photo)],
    },
    {
      id: 'router-gives',
      ops: [],
      stage: [play(phoneJoins), annotate('phone', 'gotAddress', 'ok')],
    },
    {
      id: 'who-gave',
      ops: [],
      stage: [play(phoneJoins)],
      quiz: {
        id: 'who-gave',
        kind: 'PickDevice',
        candidates: ['laptop', 'router', 'internet'],
        answer: addressGiver,
        hideUntilAnswered: ['play'],
      },
    },
    {
      id: 'photo-and-printer',
      ops: [add(host('printer', 'printer', 300, 500))],
      stage: [],
      task: {
        id: 'photo-and-printer',
        palette: [],
        surfaces: ['board'],
        goals: [
          {
            id: 'photo',
            goal: goals.performed('phone', 'laptop', { intent: 'Send' }),
          },
          {
            id: 'printer-address',
            goal: Goal.HasAddress({
              device: 'printer',
              maybeIp: Option.none(),
            }),
          },
          {
            id: 'printed',
            goal: goals.performed('laptop', 'printer', { intent: 'Send' }),
          },
        ],
        solution: [
          send(photo),
          cable('printer', 'router'),
          send(
            Intent.Send({
              from: 'laptop',
              to: '192.168.1.101',
              what: 'document',
            }),
          ),
        ],
      },
    },
    {
      id: 'summary',
      ops: [],
      stage: [play(print), annotate('printer', 'printing', 'ok')],
    },
  ],
})
