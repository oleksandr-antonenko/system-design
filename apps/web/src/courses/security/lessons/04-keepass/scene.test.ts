import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Player from '../../../../lesson/player'
import { lessonView, loadedEntry } from '../../../../lesson/view'
import keepass from './lesson'

// Сейф-файл KeePass (урок 4): база, надёжная мастер-фраза, записи с
// бумажки и свежая копия на другом устройстве. Слабая фраза — ошибка с
// объяснением; копия на том же ноутбуке или сделанная до записей цель не
// закрывает.

const entry = Option.getOrThrow(loadedEntry('security', 'keepass'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(keepass)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      keepass,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

const TASK_STEP = 4

const atTask: Player.Model = {
  ...Player.init('security', keepass, 0),
  quizzes: { nobody: { picked: 'nobody', isCorrect: true } },
  step: TASK_STEP,
}

const add = (name: string) =>
  click(role('button', { name: `Добавить в базу · ${name}` }))

describe('the KeePass vault file', () => {
  test('create, pick a strong phrase, add the entries and copy to the stick', () => {
    scene(
      sceneFor,
      given(atTask),
      expect(role('tab', { name: 'KeePass · Марина' })).toExist(),
      click(role('button', { name: 'Создать новую базу' })),
      click(role('button', { name: 'Marina1990' })),
      expect(role('alert')).toHaveText(/Её угадают/),
      click(role('button', { name: 'зебра трамвай кефир маяк' })),
      expect(text('Записи в базе: 0')).toExist(),
      add('Личный банк'),
      add('Домашний Wi-Fi'),
      click(role('button', { name: 'Сохранить копию…' })),
      click(role('button', { name: 'Флешка в шкафу' })),
      expect(text('свежая')).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/свежая копия ждёт на флешке/)).toExist(),
      expect(text(/мастер-фраза, которую легко угадать/)).toExist(),
    )
  })

  test('a copy on the same laptop does not count', () => {
    scene(
      sceneFor,
      given(atTask),
      click(role('button', { name: 'Создать новую базу' })),
      click(role('button', { name: 'зебра трамвай кефир маяк' })),
      add('Личный банк'),
      add('Домашний Wi-Fi'),
      click(role('button', { name: 'Сохранить копию…' })),
      click(role('button', { name: 'Ноутбук → Рабочий стол' })),
      expect(text('на том же ноутбуке')).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Копия лежит на том же ноутбуке/)).toExist(),
    )
  })

  test('a copy made before the entries is out of date', () => {
    scene(
      sceneFor,
      given(atTask),
      click(role('button', { name: 'Создать новую базу' })),
      click(role('button', { name: 'зебра трамвай кефир маяк' })),
      click(role('button', { name: 'Сохранить копию…' })),
      click(role('button', { name: 'Флешка в шкафу' })),
      add('Личный банк'),
      add('Домашний Wi-Fi'),
      expect(text('устарела')).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Копия старше базы/)).toExist(),
    )
  })

  test('the third hint outlines the next move', () => {
    scene(
      sceneFor,
      given(atTask),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      click(role('button', { name: /^Подсказка/ })),
      expect(role('button', { name: 'Создать новую базу' })).toHaveClass(
        'ghost',
      ),
    )
  })
})

describe('before the task', () => {
  test('KeePass is introduced next to 1Password, and phrases are compared', () => {
    scene(
      sceneFor,
      given(Player.init('security', keepass, 0)),
      expect(text(/В уроке 3 пароли хранил 1Password/)).toExist(),
    )
    scene(
      sceneFor,
      given({ ...atTask, step: 2 }),
      expect(text('Какую фразу подберут')).toExist(),
      expect(text('имя и год рождения')).toExist(),
    )
  })
})
