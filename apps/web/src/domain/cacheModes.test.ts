import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { DomainMessage, renderDomainMessage } from '../i18n/domainMessage'
import { locales } from '../i18n/locale'
import { uiFor } from '../i18n/ui'
import {
  addNode,
  connect,
  failNode,
  reset,
  setCacheMode,
  setLoad,
} from '../kinds/flow/dsl'
import { flow } from '../kinds/flow/kind'
import {
  type BoardDoc,
  type BoardOp,
  applyOp,
  edgeKey,
  emptyBoard,
  foldOps,
  isIdleCacheEdge,
} from './board'
import { Goal, checkGoal } from './goals'
import { simulate } from './simulate'

// Два режима кеша (add-flow-labels-and-cache-modes): read-through — базу при
// промахе читает кеш, cache-aside — сервер.

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

const blocks: ReadonlyArray<BoardOp> = [
  addNode('users', 'client', 100, 280),
  addNode('app1', 'server', 400, 280),
  addNode('cache-1', 'cache', 600, 160),
  addNode('db', 'db', 790, 280),
  connect('users', 'app1'),
  connect('app1', 'cache-1'),
  connect('app1', 'db'),
  setLoad(400),
]

const readThrough = build([...blocks, connect('cache-1', 'db')])
const cacheAside = build([setCacheMode('cache-aside'), ...blocks])

const kindsOn = (doc: BoardDoc, from: string, to: string) =>
  simulate(doc, doc.load).edgeKinds[edgeKey({ from, to })] ?? {}

describe('the cache mode of the board', () => {
  test('is read-through by default, and reset() brings it back', () => {
    expect(emptyBoard.cacheMode).toBe('read-through')
    expect(foldOps(cacheAside, [reset()]).cacheMode).toBe('read-through')
  })

  test('setCacheMode switches every cache of the board', () => {
    expect(cacheAside.cacheMode).toBe('cache-aside')
  })

  test('the journal names the mode', () => {
    expect(flow.describeOp(setCacheMode('cache-aside'))).toBe(
      'SetCacheMode cache-aside',
    )
  })
})

describe('cache-aside', () => {
  test('the server reads on a miss: server → database carries writes and misses', () => {
    const kinds = kindsOn(cacheAside, 'app1', 'db')
    expect(kinds.writes).toBeCloseTo(80)
    expect(kinds.misses).toBeCloseTo(64)
  })

  test('server → cache carries reads and the fills after each miss', () => {
    const kinds = kindsOn(cacheAside, 'app1', 'cache-1')
    expect(kinds.reads).toBeCloseTo(320)
    expect(kinds.fills).toBeCloseTo(64)
  })

  test('the database gets the same load as with read-through', () => {
    expect(simulate(cacheAside, 400).databaseLoad).toBeCloseTo(
      simulate(readThrough, 400).databaseLoad,
    )
    expect(simulate(cacheAside, 400).errorRate).toBe(0)
  })

  test('a miss pays the trip to the cache before the database', () => {
    const p95 = (doc: BoardDoc) =>
      Option.getOrThrow(simulate(doc, doc.load).p95)
    expect(p95(cacheAside)).toBeGreaterThanOrEqual(p95(readThrough))
  })

  test('the board refuses a cache → database connection', () => {
    expect(refusalOf(cacheAside, connect('cache-1', 'db'))).toBe(
      'ConnectCacheAside',
    )
  })

  test('the refusal explains the pattern in every language', () => {
    Array.forEach(locales, locale => {
      const text = renderDomainMessage(
        uiFor(locale).domain,
        DomainMessage.ConnectCacheAside(),
      )
      expect(text).toContain('cache-aside')
    })
  })

  test('a cache → database connection drawn before the switch carries nothing and is flagged', () => {
    const switched = build([
      ...blocks,
      connect('cache-1', 'db'),
      setCacheMode('cache-aside'),
    ])
    expect(simulate(switched, 400).edges['cache-1>db']).toBe(0)
    expect(isIdleCacheEdge(switched, { from: 'cache-1', to: 'db' })).toBe(true)
    expect(isIdleCacheEdge(readThrough, { from: 'cache-1', to: 'db' })).toBe(
      false,
    )
    const goal = Goal.NoLink({ from: 'cache', to: 'db' })
    expect(checkGoal(switched, goal).met).toBe(false)
    expect(checkGoal(switched, goal).focusEdges).toEqual(['cache-1>db'])
    expect(checkGoal(cacheAside, goal).met).toBe(true)
  })

  test('when the cache goes down the server reads everything from the database', () => {
    const down = foldOps(cacheAside, [failNode('cache-1')])
    expect(kindsOn(down, 'app1', 'db').reads).toBeCloseTo(320)
    expect(simulate(down, 400).databaseLoad).toBeCloseTo(400)
  })
})

describe('read-through', () => {
  test('without a cache → database connection the misses are lost', () => {
    const switched = foldOps(cacheAside, [setCacheMode('read-through')])
    expect(simulate(switched, 400).errorRate).toBeCloseTo(64 / 400)
  })

  test('the cache reads on a miss: cache → database carries the misses', () => {
    expect(kindsOn(readThrough, 'cache-1', 'db').misses).toBeCloseTo(64)
    expect(kindsOn(readThrough, 'app1', 'db')).toEqual({ writes: 80 })
  })
})
