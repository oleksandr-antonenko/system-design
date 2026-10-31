import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import socialEngineering from '../../../courses/security/lessons/07-social-engineering/lesson'
import * as Player from '../../../lesson/player'
import { lessonView, loadedEntry } from '../../../lesson/view'

// Мессенджер в задаче урока 7: «Виктор» с нового номера торопит со счётом.
// Пауза, звонок по номеру из справочника и пересылка в IT решают задачу;
// согласие без проверки и звонок на номер из сообщения — ошибки с
// объяснением, задача решается дальше.

const entry = Option.getOrThrow(loadedEntry('security', 'social-engineering'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(socialEngineering)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      socialEngineering,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

const MESSENGER_STEP = 5

const atMessenger: Player.Model = {
  ...Player.init('security', socialEngineering, 0),
  quizzes: { which: { picked: 'bank-call', isCorrect: true } },
  step: MESSENGER_STEP,
}

const PAUSE =
  'Виктор Андреевич, перезвоню вам по номеру из справочника, и после этого оплачу.'

describe('messenger in the task about the “director”', () => {
  test('a pause, a call from the directory and a forward to IT solve it', () => {
    scene(
      sceneFor,
      given(atMessenger),
      expect(role('tab', { name: 'Мессенджер · Марина' })).toExist(),
      expect(text(/Это мой новый номер, старый сломался/)).toExist(),
      click(role('button', { name: PAUSE })),
      expect(text('Не надо звонить, я же на встрече! Это срочно!')).toExist(),
      click(role('tab', { name: 'Справочник' })),
      click(role('button', { name: 'Позвонить · Виктор Андреевич' })),
      expect(text(/Какой счёт\? Я ничего не писал/)).toExist(),
      click(role('button', { name: 'Завершить звонок' })),
      click(role('tab', { name: 'Чаты' })),
      click(role('button', { name: 'Переслать чат: Ира · IT' })),
      expect(text('↪ Переслано: Ира · IT')).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/настоящий Виктор ничего не писал/)).toExist(),
      expect(text('не было')).toExist(),
    )
  })

  test('agreeing and calling the number from the message are explained slips', () => {
    scene(
      sceneFor,
      given(atMessenger),
      click(role('button', { name: 'Хорошо, сейчас оплачу.' })),
      expect(role('alert')).toHaveText(/Стоп: просьба не проверена/),
      click(role('button', { name: 'Позвонить на +370 600 41 977' })),
      expect(
        role('alertdialog', { name: 'Звонок · Виктор Андреевич' }),
      ).toExist(),
      expect(text(/Стоп: это не проверка/)).toExist(),
      click(role('button', { name: 'Завершить звонок' })),
      click(role('button', { name: PAUSE })),
      click(role('tab', { name: 'Справочник' })),
      click(role('button', { name: 'Позвонить · Виктор Андреевич' })),
      click(role('button', { name: 'Завершить звонок' })),
      click(role('tab', { name: 'Чаты' })),
      click(role('button', { name: 'Переслать чат: Ира · IT' })),
      click(role('button', { name: 'Проверить' })),
      expect(text(/срочная просьба принята без проверки/)).toExist(),
      expect(text(/проверка звонком на номер из сообщения/)).toExist(),
    )
  })

  test('the forwarded chat shows up in the IT chat with the answer', () => {
    scene(
      sceneFor,
      given(atMessenger),
      click(role('button', { name: 'Переслать чат: Ира · IT' })),
      click(role('button', { name: /^Ира · IT/ })),
      expect(text('↪ Вы переслали чат «Виктор Андреевич»')).toExist(),
      expect(text(/Это мошенник: номер блокирую/)).toExist(),
    )
  })

  test('the third hint outlines the next move of the solution', () => {
    scene(
      sceneFor,
      given(atMessenger),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      expect(role('button', { name: PAUSE })).toHaveClass('ghost'),
      click(role('button', { name: PAUSE })),
      expect(role('tab', { name: 'Справочник' })).toHaveClass('ghost'),
    )
  })
})
