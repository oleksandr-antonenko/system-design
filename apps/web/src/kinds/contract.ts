import type { Option, Result } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { BoardKindId } from '../courses/model'
import type { Locale } from '../i18n/locale'
import type { UiStrings } from '../i18n/ui'
import type { QuizKind } from '../lesson/quiz'
import type {
  BoardMessage,
  BoardState,
  KindMessage,
  KindOp,
  SurfaceMessage,
  SurfaceState,
} from './state'

// Контракт вида доски (design D1). Плеер, DSL урока, журнал, подсказки,
// поверхности и тесты контента работают только через него. Вид доски —
// System Design (`flow`) или сети (`packet`) — реализует контракт целиком.

/** Типы одного вида доски. Набор задаётся раз на вид: `FlowTypes`,
    `PacketTypes` в `kinds/types.ts`. */
export type KindTypes = Readonly<{
  Id: BoardKindId
  /** Документ доски: свёртка операций шагов 0..N и ходов ученика. */
  Doc: unknown
  /** Операция документа: её пишут автор в `ops` и ученик в журнал задачи. */
  Op: unknown
  Goal: unknown
  /** Расчёт по документу: симуляция потоков или состояние сети. */
  Run: unknown
  /** Элемент сцены шага: подсветка, подпись, проигрывание трассы… Только
      показывает, документ не меняет. Подпись — `{ _tag: 'Annotate', key }`. */
  Stage: Readonly<{ _tag: string }>
  /** Что ученик ставит на доску из палитры задачи. */
  Palette: string
  /** Код отказа операции или невыполненной цели (тексты — у вида). */
  Message: Readonly<{ _tag: string }>
  /** Что получает функция-текст шага (`body: context => string`). */
  Prose: unknown
  /** Что получает функция-текст подписи на доске (`annotations`). */
  Annotation: unknown
  /** Id поверхностей задачи: `'board'` и поверхности вида. */
  Surface: string
  /** Model и Message Foldkit-подмодуля доски вида. */
  BoardModel: unknown
  BoardMessage: unknown
}>

/** Значение вида внутри общего Schema-union плеера и обратно. */
export type Lens<Value, Stored> = Readonly<{
  wrap: (value: Value) => Stored
  unwrap: (stored: Stored) => Option.Option<Value>
}>

export type Tone = 'ink' | 'info' | 'warn' | 'bad' | 'ok'

/** Режим доски. `Pick` — квиз: ученик выбирает на доске кандидата. */
export type BoardMode = 'View' | 'Edit' | 'Replay' | 'Pick'

/** Итог проверки цели: код сообщения и что подсветить на доске. Для сетей
    `focusNodes` — устройства, `focusEdges` — id связей. */
export type GoalCheck<Message> = Readonly<{
  met: boolean
  maybeFailure: Option.Option<Message>
  focusNodes: ReadonlyArray<string>
  focusEdges: ReadonlyArray<string>
}>

/** Строка итога решённой задачи «было → стало». */
export type OutcomeRow =
  | Readonly<{
      _tag: 'Compared'
      label: string
      before: string
      after: string
      trend: 'better' | 'worse' | 'same'
    }>
  | Readonly<{ _tag: 'Plain'; label: string; value: string }>

/** Подпись сущности доски из `labels` текстов урока. */
export type EntityLabel = Readonly<{ name: string; note?: string }>

// BOARD

/** Что подмодуль доски сообщает плееру. Ходы попадают в журнал задачи,
    выбор — в квиз шага. */
export type BoardOutMessage<Op> =
  | Readonly<{ _tag: 'ProposedOps'; ops: ReadonlyArray<Op> }>
  | Readonly<{ _tag: 'PickedTarget'; id: string }>

export const BoardOutMessage = {
  ProposedOps: <Op>(ops: ReadonlyArray<Op>): BoardOutMessage<Op> => ({
    _tag: 'ProposedOps',
    ops,
  }),
  PickedTarget: <Op>(id: string): BoardOutMessage<Op> => ({
    _tag: 'PickedTarget',
    id,
  }),
}

export type BoardInput<T extends KindTypes> = Readonly<{
  doc: T['Doc']
  mode: BoardMode
  /** В режиме `Pick` — кандидаты квиза, иначе пусто. */
  pickable: ReadonlyArray<string>
}>

/** Задача текущего шага глазами доски. */
export type BoardTask<T extends KindTypes> = Readonly<{
  palette: ReadonlyArray<T['Palette']>
  solution: ReadonlyArray<T['Op']>
  /** Третья подсказка открыта, задача не решена: доска рисует призрак. */
  isGhostShown: boolean
  focusNodes: ReadonlyArray<string>
  focusEdges: ReadonlyArray<string>
}>

