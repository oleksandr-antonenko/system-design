import {
  annotate,
  openEnvelope,
  packet,
  pauseAt,
  play,
  showCert,
} from '../../../../kinds/packet/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import {
  add,
  cable,
  certificateAuthority,
  host,
  internet,
  issueCert,
  listen,
  radio,
  router,
  send,
  setCert,
  setRedirect,
  stopListening,
  tcp,
  udp,
  wifi,
} from '../../../../net/build'
import { Goal, goals } from '../../../../net/goals'
import { Intent } from '../../../../net/packet'

// Урок 11 «HTTP, HTTPS и сертификаты» по сценарию
// docs/plans/networks-lessons/11-https.md: http:// — открытка, которую
// читает каждый по пути; https:// запечатывает конверт, а certificate —
// паспорт сайта — подтверждает, что на том конце правда ваш сайт.

const HOME_SSID = 'Router-7C21'
const HOME_PASSWORD = '12345678'
const LAPTOP_MAC = '3c:22:fb:4a:10:42'
const CAFE_SSID = 'Кафе Утро'

const homeWifi = { ssid: HOME_SSID, password: HOME_PASSWORD }
const cafeWifi = { ssid: CAFE_SSID, password: '' }

const form = [
  { name: 'login', value: 'anna' },
  { name: 'password', value: 'kotik2024' },
]

/** Вход в админку из кафе: форма с логином и паролем — по http:// (шаг 1),
    в магазин по https:// (шаги 2 и 4) и в свой сайт с замком (итог). */
export const postcard = Intent.Submit({
  from: 'phone',
  url: 'http://myapp.example/login',
  fields: form,
})
export const sealedLogin = Intent.Submit({
  from: 'phone',
  url: 'https://shop.example/login',
  fields: form,
})
export const myappLogin = Intent.Submit({
  from: 'phone',
  url: 'https://myapp.example/login',
  fields: form,
})
const shopPage = Intent.Browse({ from: 'phone', url: 'https://shop.example/' })
const myappPage = Intent.Browse({
  from: 'phone',
  url: 'https://myapp.example/',
})

