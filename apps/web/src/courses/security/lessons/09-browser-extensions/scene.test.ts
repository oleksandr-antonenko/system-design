import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Player from '../../../../lesson/player'
import { lessonView, loadedEntry } from '../../../../lesson/view'
import extensions from './lesson'

// Расширения браузера (урок 9): от конвертера со всеми сайтами отказаться,
// поставить вариант «по нажатию», удалить два лишних из пяти. Установка
// расширения со всеми сайтами — ошибка с объяснением.

const entry = Option.getOrThrow(loadedEntry('security', 'browser-extensions'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(extensions)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      extensions,
      entry,
      playerModel,
      { locale: 'ru', prefersDark: false },
      h,
    ),
}

const TASK_STEP = 4

const atTask: Player.Model = {
  ...Player.init('security', extensions, 0),
  quizzes: { 'which-permission': { picked: 'all-sites', isCorrect: true } },
  step: TASK_STEP,
}

const pick = (action: string, name: string) =>
  click(role('button', { name: `${action} · ${name}` }))

describe('the extensions page', () => {
  test('decline the converter with every site, install the narrow one, remove two', () => {
    scene(
      sceneFor,
      given(atTask),
      expect(role('tab', { name: 'Расширения · Марина' })).toExist(),
      pick('Отмена', 'PDF Converter Pro'),
      pick('Установить', 'PDF Tools Lite'),
      pick('Удалить', 'Купоны и скидки 24/7'),
      pick('Удалить', 'Dark Theme Max'),
      click(role('button', { name: 'Проверить' })),
      expect(text(/конвертер работает по нажатию/)).toExist(),
      expect(text('не было')).toExist(),
    )
  })

  test('installing the converter with every site is a slip; removing 1Password is explained', () => {
    scene(
      sceneFor,
      given(atTask),
      pick('Установить', 'PDF Converter Pro'),
      expect(role('alert')).toHaveText(/видит каждую страницу/),
      pick('Удалить', '1Password'),
      expect(text(/Широкие права — не приговор/)).toExist(),
      pick('Оставить', '1Password'),
      pick('Отмена', 'PDF Converter Pro'),
      pick('Установить', 'PDF Tools Lite'),
      pick('Удалить', 'Купоны и скидки 24/7'),
      pick('Удалить', 'Dark Theme Max'),
      click(role('button', { name: 'Проверить' })),
      expect(text(/расширению выдан доступ ко всем сайтам/)).toExist(),
    )
  })
})
