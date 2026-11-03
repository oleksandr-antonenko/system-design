import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { type FlowPart, edgeLabel, flowParts } from '../board/view'
import { loadedDefinitions } from '../courses/registry'
import { type Locale, locales } from '../i18n/locale'
import { uiFor } from '../i18n/ui'
import { addNode, connect, setLoad } from '../kinds/flow/dsl'
import type { FlowTypes } from '../kinds/types'
import { type LessonDefinition, boardAt, taskOf } from '../lesson/dsl'
import {
  type BoardDoc,
  type BoardOp,
  applyOp,
  edgeKey,
  emptyBoard,
  foldOps,
} from './board'
import { NODE_HEIGHT, NODE_WIDTH, edgeCurve } from './geometry'
import { simulate } from './simulate'

// Подписи связей (add-flow-labels-and-cache-modes): симулятор раскладывает
// поток каждой связи по видам, подпись называет главный вид.

const build = (ops: ReadonlyArray<BoardOp>): BoardDoc =>
  Array.reduce(ops, emptyBoard, (doc, op) =>
    Result.getOrThrowWith(
      applyOp(doc, op),
      refusal => new Error(`${op._tag}: ${refusal._tag}`),
    ),
  )

const kindsOn = (doc: BoardDoc, from: string, to: string) =>
  simulate(doc, doc.load).edgeKinds[edgeKey({ from, to })] ?? {}

const withCache = build([
  addNode('users', 'client', 100, 280),
  addNode('app1', 'server', 400, 280),
  addNode('cache-1', 'cache', 600, 180),
  addNode('db', 'db', 790, 280),
  connect('users', 'app1'),
  connect('app1', 'cache-1'),
  connect('app1', 'db'),
  connect('cache-1', 'db'),
  setLoad(400),
])

const withQueueAndBus = build([
  addNode('users', 'client', 100, 280),
  addNode('app1', 'server', 400, 280),
  addNode('queue-1', 'queue', 600, 130),
  addNode('events-1', 'events', 600, 430),
  addNode('worker-1', 'worker', 790, 130),
  addNode('search-1', 'search', 790, 430),
  addNode('db', 'db', 790, 280),
  connect('users', 'app1'),
  connect('app1', 'db'),
  connect('app1', 'queue-1'),
  connect('app1', 'events-1'),
  connect('queue-1', 'worker-1'),
  connect('events-1', 'search-1'),
  connect('worker-1', 'db'),
  setLoad(100),
])

describe('the flow of each edge by kind', () => {
  test('a server with a read-through cache: reads to the cache, writes to the database, misses from the cache', () => {
    expect(kindsOn(withCache, 'users', 'app1')).toEqual({ requests: 400 })
    expect(kindsOn(withCache, 'app1', 'cache-1')).toEqual({ reads: 320 })
    expect(kindsOn(withCache, 'app1', 'db')).toEqual({ writes: 80 })
    expect(kindsOn(withCache, 'cache-1', 'db').misses).toBeCloseTo(64)
  })

  test('without a cache the server reads and writes on the same edge', () => {
    const doc = build([
      addNode('users', 'client', 100, 280),
      addNode('app1', 'server', 400, 280),
      addNode('db', 'db', 790, 280),
      connect('users', 'app1'),
      connect('app1', 'db'),
      setLoad(300),
    ])
    expect(kindsOn(doc, 'app1', 'db')).toEqual({ reads: 240, writes: 60 })
  })

  test('jobs go through a queue, events through a bus', () => {
    expect(kindsOn(withQueueAndBus, 'app1', 'queue-1')).toEqual({ jobs: 100 })
    expect(kindsOn(withQueueAndBus, 'queue-1', 'worker-1')).toEqual({
      jobs: 100,
    })
    expect(kindsOn(withQueueAndBus, 'app1', 'events-1')).toEqual({
      events: 100,
    })
    expect(kindsOn(withQueueAndBus, 'events-1', 'search-1')).toEqual({
      events: 100,
    })
    expect(kindsOn(withQueueAndBus, 'worker-1', 'db')).toEqual({ writes: 100 })
  })

  test('on every step of every System Design lesson the kinds add up to the edge flow', () => {
    const lessons: ReadonlyArray<LessonDefinition<FlowTypes>> = Array.getSomes(
      Array.map(loadedDefinitions(), ({ course, definition }) =>
        course === 'system-design' && definition.board === 'flow'
          ? Option.some(definition)
          : Option.none(),
      ),
    )
    Array.forEach(lessons, lesson => {
      const logs = Object.fromEntries(
        Array.getSomes(
          Array.map(lesson.steps, lessonStep =>
            Option.map(taskOf(lessonStep), task => [task.id, task.solution]),
          ),
        ),
      )
      Array.forEach(lesson.steps, (_lessonStep, index) => {
        const doc = boardAt(lesson, index, logs)
        const sim = simulate(doc, doc.load)
        Array.forEach(Object.entries(sim.edges), ([key, total]) => {
          const sum = Object.values(sim.edgeKinds[key] ?? {}).reduce(
            (acc, value) => acc + value,
            0,
          )
          expect(sum).toBeCloseTo(total, 6)
        })
      })
    })
  })
})

