import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import loadBalancer from '../courses/system-design/lessons/03-load-balancer/lesson'
import queues from '../courses/system-design/lessons/07-queues/lesson'
import {
  type BoardDoc,
  type BoardOp,
  emptyBoard,
  foldOps,
} from '../domain/board'
import { addNode, connect, disconnect, reset } from '../kinds/flow/dsl'
import type { FlowTypes } from '../kinds/types'
import { type LessonDefinition, boardAt, taskOf } from './dsl'
import { ghostPlan } from './ghost'

const lesson: LessonDefinition<FlowTypes> = loadBalancer
const queuesLesson: LessonDefinition<FlowTypes> = queues

const TASK_STEP = 3

const solution = Option.getOrThrow(
  Option.flatMap(Array.get(lesson.steps, TASK_STEP), step =>
    taskOf<FlowTypes>(step),
  ),
).solution

const taskStart = boardAt(lesson, TASK_STEP, {})

/** Ходы ученика в задаче: доска после них и они же как журнал задачи. */
const played = (
  start: BoardDoc,
  reference: ReadonlyArray<BoardOp>,
  moves: ReadonlyArray<BoardOp>,
) => ghostPlan(foldOps(start, moves), reference, moves)

const users = { x: 100, y: 280 }
const app1 = { x: 520, y: 280 }
const app2 = { x: 520, y: 130 }
const app3 = { x: 520, y: 430 }

describe('ghost plan', () => {
  test('at the task start it outlines the balancer, its links and the bypass', () => {
    const lb = { x: 300, y: 280 }

    expect(ghostPlan(taskStart, solution, [])).toEqual({
      nodes: [{ kind: 'lb', x: 300, y: 280 }],
      edges: [
        { from: lb, to: app1 },
        { from: lb, to: app2 },
        { from: lb, to: app3 },
        { from: users, to: lb },
      ],
      removeEdges: ['users>app1'],
    })
  })

  test.each(['lb-1', 'lb-2'])(
    'a balancer the student placed (%s) replaces the outline',
    id => {
      const own = { x: 320, y: 360 }
      const plan = played(taskStart, solution, [
        addNode(id, 'lb', own.x, own.y, { locked: false }),
      ])

      expect(plan.nodes).toEqual([])
      expect(plan.edges).toEqual([
        { from: own, to: app1 },
        { from: own, to: app2 },
        { from: own, to: app3 },
        { from: users, to: own },
      ])
    },
  )

  test('a removed bypass and existing links are not drawn again', () => {
    const lb = { x: 300, y: 280 }
    const plan = played(taskStart, solution, [
      addNode('lb-1', 'lb', lb.x, lb.y, { locked: false }),
      connect('lb-1', 'app1'),
      connect('users', 'lb-1'),
      disconnect('users', 'app1'),
    ])

    expect(plan).toEqual({
      nodes: [],
      edges: [
        { from: lb, to: app2 },
        { from: lb, to: app3 },
      ],
      removeEdges: [],
    })
  })

  test('several blocks of one kind keep their outlines once the student placed one', () => {
    const queues = Option.getOrThrow(
      Option.flatMap(Array.get(queuesLesson.steps, 3), step =>
        taskOf<FlowTypes>(step),
      ),
    ).solution
    const start = boardAt(queuesLesson, 3, {})
    const plan = played(start, queues, [
      addNode('queue-1', 'queue', 550, 400, { locked: false }),
      addNode('worker-9', 'worker', 700, 200, { locked: false }),
    ])
    const queue = { x: 550, y: 400 }

    expect(plan.nodes).toEqual([
      { kind: 'worker', x: 790, y: 400 },
      { kind: 'worker', x: 790, y: 500 },
    ])
    expect(plan.edges).toEqual(
      expect.arrayContaining([
        { from: queue, to: { x: 700, y: 200 } },
        { from: queue, to: { x: 790, y: 400 } },
        { from: queue, to: { x: 790, y: 500 } },
      ]),
    )
  })
})

describe('ghost plan in a phase that starts from a shared design', () => {
  // Вторая фаза: доска начинается с общего эталона, его блоки открыты для
  // правки. Блоки того же вида, что стояли к началу задачи, не заменяют
  // недостающие блоки эталона.
  const lb = { x: 300, y: 280 }
  const phaseStart = foldOps(emptyBoard, [
    addNode('users', 'client', 100, 280),
    addNode('own', 'server', 450, 280, { locked: false }),
    reset(),
    addNode('users', 'client', 100, 280),
    addNode('lb-1', 'lb', lb.x, lb.y, { locked: false }),
    addNode('app1', 'server', 520, 130, { locked: false }),
    addNode('app2', 'server', 520, 280, { locked: false }),
    connect('users', 'lb-1'),
    connect('lb-1', 'app1'),
    connect('lb-1', 'app2'),
  ])
  const twoMore = [
    addNode('app3', 'server', 520, 430, { locked: false }),
    addNode('app4', 'server', 700, 430, { locked: false }),
    connect('lb-1', 'app3'),
    connect('lb-1', 'app4'),
  ]

  test('at the task start it outlines both servers the design lacks', () => {
    expect(ghostPlan(phaseStart, twoMore, [])).toEqual({
      nodes: [
        { kind: 'server', x: 520, y: 430 },
        { kind: 'server', x: 700, y: 430 },
      ],
      edges: [
        { from: lb, to: { x: 520, y: 430 } },
        { from: lb, to: { x: 700, y: 430 } },
      ],
      removeEdges: [],
    })
  })

  test('a server the student places stands in for the first one; the other keeps its outline', () => {
    const own = { x: 640, y: 500 }
    const plan = played(phaseStart, twoMore, [
      addNode('app9', 'server', own.x, own.y, { locked: false }),
    ])

    expect(plan.nodes).toEqual([{ kind: 'server', x: 700, y: 430 }])
    expect(plan.edges).toEqual([
      { from: lb, to: own },
      { from: lb, to: { x: 700, y: 430 } },
    ])
  })
})
