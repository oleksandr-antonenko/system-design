import { Option } from 'effect'
import {
  Command,
  Mount,
  click,
  expect,
  given,
  role,
  scene,
  selector,
  text,
  within,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Board from '../board/board'
import { BoardPointer } from '../board/pointer'
import phoneOnline from '../courses/networks/lessons/01-phone-online/lesson'
import loadBalancer from '../courses/system-design/lessons/03-load-balancer/lesson'
import * as Player from './player'
import { playerScene } from './testing'
import { loadedEntry } from './view'

// Телефон: виден текст шага или доска. Шаг открывается текстом, кнопка в
// конце текста ведёт на доску, «← Текст» в нижней панели доски возвращает.
// Раскладку меняет CSS узкого экрана; здесь проверяется то, что от неё не
// зависит: состояние, подписи, связи для чтения с экрана и полоса задания
// на доске для обоих видов доски.

const flowScene = playerScene(
  loadBalancer,
  Option.getOrThrow(loadedEntry('system-design', 'load-balancer')),
)
const packetScene = playerScene(
  phoneOnline,
  Option.getOrThrow(loadedEntry('networks', 'phone-online')),
)

const onPhone = (model: Player.Model): Player.Model => ({
  ...model,
  isStacked: true,
})

const pointerReady = Mount.resolve(
  BoardPointer,
  Board.Message.CancelledPointer(),
)

const measured = Command.resolve(
  Player.MeasureTextScroll,
  Player.Message.CompletedMeasureTextScroll({ scrollY: 0 }),
)

const restored = Command.resolve(
  Player.RestoreTextScroll,
  Player.Message.CompletedRestoreTextScroll(),
)

const toText = role('button', { name: 'Back to the step text' })
const stepBar = selector('.step-bar')

describe('phone: the step text, then the board', () => {
  test('a theory step: text first, the board on the button, back and Next', () => {
    scene(
      flowScene,
      given(onPhone(Player.init('system-design', loadBalancer, 0))),
      pointerReady,
      expect(selector('.lesson-page.shows-text')).toExist(),
      expect(selector('#lesson-text')).toExist(),
      expect(toText).not.toExist(),
      expect(role('button', { name: 'See it on the board →' })).toHaveAttr(
        'aria-controls',
        'lesson-board',
      ),
      expect(role('button', { name: 'See it on the board →' })).toHaveAttr(
        'aria-expanded',
        'false',
      ),
      click(role('button', { name: 'See it on the board →' })),
      measured,
      expect(selector('.lesson-page.shows-board')).toExist(),
      expect(selector('#lesson-board')).toExist(),
      expect(toText).toHaveAttr('aria-controls', 'lesson-text'),
      expect(toText).toHaveAttr('aria-expanded', 'false'),
      expect(toText).toHaveText('← Text'),
      click(toText),
      restored,
      expect(selector('.lesson-page.shows-text')).toExist(),
      click(role('button', { name: 'See it on the board →' })),
      measured,
      click(role('button', { name: 'Next →' })),
      restored,
      expect(selector('.lesson-page.shows-text')).toExist(),
      expect(selector('.step.current[data-step="1"]')).toExist(),
    )
  })

  test('System Design task: «To the task», then prompt, Check and Hint on the board', () => {
    scene(
      flowScene,
      given(onPhone(Player.init('system-design', loadBalancer, 3))),
      pointerReady,
      expect(stepBar).not.toExist(),
      expect(
        within(
          selector('.task-card'),
          text(/Make every user request get spread across the three servers/),
        ),
      ).toExist(),
      click(role('button', { name: 'To the task →' })),
      measured,
      expect(
        within(
          stepBar,
          text(/Make every user request get spread across the three servers/),
        ),
      ).toExist(),
      click(within(stepBar, role('button', { name: 'Check' }))),
      expect(within(stepBar, role('alert'))).toExist(),
      click(within(stepBar, role('button', { name: /^Hint/ }))),
      expect(selector('.step-bar .step-bar-hint')).toExist(),
      expect(toText).toExist(),
    )
  })

  test('networks quiz: «To the question», answered on the board, Next opens text', () => {
    scene(
      packetScene,
      given(onPhone(Player.init('networks', phoneOnline, 3))),
      expect(stepBar).not.toExist(),
      click(role('button', { name: 'To the question →' })),
      measured,
      expect(within(stepBar, text(/Click the answer on the board/))).toExist(),
      click(role('button', { name: 'Router, your home post office' })),
      expect(within(stepBar, text(/Correct/))).toExist(),
      click(role('button', { name: 'Next →' })),
      restored,
      expect(selector('.lesson-page.shows-text')).toExist(),
      expect(stepBar).not.toExist(),
      expect(selector('.step.current[data-step="4"] .to-board')).toExist(),
    )
  })
})
