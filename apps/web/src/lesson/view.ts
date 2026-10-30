import { Array, Option, Record, pipe } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { type LocalizedText, lessonTextFor, textFor } from '../courses/assemble'
import type { LessonMeta, LessonText } from '../courses/model'
import {
  courseLessons,
  coursePaletteMode,
  findDefinition,
  findLesson,
  lessonsOf,
  loadedLesson,
} from '../courses/registry'
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
import { courseUrl, lessonUrl } from '../route'
import { laterInCourse, newInLesson } from './course'
import {
  type LessonDefinition,
  type TextsOf,
  lessonPalette,
  taskOf,
  withLesson,
} from './dsl'
import { type Paragraph, parseBlocks } from './markup'
import {
  CheckState,
  type CurrentQuiz,
  type CurrentTask,
  Message,
  type Model,
  activeSurface,
  boardMode,
  boardModelOf,
  boardStage,
  correctAnswer,
  currentDoc,
  currentQuiz,
  currentTask,
  docAt,
  isEditable,
  isPicking,
  isReplaying,
  isTextShown,
  maxAllowedStep,
  opsOf,
  surfaceContext,
  taskStartDoc,
  unlocksOf,
  visibleSurfaces,
} from './player'
import {
  isBoardQuiz,
  isCorrectPick,
  isMultiPick,
  pairOf,
  pickParts,
} from './quiz'

export type PlayerViewInputs = Readonly<{
  locale: Locale
  prefersDark: boolean
  /** Markup the page adds after the last step of this lesson (a slot built
      by the parent, in its own boundary). */
  lessonEnd?: (() => Html) | undefined
}>

/** Урок, его тексты и язык страницы: то, что нужно каждой части вида. */
type Page<T extends KindTypes> = Readonly<{
  lesson: LessonDefinition<T>
  model: Model
  texts: TextsOf<T>
  locale: Locale
  ui: UiStrings
  lessonEnd?: (() => Html) | undefined
}>

// TEXT

const labelOf =
  <T extends KindTypes>(texts: TextsOf<T>) =>
  (id: string): Option.Option<EntityLabel> =>
    Option.fromNullishOr(texts.labels?.[id])

/** Текст кода сообщения вида: свой текст урока (`feedback`), иначе текст
    вида. */
const kindMessageText = <T extends KindTypes>(
  page: Page<T>,
  message: T['Message'],
): string => {
  const override = page.texts.feedback?.[message._tag]
  return override === undefined
    ? page.lesson.kind.renderMessage(page.locale, page.ui, message, id =>
        Option.match(labelOf(page.texts)(id), {
          onNone: () => id,
          onSome: label => label.name,
        }),
      )
    : typeof override === 'string'
      ? override
      : override(message)
}

const messageText = <T extends KindTypes>(
  page: Page<T>,
  stored: KindMessage,
): string =>
  Option.match(page.lesson.kind.message.unwrap(stored), {
    onNone: () => '',
    onSome: message => kindMessageText(page, message),
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

const listView = (
  items: ReadonlyArray<Paragraph>,
  h: HtmlBuilder<Message>,
): Html =>
  h.ul(
    [],
    Array.map(items, item => h.li([], [paragraphView(item, h)])),
  )

const proseView = (source: string, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('prose')],
    Array.map(parseBlocks(source), block =>
      block._tag === 'Paragraph'
        ? paragraphView(block.inlines, h)
        : listView(block.items, h),
    ),
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
            [
              h.Class(
                lessonStep.task === undefined
                  ? 'timeline-item'
                  : 'timeline-item task',
              ),
            ],
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
      ...(isSolved
        ? []
        : [h.p([h.Class('task-how')], [page.lesson.kind.taskHowTo(ui)])]),
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
  isLocked: boolean,
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
              ...(isLocked
                ? [h.Disabled(true)]
                : [h.OnClick(Message.ClickedNext())]),
            ],
            [ui.player.nextTo(stepTitle(texts, nextStep.id))],
          ),
        ],
      ),
    ],
  })

// QUIZ

/** Как назвать вариант квиза: текст варианта `Choice`, подпись урока или
    имя цели на доске. */
