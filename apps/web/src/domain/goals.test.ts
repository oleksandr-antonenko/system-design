import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { type DomainMessage, renderDomainMessage } from '../i18n/domainMessage'
import { locales } from '../i18n/locale'
import { uiFor } from '../i18n/ui'
import { addNode, connect, disconnect } from '../lesson/dsl'
import { type BoardDoc, type BoardOp, applyOp, emptyBoard } from './board'
import { Goal, type GoalCheck, checkGoal, isHiddenGoal } from './goals'
import { simulate } from './simulate'

const build = (ops: ReadonlyArray<BoardOp>): BoardDoc =>
  Array.reduce(ops, emptyBoard, (doc, op) =>
    Result.getOrThrowWith(
      applyOp(doc, op),
      refusal => new Error(`${op._tag}: ${refusal._tag}`),
    ),
  )

const failureOf = (check: GoalCheck): DomainMessage =>
  Option.getOrThrowWith(check.maybeFailure, () => new Error('goal is met'))

const appServers: ReadonlyArray<string> = ['app1', 'app2', 'app3']

const taskStartOps: ReadonlyArray<BoardOp> = [
  addNode('users', 'client', 100, 280),
  addNode('db', 'db', 790, 280),
  ...Array.flatMap(appServers, id => [
    addNode(id, 'server', 520, 280),
    connect(id, 'db'),
  ]),
  connect('users', 'app1'),
]

const taskStart = build(taskStartOps)

const solved = build([
  ...taskStartOps,
  addNode('lb-1', 'lb', 300, 280, { locked: false }),
  ...Array.map(appServers, id => connect('lb-1', id)),
  connect('users', 'lb-1'),
  disconnect('users', 'app1'),
])

const queueBoard = (workers: number): BoardDoc =>
  build([
    addNode('users', 'client', 100, 280),
    addNode('app1', 'server', 400, 280),
    addNode('db', 'db', 790, 280),
    addNode('queue', 'queue', 600, 400),
    connect('users', 'app1'),
    connect('app1', 'db'),
    connect('app1', 'queue'),
    ...Array.flatMap(
      Array.makeBy(workers, index => `worker-${index + 1}`),
      id => [
        addNode(id, 'worker', 790, 400),
        connect('queue', id),
        connect(id, 'db'),
      ],
    ),
  ])

const behindOneBalancer = (extra: ReadonlyArray<BoardOp>): BoardDoc =>
  build([
    addNode('users', 'client', 100, 280),
    addNode('lb-1', 'lb', 300, 280),
    addNode('db', 'db', 790, 280),
    connect('users', 'lb-1'),
    ...Array.flatMap(['app1', 'app2'], id => [
      addNode(id, 'server', 520, 280),
      connect('lb-1', id),
      connect(id, 'db'),
    ]),
    ...extra,
  ])

describe('response time', () => {
  test('a slow p95 is named with the threshold and the busiest block is highlighted', () => {
    const check = checkGoal(taskStart, Goal.MaxP95({ max: 300, load: 900 }))
    const failure = failureOf(check)
    const p95 = Option.getOrThrow(simulate(taskStart, 900).p95)

    expect(check.met).toBe(false)
    expect(failure).toEqual({
      _tag: 'GoalSlowResponse',
      load: 900,
      p95,
      max: 300,
      hottest: ['app1'],
    })
    expect(check.focusNodes).toEqual(['app1'])
    expect(renderDomainMessage(uiFor('en').domain, failure)).toContain('300 ms')
  })

  test('the reference board answers fast enough', () => {
    expect(checkGoal(solved, Goal.MaxP95({ max: 300, load: 900 })).met).toBe(
      true,
    )
  })

  test('when nothing is answered, the goal reports the lost requests', () => {
    const silent = build([addNode('users', 'client', 100, 280)])
    const check = checkGoal(silent, Goal.MaxP95({ max: 300, load: 100 }))

    expect(Option.map(check.maybeFailure, failure => failure._tag)).toEqual(
      Option.some('GoalTooManyErrors'),
    )
  })
})

describe('utilization', () => {
  test('every block of the kind must stay under the share', () => {
    const goal = (load: number) =>
      Goal.MaxUtilization({ kind: 'server', max: 0.8, load })
    const over = checkGoal(solved, goal(1050))

    expect(checkGoal(solved, goal(900)).met).toBe(true)
    expect(over.met).toBe(false)
    expect(over.focusNodes).toEqual(['app1', 'app2', 'app3'])
    expect(failureOf(over)).toMatchObject({
      _tag: 'GoalOverUtilized',
      kind: 'server',
      utilization: 350 / 400,
      max: 0.8,
    })
  })

  test('a board without blocks of the kind has nothing over the limit', () => {
    expect(
      checkGoal(
        solved,
        Goal.MaxUtilization({ kind: 'cache', max: 0.5, load: 900 }),
      ).met,
    ).toBe(true)
  })
})

describe('queue growth', () => {
  test('one worker falls behind 300 tasks; two keep up', () => {
    const goal = Goal.MaxBacklog({ max: 0, load: 300 })
    const behind = checkGoal(queueBoard(1), goal)

    expect(behind.met).toBe(false)
    expect(behind.focusNodes).toEqual(['queue'])
    expect(failureOf(behind)).toMatchObject({
      _tag: 'GoalBacklogGrowing',
      backlog: 100,
      max: 0,
      nodes: ['queue'],
    })
    expect(checkGoal(queueBoard(2), goal).met).toBe(true)
  })
})

