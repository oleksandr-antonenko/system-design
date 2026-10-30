import { Array, Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { Command, click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import type { Locale } from '../../../../i18n/locale'
import * as Player from '../../../../lesson/player'
import { lessonView } from '../../../../lesson/view'
import { findLesson } from '../../../registry'
import lesson from './lesson'

// Урок 3 глазами ученика: вопрос «кому первый конверт» на доске, задача на
// экране телефона — руками (браузер, сведения о сети, DNS «Автоматически»,
// «Обновить») и через «Показать решение».

const entry = Option.getOrThrow(findLesson('networks', 'site-names'))

const sceneIn = (locale: Locale) => ({
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(lesson)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(lesson, entry, playerModel, { locale, prefersDark: false }, h),
})

const atQuiz = (): Player.Model => Player.init('networks', lesson, 2)

/** Шаг задачи: на вопрос уже ответили. */
const atTask = (): Player.Model => ({
  ...Player.init('networks', lesson, 0),
  quizzes: { 'who-first': { picked: 'dns', isCorrect: true } },
  step: 3,
})

const replayStep = Command.resolve(
  Player.WaitBeforeReplayStep,
  Player.Message.CompletedWaitBeforeReplayStep(),
)

describe('lesson 3: the name and the address', () => {
  test('ru: a wrong pick (the router) is explained; the DNS server is the answer', () => {
    scene(
      sceneIn('ru'),
      given(atQuiz()),
      click(role('button', { name: /^Wi-Fi router,/ })),
      expect(text(/Через router конверт пройдёт/)).toExist(),
      expect(text('передаёт, но не адресат')).toExist(),
      expect(text('первый адресат')).toExist(),
      expect(text(/телефон спрашивает справочную, DNS server/)).toExist(),
    )
  })

  test('ru: the right pick in a fresh session', () => {
    scene(
      sceneIn('ru'),
      given(atQuiz()),
      click(role('button', { name: /^DNS server,/ })),
      expect(text('первый адресат')).toExist(),
      expect(text(/Через router конверт пройдёт/)).not.toExist(),
      expect(text(/телефон спрашивает справочную, DNS server/)).toExist(),
    )
  })

  test('ru: solved by hand — the error, network details, DNS automatic, reload', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      expect(role('tab', { name: 'Браузер' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(
        role('heading', { name: 'Не удаётся найти сайт shop.example' }),
      ).toExist(),
      expect(text('ERR_NAME_NOT_RESOLVED')).toExist(),
      expect(text(/Телефону не у кого спросить адрес/)).toExist(),
      expect(role('textbox', { name: 'Адрес сайта' })).not.toHaveHandler(
        'input',
      ),
      expect(role('button', { name: 'Открыть' })).not.toExist(),
      click(role('button', { name: 'Обновить' })),
      expect(text(/Телефону не у кого спросить адрес/)).toExist(),
      click(role('tab', { name: 'Настройки' })),
      click(role('button', { name: 'Сведения о сети Router-7C21' })),
      expect(role('heading', { name: 'Router-7C21' })).toExist(),
      expect(text('192.168.1.100')).toExist(),
      click(role('button', { name: /^Настроить DNS/ })),
      click(role('radio', { name: 'Автоматически (от роутера)' })),
      expect(text('192.0.2.53')).toExist(),
      click(role('tab', { name: 'Браузер' })),
      click(role('button', { name: 'Обновить' })),
      expect(role('heading', { name: 'Сайт магазина' })).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Телефон снова знает, у кого спрашивать адреса/)).toExist(),
    )
  })

  test('en: show solution replays DNS and the reload through the journal', () => {
    scene(
      sceneIn('en'),
      given(atTask()),
      ...Array.makeBy(3, () => click(role('button', { name: /^Hint/ }))),
      click(role('button', { name: 'Show solution' })),
      replayStep,
      replayStep,
      replayStep,
      expect(text(/The phone knows whom to ask for addresses again/)).toExist(),
      click(role('tab', { name: 'Browser' })),
      expect(role('heading', { name: 'Shop website' })).toExist(),
    )
  })
})
