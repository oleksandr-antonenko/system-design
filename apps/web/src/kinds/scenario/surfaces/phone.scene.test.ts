import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import sharedRoom from '../../../courses/security/lessons/01-shared-room/lesson'
import * as Player from '../../../lesson/player'
import { lessonView, loadedEntry } from '../../../lesson/view'

// Экран телефона в задаче «Аэропорт» урока 1 (spec scenario-board, «Экран
// телефона»): двойник с паролем — ошибка с объяснением, сеть с паролем —
// объяснение, правильный порядок решает задачу.

const entry = Option.getOrThrow(loadedEntry('security', 'shared-room'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(sharedRoom)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      sharedRoom,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

const AIRPORT_STEP = 7

const atAirport: Player.Model = {
  ...Player.init('security', sharedRoom, 0),
  quizzes: { 'client-wifi': { picked: 'guest-card', isCorrect: true } },
  step: AIRPORT_STEP,
}

describe('phone screen in the airport task', () => {
  test('the lookalike asks for the mail password: the slip is explained and the task goes on', () => {
    scene(
      sceneFor,
      given(atAirport),
      expect(role('tab', { name: 'Экран · Марина' })).toExist(),
      expect(text('нет сети')).toExist(),
      click(role('button', { name: /^Wi-Fi/ })),
      click(role('button', { name: /^Lounge-Business,/ })),
      expect(
        role('dialog', { name: '«Lounge-Business» — с паролем' }),
      ).toExist(),
      click(role('button', { name: 'Понятно' })),
      click(role('button', { name: /^AIRPORT-FREE-WiFi,/ })),
      expect(role('dialog', { name: 'Free WiFi · вход' })).toExist(),
      expect(text('marina@romashka.example')).toExist(),
      click(role('button', { name: 'Войти' })),
      expect(
        role('alertdialog', { name: 'Стоп: пароль ушёл соседу' }),
      ).toExist(),
      click(role('button', { name: 'Понятно' })),
      expect(text('Ой. Кажется, сеть была не та.')).toExist(),
      click(role('button', { name: /^AIRPORT-FREE,/ })),
      expect(role('dialog', { name: 'Wi-Fi аэропорта' })).toExist(),
      click(role('button', { name: 'Принять' })),
      click(role('switch', { name: 'VPN' })),
      expect(text('Подключено к офису')).toExist(),
      click(role('button', { name: 'Почта' })),
      click(role('button', { name: 'Отправить' })),
      expect(text('✓ Отправлено через VPN')).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(
        text(
          'Готово: настоящая сеть аэропорта, VPN до офиса, договор у клиента.',
        ),
      ).toExist(),
      expect(text(/введён на странице сети «AIRPORT-FREE-WiFi»/)).toExist(),
    )
  })

  test('mail without VPN needs an explicit choice and is named as a slip', () => {
    scene(
      sceneFor,
      given(atAirport),
      click(role('button', { name: 'Почта' })),
      expect(role('dialog', { name: 'Нет подключения к интернету' })).toExist(),
      click(role('button', { name: 'Понятно' })),
      click(role('button', { name: /^Wi-Fi/ })),
      click(role('button', { name: /^AIRPORT-FREE,/ })),
      click(role('button', { name: 'Принять' })),
      click(role('button', { name: 'Почта' })),
      expect(role('dialog', { name: 'VPN выключен' })).toExist(),
      click(role('button', { name: 'Открыть без VPN' })),
      expect(role('alert')).toHaveText(/Почта открыта без VPN/),
      expect(role('button', { name: 'Отправить' })).toHaveAttr(
        'disabled',
        'true',
      ),
    )
  })

  test('the third hint outlines the next move of the solution', () => {
    scene(
      sceneFor,
      given(atAirport),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      expect(role('button', { name: /^Wi-Fi/ })).toHaveClass('ghost'),
      click(role('button', { name: /^Wi-Fi/ })),
      expect(role('button', { name: /^AIRPORT-FREE,/ })).toHaveClass('ghost'),
    )
  })
})
