import { Array, Number, Option, Schema, pipe } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { DomainMessage } from '../i18n/domainMessage'
import {
  type BoardDoc,
  BoardOp,
  edgeKey,
  foldOps,
  nodesOfKind,
  targetsOf,
} from './board'
import { ComponentKind, Region } from './catalog'
import { type SimResult, costOf, overloadedNodes, simulate } from './simulate'

export const Goal = defineTaggedUnion({
  HasKind: { kind: ComponentKind },
  FansOut: { from: ComponentKind, to: ComponentKind, min: Schema.Number },
  OnlyThrough: { from: ComponentKind, to: ComponentKind, via: ComponentKind },
  MaxErrorRate: { max: Schema.Number, load: Schema.Number },
  MaxP95: { max: Schema.Number, load: Schema.Number },
  /** Загрузка блоков вида не выше `max`; с `nodes` — только перечисленных. */
  MaxUtilization: {
    kind: ComponentKind,
    max: Schema.Number,
    load: Schema.Number,
    nodes: Schema.optionalKey(Schema.Array(Schema.String)),
  },
  /** Рост очередей не выше `max`; с `nodes` — только у перечисленных блоков. */
  MaxBacklog: {
    max: Schema.Number,
    load: Schema.Number,
    nodes: Schema.optionalKey(Schema.Array(Schema.String)),
  },
  /** Через блок `node` проходит не меньше `min` rps: пустой блок цель не
      выполняет. */
  Carries: { node: Schema.String, min: Schema.Number, load: Schema.Number },
  MaxCost: { max: Schema.Number },
  SurvivesFailure: {
    kinds: Schema.Array(ComponentKind),
    maxErrorRate: Schema.Number,
    load: Schema.Number,
  },
  SurvivesRegionFailure: {
    region: Region,
    maxErrorRate: Schema.Number,
    load: Schema.Number,
  },
})
export type Goal = typeof Goal.Type

export type GoalCheck = Readonly<{
  met: boolean
  maybeFailure: Option.Option<DomainMessage>
  focusNodes: ReadonlyArray<string>
  focusEdges: ReadonlyArray<string>
}>

const met: GoalCheck = {
  met: true,
  maybeFailure: Option.none(),
  focusNodes: [],
  focusEdges: [],
}

const failed = (
  failure: DomainMessage,
  focus: Partial<Pick<GoalCheck, 'focusNodes' | 'focusEdges'>> = {},
): GoalCheck => ({
  met: false,
  maybeFailure: Option.some(failure),
  focusNodes: focus.focusNodes ?? [],
  focusEdges: focus.focusEdges ?? [],
})

const kindOf = (doc: BoardDoc, id: string): Option.Option<ComponentKind> =>
  pipe(
    Array.findFirst(doc.nodes, node => node.id === id),
    Option.map(node => node.kind),
  )

const targetsOfKind = (
  doc: BoardDoc,
  id: string,
  kind: ComponentKind,
): ReadonlyArray<string> =>
  Array.filter(targetsOf(doc, id), target =>
    Option.exists(kindOf(doc, target), targetKind => targetKind === kind),
  )

/** Симуляционные цели проверяются прогоном нагрузки по кнопке «Проверить»
    и до проверки показываются пунктиром (D7). Цена считается вживую. */
export const isHiddenGoal = (goal: Goal): boolean =>
  Goal.match(goal, {
    HasKind: () => false,
    FansOut: () => false,
    OnlyThrough: () => false,
    MaxCost: () => false,
    MaxErrorRate: () => true,
    MaxP95: () => true,
    MaxUtilization: () => true,
    MaxBacklog: () => true,
    Carries: () => true,
    SurvivesFailure: () => true,
    SurvivesRegionFailure: () => true,
  })

// «Не выше порога»: допуск гасит погрешность сложения долей потока.
const TOLERANCE = 1e-9

const isWithin = (value: number, max: number): boolean =>
  value <= max + TOLERANCE

/** Блоки, к которым относится цель: все, если `nodes` не задан. */
const isListed =
  (nodes: ReadonlyArray<string> | undefined) =>
  (node: BoardDoc['nodes'][number]): boolean =>
    nodes === undefined || Array.contains(nodes, node.id)

const LATENCY_PATH: ReadonlyArray<ComponentKind> = [
  'cdn',
  'lb',
  'server',
  'cache',
  'db',
  'replica',
  'storage',
]

