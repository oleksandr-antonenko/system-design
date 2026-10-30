import { Option } from 'effect'

import type { PacketDoc, PacketRun } from '../../../../kinds/packet/doc'
import {
  annotate,
  highlight,
  packet,
  play,
  showTable,
} from '../../../../kinds/packet/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import { staleAnswerOn } from '../../../../net/answers'
import {
  add,
  cable,
  fastForward,
  flushDns,
  host,
  internet,
  radio,
  router,
  run,
  send,
  setRecord,
  tcp,
  udp,
  wait,
  wifi,
} from '../../../../net/build'
import { goals } from '../../../../net/goals'
import { Intent } from '../../../../net/packet'

// Урок 10 «DNS records. Свой domain для сайта» по сценарию
// docs/plans/networks-lessons/10-dns-records.md: domain направляют на сервер
// DNS records у DNS-провайдера, а справочные помнят ответ, пока не выйдет его
// TTL, поэтому новый адрес доходит до всех не сразу.
//
// Время: шаг 2 проигрывает вопрос друга на «сейчас» (часы на нуле, таймер
// в карточке — час), в журнал этот вопрос попадает в начале задачи, а
// полчаса проходят перед вопросом «почему у друга старый сайт». Так «Пуск»
// шага 2 показывает, как справочная друга спрашивает DNS-провайдера, без
// перемотки часов назад. Принтер из дома модуля 1 убран: в уроке он не
// нужен, а доска на телефоне и так плотная.

const HOME_SSID = 'Router-7C21'
const HOME_PASSWORD = '12345678'
const LAPTOP_MAC = '3c:22:fb:4a:10:42'
const FRIEND_SSID = 'Friend-Home'
const FRIEND_PASSWORD = 'friend2024'

export const DOMAIN = 'myapp.example'
export const VPS_IP = '198.51.100.20'
export const PARKING_IP = '198.51.100.200'
export const VERIFY = 'myapp-verify=4f9c2a'

const homeWifi = { ssid: HOME_SSID, password: HOME_PASSWORD }
const friendWifi = { ssid: FRIEND_SSID, password: FRIEND_PASSWORD }

/** Ноутбук открывает ваш domain. */
export const laptopPage = Intent.Browse({
  from: 'laptop',
  url: `http://${DOMAIN}/`,
})

/** Друг открывает ссылку. */
export const friendPage = Intent.Browse({
  from: 'friend',
  url: `http://${DOMAIN}/`,
})

/** Ноутбук друга узнаёт адрес по имени из ссылки. */
export const friendAsks = Intent.Resolve({ from: 'friend', name: DOMAIN })

/** Где застрял старый адрес: справочная на пути вопроса друга, которая
    отвечает из памяти не тем, что записано у DNS-провайдера. Считает
    движок. */
const staleOn = (world: PacketDoc, run: PacketRun): string =>
  Option.getOrElse(
    staleAnswerOn(world.doc, run.settled, 'friend', DOMAIN),
    () => '',
  )

