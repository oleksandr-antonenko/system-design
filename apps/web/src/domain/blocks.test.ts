import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { renderDomainMessage } from '../i18n/domainMessage'
import { locales } from '../i18n/locale'
import { uiFor } from '../i18n/ui'
import {
  type NodeOptions,
  addNode,
  connect,
  disconnect,
  failNode,
  failRegion,
  recoverRegion,
  setLoad,
} from '../lesson/dsl'
import {
  type BoardDoc,
  type BoardOp,
  applyOp,
  capacityOf,
  emptyBoard,
  findNode,
  foldOps,
  isRegionDown,
  nextNodeId,
} from './board'
import { type ComponentKind, catalog, componentKinds } from './catalog'
import { simulate } from './simulate'

const build = (ops: ReadonlyArray<BoardOp>): BoardDoc =>
  Array.reduce(ops, emptyBoard, (doc, op) =>
    Result.getOrThrowWith(
      applyOp(doc, op),
      refusal => new Error(`${op._tag}: ${refusal._tag}`),
    ),
  )

const block = (
  id: string,
  kind: ComponentKind,
  options: NodeOptions = {},
): BoardOp => addNode(id, kind, 0, 0, options)

const refusalOf = (doc: BoardDoc, op: BoardOp): string =>
  Result.match(applyOp(doc, op), {
    onSuccess: () => 'accepted',
    onFailure: message => message._tag,
  })

const p95Of = (doc: BoardDoc, load: number): number =>
  Option.getOrThrow(simulate(doc, load).p95)

// CONNECTIONS

describe('connections of the new blocks', () => {
  const pairs = Array.flatMap(componentKinds, from =>
    Array.map(componentKinds, to => ({ from, to })),
  )

  test('every connection from the catalog is accepted', () => {
    pairs
      .filter(({ from, to }) => catalog[from].connectsTo.includes(to))
      .forEach(({ from, to }) => {
        const doc = build([block('a', from), block('b', to)])
        expect(refusalOf(doc, connect('a', 'b')), `${from} → ${to}`).toBe(
          'accepted',
        )
      })
  })

  test('every other connection is refused with an explanation in each language', () => {
    pairs
      .filter(({ from, to }) => !catalog[from].connectsTo.includes(to))
      .forEach(({ from, to }) => {
        const doc = build([block('a', from), block('b', to)])
        const refusal = Result.match(applyOp(doc, connect('a', 'b')), {
          onSuccess: () => Option.none(),
          onFailure: Option.some,
        })
        expect(Option.isSome(refusal), `${from} → ${to}`).toBe(true)
        Option.map(refusal, message =>
          locales.forEach(locale => {
            expect(
              renderDomainMessage(uiFor(locale).domain, message).trim(),
            ).not.toBe('')
          }),
        )
      })
  })

  test('users cannot connect to a cache, and the refusal names both kinds', () => {
    const doc = build([block('users', 'client'), block('cache-1', 'cache')])
    const refusal = Result.getFailure(applyOp(doc, connect('users', 'cache-1')))

    expect(Option.map(refusal, message => message._tag)).toEqual(
      Option.some('ConnectNotAllowed'),
    )
    Option.map(refusal, message => {
      const en = renderDomainMessage(uiFor('en').domain, message)
      expect(en).toContain('Users')
      expect(en).toContain('Cache')
      expect(en).toContain('Load balancer')
      expect(renderDomainMessage(uiFor('ru').domain, message)).toContain('Кеш')
    })
  })

  test('the specific refusals of the core keep their messages', () => {
    const doc = build([
      block('users', 'client'),
      block('app1', 'server'),
      block('app2', 'server'),
      block('db', 'db'),
      block('replica-1', 'replica'),
      block('cache-1', 'cache'),
      block('queue-1', 'queue'),
      block('worker-1', 'worker'),
    ])

    expect(refusalOf(doc, connect('users', 'db'))).toBe(
      'ConnectClientsToDatabase',
    )
    expect(refusalOf(doc, connect('app1', 'app2'))).toBe(
      'ConnectServerToServer',
    )
    expect(refusalOf(doc, connect('replica-1', 'app1'))).toBe(
      'ConnectWrongDirection',
    )
    expect(refusalOf(doc, connect('db', 'replica-1'))).toBe('ConnectFromSink')
    expect(refusalOf(doc, connect('cache-1', 'queue-1'))).toBe(
      'ConnectNotAllowed',
    )
    expect(refusalOf(doc, connect('worker-1', 'replica-1'))).toBe(
      'ConnectNotAllowed',
    )
  })
})

// OPERATIONS

