import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import passwordManager from '../../../courses/security/lessons/03-password-manager/lesson'
import * as Player from '../../../lesson/player'
import { lessonView, loadedEntry } from '../../../lesson/view'

// Менеджер паролей в задаче урока 3: стикеры уходят в сейф, повтор виден и
// заменяется сгенерированным паролем, доступ к соцсети — через общий сейф.
// Пароль, отправленный в чат, — ошибка с объяснением, задача решается дальше.

const entry = Option.getOrThrow(loadedEntry('security', 'password-manager'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(passwordManager)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      passwordManager,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

const APP_STEP = 3
const LOOKALIKE_STEP = 5
const STICKERS_STEP = 6

const atStickers: Player.Model = {
  ...Player.init('security', passwordManager, 0),
  quizzes: { 'no-autofill': { picked: 'wrong-address', isCorrect: true } },
  step: STICKERS_STEP,
}

const save = (name: string) =>
  click(role('button', { name: `Перенести в сейф · ${name}` }))

describe('password manager in the stickers task', () => {
  test('stickers go into the vault, the reuse is replaced, access goes through the shared vault', () => {
    scene(
      sceneFor,
      given(atStickers),
      expect(role('tab', { name: 'Сейф · Марина' })).toExist(),
      expect(text('пароль: Romashka2024')).toExist(),
      save('CRM компании'),
      save('Доставка обедов'),
      expect(text(/Такой же пароль у «CRM компании»/)).toExist(),
      click(role('button', { name: 'Заменить сгенерированным' })),
      expect(text(/Новый пароль сгенерирован сейфом/)).toExist(),
      save('Соцсеть компании'),
      click(role('button', { name: 'Поделиться…' })),
      click(role('button', { name: 'Переместить в общий сейф «Маркетинг»' })),
      expect(text('Лежит в общем сейфе «Маркетинг»')).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Олег видит соцсеть в общем сейфе/)).toExist(),
      expect(text('не было')).toExist(),
    )
  })

  test('a password sent in the chat is explained and named in the outcome', () => {
    scene(
      sceneFor,
      given(atStickers),
      save('Соцсеть компании'),
      click(role('button', { name: 'Поделиться…' })),
      click(role('button', { name: 'Скопировать пароль в чат · Олег' })),
      expect(
        role('alertdialog', { name: 'Стоп: пароль ушёл в чат' }),
      ).toExist(),
      click(role('button', { name: 'Понятно' })),
      click(role('button', { name: 'Поделиться…' })),
      click(role('button', { name: 'Переместить в общий сейф «Маркетинг»' })),
      save('CRM компании'),
      click(role('button', { name: 'Заменить сгенерированным' })),
      save('Доставка обедов'),
      click(role('button', { name: 'Проверить' })),
      expect(text(/пароль отправлен в чат/)).toExist(),
    )
  })

  test('a password cannot be replaced while it is still on a sticker; the check names what is left', () => {
    scene(
      sceneFor,
      given(atStickers),
      click(role('button', { name: 'Проверить' })),
      expect(text('Стикеров с паролями на мониторе: 3.')).toExist(),
    )
  })

  test('the third hint outlines the next move of the solution', () => {
    scene(
      sceneFor,
      given(atStickers),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      expect(
        role('button', { name: 'Перенести в сейф · CRM компании' }),
      ).toHaveClass('ghost'),
    )
  })
})

describe('before the task', () => {
  test('1Password is introduced on its own step before the task opens it', () => {
    scene(
      sceneFor,
      given({ ...Player.init('security', passwordManager, 0), step: APP_STEP }),
      expect(text('Как он выглядит: 1Password')).toExist(),
      expect(text('1Password в браузере')).toExist(),
    )
  })

  test('the lookalike step compares the real address with two lookalikes', () => {
    scene(
      sceneFor,
      given({
        ...Player.init('security', passwordManager, 0),
        quizzes: {
          'no-autofill': { picked: 'wrong-address', isCorrect: true },
        },
        step: LOOKALIKE_STEP,
      }),
      expect(text('Сравните по буквам')).toExist(),
      expect(text('настоящий, из записи')).toExist(),
      expect(text('двойник: тире вместо точки')).toExist(),
      expect(text('двойник: «rn» вместо «m»')).toExist(),
      expect(role('button', { name: /Подробнее: как читать адрес/ })).toExist(),
    )
  })
})