// Самый загруженный блок на пути запроса: его и подсвечивает медленный p95.
const hottestNode = (doc: BoardDoc, result: SimResult): ReadonlyArray<string> =>
  pipe(
    doc.nodes,
    Array.filter(node => Array.contains(LATENCY_PATH, node.kind)),
    Array.map(node => ({
      id: node.id,
      utilization: result.nodes[node.id]?.utilization ?? 0,
    })),
    Array.filter(({ utilization }) => utilization > 0),
    Array.reduce(
      Option.none<{ id: string; utilization: number }>(),
      (best, entry) =>
        Option.match(best, {
          onNone: () => Option.some(entry),
          onSome: current =>
            entry.utilization > current.utilization ? Option.some(entry) : best,
        }),
    ),
    Option.match({ onNone: () => [], onSome: ({ id }) => [id] }),
  )

const simulateWith = (
  doc: BoardDoc,
  ops: ReadonlyArray<BoardOp>,
  load: number,
): SimResult => simulate(foldOps(doc, ops), load)

export const checkGoal = (doc: BoardDoc, goal: Goal): GoalCheck =>
  Goal.match(goal, {
    HasKind: ({ kind }) =>
      Array.isReadonlyArrayNonEmpty(nodesOfKind(doc, kind))
        ? met
        : failed(DomainMessage.GoalMissingKind({ kind })),

    FansOut: ({ from, to, min }) => {
      const sources = nodesOfKind(doc, from)
      const best = Math.max(
        0,
        ...Array.map(
          sources,
          source => targetsOfKind(doc, source.id, to).length,
        ),
      )
      const fed = Array.flatMap(sources, source =>
        targetsOfKind(doc, source.id, to),
      )
      return best >= min
        ? met
        : failed(
            DomainMessage.GoalTooFewTargets({
              from,
              to,
              have: best,
              need: min,
            }),
            {
              focusNodes: pipe(
                nodesOfKind(doc, to),
                Array.filter(node => !Array.contains(fed, node.id)),
                Array.map(node => node.id),
              ),
            },
          )
    },

    OnlyThrough: ({ from, to, via }) => {
      const sources = nodesOfKind(doc, from)
      const directEdges = Array.flatMap(sources, source =>
        Array.map(targetsOfKind(doc, source.id, to), target => ({
          from: source.id,
          to: target,
        })),
      )
      if (Array.isReadonlyArrayNonEmpty(directEdges)) {
        return failed(
          DomainMessage.GoalDirectPath({
            from,
            via,
            targets: Array.dedupe(Array.map(directEdges, edge => edge.to)),
          }),
          { focusEdges: Array.map(directEdges, edgeKey) },
        )
      }
      const unconnected = Array.filter(sources, source =>
        Array.isReadonlyArrayEmpty(targetsOfKind(doc, source.id, via)),
      )
      return Array.isReadonlyArrayNonEmpty(unconnected)
        ? failed(DomainMessage.GoalNotConnected({ from, via }), {
            focusNodes: Array.map(unconnected, node => node.id),
          })
        : met
    },

    MaxErrorRate: ({ max, load }) => {
      const result = simulate(doc, load)
      const overloaded = overloadedNodes(result)
      return result.errorRate < max
        ? met
        : failed(
            DomainMessage.GoalTooManyErrors({
              load,
              errorRate: result.errorRate,
              overloaded,
            }),
            { focusNodes: overloaded },
          )
    },

    MaxP95: ({ max, load }) => {
      const result = simulate(doc, load)
      return Option.match(result.p95, {
        onNone: () => {
          const overloaded = overloadedNodes(result)
          return failed(
            DomainMessage.GoalTooManyErrors({
              load,
              errorRate: result.errorRate,
              overloaded,
            }),
            { focusNodes: overloaded },
          )
        },
        onSome: p95 => {
          const hottest = hottestNode(doc, result)
          return isWithin(p95, max)
            ? met
            : failed(
                DomainMessage.GoalSlowResponse({ load, p95, max, hottest }),
                { focusNodes: hottest },
              )
        },
      })
    },

    MaxUtilization: ({ kind, max, load, nodes }) => {
      const result = simulate(doc, load)
      const loaded = pipe(
        nodesOfKind(doc, kind),
        Array.filter(isListed(nodes)),
        Array.map(node => ({
          id: node.id,
          utilization: result.nodes[node.id]?.utilization ?? 0,
        })),
      )
      const over = Array.filter(
        loaded,
        ({ utilization }) => !isWithin(utilization, max),
      )
      return Array.isReadonlyArrayEmpty(over)
        ? met
        : failed(
            DomainMessage.GoalOverUtilized({
              kind,
              load,
              utilization: Math.max(
                ...Array.map(over, ({ utilization }) => utilization),
              ),
              max,
              nodes: Array.map(over, ({ id }) => id),
            }),
            { focusNodes: Array.map(over, ({ id }) => id) },
          )
    },

    MaxBacklog: ({ max, load, nodes }) => {
      const result = simulate(doc, load)
      const checked = Array.filter(doc.nodes, isListed(nodes))
      const backlogOf = (node: BoardDoc['nodes'][number]): number =>
        result.nodes[node.id]?.backlog ?? 0
      const backlog =
        nodes === undefined
          ? result.backlog
          : Number.sumAll(Array.map(checked, backlogOf))
      const growing = pipe(
        checked,
        Array.filter(node => backlogOf(node) >= 0.5),
        Array.map(node => node.id),
      )
      return isWithin(backlog, max)
        ? met
        : failed(
            DomainMessage.GoalBacklogGrowing({
              load,
              backlog,
              max,
              nodes: growing,
            }),
            { focusNodes: growing },
          )
    },

    Carries: ({ node, min, load }) => {
      const carried = simulate(doc, load).nodes[node]?.served ?? 0
      return carried >= min - TOLERANCE
        ? met
        : failed(DomainMessage.GoalNotCarrying({ node, load, carried, min }), {
            focusNodes: Option.isSome(kindOf(doc, node)) ? [node] : [],
          })
    },

    MaxCost: ({ max }) => {
      const cost = costOf(doc)
      return isWithin(cost, max)
        ? met
        : failed(DomainMessage.GoalTooExpensive({ cost, max }), {
            focusNodes: pipe(
              doc.nodes,
              Array.filter(node => !node.locked),
              Array.map(node => node.id),
            ),
          })
    },

    SurvivesFailure: ({ kinds, maxErrorRate, load }) =>
      pipe(
        doc.nodes,
        Array.filter(
          node =>
            Array.contains(kinds, node.kind) &&
            !Array.contains(doc.failed, node.id),
        ),
        Array.map(node => ({
          node,
          result: simulateWith(doc, [BoardOp.FailNode({ id: node.id })], load),
        })),
        Array.findFirst(
          ({ result }) => !isWithin(result.errorRate, maxErrorRate),
        ),
        Option.match({
          onNone: () => met,
          onSome: ({ node, result }) =>
            failed(
              DomainMessage.GoalFailureNotSurvived({
                id: node.id,
                kind: node.kind,
                load,
                errorRate: result.errorRate,
                max: maxErrorRate,
              }),
              { focusNodes: [node.id] },
            ),
        }),
      ),

    SurvivesRegionFailure: ({ region, maxErrorRate, load }) => {
      const result = simulateWith(doc, [BoardOp.FailRegion({ region })], load)
      const overloaded = overloadedNodes(result)
      return isWithin(result.errorRate, maxErrorRate)
        ? met
        : failed(
            DomainMessage.GoalRegionFailureNotSurvived({
              region,
              load,
              errorRate: result.errorRate,
              max: maxErrorRate,
              overloaded,
            }),
            { focusNodes: overloaded },
          )
    },
  })

export const firstFailedGoal = (
  doc: BoardDoc,
  goals: ReadonlyArray<Goal>,
): Option.Option<Readonly<{ index: number; check: GoalCheck }>> =>
  pipe(
    goals,
    Array.map((goal, index) => ({ index, check: checkGoal(doc, goal) })),
    Array.findFirst(({ check }) => !check.met),
  )

export const allGoalsMet = (
  doc: BoardDoc,
  goals: ReadonlyArray<Goal>,
): boolean => Option.isNone(firstFailedGoal(doc, goals))

export const countMet = (doc: BoardDoc, goals: ReadonlyArray<Goal>): number =>
  Number.sumAll(Array.map(goals, goal => (checkGoal(doc, goal).met ? 1 : 0)))
