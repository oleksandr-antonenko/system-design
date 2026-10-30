import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { reviewOf } from '../courses/system-design/lessons/13-url-shortener/review'
import { renderDomainMessage } from '../i18n/domainMessage'
import { locales } from '../i18n/locale'
import { uiFor } from '../i18n/ui'
import { addNode, connect, reset, setLoad, setTraffic } from '../kinds/flow/dsl'
import { flow } from '../kinds/flow/kind'
import { trafficLine } from '../kinds/flow/view'
import {
  type BoardDoc,
  type BoardOp,
  applyOp,
  emptyBoard,
  foldOps,
} from './board'
import { simulate, simulationRules } from './simulate'
import { defaultTraffic, readShareOf } from './traffic'

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

const incoming = (doc: BoardDoc, load: number, id: string): number =>
  simulate(doc, load).nodes[id]?.incoming ?? 0

const p95Of = (doc: BoardDoc, load: number): number =>
  Option.getOrThrow(simulate(doc, load).p95)

/** Задержка сервера при загрузке `utilization` (формула симулятора). */
const serverMs = (utilization: number): number => 18 + 26 / (1 - utilization)

const databaseMs = (utilization: number): number => 4 + 9 / (1 - utilization)

const oneServer = (extra: ReadonlyArray<BoardOp> = []): BoardDoc =>
  build([
    addNode('users', 'client', 100, 280),
    addNode('app1', 'server', 400, 280),
    addNode('db', 'db', 790, 280),
    connect('users', 'app1'),
    connect('app1', 'db'),
    ...extra,
  ])

const withQueue = (extra: ReadonlyArray<BoardOp> = []): BoardDoc =>
  oneServer([
    addNode('queue-1', 'queue', 600, 430),
    addNode('worker-1', 'worker', 790, 430),
    connect('app1', 'queue-1'),
    connect('queue-1', 'worker-1'),
    connect('worker-1', 'db'),
    ...extra,
  ])

describe('the default profile', () => {
  test('equals the old constants, so lessons without setTraffic do not change', () => {
    expect(emptyBoard.traffic).toEqual(defaultTraffic)
    expect(defaultTraffic).toEqual({
      writeShare: simulationRules.writeShare,
      deferredShare: 0,
      cacheHitShare: simulationRules.cacheHitShare,
      cdnStaticShare: simulationRules.cdnStaticShare,
      jobsPerRequest: 1,
      writesPerJob: 1,
    })
    expect(readShareOf(defaultTraffic)).toBe(1 - simulationRules.writeShare)
  })

  test('the simulation reports the profile it used', () => {
    const doc = oneServer([setTraffic({ writeShare: 0.05 })])

    expect(simulate(doc, 100).traffic.writeShare).toBe(0.05)
    expect(simulate(oneServer(), 100).traffic).toEqual(defaultTraffic)
  })
})

describe('setTraffic', () => {
  test('changes only the named knobs; a later call keeps the earlier ones', () => {
    const doc = oneServer([
      setTraffic({ writeShare: 0.01 }),
      setTraffic({ cacheHitShare: 0.95 }),
    ])

    expect(doc.traffic).toEqual({
      ...defaultTraffic,
      writeShare: 0.01,
      cacheHitShare: 0.95,
    })
  })

  test('reset brings back the default profile', () => {
    const doc = oneServer([setTraffic({ writeShare: 0.01 })])

    expect(foldOps(doc, [reset()]).traffic).toEqual(defaultTraffic)
  })

  test('out-of-range knobs are refused and named in every language', () => {
    const doc = oneServer()
    const cases: ReadonlyArray<BoardOp> = [
      setTraffic({ cacheHitShare: 1.2 }),
      setTraffic({ writeShare: -0.1 }),
      setTraffic({ writeShare: 0.7, deferredShare: 0.4 }),
      setTraffic({ jobsPerRequest: -1 }),
      setTraffic({ writesPerJob: Number.NaN }),
    ]

    cases.forEach(op => {
      expect(refusalOf(doc, op), flow.describeOp(op)).toBe('InvalidTraffic')
    })
    expect(
      refusalOf(doc, setTraffic({ writeShare: 0.7, deferredShare: 0.3 })),
    ).toBe('accepted')
    Option.map(
      Result.getFailure(applyOp(doc, setTraffic({ cdnStaticShare: 2 }))),
      refusal =>
        locales.forEach(locale => {
          expect(
            renderDomainMessage(uiFor(locale).domain, refusal),
            locale,
          ).toContain('cdnStaticShare')
        }),
    )
  })

  test('the journal lists the knobs it changes', () => {
    expect(
      flow.describeOp(setTraffic({ writeShare: 0.01, cacheHitShare: 0.95 })),
    ).toBe('SetTraffic writeShare 0.01 · cacheHitShare 0.95')
  })
})