export default defineLesson(packet, {
  slug: 'dns-records',
  labels: [
    'phone',
    'laptop',
    'router',
    'internet',
    'dns',
    'ns',
    'vps',
    'parking',
    'friend-router',
    'friend',
    'cf',
    'zone:friend-router',
  ],
  steps: [
    {
      id: 'own-domain',
      ops: [
        add(
          router('router', 290, 210, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.7',
            dns: '192.0.2.53',
            wifi: wifi(HOME_SSID, HOME_PASSWORD),
            reservations: [{ mac: LAPTOP_MAC, ip: '192.168.1.42' }],
          }),
        ),
        add(host('phone', 'phone', 90, 200, { wifi: homeWifi })),
        add(
          host('laptop', 'laptop', 90, 330, {
            mac: LAPTOP_MAC,
            wifi: homeWifi,
          }),
        ),
        add(internet('internet', 500, 320)),
        add(
          host('dns', 'server', 305, 60, {
            address: '192.0.2.53/24',
            listeners: [udp(53)],
            resolver: true,
          }),
        ),
        add(
          host('ns', 'server', 490, 60, {
            address: '203.0.113.53/24',
            listeners: [udp(53)],
            zones: [
              {
                name: DOMAIN,
                records: [
                  { name: '@', rtype: 'A', value: PARKING_IP, ttl: 3600 },
                ],
              },
              {
                name: 'shop.example',
                records: [
                  {
                    name: '@',
                    rtype: 'A',
                    value: '198.51.100.10',
                    ttl: 3600,
                  },
                ],
              },
              {
                name: 'dns.example',
                records: [
                  { name: 'ns1', rtype: 'A', value: '203.0.113.53', ttl: 3600 },
                ],
              },
            ],
          }),
        ),
        add(
          host('vps', 'server', 230, 470, {
            address: `${VPS_IP}/24`,
            listeners: [tcp(80)],
          }),
        ),
        add(
          host('parking', 'server', 430, 470, {
            address: `${PARKING_IP}/24`,
            listeners: [tcp(80)],
          }),
        ),
        add(
          router('friend-router', 680, 470, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.77',
            dns: '1.1.1.1',
            wifi: wifi(FRIEND_SSID, FRIEND_PASSWORD),
          }),
        ),
        add(host('friend', 'laptop', 870, 470, { wifi: friendWifi })),
        add(
          host('cf', 'server', 850, 290, {
            address: '1.1.1.1/24',
            listeners: [udp(53)],
            resolver: true,
          }),
        ),
        radio('phone', 'router'),
        radio('laptop', 'router'),
        cable('router', 'internet'),
        cable('internet', 'dns'),
        cable('internet', 'ns'),
        cable('internet', 'vps'),
        cable('internet', 'parking'),
        cable('internet', 'cf'),
        cable('friend-router', 'internet'),
        radio('friend', 'friend-router'),
      ],
      stage: [
        play(laptopPage),
        showTable('ns', 'records'),
        annotate('laptop', 'parked', 'warn'),
      ],
    },
    {
      id: 'ttl',
      ops: [],
      stage: [
        play(friendAsks),
        showTable('cf', 'dns'),
        highlight('cf', 'info'),
      ],
    },
    {
      id: 'point-domain',
      // Друг уже спросил: справочная 1.1.1.1 помнит заглушку на час.
      ops: [send(friendAsks)],
      stage: [play(laptopPage)],
      task: {
        id: 'point-domain',
        palette: [],
        surfaces: ['board', 'dns-panel:ns', 'terminal:laptop'],
        goals: [
          {
            id: 'a-record',
            goal: goals.resolves('laptop', DOMAIN, VPS_IP, 'ns'),
          },
          {
            id: 'www-cname',
            goal: goals.hasRecord(DOMAIN, 'www', 'CNAME', DOMAIN),
          },
          {
            id: 'txt',
            goal: goals.hasRecord(DOMAIN, '@', 'TXT', VERIFY),
          },
          {
            id: 'checked',
            goal: goals.ranCommand('laptop', ['dig', 'nslookup'], {
              name: DOMAIN,
              saw: VPS_IP,
            }),
          },
        ],
        solution: [
          setRecord('ns', DOMAIN, {
            type: 'A',
            name: '@',
            value: VPS_IP,
            ttl: 300,
          }),
          setRecord('ns', DOMAIN, {
            type: 'CNAME',
            name: 'www',
            value: DOMAIN,
            ttl: 300,
          }),
          setRecord('ns', DOMAIN, {
            type: 'TXT',
            name: '@',
            value: VERIFY,
            ttl: 300,
          }),
          run('laptop', `dig ${DOMAIN}`),
        ],
      },
    },
    {
      id: 'friend-sees-old',
      // Прошло полчаса; друг перезагрузил ноутбук, его собственная память
      // пуста. Карточка справочной друга с таймером откроется после ответа.
      ops: [wait(1800), flushDns('friend')],
      stage: [play(friendPage), showTable('cf', 'dns')],
      quiz: {
        id: 'stale-where',
        kind: 'PickDevice',
        candidates: ['friend', 'cf', 'dns', 'ns', 'vps'],
        answer: staleOn,
        hideUntilAnswered: ['tables'],
      },
    },
    {
      id: 'summary',
      // Часы идут до конца TTL старого ответа в памяти справочной друга.
      ops: [fastForward('cf')],
      stage: [play(friendPage), showTable('cf', 'dns')],
    },
  ],
})
