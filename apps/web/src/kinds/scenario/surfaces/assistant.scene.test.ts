import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { click, expect, given, label, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import aiAccess from '../../../courses/security/lessons/10-ai-access/lesson'
import * as Player from '../../../lesson/player'
import { lessonView, loadedEntry } from '../../../lesson/view'

// Чат с ассистентом и токены CRM в задаче урока 10: узкий токен, ссылка
// на запись в менеджере паролей и отзыв после работы решают задачу.
// Пароль администратора в чате — ошибка: сообщение удаляют, пароль меняют.

const entry = Option.getOrThrow(loadedEntry('security', 'ai-access'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(aiAccess)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      aiAccess,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

const TOKEN_STEP = 4

const atToken: Player.Model = {
  ...Player.init('security', aiAccess, 0),
  quizzes: { leak: { picked: 'env', isCorrect: true } },
  step: TOKEN_STEP,
}

const narrowToken = [
  click(label('Только чтение')),
  click(label('Клиенты')),
  click(label('Счета')),
  click(label('Сотрудники')),
  click(label('7 дней')),
  click(role('button', { name: 'Создать токен' })),
] as const

describe('AI assistant and CRM tokens', () => {
  test('a narrow token, a link to the vault item and a revoke after the work solve it', () => {
    scene(
      sceneFor,
      given(atToken),
      expect(role('tab', { name: 'Ассистент · Марина' })).toExist(),
      expect(text(/пришлите логин и пароль администратора/)).toExist(),
      click(
        role('button', { name: 'Дать ссылку на запись в менеджере паролей' }),
      ),
      expect(text(/Токена пока нет/)).toExist(),
      click(role('tab', { name: 'CRM · Марина' })),
      ...narrowToken,
      expect(text('Только чтение · Продажи · 7 дней')).toExist(),
      click(role('button', { name: 'Сохранить в менеджер паролей' })),
      expect(
        text('✓ В менеджере паролей: op://Work/crm-agent/token'),
      ).toExist(),
      click(role('tab', { name: 'Ассистент · Марина' })),
      click(
        role('button', { name: 'Дать ссылку на запись в менеджере паролей' }),
      ),
      expect(text(/Запускаю через op run/)).toExist(),
      expect(text(/выгрузил 248 сделок/)).toExist(),
      click(role('tab', { name: 'CRM · Марина' })),
      click(role('button', { name: 'Отозвать' })),
      expect(text('отозван')).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Пароль администратора не покидал CRM/)).toExist(),
      expect(text('не было')).toExist(),
    )
  })

  test('the default token is too broad and says so', () => {
    scene(
      sceneFor,
      given(atToken),
      click(role('tab', { name: 'CRM · Марина' })),
      click(role('button', { name: 'Создать токен' })),
      expect(text(/Шире, чем нужно ассистенту/)).toExist(),
    )
  })

  test('the admin password in the chat is a slip: deleted from the chat and changed', () => {
    scene(
      sceneFor,
      given(atToken),
      click(role('button', { name: 'Вставить пароль администратора' })),
      expect(role('alert')).toHaveText(
        /Пароль администратора теперь в истории чата/,
      ),
      expect(text(/Не присылайте пароли в чат/)).toExist(),
      click(role('button', { name: 'Удалить сообщение' })),
      expect(text('Сообщение удалено')).toExist(),
      click(role('tab', { name: 'CRM · Марина' })),
      click(role('button', { name: 'Сменить пароль' })),
      ...narrowToken,
      click(role('button', { name: 'Сохранить в менеджер паролей' })),
      click(role('tab', { name: 'Ассистент · Марина' })),
      click(
        role('button', { name: 'Дать ссылку на запись в менеджере паролей' }),
      ),
      click(role('tab', { name: 'CRM · Марина' })),
      click(role('button', { name: 'Отозвать' })),
      click(role('button', { name: 'Проверить' })),
      expect(
        text(/пароль администратора вставлен в чат с ассистентом/),
      ).toExist(),
    )
  })
})
