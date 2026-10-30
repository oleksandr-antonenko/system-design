import { Array, Option, Result } from 'effect'
import { expectOutMessage, given, message, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import * as Board from '../board/board'
import { locales } from '../i18n/locale'
import { uiFor } from '../i18n/ui'
import {
  type NodeOptions,
  addNode,
  connect,
  setShare,
  setTraffic,
} from '../kinds/flow/dsl'
import {
  type BoardDoc,
  BoardOp,
  applyOp,
  emptyBoard,
  nextNodeId,
} from './board'
import { type ComponentKind, catalog, componentName, isSink } from './catalog'
import { Goal, checkGoal } from './goals'
import { overloadedNodes, simulate, simulationRules } from './simulate'

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

describe('the Object storage block', () => {
  test('sits at the end of the flow: rank 7, 50,000 rps, $0.05 an hour', () => {
    expect(catalog.storage).toEqual({
      rank: 7,
      capacity: 50000,
      costPerHour: 0.05,
      connectsTo: [],
    })
    expect(isSink('storage')).toBe(true)
    expect(componentName.storage).toBe('Object storage')
  })

  test('gets readable names and a free spot from the palette', () => {
    const doc = build([block('storage-1', 'storage')])

    expect(nextNodeId(emptyBoard, 'storage')).toBe('storage-1')
    expect(nextNodeId(doc, 'storage')).toBe('storage-2')
    story(
      Board.update({ doc: emptyBoard, isEditable: true }),
      given(Board.initialModel),
      message(Board.Message.ClickedPaletteItem({ kind: 'storage' })),
      expectOutMessage(
        Board.OutMessage.ProposedOp({
          op: BoardOp.AddNode({
            id: 'storage-1',
            kind: 'storage',
            x: 790,
            y: 520,
            locked: false,
            maybeCapacity: Option.none(),
            maybeRegion: Option.none(),
          }),
        }),
      ),
    )
  })

  test('takes uploads from users, origin requests from a CDN and results from workers', () => {
    const doc = build([
      block('users', 'client'),
      block('cdn-1', 'cdn'),
      block('lb-1', 'lb'),
      block('app1', 'server'),
      block('worker-1', 'worker'),
      block('storage-1', 'storage'),
    ])

    expect(refusalOf(doc, connect('users', 'storage-1'))).toBe('accepted')
    expect(refusalOf(doc, connect('cdn-1', 'storage-1'))).toBe('accepted')
    expect(refusalOf(doc, connect('worker-1', 'storage-1'))).toBe('accepted')
    expect(refusalOf(doc, connect('app1', 'storage-1'))).toBe(
      'ConnectNotAllowed',
    )
    expect(refusalOf(doc, connect('lb-1', 'storage-1'))).toBe(
      'ConnectNotAllowed',
    )
    expect(refusalOf(doc, connect('storage-1', 'app1'))).toBe(
      'ConnectWrongDirection',
    )
  })

  test('costs $0.05 an hour', () => {
    expect(
      simulate(build([block('storage-1', 'storage')]), 0).costPerHour,
    ).toBeCloseTo(0.05)
  })

  test('has a native explanation in every language', () => {
    locales.forEach(locale => {
      expect(uiFor(locale).kindHint.storage.trim(), locale).not.toBe('')
    })
    expect(uiFor('ru').kindHint.storage).toMatch(/^Объектное хранилище/u)
    expect(uiFor('uk').kindHint.storage).toMatch(/^Об’єктне сховище/u)
    expect(uiFor('lt').kindHint.storage).toMatch(/^Objektų saugykla/u)
  })
})

describe('Object storage in the flow', () => {
  test('a direct upload answers in 40 ms', () => {
    const doc = build([
      block('users', 'client'),
      block('storage-1', 'storage'),
      connect('users', 'storage-1'),
    ])
    const sim = simulate(doc, 1000)

    expect(sim.nodes['storage-1']?.served).toBe(1000)
    expect(sim.nodes['storage-1']?.utilization).toBeCloseTo(0.02)
    expect(sim.errorRate).toBe(0)
    expect(p95Of(doc, 1000)).toBe(simulationRules.storageMs)
  })

  test('an upload from another region pays the crossing', () => {
    const doc = build([
      block('users', 'client', { region: 'eu' }),
      block('storage-1', 'storage', { region: 'us' }),
      connect('users', 'storage-1'),
    ])

    expect(p95Of(doc, 100)).toBe(
      simulationRules.storageMs + simulationRules.regionCrossingMs,
    )
  })

  test('CDN misses to the origin count in p95', () => {
    const withStatic = (cdnStaticShare: number) =>
      build([
        block('users', 'client'),
        block('cdn-1', 'cdn'),
        block('storage-1', 'storage'),
        connect('users', 'cdn-1'),
        connect('cdn-1', 'storage-1'),
        setTraffic({ cdnStaticShare }),
      ])

    expect(simulate(withStatic(0.6), 1000).nodes['storage-1']?.incoming).toBe(
      400,
    )
    expect(p95Of(withStatic(0.6), 1000)).toBe(simulationRules.storageMs)
    expect(p95Of(withStatic(0.97), 1000)).toBe(simulationRules.cdnMs)
  })

  test('an upload group next to the site: shares split the load, the p95 covers both', () => {
    const doc = build([
      block('users', 'client'),
      block('uploads', 'client'),
      block('cdn-1', 'cdn'),
      block('storage-1', 'storage'),
      connect('users', 'cdn-1'),
      connect('cdn-1', 'storage-1'),
      connect('uploads', 'storage-1'),
      setShare('users', 9),
    ])
    const sim = simulate(doc, 1000)

    expect(sim.nodes['uploads']?.incoming).toBeCloseTo(100)
    expect(sim.nodes['storage-1']?.incoming).toBeCloseTo(900 * 0.4 + 100)
  })

  test('a worker stores one object per job, apart from its database rows', () => {
    const doc = build([
      block('users', 'client'),
      block('app1', 'server'),
      block('db', 'db'),
      block('queue-1', 'queue'),
      block('worker-1', 'worker'),
      block('storage-1', 'storage'),
      connect('users', 'app1'),
      connect('app1', 'db'),
      connect('app1', 'queue-1'),
      connect('queue-1', 'worker-1'),
      connect('worker-1', 'db'),
      connect('worker-1', 'storage-1'),
      setTraffic({ writesPerJob: 2 }),
    ])
    const sim = simulate(doc, 100)

    expect(sim.edges['worker-1>storage-1']).toBe(100)
    expect(sim.edges['worker-1>db']).toBe(200)
    expect(sim.errorRate).toBe(0)
  })

  test('an overloaded storage loses user requests and is named', () => {
    const doc = build([
      block('users', 'client'),
      block('storage-1', 'storage', { capacity: 1000 }),
      connect('users', 'storage-1'),
    ])
    const sim = simulate(doc, 1500)

    expect(sim.errorRate).toBeCloseTo(1 / 3)
    expect(overloadedNodes(sim)).toEqual(['storage-1'])
  })

  test('Carries and MaxUtilization work on a storage block', () => {
    const idle = build([
      block('users', 'client'),
      block('storage-1', 'storage'),
    ])
    const busy = build([
      block('users', 'client'),
      block('storage-1', 'storage'),
      connect('users', 'storage-1'),
    ])
    const carries = Goal.Carries({ node: 'storage-1', min: 500, load: 1000 })

    expect(checkGoal(idle, carries).met).toBe(false)
    expect(checkGoal(busy, carries).met).toBe(true)
    expect(
      checkGoal(
        busy,
        Goal.MaxUtilization({ kind: 'storage', max: 0.5, load: 30000 }),
      ).met,
    ).toBe(false)
  })
})
