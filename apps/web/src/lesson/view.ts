import { Array, Option, pipe } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { type BoardViewInputs, view as boardView } from '../board/view'
import { type BoardDoc, BoardOp } from '../domain/board'
import { checkGoal, isHiddenGoal } from '../domain/goals'
import { simulate } from '../domain/simulate'
import { renderDomainMessage } from '../i18n/domainMessage'
import type { Locale } from '../i18n/locale'
import { type UiStrings, uiFor } from '../i18n/ui'
import { lessonTextFor } from '../lessons/assemble'
import { findDefinition, findLesson } from '../lessons/registry'
import { homeUrl } from '../route'
import { shownSimulation } from './anim'
import {
  type LessonDefinition,
  type LooseLessonTexts,
  type StageItem,
  type Tone,
  resolveTarget,
  taskOf,
} from './dsl'
import { ghostPlan } from './ghost'
import { type Paragraph, parseProse } from './markup'
import {
  CheckState,
  type CurrentTask,
  Message,
  type Model,
  currentDoc,
  currentTask,
  docAt,
  isEditable,
  isReplaying,
  maxAllowedStep,
} from './player'

export type PlayerViewInputs = Readonly<{
  locale: Locale
  prefersDark: boolean
}>

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

const stepTitle = (texts: LooseLessonTexts, id: string): string =>
  texts.steps?.[id]?.title ?? id

const stepBody = (
  texts: LooseLessonTexts,
  id: string,
  doc: BoardDoc,
): string => {
  const body = texts.steps?.[id]?.body ?? ''
  return typeof body === 'string'
    ? body
    : body({ sim: simulate(doc, doc.load), doc })
}

const stepLabel = (
  lesson: LessonDefinition,
  index: number,
  ui: UiStrings,
): string =>
  Option.isSome(Option.flatMap(Array.get(lesson.steps, index), taskOf))
    ? `◆ ${ui.player.step(index + 1)}`
    : ui.player.step(index + 1)

