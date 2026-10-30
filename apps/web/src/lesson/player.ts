import { Array, Effect, Option, Record, Result, Schema, pipe } from 'effect'
import { Command, Dom, Subscription, Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'

import {
  findCourse,
  findDefinition,
  findLesson,
  newFeatures as newFeaturesOf,
  unlockedFeatures,
} from '../courses/registry'
import { isSurfaceOpen } from '../courses/unlocks'
import * as KindBoard from '../kinds/board'
import type {
  BoardInput,
  BoardKind,
  BoardMode,
  BoardOutMessage,
  GoalCheck,
  KindTypes,
  SurfaceContext,
  SurfaceDefinition,
} from '../kinds/contract'
import {
  BoardMessage,
  BoardState,
  KindMessage,
  KindOp,
  SurfaceMessage,
  SurfaceState,
} from '../kinds/state'
import * as KindSurface from '../kinds/surface'
import {
  type AnyLesson,
  type LessonDefinition,
  type TaskLogs,
  type TaskSpec,
  boardAt,
  foldDoc,
  stepOps,
  taskOf,
  taskStartBoard,
  taskSurfaces,
  withLesson,
} from './dsl'
import {
  type QuizSpec,
  isBoardQuiz,
  isCorrectPick,
  isValidPick,
  quizAnswer,
  quizOf,
} from './quiz'

// Плеер урока (design D2): шаги, задача, журнал ходов, поверхности. Всё, что
// зависит от вида доски, он спрашивает у `lesson.kind`.

// MODEL

export const CheckState = defineTaggedUnion({
  Unchecked: {},
  Failed: {
    goalIndex: Schema.Number,
    failure: KindMessage,
    focusNodes: Schema.Array(Schema.String),
    focusEdges: Schema.Array(Schema.String),
  },
  Solved: { withHint: Schema.Boolean },
})
export type CheckState = typeof CheckState.Type

export const TaskState = Schema.Struct({
  log: Schema.Array(KindOp),
  redo: Schema.Array(KindOp),
  attempts: Schema.Number,
  hintsShown: Schema.Number,
  check: CheckState,
  maybeReplayIndex: Schema.Option(Schema.Number),
})
export type TaskState = typeof TaskState.Type

/** Ответ на квиз. Попытка одна, поэтому верный ответ — ответ с первой
    попытки (для прогресса). */
export const QuizAnswer = Schema.Struct({
  picked: Schema.String,
  isCorrect: Schema.Boolean,
})
export type QuizAnswer = typeof QuizAnswer.Type

export const Model = Schema.Struct({
  course: Schema.String,
  slug: Schema.String,
  step: Schema.Number,
  tasks: Schema.Record(Schema.String, TaskState),
  quizzes: Schema.Record(Schema.String, QuizAnswer),
  /** Шаги, у которых раскрыт блок «Подробнее». */
  openMore: Schema.Array(Schema.String),
  isAskAiCopied: Schema.Boolean,
  board: BoardState,
  /** Состояния поверхностей задач урока по id поверхности. */
  surfaces: Schema.Record(Schema.String, SurfaceState),
  maybeSurfaceTab: Schema.Option(Schema.String),
  isJournalOpen: Schema.Boolean,
  maybeToast: Schema.Option(KindMessage),
  toastSerial: Schema.Number,
  maybeHoveredRef: Schema.Option(Schema.String),
  isReducedMotion: Schema.Boolean,
  /** Узкий экран телефона: доска раскладывается сверху вниз. */
  isNarrow: Schema.Boolean,
})
export type Model = typeof Model.Type

// MESSAGE

export const Message = defineMessageUnion({
  ClickedNext: {},
  ClickedPrevious: {},
  ClickedStep: { step: Schema.Number },
  PressedArrowKey: { direction: Schema.Literals(['Left', 'Right']) },
  GotBoardMessage: { message: KindBoard.Message },
  GotSurfaceMessage: { surfaceId: Schema.String, message: KindSurface.Message },
  ClickedSurfaceTab: { surface: Schema.String },
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedReset: {},
  PressedUndoKey: {},
  PressedRedoKey: {},
  PressedDeleteKey: {},
  PressedEscapeKey: {},
  ClickedChoice: { candidate: Schema.String },
  ClickedMore: { stepId: Schema.String },
  ClickedCopyAskAi: { template: Schema.String },
  CompletedCopyAskAiTemplate: { isCopied: Schema.Boolean },
  ClickedCheck: {},
  ClickedHint: {},
  ClickedShowSolution: {},
  CompletedWaitBeforeReplayStep: {},
  CompletedWaitBeforeHidingToast: { serial: Schema.Number },
  CompletedScrollStepIntoView: {},
  ClickedJournalToggle: {},
  HoveredReference: { id: Schema.String },
  LeftReference: {},
  ChangedReducedMotion: { isReducedMotion: Schema.Boolean },
  ChangedNarrowScreen: { isNarrow: Schema.Boolean },
})
export type Message = typeof Message.Type

export const OutMessage = defineTaggedUnion({
  ChangedStep: { step: Schema.Number },
})
export type OutMessage = typeof OutMessage.Type

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>
type PlainReturn = Update.Return<Model, Message>

// COMMAND

const REPLAY_STEP_MS = 650
const TOAST_MS = 3200

export const WaitBeforeReplayStep = Command.define('WaitBeforeReplayStep', {
  messages: [Message.CompletedWaitBeforeReplayStep],
  execute: Effect.sleep(REPLAY_STEP_MS).pipe(
    Effect.as(Message.CompletedWaitBeforeReplayStep()),
  ),
})

export const WaitBeforeHidingToast = Command.define('WaitBeforeHidingToast', {
  args: { serial: Schema.Number },
  messages: [Message.CompletedWaitBeforeHidingToast],
  execute: ({ serial }) =>
    Effect.sleep(TOAST_MS).pipe(
      Effect.as(Message.CompletedWaitBeforeHidingToast({ serial })),
    ),
})

export const ScrollStepIntoView = Command.define('ScrollStepIntoView', {
  args: { step: Schema.Number },
  messages: [Message.CompletedScrollStepIntoView],
  execute: ({ step }) =>
    Dom.scrollIntoViewAfterPaint(`[data-step="${step}"]`, {
      block: 'nearest',
    }).pipe(
      Effect.as(Message.CompletedScrollStepIntoView()),
      Effect.catch(() => Effect.succeed(Message.CompletedScrollStepIntoView())),
    ),
})

export const CopyAskAiTemplate = Command.define('CopyAskAiTemplate', {
  args: { template: Schema.String },
  messages: [Message.CompletedCopyAskAiTemplate],
  execute: ({ template }) =>
    Effect.tryPromise(() => navigator.clipboard.writeText(template)).pipe(
      Effect.as(Message.CompletedCopyAskAiTemplate({ isCopied: true })),
      Effect.catch(() =>
        Effect.succeed(Message.CompletedCopyAskAiTemplate({ isCopied: false })),
      ),
    ),
})

// QUERIES

const emptyTask: TaskState = {
  log: [],
  redo: [],
  attempts: 0,
  hintsShown: 0,
  check: CheckState.Unchecked(),
  maybeReplayIndex: Option.none(),
}

export const taskStateOf = (model: Model, taskId: string): TaskState =>
  model.tasks[taskId] ?? emptyTask

/** Ходы задачи в типах вида доски. */
export const opsOf = <T extends KindTypes>(
  kind: BoardKind<T>,
  ops: ReadonlyArray<KindOp>,
): ReadonlyArray<T['Op']> => Array.getSomes(Array.map(ops, kind.op.unwrap))

const logsOf = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): TaskLogs<T['Op']> =>
  Record.map(model.tasks, task => opsOf(lesson.kind, task.log))

