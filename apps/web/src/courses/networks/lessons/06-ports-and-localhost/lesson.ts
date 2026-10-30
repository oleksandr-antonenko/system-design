import { Option } from 'effect'

import { annotate, packet, play } from '../../../../kinds/packet/dsl'
import { screenPicture } from '../../../../kinds/packet/surfaces/screen/browser'
import { defineLesson } from '../../../../lesson/dsl'
import { browse } from '../../../../net/browser'
import {
  add,
  cable,
  host,
  internet,
  radio,
  router,
  run,
  send,
  tcp,
  udp,
  wifi,
} from '../../../../net/build'
import { Goal, goals } from '../../../../net/goals'
import { Intent } from '../../../../net/packet'

// Урок 6 «Port и localhost. Квартиры в одном доме» по сценарию
// docs/plans/networks-lessons/06-ports-and-localhost.md: на одном компьютере
// много программ, у каждой своя квартира-порт; dev-сервер по умолчанию
// открыт только изнутри, и телефон открывает его после `--host`.

const HOME_SSID = 'Router-7C21'
const HOME_PASSWORD = '12345678'
const LAPTOP_MAC = '3c:22:fb:4a:10:42'

const homeWifi = { ssid: HOME_SSID, password: HOME_PASSWORD }

const shopPage = Intent.Browse({ from: 'phone', url: 'https://shop.example/' })
const laptopLocal = Intent.Browse({
  from: 'laptop',
  url: 'http://localhost:5173/',
})
const phoneLocal = Intent.Browse({
  from: 'phone',
  url: 'http://localhost:5173/',
})
const phoneDev = Intent.Browse({
  from: 'phone',
  url: 'http://192.168.1.42:5173/',
})

/** Что покажет браузер телефона: вариант квиза по экрану, который считает
    движок, а не автор. */
const phoneScreen = (
  answer: ReturnType<typeof browse>['view'],
): 'page' | 'refused' | 'not-found' | 'offline' =>
  answer._tag === 'Page'
    ? 'page'
    : answer.code === 'ERR_NAME_NOT_RESOLVED'
      ? 'not-found'
      : answer.code === 'ERR_INTERNET_DISCONNECTED'
        ? 'offline'
        : 'refused'

export default defineLesson(packet, {
  slug: 'ports-and-localhost',
  labels: ['phone', 'laptop', 'printer', 'router', 'internet', 'dns', 'shop'],
  steps: [
    {
      id: 'apartments',
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
      stage: [play(shopPage), annotate('shop', 'door443', 'ok')],
    },
    {
      id: 'dev-server',
      ops: [run('laptop', 'npm run dev')],
      stage: [play(laptopLocal), annotate('laptop', 'devOpened', 'ok')],
    },
    {
      id: 'what-phone-sees',
      ops: [],
      stage: [play(phoneLocal), annotate('phone', 'phoneEmpty', 'bad')],
      quiz: {
        id: 'phone-localhost',
        kind: 'Choice',
        candidates: ['page', 'refused', 'not-found', 'offline'],
        answer: world =>
          phoneScreen(
            browse(world.doc, world.state, 'phone', phoneLocal.url).view,
          ),
        pictures: {
          page: screenPicture('page', 'localhost:5173'),
          refused: screenPicture('ERR_CONNECTION_REFUSED', 'localhost:5173'),
          'not-found': screenPicture('ERR_NAME_NOT_RESOLVED', 'localhost:5173'),
          offline: screenPicture('ERR_INTERNET_DISCONNECTED', 'localhost:5173'),
        },
        hideUntilAnswered: ['play'],
      },
    },
    {
      id: 'door',
      ops: [],
      stage: [play(phoneDev), annotate('laptop', 'onlyInside', 'bad')],
    },
    {
      id: 'phone-dev',
      ops: [send(phoneLocal)],
      stage: [],
      task: {
        id: 'phone-dev',
        palette: [],
        surfaces: ['board', 'terminal:laptop', 'browser:phone'],
        goals: [
          {
            id: 'listens',
            goal: Goal.Listening({
              device: 'laptop',
              proto: 'tcp',
              port: 5173,
              maybeBind: Option.some('0.0.0.0'),
            }),
          },
          {
            id: 'phone-opens',
            goal: goals.performed('phone', 'laptop', {
              intent: 'Browse',
              port: 5173,
            }),
          },
        ],
        solution: [
          run('laptop', 'Ctrl+C'),
          run('laptop', 'npm run dev -- --host'),
          send(phoneDev),
        ],
      },
    },
    {
      id: 'summary',
      ops: [],
      stage: [play(phoneDev), annotate('phone', 'devOnPhone', 'ok')],
    },
  ],
})
