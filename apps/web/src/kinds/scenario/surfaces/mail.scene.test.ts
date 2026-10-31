import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  click,
  expect,
  given,
  hover,
  role,
  scene,
  selector,
  text,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import phishing from '../../../courses/security/lessons/06-phishing/lesson'
import * as Player from '../../../lesson/player'
import { lessonView, loadedEntry } from '../../../lesson/view'

// Почта в задаче урока 6 (spec scenario-board, «Почтовый ящик»): адрес по
// нажатию на имя, адрес ссылки в строке состояния, «картонная» страница
// приманки, пометки и итог с ошибкой по ходу.

const entry = Option.getOrThrow(loadedEntry('security', 'phishing'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(phishing)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      phishing,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

const INBOX_STEP = 8

const atInbox: Player.Model = {
  ...Player.init('security', phishing, 0),
  quizzes: {
    prize: { picked: 'skip', isCorrect: true },
    clue: { picked: 'addr', isCorrect: true },
  },
  step: INBOX_STEP,
}

const open = (subject: RegExp) =>
  click(role('button', { name: subject, pressed: false }))

describe('mail in the inbox task', () => {
  test('the name is a costume: the address shows on demand, the link address on hover', () => {
    scene(
      sceneFor,
      given(atInbox),
      expect(role('tab', { name: 'Почта · Марина' })).toExist(),
      expect(text('разобрано 0 из 6')).toExist(),
      open(/Ваш пароль истекает сегодня/),
      expect(text('it-support@rornashka.example')).not.toExist(),
      click(role('button', { name: 'IT-отдел: показать адрес отправителя' })),
      expect(text('it-support@rornashka.example')).toExist(),
      hover(role('button', { name: 'Сохранить текущий пароль' })),
      expect(selector('.scenario-statusbar')).toHaveText(
        /https:\/\/rornashka\.example\/mail\/login/,
      ),
    )
  })

  test('pressing a link in a bait opens the cardboard page and is named in the outcome', () => {
    scene(
      sceneFor,
      given(atInbox),
      open(/Ваш пароль истекает сегодня/),
      click(role('button', { name: 'Сохранить текущий пароль' })),
      expect(role('alert')).toHaveText(/картонная дверь/),
      click(role('button', { name: '← К письму' })),
      click(role('button', { name: '⚑ Это фишинг' })),
      expect(text('Верно: приманка.')).toExist(),
      open(/В субботу почта не работает/),
      click(role('button', { name: '⚑ Это фишинг' })),
      expect(text('Это настоящее письмо.')).toExist(),
      click(role('button', { name: '✓ Настоящее' })),
      open(/Посылка задержана/),
      click(role('button', { name: '⚑ Это фишинг' })),
      open(/Фото с корпоратива/),
      click(role('button', { name: '✓ Настоящее' })),
      open(/Опрос: куда едем летом/),
      click(role('button', { name: '✓ Настоящее' })),
      open(/Счёт за стенд в Вильнюсе/),
      click(role('button', { name: '⚑ Это фишинг' })),
      expect(text('разобрано 6 из 6')).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/три приманки пойманы/)).toExist(),
      expect(text(/нажата ссылка или вложение в приманке/)).toExist(),
    )
  })

  test('a link in a genuine email opens your own site and is not a slip', () => {
    scene(
      sceneFor,
      given(atInbox),
      open(/Фото с корпоратива/),
      click(role('button', { name: 'Папка «Корпоратив»' })),
      expect(
        text(
          'Это ваш сайт: drive.romashka.example заканчивается на romashka.example.',
        ),
      ).toExist(),
    )
  })
})