export default defineLesson(packet, {
  slug: 'https',
  labels: [
    'phone',
    'laptop',
    'printer',
    'router',
    'cafe',
    'stranger',
    'internet',
    'dns',
    'vps',
    'shop',
    'ca',
    'zone:cafe',
  ],
  steps: [
    {
      id: 'postcard',
      ops: [
        add(
          router('router', 290, 190, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.7',
            dns: '192.0.2.53',
            wifi: wifi(HOME_SSID, HOME_PASSWORD),
            reservations: [{ mac: LAPTOP_MAC, ip: '192.168.1.42' }],
          }),
        ),
        add(
          host('laptop', 'laptop', 110, 140, {
            mac: LAPTOP_MAC,
            wifi: homeWifi,
          }),
        ),
        add(host('printer', 'printer', 110, 250)),
        add(
          router('cafe', 290, 430, {
            lan: '10.10.0.1/24',
            wan: '203.0.113.90',
            dns: '192.0.2.53',
            wifi: wifi(CAFE_SSID, ''),
          }),
        ),
        add(host('phone', 'phone', 110, 380, { wifi: cafeWifi })),
        add(host('stranger', 'laptop', 110, 490, { wifi: cafeWifi })),
        add(internet('internet', 500, 310)),
        add(
          host('dns', 'server', 500, 90, {
            address: '192.0.2.53/24',
            listeners: [udp(53)],
            records: [
              { name: 'myapp.example', ip: '198.51.100.20' },
              { name: 'www.myapp.example', ip: '198.51.100.20' },
              { name: 'shop.example', ip: '198.51.100.10' },
              { name: 'ca.example', ip: '198.51.100.30' },
            ],
          }),
        ),
        add(
          host('vps', 'server', 760, 180, {
            address: '198.51.100.20/24',
            listeners: [
              tcp(80),
              tcp(3000, '127.0.0.1'),
              tcp(5432, '127.0.0.1'),
            ],
          }),
        ),
        add(
          host('shop', 'server', 760, 420, {
            address: '198.51.100.10/24',
            listeners: [tcp(80), tcp(443)],
            redirect: true,
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
          certificateAuthority('ca', 890, 300, {
            address: '198.51.100.30/24',
            dns: '192.0.2.53',
          }),
        ),
        radio('laptop', 'router'),
        cable('printer', 'router'),
        cable('router', 'internet'),
        radio('phone', 'cafe'),
        radio('stranger', 'cafe'),
        cable('cafe', 'internet'),
        cable('internet', 'dns'),
        cable('internet', 'vps'),
        cable('internet', 'shop'),
        cable('internet', 'ca'),
        // Телефон уже бывал на обоих сайтах: адреса в его DNS cache, и
        // показ начинается сразу с конверта сайту, без вопроса справочной.
        send(Intent.Resolve({ from: 'phone', name: 'myapp.example' })),
        send(Intent.Resolve({ from: 'phone', name: 'shop.example' })),
      ],
      stage: [
        play(postcard, { show: 'letters' }),
        pauseAt('cafe'),
        openEnvelope('application'),
        annotate('stranger', 'seesPassword', 'bad'),
      ],
    },
    {
      id: 'sealed',
      ops: [],
      stage: [
        play(sealedLogin, { show: 'handshake' }),
        pauseAt('cafe'),
        openEnvelope('application'),
        annotate('stranger', 'seesName', 'info'),
      ],
    },
    {
      id: 'passport',
      ops: [],
      stage: [
        play(shopPage, { show: 'handshake' }),
        pauseAt('phone'),
        showCert('shop', 'shop.example'),
      ],
    },
    {
      id: 'cafe-sees',
      ops: [],
      stage: [
        play(sealedLogin, { show: 'letters' }),
        pauseAt('cafe'),
        openEnvelope('application'),
      ],
      quiz: {
        id: 'cafe-sees',
        kind: 'Choice',
        candidates: [
          'nothing',
          'address-only',
          'address-port-name',
          'everything',
        ],
        answer: 'address-port-name',
        hideUntilAnswered: ['play'],
      },
    },
    {
      id: 'get-certificate',
      ops: [
        stopListening('vps', 'tcp', 80),
        listen('vps', 'tcp', '0.0.0.0', 443),
        setCert('vps', {
          names: ['vps-20.hosting.example'],
          issuer: 'Example CA',
          notAfter: '2027-03-14',
        }),
        send(myappPage),
      ],
      // NOTE: паспорта под доской здесь нет: рядом с панелью сервера доска
      // становится низкой, и карточка съела бы её целиком. Имя в паспорте
      // ученик видит в «Дополнительные» браузера и на вкладке «Certificate».
      stage: [play(myappPage, { show: 'handshake' })],
      task: {
        id: 'get-certificate',
        palette: [],
        surfaces: ['board', 'browser:phone', 'server:vps', 'terminal:laptop'],
        goals: [
          {
            id: 'lock',
            goal: Goal.ValidCert({
              from: 'phone',
              url: 'https://myapp.example/',
            }),
          },
          {
            id: 'lock-www',
            goal: Goal.ValidCert({
              from: 'phone',
              url: 'https://www.myapp.example/',
            }),
          },
          {
            id: 'redirect',
            goal: Goal.RedirectsToHttps({
              from: 'phone',
              url: 'http://myapp.example/',
            }),
          },
          {
            id: 'only-web',
            goal: goals.onlyOpenPorts('vps', 'stranger', [80, 443]),
          },
        ],
        solution: [
          listen('vps', 'tcp', '0.0.0.0', 80),
          issueCert('vps', ['myapp.example', 'www.myapp.example']),
          setRedirect('vps', true),
          send(myappPage),
        ],
      },
    },
    {
      id: 'summary',
      ops: [],
      stage: [
        play(myappLogin, { show: 'letters' }),
        annotate('stranger', 'seesMyapp', 'ok'),
      ],
    },
  ],
})
