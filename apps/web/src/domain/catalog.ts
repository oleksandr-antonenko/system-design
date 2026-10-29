import { Array, Schema } from 'effect'

export const ComponentKind = Schema.Literals([
  'client',
  'cdn',
  'limiter',
  'lb',
  'server',
  'cache',
  'queue',
  'events',
  'worker',
  'db',
  'replica',
  'search',
])
export type ComponentKind = typeof ComponentKind.Type

export const componentKinds: ReadonlyArray<ComponentKind> =
  ComponentKind.literals

export const Region = Schema.Literals(['eu', 'us', 'asia'])
export type Region = typeof Region.Type

export const regions: ReadonlyArray<Region> = Region.literals

export type ComponentSpec = Readonly<{
  rank: number
  capacity: number
  costPerHour: number
  connectsTo: ReadonlyArray<ComponentKind>
}>

// Ранг задаёт порядок обработки потока: связь всегда идёт от меньшего ранга
// к большему (design D1).
export const catalog: Readonly<Record<ComponentKind, ComponentSpec>> = {
  client: {
    rank: 0,
    capacity: Number.POSITIVE_INFINITY,
    costPerHour: 0,
    connectsTo: ['cdn', 'limiter', 'lb', 'server'],
  },
  cdn: {
    rank: 1,
    capacity: 20000,
    costPerHour: 0.2,
    connectsTo: ['limiter', 'lb', 'server'],
  },
  limiter: {
    rank: 2,
    capacity: 1000,
    costPerHour: 0.05,
    connectsTo: ['lb', 'server'],
  },
  lb: { rank: 3, capacity: 5000, costPerHour: 0.1, connectsTo: ['server'] },
  server: {
    rank: 4,
    capacity: 400,
    costPerHour: 0.4,
    connectsTo: ['db', 'replica', 'cache', 'queue', 'events'],
  },
  cache: {
    rank: 5,
    capacity: 20000,
    costPerHour: 0.15,
    connectsTo: ['db', 'replica'],
  },
  queue: { rank: 5, capacity: 10000, costPerHour: 0.1, connectsTo: ['worker'] },
  events: {
    rank: 5,
    capacity: 10000,
    costPerHour: 0.15,
    connectsTo: ['worker', 'search'],
  },
  worker: { rank: 6, capacity: 200, costPerHour: 0.3, connectsTo: ['db'] },
  db: { rank: 7, capacity: 1500, costPerHour: 1, connectsTo: [] },
  replica: { rank: 7, capacity: 1500, costPerHour: 0.6, connectsTo: [] },
  search: { rank: 7, capacity: 1500, costPerHour: 0.5, connectsTo: [] },
}

export const hasFiniteCapacity = (kind: ComponentKind): boolean =>
  Number.isFinite(catalog[kind].capacity)

export const canConnect = (from: ComponentKind, to: ComponentKind): boolean =>
  catalog[from].connectsTo.includes(to)

/** База, реплика и поисковый индекс — конец потока: дальше они не шлют. */
export const isSink = (kind: ComponentKind): boolean =>
  Array.isReadonlyArrayEmpty(catalog[kind].connectsTo)