describe('cost', () => {
  test('the budget is checked live and highlights the blocks the student added', () => {
    const tight = checkGoal(solved, Goal.MaxCost({ max: 2.25 }))

    expect(isHiddenGoal(Goal.MaxCost({ max: 2.25 }))).toBe(false)
    expect(checkGoal(solved, Goal.MaxCost({ max: 2.3 })).met).toBe(true)
    expect(tight.met).toBe(false)
    expect(tight.focusNodes).toEqual(['lb-1'])
    expect(failureOf(tight)).toMatchObject({
      _tag: 'GoalTooExpensive',
      max: 2.25,
    })
  })
})

describe('surviving failures', () => {
  const survivesDatabase = Goal.SurvivesFailure({
    kinds: ['db'],
    maxErrorRate: 0.01,
    load: 500,
  })

  test('the only database fails the goal: it is named and highlighted', () => {
    const check = checkGoal(behindOneBalancer([]), survivesDatabase)

    expect(check.met).toBe(false)
    expect(check.focusNodes).toEqual(['db'])
    expect(failureOf(check)).toMatchObject({
      _tag: 'GoalFailureNotSurvived',
      id: 'db',
      kind: 'db',
      errorRate: 1,
    })
  })

  test('a replica linked to every server survives a database failure', () => {
    const board = behindOneBalancer([
      addNode('replica-1', 'replica', 790, 430),
      connect('app1', 'replica-1'),
      connect('app2', 'replica-1'),
    ])

    expect(checkGoal(board, survivesDatabase).met).toBe(true)
  })

  test('blocks fail one by one; the first one not survived is reported', () => {
    const goal = Goal.SurvivesFailure({
      kinds: ['lb', 'server'],
      maxErrorRate: 0.01,
      load: 300,
    })
    const twoBalancers = behindOneBalancer([
      addNode('lb-2', 'lb', 300, 430),
      connect('users', 'lb-2'),
      connect('lb-2', 'app1'),
      connect('lb-2', 'app2'),
    ])

    expect(checkGoal(behindOneBalancer([]), goal).focusNodes).toEqual(['lb-1'])
    expect(checkGoal(twoBalancers, goal).met).toBe(true)
  })

  const regions = (extra: ReadonlyArray<BoardOp>): BoardDoc =>
    build([
      addNode('users-eu', 'client', 100, 170, { region: 'eu' }),
      addNode('lb-eu', 'lb', 300, 170, { region: 'eu' }),
      addNode('app-eu', 'server', 520, 170, { region: 'eu' }),
      addNode('db-eu', 'db', 760, 170, { region: 'eu' }),
      addNode('lb-us', 'lb', 300, 420, { region: 'us' }),
      addNode('app-us', 'server', 520, 420, { region: 'us' }),
      addNode('db-us', 'db', 760, 420, { region: 'us' }),
      connect('users-eu', 'lb-eu'),
      connect('lb-eu', 'app-eu'),
      connect('app-eu', 'db-eu'),
      connect('lb-us', 'app-us'),
      connect('app-us', 'db-us'),
      ...extra,
    ])

  test('a region failure is survived only if its users can reach another region', () => {
    const goal = Goal.SurvivesRegionFailure({
      region: 'eu',
      maxErrorRate: 0.01,
      load: 300,
    })
    const stranded = checkGoal(regions([]), goal)

    expect(stranded.met).toBe(false)
    expect(stranded.focusNodes).toEqual(['lb-eu'])
    expect(failureOf(stranded)).toMatchObject({
      _tag: 'GoalRegionFailureNotSurvived',
      region: 'eu',
      errorRate: 1,
    })
    expect(checkGoal(regions([connect('users-eu', 'lb-us')]), goal).met).toBe(
      true,
    )
  })
})

describe('hidden goals', () => {
  test('every simulation goal is hidden until the check', () => {
    expect(
      [
        Goal.MaxErrorRate({ max: 0.01, load: 900 }),
        Goal.MaxP95({ max: 300, load: 900 }),
        Goal.MaxUtilization({ kind: 'db', max: 0.8, load: 900 }),
        Goal.MaxBacklog({ max: 0, load: 900 }),
        Goal.SurvivesFailure({ kinds: ['db'], maxErrorRate: 0, load: 900 }),
        Goal.SurvivesRegionFailure({
          region: 'eu',
          maxErrorRate: 0,
          load: 900,
        }),
      ].every(isHiddenGoal),
    ).toBe(true)
    expect(
      [
        Goal.HasKind({ kind: 'lb' }),
        Goal.FansOut({ from: 'lb', to: 'server', min: 3 }),
        Goal.OnlyThrough({ from: 'client', to: 'server', via: 'lb' }),
        Goal.MaxCost({ max: 3 }),
      ].some(isHiddenGoal),
    ).toBe(false)
  })

  test('failures of the new goals render in every language', () => {
    const failures = [
      checkGoal(taskStart, Goal.MaxP95({ max: 300, load: 900 })),
      checkGoal(
        solved,
        Goal.MaxUtilization({ kind: 'server', max: 0.8, load: 1050 }),
      ),
      checkGoal(queueBoard(1), Goal.MaxBacklog({ max: 0, load: 300 })),
      checkGoal(solved, Goal.MaxCost({ max: 1 })),
    ].map(failureOf)
    locales.forEach(locale => {
      failures.forEach(failure => {
        expect(renderDomainMessage(uiFor(locale).domain, failure)).toMatch(
          /\d/u,
        )
      })
    })
  })
})