export const isSolved = (task: TaskState): boolean =>
  task.check._tag === 'Solved'

export const docAt = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  step: number,
): T['Doc'] => boardAt(lesson, step, logsOf(lesson, model))

export const currentDoc = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): T['Doc'] => docAt(lesson, model, model.step)

/** Доска шага задачи до ходов ученика: «было» в итоге задачи. */
export const taskStartDoc = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): T['Doc'] => taskStartBoard(lesson, model.step, logsOf(lesson, model))

export type CurrentTask<T extends KindTypes> = Readonly<{
  spec: TaskSpec<T>
  state: TaskState
  step: number
}>

export const currentTask = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): Option.Option<CurrentTask<T>> =>
  pipe(
    Array.get(lesson.steps, model.step),
    Option.flatMap(taskOf),
    Option.map(spec => ({
      spec,
      state: taskStateOf(model, spec.id),
      step: model.step,
    })),
  )

export const quizAnswerOf = (
  model: Model,
  quizId: string,
): Option.Option<QuizAnswer> => Record.get(model.quizzes, quizId)

export type CurrentQuiz<T extends KindTypes> = Readonly<{
  spec: QuizSpec<T>
  maybeAnswer: Option.Option<QuizAnswer>
}>

export const currentQuiz = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): Option.Option<CurrentQuiz<T>> =>
  pipe(
    Array.get(lesson.steps, model.step),
    Option.flatMap(lessonStep => quizOf<T>(lessonStep)),
    Option.map(spec => ({
      spec,
      maybeAnswer: quizAnswerOf(model, spec.id),
    })),
  )

