import { Array, Option, pipe } from 'effect'

import {
  type BoardDoc,
  BoardOp,
  emptyBoard,
  findNode,
  foldOps,
} from '../domain/board'
import type { ComponentKind, Region } from '../domain/catalog'
import type { Goal } from '../domain/goals'
import type { SimResult } from '../domain/simulate'

// STAGE

export type Tone = 'ink' | 'info' | 'warn' | 'bad' | 'ok'

export type Target = string | Readonly<{ kind: ComponentKind }>

export type Highlight = Readonly<{
  _tag: 'Highlight'
  target: Target
  tone: Tone
}>

export type Annotate<Key extends string = string> = Readonly<{
  _tag: 'Annotate'
  target: Target
  key: Key
  tone: Tone | ((sim: SimResult) => Tone)
}>

export type StageItem = Highlight | Annotate

export const highlight = (target: Target, tone: Tone): Highlight => ({
  _tag: 'Highlight',
  target,
  tone,
})

export const annotate = <const Key extends string>(
  target: Target,
  key: Key,
  tone: Tone | ((sim: SimResult) => Tone),
): Annotate<Key> => ({ _tag: 'Annotate', target, key, tone })

// OPERATIONS

export type NodeOptions = Readonly<{
  /** Блок задачи нельзя удалить. По умолчанию `true`; решение задачи
      добавляет блоки с `locked: false`. */
  locked?: boolean
  /** Своя ёмкость в rps вместо каталожной, например лимит ограничителя. */
  capacity?: number
  /** Регион блока: доска рисует под блоками региона подписанную зону. */
  region?: Region
}>

export const addNode = (
  id: string,
  kind: ComponentKind,
  x: number,
  y: number,
  options: NodeOptions = {},
): BoardOp =>
  BoardOp.AddNode({
    id,
    kind,
    x,
    y,
    locked: options.locked ?? true,
    maybeCapacity: Option.fromNullishOr(options.capacity),
    maybeRegion: Option.fromNullishOr(options.region),
  })

export const connect = (from: string, to: string): BoardOp =>
  BoardOp.Connect({ from, to })

export const disconnect = (from: string, to: string): BoardOp =>
  BoardOp.Disconnect({ from, to })

export const setLoad = (rps: number): BoardOp => BoardOp.SetLoad({ rps })

export const failNode = (id: string): BoardOp => BoardOp.FailNode({ id })

export const recoverNode = (id: string): BoardOp => BoardOp.RecoverNode({ id })

/** Роняет все блоки региона, кроме пользователей. */
export const failRegion = (region: Region): BoardOp =>
  BoardOp.FailRegion({ region })

export const recoverRegion = (region: Region): BoardOp =>
  BoardOp.RecoverRegion({ region })

// LESSON

export type TaskGoal<GoalId extends string = string> = Readonly<{
  id: GoalId
  goal: Goal
}>

export type TaskSpec<
  TaskId extends string = string,
  GoalId extends string = string,
> = Readonly<{
  id: TaskId
  palette: ReadonlyArray<ComponentKind>
  goals: ReadonlyArray<TaskGoal<GoalId>>
  solution: ReadonlyArray<BoardOp>
}>

export type LessonStep = Readonly<{
  id: string
  ops: ReadonlyArray<BoardOp>
  stage: ReadonlyArray<StageItem>
  task?: TaskSpec
}>

export type LessonDefinition = Readonly<{
  slug: string
  steps: Array.NonEmptyReadonlyArray<LessonStep>
}>

export const defineLesson = <const Lesson extends LessonDefinition>(
  lesson: Lesson,
): Lesson => lesson

// TEXTS

export type StepContext = Readonly<{ sim: SimResult; doc: BoardDoc }>

export type Prose = string | ((context: StepContext) => string)

type StepOf<Lesson extends LessonDefinition> = Lesson['steps'][number]
// Шаги без задачи не имеют поля `task`, поэтому индексировать объединение
// шагов по `task` нельзя: тип схлопнется в ошибку и проверка текстов задач
// молча отключится. Условный тип перебирает шаги по одному.
type TaskOf<Lesson extends LessonDefinition> =
  StepOf<Lesson> extends infer LessonStepOf
    ? LessonStepOf extends Readonly<{ task: infer Task extends TaskSpec }>
      ? Task
      : never
    : never
type AnnotationKeyOf<Lesson extends LessonDefinition> = Extract<
  StepOf<Lesson>['stage'][number],
  { _tag: 'Annotate' }
>['key']

export type TaskTexts<GoalId extends string> = Readonly<{
  prompt: string
  goals: Readonly<Record<GoalId, string>>
  hints: readonly [string, string, string]
  solvedNote: string
}>

export type LessonTexts<Lesson extends LessonDefinition> = Readonly<{
  title: string
  summary: string
  steps: Readonly<
    Record<StepOf<Lesson>['id'], Readonly<{ title: string; body: Prose }>>
  >
  annotations: Readonly<
    Record<AnnotationKeyOf<Lesson>, (sim: SimResult) => string>
  >
  tasks: Readonly<{
    [Task in TaskOf<Lesson> as Task['id']]: TaskTexts<
      Task['goals'][number]['id']
    >
  }>
}>

export type LooseLessonTexts = Readonly<{
  title: string
  summary: string
  steps?: Readonly<Record<string, Readonly<{ title: string; body: Prose }>>>
  annotations?: Readonly<Record<string, (sim: SimResult) => string>>
  tasks?: Readonly<Record<string, TaskTexts<string>>>
}>

// FOLDING

export const taskOf = (step: LessonStep): Option.Option<TaskSpec> =>
  Option.fromNullishOr(step.task)

export type TaskLogs = Readonly<Record<string, ReadonlyArray<BoardOp>>>

export const stepOps = (
  step: LessonStep,
  logs: TaskLogs,
): ReadonlyArray<BoardOp> =>
  Option.match(taskOf(step), {
    onNone: () => step.ops,
    onSome: task => [...step.ops, ...(logs[task.id] ?? [])],
  })

export const boardAt = (
  lesson: LessonDefinition,
  step: number,
  logs: TaskLogs,
): BoardDoc =>
  Array.reduce(
    Array.take(lesson.steps, step + 1),
    emptyBoard,
    (doc, lessonStep) => foldOps(doc, stepOps(lessonStep, logs)),
  )

export const taskStartBoard = (
  lesson: LessonDefinition,
  step: number,
  logs: TaskLogs,
): BoardDoc =>
  foldOps(
    boardAt(lesson, step - 1, logs),
    Option.match(Array.get(lesson.steps, step), {
      onNone: () => [],
      onSome: lessonStep => lessonStep.ops,
    }),
  )

export const resolveTarget = (
  doc: BoardDoc,
  target: Target,
): Option.Option<string> =>
  typeof target === 'string'
    ? Option.map(findNode(doc, target), node => node.id)
    : pipe(
        Array.findFirst(doc.nodes, node => node.kind === target.kind),
        Option.map(node => node.id),
      )

export const taskSteps = (lesson: LessonDefinition): ReadonlyArray<number> =>
  Array.getSomes(
    Array.map(lesson.steps, (lessonStep, index) =>
      Option.map(taskOf(lessonStep), () => index),
    ),
  )
