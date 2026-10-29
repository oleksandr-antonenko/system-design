import { Array, Number, Option, Schema, pipe } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { DomainMessage } from '../i18n/domainMessage'
import { type BoardDoc, edgeKey, nodesOfKind, targetsOf } from './board'
import { ComponentKind } from './catalog'
import { overloadedNodes, simulate } from './simulate'

export const Goal = defineTaggedUnion({
  HasKind: { kind: ComponentKind },
  FansOut: { from: ComponentKind, to: ComponentKind, min: Schema.Number },
  OnlyThrough: { from: ComponentKind, to: ComponentKind, via: ComponentKind },
  MaxErrorRate: { max: Schema.Number, load: Schema.Number },
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

export const isHiddenGoal = (goal: Goal): boolean =>
  goal._tag === 'MaxErrorRate'

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
