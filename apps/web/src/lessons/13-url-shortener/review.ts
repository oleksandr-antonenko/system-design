import { Array, Number, Option, pipe } from 'effect'

import { type BoardDoc, capacityOf, nodesOfKind } from '../../domain/board'
import { type ComponentKind, catalog } from '../../domain/catalog'
import { type SimResult, simulationRules } from '../../domain/simulate'

// Разбор схемы ученика на шаге «review»: одни и те же числа для всех языков.

export const budget = 4

/** Блоки ученика берут ёмкость из каталога. */
export const serverCapacity = catalog.server.capacity

export type Review = Readonly<{
  servers: number
  /** Сколько rps доходит до серверов. */
  serverLoad: number
  /** Сколько получит каждый оставшийся сервер, если один упадёт. */
  perServerAfterFailure: Option.Option<number>
  balancers: number
  caches: number
  replicas: number
  /** Сколько rps CDN отдаёт сам, не пуская к серверам. */
  edge: number
  /** Самый загруженный блок: он упрётся в потолок первым. */
  busiest: Option.Option<Readonly<{ id: string; utilization: number }>>
}>

const liveOfKind = (doc: BoardDoc, kind: ComponentKind) =>
  Array.filter(nodesOfKind(doc, kind), node => !doc.failed.includes(node.id))

const incomingOf = (sim: SimResult, id: string): number =>
  sim.nodes[id]?.incoming ?? 0

export const reviewOf = (sim: SimResult, doc: BoardDoc): Review => {
  const servers = liveOfKind(doc, 'server')
  const serverLoad = Number.sumAll(
    Array.map(servers, server => incomingOf(sim, server.id)),
  )
  const edge = Number.sumAll(
    Array.map(
      liveOfKind(doc, 'cdn'),
      cdn =>
        Math.min(incomingOf(sim, cdn.id), capacityOf(cdn)) *
        simulationRules.cdnStaticShare,
    ),
  )
  const busiest = pipe(
    doc.nodes,
    Array.filter(
      node =>
        globalThis.Number.isFinite(capacityOf(node)) &&
        !doc.failed.includes(node.id),
    ),
    Array.map(node => ({
      id: node.id,
      utilization: sim.nodes[node.id]?.utilization ?? 0,
    })),
    Array.reduce(
      Option.none<Readonly<{ id: string; utilization: number }>>(),
      (best, entry) =>
        Option.match(best, {
          onNone: () => Option.some(entry),
          onSome: current =>
            entry.utilization > current.utilization ? Option.some(entry) : best,
        }),
    ),
  )
  return {
    servers: servers.length,
    serverLoad,
    perServerAfterFailure:
      servers.length > 1
        ? Option.some(serverLoad / (servers.length - 1))
        : Option.none(),
    balancers: liveOfKind(doc, 'lb').length,
    caches: liveOfKind(doc, 'cache').length,
    replicas: liveOfKind(doc, 'replica').length,
    edge,
    busiest,
  }
}
