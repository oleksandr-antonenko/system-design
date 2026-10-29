import { Schema } from 'effect'

export const ComponentKind = Schema.Literals(['client', 'lb', 'server', 'db'])
export type ComponentKind = typeof ComponentKind.Type

export type ComponentSpec = Readonly<{
  rank: number
  capacity: number
  costPerHour: number
  connectsTo: ReadonlyArray<ComponentKind>
}>

export const catalog: Readonly<Record<ComponentKind, ComponentSpec>> = {
  client: {
    rank: 0,
    capacity: Number.POSITIVE_INFINITY,
    costPerHour: 0,
    connectsTo: ['lb', 'server'],
  },
  lb: { rank: 1, capacity: 5000, costPerHour: 0.1, connectsTo: ['server'] },
  server: { rank: 2, capacity: 400, costPerHour: 0.4, connectsTo: ['db'] },
  db: { rank: 3, capacity: 1500, costPerHour: 1, connectsTo: [] },
}

export const hasFiniteCapacity = (kind: ComponentKind): boolean =>
  Number.isFinite(catalog[kind].capacity)

export const canConnect = (from: ComponentKind, to: ComponentKind): boolean =>
  catalog[from].connectsTo.includes(to)