/** Верный ответ квиза на доске текущего шага. */
export const correctAnswer = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  quiz: QuizSpec<T>,
): string => {
  const doc = currentDoc(lesson, model)
  return quizAnswer(quiz, doc, lesson.kind.run(doc))
}

/** Шаг держит «Далее»: задача не решена или на вопрос ещё не ответили. */
const isBlocking = <T extends KindTypes>(
  model: Model,
  lessonStep: LessonDefinition<T>['steps'][number],
): boolean =>
  Option.exists(
    taskOf(lessonStep),
    spec => !isSolved(taskStateOf(model, spec.id)),
  ) ||
  Option.exists(quizOf<T>(lessonStep), spec =>
    Option.isNone(quizAnswerOf(model, spec.id)),
  )

export const maxAllowedStep = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): number =>
  pipe(
    lesson.steps,
    Array.findFirstIndex(lessonStep => isBlocking(model, lessonStep)),
    Option.getOrElse(() => lesson.steps.length - 1),
  )

export const isEditable = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): boolean =>
  Option.exists(
    currentTask(lesson, model),
    ({ state }) => !isSolved(state) && Option.isNone(state.maybeReplayIndex),
  )

export const isReplaying = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): boolean =>
  Option.exists(currentTask(lesson, model), ({ state }) =>
    Option.isSome(state.maybeReplayIndex),
  )

/** Квиз шага ждёт выбора на доске. */
export const isPicking = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): boolean =>
  Option.exists(
    currentQuiz(lesson, model),
    ({ spec, maybeAnswer }) => isBoardQuiz(spec) && Option.isNone(maybeAnswer),
  )

export const boardMode = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): BoardMode =>
  isEditable(lesson, model)
    ? 'Edit'
    : isReplaying(lesson, model)
      ? 'Replay'
      : isPicking(lesson, model)
        ? 'Pick'
        : 'View'

/** Модель доски вида урока. */
export const boardModelOf = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): Option.Option<T['BoardModel']> => lesson.kind.board.state.unwrap(model.board)

/** Элементы интерфейса, открытые к этому уроку, и новые в нём (план 3.4). */
export type Unlocks = Readonly<{
  unlocked: ReadonlyArray<string>
  newFeatures: ReadonlyArray<string>
}>

export const unlocksOf = (model: Model): Unlocks =>
  Option.match(
    Option.all([
      findCourse(model.course),
      findLesson(model.course, model.slug),
    ]),
    {
      onNone: () => ({ unlocked: [], newFeatures: [] }),
      onSome: ([course, lesson]) => ({
        unlocked: unlockedFeatures(course.definition, lesson.meta.order),
        newFeatures: newFeaturesOf(course.definition, lesson.meta.order),
      }),
    },
  )

// SURFACES

export type TaskSurface<T extends KindTypes> = Readonly<{
  id: string
  target: string
  definition: SurfaceDefinition<T>
}>

const parseSurface = (id: string): readonly [string, string] => {
  const separator = id.indexOf(':')
  return separator < 0
    ? [id, '']
    : [id.slice(0, separator), id.slice(separator + 1)]
}

export const surfaceOf = <T extends KindTypes>(
  kind: BoardKind<T>,
  id: string,
): Option.Option<TaskSurface<T>> => {
  const [type, target] = parseSurface(id)
  return Option.map(
    Array.findFirst(kind.surfaces, definition => definition.type === type),
    definition => ({ id, target, definition }),
  )
}

/** Экран поверхности: у поверхностей одного экрана устройства он общий. */
const screenOf = <T extends KindTypes>(surface: TaskSurface<T>): string =>
  surface.definition.screen === undefined
    ? surface.id
    : `${surface.definition.screen}:${surface.target}`

/** Поверхности задачи текущего шага, кроме доски, которые открыл курс. Из
    поверхностей одного экрана остаётся первая объявленная. */
export const visibleSurfaces = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): ReadonlyArray<TaskSurface<T>> =>
  Option.match(currentTask(lesson, model), {
    onNone: () => [],
    onSome: ({ spec }) => {
      const { unlocked } = unlocksOf(model)
      return pipe(
        Array.getSomes(
          Array.map(taskSurfaces(spec), id => surfaceOf(lesson.kind, id)),
        ),
        Array.filter(surface =>
          isSurfaceOpen(unlocked, surface.definition.feature),
        ),
        Array.dedupeWith((left, right) => screenOf(left) === screenOf(right)),
      )
    },
  })

/** Открытая вкладка поверхностей: выбранная учеником или первая. */
export const activeSurface = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): Option.Option<TaskSurface<T>> => {
  const surfaces = visibleSurfaces(lesson, model)
  return pipe(
    model.maybeSurfaceTab,
    Option.flatMap(chosen =>
      Array.findFirst(surfaces, surface => surface.id === chosen),
    ),
    Option.orElse(() => Array.head(surfaces)),
  )
}

