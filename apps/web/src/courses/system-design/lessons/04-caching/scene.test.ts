import { Array, Option, Result } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
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
import { describe, expect as expectValue, test } from 'vitest'

import * as Board from '../../../../board/board'
import { BoardPointer } from '../../../../board/pointer'
import {
  type BoardDoc,
  type BoardOp,
  applyOp,
  edgeKey,
} from '../../../../domain/board'
import { simulate } from '../../../../domain/simulate'
import { connect } from '../../../../kinds/flow/dsl'
import { KindOp } from '../../../../kinds/state'
import type { FlowTypes } from '../../../../kinds/types'
import {
  type LessonDefinition,
  type TaskLogs,
  boardAt,
  taskOf,
  taskStartBoard,
} from '../../../../lesson/dsl'
import * as Player from '../../../../lesson/player'
import { lessonView, loadedEntry } from '../../../../lesson/view'
import definition from './lesson'

// Урок 4 сравнивает cache-aside и read-through на одной доске: первая задача
// ставит кеш сбоку (сервер сам читает базу при промахе), вторая переключает
// доску в read-through, и кешу нужна своя связь с базой.

const COURSE = 'system-design'
const lesson: LessonDefinition<FlowTypes> = definition

const stepIndex = (id: string): number =>
  lesson.steps.findIndex(lessonStep => lessonStep.id === id)

const solutions: TaskLogs<BoardOp> = Object.fromEntries(
  Array.getSomes(
    Array.map(lesson.steps, lessonStep =>
      Option.map(taskOf(lessonStep), task => [task.id, task.solution]),
    ),
  ),
)

const boardOf = (id: string): BoardDoc =>
  boardAt(lesson, stepIndex(id), solutions)

const kindsOn = (doc: BoardDoc, from: string, to: string) =>
  simulate(doc, doc.load).edgeKinds[edgeKey({ from, to })] ?? {}

describe('caching: the simulation of both patterns', () => {
  test('cache-aside: the servers send the database writes and misses, the cache gets reads and fills', () => {
    const doc = boardOf('aside-result')
    expectValue(doc.cacheMode).toBe('cache-aside')
    expectValue(simulate(doc, 1600).databaseLoad).toBeCloseTo(576)
    expectValue(kindsOn(doc, 'app3', 'db').writes).toBeCloseTo(64)
    expectValue(kindsOn(doc, 'app3', 'db').misses).toBeCloseTo(51.2)
    expectValue(kindsOn(doc, 'app3', 'cache-1').reads).toBeCloseTo(256)
    expectValue(kindsOn(doc, 'app3', 'cache-1').fills).toBeCloseTo(51.2)
    expectValue(
      doc.edges.some(edge => edge.from === 'cache-1' && edge.to === 'db'),
    ).toBe(false)
  })

  test('cache-aside refuses a cache → database connection', () => {
    expectValue(
      Result.match(applyOp(boardOf('aside-result'), connect('cache-1', 'db')), {
        onSuccess: () => 'accepted',
        onFailure: refusal => refusal._tag,
      }),
    ).toBe('ConnectCacheAside')
  })

  test('read-through without a cache → database connection loses the misses', () => {
    const doc = taskStartBoard(lesson, stepIndex('read-through'), solutions)
    expectValue(doc.cacheMode).toBe('read-through')
    expectValue(simulate(doc, 1600).nodes['cache-1']?.dropped).toBeCloseTo(256)
    expectValue(simulate(doc, 1600).errorRate).toBeCloseTo(0.16)
  })

  test('read-through: the misses move to cache → database, the servers send only writes', () => {
    const doc = boardOf('compare')
    expectValue(simulate(doc, 1600).databaseLoad).toBeCloseTo(576)
    expectValue(kindsOn(doc, 'cache-1', 'db').misses).toBeCloseTo(256)
    expectValue(kindsOn(doc, 'app3', 'db')).toEqual({ writes: 64 })
  })

  test('with the cache down the servers read the database directly', () => {
    const doc = boardOf('cache-down')
    expectValue(simulate(doc, 1600).databaseLoad).toBeCloseTo(1600)
    expectValue(simulate(doc, 1600).errorRate).toBeGreaterThan(0.01)
  })
})

const pointerReady = Mount.resolve(
  BoardPointer,
  Board.Message.CancelledPointer(),
)

const sceneOf = () => {
  const entry = Option.getOrThrow(loadedEntry(COURSE, lesson.slug))
  return {
    update: (playerModel: Player.Model, playerMessage: Player.Message) =>
      Player.updateWith(lesson)(playerModel, playerMessage),
    view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
      lessonView(
        lesson,
        entry,
        playerModel,
        { locale: 'en', prefersDark: false },
        h,
      ),
  }
}

const solvedState = (log: ReadonlyArray<BoardOp>) => ({
  log: log.map(op => KindOp.FlowOp({ op })),
  redo: [],
  attempts: 1,
  hintsShown: 0,
  check: Player.CheckState.Solved({ withHint: false }),
  maybeReplayIndex: Option.none(),
})

const atStep = (id: string): Player.Model => ({
  ...Player.init(COURSE, lesson, 0),
  step: stepIndex(id),
  tasks: {
    'cache-aside': solvedState(solutions['cache-aside'] ?? []),
    'read-through': solvedState(solutions['read-through'] ?? []),
  },
})

const option = (name: RegExp) =>
  within(role('group', { name: 'Answer options' }), role('button', { name }))

describe('caching: the lesson on the board', () => {
  test('the cache-aside task asks for no cache → database connection, and the cache shows its mode', () => {
    scene(
      sceneOf(),
      given(atStep('cache-aside')),
      pointerReady,
      expect(text(/Task: cache-aside/)).toExist(),
      expect(
        text(
          'The cache has no connection to the database: the servers read it on a miss',
        ),
      ).toExist(),
      expect(selector('[data-cache-mode="cache-aside"]')).toExist(),
    )
  })

  test('the read-through task switches the cache tag and names the lost misses', () => {
    scene(
      sceneOf(),
      given({
        ...atStep('read-through'),
        tasks: {
          'cache-aside': solvedState(solutions['cache-aside'] ?? []),
        },
      }),
      pointerReady,
      expect(text(/Task: read-through/)).toExist(),
      expect(selector('[data-cache-mode="read-through"]')).toExist(),
      expect(text('misses lost: 256 rps')).toExist(),
    )
  })

  test('the comparison quiz: read-through is wrong, cache-aside keeps serving reads', () => {
    scene(
      sceneOf(),
      given(atStep('compare')),
      pointerReady,
      expect(
        text(/In which pattern does the application keep serving reads/),
      ).toExist(),
      click(option(/^Read-through/)),
      expect(text(/the path to the database belongs to the cache/)).toExist(),
      expect(option(/^Cache-aside/)).toHaveClass('right'),
    )
  })
})
