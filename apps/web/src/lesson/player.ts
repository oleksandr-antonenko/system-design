import {
  Array,
  Effect,
  Option,
  Order,
  Record,
  Result,
  Schema,
  pipe,
} from 'effect'
import { Command, Dom, Subscription, Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'

import * as Board from '../board/board'
import { findDefinition } from '../courses/registry'
import { type BoardDoc, BoardOp, applyOp } from '../domain/board'
import { type GoalCheck, firstFailedGoal } from '../domain/goals'
import { simulate } from '../domain/simulate'
import { DomainMessage } from '../i18n/domainMessage'
import { Anim, initialAnim, tick } from './anim'
import {
  type LessonDefinition,
  type TaskLogs,
  type TaskSpec,
  boardAt,
  taskOf,
  taskStartBoard,
} from './dsl'

// MODEL

export const Outcome = Schema.Struct({
  errorRate: Schema.Number,
  p95: Schema.Option(Schema.Number),
  serverUtilization: Schema.Array(Schema.Number),
  costPerHour: Schema.Number,
})
export type Outcome = typeof Outcome.Type

export const CheckState = defineTaggedUnion({
  Unchecked: {},
  Failed: {
    goalIndex: Schema.Number,
    failure: DomainMessage,
    focusNodes: Schema.Array(Schema.String),
    focusEdges: Schema.Array(Schema.String),
  },
  Solved: { withHint: Schema.Boolean, before: Outcome, after: Outcome },
})
export type CheckState = typeof CheckState.Type

export const TaskState = Schema.Struct({
  log: Schema.Array(BoardOp),
  redo: Schema.Array(BoardOp),
  attempts: Schema.Number,
  hintsShown: Schema.Number,
  check: CheckState,
  maybeReplayIndex: Schema.Option(Schema.Number),
})
export type TaskState = typeof TaskState.Type

export const Model = Schema.Struct({
  course: Schema.String,
  slug: Schema.String,
  step: Schema.Number,
  tasks: Schema.Record(Schema.String, TaskState),
  board: Board.Model,
  anim: Anim,
  isJournalOpen: Schema.Boolean,
  maybeToast: Schema.Option(DomainMessage),
  toastSerial: Schema.Number,
  maybeHoveredRef: Schema.Option(Schema.String),
  isReducedMotion: Schema.Boolean,
})
export type Model = typeof Model.Type

// MESSAGE

export const Message = defineMessageUnion({
  ClickedNext: {},
  ClickedPrevious: {},
  ClickedStep: { step: Schema.Number },
  PressedArrowKey: { direction: Schema.Literals(['Left', 'Right']) },
  GotBoardMessage: { message: Board.Message },
  ClickedPlayPause: {},
  ClickedSpeed: { speed: Schema.Number },
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedReset: {},
  PressedUndoKey: {},
  PressedRedoKey: {},
  PressedDeleteKey: {},
  PressedEscapeKey: {},
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

const logsOf = (model: Model): TaskLogs =>
  Record.map(model.tasks, task => task.log)

export const isSolved = (task: TaskState): boolean =>
  task.check._tag === 'Solved'

export const docAt = (
  lesson: LessonDefinition,
  model: Model,
  step: number,
): BoardDoc => boardAt(lesson, step, logsOf(model))

export const currentDoc = (lesson: LessonDefinition, model: Model): BoardDoc =>
  docAt(lesson, model, model.step)

export type CurrentTask = Readonly<{
  spec: TaskSpec
  state: TaskState
  step: number
}>

export const currentTask = (
  lesson: LessonDefinition,
  model: Model,
): Option.Option<CurrentTask> =>
  pipe(
    Array.get(lesson.steps, model.step),
    Option.flatMap(taskOf),
    Option.map(spec => ({
      spec,
      state: taskStateOf(model, spec.id),
      step: model.step,
    })),
  )

export const maxAllowedStep = (
  lesson: LessonDefinition,
  model: Model,
): number =>
  pipe(
    lesson.steps,
    Array.findFirstIndex(lessonStep =>
      Option.exists(
        taskOf(lessonStep),
        spec => !isSolved(taskStateOf(model, spec.id)),
      ),
    ),
    Option.getOrElse(() => lesson.steps.length - 1),
  )

export const isEditable = (lesson: LessonDefinition, model: Model): boolean =>
  Option.exists(
    currentTask(lesson, model),
    ({ state }) => !isSolved(state) && Option.isNone(state.maybeReplayIndex),
  )

export const isReplaying = (lesson: LessonDefinition, model: Model): boolean =>
  Option.exists(currentTask(lesson, model), ({ state }) =>
    Option.isSome(state.maybeReplayIndex),
  )

export const outcomeOf = (doc: BoardDoc): Outcome => {
  const result = simulate(doc, doc.load)
  return {
    errorRate: result.errorRate,
    p95: result.p95,
    serverUtilization: pipe(
      doc.nodes,
      Array.filter(node => node.kind === 'server'),
      Array.sort(
        Order.mapInput(
          Order.String,
          (node: BoardDoc['nodes'][number]) => node.id,
        ),
      ),
      Array.map(node => result.nodes[node.id]?.utilization ?? 0),
    ),
    costPerHour: result.costPerHour,
  }
}

// INIT

// Номер шага приходит из адреса: дробный или нечисловой превращаем в
// целый, затем держим в пределах урока и открытой задачи.
const clampStep = (
  lesson: LessonDefinition,
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

export const init = (
  course: string,
  lesson: LessonDefinition,
  requestedStep: number,
): Model => {
  const model: Model = {
    course,
    slug: lesson.slug,
    step: 0,
    tasks: {},
    board: Board.initialModel,
    anim: initialAnim,
    isJournalOpen: false,
    maybeToast: Option.none(),
    toastSerial: 0,
    maybeHoveredRef: Option.none(),
    isReducedMotion: false,
  }
  return modifyFields(model, {
    step: () => clampStep(lesson, model, requestedStep),
  })
}

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

export const goToStep = (
  lesson: LessonDefinition,
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
      board: () => Board.initialModel,
      maybeToast: () => Option.none(),
      maybeHoveredRef: () => Option.none(),
    }),
    commands: [ScrollStepIntoView({ step })],
    outMessage: OutMessage.ChangedStep({ step }),
  }
}

const showToast = (model: Model, message: DomainMessage): PlainReturn => {
  const serial = model.toastSerial + 1
  return {
    model: modifyFields(model, {
      maybeToast: () => Option.some(message),
      toastSerial: () => serial,
    }),
    commands: [WaitBeforeHidingToast({ serial })],
  }
}

const applyStudentOp = (
  lesson: LessonDefinition,
  model: Model,
  op: BoardOp,
): PlainReturn =>
  Option.match(currentTask(lesson, model), {
    onNone: () => ({ model }),
    onSome: ({ spec }) =>
      Result.match(applyOp(currentDoc(lesson, model), op), {
        onFailure: refusal => showToast(model, refusal),
        onSuccess: () => ({
          model: withTask(model, spec.id, task => ({
            ...task,
            log: [...task.log, op],
            redo: [],
            check:
              task.check._tag === 'Failed'
                ? CheckState.Unchecked()
                : task.check,
          })),
        }),
      }),
  })

const boardInput = (lesson: LessonDefinition, model: Model): Board.Input => ({
  doc: currentDoc(lesson, model),
  isEditable: isEditable(lesson, model),
})

const boardAdapters = (lesson: LessonDefinition) => ({
  read: (parent: Model) => Option.some(parent.board),
  write: (parent: Model, nextBoard: Board.Model) =>
    modifyFields(parent, { board: () => nextBoard }),
  toParentMessage: (message: Board.Message) =>
    Message.GotBoardMessage({ message }),
  foldOutMessage: (outMessage: Board.OutMessage) => (parent: Model) =>
    Board.OutMessage.match(outMessage, {
      ProposedOp: ({ op }) => applyStudentOp(lesson, parent, op),
    }),
})

const foldBoard = (lesson: LessonDefinition, model: Model) =>
  Update.foldChild({
    update: Board.update(boardInput(lesson, model)),
    ...boardAdapters(lesson),
  })

const foldBoardStep = (
  lesson: LessonDefinition,
  model: Model,
  step: (board: Board.Model) => Board.UpdateReturn,
): UpdateReturn =>
  Update.foldChildStep({ update: step, ...boardAdapters(lesson) })(model)

const editTask = (
  lesson: LessonDefinition,
  model: Model,
  change: (task: TaskState) => TaskState,
): UpdateReturn =>
  Option.match(currentTask(lesson, model), {
    onNone: () => ({ model }),
    onSome: ({ spec }) =>
      isEditable(lesson, model)
        ? {
            model: modifyFields(withTask(model, spec.id, change), {
              board: () => Board.initialModel,
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

const solve = (
  lesson: LessonDefinition,
  model: Model,
  taskId: string,
  withHint: boolean,
): Model =>
  withTask(model, taskId, task => ({
    ...task,
    maybeReplayIndex: Option.none(),
    check: CheckState.Solved({
      withHint,
      before: outcomeOf(taskStartBoard(lesson, model.step, logsOf(model))),
      after: outcomeOf(currentDoc(lesson, model)),
    }),
  }))

const failedGoal = (lesson: LessonDefinition, model: Model, spec: TaskSpec) =>
  firstFailedGoal(
    currentDoc(lesson, model),
    Array.map(spec.goals, ({ goal }) => goal),
  )

const failedCheckState = (index: number, goalCheck: GoalCheck): CheckState =>
  Option.match(goalCheck.maybeFailure, {
    onNone: () => CheckState.Unchecked(),
    onSome: failure =>
      CheckState.Failed({
        goalIndex: index,
        failure,
        focusNodes: goalCheck.focusNodes,
        focusEdges: goalCheck.focusEdges,
      }),
  })

const check = (lesson: LessonDefinition, model: Model): UpdateReturn =>
  Option.match(currentTask(lesson, model), {
    onNone: () => ({ model }),
    onSome: ({ spec }) => {
      if (!isEditable(lesson, model)) {
        return { model }
      }
      return Option.match(failedGoal(lesson, model, spec), {
        onNone: () => ({ model: solve(lesson, model, spec.id, false) }),
        onSome: ({ index, check: goalCheck }) => ({
          model: withTask(model, spec.id, task => ({
            ...task,
            attempts: task.attempts + 1,
            check: failedCheckState(index, goalCheck),
          })),
        }),
      })
    },
  })

// Эталон из урока не принимается на веру: если после проигрывания цель
// всё же не выполнена, задача остаётся открытой с понятной ошибкой.
const finishReplay = (
  lesson: LessonDefinition,
  model: Model,
  spec: TaskSpec,
): Model =>
  Option.match(failedGoal(lesson, model, spec), {
    onNone: () => solve(lesson, model, spec.id, true),
    onSome: ({ index, check: goalCheck }) =>
      withTask(model, spec.id, task => ({
        ...task,
        maybeReplayIndex: Option.none(),
        check: failedCheckState(index, goalCheck),
      })),
  })

const startReplay = (lesson: LessonDefinition, model: Model): UpdateReturn =>
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
              { board: () => Board.initialModel },
            ),
            commands: [WaitBeforeReplayStep()],
          },
  })

const continueReplay = (lesson: LessonDefinition, model: Model): UpdateReturn =>
  Option.match(currentTask(lesson, model), {
    onNone: () => ({ model }),
    onSome: ({ spec, state }) =>
      Option.match(state.maybeReplayIndex, {
        onNone: () => ({ model }),
        onSome: index =>
          Option.match(Array.get(spec.solution, index), {
            onNone: () => ({ model: finishReplay(lesson, model, spec) }),
            onSome: op => ({
              model: withTask(model, spec.id, task => ({
                ...task,
                log: Result.isSuccess(applyOp(currentDoc(lesson, model), op))
                  ? [...task.log, op]
                  : task.log,
                maybeReplayIndex: Option.some(index + 1),
              })),
              commands: [WaitBeforeReplayStep()],
            }),
          }),
      }),
  })

export const updateWith =
  (lesson: LessonDefinition) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedNext: () => goToStep(lesson, model, model.step + 1),
      ClickedPrevious: () => goToStep(lesson, model, model.step - 1),
      ClickedStep: ({ step }) => goToStep(lesson, model, step),
      PressedArrowKey: ({ direction }) =>
        goToStep(lesson, model, model.step + (direction === 'Left' ? -1 : 1)),
      GotBoardMessage: ({ message: boardMessage }) =>
        foldBoard(lesson, model)(model, boardMessage),
      ClickedPlayPause: () => ({
        model: modifyFields(model, {
          anim: anim =>
            modifyFields(anim, { isRunning: isRunning => !isRunning }),
        }),
      }),
      ClickedSpeed: ({ speed }) => ({
        model: modifyFields(model, {
          anim: anim => modifyFields(anim, { speed: () => speed }),
        }),
      }),
      ClickedUndo: () => editTask(lesson, model, undo),
      PressedUndoKey: () => editTask(lesson, model, undo),
      ClickedRedo: () => editTask(lesson, model, redo),
      PressedRedoKey: () => editTask(lesson, model, redo),
      ClickedReset: () => editTask(lesson, model, reset),
      PressedDeleteKey: () =>
        foldBoardStep(
          lesson,
          model,
          Board.pressDeleteKey(boardInput(lesson, model)),
        ),
      PressedEscapeKey: () =>
        foldBoardStep(lesson, model, Board.pressEscapeKey),
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
    })

export const update = (model: Model, message: Message): UpdateReturn =>
  Option.match(findDefinition(model.course, model.slug), {
    onNone: () => ({ model }),
    onSome: lesson => updateWith(lesson)(model, message),
  })

export const advanceFrame =
  (deltaMs: number) =>
  (model: Model): PlainReturn =>
    Option.match(findDefinition(model.course, model.slug), {
      onNone: () => ({ model }),
      onSome: lesson => ({
        model: modifyFields(model, {
          anim: anim =>
            tick(
              anim,
              deltaMs,
              currentDoc(lesson, model),
              model.isReducedMotion,
            ),
        }),
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
}))
