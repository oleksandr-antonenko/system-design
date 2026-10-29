import { Array, Option, Record, pipe } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { type Lesson, lessonTextFor } from '../courses/assemble'
import { courseLessons, findDefinition, findLesson } from '../courses/registry'
import { renderDomainMessage } from '../i18n/domainMessage'
import type { Locale } from '../i18n/locale'
import { type UiStrings, uiFor } from '../i18n/ui'
import type {
  BoardContext,
  BoardSlot,
  EntityLabel,
  KindTypes,
} from '../kinds/contract'
import type { KindMessage } from '../kinds/state'
import { courseUrl } from '../route'
import { laterInCourse, newInLesson } from './course'
import {
  type LessonDefinition,
  type TextsOf,
  lessonPalette,
  taskOf,
  withLesson,
} from './dsl'
import { type Paragraph, parseProse } from './markup'
import {
  CheckState,
  type CurrentTask,
  Message,
  type Model,
  activeSurface,
  boardMode,
  boardModelOf,
  currentDoc,
  currentTask,
  docAt,
  isEditable,
  isReplaying,
  maxAllowedStep,
  opsOf,
  surfaceContext,
  taskStartDoc,
  unlocksOf,
  visibleSurfaces,
} from './player'

export type PlayerViewInputs = Readonly<{
  locale: Locale
  prefersDark: boolean
}>

/** Урок, его тексты и язык страницы: то, что нужно каждой части вида. */
type Page<T extends KindTypes> = Readonly<{
  lesson: LessonDefinition<T>
  model: Model
  texts: TextsOf<T>
  locale: Locale
  ui: UiStrings
}>

// TEXT

const labelOf =
  <T extends KindTypes>(texts: TextsOf<T>) =>
  (id: string): Option.Option<EntityLabel> =>
    Option.fromNullishOr(texts.labels?.[id])

/** Текст кода сообщения: свой текст урока (`feedback`), иначе текст вида. */
const messageText = <T extends KindTypes>(
  page: Page<T>,
  stored: KindMessage,
): string =>
  Option.match(page.lesson.kind.message.unwrap(stored), {
    onNone: () => '',
    onSome: message => {
      const override = page.texts.feedback?.[message._tag]
      return override === undefined
        ? page.lesson.kind.renderMessage(page.ui, message)
        : typeof override === 'string'
          ? override
          : override(message)
    },
  })

// PROSE

const paragraphView = (paragraph: Paragraph, h: HtmlBuilder<Message>): Html =>
  h.p(
    [],
    Array.map(paragraph, inline => {
      if (inline._tag === 'Strong') {
        return h.strong([], [inline.text])
      }
      if (inline._tag === 'Ref') {
        return h.span(
          [
            h.Class('prose-ref'),
            h.Tabindex(0),
            h.OnMouseEnter(Message.HoveredReference({ id: inline.id })),
            h.OnMouseLeave(Message.LeftReference()),
            h.OnFocus(Message.HoveredReference({ id: inline.id })),
            h.OnBlur(Message.LeftReference()),
          ],
          [inline.text],
        )
      }
      return inline.text
    }),
  )

const proseView = (source: string, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('prose')],
    Array.map(parseProse(source), paragraph => paragraphView(paragraph, h)),
  )

// STEPS

const stepTitle = <T extends KindTypes>(
  texts: TextsOf<T>,
  id: string,
): string => texts.steps?.[id]?.title ?? id

const stepBody = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  texts: TextsOf<T>,
  id: string,
  doc: T['Doc'],
): string => {
  const body = texts.steps?.[id]?.body ?? ''
  return typeof body === 'string'
    ? body
    : body(lesson.kind.proseContext(doc, lesson.kind.run(doc)))
}

const stepLabel = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  index: number,
  ui: UiStrings,
): string =>
  Option.isSome(Option.flatMap(Array.get(lesson.steps, index), taskOf))
    ? `◆ ${ui.player.step(index + 1)}`
    : ui.player.step(index + 1)

