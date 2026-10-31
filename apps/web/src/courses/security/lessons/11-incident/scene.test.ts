import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Player from '../../../../lesson/player'
import { lessonView, loadedEntry } from '../../../../lesson/view'
import incident from './lesson'

// Первые 15 минут после клика (урок 11) на экранах прошлых уроков:
// мессенджер, менеджер паролей и почта. Удалённая приманка — ошибка с
// объяснением: она лежит в корзине, и переслать её можно оттуда.

const entry = Option.getOrThrow(loadedEntry('security', 'incident'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(incident)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      incident,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

const TASK_STEP = 4

const atTask: Player.Model = {
  ...Player.init('security', incident, 0),
  quizzes: { 'bait-after': { picked: 'forward', isCorrect: true } },
  step: TASK_STEP,
}

const REPORT =
  'Ира, я нажал кнопку в письме «Ваш пароль истекает» и ввёл там пароль от почты. Что делать?'

const openBait = click(
  role('button', { name: /Ваш пароль истекает сегодня/, pressed: false }),
)

describe('the first 15 minutes', () => {
  test('tell Ira, change the password, sign out everywhere and forward the bait', () => {
    scene(
      sceneFor,
      given(atTask),
      expect(role('tab', { name: 'Мессенджер · Олег' })).toExist(),
      click(role('button', { name: REPORT })),
      expect(text(/Спасибо, что сразу написал!/)).toExist(),
      click(role('tab', { name: 'Сейф · Олег' })),
      click(role('button', { name: /^Рабочая почта/ })),
      click(role('button', { name: 'Заменить сгенерированным' })),
      click(role('tab', { name: 'Почта · Олег' })),
      expect(
        text('Последний вход в почту: Неизвестный город · 09:14'),
      ).toExist(),
      click(role('button', { name: 'Подробнее' })),
      expect(text('не узнаёте?')).toExist(),
      click(role('button', { name: 'Выйти на всех других устройствах' })),
      expect(text(/Все другие сеансы завершены/)).toExist(),
      openBait,
      click(role('button', { name: '↪ Переслать в IT' })),
      expect(text(/Переслано в IT\. По письму найдут/)).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Полосатый остался со старым ключом/)).toExist(),
      expect(text('не было')).toExist(),
    )
  })

  test('deleting the bait is a slip: it is explained and the bait is forwarded from the trash', () => {
    scene(
      sceneFor,
      given(atTask),
      click(role('tab', { name: 'Почта · Олег' })),
      openBait,
      click(role('button', { name: '🗑 Удалить' })),
      expect(role('alert')).toHaveText(/Приманка в корзине/),
      expect(text('Корзина')).toExist(),
      click(role('button', { name: '↪ Переслать в IT' })),
      click(role('tab', { name: 'Мессенджер · Олег' })),
      click(role('button', { name: REPORT })),
      click(role('tab', { name: 'Сейф · Олег' })),
      click(role('button', { name: /^Рабочая почта/ })),
      click(role('button', { name: 'Заменить сгенерированным' })),
      click(role('tab', { name: 'Почта · Олег' })),
      click(role('button', { name: 'Подробнее' })),
      click(role('button', { name: 'Выйти на всех других устройствах' })),
      click(role('button', { name: 'Проверить' })),
      expect(text(/приманка удалена, а не переслана в IT/)).toExist(),
    )
  })

  test('the third hint outlines the next move, even on another screen', () => {
    scene(
      sceneFor,
      given(atTask),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      expect(role('button', { name: REPORT })).toHaveClass('ghost'),
      click(role('button', { name: REPORT })),
      click(role('tab', { name: 'Сейф · Олег' })),
      expect(role('button', { name: /^Рабочая почта/ })).toHaveClass('ghost'),
    )
  })
})