describe('operations', () => {
  test('a block keeps its own capacity and region', () => {
    const doc = build([
      block('limiter-1', 'limiter', { capacity: 1100, region: 'eu' }),
      block('app1', 'server'),
    ])
    const limiter = Option.getOrThrow(findNode(doc, 'limiter-1'))
    const server = Option.getOrThrow(findNode(doc, 'app1'))

    expect(capacityOf(limiter)).toBe(1100)
    expect(limiter.maybeRegion).toEqual(Option.some('eu'))
    expect(capacityOf(server)).toBe(400)
    expect(server.maybeRegion).toEqual(Option.none())
  })

  test('a capacity must be above zero', () => {
    ;[0, -5, Number.POSITIVE_INFINITY].forEach(capacity => {
      expect(refusalOf(emptyBoard, block('app1', 'server', { capacity }))).toBe(
        'InvalidCapacity',
      )
    })
  })

  test('a region failure takes down its blocks but not its users', () => {
    const doc = build([
      block('users-eu', 'client', { region: 'eu' }),
      block('lb-eu', 'lb', { region: 'eu' }),
      block('app-eu', 'server', { region: 'eu' }),
      block('app-us', 'server', { region: 'us' }),
      block('db', 'db'),
      failNode('app-us'),
    ])
    const down = foldOps(doc, [failRegion('eu')])

    expect(down.failed).toEqual(['app-us', 'lb-eu', 'app-eu'])
    expect(isRegionDown(down, 'eu')).toBe(true)
    expect(isRegionDown(down, 'us')).toBe(true)
    expect(foldOps(down, [recoverRegion('eu')]).failed).toEqual(['app-us'])
    expect(refusalOf(doc, failRegion('asia'))).toBe('RegionHasNoBlocks')
    expect(refusalOf(doc, recoverRegion('asia'))).toBe('RegionHasNoBlocks')
  })

  test('new blocks get readable names', () => {
    const doc = build([block('cache-1', 'cache')])

    expect(nextNodeId(doc, 'cache')).toBe('cache-2')
    expect(nextNodeId(doc, 'worker')).toBe('worker-1')
    expect(nextNodeId(doc, 'replica')).toBe('replica-1')
    expect(nextNodeId(doc, 'events')).toBe('events-1')
  })
})

// SIMULATION

const servers = (count: number): ReadonlyArray<string> =>
  Array.makeBy(count, index => `app${index + 1}`)

const behindBalancer = (
  count: number,
  dataOps: (id: string) => ReadonlyArray<BoardOp>,
): ReadonlyArray<BoardOp> => [
  block('users', 'client'),
  block('lb', 'lb'),
  connect('users', 'lb'),
  ...Array.flatMap(servers(count), id => [
    block(id, 'server'),
    connect('lb', id),
    ...dataOps(id),
  ]),
]

