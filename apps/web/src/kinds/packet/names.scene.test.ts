import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { expect, given, role, scene } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { findLesson } from '../../courses/registry'
import { type LessonDefinition, defineLesson } from '../../lesson/dsl'
import * as Player from '../../lesson/player'
import { type LessonEntry, lessonView } from '../../lesson/view'
import { add, cable, internet, router } from '../../net/build'
import type { PacketTypes } from '../types'
import { packet } from './dsl'

// Имена устройств на доске английские на всех языках
// (english-network-terms): роутер без подписи урока называется «Router»
// и в русском интерфейсе, а родное название с пояснением — его подсказка.

const home: LessonDefinition<PacketTypes> = defineLesson(packet, {
  slug: 'phone-online',
  steps: [
    {
      id: 'home',
      ops: [
        add(
          router('router', 340, 300, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.7',
          }),
        ),
        add(internet('internet', 600, 300)),
        cable('router', 'internet'),
      ],
      stage: [],
    },
  ],
})

const entry: LessonEntry = {
  course: 'networks',
  meta: Option.getOrThrow(findLesson('networks', 'phone-online')).meta,
  texts: [
    {
      locale: 'ru',
      text: {
        title: 'Дом',
        summary: 'Router и интернет.',
        preview: { alt: 'Router и интернет на схеме.' },
        steps: {
          home: { title: 'Дом', body: 'Router соединяет дом с интернетом.' },
        },
        annotations: {},
      },
    },
  ],
}

const sceneIn = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(home)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      home,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

describe('device names on the network board', () => {
  test('ru: an unlabelled router is “Router”, with the Russian hint', () => {
    scene(
      sceneIn,
      given(Player.init('networks', home, 0)),
      expect(role('img', { name: 'Router' })).toHaveAttr(
        'aria-description',
        'Router — роутер, маршрутизатор: передаёт конверты между сетями, как почтовое отделение',
      ),
      expect(role('img', { name: /^Internet/ })).toHaveAttr(
        'aria-description',
        'Internet — интернет: много сетей, соединённых между собой',
      ),
    )
  })
})
