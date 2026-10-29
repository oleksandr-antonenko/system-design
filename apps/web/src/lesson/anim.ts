import { Array, Option, Schema } from 'effect'

import type { BoardDoc } from '../domain/board'
import { type SimResult, simulate } from '../domain/simulate'

export const Anim = Schema.Struct({
  isRunning: Schema.Boolean,
  speed: Schema.Number,
  clock: Schema.Number,
  shownLoad: Schema.Number,
  nodeUtil: Schema.Record(Schema.String, Schema.Number),
  nodeIncoming: Schema.Record(Schema.String, Schema.Number),
  edgeFlow: Schema.Record(Schema.String, Schema.Number),
  hudLoad: Schema.Number,
  hudErrorRate: Schema.Number,
  hudP95: Schema.Option(Schema.Number),
  hudDatabase: Schema.Number,
  hudRejected: Schema.Number,
  hudBacklog: Schema.Number,
  sparkErrors: Schema.Array(Schema.Number),
  sparkP95: Schema.Array(Schema.Number),
  sinceSampleMs: Schema.Number,
})
export type Anim = typeof Anim.Type

export const initialAnim: Anim = {
  isRunning: true,
  speed: 1,
  clock: 0,
  shownLoad: 0,
  nodeUtil: {},
  nodeIncoming: {},
  edgeFlow: {},
  hudLoad: 0,
  hudErrorRate: 0,
  hudP95: Option.none(),
  hudDatabase: 0,
  hudRejected: 0,
  hudBacklog: 0,
  sparkErrors: [],
  sparkP95: [],
  sinceSampleMs: 0,
}

const MAX_DELTA_MS = 64
const LOAD_EASING_MS = 700
const VALUE_EASING_MS = 260
const SAMPLE_EVERY_MS = 150
const SPARK_POINTS = 90

const lerp = (from: number, to: number, weight: number): number =>
  from + (to - from) * weight

const easeRecord = (
  previous: Readonly<Record<string, number>>,
  target: Readonly<Record<string, number>>,
  weight: number,
): Readonly<Record<string, number>> =>
  Object.fromEntries(
    Object.entries(target).map(([key, value]) => [
      key,
      lerp(previous[key] ?? 0, value, weight),
    ]),
  )

const keepLast = (
  values: ReadonlyArray<number>,
  value: number,
): ReadonlyArray<number> => Array.takeRight([...values, value], SPARK_POINTS)

export const shownSimulation = (anim: Anim, doc: BoardDoc): SimResult =>
  simulate(doc, anim.shownLoad)

export const tick = (
  anim: Anim,
  deltaMs: number,
  doc: BoardDoc,
  isReducedMotion: boolean,
): Anim => {
  const delta = Math.min(deltaMs, MAX_DELTA_MS)
  const isAnimating = anim.isRunning && !isReducedMotion
  const scaled = delta * anim.speed
  const loadWeight = isAnimating ? 1 - Math.exp(-scaled / LOAD_EASING_MS) : 1
  const valueWeight = isAnimating ? 1 - Math.exp(-scaled / VALUE_EASING_MS) : 1
  const shownLoad = lerp(anim.shownLoad, doc.load, loadWeight)
  const sim = simulate(doc, shownLoad)
  const incoming = Object.fromEntries(
    Object.entries(sim.nodes).map(([id, node]) => [id, node.incoming]),
  )
  const utilization = Object.fromEntries(
    Object.entries(sim.nodes).map(([id, node]) => [id, node.utilization]),
  )
  const hudP95 = Option.match(sim.p95, {
    onNone: () => Option.none<number>(),
    onSome: target =>
      Option.some(
        Option.match(anim.hudP95, {
          onNone: () => target,
          onSome: previous => lerp(previous, target, valueWeight),
        }),
      ),
  })
  const hudErrorRate = lerp(anim.hudErrorRate, sim.errorRate, valueWeight)
  const sinceSampleMs = anim.isRunning
    ? anim.sinceSampleMs + delta
    : anim.sinceSampleMs
  const shouldSample = sinceSampleMs >= SAMPLE_EVERY_MS

  return {
    ...anim,
    clock: isAnimating ? anim.clock + scaled / 1000 : anim.clock,
    shownLoad,
    nodeUtil: easeRecord(anim.nodeUtil, utilization, valueWeight),
    nodeIncoming: easeRecord(anim.nodeIncoming, incoming, valueWeight),
    edgeFlow: easeRecord(anim.edgeFlow, sim.edges, valueWeight),
    hudLoad: lerp(anim.hudLoad, sim.load, valueWeight),
    hudErrorRate,
    hudP95,
    hudDatabase: lerp(anim.hudDatabase, sim.databaseLoad, valueWeight),
    hudRejected: lerp(anim.hudRejected, sim.rejected, valueWeight),
    hudBacklog: lerp(anim.hudBacklog, sim.backlog, valueWeight),
    sparkErrors: shouldSample
      ? keepLast(anim.sparkErrors, hudErrorRate)
      : anim.sparkErrors,
    sparkP95: shouldSample
      ? keepLast(
          anim.sparkP95,
          Option.getOrElse(hudP95, () => 0),
        )
      : anim.sparkP95,
    sinceSampleMs: shouldSample ? 0 : sinceSampleMs,
  }
}