export const surfaceContext = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  target: string,
  label: SurfaceContext<T>['label'] = () => Option.none(),
): SurfaceContext<T> => {
  const doc = currentDoc(lesson, model)
  const unlocks = unlocksOf(model)
  const logs = logsOf(lesson, model)
  const task = currentTask(lesson, model)
  return {
    doc,
    run: lesson.kind.run(doc),
    mode: boardMode(lesson, model),
    target,
    label,
    maybeGhost: Option.flatMap(task, ({ spec, state }) =>
      state.hintsShown >= 3 && !isSolved(state)
        ? Option.some(spec.solution)
        : Option.none(),
    ),
    unlocked: unlocks.unlocked,
    newFeatures: unlocks.newFeatures,
    history: Array.flatMap(Array.take(lesson.steps, model.step + 1), step =>
      stepOps(step, logs),
    ),
    journal: Option.match(task, {
      onNone: () => [],
      onSome: ({ state }) => opsOf(lesson.kind, state.log),
    }),
    surfaces: Option.match(task, {
      onNone: () => [],
      onSome: ({ spec }) => taskSurfaces(spec),
    }),
    goals: Option.match(task, {
      onNone: () => [],
      onSome: ({ spec }) => Array.map(spec.goals, ({ goal }) => goal),
    }),
  }
}

const stepStage = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): ReadonlyArray<T['Stage']> =>
  Option.match(Array.get(lesson.steps, model.step), {
    onNone: () => [],
    onSome: found => found.stage,
  })

/** Сцена на доске: ход ученика, если у последнего хода задачи есть своя
    сцена (браузер открыл адрес — его трасса), иначе сцена шага. Элементы
    шага, которые вид оставляет на доске (`persists`), видны и в сцене хода. */
export const boardStage = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): Readonly<{ stage: ReadonlyArray<T['Stage']>; doc: T['Doc'] }> =>
  pipe(
    currentTask(lesson, model),
    Option.flatMap(({ state }) => {
      const log = opsOf(lesson.kind, state.log)
      return Option.flatMap(Array.last(log), last => {
        const before = foldDoc(
          lesson.kind,
          taskStartDoc(lesson, model),
          Array.dropRight(log, 1),
        )
        const stage = lesson.kind.moveStage(before, last)
        const persists = lesson.kind.stage.persists ?? (() => false)
        return Array.isReadonlyArrayEmpty(stage)
          ? Option.none()
          : Option.some({
              stage: [
                ...Array.filter(stepStage(lesson, model), persists),
                ...stage,
              ],
              doc: before,
            })
      })
    }),
    Option.getOrElse(() => ({
      stage: stepStage(lesson, model),
      doc: currentDoc(lesson, model),
    })),
  )

/** Ход со своей сценой (трасса открытой страницы) проигрывается сразу. */
const replayMove = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  before: T['Doc'],
  ops: ReadonlyArray<T['Op']>,
): Model =>
  Option.match(Array.last(ops), {
    onNone: () => model,
    onSome: last => {
      const beforeLast = foldDoc(lesson.kind, before, Array.dropRight(ops, 1))
      return Array.isReadonlyArrayEmpty(lesson.kind.moveStage(beforeLast, last))
        ? model
        : Option.match(lesson.kind.board.state.unwrap(model.board), {
            onNone: () => model,
            onSome: boardModel =>
              modifyFields(model, {
                board: () =>
                  lesson.kind.board.state.wrap(
                    lesson.kind.board.replay(boardModel),
                  ),
              }),
          })
    },
  })

const initialSurfaces = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
): Readonly<Record<string, SurfaceState>> =>
  Record.fromEntries(
    Array.flatMap(lesson.steps, lessonStep =>
      Option.match(taskOf(lessonStep), {
        onNone: () => [],
        onSome: spec =>
          Array.getSomes(
            Array.map(taskSurfaces(spec), id =>
              Option.map(
                surfaceOf(lesson.kind, id),
                ({ definition, target }): readonly [string, SurfaceState] => [
                  id,
                  definition.init(target),
                ],
              ),
            ),
          ),
      }),
    ),
  )

// INIT

// Номер шага приходит из адреса: дробный или нечисловой превращаем в
// целый, затем держим в пределах урока и открытой задачи.
const clampStep = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  requested: number,
): number =>
  Math.min(
    Math.max(
      globalThis.Number.isFinite(requested) ? Math.trunc(requested) : 0,
      0,
    ),
    maxAllowedStep(lesson, model),
  )