const timelineView = (
  lesson: LessonDefinition,
  model: Model,
  texts: LooseLessonTexts,
  ui: UiStrings,
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

const percentList = (values: ReadonlyArray<number>, ui: UiStrings): string =>
  Array.map(values, ui.hud.percent).join(' / ')

const taskCardView = (
  lesson: LessonDefinition,
  model: Model,
  task: CurrentTask,
  texts: LooseLessonTexts,
  doc: BoardDoc,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): Html => {
  const taskTexts = texts.tasks?.[task.spec.id]
  const isSolved = task.state.check._tag === 'Solved'
  const canEdit = isEditable(lesson, model)
  const replaying = isReplaying(lesson, model)
  const failedIndex =
    task.state.check._tag === 'Failed' ? task.state.check.goalIndex : -1

  const goalItems = Array.map(task.spec.goals, ({ id, goal }, index) => {
    const label = taskTexts?.goals[id] ?? id
    const isHidden = isHiddenGoal(goal)
    const isMet = isSolved || (!isHidden && checkGoal(doc, goal).met)
    const isFailed = index === failedIndex
    const text =
      isHidden && !isMet && !isFailed
        ? ui.task.hiddenGoal
        : isHidden && isSolved && task.state.check._tag === 'Solved'
          ? ui.task.metricGoalPassed(doc.load, task.state.check.after.errorRate)
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
        [renderDomainMessage(ui.domain, failure)],
      ),
    Solved: ({ before, after }) =>
      h.div(
        [h.Class('solved-summary')],
        [
          h.div([h.Class('feedback solved')], [taskTexts?.solvedNote ?? '']),
          h.dl(
            [h.Class('result')],
            [
              h.dt([], [ui.task.resultErrors]),
              h.dd(
                [],
                [
                  h.span(
                    [h.Class('before')],
                    [ui.hud.percent(before.errorRate)],
                  ),
                  ' → ',
                  h.span([h.Class('after')], [ui.hud.percent(after.errorRate)]),
                ],
              ),
              h.dt([], [ui.task.resultP95]),
              h.dd(
                [],
                [
                  h.span(
                    [h.Class('before')],
                    [
                      Option.match(before.p95, {
                        onNone: () => '—',
                        onSome: ui.hud.ms,
                      }),
                    ],
                  ),
                  ' → ',
                  h.span(
                    [h.Class('after')],
                    [
                      Option.match(after.p95, {
                        onNone: () => '—',
                        onSome: ui.hud.ms,
                      }),
                    ],
                  ),
                ],
              ),
              h.dt([], [ui.task.resultServers]),
              h.dd([], [percentList(after.serverUtilization, ui)]),
              h.dt([], [ui.task.resultCost]),
              h.dd(
                [],
                [
                  `${ui.hud.perHour(before.costPerHour)} → ${ui.hud.perHour(after.costPerHour)}`,
                ],
              ),
            ],
          ),
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

const theoryView = (
  lesson: LessonDefinition,
  model: Model,
  texts: LooseLessonTexts,
  isFallback: boolean,
  shownIn: Locale,
  locale: Locale,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): Html => {
  const lessonMeta = findLesson(lesson.slug)
  const order = Option.match(lessonMeta, {
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
            [h.Href(homeUrl(locale)), h.Class('back-link')],
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
                  proseView(stepBody(texts, lessonStep.id, doc), h),
                  ...(index === model.step
                    ? Option.match(currentTask(lesson, model), {
                        onNone: () => [],
                        onSome: task => [
                          taskCardView(lesson, model, task, texts, doc, ui, h),
                        ],
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

// HUD

const sparkView = (
  values: ReadonlyArray<number>,
  max: number,
  className: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.svg(
    [h.ViewBox('0 0 76 22'), h.Class('spark'), h.AriaHidden(true)],
    [
      h.polyline([
        h.Class(className),
        h.Points(
          Array.map(
            values,
            (value, index) =>
              `${((index / 89) * 76).toFixed(1)},${(21 - Math.min(value / max, 1) * 19).toFixed(1)}`,
          ).join(' '),
        ),
      ]),
    ],
  )

const hudView = (
  lesson: LessonDefinition,
  model: Model,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): Html => {
  const anim = model.anim
  const editable = isEditable(lesson, model)
  const log = Option.match(currentTask(lesson, model), {
    onNone: () => [],
    onSome: task => task.state.log,
  })
  const redo = Option.match(currentTask(lesson, model), {
    onNone: () => [],
    onSome: task => task.state.redo,
  })
  const errorClass =
    anim.hudErrorRate > 0.05
      ? 'value bad'
      : anim.hudErrorRate > 0.01
        ? 'value warn'
        : 'value'
  const p95 = Option.getOrElse(anim.hudP95, () => 0)
  const p95Class = p95 > 600 ? 'value bad' : p95 > 250 ? 'value warn' : 'value'

  return h.section(
    [h.AriaLabel(ui.lesson.instrumentsRegion), h.Class('hud')],
    [
      h.div(
        [h.Class('metrics')],
        [
          h.div(
            [h.Class('metric')],
            [
              h.span([h.Class('label')], [ui.hud.load]),
              h.span([h.Class('value')], [ui.hud.rps(anim.hudLoad)]),
            ],
          ),
          h.div(
            [h.Class('metric')],
            [
              h.span([h.Class('label')], [ui.hud.errors]),
              h.span(
                [h.Class(errorClass)],
                [ui.hud.percent(anim.hudErrorRate)],
              ),
              sparkView(anim.sparkErrors, 0.6, 'spark-errors', h),
            ],
          ),
          h.div(
            [h.Class('metric')],
            [
              h.span([h.Class('label')], [ui.hud.p95]),
              h.span(
                [h.Class(p95Class)],
                [
                  Option.match(anim.hudP95, {
                    onNone: () => '—',
                    onSome: ui.hud.ms,
                  }),
                ],
              ),
              sparkView(anim.sparkP95, 1400, 'spark-p95', h),
            ],
          ),
          h.div(
            [h.Class('metric')],
            [
              h.span([h.Class('label')], [ui.hud.database]),
              h.span([h.Class('value')], [ui.hud.rps(anim.hudDatabase)]),
            ],
          ),
          h.div(
            [h.Class('metric')],
            [
              h.span([h.Class('label')], [ui.hud.cost]),
              h.span(
                [h.Class('value')],
                [ui.hud.perHour(shownSimulationCost(lesson, model))],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('controls')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('btn'),
              h.AriaPressed(anim.isRunning ? 'false' : 'true'),
              h.OnClick(Message.ClickedPlayPause()),
            ],
            [anim.isRunning ? `❚❚ ${ui.hud.pause}` : `▶ ${ui.hud.play}`],
          ),
          h.div(
            [h.Class('segmented'), h.Role('group'), h.AriaLabel(ui.hud.speed)],
            Array.map([1, 2, 4], speed =>
              h.keyed('button')(
                `speed-${speed}`,
                [
                  h.Type('button'),
                  h.AriaPressed(anim.speed === speed ? 'true' : 'false'),
                  h.OnClick(Message.ClickedSpeed({ speed })),
                ],
                [`×${speed}`],
              ),
            ),
          ),
          h.span([h.Class('separator'), h.AriaHidden(true)]),
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
        ],
      ),
      h.div(
        [h.Class('legend')],
        [
          h.span([], [h.i([h.Class('dot ok')]), ui.hud.legendOk]),
          h.span([], [h.i([h.Class('dot warn')]), ui.hud.legendHot]),
          h.span([], [h.i([h.Class('dot bad')]), ui.hud.legendLost]),
          h.span([h.Class('model-note')], [ui.hud.modelNote]),
        ],
      ),
    ],
  )
}

const shownSimulationCost = (lesson: LessonDefinition, model: Model): number =>
  shownSimulation(model.anim, currentDoc(lesson, model)).costPerHour

// JOURNAL

const opText = (op: BoardOp): string =>
  BoardOp.match(op, {
    AddNode: ({ id, kind }) => `AddNode ${id} · ${kind}`,
    RemoveNode: ({ id }) => `RemoveNode ${id}`,
    MoveNode: ({ id, x, y }) => `MoveNode ${id} → (${x}, ${y})`,
    Connect: ({ from, to }) => `Connect ${from} → ${to}`,
    Disconnect: ({ from, to }) => `Disconnect ${from} → ${to}`,
    SetLoad: ({ rps }) => `SetLoad ${rps} rps`,
    FailNode: ({ id }) => `FailNode ${id}`,
    RecoverNode: ({ id }) => `RecoverNode ${id}`,
  })

const stageText = (item: StageItem): string =>
  item._tag === 'Highlight'
    ? `Highlight ${typeof item.target === 'string' ? item.target : item.target.kind} · ${item.tone}`
    : `Annotate ${typeof item.target === 'string' ? item.target : item.target.kind} · ${item.key}`

const journalView = (
  lesson: LessonDefinition,
  model: Model,
  texts: LooseLessonTexts,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): Html => {
  const lessonStep = Array.get(lesson.steps, model.step)
  const script = Option.match(lessonStep, {
    onNone: () => [],
    onSome: found => [
      ...Array.map(found.ops, opText),
      ...Array.map(found.stage, stageText),
    ],
  })
  const mine = Option.match(currentTask(lesson, model), {
    onNone: () => [],
    onSome: task => Array.map(task.state.log, opText),
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

// BOARD INPUTS

const toneOf = (
  tone: Tone | ((sim: ReturnType<typeof simulate>) => Tone),
  sim: ReturnType<typeof simulate>,
): Tone => (typeof tone === 'function' ? tone(sim) : tone)

const boardInputs = (
  lesson: LessonDefinition,
  model: Model,
  texts: LooseLessonTexts,
  inputs: PlayerViewInputs,
): BoardViewInputs => {
  const doc = currentDoc(lesson, model)
  const steady = simulate(doc, doc.load)
  const stage = Option.match(Array.get(lesson.steps, model.step), {
    onNone: () => [],
    onSome: found => found.stage,
  })
  const task = currentTask(lesson, model)
  const failed = Option.flatMap(task, ({ state }) =>
    state.check._tag === 'Failed' ? Option.some(state.check) : Option.none(),
  )
  const stageHalos = Array.getSomes(
    Array.map(stage, item =>
      item._tag === 'Highlight'
        ? Option.map(resolveTarget(doc, item.target), id => ({
            id,
            tone: item.tone,
          }))
        : Option.none(),
    ),
  )
  const focusHalos = Option.match(failed, {
    onNone: () => [],
    onSome: ({ focusNodes }) =>
      Array.map(focusNodes, id => ({ id, tone: 'bad' as const })),
  })
  const annotations = Array.getSomes(
    Array.map(stage, item =>
      item._tag === 'Annotate'
        ? Option.map(resolveTarget(doc, item.target), id => ({
            id,
            text: texts.annotations?.[item.key]?.(steady) ?? item.key,
            tone: toneOf(item.tone, steady),
          }))
        : Option.none(),
    ),
  )
  const ghost = Option.flatMap(task, ({ spec, state }) =>
    state.hintsShown >= 3 && state.check._tag !== 'Solved'
      ? Option.some(ghostPlan(doc, spec.solution))
      : Option.none(),
  )

  return {
    locale: inputs.locale,
    doc,
    mode: isEditable(lesson, model)
      ? 'Edit'
      : isReplaying(lesson, model)
        ? 'Replay'
        : 'View',
    palette: Option.match(task, {
      onNone: () => ['lb', 'server'],
      onSome: ({ spec }) => spec.palette,
    }),
    halos: [...stageHalos, ...focusHalos],
    annotations,
    focusEdges: Option.match(failed, {
      onNone: () => [],
      onSome: ({ focusEdges }) => focusEdges,
    }),
    ghost,
    maybeHoveredRef: model.maybeHoveredRef,
    flows: {
      clock: model.anim.clock,
      nodeUtil: model.anim.nodeUtil,
      nodeIncoming: model.anim.nodeIncoming,
      edgeFlow: model.anim.edgeFlow,
    },
    sim: shownSimulation(model.anim, doc),
    prefersDark: inputs.prefersDark,
    isReducedMotion: model.isReducedMotion,
  }
}

// PLAYER

export const view = Submodel.defineView<Model, Message, PlayerViewInputs>(
  (model, inputs, h) =>
    pipe(
      Option.all([findDefinition(model.slug), findLesson(model.slug)]),
      Option.match({
        onNone: () => h.empty,
        onSome: ([lesson, lessonEntry]) => {
          const ui = uiFor(inputs.locale)
          const choice = lessonTextFor(lessonEntry, inputs.locale)
          return h.main(
            [h.Class('lesson-page')],
            [
              timelineView(lesson, model, choice.text, ui, h),
              h.div(
                [h.Class('lesson-main')],
                [
                  theoryView(
                    lesson,
                    model,
                    choice.text,
                    choice.isFallback,
                    choice.shownIn,
                    inputs.locale,
                    ui,
                    h,
                  ),
                  h.section(
                    [h.AriaLabel(ui.lesson.boardRegion), h.Class('board-side')],
                    [
                      h.submodel({
                        slotId: 'board',
                        model: model.board,
                        view: boardView,
                        toParentMessage: message =>
                          Message.GotBoardMessage({ message }),
                        viewInputs: boardInputs(
                          lesson,
                          model,
                          choice.text,
                          inputs,
                        ),
                      }),
                      hudView(lesson, model, ui, h),
                      ...(model.isJournalOpen
                        ? [journalView(lesson, model, choice.text, ui, h)]
                        : []),
                    ],
                  ),
                ],
              ),
              Option.match(model.maybeToast, {
                onNone: () => h.empty,
                onSome: message =>
                  h.div(
                    [h.Class('toast'), h.Role('status')],
                    [renderDomainMessage(ui.domain, message)],
                  ),
              }),
            ],
          )
        },
      }),
    ),
)