/** Квиз текущего шага глазами доски (режим `Pick`). */
export type BoardQuiz = Readonly<{
  candidates: ReadonlyArray<string>
  maybePicked: Option.Option<string>
  /** После попытки — верный ответ, до неё — ничего. */
  maybeAnswer: Option.Option<string>
  /** Короткие метки на доске у выбранного кандидата и у ответа. */
  tags: Readonly<Record<string, string>>
  /** Что вид прячет до ответа (`hideUntilAnswered` квиза). */
  hidden: ReadonlyArray<string>
}>

/** Всё, что доска вида знает о шаге. Обычные данные и функции: в
    `viewInputs` подмодуля вид передаёт только то, что из них вычислил. */
export type BoardContext<T extends KindTypes> = Readonly<{
  locale: Locale
  ui: UiStrings
  prefersDark: boolean
  isReducedMotion: boolean
  doc: T['Doc']
  run: T['Run']
  mode: BoardMode
  stage: ReadonlyArray<T['Stage']>
  annotationText: (key: string) => string
  label: (id: string) => Option.Option<EntityLabel>
  maybeTask: Option.Option<BoardTask<T>>
  maybeQuiz: Option.Option<BoardQuiz>
  /** Палитра: задачи шага, иначе всех задач урока. */
  palette: ReadonlyArray<T['Palette']>
  /** Палитра курса: что впервые в этом уроке и что откроется позже. */
  newPalette: ReadonlyArray<string>
  laterPalette: ReadonlyArray<Readonly<{ kind: string; lesson: number }>>
  maybeHoveredRef: Option.Option<string>
  /** Элементы интерфейса, открытые к этому уроку (`unlocks`, план 3.4). */
  unlocked: ReadonlyArray<string>
  newFeatures: ReadonlyArray<string>
}>

/** Вызов вида доски из плеера. `controls` — кнопки плеера (отмена,
    повтор, сброс, журнал): вид ставит их в свои приборы. */
export type BoardSlot<T extends KindTypes, ParentMessage> = Readonly<{
  model: T['BoardModel']
  context: BoardContext<T>
  toParentMessage: (message: T['BoardMessage']) => ParentMessage
  controls: () => ReadonlyArray<Html>
}>

type BoardReturn<T extends KindTypes> = Update.ReturnWithOutMessage<
  T['BoardModel'],
  T['BoardMessage'],
  BoardOutMessage<T['Op']>
>

export type BoardHost<T extends KindTypes> = Readonly<{
  init: T['BoardModel']
  state: Lens<T['BoardModel'], BoardState>
  message: Lens<T['BoardMessage'], BoardMessage>
  update: (
    input: BoardInput<T>,
  ) => (model: T['BoardModel'], message: T['BoardMessage']) => BoardReturn<T>
  pressDelete: (
    input: BoardInput<T>,
  ) => (model: T['BoardModel']) => BoardReturn<T>
  /** Отменить начатый жест: шаг сменился, ход отменён, решение показывается. */
  interrupt: (model: T['BoardModel']) => T['BoardModel']
  /** Кадр анимации. */
  frame: (
    model: T['BoardModel'],
    deltaMs: number,
    input: Readonly<{ doc: T['Doc']; isReducedMotion: boolean }>,
  ) => T['BoardModel']
  /** Доска (и палитра). */
  view: <ParentMessage>(
    slot: BoardSlot<T, ParentMessage>,
    h: HtmlBuilder<ParentMessage>,
  ) => Html
  /** Приборы и транспорт под доской с кнопками плеера `slot.controls`. */
  instruments: <ParentMessage>(
    slot: BoardSlot<T, ParentMessage>,
    h: HtmlBuilder<ParentMessage>,
  ) => Html
}>

// SURFACES

/** Поверхность сообщает плееру ходы ученика: они попадают в журнал задачи
    так же, как ходы на доске. */
export type SurfaceOutMessage<Op> = Readonly<{
  _tag: 'ProducedOps'
  ops: ReadonlyArray<Op>
}>

export const SurfaceOutMessage = {
  ProducedOps: <Op>(ops: ReadonlyArray<Op>): SurfaceOutMessage<Op> => ({
    _tag: 'ProducedOps',
    ops,
  }),
}

export type SurfaceContext<T extends KindTypes> = Readonly<{
  doc: T['Doc']
  run: T['Run']
  /** `Edit`, пока задача открыта; иначе поверхность только показывает. */
  mode: BoardMode
  /** Устройство поверхности: `phone` у `wifi:phone`, пусто у `router`. */
  target: string
  label: (id: string) => Option.Option<EntityLabel>
  /** Эталон задачи, когда открыта третья подсказка: поверхность обводит
      нужное поле, не подставляя значения. */
  maybeGhost: Option.Option<ReadonlyArray<T['Op']>>
  unlocked: ReadonlyArray<string>
  newFeatures: ReadonlyArray<string>
}>

