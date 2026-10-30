import { Array, Option, pipe } from 'effect'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import {
  annotate,
  expand,
  packet,
  pauseAt,
  play,
  printout,
} from '../../../../kinds/packet/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import { nextHopAfter } from '../../../../net/answers'
import {
  add,
  cable,
  host,
  radio,
  router,
  run,
  send,
  setLinkUp,
  tcp,
  transit,
  udp,
  wifi,
} from '../../../../net/build'
import { Goal, goals } from '../../../../net/goals'
import { Intent } from '../../../../net/packet'
import { sendIntent } from '../../../../net/world'

// Урок 4 «Конверт идёт через несколько почтовых отделений» по сценарию
// docs/plans/networks-lessons/04-hops-and-ping.md: облако раскрывается в
// цепочку роутеров (те же id, подписи и задержки, что в уроке 8), конверт
// идёт по хопам, ping проверяет связь, а задача — найти выпавший кабель
// провайдера, проверяя ping с ближнего участка.

const HOME_SSID = 'Router-7C21'
const HOME_PASSWORD = '12345678'
const LAPTOP_MAC = '3c:22:fb:4a:10:42'

const homeWifi = { ssid: HOME_SSID, password: HOME_PASSWORD }

const shopPage = Intent.Browse({ from: 'laptop', url: 'https://shop.example/' })
const pingShop = Intent.Ping({ from: 'laptop', host: 'shop.example' })

/** Сколько миллисекунд эхо до сайта шло туда и обратно: число для подписи
    на доске считает движок по задержкам связей. */
export const echoMs = (world: PacketDoc): number => {
  const outcome = sendIntent(world, pingShop)[0].outcome
  return outcome._tag === 'Delivered' && outcome.answer._tag === 'EchoReply'
    ? Math.round(outcome.answer.ms)
    : 0
}

/** Куда роутер провайдера отдаст запрос страницы: считает движок по трассе. */
const nextAfterIsp = (world: PacketDoc): string => {
  const page = sendIntent(world, shopPage)[0]
  return pipe(
    Array.findFirst(page.hops, hop =>
      Array.some(hop.envelope, layer => layer._tag === 'Http'),
    ),
    Option.flatMap(hop => nextHopAfter(page, 'isp', hop.packet)),
    Option.getOrElse(() => ''),
  )
}

export default defineLesson(packet, {
  slug: 'hops-and-ping',
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
      id: 'chain',
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
        add(transit('isp', 530, 300, { ip: '203.0.113.1' })),
        add(transit('core', 715, 300, { ip: '192.0.2.1' })),
        add(transit('hosting', 900, 300, { ip: '198.51.100.1' })),
        add(
          host('dns', 'server', 715, 130, {
            address: '192.0.2.53/24',
            listeners: [udp(53)],
            records: [{ name: 'shop.example', ip: '198.51.100.10' }],
          }),
        ),
        add(
          host('shop', 'server', 900, 470, {
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
        cable('router', 'isp'),
        cable('isp', 'core'),
        cable('core', 'dns'),
        cable('core', 'hosting'),
        cable('hosting', 'shop'),
        // «Вчера сайт открывался»: адрес shop.example уже в контактах
        // ноутбука, поэтому на доске только запрос и ответ, без вопроса
        // справочной, а в задаче ping находит адрес, хотя справочная за
        // обрывом.
        send(shopPage),
      ],
      stage: [expand('internet'), play(shopPage)],
    },
    {
      id: 'ping',
      ops: [],
      stage: [
        expand('internet'),
        play(pingShop),
        printout('laptop', 'ping shop.example'),
        annotate('laptop', 'echoTime', 'ok'),
      ],
    },
    {
      id: 'next-hop',
      ops: [],
      stage: [expand('internet'), play(shopPage), pauseAt('isp')],
      quiz: {
        id: 'next-hop',
        kind: 'NextHop',
        candidates: ['router', 'core', 'hosting', 'dns'],
        answer: nextAfterIsp,
      },
    },
    {
      id: 'find-break',
      ops: [setLinkUp('router', 'isp', false)],
      stage: [expand('internet'), play(shopPage)],
      task: {
        id: 'find-break',
        palette: [],
        surfaces: ['board', 'terminal:laptop'],
        // Сначала сайт: пока кабель не вставлен, карточка объясняет обрыв;
        // после — просит повторить ping.
        goals: [
          { id: 'site-opens', goal: Goal.CanReach({ intent: shopPage }) },
          {
            id: 'ping-site',
            goal: goals.performed('laptop', 'shop', { intent: 'Ping' }),
          },
        ],
        solution: [
          run('laptop', 'ping 192.168.1.1'),
          setLinkUp('router', 'isp', true),
          run('laptop', 'ping shop.example'),
        ],
      },
    },
    {
      id: 'summary',
      ops: [],
      stage: [expand('internet'), play(pingShop)],
    },
  ],
})
