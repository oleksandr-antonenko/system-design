import { Array, Option } from 'effect'
import {
  Mount,
  all,
  click,
  expect,
  expectAll,
  first,
  given,
  role,
  scene,
  selector,
  text,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Board from '../board/board'
import { BoardPointer } from '../board/pointer'
import loadBalancer from '../courses/system-design/lessons/03-load-balancer/lesson'
import { Goal } from '../domain/goals'
import { addNode, connect, flow, reset, setLoad } from '../kinds/flow/dsl'
import type { FlowTypes } from '../kinds/types'
import { type LessonDefinition, defineLesson } from './dsl'
import * as Player from './player'
import { fixtureEntry, playerScene } from './testing'
import { loadedEntry } from './view'

// Третья подсказка рисует пунктиром блоки эталона, которых на доске нет.
// Во второй фазе урока доска начинается с общего эталона (`reset()`), и его
// блоки, открытые для правки, не должны выдавать себя за недостающие блоки
// того же вида. В обычном уроке призрак остаётся прежним.

const COURSE = 'system-design'

const sharedDesign = [
  addNode('users', 'client', 100, 280),
  addNode('lb-1', 'lb', 300, 280, { locked: false }),
  addNode('app1', 'server', 520, 130, { locked: false }),
  addNode('app2', 'server', 520, 280, { locked: false }),
  connect('users', 'lb-1'),
  connect('lb-1', 'app1'),
  connect('lb-1', 'app2'),
]

const phasedLesson: LessonDefinition<FlowTypes> = defineLesson(flow, {
  slug: 'phased-lesson',
  steps: [
    {
      id: 'phase-1',
      ops: [
        addNode('users', 'client', 100, 280),
        addNode('app1', 'server', 450, 280, { locked: false }),
        connect('users', 'app1'),
        setLoad(300),
      ],
      stage: [],
    },
    {
      id: 'phase-2',
      ops: [reset(), ...sharedDesign, setLoad(1400)],
      stage: [],
      task: {
        id: 'more-servers',
        palette: ['server'],
        goals: [
          { id: 'holds', goal: Goal.MaxErrorRate({ max: 0.01, load: 1400 }) },
        ],
        solution: [
          addNode('app3', 'server', 520, 430, { locked: false }),
          addNode('app4', 'server', 700, 430, { locked: false }),
          connect('lb-1', 'app3'),
          connect('lb-1', 'app4'),
        ],
      },
    },
  ],
})

const phasedEntry = fixtureEntry(COURSE, 'phased-lesson', {
  title: 'Phased lesson. A shared design',
  summary: 'The second phase starts from the shared design.',
  steps: {
    'phase-1': { title: 'Your design', body: 'One server.' },
    'phase-2': {
      title: 'Task: the shared design grows',
      body: 'From here on the board shows the shared design.',
    },
  },
  tasks: {
    'more-servers': {
      prompt: 'Hold 1,400 rps.',
      goals: { holds: 'Answers 1,400 rps with less than 1% errors' },
      hints: ['More servers.', 'Two more servers.', 'Follow the outline.'],
      solvedNote: 'Four servers hold the load.',
    },
  },
})

const loadBalancerEntry = Option.getOrThrow(
  loadedEntry(COURSE, 'load-balancer'),
)

const showThreeHints = Array.makeBy(3, () =>
  click(role('button', { name: /^Hint/ })),
)

const pointerReady = Mount.resolve(
  BoardPointer,
  Board.Message.CancelledPointer(),
)

describe('ghost of the third hint', () => {
  test('after reset() the shared design’s servers do not hide the two servers it lacks', () => {
    scene(
      playerScene(phasedLesson, phasedEntry),
      given(Player.init(COURSE, phasedLesson, 1)),
      pointerReady,
      expectAll(all.selector('g.ghost')).toHaveCount(0),
      ...showThreeHints,
      expectAll(all.selector('g.ghost')).toHaveCount(2),
      expectAll(all.selector('g.ghost text')).toHaveCount(2),
      expect(first(all.text('Server here'))).toExist(),
      expectAll(all.selector('.ghost-edge')).toHaveCount(2),
      click(selector('[data-palette="server"]')),
      expectAll(all.selector('g.ghost')).toHaveCount(1),
      expectAll(all.selector('.ghost-edge')).toHaveCount(2),
    )
  })

  test('an ordinary lesson outlines the same load balancer and links as before', () => {
    scene(
      playerScene(loadBalancer, loadBalancerEntry),
      given(Player.init(COURSE, loadBalancer, 3)),
      pointerReady,
      ...showThreeHints,
      expectAll(all.selector('g.ghost')).toHaveCount(1),
      expect(text('Load balancer here')).toExist(),
      expectAll(all.selector('.ghost-edge')).toHaveCount(4),
      click(selector('[data-palette="lb"]')),
      expectAll(all.selector('g.ghost')).toHaveCount(0),
      expectAll(all.selector('.ghost-edge')).toHaveCount(4),
    )
  })
})
