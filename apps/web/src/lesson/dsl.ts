import { Array, Option, Result } from 'effect'

import type { BoardKindId } from '../courses/model'
import type { BoardKind, EntityLabel, KindTypes } from '../kinds/contract'
import type { KindTypesById } from '../kinds/types'
import type { LooseQuizTexts, QuizKind, QuizSpec, QuizTexts } from './quiz'

// Урок — сценарий шагов на доске своего вида (design D1, D3). Тип урока
// выводится из вида: операции, цели, сцена и тексты-функции у `flow` и
// `packet` разные, а плеер и тесты контента работают с любым видом.

// LESSON

export type TaskGoal<Goal, GoalId extends string = string> = Readonly<{
  id: GoalId
  goal: Goal
}>

export type TaskSpec<
  T extends KindTypes,
  TaskId extends string = string,
  GoalId extends string = string,
> = Readonly<{
  id: TaskId
  palette: ReadonlyArray<T['Palette']>
  goals: ReadonlyArray<TaskGoal<T['Goal'], GoalId>>
  solution: ReadonlyArray<T['Op']>
  /** Где ученик решает задачу: `'board'` и поверхности вида, например
      `'wifi:phone'`, `'terminal:laptop'`. По умолчанию только доска. */
  surfaces?: ReadonlyArray<T['Surface']>
}>

export type LessonStep<T extends KindTypes> = Readonly<{
  id: string
  ops: ReadonlyArray<T['Op']>
  stage: ReadonlyArray<T['Stage']>
  /** Задача или квиз: шаг держит «Далее», пока задача не решена или на
      вопрос не ответили. Одновременно их быть не может. */
  task?: TaskSpec<T>
  quiz?: QuizSpec<T>
}>

export type LessonDefinition<T extends KindTypes> = Readonly<{
  board: T['Id']
  kind: BoardKind<T>
  slug: string
  steps: Array.NonEmptyReadonlyArray<LessonStep<T>>
  /** Сущности доски, которым тексты урока дают подписи (`labels`). */
  labels: ReadonlyArray<string>
}>

/** Урок любого вида доски. */
export type AnyLesson = {
  readonly [Id in BoardKindId]: LessonDefinition<KindTypesById[Id]>
}[BoardKindId]

/** Урок, тип которого сохранил литералы id шагов, задач, целей и подписей:
    по нему `LessonTexts` проверяет полноту текстов. */
export type DefinedLesson<
  T extends KindTypes,
  Steps extends Array.NonEmptyReadonlyArray<LessonStep<T>>,
  Label extends string,
> = Readonly<{
  board: T['Id']
  kind: BoardKind<T>
  slug: string
  steps: Steps
  labels: ReadonlyArray<Label>
}>

/** `defineLesson(flow, { slug, steps })`: вид доски — первым аргументом. */
export const defineLesson = <
  T extends KindTypes,
  const Steps extends Array.NonEmptyReadonlyArray<LessonStep<T>>,
  const Labels extends ReadonlyArray<string> = readonly [],
>(
  kind: BoardKind<T>,
  lesson: Readonly<{ slug: string; steps: Steps; labels?: Labels }>,
): DefinedLesson<T, Steps, Labels[number]> => ({
  board: kind.id,
  kind,
  slug: lesson.slug,
  steps: lesson.steps,
  labels: lesson.labels ?? [],
})

export type LessonRunner<R> = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
) => R

/** Запускает код, общий для всех видов, с уроком его собственного вида. */
export const withLesson = <R>(lesson: AnyLesson, run: LessonRunner<R>): R =>
  lesson.board === 'flow' ? run(lesson) : run(lesson)

// TEXTS

export type Prose<Context> = string | ((context: Context) => string)

/** Сворачиваемый блок «Подробнее» шага: свёрнут, пока его не открыли. */
export type MoreTexts = Readonly<{ title: string; body: string }>

export type StepTexts<Context> = Readonly<{
  title: string
  body: Prose<Context>
  more?: MoreTexts
}>

/** «Как спросить ИИ» на шаге-итоге: пояснение, шаблон с кнопкой
    «Скопировать» и необязательная заметка. */
export type AskAiTexts = Readonly<{
  lead: string
  template: string
  note?: string
}>

export type TaskTexts<GoalId extends string> = Readonly<{
  prompt: string
  goals: Readonly<Record<GoalId, string>>
  hints: readonly [string, string, string]
  solvedNote: string
}>

/** Свой текст урока вместо общего текста кода сообщения: в задаче урока
    типичная ошибка объясняется его словами. */
export type FeedbackTexts<Message extends Readonly<{ _tag: string }>> = {
  readonly [Tag in Message['_tag']]?:
    | string
    | ((message: Extract<Message, Readonly<{ _tag: Tag }>>) => string)
}

type LessonShape = Readonly<{
  board: BoardKindId
  steps: ReadonlyArray<
    Readonly<{ id: string; stage: ReadonlyArray<Readonly<{ _tag: string }>> }>
  >
  labels: ReadonlyArray<string>
}>

type TypesOf<Lesson extends LessonShape> = KindTypesById[Lesson['board']]

type StepOf<Lesson extends LessonShape> = Lesson['steps'][number]

type TaskShape = Readonly<{
  id: string
  goals: ReadonlyArray<Readonly<{ id: string }>>
}>

// Шаги без задачи не имеют поля `task`, поэтому индексировать объединение
// шагов по `task` нельзя: тип схлопнется в ошибку и проверка текстов задач
// молча отключится. Условный тип перебирает шаги по одному.
type TaskOf<Lesson extends LessonShape> =
  StepOf<Lesson> extends infer LessonStepOf
    ? LessonStepOf extends Readonly<{ task: infer Task extends TaskShape }>
      ? Task
      : never
    : never