export const init = <T extends KindTypes>(
  course: string,
  lesson: LessonDefinition<T>,
  requestedStep: number,
): Model => {
  const model: Model = {
    course,
    slug: lesson.slug,
    step: 0,
    tasks: {},
    quizzes: {},
    openMore: [],
    isAskAiCopied: false,
    board: lesson.kind.board.state.wrap(lesson.kind.board.init),
    surfaces: initialSurfaces(lesson),
    maybeSurfaceTab: Option.none(),
    isJournalOpen: false,
    maybeToast: Option.none(),
    toastSerial: 0,
    maybeHoveredRef: Option.none(),
    isReducedMotion: false,
    isNarrow: false,
  }
  return modifyFields(model, {
    step: () => clampStep(lesson, model, requestedStep),
  })
}

/** `init` для урока из реестра, вид которого заранее не известен. */
export const initLesson = (
  course: string,
  lesson: AnyLesson,
  requestedStep: number,
): Model =>
  withLesson(lesson, <T extends KindTypes>(definition: LessonDefinition<T>) =>
    init(course, definition, requestedStep),
  )

// UPDATE

const withTask = (
  model: Model,
  taskId: string,
  change: (task: TaskState) => TaskState,
): Model =>
  modifyFields(model, {
    tasks: tasks =>
      Record.set(tasks, taskId, change(tasks[taskId] ?? emptyTask)),
  })

/** Отменяет начатый на доске жест. */
const interruptBoard = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  board: BoardState,
): BoardState =>
  Option.match(lesson.kind.board.state.unwrap(board), {
    onNone: () => board,
    onSome: boardModel =>
      lesson.kind.board.state.wrap(lesson.kind.board.interrupt(boardModel)),
  })

export const goToStep = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  requested: number,
): UpdateReturn => {
  const step = clampStep(lesson, model, requested)
  if (step === model.step) {
    return { model }
  }
  return {
    model: modifyFields(model, {
      step: () => step,
      tasks: tasks =>
        Record.map(tasks, task =>
          modifyFields(task, { maybeReplayIndex: () => Option.none() }),
        ),
      board: board => interruptBoard(lesson, board),
      maybeToast: () => Option.none(),
      maybeHoveredRef: () => Option.none(),
      isAskAiCopied: () => false,
    }),
    commands: [ScrollStepIntoView({ step })],
    outMessage: OutMessage.ChangedStep({ step }),
  }
}

/** `goToStep` для урока из реестра. */
export const goToLessonStep = (
  lesson: AnyLesson,
  model: Model,
  requested: number,
): UpdateReturn =>
  withLesson(lesson, <T extends KindTypes>(definition: LessonDefinition<T>) =>
    goToStep(definition, model, requested),
  )

const showToast = (model: Model, message: KindMessage): PlainReturn => {
  const serial = model.toastSerial + 1
  return {
    model: modifyFields(model, {
      maybeToast: () => Option.some(message),
      toastSerial: () => serial,
    }),
    commands: [WaitBeforeHidingToast({ serial })],
  }
}

/** Ходы применяются вместе: первый отказ отменяет все и показывает причину. */
const applyAll = <T extends KindTypes>(
  kind: BoardKind<T>,
  doc: T['Doc'],
  ops: ReadonlyArray<T['Op']>,
): Result.Result<T['Doc'], T['Message']> =>
  Array.reduce(
    ops,
    Result.succeed(doc),
    (current: Result.Result<T['Doc'], T['Message']>, op) =>
      Result.flatMap(current, next => kind.apply(next, op)),
  )

/** Ходы ученика с доски и с поверхностей попадают в один журнал задачи. */
const applyStudentOps = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  ops: ReadonlyArray<T['Op']>,
): PlainReturn =>
  Option.match(currentTask(lesson, model), {
    onNone: () => ({ model }),
    onSome: ({ spec }) =>
      !isEditable(lesson, model) || Array.isReadonlyArrayEmpty(ops)
        ? { model }
        : Result.match(applyAll(lesson.kind, currentDoc(lesson, model), ops), {
            onFailure: refusal =>
              showToast(model, lesson.kind.message.wrap(refusal)),
            onSuccess: () => ({
              model: replayMove(
                lesson,
                withTask(model, spec.id, task => ({
                  ...task,
                  log: [...task.log, ...Array.map(ops, lesson.kind.op.wrap)],
                  redo: [],
                  check:
                    task.check._tag === 'Failed'
                      ? CheckState.Unchecked()
                      : task.check,
                })),
                currentDoc(lesson, model),
                ops,
              ),
            }),
          }),
  })

const boardInput = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): BoardInput<T> => ({
  doc: currentDoc(lesson, model),
  mode: boardMode(lesson, model),
  pickable: isPicking(lesson, model)
    ? Option.match(currentQuiz(lesson, model), {
        onNone: () => [],
        onSome: ({ spec }) => spec.candidates,
      })
    : [],
})

