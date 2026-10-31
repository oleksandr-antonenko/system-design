import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  click,
  expect,
  given,
  label,
  role,
  scene,
  text,
  type,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import twoFactor from '../../../courses/security/lessons/05-two-factor/lesson'
import * as Player from '../../../lesson/player'
import { lessonView, loadedEntry } from '../../../lesson/view'

// Страница безопасности и аутентификатор в задаче урока 5: QR-код, шесть
// цифр, резервные коды, чужой запрос входа. «Да» на чужой запрос — ошибка
// с объяснением, вход тут же завершают, задача решается дальше.

const entry = Option.getOrThrow(loadedEntry('security', 'two-factor'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(twoFactor)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      twoFactor,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

const ENABLE_STEP = 4

const atEnable: Player.Model = {
  ...Player.init('security', twoFactor, 0),
  quizzes: { 'code-call': { picked: 'call-back', isCorrect: true } },
  step: ENABLE_STEP,
}

describe('2FA in the enable task', () => {
  test('QR code, six digits, backup codes, then a stranger declined and reported', () => {
    scene(
      sceneFor,
      given(atEnable),
      expect(role('tab', { name: '2FA · Марина' })).toExist(),
      click(role('button', { name: 'Сканировать QR-код' })),
      expect(role('alert')).toHaveText(/Камере нечего сканировать/),
      click(role('button', { name: 'Включить 2FA' })),
      expect(
        role('img', { name: 'QR-код для приложения-аутентификатора' }),
      ).toExist(),
      click(role('button', { name: 'Сканировать QR-код' })),
      expect(text('381 640')).toExist(),
      type(label('Код из приложения'), '123456'),
      click(role('button', { name: 'Подтвердить' })),
      expect(role('alert')).toHaveText(/Код не подходит/),
      type(label('Код из приложения'), '381 640'),
      click(role('button', { name: 'Подтвердить' })),
      expect(text(/2FA включена/)).toExist(),
      click(role('button', { name: 'Сохранить в менеджер паролей' })),
      expect(role('alertdialog', { name: 'Это вы входите?' })).toExist(),
      expect(text('Неизвестный город · 02:47')).toExist(),
      click(role('button', { name: 'Нет, это не я' })),
      click(role('button', { name: 'Сообщить в IT' })),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Полосатый остался за дверью/)).toExist(),
      expect(text('не было')).toExist(),
    )
  })

  test('“Yes” to a stranger is a slip: it is explained, the sign-in is ended and the outcome names it', () => {
    scene(
      sceneFor,
      given(atEnable),
      click(role('button', { name: 'Включить 2FA' })),
      click(role('button', { name: 'Сканировать QR-код' })),
      type(label('Код из приложения'), '381640'),
      click(role('button', { name: 'Подтвердить' })),
      click(role('button', { name: 'Сохранить в менеджер паролей' })),
      click(role('button', { name: 'Да, это я' })),
      expect(
        role('alertdialog', { name: 'Стоп: вы впустили чужого' }),
      ).toExist(),
      click(role('button', { name: 'Это был не я — завершить вход' })),
      click(role('button', { name: 'Сообщить в IT' })),
      click(role('button', { name: 'Проверить' })),
      expect(text(/чужой вход подтверждён кнопкой «Да»/)).toExist(),
    )
  })

  test('the third hint outlines the next move of the solution', () => {
    scene(
      sceneFor,
      given(atEnable),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      expect(role('button', { name: 'Включить 2FA' })).toHaveClass('ghost'),
      click(role('button', { name: 'Включить 2FA' })),
      expect(role('button', { name: 'Сканировать QR-код' })).toHaveClass(
        'ghost',
      ),
    )
  })
})
