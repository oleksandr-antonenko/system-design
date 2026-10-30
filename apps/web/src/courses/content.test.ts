import { Array, Option, Record, Result } from 'effect'
import { inertHtml as ih } from 'foldkit/html'
import { describe, expect, test } from 'vitest'

import { uiFor } from '../i18n/ui'
import type { KindTypes } from '../kinds/contract'
import {
  type AnyLesson,
  type LessonDefinition,
  type TaskLogs,
  type TextsOf,
  boardAt,
  foldDoc,
  taskOf,
  taskStartBoard,
  taskSurfaces,
  withLesson,
} from '../lesson/dsl'
import { referencedIds } from '../lesson/markup'
import { surfaceOf } from '../lesson/player'
import { isBoardQuiz, quizAnswer, quizFeature, quizOf } from '../lesson/quiz'
import {
  findCourse,
  findLesson,
  lessonDefinitions,
  unlockedFeatures,
} from './registry'
import { isSurfaceOpen } from './unlocks'

// Тесты контента (design D10 add-lesson-core, D7 extract-board-kind): каждый
// урок с lesson.ts проверяется здесь через контракт своего вида доски, без
// отдельного кода. Сообщение об ошибке называет урок, шаг и язык.

const solutionLogs = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
): TaskLogs<T['Op']> =>
  Record.fromEntries(
    Array.getSomes(
      Array.map(lesson.steps, lessonStep =>
        Option.map(
          taskOf(lessonStep),
          (task): readonly [string, ReadonlyArray<T['Op']>] => [
            task.id,
            task.solution,
          ],
        ),
      ),
    ),
  )

const shownBoard = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  index: number,
): T['Doc'] =>
  Option.match(Option.flatMap(Array.get(lesson.steps, index), taskOf), {
    onNone: () => boardAt(lesson, index, solutionLogs(lesson)),
    onSome: () => taskStartBoard(lesson, index, solutionLogs(lesson)),
  })

const refusalsOf = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  start: T['Doc'],
  ops: ReadonlyArray<T['Op']>,
) =>
  Array.reduce(
    ops,
    { doc: start, refusals: Array.empty<string>() },
    (state, op) =>
      Result.match(lesson.kind.apply(state.doc, op), {
        onSuccess: doc => ({ doc, refusals: state.refusals }),
        onFailure: refusal => ({
          doc: state.doc,
          refusals: [
            ...state.refusals,
            `${lesson.kind.describeOp(op)}: ${refusal._tag}`,
          ],
        }),
      }),
  ).refusals

const textsOf = <T extends KindTypes>(
  course: string,
  lesson: LessonDefinition<T>,
): ReadonlyArray<readonly [string, TextsOf<T>]> =>
  Option.match(findLesson(course, lesson.slug), {
    onNone: () => [],
    onSome: found =>
      Array.map(found.texts, (entry): readonly [string, TextsOf<T>] => [
        entry.locale,
        entry.text,
      ]),
  })

const proseOf = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  texts: TextsOf<T>,
  stepId: string,
  doc: T['Doc'],
): string => {
  const body = texts.steps?.[stepId]?.body ?? ''
  return typeof body === 'string'
    ? body
    : body(lesson.kind.proseContext(doc, lesson.kind.run(doc)))
}

const unlockedAt = (course: string, slug: string): ReadonlyArray<string> =>
  Option.match(Option.all([findCourse(course), findLesson(course, slug)]), {
    onNone: () => [],
    onSome: ([found, lesson]) =>
      unlockedFeatures(found.definition, lesson.meta.order),
  })