/** Одна попытка: первый выбор записывается, следующие не меняют ответ. */
const answerQuiz = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  candidate: string,
): PlainReturn =>
  Option.match(currentQuiz(lesson, model), {
    onNone: () => ({ model }),
    onSome: ({ spec, maybeAnswer }) =>
      Option.isSome(maybeAnswer) || !isValidPick(spec, candidate)
        ? { model }
        : {
            model: modifyFields(model, {
              quizzes: quizzes =>
                Record.set(quizzes, spec.id, {
                  picked: candidate,
                  isCorrect: isCorrectPick(
                    candidate,
                    correctAnswer(lesson, model, spec),
                  ),
                }),
            }),
          },
  })

const boardAdapters = <T extends KindTypes>(lesson: LessonDefinition<T>) => ({
  read: (parent: Model) => lesson.kind.board.state.unwrap(parent.board),
  write: (parent: Model, nextBoard: T['BoardModel']) =>
    modifyFields(parent, {
      board: () => lesson.kind.board.state.wrap(nextBoard),
    }),
  toParentMessage: (message: T['BoardMessage']) =>
    Message.GotBoardMessage({
      message: lesson.kind.board.message.wrap(message),
    }),
  foldOutMessage:
    (outMessage: BoardOutMessage<T['Op']>) =>
    (parent: Model): PlainReturn =>
      outMessage._tag === 'ProposedOps'
        ? applyStudentOps(lesson, parent, outMessage.ops)
        : answerQuiz(lesson, parent, outMessage.id),
})

const foldBoard = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  message: BoardMessage,
): PlainReturn =>
  Option.match(lesson.kind.board.message.unwrap(message), {
    onNone: () => ({ model }),
    onSome: boardMessage =>
      Update.foldChild({
        update: lesson.kind.board.update(boardInput(lesson, model)),
        ...boardAdapters(lesson),
      })(model, boardMessage),
  })

const pressDelete = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): PlainReturn =>
  Update.foldChildStep({
    update: lesson.kind.board.pressDelete(boardInput(lesson, model)),
    ...boardAdapters(lesson),
  })(model)

const foldSurface = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  surfaceId: string,
  message: SurfaceMessage,
): PlainReturn =>
  Option.match(surfaceOf(lesson.kind, surfaceId), {
    onNone: () => ({ model }),
    onSome: ({ definition, target }) =>
      Update.foldChild({
        update: definition.update(surfaceContext(lesson, model, target)),
        read: (parent: Model) => Record.get(parent.surfaces, surfaceId),
        write: (parent: Model, nextSurface: SurfaceState) =>
          modifyFields(parent, {
            surfaces: surfaces => Record.set(surfaces, surfaceId, nextSurface),
          }),
        toParentMessage: (surfaceMessage: SurfaceMessage) =>
          Message.GotSurfaceMessage({ surfaceId, message: surfaceMessage }),
        foldOutMessage: outMessage => parent =>
          applyStudentOps(lesson, parent, outMessage.ops),
      })(model, message),
  })

const editTask = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  change: (task: TaskState) => TaskState,
): UpdateReturn =>
  Option.match(currentTask(lesson, model), {
    onNone: () => ({ model }),
    onSome: ({ spec }) =>
      isEditable(lesson, model)
        ? {
            model: modifyFields(withTask(model, spec.id, change), {
              board: board => interruptBoard(lesson, board),
            }),
          }
        : { model },
  })

const undo = (task: TaskState): TaskState =>
  Option.match(Array.last(task.log), {
    onNone: () => task,
    onSome: last => ({
      ...task,
      log: Array.dropRight(task.log, 1),
      redo: [last, ...task.redo],
      check: CheckState.Unchecked(),
    }),
  })

const redo = (task: TaskState): TaskState =>
  Option.match(Array.head(task.redo), {
    onNone: () => task,
    onSome: next => ({
      ...task,
      log: [...task.log, next],
      redo: Array.drop(task.redo, 1),
      check: CheckState.Unchecked(),
    }),
  })

const reset = (task: TaskState): TaskState => ({
  ...task,
  log: [],
  redo: [],
  check: CheckState.Unchecked(),
})

const solve = (model: Model, taskId: string, withHint: boolean): Model =>
  withTask(model, taskId, task => ({
    ...task,
    maybeReplayIndex: Option.none(),
    check: CheckState.Solved({ withHint }),
  }))

export const goalChecks = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  doc: T['Doc'],
  spec: TaskSpec<T>,
): ReadonlyArray<GoalCheck<T['Message']>> => {
  const run = lesson.kind.run(doc)
  return Array.map(spec.goals, ({ goal }) =>
    lesson.kind.checkGoal(doc, run, goal),
  )
}

