import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Player from '../../../../lesson/player'
import { lessonView, loadedEntry } from '../../../../lesson/view'
import passwordAttacks from './lesson'

// Пароли Олега на проверке (урок 2): что упадёт сразу, что подберут по
// соцсетям, что держится. Неверный выбор объясняется и его можно поменять.

const entry = Option.getOrThrow(loadedEntry('security', 'password-attacks'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(passwordAttacks)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      passwordAttacks,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

const TASK_STEP = 7

const atTask: Player.Model = {
  ...Player.init('security', passwordAttacks, 0),
  quizzes: { stuffing: { picked: 'mail-too', isCorrect: true } },
  step: TASK_STEP,
}

const pick = (action: string, password: string) =>
  click(role('button', { name: `${action} · ${password}` }))

describe('Oleg’s passwords on the check', () => {
  test('lists and leaks fall at once, the cat is guessed from social media, the phrase holds', () => {
    scene(
      sceneFor,
      given(atTask),
      expect(role('tab', { name: 'Пароли · Олег' })).toExist(),
      pick('Упадёт сразу', 'Qwerty123!'),
      pick('Упадёт сразу', 'Romashka2024!'),
      pick('Упадёт сразу', 'Gr@nd!Tour#88'),
      expect(text(/уже лежит в базе утечки/)).toExist(),
      pick('Подберут по соцсетям', 'Barsik2015'),
      pick('Держится', 'кофе-лыжи-подоконник'),
      pick('Держится', 'v7#Lq9TmZ!x2pR4w'),
      click(role('button', { name: 'Проверить' })),
      expect(text(/три пароля Олег меняет сегодня/)).toExist(),
    )
  })

  test('a wrong choice is explained and can be changed', () => {
    scene(
      sceneFor,
      given(atTask),
      pick('Держится', 'Gr@nd!Tour#88'),
      expect(text(/Знаки не спасают пароль, который уже утёк/)).toExist(),
      pick('Упадёт сразу', 'Qwerty123!'),
      pick('Упадёт сразу', 'Romashka2024!'),
      pick('Подберут по соцсетям', 'Barsik2015'),
      pick('Держится', 'кофе-лыжи-подоконник'),
      pick('Держится', 'v7#Lq9TmZ!x2pR4w'),
      click(role('button', { name: 'Проверить' })),
      expect(text('Разобрано не так или не разобрано: 1.')).toExist(),
      pick('Упадёт сразу', 'Gr@nd!Tour#88'),
      click(role('button', { name: 'Проверить' })),
      expect(text(/три пароля Олег меняет сегодня/)).toExist(),
    )
  })

  test('the third hint outlines the next move', () => {
    scene(
      sceneFor,
      given(atTask),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      expect(role('button', { name: 'Упадёт сразу · Qwerty123!' })).toHaveClass(
        'ghost',
      ),
    )
  })
})