const lessonChecks = <T extends KindTypes>(
  course: string,
  lesson: LessonDefinition<T>,
) => {
  const kind = lesson.kind

  test('has a course entry with texts', () => {
    expect(textsOf(course, lesson).length).toBeGreaterThan(0)
  })

  test('uses the board kind of its course', () => {
    expect(
      Option.map(findCourse(course), found => found.definition.board),
    ).toEqual(Option.some(lesson.board))
  })

  test('every authored operation applies without a refusal', () => {
    const logs = solutionLogs(lesson)
    lesson.steps.forEach((lessonStep, index) => {
      const before = boardAt(lesson, index - 1, logs)
      expect(
        refusalsOf(lesson, before, lessonStep.ops),
        `step ${lessonStep.id}`,
      ).toEqual([])
      Option.map(taskOf(lessonStep), task => {
        const start = foldDoc(kind, before, lessonStep.ops)
        expect(
          refusalsOf(lesson, start, task.solution),
          `solution of task ${task.id}`,
        ).toEqual([])
      })
    })
  })

  test('each task starts unsolved and its solution meets every goal', () => {
    lesson.steps.forEach((lessonStep, index) =>
      Option.map(taskOf(lessonStep), task => {
        const start = taskStartBoard(lesson, index, solutionLogs(lesson))
        const solved = foldDoc(kind, start, task.solution)
        const startRun = kind.run(start)
        const solvedRun = kind.run(solved)

        expect(
          task.goals.every(
            ({ goal }) => kind.checkGoal(start, startRun, goal).met,
          ),
          `task ${task.id} is already solved at its start`,
        ).toBe(false)
        task.goals.forEach(({ id, goal }) => {
          expect(
            kind.checkGoal(solved, solvedRun, goal).met,
            `goal ${task.id}.${id}`,
          ).toBe(true)
        })
      }),
    )
  })

  test('task surfaces exist and are open by this lesson', () => {
    const unlocked = unlockedAt(course, lesson.slug)
    lesson.steps.forEach(lessonStep =>
      Option.map(taskOf(lessonStep), task =>
        Array.filter(taskSurfaces(task), id => id !== 'board').forEach(id => {
          const surface = surfaceOf(kind, id)
          expect(Option.isSome(surface), `surface ${id}`).toBe(true)
          Option.map(surface, ({ definition }) =>
            expect(
              isSurfaceOpen(unlocked, definition.feature),
              `surface ${id} is not unlocked by lesson ${lesson.slug}`,
            ).toBe(true),
          )
        }),
      ),
    )
  })

  test('quizzes: supported, open, answerable on the board of their step', () => {
    const unlocked = unlockedAt(course, lesson.slug)
    const features = Option.match(findCourse(course), {
      onNone: () => [],
      onSome: found => found.definition.features,
    })
    const ids = Array.getSomes(
      Array.map(lesson.steps, lessonStep =>
        Option.map(quizOf<T>(lessonStep), quiz => quiz.id),
      ),
    )
    expect(Array.dedupe(ids), 'quiz ids are unique').toEqual(ids)
    lesson.steps.forEach((lessonStep, index) =>
      Option.map(quizOf<T>(lessonStep), quiz => {
        const where = `step ${lessonStep.id}, quiz ${quiz.id}`
        const doc = shownBoard(lesson, index)
        const answer = quizAnswer(quiz, doc, kind.run(doc))
        expect(lessonStep.task, `${where} has a task too`).toBeUndefined()
        expect(
          quiz.kind === 'Choice' || Array.contains(kind.quizzes, quiz.kind),
          `${where}: board ${kind.id} has no ${quiz.kind}`,
        ).toBe(true)
        expect(quiz.candidates, `${where}: answer`).toContain(answer)
        expect(
          quiz.candidates.length >= 2 &&
            quiz.candidates.length <= (isBoardQuiz(quiz) ? 5 : 4),
          `${where}: ${quiz.candidates.length} candidates`,
        ).toBe(true)
        if (Array.contains(features, quizFeature(quiz.kind))) {
          expect(unlocked, `${where} is not unlocked`).toContain(
            quizFeature(quiz.kind),
          )
        }
        if (isBoardQuiz(quiz)) {
          quiz.candidates.forEach(candidate =>
            expect(
              Option.isSome(kind.resolveTarget(doc, candidate)),
              `${where}: candidate ${candidate} is not on the board`,
            ).toBe(true),
          )
        }
        Object.values(quiz.pictures ?? {}).forEach(key =>
          expect(
            Option.isSome(kind.picture(key ?? '', uiFor('en'), ih)),
            `${where}: picture ${key}`,
          ).toBe(true),
        )
      }),
    )
  })

  test('stage targets point at things on their board', () => {
    lesson.steps.forEach((lessonStep, index) => {
      const doc = shownBoard(lesson, index)
      lessonStep.stage.forEach(item => {
        kind.stage.targets(item).forEach(target => {
          expect(
            Option.isSome(kind.resolveTarget(doc, target)),
            `step ${lessonStep.id}: ${target}`,
          ).toBe(true)
        })
      })
    })
  })

  test('labelled entities appear on the board', () => {
    const docs = Array.map(lesson.steps, (_lessonStep, index) =>
      shownBoard(lesson, index),
    )
    lesson.labels.forEach(id => {
      expect(
        Array.some(docs, doc => Option.isSome(kind.resolveTarget(doc, id))),
        `label ${id}`,
      ).toBe(true)
    })
  })

  test.each(textsOf(course, lesson))(
    '%s: references point at things on their board',
    (_locale, texts) => {
      lesson.steps.forEach((lessonStep, index) => {
        const doc = shownBoard(lesson, index)
        referencedIds(proseOf(lesson, texts, lessonStep.id, doc)).forEach(
          id => {
            expect(
              Option.isSome(kind.resolveTarget(doc, id)),
              `step ${lessonStep.id}: [[${id}|…]]`,
            ).toBe(true)
          },
        )
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
      lesson.labels.forEach(id =>
        filled(texts.labels?.[id]?.name, `labels.${id}.name`),
      )
      lesson.steps.forEach((lessonStep, index) => {
        const doc = shownBoard(lesson, index)
        const run = kind.run(doc)
        filled(texts.steps?.[lessonStep.id]?.title, `${lessonStep.id}.title`)
        filled(
          proseOf(lesson, texts, lessonStep.id, doc),
          `${lessonStep.id}.body`,
        )
        lessonStep.stage.forEach(item =>
          Option.map(kind.stage.annotationKey(item), key =>
            filled(
              texts.annotations?.[key]?.(kind.annotationInput(doc, run)),
              `annotation ${key}`,
            ),
          ),
        )
        Option.map(
          Option.fromNullishOr(texts.steps?.[lessonStep.id]?.more),
          more => {
            filled(more.title, `${lessonStep.id}.more.title`)
            filled(more.body, `${lessonStep.id}.more.body`)
          },
        )
        Option.map(quizOf<T>(lessonStep), quiz => {
          const quizTexts = texts.quizzes?.[quiz.id]
          filled(quizTexts?.question, `${quiz.id}.question`)
          filled(quizTexts?.explain, `${quiz.id}.explain`)
          if (quiz.kind === 'Choice') {
            quiz.candidates.forEach(candidate =>
              filled(
                quizTexts?.options?.[candidate],
                `${quiz.id}.options.${candidate}`,
              ),
            )
          }
          const explained = [
            ...Object.keys(quizTexts?.wrong ?? {}),
            ...Object.keys(quizTexts?.tags ?? {}),
          ]
          explained.forEach(candidate =>
            expect(
              quiz.candidates,
              `${quiz.id}: text for ${candidate}`,
            ).toContain(candidate),
          )
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
}

/** «Подробнее» и «Как спросить ИИ» есть на одних и тех же местах во всех
    языках урока. */
const optionalSections = <T extends KindTypes>(texts: TextsOf<T>) => ({
  more: Array.filter(
    Object.keys(texts.steps ?? {}),
    id => texts.steps?.[id]?.more !== undefined,
  ),
  askAi: texts.askAi !== undefined,
})

const sectionChecks = <T extends KindTypes>(
  course: string,
  lesson: LessonDefinition<T>,
) => {
  test('optional sections appear in every language alike', () => {
    const sections = Array.map(textsOf(course, lesson), ([locale, texts]) => ({
      locale,
      ...optionalSections(texts),
    }))
    Array.head(sections).pipe(
      Option.map(first =>
        sections.forEach(other =>
          expect(
            { more: other.more, askAi: other.askAi },
            `${other.locale} vs ${first.locale}`,
          ).toEqual({ more: first.more, askAi: first.askAi }),
        ),
      ),
    )
    textsOf(course, lesson).forEach(([locale, texts]) =>
      Option.map(Option.fromNullishOr(texts.askAi), askAi => {
        expect(askAi.lead.trim(), `${locale} askAi.lead`).not.toBe('')
        expect(askAi.template.trim(), `${locale} askAi.template`).not.toBe('')
      }),
    )
  })
}

const cases = Array.map(
  lessonDefinitions,
  ({ course, definition }): readonly [string, string, AnyLesson] => [
    `${course}/${definition.slug}`,
    course,
    definition,
  ],
)

describe.each(cases)('lesson %s', (_name, course, lesson) => {
  withLesson(lesson, <T extends KindTypes>(script: LessonDefinition<T>) => {
    lessonChecks(course, script)
    sectionChecks(course, script)
  })
})