export type SurfaceSlot<T extends KindTypes, ParentMessage> = Readonly<{
  state: SurfaceState
  context: SurfaceContext<T>
  locale: Locale
  ui: UiStrings
  toParentMessage: (message: SurfaceMessage) => ParentMessage
}>

/** Поверхность задачи (план 3.2, 4.4): свой подмодуль Foldkit. Его Model и
    Message хранятся в общих union `SurfaceState` и `SurfaceMessage`. */
export type SurfaceDefinition<T extends KindTypes> = Readonly<{
  /** Начало id поверхности: `wifi` у `wifi:phone`. */
  type: string
  /** Поверхность видна, если открыт хотя бы один элемент `<feature>.*`. */
  feature: string
  init: (target: string) => SurfaceState
  update: (
    context: SurfaceContext<T>,
  ) => (
    state: SurfaceState,
    message: SurfaceMessage,
  ) => Update.ReturnWithOutMessage<
    SurfaceState,
    SurfaceMessage,
    SurfaceOutMessage<T['Op']>
  >
  tabLabel: (context: SurfaceContext<T>, ui: UiStrings) => string
  view: <ParentMessage>(
    slot: SurfaceSlot<T, ParentMessage>,
    h: HtmlBuilder<ParentMessage>,
  ) => Html
}>

// KIND

export type StageContract<Stage> = Readonly<{
  /** Цели элемента: каждая должна находиться на доске своего шага. */
  targets: (item: Stage) => ReadonlyArray<string>
  /** Ключ подписи, если элемент — подпись (`annotations` в текстах). */
  annotationKey: (item: Stage) => Option.Option<string>
  /** Строка журнала. */
  describe: (item: Stage) => string
}>

export type BoardKind<T extends KindTypes> = Readonly<{
  id: T['Id']
  /** Только для вывода типов (`defineLesson(flow, …)`): во время работы
      этого поля нет. */
  types?: T

  // DOCUMENT
  empty: T['Doc']
  apply: (doc: T['Doc'], op: T['Op']) => Result.Result<T['Doc'], T['Message']>
  run: (doc: T['Doc']) => T['Run']

  // GOALS
  checkGoal: (
    doc: T['Doc'],
    run: T['Run'],
    goal: T['Goal'],
  ) => GoalCheck<T['Message']>
  /** Скрытая цель: до проверки в карточке «проверяется прогоном». */
  isHiddenGoal: (goal: T['Goal']) => boolean
  /** Текст выполненной цели в решённой задаче вместо её обычного текста. */
  solvedGoalText: (
    goal: T['Goal'],
    doc: T['Doc'],
    ui: UiStrings,
  ) => Option.Option<string>
  /** Итог решённой задачи «было → стало». */
  outcome: (
    before: T['Doc'],
    after: T['Doc'],
    ui: UiStrings,
  ) => ReadonlyArray<OutcomeRow>

  // TEXT
  proseContext: (doc: T['Doc'], run: T['Run']) => T['Prose']
  annotationInput: (doc: T['Doc'], run: T['Run']) => T['Annotation']
  /** Цель ссылки `[[id|…]]`, подсветки или кандидата квиза на доске:
      устройство, связь (`link:…`), поле конверта (`env:…`), зона (`zone:…`). */
  resolveTarget: (doc: T['Doc'], target: string) => Option.Option<string>
  stage: StageContract<T['Stage']>
  /** Как назвать цель в тексте, если урок не дал ей подписи (`labels`). */
  targetName: (doc: T['Doc'], target: string, ui: UiStrings) => string
  /** Строка журнала. Язык операций не переводится, как код. */
  describeOp: (op: T['Op']) => string
  /** Текст кода на языке страницы; `name` — подпись сущности доски. */
  renderMessage: (
    locale: Locale,
    ui: UiStrings,
    message: T['Message'],
    name: (id: string) => string,
  ) => string

  // STORAGE
  op: Lens<T['Op'], KindOp>
  message: Lens<T['Message'], KindMessage>

  // UI
  board: BoardHost<T>
  surfaces: ReadonlyArray<SurfaceDefinition<T>>

  // QUIZZES
  /** Квизы, которые доска умеет показывать (`Choice` рисует карточка). */
  quizzes: ReadonlyArray<QuizKind>
  /** Картинка варианта `Choice` по ключу, например экран ошибки браузера. */
  picture: <ParentMessage>(
    key: string,
    ui: UiStrings,
    h: HtmlBuilder<ParentMessage>,
  ) => Option.Option<Html>
}>