const failedGoal = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  spec: TaskSpec<T>,
) =>
  pipe(
    goalChecks(lesson, currentDoc(lesson, model), spec),
    Array.map((goalCheck, index) => ({ index, goalCheck })),
    Array.findFirst(({ goalCheck }) => !goalCheck.met),
  )

const failedCheckState = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  index: number,
  goalCheck: GoalCheck<T['Message']>,
): CheckState =>
  Option.match(goalCheck.maybeFailure, {
    onNone: () => CheckState.Unchecked(),
    onSome: failure =>
      CheckState.Failed({
        goalIndex: index,
        failure: lesson.kind.message.wrap(failure),
        focusNodes: goalCheck.focusNodes,
        focusEdges: goalCheck.focusEdges,
      }),
  })

const check = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): UpdateReturn =>
  Option.match(currentTask(lesson, model), {
    onNone: () => ({ model }),
    onSome: ({ spec }) => {
      if (!isEditable(lesson, model)) {
        return { model }
      }
      return Option.match(failedGoal(lesson, model, spec), {
        onNone: () => ({ model: solve(model, spec.id, false) }),
        onSome: ({ index, goalCheck }) => ({
          model: withTask(model, spec.id, task => ({
            ...task,
            attempts: task.attempts + 1,
            check: failedCheckState(lesson, index, goalCheck),
          })),
        }),
      })
    },
  })

// Эталон из урока не принимается на веру: если после проигрывания цель
// всё же не выполнена, задача остаётся открытой с понятной ошибкой.
const finishReplay = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  spec: TaskSpec<T>,
): Model =>
  Option.match(failedGoal(lesson, model, spec), {
    onNone: () => solve(model, spec.id, true),
    onSome: ({ index, goalCheck }) =>
      withTask(model, spec.id, task => ({
        ...task,
        maybeReplayIndex: Option.none(),
        check: failedCheckState(lesson, index, goalCheck),
      })),
  })

const startReplay = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): UpdateReturn =>
  Option.match(currentTask(lesson, model), {
    onNone: () => ({ model }),
    onSome: ({ spec, state }) =>
      isSolved(state)
        ? { model }
        : {
            model: modifyFields(
              withTask(model, spec.id, task => ({
                ...reset(task),
                maybeReplayIndex: Option.some(0),
              })),
              { board: board => interruptBoard(lesson, board) },
            ),
            commands: [WaitBeforeReplayStep()],
          },
  })

const continueReplay = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
): UpdateReturn =>
  Option.match(currentTask(lesson, model), {
    onNone: () => ({ model }),
    onSome: ({ spec, state }) =>
      Option.match(state.maybeReplayIndex, {
        onNone: () => ({ model }),
        onSome: index =>
          Option.match(Array.get(spec.solution, index), {
            onNone: () => ({ model: finishReplay(lesson, model, spec) }),
            onSome: op => {
              const before = currentDoc(lesson, model)
              const applies = Result.isSuccess(lesson.kind.apply(before, op))
              const next = withTask(model, spec.id, task => ({
                ...task,
                log: applies
                  ? [...task.log, lesson.kind.op.wrap(op)]
                  : task.log,
                maybeReplayIndex: Option.some(index + 1),
              }))
              return {
                model: applies ? replayMove(lesson, next, before, [op]) : next,
                commands: [WaitBeforeReplayStep()],
              }
            },
          }),
      }),
  })

