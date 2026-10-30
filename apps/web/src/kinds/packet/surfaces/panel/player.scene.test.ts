import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  Command,
  change,
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

import wifiRange from '../../../../courses/networks/lessons/05-wifi-range/lesson'
import { findLesson } from '../../../../courses/registry'
import * as Player from '../../../../lesson/player'
import { lessonView } from '../../../../lesson/view'

// Панель роутера в плеере на задаче урока 5: вкладка поверхности, вкладка
// «Wi-Fi» с меткой «новое», сохранение отмечает цели, ошибки ввода у поля,
// «Отменить», призрак третьей подсказки и «Показать решение».

const TASK_STEP = 4

const entry = Option.getOrThrow(findLesson('networks', 'wifi-range'))

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(wifiRange)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      wifiRange,
      entry,
      playerModel,
      { locale: 'en', prefersDark: false },
      h,
    ),
}

/** Квиз шага 4 уже отвечен: иначе плеер не пустит на шаг задачи. */
const atTask = (): Player.Model => ({
  ...Player.init('networks', wifiRange, 0),
  quizzes: { 'who-drops': { picked: 'phone', isCorrect: true } },
  step: TASK_STEP,
})

const saveButton = role('button', { name: 'Save' })
const cancelButton = role('button', { name: 'Cancel' })

describe('router settings panel in lesson 5', () => {
  test('the task step opens the router panel with only the new Wi-Fi tab', () => {
    scene(
      sceneFor,
      given(atTask()),
      expect(role('tab', { name: 'Router' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(text('Router · 192.168.1.1')).toExist(),
      expect(role('tab', { name: 'Wi-Fi new' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(role('tab', { name: /Devices/ })).toBeAbsent(),
      expect(label('SSID')).toHaveValue('Router-7C21'),
      expect(label('Password')).toHaveAttr('type', 'password'),
      expect(role('radio', { name: 'With password' })).toHaveAttr(
        'aria-checked',
        'true',
      ),
      expect(saveButton).toBeDisabled(),
      expect(cancelButton).toBeDisabled(),
    )
  })

  test('both bands: save writes the op and every goal is met', () => {
    scene(
      sceneFor,
      given(atTask()),
      change(label('Band'), 'dual'),
      expect(saveButton).toBeEnabled(),
      click(saveButton),
      expect(text('Saved')).toExist(),
      click(role('button', { name: 'Check' })),
      expect(
        text(
          '2.4 GHz now reaches the kitchen: the phone and the bulb are online. The laptop in the living room stayed on the fast 5 GHz.',
        ),
      ).toExist(),
    )
  })

  test('saving without a password fails the password goal with the lesson’s words', () => {
    scene(
      sceneFor,
      given(atTask()),
      change(label('Band'), 'dual'),
      click(role('radio', { name: 'No password' })),
      click(saveButton),
      click(role('button', { name: 'Check' })),
      expect(
        text('The network is open to everyone. Bring back “With password”.'),
      ).toExist(),
    )
  })

  test('a short password is refused next to the field; nothing is saved', () => {
    scene(
      sceneFor,
      given(atTask()),
      type(label('Password'), '1234'),
      click(saveButton),
      expect(label('Password')).toHaveAttr('aria-invalid', 'true'),
      expect(text('A Wi-Fi password needs at least 8 characters.')).toExist(),
      expect(text('Saved')).toBeAbsent(),
    )
  })

  test('show reveals the password; cancel brings back the saved values', () => {
    scene(
      sceneFor,
      given(atTask()),
      click(role('button', { name: 'Show' })),
      expect(label('Password')).toHaveAttr('type', 'text'),
      type(label('SSID'), 'Kitchen'),
      expect(label('SSID')).toHaveValue('Kitchen'),
      click(cancelButton),
      expect(label('SSID')).toHaveValue('Router-7C21'),
      expect(saveButton).toBeDisabled(),
    )
  })

  test('the third hint frames the band field without filling it in', () => {
    scene(
      sceneFor,
      given(atTask()),
      expect(label('Band')).not.toHaveAttr(
        'aria-description',
        'Hint: look here',
      ),
      click(role('button', { name: 'Hint · 0 of 3' })),
      click(role('button', { name: 'Hint · 1 of 3' })),
      click(role('button', { name: 'Hint · 2 of 3' })),
      expect(label('Band')).toHaveAttr('aria-description', 'Hint: look here'),
      expect(label('SSID')).not.toHaveAttr(
        'aria-description',
        'Hint: look here',
      ),
      expect(role('tab', { name: 'Wi-Fi new' })).toHaveClass('ghost'),
    )
  })

  test('“Show solution” replays the op; the panel follows the document', () => {
    scene(
      sceneFor,
      given(atTask()),
      click(role('button', { name: 'Hint · 0 of 3' })),
      click(role('button', { name: 'Hint · 1 of 3' })),
      click(role('button', { name: 'Hint · 2 of 3' })),
      click(role('button', { name: 'Show solution' })),
      Command.resolve(
        Player.WaitBeforeReplayStep,
        Player.Message.CompletedWaitBeforeReplayStep(),
      ),
      Command.resolve(
        Player.WaitBeforeReplayStep,
        Player.Message.CompletedWaitBeforeReplayStep(),
      ),
      expect(text('The task is closed: settings are read-only.')).toExist(),
      expect(label('Band')).toBeDisabled(),
      expect(role('option', { name: '2.4 and 5 GHz' })).toHaveAttr(
        'selected',
        'true',
      ),
    )
  })
})
