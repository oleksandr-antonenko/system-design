import { Option } from 'effect'
import { Mount, expect, given, scene, selector, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Board from '../board/board'
import { BoardPointer } from '../board/pointer'
import { findLesson } from '../courses/registry'
import loadBalancer from '../courses/system-design/lessons/03-load-balancer/lesson'
import * as Player from './player'
import { playerScene } from './testing'

// Палитра урока в плеере: курс без `palette` в defineCourse показывает метки
// по-прежнему — «новое» у блока, который впервые ставят в этом уроке, и
// раздел «Позже в курсе» с блоками следующих уроков.

const COURSE = 'system-design'

const pointerReady = Mount.resolve(
  BoardPointer,
  Board.Message.CancelledPointer(),
)

describe('palette of a progressive course', () => {
  test('lesson 3 marks the load balancer new and lists later blocks', () => {
    scene(
      playerScene(
        loadBalancer,
        Option.getOrThrow(findLesson(COURSE, 'load-balancer')),
      ),
      given(Player.init(COURSE, loadBalancer, 3)),
      pointerReady,
      expect(selector('[data-palette="lb"]')).toContainText('new'),
      expect(selector('[data-palette="server"]')).toContainText(
        'up to 400 rps',
      ),
      expect(text('Later in the course')).toExist(),
      expect(text('lesson 4')).toExist(),
    )
  })
})