describe('server traffic to data (D2)', () => {
  test('a server linked to one database sends it all it serves, as in lesson 3', () => {
    const doc = build([
      block('users', 'client'),
      block('app1', 'server'),
      block('db', 'db'),
      connect('users', 'app1'),
      connect('app1', 'db'),
    ])

    expect(simulate(doc, 300).nodes['db']?.incoming).toBe(300)
    expect(simulate(doc, 300).edges['app1>db']).toBe(300)
    expect(simulate(doc, 900).databaseLoad).toBe(400)
  })

  test('a cache takes reads off the database: 650 rps instead of 1800', () => {
    const withCache = build([
      block('db', 'db'),
      block('cache-1', 'cache'),
      connect('cache-1', 'db'),
      ...behindBalancer(5, id => [connect(id, 'db'), connect(id, 'cache-1')]),
    ])
    const withoutCache = build([
      block('db', 'db'),
      ...behindBalancer(5, id => [connect(id, 'db')]),
    ])
    const cached = simulate(withCache, 1800)
    const direct = simulate(withoutCache, 1800)

    expect(cached.databaseLoad).toBeCloseTo(360 + 288)
    expect(cached.nodes['cache-1']?.incoming).toBeCloseTo(1440)
    expect(cached.edges['cache-1>db']).toBeCloseTo(288)
    expect(cached.errorRate).toBe(0)
    expect(direct.databaseLoad).toBe(1800)
    expect(direct.errorRate).toBeCloseTo(300 / 1800)
    expect(p95Of(withCache, 1800)).toBeLessThan(p95Of(withoutCache, 1800))
  })

  test('writes split between shards, reads between shards and replicas', () => {
    const result = simulate(
      build([
        block('users', 'client'),
        block('app1', 'server'),
        block('db1', 'db'),
        block('db2', 'db'),
        block('replica-1', 'replica'),
        connect('users', 'app1'),
        connect('app1', 'db1'),
        connect('app1', 'db2'),
        connect('app1', 'replica-1'),
      ]),
      300,
    )

    expect(result.nodes['db1']?.incoming).toBeCloseTo(30 + 80)
    expect(result.nodes['db2']?.incoming).toBeCloseTo(30 + 80)
    expect(result.nodes['replica-1']?.incoming).toBeCloseTo(80)
  })

  test('with a cache all reads go to it, and its misses go to its stores', () => {
    const result = simulate(
      build([
        block('users', 'client'),
        block('app1', 'server'),
        block('db', 'db'),
        block('replica-1', 'replica'),
        block('cache-1', 'cache'),
        connect('users', 'app1'),
        connect('app1', 'db'),
        connect('app1', 'replica-1'),
        connect('app1', 'cache-1'),
        connect('cache-1', 'replica-1'),
      ]),
      300,
    )

    expect(result.nodes['db']?.incoming).toBeCloseTo(60)
    expect(result.nodes['cache-1']?.incoming).toBeCloseTo(240)
    expect(result.nodes['replica-1']?.incoming).toBeCloseTo(48)
  })

  test('a server whose cache is down reads from its stores again', () => {
    const doc = build([
      block('users', 'client'),
      block('app1', 'server'),
      block('db', 'db'),
      block('cache-1', 'cache'),
      connect('users', 'app1'),
      connect('app1', 'db'),
      connect('app1', 'cache-1'),
      connect('cache-1', 'db'),
      failNode('cache-1'),
    ])

    expect(simulate(doc, 300).nodes['db']?.incoming).toBeCloseTo(300)
    expect(simulate(doc, 300).errorRate).toBe(0)
  })
})

const queueBoard = (workers: number): BoardDoc =>
  build([
    block('db', 'db'),
    block('queue', 'queue'),
    ...Array.flatMap(
      Array.makeBy(workers, index => `worker-${index + 1}`),
      id => [block(id, 'worker'), connect('queue', id), connect(id, 'db')],
    ),
    ...behindBalancer(2, id => [connect(id, 'db'), connect(id, 'queue')]),
  ])

describe('queues, event buses and workers (D3)', () => {
  test('600 tasks for two workers of 200: the queue grows by 200 rps, user errors do not change', () => {
    const result = simulate(queueBoard(2), 600)
    const withoutQueue = simulate(
      build([
        block('db', 'db'),
        ...behindBalancer(2, id => [connect(id, 'db')]),
      ]),
      600,
    )

    expect(result.nodes['queue']?.incoming).toBe(600)
    expect(result.nodes['queue']?.backlog).toBeCloseTo(200)
    expect(result.backlog).toBeCloseTo(200)
    expect(result.edges['queue>worker-1']).toBeCloseTo(200)
    expect(result.errorRate).toBe(withoutQueue.errorRate)
    expect(simulate(queueBoard(2), 900).errorRate).toBeCloseTo(
      simulate(
        build([
          block('db', 'db'),
          ...behindBalancer(2, id => [connect(id, 'db')]),
        ]),
        900,
      ).errorRate,
    )
  })

  test('worker writes add to the database load', () => {
    expect(simulate(queueBoard(2), 600).databaseLoad).toBeCloseTo(600 + 400)
    expect(simulate(queueBoard(3), 600).backlog).toBeCloseTo(0)
  })

  test('a queue fills its workers evenly but never above their capacity', () => {
    const result = simulate(
      build([
        block('users', 'client'),
        block('app1', 'server'),
        block('queue', 'queue'),
        block('small', 'worker', { capacity: 100 }),
        block('big', 'worker', { capacity: 300 }),
        connect('users', 'app1'),
        connect('app1', 'queue'),
        connect('queue', 'small'),
        connect('queue', 'big'),
      ]),
      300,
    )

    expect(result.edges['queue>small']).toBeCloseTo(100)
    expect(result.edges['queue>big']).toBeCloseTo(200)
    expect(result.backlog).toBeCloseTo(0)
  })

  test('tasks lost beyond the queue capacity are not user errors', () => {
    const result = simulate(
      build([
        block('users', 'client'),
        block('app1', 'server'),
        block('queue', 'queue', { capacity: 100 }),
        connect('users', 'app1'),
        connect('app1', 'queue'),
      ]),
      300,
    )

    expect(result.nodes['queue']?.dropped).toBeCloseTo(200)
    expect(result.errorRate).toBe(0)
  })

  test('an event bus gives every subscriber a full copy; the lag of a slow one grows at the bus', () => {
    const doc = build([
      block('users', 'client'),
      block('app1', 'server'),
      block('events', 'events'),
      block('worker-1', 'worker'),
      block('search', 'search'),
      connect('users', 'app1'),
      connect('app1', 'events'),
      connect('events', 'worker-1'),
      connect('events', 'search'),
    ])
    const result = simulate(doc, 300)

    expect(result.nodes['search']?.incoming).toBeCloseTo(300)
    expect(result.nodes['worker-1']?.incoming).toBeCloseTo(200)
    expect(result.nodes['events']?.backlog).toBeCloseTo(100)
    expect(result.errorRate).toBe(0)
    expect(simulate(foldOps(doc, [failNode('worker-1')]), 300).backlog).toBe(
      300,
    )
  })

  test('only the user share of a database overload counts as errors', () => {
    const result = simulate(
      build([
        block('users', 'client'),
        block('app1', 'server'),
        block('db', 'db', { capacity: 500 }),
        block('queue', 'queue'),
        block('worker-1', 'worker'),
        block('worker-2', 'worker'),
        connect('users', 'app1'),
        connect('app1', 'db'),
        connect('app1', 'queue'),
        connect('queue', 'worker-1'),
        connect('queue', 'worker-2'),
        connect('worker-1', 'db'),
        connect('worker-2', 'db'),
      ]),
      300,
    )

    expect(result.nodes['db']?.incoming).toBeCloseTo(600)
    expect(result.nodes['db']?.dropped).toBeCloseTo(100)
    expect(result.errorRate).toBeCloseTo(50 / 300)
  })
})

