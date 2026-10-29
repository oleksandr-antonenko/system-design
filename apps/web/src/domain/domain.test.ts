import { Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { renderDomainMessage } from '../i18n/domainMessage'
import { locales } from '../i18n/locale'
import { uiFor } from '../i18n/ui'
import {
  type BoardDoc,
  BoardOp,
  applyOp,
  emptyBoard,
  foldOps,
  nextNodeId,
} from './board'
import { NODE_HEIGHT, edgeCurve, pointOnCurve } from './geometry'
import { Goal, checkGoal, firstFailedGoal } from './goals'
import { simulate } from './simulate'

const add = (
  id: string,
  kind: 'client' | 'lb' | 'server' | 'db',
  locked = true,
) => BoardOp.AddNode({ id, kind, x: 0, y: 0, locked })
const connect = (from: string, to: string) => BoardOp.Connect({ from, to })

const oneServer = foldOps(emptyBoard, [
  add('users', 'client'),
  add('app1', 'server'),
  add('db', 'db'),
  connect('users', 'app1'),
  connect('app1', 'db'),
  BoardOp.SetLoad({ rps: 900 }),
])

const taskStart = foldOps(oneServer, [
  add('app2', 'server'),
  add('app3', 'server'),
  connect('app2', 'db'),
  connect('app3', 'db'),
])

const solved = foldOps(taskStart, [
  add('lb-1', 'lb', false),
  connect('lb-1', 'app1'),
  connect('lb-1', 'app2'),
  connect('lb-1', 'app3'),
  connect('users', 'lb-1'),
  BoardOp.Disconnect({ from: 'users', to: 'app1' }),
])

const refusalOf = (doc: BoardDoc, op: BoardOp) =>
  Result.match(applyOp(doc, op), {
    onSuccess: () => 'accepted',
    onFailure: message => message._tag,
  })

describe('board operations', () => {
  test('connection rules', () => {
    expect(refusalOf(oneServer, connect('users', 'db'))).toBe(
      'ConnectClientsToDatabase',
    )
    expect(refusalOf(oneServer, connect('app1', 'app1'))).toBe('ConnectSelf')
    expect(refusalOf(oneServer, connect('users', 'app1'))).toBe(
      'ConnectDuplicate',
    )
    expect(refusalOf(taskStart, connect('app1', 'app2'))).toBe(
      'ConnectServerToServer',
    )
    expect(refusalOf(oneServer, connect('db', 'users'))).toBe(
      'ConnectIntoClients',
    )
    expect(refusalOf(oneServer, connect('db', 'app1'))).toBe(
      'ConnectWrongDirection',
    )
    expect(refusalOf(solved, connect('lb-1', 'db'))).toBe(
      'ConnectBalancerToDatabase',
    )
    expect(refusalOf(oneServer, connect('app1', 'nope'))).toBe('UnknownNode')
  })

  test('nodes from the task cannot be removed; removing a node drops its edges', () => {
    expect(refusalOf(solved, BoardOp.RemoveNode({ id: 'app1' }))).toBe(
      'NodeIsPartOfTask',
    )

    const withoutBalancer = foldOps(solved, [
      BoardOp.RemoveNode({ id: 'lb-1' }),
    ])
    expect(withoutBalancer.nodes.map(node => node.id)).not.toContain('lb-1')
    expect(
      withoutBalancer.edges.some(
        edge => edge.from === 'lb-1' || edge.to === 'lb-1',
      ),
    ).toBe(false)
  })

  test('duplicate names are refused and new names are unique', () => {
    expect(refusalOf(oneServer, add('app1', 'server'))).toBe('DuplicateNodeId')
    expect(nextNodeId(taskStart, 'server')).toBe('app4')
    expect(nextNodeId(taskStart, 'lb')).toBe('lb-1')
    expect(nextNodeId(solved, 'lb')).toBe('lb-2')
  })

  test('refused operations are skipped by foldOps', () => {
    expect(foldOps(oneServer, [connect('users', 'db')])).toEqual(oneServer)
  })
})

describe('simulation', () => {
  test('one server under 900 rps', () => {
    const result = simulate(oneServer, 900)

    expect(result.nodes['app1']?.utilization).toBeCloseTo(2.25)
    expect(result.errorRate).toBeCloseTo(500 / 900)
    expect(result.databaseLoad).toBe(400)
  })

  test('three servers behind a load balancer', () => {
    const result = simulate(solved, 900)

    expect(
      ['app1', 'app2', 'app3'].map(id => result.nodes[id]?.incoming),
    ).toEqual([300, 300, 300])
    expect(result.errorRate).toBe(0)
    expect(result.databaseLoad).toBe(900)
    expect(result.edges['lb-1>app2']).toBe(300)
  })

  test('a failed server is skipped by the load balancer', () => {
    const result = simulate(
      foldOps(solved, [BoardOp.FailNode({ id: 'app2' })]),
      900,
    )

    expect(result.nodes['app1']?.incoming).toBe(450)
    expect(result.nodes['app2']?.incoming).toBe(0)
    expect(result.errorRate).toBeCloseTo(100 / 900)
  })

  test('cost grows from 2.20 to 2.30 with a load balancer', () => {
    expect(simulate(taskStart, 900).costPerHour).toBeCloseTo(2.2)
    expect(simulate(solved, 900).costPerHour).toBeCloseTo(2.3)
  })

  test('p95 drops when load is spread', () => {
    const before = Option.getOrThrow(simulate(taskStart, 900).p95)
    const after = Option.getOrThrow(simulate(solved, 900).p95)

    expect(before).toBeGreaterThan(1000)
    expect(after).toBeLessThan(200)
  })

  test('the same board and load always give the same result', () => {
    expect(simulate(solved, 900)).toEqual(simulate(solved, 900))
  })
})

const lessonGoals = [
  Goal.HasKind({ kind: 'lb' }),
  Goal.FansOut({ from: 'lb', to: 'server', min: 3 }),
  Goal.OnlyThrough({ from: 'client', to: 'server', via: 'lb' }),
  Goal.MaxErrorRate({ max: 0.01, load: 900 }),
]

describe('goals', () => {
  test('the task start fails at the first goal', () => {
    expect(
      Option.map(firstFailedGoal(taskStart, lessonGoals), ({ index }) => index),
    ).toEqual(Option.some(0))
  })

  test('a bypass edge is reported and highlighted', () => {
    const withBypass = foldOps(solved, [connect('users', 'app1')])
    const check = checkGoal(
      withBypass,
      Goal.OnlyThrough({ from: 'client', to: 'server', via: 'lb' }),
    )

    expect(check.met).toBe(false)
    expect(check.focusEdges).toEqual(['users>app1'])
    expect(Option.map(check.maybeFailure, failure => failure._tag)).toEqual(
      Option.some('GoalDirectPath'),
    )
  })

  test('cutting servers off the database does not pass the load goal', () => {
    const cut = foldOps(solved, [
      BoardOp.Disconnect({ from: 'app1', to: 'db' }),
      BoardOp.Disconnect({ from: 'app2', to: 'db' }),
    ])
    const result = simulate(cut, 900)
    const check = checkGoal(cut, Goal.MaxErrorRate({ max: 0.01, load: 900 }))

    expect(result.nodes['app1']?.served).toBe(0)
    expect(result.nodes['app3']?.dropped).toBe(0)
    expect(result.errorRate).toBeCloseTo(2 / 3, 2)
    expect(check.met).toBe(false)
    expect(check.focusNodes).toEqual(['app1', 'app2'])
  })

  test('a server serves on its own while the board has no database', () => {
    const noDatabase = foldOps(emptyBoard, [
      add('users', 'client'),
      add('app1', 'server'),
      connect('users', 'app1'),
      BoardOp.SetLoad({ rps: 300 }),
    ])

    expect(simulate(noDatabase, 300).errorRate).toBe(0)
  })

  test('too few servers behind the balancer highlights the idle ones', () => {
    const partial = foldOps(taskStart, [
      add('lb-1', 'lb', false),
      connect('lb-1', 'app1'),
    ])
    const check = checkGoal(
      partial,
      Goal.FansOut({ from: 'lb', to: 'server', min: 3 }),
    )

    expect(check.met).toBe(false)
    expect(check.focusNodes).toEqual(['app2', 'app3'])
  })

  test('the reference solution meets every goal, including the hidden one', () => {
    expect(firstFailedGoal(solved, lessonGoals)).toEqual(Option.none())
  })

  test('goal failures render in every language', () => {
    const failure = Option.getOrThrow(
      checkGoal(taskStart, Goal.MaxErrorRate({ max: 0.01, load: 900 }))
        .maybeFailure,
    )
    locales.forEach(locale => {
      expect(renderDomainMessage(uiFor(locale).domain, failure)).toContain(
        'app1',
      )
    })
  })
})

describe('geometry', () => {
  const users = { x: 100, y: 280 }
  const app1 = { x: 520, y: 280 }
  const lb = { x: 300, y: 280 }

  test('an edge with nothing in the way goes straight', () => {
    const curve = edgeCurve(users, app1, [{ x: 520, y: 130 }])
    expect(pointOnCurve(curve, 0.5).y).toBe(280)
  })

  test('an edge that would pass under another block goes around it', () => {
    const curve = edgeCurve(users, app1, [lb])
    const middle = pointOnCurve(curve, 0.5)
    expect(Math.abs(middle.y - lb.y)).toBeGreaterThan(NODE_HEIGHT / 2)
    expect(curve.start).toEqual({ x: 174, y: 280 })
    expect(curve.end.y).toBe(280)
  })
})