/** Прямая связь между блоками на расстоянии `gap` по горизонтали. */
const between = (gap: number) => {
  const from = { x: 100, y: 280 }
  const to = { x: 100 + NODE_WIDTH + gap, y: 280 }
  return { curve: edgeCurve(from, to), blocks: [from, to] }
}

const labelOn = (
  parts: ReadonlyArray<FlowPart>,
  flow: number,
  gap: number,
  locale: Locale = 'en',
): Option.Option<string> => {
  const { curve, blocks } = between(gap)
  return Option.map(
    edgeLabel(parts, flow, curve, blocks, locale, uiFor(locale)),
    label => label.text,
  )
}

describe('edge labels', () => {
  test('one kind: its name and rps', () => {
    expect(labelOn([{ kind: 'reads', rps: 256 }], 256, 300)).toEqual(
      Option.some('reads 256 rps'),
    )
  })

  test('two kinds on a long edge: both parts, the larger first', () => {
    expect(
      labelOn(flowParts({ writes: 48, reads: 192 }, 240), 240, 300),
    ).toEqual(Option.some('reads 192 · writes 48 rps'))
  })

  test('two kinds on a shorter edge: both parts without the unit, then the main one and +1', () => {
    const parts = flowParts({ writes: 48, reads: 192 }, 240)
    expect(labelOn(parts, 240, 180)).toEqual(
      Option.some('reads 192 · writes 48'),
    )
    expect(labelOn(parts, 240, 150)).toEqual(Option.some('reads 192 rps +1'))
  })

  test('a label never lies on a block: an edge with no room has none', () => {
    expect(labelOn([{ kind: 'reads', rps: 256 }], 256, 40)).toEqual(
      Option.none(),
    )
  })

  test('a label moves along the edge to stay clear of a third block', () => {
    const { curve, blocks } = between(300)
    const middle = {
      x: 410,
      y: 280 + NODE_HEIGHT / 2 + 8,
    }
    const label = edgeLabel(
      [{ kind: 'reads', rps: 256 }],
      256,
      curve,
      [...blocks, middle],
      'en',
      uiFor('en'),
    )
    expect(Option.map(label, ({ at }) => at.x !== middle.x)).toEqual(
      Option.some(true),
    )
  })

  test.each(locales)('%s names every kind of flow', locale => {
    const names = Object.values(uiFor(locale).board.flowName)
    expect(names.every(name => name.trim().length > 0)).toBe(true)
  })

  test('misses keep the English tool term in every language', () => {
    expect(uiFor('ru').board.flowName.misses).toBe('miss')
    expect(uiFor('uk').board.flowName.misses).toBe('miss')
    expect(uiFor('lt').board.flowName.misses).toBe('miss')
    expect(uiFor('en').board.flowName.misses).toBe('misses')
  })

  test('the database of lesson 2 shows reads and writes', () => {
    const doc = foldOps(emptyBoard, [
      addNode('users', 'client', 100, 280),
      addNode('app1', 'server', 400, 280),
      addNode('db', 'db', 790, 280),
      connect('users', 'app1'),
      connect('app1', 'db'),
      setLoad(300),
    ])
    const key = edgeKey({ from: 'app1', to: 'db' })
    const sim = simulate(doc, doc.load)
    const flow = sim.edges[key] ?? 0
    expect(
      labelOn(flowParts(sim.edgeKinds[key], flow), flow, 242, 'ru'),
    ).toEqual(Option.some('чтение 240 · запись 60 rps'))
  })
})
