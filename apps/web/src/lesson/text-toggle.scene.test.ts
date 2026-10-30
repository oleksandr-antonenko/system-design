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

// Телефон: кнопка «Доска / Текст» в нижней панели сворачивает текст урока,
// а задание шага остаётся над панелью. Раскладку меняет CSS узкого экрана;
// здесь проверяется то, что от неё не зависит: состояние, подписи, связи
// для чтения с экрана и полоса задания для обоих видов доски.

const flowScene = playerScene(
  loadBalancer,
  Option.getOrThrow(loadedEntry('system-design', 'load-balancer')),
)
const packetScene = playerScene(
  phoneOnline,
  Option.getOrThrow(loadedEntry('networks', 'phone-online')),
)

const pointerReady = Mount.resolve(
  BoardPointer,
  Board.Message.CancelledPointer(),
)

const measured = Command.resolve(
  Player.MeasureTextScroll,
  Player.Message.CompletedMeasureTextScroll({ scrollY: 0 }),
)

const boardButton = role('button', { name: 'Board: hide the lesson text' })
const textButton = role('button', { name: 'Text: show the lesson text' })
const nav = selector('.theory-nav')

describe('phone: the Board / Text toggle', () => {
  test('hides the text, says so to screen readers and stays hidden on Next', () => {
    scene(
      flowScene,
      given(Player.init('system-design', loadBalancer, 0)),
      pointerReady,
      expect(within(nav, boardButton)).toHaveAttr('aria-expanded', 'true'),
      expect(boardButton).toHaveAttr('aria-controls', 'lesson-text'),
      expect(selector('#lesson-text')).toExist(),
      expect(selector('#lesson-text img')).not.toExist(),
      expect(selector('.lesson-page.text-hidden')).not.toExist(),
      click(boardButton),
      measured,
      expect(selector('.lesson-page.text-hidden')).toExist(),
      expect(textButton).toHaveAttr('aria-expanded', 'false'),
      expect(textButton).toHaveAttr('aria-controls', 'lesson-text'),
      click(role('button', { name: 'Next →' })),
      expect(selector('.lesson-page.text-hidden')).toExist(),
      expect(textButton).toExist(),
      click(textButton),
      Command.resolve(
        Player.ScrollStepIntoView,
        Player.Message.CompletedScrollStepIntoView(),
      ),
      expect(selector('.lesson-page.text-hidden')).not.toExist(),
      expect(boardButton).toHaveAttr('aria-expanded', 'true'),
    )
  })

  test('System Design task: prompt, Check and Hint stay reachable above the bar', () => {
    scene(
      flowScene,
      given(Player.init('system-design', loadBalancer, 3)),
      pointerReady,
      expect(selector('.step-bar')).not.toExist(),
      click(boardButton),
      measured,
      expect(
        within(
          selector('.step-bar'),
          text(/Make every user request get spread across the three servers/),
        ),
      ).toExist(),
      click(within(selector('.step-bar'), role('button', { name: 'Check' }))),
      expect(within(selector('.step-bar'), role('alert'))).toExist(),
      click(within(selector('.step-bar'), role('button', { name: /^Hint/ }))),
      expect(selector('.step-bar .step-bar-hint')).toExist(),
    )
  })

  test('networks: the board question stays above the bar while the text is hidden', () => {
    scene(
      packetScene,
      given(Player.init('networks', phoneOnline, 3)),
      click(boardButton),
      measured,
      expect(selector('.step-bar')).toExist(),
      expect(
        within(selector('.step-bar'), text(/Click the answer on the board/)),
      ).toExist(),
      click(role('button', { name: 'Router, your home post office' })),
      expect(within(selector('.step-bar'), text(/Correct/))).toExist(),
      expect(role('button', { name: 'Next →' })).not.toBeDisabled(),
    )
  })
})
