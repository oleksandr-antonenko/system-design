import { Array, Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { Command, click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import type { Locale } from '../../../../i18n/locale'
import * as Player from '../../../../lesson/player'
import { lessonView } from '../../../../lesson/view'
import { findLesson } from '../../../registry'
import lesson from './lesson'

// Урок 7 глазами ученика: квиз «из какого layer поле 443» с вариантами под
// конвертом, сборка конверта руками, неверный порядок и «Показать решение».

const entry = Option.getOrThrow(findLesson('networks', 'under-the-hood'))

const sceneIn = (locale: Locale) => ({
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(lesson)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(lesson, entry, playerModel, { locale, prefersDark: false }, h),
})

const atQuiz = (): Player.Model => Player.init('networks', lesson, 3)

/** Шаг задачи: на вопрос уже ответили. */
const atTask = (): Player.Model => ({
  ...Player.init('networks', lesson, 0),
  quizzes: { 'which-layer': { picked: 'env:transport', isCorrect: true } },
  step: 4,
})

const replayStep = Command.resolve(
  Player.WaitBeforeReplayStep,
  Player.Message.CompletedWaitBeforeReplayStep(),
)

/** Положить заголовок на место: нажать заголовок, потом место. */
const place = (header: string, position: number) => [
  click(role('button', { name: header })),
  click(role('button', { name: new RegExp(`^Место ${position}:`) })),
]

describe('lesson 7: an envelope in an envelope', () => {
  test('ru: the envelope waits at the router with 443 marked; no TTL and no TCP flags; a wrong layer is explained', () => {
    scene(
      sceneIn('ru'),
      given(atQuiz()),
      expect(text('Подсвеченное поле — из какого слоя?')).toExist(),
      expect(text('443')).toExist(),
      expect(text(/SYN|DATA/)).not.toExist(),
      expect(role('button', { name: 'TCP или UDP · port' })).toExist(),
      click(role('button', { name: 'IP · адрес' })),
      expect(text(/dst/)).toExist(),
      expect(text(/ttl/)).not.toExist(),
      expect(text(/flags/)).not.toExist(),
      expect(text(/А 443 — квартира в нём, программа сайта/)).toExist(),
      expect(text('Правильный ответ: TCP или UDP · port')).toExist(),
      expect(role('button', { name: 'TCP или UDP · port' })).toBeDisabled(),
    )
  })

  test('en: the right layer on the first attempt', () => {
    scene(
      sceneIn('en'),
      given(atQuiz()),
      click(role('button', { name: 'TCP or UDP · the port' })),
      expect(text(/Correct/)).toExist(),
      expect(text(/Ports live in TCP or UDP/)).toExist(),
    )
  })

  test('ru: packed by hand from the outside in, sent and checked', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      expect(role('button', { name: 'Отправить' })).toBeDisabled(),
      ...place('Wi-Fi / Ethernet', 1),
      ...place('IP', 2),
      ...place('TCP', 3),
      ...place('HTTP', 4),
      click(role('button', { name: 'Отправить' })),
      expect(role('region', { name: 'Соберите конверт' })).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(
        text(/Каждое устройство на пути открывает ровно столько/),
      ).toExist(),
    )
  })

  test('ru: the port packed under the request reaches the router but not the program', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      ...place('Wi-Fi / Ethernet', 1),
      ...place('IP', 2),
      ...place('HTTP', 3),
      ...place('TCP', 4),
      click(role('button', { name: 'Отправить' })),
      click(role('button', { name: 'Проверить' })),
      expect(text(/номер квартиры спрятан глубже просьбы/)).toExist(),
    )
  })

  test('en: show solution sends the reference envelope through the journal', () => {
    scene(
      sceneIn('en'),
      given(atTask()),
      ...Array.makeBy(3, () => click(role('button', { name: /^Hint/ }))),
      click(role('button', { name: 'Show solution' })),
      replayStep,
      replayStep,
      expect(
        text(/Every device on the way opens exactly as many layers/),
      ).toExist(),
    )
  })
})
