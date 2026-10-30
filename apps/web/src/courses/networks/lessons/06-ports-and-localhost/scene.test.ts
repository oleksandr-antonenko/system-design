import { Array, Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  Command,
  click,
  expect,
  given,
  role,
  scene,
  submit,
  text,
  type,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import type { Locale } from '../../../../i18n/locale'
import * as Player from '../../../../lesson/player'
import { lessonView, loadedEntry } from '../../../../lesson/view'
import lesson from './lesson'

// Урок 6 глазами ученика: вопрос с экранами браузера, задача в терминале
// ноутбука и браузере телефона — руками и через «Показать решение».

const entry = Option.getOrThrow(loadedEntry('networks', 'ports-and-localhost'))

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
  quizzes: { 'phone-localhost': { picked: 'refused', isCorrect: true } },
  step: 4,
})

const replayStep = Command.resolve(
  Player.WaitBeforeReplayStep,
  Player.Message.CompletedWaitBeforeReplayStep(),
)

describe('lesson 6: the phone and localhost', () => {
  test('ru: the question shows four browser screens; the answer is the refusal', () => {
    scene(
      sceneIn('ru'),
      given(atQuiz()),
      expect(role('button', { name: 'Отказ в соединении' })).toHaveText(
        /ERR_CONNECTION_REFUSED/,
      ),
      expect(role('button', { name: 'Сайт не найден' })).toHaveText(
        /ERR_NAME_NOT_RESOLVED/,
      ),
      click(role('button', { name: 'Ваш сайт открылся' })),
      expect(text(/localhost на телефоне значит сам телефон/)).toExist(),
      expect(text(/Это и есть ERR_CONNECTION_REFUSED/)).toExist(),
    )
  })

  test('ru: solved by hand — Ctrl+C, the restart with -- --host, the laptop address on the phone', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      expect(role('tab', { name: 'Терминал · Laptop' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(text('  ➜  Network: use --host to expose')).toExist(),
      expect(role('button', { name: /npm run dev/ })).toHaveText(/новое/),
      type(role('textbox', { name: 'Команда' }), 'ip a'),
      submit(role('form', { name: 'Команда' })),
      expect(text(/Server ещё работает в этом окне/)).toExist(),
      click(role('button', { name: 'Остановить программу (Ctrl+C)' })),
      expect(text('^C')).toExist(),
      type(role('textbox', { name: 'Команда' }), 'npm run dev -- --host'),
      submit(role('form', { name: 'Команда' })),
      expect(text('  ➜  Network: http://192.168.1.42:5173/')).toExist(),
      click(role('tab', { name: 'Экран · Phone' })),
      expect(
        role('heading', { name: 'Не удаётся получить доступ к сайту' }),
      ).toExist(),
      expect(text(/Этот адрес ведёт в сам телефон/)).toExist(),
      type(role('textbox', { name: 'Адрес сайта' }), '192.168.1.42:5173'),
      submit(role('form', { name: 'Адрес сайта' })),
      expect(role('heading', { name: 'Мой сайт' })).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Сайт с ноутбука открылся на телефоне/)).toExist(),
    )
  })

  test('en: the --host trap is explained by the lesson', () => {
    scene(
      sceneIn('en'),
      given(atTask()),
      click(role('button', { name: 'Stop the program (Ctrl+C)' })),
      type(role('textbox', { name: 'Command' }), 'npm run dev --host'),
      submit(role('form', { name: 'Command' })),
      expect(text('  ➜  Network: use --host to expose')).toExist(),
      click(role('button', { name: 'Check' })),
      expect(text(/npm keeps the flag/)).toExist(),
    )
  })

  test('en: show solution replays the commands and the browser through the journal', () => {
    scene(
      sceneIn('en'),
      given(atTask()),
      ...Array.makeBy(3, () => click(role('button', { name: /^Hint/ }))),
      click(role('button', { name: 'Show solution' })),
      replayStep,
      replayStep,
      replayStep,
      replayStep,
      expect(text(/The site from the laptop opened on the phone/)).toExist(),
      expect(text('  ➜  Network: http://192.168.1.42:5173/')).toExist(),
      click(role('tab', { name: 'Screen · Phone' })),
      expect(role('heading', { name: 'My site' })).toExist(),
    )
  })
})
