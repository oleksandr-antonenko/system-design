import { Array, Option, Schema, pipe } from 'effect'

// Профиль трафика доски потоков (design D1 add-flow-traffic-profile): из чего
// состоит запрос, который обслужил сервер, и сколько работы он порождает
// дальше. По умолчанию — прежние константы симулятора, поэтому уроки, которые
// профиль не задают, считаются как раньше.

export const TrafficProfile = Schema.Struct({
  /** Доля синхронной записи в базы через сервер. */
  writeShare: Schema.Number,
  /** Доля записи, которую сервер отдаёт своей очереди или шине; без них он
      пишет её синхронно. */
  deferredShare: Schema.Number,
  /** Доля чтений, на которые кеш отвечает сам. */
  cacheHitShare: Schema.Number,
  /** Доля запросов, которые CDN отдаёт сам (статика). */
  cdnStaticShare: Schema.Number,
  /** Сообщений в каждую очередь и шину сервера на обслуженный запрос. */
  jobsPerRequest: Schema.Number,
  /** Записей в базу на задачу worker: больше 1 — fan-out, меньше 1 — пачки. */
  writesPerJob: Schema.Number,
})
export type TrafficProfile = typeof TrafficProfile.Type

export const TrafficKnob = Schema.Literals([
  'writeShare',
  'deferredShare',
  'cacheHitShare',
  'cdnStaticShare',
  'jobsPerRequest',
  'writesPerJob',
])
export type TrafficKnob = typeof TrafficKnob.Type

export const trafficKnobs: ReadonlyArray<TrafficKnob> = TrafficKnob.literals

export const defaultTraffic: TrafficProfile = {
  writeShare: 0.2,
  deferredShare: 0,
  cacheHitShare: 0.8,
  cdnStaticShare: 0.6,
  jobsPerRequest: 1,
  writesPerJob: 1,
}

/** Изменение профиля: только названные ручки, остальные остаются. */
export const TrafficPatch = Schema.Struct({
  writeShare: Schema.optionalKey(Schema.Number),
  deferredShare: Schema.optionalKey(Schema.Number),
  cacheHitShare: Schema.optionalKey(Schema.Number),
  cdnStaticShare: Schema.optionalKey(Schema.Number),
  jobsPerRequest: Schema.optionalKey(Schema.Number),
  writesPerJob: Schema.optionalKey(Schema.Number),
})
export type TrafficPatch = typeof TrafficPatch.Type

/** Доля чтений: всё, что не запись и не отложенная запись. */
export const readShareOf = (traffic: TrafficProfile): number =>
  1 - traffic.writeShare - traffic.deferredShare

const SHARE_KNOBS: ReadonlyArray<TrafficKnob> = [
  'writeShare',
  'deferredShare',
  'cacheHitShare',
  'cdnStaticShare',
]

const isShare = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1

const isCount = (value: number): boolean => Number.isFinite(value) && value >= 0

// Сумма долей записи сравнивается с допуском: 0.7 + 0.3 в плавающей точке
// чуть больше единицы.
const TOLERANCE = 1e-9

/** Первая ручка вне допустимого: доли от 0 до 1, запись и отложенная запись
    вместе не больше 1, счётчики от 0. */
export const invalidKnob = (
  traffic: TrafficProfile,
): Option.Option<TrafficKnob> =>
  pipe(
    trafficKnobs,
    Array.findFirst(knob =>
      Array.contains(SHARE_KNOBS, knob)
        ? !isShare(traffic[knob])
        : !isCount(traffic[knob]),
    ),
    Option.orElse(() =>
      readShareOf(traffic) < -TOLERANCE
        ? Option.some<TrafficKnob>('deferredShare')
        : Option.none(),
    ),
  )

/** Ручки, которые отличаются от умолчаний, в порядке `trafficKnobs`. */
export const changedKnobs = (
  traffic: TrafficProfile,
): ReadonlyArray<Readonly<{ knob: TrafficKnob; value: number }>> =>
  pipe(
    trafficKnobs,
    Array.filter(knob => traffic[knob] !== defaultTraffic[knob]),
    Array.map(knob => ({ knob, value: traffic[knob] })),
  )