const timelineView = <T extends KindTypes>(
  { lesson, model, texts, ui }: Page<T>,
  h: HtmlBuilder<Message>,
): Html => {
  const maxStep = maxAllowedStep(lesson, model)
  return h.div(
    [h.Class('timeline')],
    [
      h.ol(
        [
          h.Class('timeline-steps'),
          h.AriaLabel(ui.player.stepOf(model.step + 1, lesson.steps.length)),
        ],
        Array.map(lesson.steps, (lessonStep, index) =>
          h.keyed('li')(
            lessonStep.id,
            [],
            [
              h.button(
                [
                  h.Type('button'),
                  h.Class(
                    [
                      'timeline-step',
                      index < model.step ? 'done' : '',
                      index === model.step ? 'current' : '',
                      lessonStep.task === undefined ? '' : 'task',
                    ].join(' '),
                  ),
                  h.Title(stepTitle(texts, lessonStep.id)),
                  h.AriaLabel(
                    `${ui.player.step(index + 1)}: ${stepTitle(texts, lessonStep.id)}`,
                  ),
                  ...(index === model.step ? [h.AriaCurrent('step')] : []),
                  ...(index > maxStep
                    ? [h.Disabled(true)]
                    : [h.OnClick(Message.ClickedStep({ step: index }))]),
                ],
                [h.span([h.Class('bar')])],
              ),
            ],
          ),
        ),
      ),
      h.span(
        [h.Class('timeline-label')],
        [
          `${ui.player.stepOf(model.step + 1, lesson.steps.length)} · `,
          h.strong(
            [],
            [
              stepTitle(
                texts,
                Option.getOrElse(
                  Option.map(Array.get(lesson.steps, model.step), s => s.id),
                  () => '',
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  )
}

// TASK

const solvedSummaryView = <T extends KindTypes>(
  page: Page<T>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  Array.match(
    page.lesson.kind.outcome(
      taskStartDoc(page.lesson, page.model),
      currentDoc(page.lesson, page.model),
      page.ui,
    ),
    {
      onEmpty: () => [],
      onNonEmpty: rows => [
        h.dl(
          [h.Class('result')],
          Array.flatMap(rows, row => [
            h.dt([], [row.label]),
            row._tag === 'Compared'
              ? h.dd(
                  [],
                  [
                    h.span([h.Class('before')], [row.before]),
                    ' → ',
                    h.span([h.Class(`after ${row.trend}`)], [row.after]),
                  ],
                )
              : h.dd([], [row.value]),
          ]),
        ),
      ],
    },
  )

const taskCardView = <T extends KindTypes>(
  page: Page<T>,
  task: CurrentTask<T>,
  doc: T['Doc'],
  h: HtmlBuilder<Message>,
): Html => {
  const { lesson, model, texts, ui } = page
  const kind = lesson.kind
  const taskTexts = texts.tasks?.[task.spec.id]
  const isSolved = task.state.check._tag === 'Solved'
  const canEdit = isEditable(lesson, model)
  const replaying = isReplaying(lesson, model)
  const failedIndex =
    task.state.check._tag === 'Failed' ? task.state.check.goalIndex : -1
  const run = kind.run(doc)

  const goalItems = Array.map(task.spec.goals, ({ id, goal }, index) => {
    const label = taskTexts?.goals[id] ?? id
    const isHidden = kind.isHiddenGoal(goal)
    const isMet = isSolved || (!isHidden && kind.checkGoal(doc, run, goal).met)
    const isFailed = index === failedIndex
    const text =
      isHidden && !isMet && !isFailed
        ? ui.task.hiddenGoal
        : isSolved
          ? Option.getOrElse(kind.solvedGoalText(goal, doc, ui), () => label)
          : label
    return h.keyed('li')(
      id,
      [
        h.Class(
          isMet ? 'met' : isFailed ? 'failed' : isHidden ? 'hidden-goal' : '',
        ),
      ],
      [
        h.span(
          [h.Class('mark'), h.AriaHidden(true)],
          [isMet ? '✓' : isFailed ? '✕' : ''],
        ),
        h.span([], [text]),
      ],
    )
  })

  const feedback = CheckState.match(task.state.check, {
    Unchecked: () => h.empty,
    Failed: ({ failure }) =>
      h.div(
        [h.Class('feedback failed'), h.Role('alert')],
        [messageText(page, failure)],
      ),
    Solved: () =>
      h.div(
        [h.Class('solved-summary')],
        [
          h.div([h.Class('feedback solved')], [taskTexts?.solvedNote ?? '']),
          ...solvedSummaryView(page, h),
          h.div(
            [h.Class('task-actions')],
            [
              h.button(
                [
                  h.Type('button'),
                  h.Class('btn primary'),
                  h.OnClick(Message.ClickedNext()),
                ],
                [ui.task.continueLesson],
              ),
            ],
          ),
        ],
      ),
  })

  const hints = Array.take(taskTexts?.hints ?? [], task.state.hintsShown)
  const canShowSolution =
    !isSolved && (task.state.attempts >= 2 || task.state.hintsShown >= 3)

  return h.div(
    [h.Class(`task-card${isSolved ? ' solved' : ''}`)],
    [
      h.div(
        [h.Class('task-head')],
        [
          h.span([h.Class('diamond'), h.AriaHidden(true)]),
          isSolved && task.state.check._tag === 'Solved'
            ? task.state.check.withHint
              ? ui.task.solvedWithHint
              : ui.task.solved
            : ui.task.heading,
          ...(task.state.attempts > 0
            ? [
                h.span(
                  [h.Class('attempts')],
                  [ui.task.attempts(task.state.attempts)],
                ),
              ]
            : []),
        ],
      ),
      h.p([h.Class('task-prompt')], [taskTexts?.prompt ?? '']),
      ...(isSolved ? [] : [h.p([h.Class('task-how')], [ui.task.howTo])]),
      h.ul([h.Class('goals')], goalItems),
      feedback,
      ...(Array.isReadonlyArrayNonEmpty(hints) && !isSolved
        ? [
            h.ol(
              [h.Class('hints')],
              Array.map(hints, hint => h.li([], [hint])),
            ),
          ]
        : []),
      ...(isSolved
        ? []
        : [
            h.div(
              [h.Class('task-actions')],
              [
                h.button(
                  [
                    h.Type('button'),
                    h.Class('btn primary'),
                    ...(canEdit
                      ? [h.OnClick(Message.ClickedCheck())]
                      : [h.Disabled(true)]),
                  ],
                  [ui.task.check],
                ),
                h.button(
                  [
                    h.Type('button'),
                    h.Class('btn'),
                    ...(task.state.hintsShown >= 3 || replaying
                      ? [h.Disabled(true)]
                      : [h.OnClick(Message.ClickedHint())]),
                  ],
                  [ui.task.hint(task.state.hintsShown, 3)],
                ),
                ...(canShowSolution
                  ? [
                      h.button(
                        [
                          h.Type('button'),
                          h.Class('btn link'),
                          ...(replaying
                            ? [h.Disabled(true)]
                            : [h.OnClick(Message.ClickedShowSolution())]),
                        ],
                        [ui.task.showSolution],
                      ),
                    ]
                  : []),
              ],
            ),
          ]),
    ],
  )
}

// THEORY

// Кнопка «Далее» сразу под текстом шага: на высоком мониторе нижняя панель
// далеко от того места, где ученик дочитал. На шаге задачи её роль играет
// кнопка в карточке решённой задачи.
const inlineNextView = <T extends KindTypes>(
  { lesson, model, texts, ui }: Page<T>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  Option.match(Array.get(lesson.steps, model.step + 1), {
    onNone: () => [],
    onSome: nextStep => [
      h.div(
        [h.Class('step-next')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('btn primary'),
              h.OnClick(Message.ClickedNext()),
            ],
            [ui.player.nextTo(stepTitle(texts, nextStep.id))],
          ),
        ],
      ),
    ],
  })

const theoryView = <T extends KindTypes>(
  page: Page<T>,
  isFallback: boolean,
  shownIn: Locale,
  h: HtmlBuilder<Message>,
): Html => {
  const { lesson, model, texts, locale, ui } = page
  const order = Option.match(findLesson(model.course, lesson.slug), {
    onNone: () => 0,
    onSome: found => found.meta.order,
  })
  const maxStep = maxAllowedStep(lesson, model)
  const isLast = model.step === lesson.steps.length - 1
  const atUnsolvedTask =
    model.step === maxStep &&
    Option.isSome(currentTask(lesson, model)) &&
    !isLast &&
    maxStep < lesson.steps.length - 1

  return h.section(
    [h.AriaLabel(ui.lesson.theoryRegion), h.Class('theory')],
    [
      h.div(
        [h.Class('theory-scroll')],
        [
          h.a(
            [h.Href(courseUrl(locale, model.course)), h.Class('back-link')],
            [`← ${ui.lesson.backToCourse}`],
          ),
          h.p([h.Class('eyebrow')], [ui.home.lessonNumber(order)]),
          h.h1([h.Lang(shownIn), h.Class('lesson-title')], [texts.title]),
          isFallback
            ? h.p(
                [h.Role('note'), h.Class('fallback-note')],
                [
                  renderDomainMessage(ui.domain, {
                    _tag: 'LessonNotTranslated',
                    shownIn,
                  }),
                ],
              )
            : h.empty,
          ...Array.map(
            Array.take(lesson.steps, model.step + 1),
            (lessonStep, index) => {
              const isPast = index < model.step
              const doc = docAt(lesson, model, index)
              return h.keyed('article')(
                lessonStep.id,
                [
                  h.Class(`step${isPast ? ' past' : ' current'}`),
                  h.DataAttribute('step', `${index}`),
                  h.Lang(shownIn),
                  ...(isPast
                    ? [
                        h.OnClick(Message.ClickedStep({ step: index })),
                        h.Title(ui.player.revisit),
                      ]
                    : []),
                ],
                [
                  h.h2(
                    [],
                    [
                      h.span(
                        [h.Class('step-number')],
                        [stepLabel(lesson, index, ui)],
                      ),
                      stepTitle(texts, lessonStep.id),
                    ],
                  ),
                  proseView(stepBody(lesson, texts, lessonStep.id, doc), h),
                  ...(index === model.step
                    ? Option.match(currentTask(lesson, model), {
                        onNone: () => inlineNextView(page, h),
                        onSome: task => [taskCardView(page, task, doc, h)],
                      })
                    : []),
                ],
              )
            },
          ),
          ...(isLast
            ? [
                h.div(
                  [h.Class('finish')],
                  [
                    h.p([h.Class('eyebrow')], [ui.player.finishedTitle]),
                    h.p([], [ui.player.finishedBody]),
                  ],
                ),
              ]
            : []),
        ],
      ),
      h.nav(
        [h.Class('theory-nav')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('btn'),
              ...(model.step === 0
                ? [h.Disabled(true)]
                : [h.OnClick(Message.ClickedPrevious())]),
            ],
            [ui.player.prev],
          ),
          h.span(
            [h.Class('nav-text')],
            [
              atUnsolvedTask
                ? ui.player.solveFirst
                : isLast
                  ? ui.player.lessonEnd
                  : ui.player.navHint,
            ],
          ),
          h.button(
            [
              h.Type('button'),
              h.Class('btn primary'),
              ...(isLast || model.step >= maxStep
                ? [h.Disabled(true)]
                : [h.OnClick(Message.ClickedNext())]),
            ],
            [ui.player.next],
          ),
        ],
      ),
    ],
  )
}

// CONTROLS

/** Кнопки плеера под доской: вид доски ставит их в свои приборы. */
const controlsView = <T extends KindTypes>(
  { lesson, model, ui }: Page<T>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const editable = isEditable(lesson, model)
  const log = Option.match(currentTask(lesson, model), {
    onNone: () => [],
    onSome: task => task.state.log,
  })
  const redo = Option.match(currentTask(lesson, model), {
    onNone: () => [],
    onSome: task => task.state.redo,
  })
  return [
    h.button(
      [
        h.Type('button'),
        h.Class('btn'),
        ...(editable && Array.isReadonlyArrayNonEmpty(log)
          ? [h.OnClick(Message.ClickedUndo())]
          : [h.Disabled(true)]),
      ],
      [`↶ ${ui.hud.undo}`],
    ),
    h.button(
      [
        h.Type('button'),
        h.Class('btn'),
        ...(editable && Array.isReadonlyArrayNonEmpty(redo)
          ? [h.OnClick(Message.ClickedRedo())]
          : [h.Disabled(true)]),
      ],
      [`↷ ${ui.hud.redo}`],
    ),
    h.button(
      [
        h.Type('button'),
        h.Class('btn'),
        ...(editable && Array.isReadonlyArrayNonEmpty(log)
          ? [h.OnClick(Message.ClickedReset())]
          : [h.Disabled(true)]),
      ],
      [ui.hud.reset],
    ),
    h.span([h.Class('separator'), h.AriaHidden(true)]),
    h.button(
      [
        h.Type('button'),
        h.Class('btn'),
        h.AriaExpanded(model.isJournalOpen),
        h.OnClick(Message.ClickedJournalToggle()),
      ],
      [ui.hud.journal],
    ),
  ]
}

// JOURNAL

const journalView = <T extends KindTypes>(
  { lesson, model, texts, ui }: Page<T>,
  h: HtmlBuilder<Message>,
): Html => {
  const kind = lesson.kind
  const lessonStep = Array.get(lesson.steps, model.step)
  const script = Option.match(lessonStep, {
    onNone: () => [],
    onSome: found => [
      ...Array.map(found.ops, kind.describeOp),
      ...Array.map(found.stage, kind.stage.describe),
    ],
  })
  const mine = Option.match(currentTask(lesson, model), {
    onNone: () => [],
    onSome: task => Array.map(opsOf(kind, task.state.log), kind.describeOp),
  })
  const title = Option.match(lessonStep, {
    onNone: () => '',
    onSome: found => stepTitle(texts, found.id),
  })
  const list = (lines: ReadonlyArray<string>, empty: string) =>
    Array.isReadonlyArrayNonEmpty(lines)
      ? h.ol(
          [],
          Array.map(lines, line => h.li([], [h.code([], [line])])),
        )
      : h.p([h.Class('empty')], [empty])

  return h.section(
    [h.Class('journal'), h.AriaLabel(ui.hud.journal)],
    [
      h.div(
        [],
        [
          h.h3([], [ui.player.journalScript(title)]),
          list(script, ui.player.journalScriptEmpty),
        ],
      ),
      h.div(
        [],
        [
          h.h3([], [ui.player.journalMine]),
          list(mine, ui.player.journalMineEmpty),
        ],
      ),
      h.p([h.Class('note')], [ui.player.journalNote]),
    ],
  )
}

// BOARD

const boardContext = <T extends KindTypes>(
  page: Page<T>,
  inputs: PlayerViewInputs,
): BoardContext<T> => {
  const { lesson, model, texts, ui } = page
  const doc = currentDoc(lesson, model)
  const run = lesson.kind.run(doc)
  const task = currentTask(lesson, model)
  const order = Option.match(findLesson(model.course, lesson.slug), {
    onNone: () => 0,
    onSome: found => found.meta.order,
  })
  const course = courseLessons(model.course)
  const unlocks = unlocksOf(model)

  return {
    locale: inputs.locale,
    ui,
    prefersDark: inputs.prefersDark,
    isReducedMotion: model.isReducedMotion,
    doc,
    run,
    mode: boardMode(lesson, model),
    stage: Option.match(Array.get(lesson.steps, model.step), {
      onNone: () => [],
      onSome: found => found.stage,
    }),
    annotationText: key =>
      texts.annotations?.[key]?.(lesson.kind.annotationInput(doc, run)) ?? key,
    label: labelOf(texts),
    maybeTask: Option.map(task, ({ spec, state }) => ({
      palette: spec.palette,
      solution: spec.solution,
      isGhostShown: state.hintsShown >= 3 && state.check._tag !== 'Solved',
      focusNodes: state.check._tag === 'Failed' ? state.check.focusNodes : [],
      focusEdges: state.check._tag === 'Failed' ? state.check.focusEdges : [],
    })),
    maybeQuiz: Option.none(),
    palette: Option.match(task, {
      onNone: () => lessonPalette(lesson),
      onSome: ({ spec }) => spec.palette,
    }),
    newPalette: newInLesson(course, order),
    laterPalette: laterInCourse(course, order),
    maybeHoveredRef: model.maybeHoveredRef,
    unlocked: unlocks.unlocked,
    newFeatures: unlocks.newFeatures,
  }
}

const boardViews = <T extends KindTypes>(
  page: Page<T>,
  inputs: PlayerViewInputs,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const { lesson, model } = page
  return Option.match(boardModelOf(lesson, model), {
    onNone: () => [],
    onSome: boardModel => {
      const slot: BoardSlot<T, Message> = {
        model: boardModel,
        context: boardContext(page, inputs),
        toParentMessage: message =>
          Message.GotBoardMessage({
            message: lesson.kind.board.message.wrap(message),
          }),
        controls: () => controlsView(page, h),
      }
      return [
        lesson.kind.board.view(slot, h),
        lesson.kind.board.instruments(slot, h),
      ]
    },
  })
}

// SURFACES

const surfaceHostView = <T extends KindTypes>(
  page: Page<T>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const { lesson, model, texts, locale, ui } = page
  const label = labelOf(texts)
  return Array.match(visibleSurfaces(lesson, model), {
    onEmpty: () => [],
    onNonEmpty: surfaces => {
      const maybeActive = activeSurface(lesson, model)
      const isActive = (id: string) =>
        Option.exists(maybeActive, active => active.id === id)
      return [
        h.section(
          [h.Class('surface-host'), h.AriaLabel(ui.task.surfaces)],
          [
            h.div(
              [h.Class('surface-tabs'), h.Role('tablist')],
              Array.map(surfaces, surface =>
                h.keyed('button')(
                  surface.id,
                  [
                    h.Type('button'),
                    h.Role('tab'),
                    h.Id(`surface-tab-${surface.id}`),
                    h.AriaSelected(isActive(surface.id)),
                    h.AriaControls('surface-panel'),
                    h.Class(
                      isActive(surface.id)
                        ? 'surface-tab active'
                        : 'surface-tab',
                    ),
                    h.OnClick(
                      Message.ClickedSurfaceTab({ surface: surface.id }),
                    ),
                  ],
                  [
                    surface.definition.tabLabel(
                      surfaceContext(lesson, model, surface.target, label),
                      ui,
                    ),
                  ],
                ),
              ),
            ),
            Option.match(maybeActive, {
              onNone: () => h.empty,
              onSome: surface =>
                h.div(
                  [
                    h.Class('surface-panel'),
                    h.Id('surface-panel'),
                    h.Role('tabpanel'),
                    h.AriaLabelledBy(`surface-tab-${surface.id}`),
                  ],
                  [
                    Option.match(Record.get(model.surfaces, surface.id), {
                      onNone: () => h.empty,
                      onSome: state =>
                        surface.definition.view(
                          {
                            state,
                            context: surfaceContext(
                              lesson,
                              model,
                              surface.target,
                              label,
                            ),
                            locale,
                            ui,
                            toParentMessage: message =>
                              Message.GotSurfaceMessage({
                                surfaceId: surface.id,
                                message,
                              }),
                          },
                          h,
                        ),
                    }),
                  ],
                ),
            }),
          ],
        ),
      ]
    },
  })
}

// PLAYER

export const lessonView = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  entry: Lesson,
  model: Model,
  inputs: PlayerViewInputs,
  h: HtmlBuilder<Message>,
): Html => {
  const ui = uiFor(inputs.locale)
  const choice = lessonTextFor(entry, inputs.locale)
  const page: Page<T> = {
    lesson,
    model,
    texts: choice.text,
    locale: inputs.locale,
    ui,
  }
  return h.main(
    [h.Class('lesson-page')],
    [
      timelineView(page, h),
      h.div(
        [h.Class('lesson-main')],
        [
          theoryView(page, choice.isFallback, choice.shownIn, h),
          h.section(
            [h.AriaLabel(ui.lesson.boardRegion), h.Class('board-side')],
            [
              ...boardViews(page, inputs, h),
              ...surfaceHostView(page, h),
              ...(model.isJournalOpen ? [journalView(page, h)] : []),
            ],
          ),
        ],
      ),
      Option.match(model.maybeToast, {
        onNone: () => h.empty,
        onSome: message =>
          h.div(
            [h.Class('toast'), h.Role('status')],
            [messageText(page, message)],
          ),
      }),
    ],
  )
}

export const view = Submodel.defineView<Model, Message, PlayerViewInputs>(
  (model, inputs, h) =>
    pipe(
      Option.all([
        findDefinition(model.course, model.slug),
        findLesson(model.course, model.slug),
      ]),
      Option.match({
        onNone: () => h.empty,
        onSome: ([lesson, entry]) =>
          withLesson(
            lesson,
            <T extends KindTypes>(definition: LessonDefinition<T>) =>
              lessonView(definition, entry, model, inputs, h),
          ),
      }),
    ),
)
