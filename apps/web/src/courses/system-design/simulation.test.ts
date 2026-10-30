import { Array, Option, Record } from 'effect'
import { describe, expect, test } from 'vitest'

import type { BoardDoc } from '../../domain/board'
import { checkGoal } from '../../domain/goals'
import { type SimResult, simulate } from '../../domain/simulate'
import type { FlowTypes } from '../../kinds/types'
import {
  type LessonDefinition,
  type TaskLogs,
  type TextsOf,
  boardAt,
  foldDoc,
  taskOf,
  taskStartBoard,
} from '../../lesson/dsl'
import { findLesson, lessonDefinitions } from '../registry'

// Снимки симулятора по урокам курса: метрики доски каждого шага, доски задачи
// до и после эталона, итоги целей и числа в текстах на всех языках. Движок
// растёт новыми операциями и полями; снимки доказывают, что уроки, которые
// их не используют, считаются ровно как раньше.

const COURSE = 'system-design'

type FlowLesson = LessonDefinition<FlowTypes>

const flowLessons: ReadonlyArray<FlowLesson> = Array.getSomes(
  Array.map(lessonDefinitions, ({ course, definition }) =>
    course === COURSE && definition.board === 'flow'
      ? Option.some(definition)
      : Option.none(),
  ),
)

const round = (value: number): number =>
  Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : value

const plain = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value), (_key, field: unknown) =>
    typeof field === 'number' ? round(field) : field,
  )

const metrics = (sim: SimResult) => ({
  load: round(sim.load),
  errorRate: round(sim.errorRate),
  p95: Option.match(sim.p95, { onNone: () => null, onSome: round }),
  databaseLoad: round(sim.databaseLoad),
  costPerHour: round(sim.costPerHour),
  rejected: round(sim.rejected),
  backlog: round(sim.backlog),
  nodes: Record.map(sim.nodes, node => ({
    incoming: round(node.incoming),
    served: round(node.served),
    dropped: round(node.dropped),
    rejected: round(node.rejected),
    backlog: round(node.backlog),
    utilization: round(node.utilization),
    isDown: node.isDown,
  })),
  edges: Record.map(sim.edges, round),
})

const solutionLogs = (lesson: FlowLesson): TaskLogs<FlowTypes['Op']> =>
  Record.fromEntries(
    Array.getSomes(
      Array.map(lesson.steps, lessonStep =>
        Option.map(
          taskOf(lessonStep),
          (task): readonly [string, ReadonlyArray<FlowTypes['Op']>] => [
            task.id,
            task.solution,
          ],
        ),
      ),
    ),
  )

const textsOf = (
  lesson: FlowLesson,
): ReadonlyArray<readonly [string, TextsOf<FlowTypes>]> =>
  Option.match(findLesson(COURSE, lesson.slug), {
    onNone: () => [],
    onSome: found =>
      Array.map(found.texts, (entry): readonly [string, TextsOf<FlowTypes>] => [
        entry.locale,
        entry.text,
      ]),
  })

const numbersIn = (text: string): string =>
  (text.match(/\d[\d.,   ]*\d|\d/g) ?? []).join(' | ')

const textNumbers = (
  lesson: FlowLesson,
  stepId: string,
  stage: FlowLesson['steps'][number]['stage'],
  doc: BoardDoc,
) => {
  const sim = simulate(doc, doc.load)
  return Record.fromEntries(
    Array.map(textsOf(lesson), ([locale, texts]) => {
      const body = texts.steps?.[stepId]?.body ?? ''
      const prose = typeof body === 'string' ? body : body({ sim, doc })
      const annotations = Array.getSomes(
        Array.map(stage, item =>
          item._tag === 'Annotate'
            ? Option.fromNullishOr(texts.annotations?.[item.key]?.(sim))
            : Option.none(),
        ),
      )
      return [locale, numbersIn([prose, ...annotations].join('\n'))] as const
    }),
  )
}

const goalLoads = (goals: ReadonlyArray<FlowTypes['Goal']>) =>
  Array.dedupe(
    Array.getSomes(
      Array.map(goals, goal =>
        'load' in goal ? Option.some(goal.load) : Option.none(),
      ),
    ),
  )

const lessonSnapshot = (lesson: FlowLesson) => {
  const logs = solutionLogs(lesson)
  return Array.map(lesson.steps, (lessonStep, index) => {
    const maybeTask = taskOf(lessonStep)
    const shown = Option.match(maybeTask, {
      onNone: () => boardAt(lesson, index, logs),
      onSome: () => taskStartBoard(lesson, index, logs),
    })
    return {
      step: lessonStep.id,
      sim: metrics(simulate(shown, shown.load)),
      texts: textNumbers(lesson, lessonStep.id, lessonStep.stage, shown),
      ...Option.match(maybeTask, {
        onNone: () => ({}),
        onSome: task => {
          const solved = foldDoc(lesson.kind, shown, task.solution)
          const goalsOn = (doc: BoardDoc) =>
            Array.map(task.goals, ({ id, goal }) => ({
              id,
              check: plain(checkGoal(doc, goal)),
            }))
          return {
            task: {
              start: goalsOn(shown),
              solved: goalsOn(solved),
              solvedSim: metrics(simulate(solved, solved.load)),
              solvedAtGoalLoads: Array.map(
                goalLoads(Array.map(task.goals, ({ goal }) => goal)),
                load => metrics(simulate(solved, load)),
              ),
            },
          }
        },
      }),
    }
  })
}

describe('simulator snapshots of the System Design lessons', () => {
  test('every lesson of the course is covered', () => {
    expect(flowLessons.length).toBeGreaterThanOrEqual(13)
  })

  test.each(Array.map(flowLessons, lesson => [lesson.slug, lesson] as const))(
    '%s',
    (_slug, lesson) => {
      expect(lessonSnapshot(lesson)).toMatchSnapshot()
    },
  )
})
