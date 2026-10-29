import { Array } from 'effect'
import { describe, expect, test } from 'vitest'

import lesson from '../courses/system-design/lessons/03-load-balancer/lesson'
import type { BoardDoc } from '../domain/board'
import { simulate } from '../domain/simulate'
import { type Anim, initialAnim, tick } from './anim'
import { boardAt } from './dsl'

const FRAME_MS = 16

const quiet = boardAt(lesson, 0, {})
const overloaded = boardAt(lesson, 1, {})

const frames = (
  count: number,
  start: Anim,
  doc: BoardDoc,
  isReducedMotion = false,
): Anim =>
  Array.reduce(
    Array.makeBy(count, () => FRAME_MS),
    start,
    (anim, deltaMs) => tick(anim, deltaMs, doc, isReducedMotion),
  )

const utilizationOf = (doc: BoardDoc) =>
  Object.fromEntries(
    Object.entries(simulate(doc, doc.load).nodes).map(([id, node]) => [
      id,
      node.utilization,
    ]),
  )

describe('tick', () => {
  test('on pause the clock stands still, but the instruments follow the board', () => {
    const paused: Anim = {
      ...frames(400, initialAnim, quiet),
      isRunning: false,
    }
    const target = simulate(overloaded, overloaded.load)
    const next = tick(paused, FRAME_MS, overloaded, false)

    expect(next.clock).toBe(paused.clock)
    expect(next.shownLoad).toBe(900)
    expect(next.hudLoad).toBeCloseTo(target.load, 6)
    expect(next.hudErrorRate).toBeCloseTo(target.errorRate, 6)
    expect(next.hudDatabase).toBeCloseTo(target.databaseLoad, 6)
    expect(next.nodeUtil['app1']).toBeCloseTo(
      utilizationOf(overloaded)['app1'] ?? 0,
      6,
    )
    expect(next.sparkErrors).toEqual(paused.sparkErrors)
  })

  test('with reduced motion the values jump straight to the simulation', () => {
    const target = simulate(overloaded, overloaded.load)
    const next = tick(initialAnim, FRAME_MS, overloaded, true)

    expect(next.shownLoad).toBe(overloaded.load)
    expect(next.hudLoad).toBe(target.load)
    expect(next.hudErrorRate).toBe(target.errorRate)
    expect(next.hudP95).toEqual(target.p95)
    expect(next.hudDatabase).toBe(target.databaseLoad)
    expect(next.nodeUtil).toEqual(utilizationOf(overloaded))
    expect(next.edgeFlow).toEqual(target.edges)
    expect(next.clock).toBe(0)
    expect(
      tick(initialAnim, FRAME_MS, overloaded, false).shownLoad,
    ).toBeLessThan(overloaded.load / 10)
  })

  test('with reduced motion the clock stays put while the sparklines still sample', () => {
    const settled = frames(10, initialAnim, overloaded, true)

    expect(settled.clock).toBe(0)
    expect(settled.sparkErrors).toHaveLength(1)
  })
})