describe('CDN and rate limiter (D1, D4)', () => {
  const behindCdn = build([
    block('users', 'client'),
    block('cdn', 'cdn'),
    block('lb', 'lb'),
    block('db', 'db'),
    connect('users', 'cdn'),
    connect('cdn', 'lb'),
    ...Array.flatMap(servers(3), id => [
      block(id, 'server'),
      connect('lb', id),
      connect(id, 'db'),
    ]),
  ])
  const plain = build([
    block('db', 'db'),
    ...behindBalancer(3, id => [connect(id, 'db')]),
  ])

  test('a CDN answers 60 % itself in 12 ms and passes the rest on', () => {
    const result = simulate(behindCdn, 1000)

    expect(result.edges['users>cdn']).toBe(1000)
    expect(result.edges['cdn>lb']).toBeCloseTo(400)
    expect(result.errorRate).toBe(0)
    expect(p95Of(behindCdn, 1000)).toBeCloseTo(p95Of(plain, 400))
  })

  test('a CDN with nowhere to pass dynamic requests loses them', () => {
    const result = simulate(
      build([
        block('users', 'client'),
        block('cdn', 'cdn'),
        connect('users', 'cdn'),
      ]),
      1000,
    )

    expect(result.errorRate).toBeCloseTo(0.4)
    expect(result.p95).toEqual(Option.some(12))
  })

  const limited = build([
    block('users', 'client'),
    block('limiter', 'limiter', { capacity: 1100 }),
    block('lb', 'lb'),
    block('db', 'db'),
    connect('users', 'limiter'),
    connect('limiter', 'lb'),
    ...Array.flatMap(servers(3), id => [
      block(id, 'server'),
      connect('lb', id),
      connect(id, 'db'),
    ]),
  ])

  test('a limiter of 1100 in front of three servers: servers stay under 92 %, about 900 rps rejected', () => {
    const result = simulate(limited, 2000)

    servers(3).forEach(id => {
      expect(result.nodes[id]?.utilization).toBeLessThanOrEqual(0.92)
    })
    expect(result.rejected).toBeCloseTo(900)
    expect(result.nodes['limiter']?.rejected).toBeCloseTo(900)
    expect(result.nodes['limiter']?.dropped).toBe(0)
    expect(result.errorRate).toBeCloseTo(900 / 2000)
  })

  test('rejected requests are errors but take no part in p95', () => {
    expect(p95Of(limited, 2000)).toBeCloseTo(p95Of(plain, 1100))
  })
})