const candidateName = <T extends KindTypes>(
  page: Page<T>,
  quiz: CurrentQuiz<T>,
  doc: T['Doc'],
  candidate: string,
): string => {
  const quizTexts = page.texts.quizzes?.[quiz.spec.id]
  const name = (id: string): string =>
    quizTexts?.options?.[id] ??
    quizTexts?.slots?.[id] ??
    (quiz.spec.kind === 'Choice'
      ? id
      : Option.match(labelOf(page.texts)(id), {
          onNone: () => page.lesson.kind.targetName(doc, id, page.ui),
          onSome: label => label.name,
        }))
  return quiz.spec.slots === undefined
    ? Array.map(pickParts(candidate), name).join(', ')
    : Array.map(pickParts(candidate), part => {
        const [slot, chip] = pairOf(part)
        return `${name(slot)} — ${name(chip)}`
      }).join('; ')
}

/** Почему неверны выбранные варианты: у квиза с несколькими ответами —
    каждый лишний вариант и каждый пропущенный верный (`withMissed`), у
    `Match` — каждый чип не на своём месте. */
const wrongParts = (
  picked: string,
  answer: string,
  withMissed: boolean,
): ReadonlyArray<string> => {
  const expected = pickParts(answer)
  const chosen = pickParts(picked)
  return [
    ...Array.getSomes(
      Array.map(chosen, part =>
        Array.contains(expected, part)
          ? Option.none()
          : Option.some(part.includes('=') ? pairOf(part)[1] : part),
      ),
    ),
    ...(withMissed
      ? Array.filter(expected, part => !Array.contains(chosen, part))
      : []),
  ]
}

const choicesView = <T extends KindTypes>(
  page: Page<T>,
  quiz: CurrentQuiz<T>,
  doc: T['Doc'],
  answer: string,
  h: HtmlBuilder<Message>,
): Html => {
  const isAnswered = Option.isSome(quiz.maybeAnswer)
  return h.div(
    [
      h.Class('quiz-options'),
      h.Role('group'),
      h.AriaLabel(page.ui.quiz.choices),
    ],
    Array.map(quiz.spec.candidates, candidate => {
      const isPicked = Option.exists(
        quiz.maybeAnswer,
        ({ picked }) => picked === candidate,
      )
      const state =
        isAnswered && candidate === answer ? ' right' : isPicked ? ' wrong' : ''
      const picture = Option.flatMap(
        Option.fromNullishOr(quiz.spec.pictures?.[candidate]),
        key => page.lesson.kind.picture(key, page.ui, h),
      )
      return h.keyed('button')(
        candidate,
        [
          h.Type('button'),
          h.Class(`quiz-option${state}`),
          h.AriaPressed(isPicked ? 'true' : 'false'),
          ...(isAnswered
            ? [h.Disabled(true)]
            : [h.OnClick(Message.ClickedChoice({ candidate }))]),
        ],
        [
          ...Option.toArray(picture),
          h.span([], [candidateName(page, quiz, doc, candidate)]),
        ],
      )
    }),
  )
}

const quizCardView = <T extends KindTypes>(
  page: Page<T>,
  quiz: CurrentQuiz<T>,
  doc: T['Doc'],
  h: HtmlBuilder<Message>,
): Html => {
  const { ui } = page
  const quizTexts = page.texts.quizzes?.[quiz.spec.id]
  const answer = correctAnswer(page.lesson, page.model, quiz.spec)
  const isChoice = !isBoardQuiz(quiz.spec)
  return Option.match(quiz.maybeAnswer, {
    onNone: () =>
      h.div(
        [h.Class('quiz-card')],
        [
          h.div(
            [h.Class('quiz-head')],
            [
              h.span([h.Class('mark'), h.AriaHidden(true)], ['?']),
              ui.quiz.heading,
            ],
          ),
          h.p([h.Class('quiz-question')], [quizTexts?.question ?? '']),
          isChoice
            ? choicesView(page, quiz, doc, answer, h)
            : h.p([h.Class('quiz-how')], [ui.quiz.pickOnBoard]),
          h.p([h.Class('quiz-attempt')], [ui.quiz.oneAttempt]),
        ],
      ),
    onSome: ({ picked, isCorrect }) =>
      h.div(
        [h.Class(`quiz-card answered ${isCorrect ? 'right' : 'wrong'}`)],
        [
          h.div(
            [h.Class('quiz-head')],
            [
              h.span(
                [h.Class('mark'), h.AriaHidden(true)],
                [isCorrect ? '✓' : '✕'],
              ),
              isCorrect ? ui.quiz.correct : ui.quiz.incorrect,
            ],
          ),
          h.p([h.Class('quiz-question')], [quizTexts?.question ?? '']),
          ...(isChoice ? [choicesView(page, quiz, doc, answer, h)] : []),
          h.div(
            [h.Class('quiz-result'), h.Role('status')],
            [
              ...(isCorrect || isCorrectPick(picked, answer)
                ? []
                : Array.getSomes(
                    Array.map(
                      wrongParts(
                        picked,
                        answer,
                        isMultiPick(quiz.spec) && quiz.spec.slots === undefined,
                      ),
                      part =>
                        Option.map(
                          Option.fromNullishOr(quizTexts?.wrong?.[part]),
                          wrong => h.p([h.Class('quiz-wrong')], [wrong]),
                        ),
                    ),
                  )),
              h.p(
                [h.Class('quiz-answer')],
                [ui.quiz.answerWas(candidateName(page, quiz, doc, answer))],
              ),
              proseView(quizTexts?.explain ?? '', h),
            ],
          ),
        ],
      ),
  })
}

