import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { renderDomainMessage } from '../i18n/domainMessage'
import { locales } from '../i18n/locale'
import { uiFor } from '../i18n/ui'
import {
  addNode,
  connect,
  failNode,
  reset,
  setLoad,
  setShare,
} from '../kinds/flow/dsl'
import { flow } from '../kinds/flow/kind'
import {
  type BoardDoc,
  BoardOp,
  applyOp,
  emptyBoard,
  foldOps,
  shareOf,
} from './board'
import { Goal, checkGoal } from './goals'
import { simulate } from './simulate'

const build = (ops: ReadonlyArray<BoardOp>): BoardDoc =>
  Array.reduce(ops, emptyBoard, (doc, op) =>
    Result.getOrThrowWith(
      applyOp(doc, op),
      refusal => new Error(`${op._tag}: ${refusal._tag}`),
    ),
  )

const refusalOf = (doc: BoardDoc, op: BoardOp): string =>
  Result.match(applyOp(doc, op), {
    onSuccess: () => 'accepted',
    onFailure: message => message._tag,
  })

// Две группы пользователей, у каждой свой сервер и общая база.
const twoGroups = (extra: ReadonlyArray<BoardOp> = []): BoardDoc =>
  build([
    addNode('users-eu', 'client', 100, 130),
    addNode('users-us', 'client', 100, 430),
    addNode('app-eu', 'server', 520, 130),
    addNode('app-us', 'server', 520, 430),
    addNode('db', 'db', 790, 280),
    connect('users-eu', 'app-eu'),
    connect('users-us', 'app-us'),
    connect('app-eu', 'db'),
    connect('app-us', 'db'),
    setLoad(400),
    ...extra,
  ])

describe('load shares of user groups', () => {
  test('without shares, groups split the load equally, as before', () => {
    const sim = simulate(twoGroups(), 400)

    expect(sim.nodes['users-eu']?.incoming).toBe(200)
    expect(sim.nodes['users-us']?.incoming).toBe(200)
    expect(shareOf(twoGroups(), 'users-eu')).toBe(1)
  })

  test('a share of 3 against 1 sends three quarters of the load to that group', () => {
    const doc = twoGroups([setShare('users-us', 3)])
    const sim = simulate(doc, 400)

    expect(sim.nodes['users-us']?.incoming).toBe(300)
    expect(sim.nodes['users-eu']?.incoming).toBe(100)
    expect(sim.nodes['app-us']?.utilization).toBe(0.75)
    expect(sim.load).toBe(400)
  })

  test('goals with a load scale every group proportionally', () => {
    const doc = twoGroups([setShare('users-us', 3)])
    const sim = simulate(doc, 800)

    expect(sim.nodes['users-us']?.incoming).toBe(600)
    expect(sim.nodes['users-eu']?.incoming).toBe(200)
    expect(sim.errorRate).toBeCloseTo(200 / 800)
    expect(
      checkGoal(doc, Goal.MaxErrorRate({ max: 0.01, load: 400 })).met,
    ).toBe(true)
    expect(
      checkGoal(doc, Goal.MaxErrorRate({ max: 0.01, load: 800 })).met,
    ).toBe(false)
  })

  test('a later share replaces the earlier one', () => {
    const doc = twoGroups([setShare('users-us', 3), setShare('users-us', 1)])

    expect(simulate(doc, 400).nodes['users-us']?.incoming).toBe(200)
  })

  test('only users have a share, and it must be above zero', () => {
    const doc = twoGroups()

    expect(refusalOf(doc, setShare('app-eu', 2))).toBe('ShareNotForUsers')
    expect(refusalOf(doc, setShare('nobody', 2))).toBe('UnknownNode')
    ;[0, -1, Number.NaN, Number.POSITIVE_INFINITY].forEach(share => {
      expect(refusalOf(doc, setShare('users-eu', share)), `${share}`).toBe(
        'InvalidShare',
      )
    })
  })

  test('the refusals explain themselves in every language', () => {
    const doc = twoGroups()
    const refusals = Array.getSomes([
      Result.getFailure(applyOp(doc, setShare('app-eu', 2))),
      Result.getFailure(applyOp(doc, setShare('users-eu', 0))),
    ])

    expect(refusals.length).toBe(2)
    locales.forEach(locale => {
      refusals.forEach(refusal => {
        const text = renderDomainMessage(uiFor(locale).domain, refusal)
        expect(text, locale).toMatch(/app-eu|users-eu/u)
      })
    })
  })

  test('removing a group forgets its share', () => {
    const doc = build([
      addNode('users-eu', 'client', 100, 130, { locked: false }),
      addNode('users-us', 'client', 100, 430),
      setShare('users-eu', 4),
      BoardOp.RemoveNode({ id: 'users-eu' }),
    ])

    expect(doc.shares).toEqual({})
  })

  test('the journal names the operation', () => {
    expect(flow.describeOp(setShare('users-us', 3))).toBe(
      'SetShare users-us · 3',
    )
  })
})

describe('reset', () => {
  test('starts from an empty board: blocks, load, failures and shares are gone', () => {
    const doc = twoGroups([setShare('users-us', 3), failNode('app-eu')])
    const fresh = foldOps(doc, [reset()])

    expect(fresh).toEqual(emptyBoard)
    expect(Option.isNone(simulate(fresh, fresh.load).p95)).toBe(true)
  })

  test('a reference built after a reset does not see the earlier board', () => {
    const doc = foldOps(twoGroups(), [
      reset(),
      addNode('users', 'client', 100, 280),
      addNode('app1', 'server', 520, 280),
      connect('users', 'app1'),
      setLoad(300),
    ])

    expect(doc.nodes.map(node => node.id)).toEqual(['users', 'app1'])
    expect(simulate(doc, doc.load).nodes['app1']?.incoming).toBe(300)
  })

  test('the journal names the operation', () => {
    expect(flow.describeOp(reset())).toBe('Reset')
  })
})
