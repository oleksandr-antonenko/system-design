import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Player from '../../../../lesson/player'
import { lessonView, loadedEntry } from '../../../../lesson/view'
import officeDay from './lesson'

// День в офисе (урок 12): ситуации дня на экранах прошлых уроков. Каждая
// задача открывает свой экран; здесь — письмо «бухгалтерии», «Ира» с
// нового номера и новое расширение.

const entry = Option.getOrThrow(loadedEntry('security', 'office-day'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(officeDay)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      officeDay,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

const at = (step: number): Player.Model => ({
  ...Player.init('security', officeDay, 0),
  quizzes: { 'guest-wifi': { picked: 'guest', isCorrect: true } },
  step,
})

describe('a day at the office', () => {
  test('each situation opens only its own screen', () => {
    scene(
      sceneFor,
      given(at(3)),
      expect(role('tab', { name: 'Почта · Марина' })).toExist(),
      expect(role('tab', { name: 'Телефон · Марина' })).not.toExist(),
    )
    scene(
      sceneFor,
      given(at(5)),
      expect(role('tab', { name: 'Расширения · Марина' })).toExist(),
      expect(role('tab', { name: 'Почта · Марина' })).not.toExist(),
    )
  })

  test('the new extension: decline every site, remove the old coupons', () => {
    scene(
      sceneFor,
      given(at(5)),
      click(role('button', { name: 'Отмена · Super Sheets Helper' })),
      click(role('button', { name: 'Удалить · Купоны и скидки 24/7' })),
      click(role('button', { name: 'Проверить' })),
      expect(text(/не получил нового шпиона/)).toExist(),
    )
  })

  test('"Ira" from a new number: pause, call from the directory, forward', () => {
    scene(
      sceneFor,
      given(at(4)),
      expect(role('tab', { name: 'Мессенджер · Марина' })).toExist(),
      click(
        role('button', {
          name: 'Ира, перезвоню тебе на рабочий номер из справочника и тогда поставлю.',
        }),
      ),
      click(role('tab', { name: 'Справочник' })),
      click(role('button', { name: 'Позвонить · Ира' })),
      expect(text(/я ничего не писала/)).toExist(),
    )
  })
})
