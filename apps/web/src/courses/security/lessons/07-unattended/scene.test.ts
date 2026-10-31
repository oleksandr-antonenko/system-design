import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Player from '../../../../lesson/player'
import { lessonView, loadedEntry } from '../../../../lesson/view'
import unattended from './lesson'

// Стол перед обедом (урок 7): пароль — в сейф, распечатку — в ящик,
// найденную флешку — Ире, ноутбук — заблокировать. Вставленная флешка —
// ошибка с объяснением; выбор можно поменять, ошибка остаётся в итоге.

const entry = Option.getOrThrow(loadedEntry('security', 'unattended'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(unattended)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      unattended,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

const TASK_STEP = 4

const atTask: Player.Model = {
  ...Player.init('security', unattended, 0),
  quizzes: { 'two-minutes': { picked: 'lock', isCorrect: true } },
  step: TASK_STEP,
}

const pick = (action: string, item: string) =>
  click(role('button', { name: `${action} · ${item}` }))

describe('the desk before lunch', () => {
  test('password to the vault, printout to the drawer, stick to IT, screen locked', () => {
    scene(
      sceneFor,
      given(atTask),
      expect(role('tab', { name: 'Стол · Марина' })).toExist(),
      pick('Пароль — в сейф, стикер — в шредер', 'Стикер на мониторе'),
      pick('Забрать и убрать в ящик', 'Распечатка в принтере'),
      pick('Отдать Ире в IT', 'Флешка с сердечком'),
      expect(text(/на отдельном компьютере/)).toExist(),
      pick('Заблокировать экран', 'Ноутбук'),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Можно спокойно идти обедать/)).toExist(),
      expect(text('не было')).toExist(),
    )
  })

  test('a plugged-in stick is explained and stays in the outcome after a change of mind', () => {
    scene(
      sceneFor,
      given(atTask),
      pick('Вставить и посмотреть, чья', 'Флешка с сердечком'),
      expect(role('alert')).toHaveText(/притвориться клавиатурой/),
      pick('Отдать Ире в IT', 'Флешка с сердечком'),
      pick('Пароль — в сейф, стикер — в шредер', 'Стикер на мониторе'),
      pick('Перевернуть надписью вниз', 'Стикер на мониторе'),
      pick('Забрать и убрать в ящик', 'Распечатка в принтере'),
      pick('Заблокировать экран', 'Ноутбук'),
      click(role('button', { name: 'Проверить' })),
      expect(text('Разобрано не так или не разобрано: 1.')).toExist(),
      pick('Пароль — в сейф, стикер — в шредер', 'Стикер на мониторе'),
      click(role('button', { name: 'Проверить' })),
      expect(text(/найденная флешка вставлена в компьютер/)).toExist(),
    )
  })

  test('the third hint outlines the next move', () => {
    scene(
      sceneFor,
      given(atTask),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      expect(
        role('button', {
          name: 'Пароль — в сейф, стикер — в шредер · Стикер на мониторе',
        }),
      ).toHaveClass('ghost'),
    )
  })
})
