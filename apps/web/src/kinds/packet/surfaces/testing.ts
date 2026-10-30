import { Option } from 'effect'

import type { Lesson } from '../../../courses/assemble'
import { defineLessonMeta } from '../../../courses/model'
import networks from '../../../courses/networks/course'
import { type LessonDefinition, defineLesson } from '../../../lesson/dsl'
import {
  add,
  cable,
  firewall,
  host,
  internet,
  joinWifi,
  nearbyAp,
  radio,
  router,
  rule,
  run,
  send,
  setDns,
  setStatic,
  tcp,
  udp,
  wifi,
} from '../../../net/build'
import { Goal, goals } from '../../../net/goals'
import { Intent } from '../../../net/packet'
import type { PacketTypes } from '../../types'
import { packet } from '../dsl'

// Урок-стенд для тестов поверхностей устройств: дом с телефоном без Wi-Fi,
// кафе и соседи рядом, ноутбук, справочная, магазин и сервер `vps`. Его нет
// в программе курса, поэтому открыт весь интерфейс курса сетей (Wi-Fi,
// сведения о сети, адрес вручную, адресная строка, ошибки, терминал с ufw).

export const HOME = 'Router-7C21'
export const HOME_PASSWORD = '12345678'
export const CAFE = 'Кафе Утро'
export const NEIGHBOUR = 'Router-3A90'

const VPS_IP = '198.51.100.20'
const HOME_WAN = '203.0.113.7'

export const shopPage = (from: string) =>
  Intent.Browse({ from, url: 'https://shop.example/' })

export const devices: LessonDefinition<PacketTypes> = defineLesson(packet, {
  slug: 'device-surfaces',
  labels: ['phone', 'laptop', 'router', 'vps'],
  steps: [
    {
      id: 'home',
      ops: [
        add(internet('internet', 590, 360)),
        add(
          router('router', 340, 360, {
            lan: '192.168.1.1/24',
            wan: HOME_WAN,
            dns: '192.0.2.53',
            wifi: wifi(HOME, HOME_PASSWORD),
          }),
        ),
        add(nearbyAp('cafe', 60, 120, wifi(CAFE, ''))),
        add(
          nearbyAp(
            'neighbour',
            560,
            40,
            wifi(NEIGHBOUR, 'their-secret', { band: '2.4', channel: 1 }),
          ),
        ),
        add(host('phone', 'phone', 200, 300)),
        add(
          host('laptop', 'laptop', 200, 450, {
            mac: '3c:22:fb:4a:10:42',
            wifi: { ssid: HOME, password: HOME_PASSWORD },
          }),
        ),
        add(
          host('dns', 'server', 590, 140, {
            address: '192.0.2.53/24',
            listeners: [udp(53)],
            records: [
              { name: 'shop.example', ip: '198.51.100.10' },
              { name: 'myapp.example', ip: VPS_IP },
            ],
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
          host('vps', 'server', 820, 520, {
            address: `${VPS_IP}/24`,
            listeners: [tcp(22), tcp(80)],
          }),
        ),
        firewall('vps', { enabled: false }),
        radio('phone', 'router'),
        radio('laptop', 'router'),
        cable('router', 'internet'),
        cable('internet', 'dns'),
        cable('internet', 'shop'),
        cable('internet', 'vps'),
      ],
      stage: [],
    },
    {
      id: 'join',
      ops: [],
      stage: [],
      task: {
        id: 'join',
        palette: [],
        surfaces: ['board', 'browser:phone', 'wifi:phone'],
        goals: [
          {
            id: 'associated',
            goal: Goal.Associated({ device: 'phone', ap: 'router' }),
          },
          {
            id: 'opens',
            goal: goals.performed('phone', 'shop', { intent: 'Browse' }),
          },
        ],
        solution: [
          joinWifi('phone', HOME, HOME_PASSWORD),
          send(shopPage('phone')),
        ],
      },
    },
    {
      id: 'dns',
      ops: [setDns('phone', { mode: 'manual', servers: [] })],
      stage: [],
      task: {
        id: 'dns',
        palette: [],
        surfaces: ['board', 'wifi:phone'],
        goals: [{ id: 'dns', goal: Goal.HasDnsServer({ device: 'phone' }) }],
        solution: [setDns('phone', { mode: 'auto' })],
      },
    },
    {
      id: 'server',
      ops: [],
      stage: [],
      task: {
        id: 'server',
        palette: [],
        surfaces: ['board', 'terminal:vps'],
        goals: [
          {
            id: 'web',
            goal: Goal.Listening({
              device: 'vps',
              proto: 'tcp',
              port: 80,
              maybeBind: Option.none(),
            }),
          },
        ],
        solution: [
          run(
            'vps',
            `sudo ufw allow from ${HOME_WAN} to any port 22 proto tcp`,
          ),
          run('vps', 'sudo ufw enable'),
        ],
      },
    },
    {
      id: 'gateway',
      ops: [
        setStatic('laptop', '192.168.1.42/24', '192.168.1.254', '192.0.2.53'),
      ],
      stage: [],
      task: {
        id: 'gateway',
        palette: [],
        surfaces: ['board', 'wifi:laptop', 'terminal:laptop'],
        goals: [
          {
            id: 'out',
            goal: Goal.CanReach({
              intent: Intent.Ping({ from: 'laptop', host: '198.51.100.10' }),
            }),
          },
        ],
        solution: [
          setStatic('laptop', '192.168.1.42/24', '192.168.1.1', '192.0.2.53'),
        ],
      },
    },
  ],
})

/** Запись реестра для `lessonView`: тексты на английском. */
export const devicesEntry: Lesson = {
  course: 'networks',
  folder: '99-device-surfaces',
  meta: defineLessonMeta(networks, {
    slug: 'device-surfaces',
    module: 'developer',
    order: 99,
    available: true,
    locales: ['en'],
  }),
  texts: [
    {
      locale: 'en',
      text: {
        title: 'Devices',
        summary: 'Surfaces of devices.',
        preview: { alt: 'Surfaces.' },
        labels: {
          phone: { name: 'Phone' },
          laptop: { name: 'Laptop' },
          router: { name: 'Router' },
          vps: { name: 'Server' },
        },
        steps: {
          home: { title: 'Home', body: 'A home.' },
          join: { title: 'Join', body: 'Join the Wi-Fi.' },
          dns: { title: 'DNS', body: 'Fix DNS.' },
          gateway: { title: 'Gateway', body: 'Fix the gateway.' },
          server: { title: 'Server', body: 'Guard the server.' },
        },
        tasks: Object.fromEntries(
          ['join', 'dns', 'gateway', 'server'].map(id => [
            id,
            {
              prompt: `Task ${id}`,
              goals: {
                associated: 'Associated',
                opens: 'Opens',
                dns: 'DNS',
                out: 'Out',
                web: 'Web',
              },
              hints: ['One', 'Two', 'Three'],
              solvedNote: 'Done.',
            },
          ]),
        ),
      },
    },
  ],
}

/** Ученик сам закрывает себе ssh: файрвол без правила для 22. */
export const lockOut = firewall('vps', {
  enabled: true,
  rules: [rule({ action: 'allow', proto: 'tcp', port: 80 })],
})
