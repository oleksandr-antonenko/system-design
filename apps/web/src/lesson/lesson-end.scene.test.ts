import { Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'
import {
  Mount,
  expect,
  given,
  role,
  scene,
  selector,
  within,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Board from '../board/board'
import { BoardPointer } from '../board/pointer'
import loadBalancer from '../courses/system-design/lessons/03-load-balancer/lesson'
import * as Player from './player'
import { lessonView, loadedEntry } from './view'

// Слот конца урока: страница может добавить свой блок после последнего шага
// (`PlayerViewInputs.lessonEnd`). По умолчанию его нет, и плеер ничего не
// добавляет.

const COURSE = 'system-design'
const LAST = loadBalancer.steps.length - 1

const entry = Option.getOrThrow(loadedEntry(COURSE, loadBalancer.slug))

const sceneWith = (lessonEnd: (h: HtmlBuilder<Player.Message>) => Html) => ({
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(loadBalancer)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      loadBalancer,
      entry,
      playerModel,
      {
        locale: 'en',
        prefersDark: false,
        lessonEnd: () => lessonEnd(h),
      },
      h,
    ),
})

const endBlock = (h: HtmlBuilder<Player.Message>) =>
  h.aside([h.AriaLabel('After the lesson')], ['What comes next'])

const pointerReady = Mount.resolve(
  BoardPointer,
  Board.Message.CancelledPointer(),
)

const atStep = (step: number): Player.Model => ({
  ...Player.init(COURSE, loadBalancer, 0),
  step,
})

describe('end-of-lesson slot', () => {
  test('the page’s block follows the last step', () => {
    scene(
      sceneWith(endBlock),
      given(atStep(LAST)),
      pointerReady,
      expect(
        within(
          selector(`[data-step="${LAST}"]`),
          role('complementary', { name: 'After the lesson' }),
        ),
      ).toHaveText('What comes next'),
    )
  })

  test('the block waits until the student reaches the last step', () => {
    scene(
      sceneWith(endBlock),
      given(atStep(LAST - 1)),
      pointerReady,
      expect(role('complementary', { name: 'After the lesson' })).not.toExist(),
    )
  })
})