export const updateWith =
  <T extends KindTypes>(lesson: LessonDefinition<T>) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedNext: () => goToStep(lesson, model, model.step + 1),
      ClickedPrevious: () => goToStep(lesson, model, model.step - 1),
      ClickedStep: ({ step }) => goToStep(lesson, model, step),
      PressedArrowKey: ({ direction }) =>
        goToStep(lesson, model, model.step + (direction === 'Left' ? -1 : 1)),
      GotBoardMessage: ({ message: boardMessage }) =>
        foldBoard(lesson, model, boardMessage),
      GotSurfaceMessage: ({ surfaceId, message: surfaceMessage }) =>
        foldSurface(lesson, model, surfaceId, surfaceMessage),
      ClickedSurfaceTab: ({ surface }) => ({
        model: modifyFields(model, {
          maybeSurfaceTab: () => Option.some(surface),
        }),
      }),
      ClickedUndo: () => editTask(lesson, model, undo),
      PressedUndoKey: () => editTask(lesson, model, undo),
      ClickedRedo: () => editTask(lesson, model, redo),
      PressedRedoKey: () => editTask(lesson, model, redo),
      ClickedReset: () => editTask(lesson, model, reset),
      PressedDeleteKey: () => pressDelete(lesson, model),
      PressedEscapeKey: () => ({
        model: modifyFields(model, {
          board: board => interruptBoard(lesson, board),
        }),
      }),
      ClickedChoice: ({ candidate }) => answerQuiz(lesson, model, candidate),
      ClickedMore: ({ stepId }) => ({
        model: modifyFields(model, {
          openMore: openMore =>
            Array.contains(openMore, stepId)
              ? Array.filter(openMore, open => open !== stepId)
              : [...openMore, stepId],
        }),
      }),
      ClickedCopyAskAi: ({ template }) => ({
        model,
        commands: [CopyAskAiTemplate({ template })],
      }),
      CompletedCopyAskAiTemplate: ({ isCopied }) => ({
        model: modifyFields(model, { isAskAiCopied: () => isCopied }),
      }),
      ClickedCheck: () => check(lesson, model),
      ClickedHint: () =>
        Option.match(currentTask(lesson, model), {
          onNone: () => ({ model }),
          onSome: ({ spec }) => ({
            model: withTask(model, spec.id, task => ({
              ...task,
              hintsShown: Math.min(task.hintsShown + 1, 3),
            })),
          }),
        }),
      ClickedShowSolution: () => startReplay(lesson, model),
      CompletedWaitBeforeReplayStep: () => continueReplay(lesson, model),
      CompletedWaitBeforeHidingToast: ({ serial }) => ({
        model:
          serial === model.toastSerial
            ? modifyFields(model, { maybeToast: () => Option.none() })
            : model,
      }),
      ClickedJournalToggle: () => ({
        model: modifyFields(model, { isJournalOpen: isOpen => !isOpen }),
      }),
      HoveredReference: ({ id }) => ({
        model: modifyFields(model, { maybeHoveredRef: () => Option.some(id) }),
      }),
      LeftReference: () => ({
        model: modifyFields(model, { maybeHoveredRef: () => Option.none() }),
      }),
      CompletedScrollStepIntoView: () => ({ model }),
      ChangedReducedMotion: ({ isReducedMotion }) => ({
        model: modifyFields(model, { isReducedMotion: () => isReducedMotion }),
      }),
      ChangedNarrowScreen: ({ isNarrow }) => ({
        model: modifyFields(model, { isNarrow: () => isNarrow }),
      }),
    })

const lessonOf = (model: Model): Option.Option<AnyLesson> =>
  findDefinition(model.course, model.slug)

export const update = (model: Model, message: Message): UpdateReturn =>
  Option.match(lessonOf(model), {
    onNone: () => ({ model }),
    onSome: lesson =>
      withLesson(
        lesson,
        <T extends KindTypes>(definition: LessonDefinition<T>) =>
          updateWith(definition)(model, message),
      ),
  })

const frameWith = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  model: Model,
  deltaMs: number,
): Model =>
  Option.match(lesson.kind.board.state.unwrap(model.board), {
    onNone: () => model,
    onSome: boardModel =>
      modifyFields(model, {
        board: () =>
          lesson.kind.board.state.wrap(
            lesson.kind.board.frame(boardModel, deltaMs, {
              doc: currentDoc(lesson, model),
              isReducedMotion: model.isReducedMotion,
            }),
          ),
      }),
  })

export const advanceFrame =
  (deltaMs: number) =>
  (model: Model): PlainReturn =>
    Option.match(lessonOf(model), {
      onNone: () => ({ model }),
      onSome: lesson => ({
        model: withLesson(
          lesson,
          <T extends KindTypes>(definition: LessonDefinition<T>) =>
            frameWith(definition, model, deltaMs),
        ),
      }),
    })

// SUBSCRIPTION

export const subscriptions = Subscription.make<Model, Message>()(() => ({
  keys: Subscription.persistentEntry(
    Dom.streamFromKeyBindings<Message>({
      bindings: [
        {
          keys: 'ArrowLeft',
          mapEvent: () => Message.PressedArrowKey({ direction: 'Left' }),
        },
        {
          keys: 'ArrowRight',
          mapEvent: () => Message.PressedArrowKey({ direction: 'Right' }),
        },
        { keys: 'Mod+Z', mapEvent: () => Message.PressedUndoKey() },
        { keys: 'Mod+Shift+Z', mapEvent: () => Message.PressedRedoKey() },
        { keys: 'Delete', mapEvent: () => Message.PressedDeleteKey() },
        { keys: 'Backspace', mapEvent: () => Message.PressedDeleteKey() },
        { keys: 'Escape', mapEvent: () => Message.PressedEscapeKey() },
      ],
    }),
  ),
  reducedMotion: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-reduced-motion: reduce)',
      mapMatches: isMatching =>
        Message.ChangedReducedMotion({ isReducedMotion: isMatching }),
    }),
  ),
  narrowScreen: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(max-width: 600px)',
      mapMatches: isMatching =>
        Message.ChangedNarrowScreen({ isNarrow: isMatching }),
    }),
  ),
}))
