import { type LessonDefinition, defineLesson } from '../../lesson/dsl'
import {
  add,
  cable,
  host,
  internet,
  joinWifi,
  radio,
  router,
  tcp,
  wifi,
} from '../../net/build'
import { Goal } from '../../net/goals'
import { Intent } from '../../net/packet'
import type { PacketTypes } from '../types'
import { annotate, edit, packet, play, send } from './dsl'

// Крошечный урок сетей для тестов контракта: дом с роутером, телефон без
// Wi-Fi, задача «подключить телефон» на поверхности `wifi:phone`. Slug —
// как у заглушки урока 1, поэтому плеер находит его `unlocks`.

export const phoneOnline: LessonDefinition<PacketTypes> = defineLesson(packet, {
  slug: 'phone-online',
  labels: ['phone', 'router'],
  steps: [
    {
      id: 'home',
      ops: [
        edit(add(internet('internet', 590, 360))),
        edit(
          add(
            router('router', 340, 360, {
              lan: '192.168.1.1/24',
              wan: '203.0.113.7',
              wifi: wifi('Home', 'correct-horse'),
            }),
          ),
        ),
        edit(cable('router', 'internet')),
        edit(
          add(
            host('shop', 'server', 820, 360, {
              address: '198.51.100.10/24',
              listeners: [tcp(80)],
            }),
          ),
        ),
        edit(cable('shop', 'internet')),
        edit(add(host('phone', 'phone', 200, 300))),
        edit(radio('phone', 'router')),
      ],
      stage: [annotate('router', 'door', 'info')],
    },
    {
      id: 'join',
      ops: [],
      stage: [],
      task: {
        id: 'join-home',
        palette: [],
        surfaces: ['board', 'wifi:phone'],
        goals: [
          {
            id: 'associated',
            goal: Goal.Associated({ device: 'phone', ap: 'router' }),
          },
        ],
        solution: [edit(joinWifi('phone', 'Home', 'correct-horse'))],
      },
    },
    {
      id: 'online',
      ops: [send(Intent.Ping({ from: 'phone', ip: '198.51.100.10' }))],
      stage: [
        play(Intent.Browse({ from: 'phone', url: 'http://198.51.100.10/' })),
      ],
    },
  ],
})