type QuizShape = Readonly<{
  id: string
  kind: QuizKind
  candidates: ReadonlyArray<string>
}>

type QuizOf<Lesson extends LessonShape> =
  StepOf<Lesson> extends infer LessonStepOf
    ? LessonStepOf extends Readonly<{ quiz: infer Quiz extends QuizShape }>
      ? Quiz
      : never
    : never

type AnnotationKeyOf<Lesson extends LessonShape> = Extract<
  StepOf<Lesson>['stage'][number],
  Readonly<{ _tag: 'Annotate'; key: string }>
>['key']

type LabelTexts<Label extends string> = [Label] extends [never]
  ? Readonly<{ labels?: never }>
  : Readonly<{ labels: Readonly<Record<Label, EntityLabel>> }>

type QuizSection<Quiz extends QuizShape> = [Quiz] extends [never]
  ? Readonly<{ quizzes?: never }>
  : Readonly<{
      quizzes: Readonly<{
        [Each in Quiz as Each['id']]: QuizTexts<
          Each['candidates'][number],
          Each['kind']
        >
      }>
    }>

/** Тексты урока на одном языке: `text.<язык>.ts` с
    `satisfies LessonTexts<typeof lesson>`. Пропущенный ключ не компилируется. */
export type LessonTexts<Lesson extends LessonShape> = Readonly<{
  title: string
  summary: string
  steps: Readonly<
    Record<StepOf<Lesson>['id'], StepTexts<TypesOf<Lesson>['Prose']>>
  >
  annotations: Readonly<
    Record<
      AnnotationKeyOf<Lesson>,
      (input: TypesOf<Lesson>['Annotation']) => string
    >
  >
  tasks: Readonly<{
    [Task in TaskOf<Lesson> as Task['id']]: TaskTexts<
      Task['goals'][number]['id']
    >
  }>
  feedback?: FeedbackTexts<TypesOf<Lesson>['Message']>
  askAi?: AskAiTexts
}> &
  LabelTexts<Lesson['labels'][number]> &
  QuizSection<QuizOf<Lesson>>

/** Тексты урока без проверки ключей. Так их видит реестр: функции-тексты
    принимают что угодно, плеер зовёт их с данными вида урока. */
export type LooseLessonTexts<
  Context = unknown,
  Annotation = unknown,
  Message = unknown,
> = Readonly<{
  title: string
  summary: string
  steps?: Readonly<Record<string, StepTexts<Context>>>
  annotations?: Readonly<Record<string, (input: Annotation) => string>>
  tasks?: Readonly<Record<string, TaskTexts<string>>>
  quizzes?: Readonly<Record<string, LooseQuizTexts>>
  labels?: Readonly<Record<string, EntityLabel>>
  feedback?: Readonly<Record<string, string | ((message: Message) => string)>>
  askAi?: AskAiTexts
}>

export type TextsOf<T extends KindTypes> = LooseLessonTexts<
  T['Prose'],
  T['Annotation'],
  T['Message']
>

// FOLDING

export const taskOf = <T extends KindTypes>(
  step: LessonStep<T>,
): Option.Option<TaskSpec<T>> => Option.fromNullishOr(step.task)

export type TaskLogs<Op> = Readonly<Record<string, ReadonlyArray<Op>>>

export const stepOps = <T extends KindTypes>(
  step: LessonStep<T>,
  logs: TaskLogs<T['Op']>,
): ReadonlyArray<T['Op']> =>
  Option.match(taskOf(step), {
    onNone: () => step.ops,
    onSome: task => [...step.ops, ...(logs[task.id] ?? [])],
  })

/** Свёртка операций: отказанная операция пропускается. */
export const foldDoc = <T extends KindTypes>(
  kind: BoardKind<T>,
  doc: T['Doc'],
  ops: ReadonlyArray<T['Op']>,
): T['Doc'] =>
  Array.reduce(ops, doc, (current, op) =>
    Result.getOrElse(kind.apply(current, op), () => current),
  )

export const boardAt = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  step: number,
  logs: TaskLogs<T['Op']>,
): T['Doc'] =>
  Array.reduce(
    Array.take(lesson.steps, step + 1),
    lesson.kind.empty,
    (doc, lessonStep) => foldDoc(lesson.kind, doc, stepOps(lessonStep, logs)),
  )

export const taskStartBoard = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  step: number,
  logs: TaskLogs<T['Op']>,
): T['Doc'] =>
  foldDoc(
    lesson.kind,
    boardAt(lesson, step - 1, logs),
    Option.match(Array.get(lesson.steps, step), {
      onNone: () => [],
      onSome: lessonStep => lessonStep.ops,
    }),
  )

export const taskSteps = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
): ReadonlyArray<number> =>
  Array.getSomes(
    Array.map(lesson.steps, (lessonStep, index) =>
      Option.map(taskOf(lessonStep), () => index),
    ),
  )

/** Поверхности задачи: доска всегда первой. */
export const taskSurfaces = <T extends KindTypes>(
  task: TaskSpec<T>,
): ReadonlyArray<string> => Array.dedupe(['board', ...(task.surfaces ?? [])])

/** Все виды из палитр задач урока, в порядке палитр. */
export const lessonPalette = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
): ReadonlyArray<T['Palette']> =>
  Array.dedupe(
    Array.flatMap(lesson.steps, lessonStep =>
      Option.match(taskOf(lessonStep), {
        onNone: () => [],
        onSome: task => task.palette,
      }),
    ),
  )