/** Сворачиваемый блок «Подробнее» шага. */
const moreView = <T extends KindTypes>(
  { model, texts, ui }: Page<T>,
  stepId: string,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  Option.match(Option.fromNullishOr(texts.steps?.[stepId]?.more), {
    onNone: () => [],
    onSome: more => {
      const isOpen = Array.contains(model.openMore, stepId)
      return [
        h.div(
          [h.Class(`step-more${isOpen ? ' open' : ''}`)],
          [
            h.button(
              [
                h.Type('button'),
                h.Class('more-toggle'),
                h.AriaExpanded(isOpen),
                h.AriaControls(`more-${stepId}`),
                h.OnClick(Message.ClickedMore({ stepId })),
              ],
              [
                h.span([h.Class('more-title')], [more.title]),
                h.span([h.Class('more-badge')], [ui.player.moreBadge]),
              ],
            ),
            ...(isOpen
              ? [
                  h.div(
                    [h.Id(`more-${stepId}`), h.Class('more-body')],
                    [proseView(more.body, h)],
                  ),
                ]
              : []),
          ],
        ),
      ]
    },
  })

/** «Как спросить ИИ» на шаге-итоге: шаблон вопроса с кнопкой. */
const askAiView = <T extends KindTypes>(
  { model, texts, ui }: Page<T>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  Option.match(Option.fromNullishOr(texts.askAi), {
    onNone: () => [],
    onSome: askAi => [
      h.section(
        [h.Class('ask-ai'), h.AriaLabel(ui.player.askAiTitle)],
        [
          h.h3([], [ui.player.askAiTitle]),
          proseView(askAi.lead, h),
          h.blockquote([h.Class('ask-ai-template')], [askAi.template]),
          h.div(
            [h.Class('ask-ai-actions')],
            [
              h.button(
                [
                  h.Type('button'),
                  h.Class('btn'),
                  h.OnClick(
                    Message.ClickedCopyAskAi({ template: askAi.template }),
                  ),
                ],
                [ui.player.copy],
              ),
              ...(model.isAskAiCopied
                ? [
                    h.span(
                      [h.Class('ask-ai-copied'), h.Role('status')],
                      [ui.player.copied],
                    ),
                  ]
                : []),
            ],
          ),
          ...Option.match(Option.fromNullishOr(askAi.note), {
            onNone: () => [],
            onSome: note => [proseView(note, h)],
          }),
        ],
      ),
    ],
  })

/** Конец урока: ссылка на следующий урок курса. После последнего урока
    курса — конец курса и дорога к программе. */
const finishView = <T extends KindTypes>(
  page: Page<T>,
  h: HtmlBuilder<Message>,
): Html => {
  const { lesson, model, locale, ui } = page
  const lessons = lessonsOf(model.course)
  const maybeNext = pipe(
    Array.findFirstIndex(lessons, entry => entry.meta.slug === lesson.slug),
    Option.flatMap(index => Array.get(lessons, index + 1)),
  )
  const backToCourse = h.p(
    [],
    [
      h.a(
        [h.Href(courseUrl(locale, model.course))],
        [`← ${ui.lesson.backToCourse}`],
      ),
    ],
  )

  return h.div(
    [h.Class('finish')],
    Option.match(maybeNext, {
      onNone: () => [
        h.p([h.Class('eyebrow')], [ui.player.courseFinishedTitle]),
        h.p([], [ui.player.courseFinishedBody]),
        backToCourse,
      ],
      onSome: next => {
        const { text } = lessonTextFor(next, locale)
        return [
          h.p([h.Class('eyebrow')], [ui.player.finishedTitle]),
          ...(next.meta.available
            ? [
                h.p(
                  [],
                  [
                    h.a(
                      [
                        h.Href(
                          lessonUrl({
                            locale,
                            course: model.course,
                            slug: next.meta.slug,
                            step: Option.none(),
                          }),
                        ),
                      ],
                      [ui.player.nextLesson(text.title)],
                    ),
                  ],
                ),
              ]
            : [h.p([], [ui.player.finishedBody]), backToCourse]),
        ]
      },
    }),
  )
}

// PHONE VIEWS

// Где текст и доска не помещаются рядом, виден один из них. Шаг открывается
// текстом; кнопка в конце текста ведёт на доску, а «← Текст» в нижней панели
// доски возвращает к тексту на то же место. Над панелью доски короткая
// полоса с заданием шага, чтобы проверять решение, не возвращаясь к тексту.
// Раскладку меняет CSS только на узком экране, на широком всё как прежде.

const LESSON_TEXT_ID = 'lesson-text'
const LESSON_BOARD_ID = 'lesson-board'

/** Кнопка в конце текста шага: «Смотреть на доске», «К задаче» или
    «К вопросу», если на вопрос отвечают на доске. */
const toBoardView = <T extends KindTypes>(
  { lesson, model, ui }: Page<T>,
  h: HtmlBuilder<Message>,
): Html => {
  const isBoardQuestion = Option.exists(
    currentQuiz(lesson, model),
    quiz => isBoardQuiz(quiz.spec) && Option.isNone(quiz.maybeAnswer),
  )
  const label = Option.isSome(currentTask(lesson, model))
    ? ui.player.toTask
    : isBoardQuestion
      ? ui.player.toQuestion
      : ui.player.toBoard
  return h.div(
    [h.Class('to-board-row')],
    [
      h.button(
        [
          h.Type('button'),
          h.Class('btn primary to-board'),
          h.AriaControls(LESSON_BOARD_ID),
          h.AriaExpanded(!isTextShown(model)),
          h.OnClick(Message.ClickedShowBoard()),
        ],
        [label],
      ),
    ],
  )
}

/** «← Текст» в нижней панели доски. */
const toTextView = <T extends KindTypes>(
  { model, ui }: Page<T>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  isTextShown(model)
    ? []
    : [
        h.button(
          [
            h.Type('button'),
            h.Class('btn to-text'),
            h.AriaControls(LESSON_TEXT_ID),
            h.AriaExpanded(false),
            h.AriaLabel(ui.player.toTextLabel),
            h.OnClick(Message.ClickedShowText()),
          ],
          [ui.player.toText],
        ),
      ]

const taskBarView = <T extends KindTypes>(
  page: Page<T>,
  task: CurrentTask<T>,
  h: HtmlBuilder<Message>,
): Html => {
  const { lesson, model, texts, ui } = page
  const taskTexts = texts.tasks?.[task.spec.id]
  const isSolved = task.state.check._tag === 'Solved'
  const replaying = isReplaying(lesson, model)
  const maybeLastHint = Array.last(
    Array.take(taskTexts?.hints ?? [], task.state.hintsShown),
  )
  return h.section(
    [
      h.Class(`step-bar${isSolved ? ' solved' : ''}`),
      h.AriaLabel(ui.task.heading),
    ],
    [
      h.p(
        [h.Class('step-bar-text')],
        [
          h.span(
            [h.Class('step-bar-head')],
            [isSolved ? ui.task.solved : ui.task.heading],
          ),
          ` ${taskTexts?.prompt ?? ''}`,
        ],
      ),
      CheckState.match(task.state.check, {
        Unchecked: () => h.empty,
        Failed: ({ failure }) =>
          h.p(
            [h.Class('step-bar-feedback failed'), h.Role('alert')],
            [messageText(page, failure)],
          ),
        Solved: () =>
          h.p(
            [h.Class('step-bar-feedback solved')],
            [taskTexts?.solvedNote ?? ''],
          ),
      }),
      ...(isSolved
        ? []
        : [
            Option.match(maybeLastHint, {
              onNone: () => h.empty,
              onSome: hint => h.p([h.Class('step-bar-hint')], [hint]),
            }),
            h.div(
              [h.Class('step-bar-actions')],
              [
                h.button(
                  [
                    h.Type('button'),
                    h.Class('btn primary'),
                    ...(isEditable(lesson, model)
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
              ],
            ),
          ]),
    ],
  )
}

const quizBarView = <T extends KindTypes>(
  page: Page<T>,
  quiz: CurrentQuiz<T>,
  doc: T['Doc'],
  h: HtmlBuilder<Message>,
): Html => {
  const { ui } = page
  const question = page.texts.quizzes?.[quiz.spec.id]?.question ?? ''
  const answer = correctAnswer(page.lesson, page.model, quiz.spec)
  return h.section(
    [h.Class('step-bar'), h.AriaLabel(ui.quiz.heading)],
    Option.match(quiz.maybeAnswer, {
      onNone: () => [
        h.p(
          [h.Class('step-bar-text')],
          [
            h.span([h.Class('step-bar-head')], [ui.quiz.heading]),
            ` ${question}`,
          ],
        ),
        isBoardQuiz(quiz.spec)
          ? h.p([h.Class('step-bar-hint')], [ui.quiz.pickOnBoard])
          : choicesView(page, quiz, doc, answer, h),
      ],
      onSome: ({ isCorrect }) => [
        h.p(
          [
            h.Class(`step-bar-feedback ${isCorrect ? 'solved' : 'failed'}`),
            h.Role('status'),
          ],
          [
            `${isCorrect ? '✓' : '✕'} ${isCorrect ? ui.quiz.correct : ui.quiz.incorrect}. `,
            ui.quiz.answerWas(candidateName(page, quiz, doc, answer)),
          ],
        ),
      ],
    }),
  )
}

/** Задание текущего шага над нижней панелью, пока текст свёрнут. */
const stepBarView = <T extends KindTypes>(
  page: Page<T>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const { lesson, model } = page
  const doc = docAt(lesson, model, model.step)
  return Option.match(currentTask(lesson, model), {
    onSome: task => [taskBarView(page, task, h)],
    onNone: () =>
      Option.match(currentQuiz(lesson, model), {
        onNone: () => [],
        onSome: quiz => [quizBarView(page, quiz, doc, h)],
      }),
  })
}

// THEORY VIEW

const theoryView = <T extends KindTypes>(
  page: Page<T>,
  isFallback: boolean,
  shownIn: Locale,
  h: HtmlBuilder<Message>,
): Html => {
  const { lesson, model, texts, locale, ui } = page
  const maybeEntry = findLesson(model.course, lesson.slug)
  const order = Option.match(maybeEntry, {
    onNone: () => 0,
    onSome: found => found.meta.order,
  })
  const maxStep = maxAllowedStep(lesson, model)
  const isLast = model.step === lesson.steps.length - 1
  const isHeld = model.step === maxStep && !isLast
  const atUnsolvedTask = isHeld && Option.isSome(currentTask(lesson, model))
  const atUnansweredQuiz = isHeld && Option.isSome(currentQuiz(lesson, model))

  return h.section(
    [h.AriaLabel(ui.lesson.theoryRegion), h.Class('theory')],
    [
      h.div(
        [h.Class('theory-scroll'), h.Id(LESSON_TEXT_ID)],
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
                  ...moreView(page, lessonStep.id, h),
                  ...(index === model.step
                    ? Option.match(currentTask(lesson, model), {
                        onNone: () =>
                          Option.match(currentQuiz(lesson, model), {
                            onNone: () => inlineNextView(page, false, h),
                            onSome: quiz => [
                              quizCardView(page, quiz, doc, h),
                              ...inlineNextView(
                                page,
                                Option.isNone(quiz.maybeAnswer),
                                h,
                              ),
                            ],
                          }),
                        onSome: task => [taskCardView(page, task, doc, h)],
                      })
                    : []),
                  ...(index === model.step ? [toBoardView(page, h)] : []),
                  ...(index === lesson.steps.length - 1
                    ? [
                        ...askAiView(page, h),
                        ...(page.lessonEnd === undefined
                          ? []
                          : [page.lessonEnd()]),
                      ]
                    : []),
                ],
              )
            },
          ),
          ...(isLast ? [finishView(page, h)] : []),
        ],
      ),
      ...(isTextShown(model) ? [] : stepBarView(page, h)),
      h.nav(
        [h.Class('theory-nav')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('btn nav-prev'),
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
                : atUnansweredQuiz
                  ? ui.player.answerFirst
                  : isLast
                    ? ui.player.lessonEnd
                    : ui.player.navHint,
            ],
          ),
          ...toTextView(page, h),
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
  const paletteMode = coursePaletteMode(model.course)
  const unlocks = unlocksOf(model)
  const scene = boardStage(lesson, model)

  return {
    locale: inputs.locale,
    ui,
    prefersDark: inputs.prefersDark,
    isReducedMotion: model.isReducedMotion,
    isNarrow: model.isNarrow,
    doc,
    run,
    mode: boardMode(lesson, model),
    stage: scene.stage,
    stageDoc: scene.doc,
    annotationText: key =>
      texts.annotations?.[key]?.(lesson.kind.annotationInput(doc, run)) ?? key,
    label: labelOf(texts),
    maybeTask: Option.map(task, ({ spec, state }) => ({
      palette: spec.palette,
      solution: spec.solution,
      journal: opsOf(lesson.kind, state.log),
      isGhostShown: state.hintsShown >= 3 && state.check._tag !== 'Solved',
      focusNodes: state.check._tag === 'Failed' ? state.check.focusNodes : [],
      focusEdges: state.check._tag === 'Failed' ? state.check.focusEdges : [],
    })),
    maybeQuiz: Option.flatMap(currentQuiz(lesson, model), quiz =>
      isBoardQuiz(quiz.spec)
        ? Option.some({
            kind: quiz.spec.kind,
            candidates: quiz.spec.candidates,
            multiple: isMultiPick(quiz.spec),
            slots: quiz.spec.slots ?? [],
            names: Record.getSomes(
              Record.map(
                {
                  ...texts.quizzes?.[quiz.spec.id]?.options,
                  ...texts.quizzes?.[quiz.spec.id]?.slots,
                },
                name => Option.fromNullishOr(name),
              ),
            ),
            maybePicked: Option.map(quiz.maybeAnswer, ({ picked }) => picked),
            maybeAnswer: Option.map(quiz.maybeAnswer, () =>
              correctAnswer(lesson, model, quiz.spec),
            ),
            tags: Record.getSomes(
              Record.map(texts.quizzes?.[quiz.spec.id]?.tags ?? {}, tag =>
                Option.fromNullishOr(tag),
              ),
            ),
            hidden: isPicking(lesson, model)
              ? (quiz.spec.hideUntilAnswered ?? [])
              : [],
          })
        : Option.none(),
    ),
    palette: Option.match(task, {
      onNone: () => lessonPalette(lesson),
      onSome: ({ spec }) => spec.palette,
    }),
    newPalette: newInLesson(course, order, paletteMode),
    laterPalette: laterInCourse(course, order, paletteMode),
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
                            renderMessage: message =>
                              kindMessageText(page, message),
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

/** A lesson with its texts loaded, as the player shows it. */
export type LessonEntry = Readonly<{
  course: string
  meta: LessonMeta
  texts: Array.NonEmptyReadonlyArray<LocalizedText<LessonText>>
}>

/** The lesson of the registry with its loaded texts. */
export const loadedEntry = (
  course: string,
  slug: string,
): Option.Option<LessonEntry> =>
  Option.flatMap(
    Option.all([findLesson(course, slug), loadedLesson(course, slug)]),
    ([found, loaded]) =>
      Array.isReadonlyArrayNonEmpty(loaded.texts)
        ? Option.some({
            course: found.course,
            meta: found.meta,
            texts: loaded.texts,
          })
        : Option.none(),
  )

export const lessonView = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  entry: LessonEntry,
  model: Model,
  inputs: PlayerViewInputs,
  h: HtmlBuilder<Message>,
): Html => {
  const ui = uiFor(inputs.locale)
  const choice = textFor(entry.texts, inputs.locale)
  const page: Page<T> = {
    lesson,
    model,
    texts: choice.text,
    locale: inputs.locale,
    ui,
    lessonEnd: inputs.lessonEnd,
  }
  return h.main(
    [
      h.Class(
        isTextShown(model)
          ? 'lesson-page shows-text'
          : 'lesson-page shows-board',
      ),
    ],
    [
      timelineView(page, h),
      h.div(
        [h.Class('lesson-main')],
        [
          theoryView(page, choice.isFallback, choice.shownIn, h),
          h.section(
            [
              h.AriaLabel(ui.lesson.boardRegion),
              h.Class('board-side'),
              h.Id(LESSON_BOARD_ID),
            ],
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
        loadedEntry(model.course, model.slug),
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