describe('failures (D5)', () => {
  const twoBalancers = build([
    block('users', 'client'),
    block('lb-1', 'lb'),
    block('lb-2', 'lb'),
    block('db', 'db'),
    connect('users', 'lb-1'),
    connect('users', 'lb-2'),
    ...Array.flatMap(servers(3), id => [
      block(id, 'server'),
      connect('lb-1', id),
      connect('lb-2', id),
      connect(id, 'db'),
    ]),
  ])

  test('with two balancers, one failing costs no requests', () => {
    const result = simulate(foldOps(twoBalancers, [failNode('lb-1')]), 900)

    expect(result.errorRate).toBe(0)
    expect(result.nodes['lb-2']?.incoming).toBe(900)
    expect(result.edges['users>lb-1']).toBe(0)
  })

  test('users with no live target lose their requests at the failed block', () => {
    const result = simulate(
      build([
        block('users', 'client'),
        block('app1', 'server'),
        connect('users', 'app1'),
        failNode('app1'),
      ]),
      200,
    )

    expect(result.errorRate).toBe(1)
    expect(result.nodes['app1']?.incoming).toBe(200)
    expect(result.nodes['app1']?.dropped).toBe(200)
  })

  const withReplica = build([
    block('users', 'client'),
    block('app1', 'server'),
    block('db', 'db'),
    block('replica-1', 'replica'),
    connect('users', 'app1'),
    connect('app1', 'db'),
    connect('app1', 'replica-1'),
  ])

  test('when its database fails, a server writes to its replica and keeps serving', () => {
    const result = simulate(foldOps(withReplica, [failNode('db')]), 300)

    expect(result.errorRate).toBe(0)
    expect(result.nodes['app1']?.served).toBe(300)
    expect(result.nodes['replica-1']?.incoming).toBeCloseTo(300)
  })

  test('without a live database or a replica, the server loses all requests', () => {
    const noReplica = build([
      block('users', 'client'),
      block('app1', 'server'),
      block('db', 'db'),
      connect('users', 'app1'),
      connect('app1', 'db'),
      failNode('db'),
    ])
    const replicaOnly = build([
      block('users', 'client'),
      block('app1', 'server'),
      block('db', 'db'),
      block('replica-1', 'replica'),
      connect('users', 'app1'),
      connect('app1', 'replica-1'),
    ])

    expect(simulate(noReplica, 300).errorRate).toBe(1)
    expect(simulate(noReplica, 300).nodes['app1']?.dropped).toBe(300)
    expect(simulate(replicaOnly, 300).errorRate).toBe(1)
  })
})

describe('regions (D6)', () => {
  const twoRegions = build([
    addNode('users-eu', 'client', 100, 170, { region: 'eu' }),
    addNode('lb-eu', 'lb', 300, 170, { region: 'eu' }),
    addNode('app-eu', 'server', 520, 170, { region: 'eu' }),
    addNode('db-eu', 'db', 760, 170, { region: 'eu' }),
    addNode('lb-us', 'lb', 300, 420, { region: 'us' }),
    addNode('app-us', 'server', 520, 420, { region: 'us' }),
    addNode('db-us', 'db', 760, 420, { region: 'us' }),
    connect('users-eu', 'lb-eu'),
    connect('users-eu', 'lb-us'),
    connect('lb-eu', 'app-eu'),
    connect('app-eu', 'db-eu'),
    connect('lb-us', 'app-us'),
    connect('app-us', 'db-us'),
    setLoad(300),
  ])

  test('users stay in their own region while it is alive', () => {
    const result = simulate(twoRegions, 300)

    expect(result.edges['users-eu>lb-eu']).toBe(300)
    expect(result.edges['users-eu>lb-us']).toBe(0)
  })

  test('when eu fails, its users are served in us 70 ms slower', () => {
    const down = foldOps(twoRegions, [failRegion('eu')])
    const result = simulate(down, 300)

    expect(result.errorRate).toBe(0)
    expect(result.nodes['users-eu']?.isDown).toBe(false)
    expect(result.edges['users-eu>lb-us']).toBe(300)
    expect(p95Of(down, 300)).toBeCloseTo(p95Of(twoRegions, 300) + 70)
  })

  test('data that crosses regions pays 70 ms too', () => {
    const remoteData = foldOps(twoRegions, [
      failNode('lb-eu'),
      disconnect('app-us', 'db-us'),
      connect('app-us', 'db-eu'),
    ])
    const local = foldOps(twoRegions, [failNode('lb-eu')])

    expect(p95Of(remoteData, 300)).toBeCloseTo(p95Of(local, 300) + 70)
  })

  test('blocks without a region never pay for crossing', () => {
    const regionless = build([
      addNode('users', 'client', 100, 280, { region: 'eu' }),
      block('app1', 'server'),
      connect('users', 'app1'),
    ])
    const plain = build([
      block('users', 'client'),
      block('app1', 'server'),
      connect('users', 'app1'),
    ])

    expect(p95Of(regionless, 200)).toBeCloseTo(p95Of(plain, 200))
  })
})