describe('reads, writes and the cache', () => {
  test('a read-heavy profile: 1 % writes and a 95 % cache hit keep the database almost idle', () => {
    const doc = oneServer([
      addNode('cache-1', 'cache', 600, 130),
      connect('app1', 'cache-1'),
      connect('cache-1', 'db'),
      setTraffic({ writeShare: 0.01, cacheHitShare: 0.95 }),
    ])

    // 4 записи + промахи 5 % от 396 чтений
    expect(incoming(doc, 400, 'db')).toBeCloseTo(4 + 396 * 0.05)
    expect(incoming(doc, 400, 'cache-1')).toBeCloseTo(396)
  })

  test('a CDN static share of 90 % lets only a tenth through', () => {
    const doc = build([
      addNode('users', 'client', 100, 280),
      addNode('cdn-1', 'cdn', 250, 280),
      addNode('app1', 'server', 400, 280),
      connect('users', 'cdn-1'),
      connect('cdn-1', 'app1'),
      setTraffic({ cdnStaticShare: 0.9 }),
    ])

    expect(incoming(doc, 1000, 'app1')).toBeCloseTo(100)
  })
})

describe('deferred writes', () => {
  const deferAll = setTraffic({ writeShare: 0, deferredShare: 1 })

  test('with a queue, the server answers 2 ms after its own work', () => {
    const doc = withQueue([deferAll])

    expect(p95Of(doc, 200)).toBeCloseTo(
      serverMs(0.5) + simulationRules.deferredMs,
    )
    expect(incoming(doc, 200, 'queue-1')).toBe(200)
    expect(
      simulate(doc, 200).edges['app1>db'],
      'nothing goes to the database synchronously',
    ).toBe(0)
  })

  test('without a queue or a bus, the server writes them synchronously', () => {
    const doc = oneServer([deferAll])

    expect(incoming(doc, 200, 'db')).toBe(200)
    expect(p95Of(doc, 200)).toBeCloseTo(serverMs(0.5) + databaseMs(200 / 1500))
  })

  test('a mixed profile splits served requests three ways', () => {
    const doc = withQueue([
      setTraffic({ writeShare: 0.1, deferredShare: 0.3, jobsPerRequest: 0.3 }),
    ])
    const sim = simulate(doc, 200)

    // 20 синхронных записей + 120 чтений; задачи: 60, их пишет worker
    expect(sim.edges['app1>db']).toBeCloseTo(20 + 120)
    expect(sim.edges['app1>queue-1']).toBeCloseTo(60)
    expect(sim.edges['worker-1>db']).toBeCloseTo(60)
    expect(sim.errorRate).toBe(0)
  })
})

describe('jobs and rows', () => {
  test('two jobs per request double the queue and the event bus', () => {
    const doc = withQueue([
      addNode('events-1', 'events', 600, 130),
      connect('app1', 'events-1'),
      setTraffic({ jobsPerRequest: 2 }),
    ])

    expect(incoming(doc, 100, 'queue-1')).toBe(200)
    expect(incoming(doc, 100, 'events-1')).toBe(200)
  })

  test('fan-out writes several rows per job, batching fewer than one', () => {
    const rows = (writesPerJob: number) =>
      simulate(withQueue([setTraffic({ writesPerJob })]), 100).edges[
        'worker-1>db'
      ]

    expect(rows(1)).toBe(100)
    expect(rows(3)).toBe(300)
    expect(rows(0.1)).toBeCloseTo(10)
  })
})

describe('review and instruments', () => {
  test('the review of lesson 13 reads the CDN share from the board', () => {
    const board = (extra: ReadonlyArray<BoardOp>) =>
      build([
        addNode('users', 'client', 100, 280),
        addNode('cdn-1', 'cdn', 250, 280),
        addNode('app1', 'server', 400, 280),
        connect('users', 'cdn-1'),
        connect('cdn-1', 'app1'),
        setLoad(1000),
        ...extra,
      ])
    const edgeOf = (doc: BoardDoc) =>
      reviewOf(simulate(doc, doc.load), doc).edge

    expect(edgeOf(board([]))).toBeCloseTo(600)
    expect(edgeOf(board([setTraffic({ cdnStaticShare: 0.8 })]))).toBeCloseTo(
      800,
    )
  })

  test('the profile line shows only the knobs a lesson changed', () => {
    const doc = oneServer([
      setTraffic({ writeShare: 0.01, cacheHitShare: 0.95 }),
    ])

    expect(trafficLine(oneServer(), uiFor('en'))).toEqual(Option.none())
    expect(trafficLine(doc, uiFor('en'))).toEqual(
      Option.some('writes 1% · hit 95%'),
    )
    expect(trafficLine(doc, uiFor('ru'))).toEqual(
      Option.some('запись 1% · cache hit 95%'),
    )
    expect(
      trafficLine(
        oneServer([setTraffic({ writeShare: 0.005, writesPerJob: 0.5 })]),
        uiFor('lt'),
      ),
    ).toEqual(Option.some('rašymas 0,5 % · įrašų užduočiai ×0,5'))
  })

  test('the profile line renders in every language', () => {
    const doc = oneServer([
      setTraffic({
        writeShare: 0.1,
        deferredShare: 0.3,
        cacheHitShare: 0.9,
        cdnStaticShare: 0.7,
        jobsPerRequest: 2,
        writesPerJob: 3,
      }),
    ])
    locales.forEach(locale => {
      const line = Option.getOrThrow(trafficLine(doc, uiFor(locale)))
      expect(line.split(' · '), locale).toHaveLength(6)
    })
  })
})
