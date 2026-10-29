import { Array, Option, Record, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { type BoardDoc, type BoardOp, applyOp, foldOps } from '../domain/board'
import { checkGoal } from '../domain/goals'
import { simulate } from '../domain/simulate'
import {
  type LessonDefinition,
  type LooseLessonTexts,
  type TaskLogs,
  boardAt,
  resolveTarget,
  taskOf,
  taskStartBoard,
} from '../lesson/dsl'
import { referencedIds } from '../lesson/markup'
import { findLesson, lessonDefinitions } from './registry'

// Тесты контента (design D10): каждый урок с lesson.ts проверяется здесь
// без отдельного кода. Сообщение об ошибке называет урок, шаг и язык.

const solutionLogs = (lesson: LessonDefinition): TaskLogs =>
  Record.fromEntries(
    Array.getSomes(
      Array.map(lesson.steps, lessonStep =>
        Option.map(
          taskOf(lessonStep),
          (task): readonly [string, ReadonlyArray<BoardOp>] => [
            task.id,
            task.solution,
          ],
        ),
      ),
    ),
  )

const shownBoard = (lesson: LessonDefinition, index: number): BoardDoc =>
  Option.match(Option.flatMap(Array.get(lesson.steps, index), taskOf), {
    onNone: () => boardAt(lesson, index, solutionLogs(lesson)),
    onSome: () => taskStartBoard(lesson, index, solutionLogs(lesson)),
  })

const refusalsOf = (start: BoardDoc, ops: ReadonlyArray<BoardOp>) =>
  Array.reduce(
    ops,
    { doc: start, refusals: Array.empty<string>() },
    (state, op) =>
      Result.match(applyOp(state.doc, op), {
        onSuccess: doc => ({ doc, refusals: state.refusals }),
        onFailure: refusal => ({
          doc: state.doc,
          refusals: [...state.refusals, `${op._tag}: ${refusal._tag}`],
        }),
      }),
  ).refusals

const textsOf = (
  course: string,
  lesson: LessonDefinition,
): ReadonlyArray<readonly [string, LooseLessonTexts]> =>
  Option.match(findLesson(course, lesson.slug), {
    onNone: () => [],
    onSome: found =>
      Array.map(found.texts, (entry): readonly [string, LooseLessonTexts] => [
        entry.locale,
        entry.text,
      ]),
  })

const proseOf = (
  texts: LooseLessonTexts,
  stepId: string,
  doc: BoardDoc,
): string => {
  const body = texts.steps?.[stepId]?.body ?? ''
  return typeof body === 'string'
    ? body
    : body({ sim: simulate(doc, doc.load), doc })
}

const cases = Array.map(
  lessonDefinitions,
  ({ course, definition }): readonly [string, string, LessonDefinition] => [
    `${course}/${definition.slug}`,
    course,
    definition,
  ],
)

describe.each(cases)('lesson %s', (_name, course, lesson) => {
  test('has a course entry with texts', () => {
    expect(textsOf(course, lesson).length).toBeGreaterThan(0)
  })

  test('every authored operation applies without a refusal', () => {
    const logs = solutionLogs(lesson)
    lesson.steps.forEach((lessonStep, index) => {
      const before = boardAt(lesson, index - 1, logs)
      expect(
        refusalsOf(before, lessonStep.ops),
        `step ${lessonStep.id}`,
      ).toEqual([])
      Option.map(taskOf(lessonStep), task => {
        const start = foldOps(before, lessonStep.ops)
        expect(
          refusalsOf(start, task.solution),
          `solution of task ${task.id}`,
        ).toEqual([])
      })
    })
  })

  test('each task starts unsolved and its solution meets every goal', () => {
    lesson.steps.forEach((lessonStep, index) =>
      Option.map(taskOf(lessonStep), task => {
        const start = taskStartBoard(lesson, index, solutionLogs(lesson))
        const solved = foldOps(start, task.solution)
        const goals = Array.map(task.goals, ({ goal }) => goal)

        expect(
          goals.every(goal => checkGoal(start, goal).met),
          `task ${task.id} is already solved at its start`,
        ).toBe(false)
        task.goals.forEach(({ id, goal }) => {
          expect(checkGoal(solved, goal).met, `goal ${task.id}.${id}`).toBe(
            true,
          )
        })
      }),
    )
  })

  test('highlights and annotations point at blocks on their board', () => {
    lesson.steps.forEach((lessonStep, index) => {
      const doc = shownBoard(lesson, index)
      lessonStep.stage.forEach(item => {
        expect(
          Option.isSome(resolveTarget(doc, item.target)),
          `step ${lessonStep.id}: ${JSON.stringify(item.target)}`,
        ).toBe(true)
      })
    })
  })

  test.each(textsOf(course, lesson))(
    '%s: references point at blocks on their board',
    (_locale, texts) => {
      lesson.steps.forEach((lessonStep, index) => {
        const doc = shownBoard(lesson, index)
        referencedIds(proseOf(texts, lessonStep.id, doc)).forEach(id => {
          expect(
            Option.isSome(resolveTarget(doc, id)),
            `step ${lessonStep.id}: [[${id}|…]]`,
          ).toBe(true)
        })
      })
    },
  )

  test.each(textsOf(course, lesson))(
    '%s: every text is filled in',
    (_locale, texts) => {
      const filled = (value: string | undefined, where: string) =>
        expect(value?.trim() ?? '', where).not.toBe('')

      filled(texts.title, 'title')
      filled(texts.summary, 'summary')
      lesson.steps.forEach((lessonStep, index) => {
        const doc = shownBoard(lesson, index)
        filled(texts.steps?.[lessonStep.id]?.title, `${lessonStep.id}.title`)
        filled(proseOf(texts, lessonStep.id, doc), `${lessonStep.id}.body`)
        lessonStep.stage.forEach(item => {
          if (item._tag === 'Annotate') {
            filled(
              texts.annotations?.[item.key]?.(simulate(doc, doc.load)),
              `annotation ${item.key}`,
            )
          }
        })
        Option.map(taskOf(lessonStep), task => {
          const taskTexts = texts.tasks?.[task.id]
          filled(taskTexts?.prompt, `${task.id}.prompt`)
          filled(taskTexts?.solvedNote, `${task.id}.solvedNote`)
          task.goals.forEach(({ id }) =>
            filled(taskTexts?.goals[id], `${task.id}.goals.${id}`),
          )
          expect(taskTexts?.hints.length, `${task.id}.hints`).toBe(3)
          taskTexts?.hints.forEach((hint, hintIndex) =>
            filled(hint, `${task.id}.hints[${hintIndex}]`),
          )
        })
      })
    },
  )
})
