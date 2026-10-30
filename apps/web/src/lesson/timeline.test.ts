import { Array, Option, Record, String, pipe } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { Mount, all, expectAll, given, scene } from 'foldkit/scene'
import { describe, expect, test } from 'vitest'

import * as Board from '../board/board'
import { BoardPointer } from '../board/pointer'
import type { Lesson } from '../courses/assemble'
import { Goal } from '../domain/goals'
import { addNode, connect, flow } from '../kinds/flow/dsl'
import type { FlowTypes } from '../kinds/types'
import styles from '../styles.css?raw'
import { type LessonDefinition, type LessonStep, defineLesson } from './dsl'
import * as Player from './player'
import { lessonView } from './view'

// Лента шагов на телефоне. happy-dom не считает раскладку, поэтому сцена
// не может измерить ширину ленты. Тест держит контракт из двух половин:
// вид помечает пункты ленты классами (`timeline-item`, у задачи ещё `task`),
// а styles.css даёт этим пунктам сжиматься до минимумов, которые в сумме
// помещаются в 360px. Сами минимумы читаются из styles.css, так что правка,
// которая вернёт полоскам постоянную ширину, роняет этот тест. Глазами это
// проверено в браузере на 360, 390 и 1440px с уроком из 16 шагов.

const PHONE_WIDTH = 360
/** Классическая полоса прокрутки (настольный браузер в узком окне). */
const SCROLLBAR = 15
const LONG_LESSON = 16

// CSS

type Declarations = Readonly<Record<string, string>>

const noRules: Readonly<Record<string, Declarations>> = {}

const withoutComments = (css: string): string =>
  css.replace(/\/\*[\s\S]*?\*\//g, '')

const declarationsOf = (body: string): Declarations =>
  Record.fromEntries(
    Array.getSomes(
      Array.map(body.split(';'), line => {
        const colon = line.indexOf(':')
        return colon < 0
          ? Option.none()
          : Option.some([
              String.trim(line.slice(0, colon)),
              String.trim(line.slice(colon + 1)),
            ] satisfies [string, string])
      }),
    ),
  )

/** Правила верхнего уровня: `@import` и блоки `@media`, `@keyframes` с
    вложенными правилами вырезаются целиком. */
const topLevelRules = (css: string): Readonly<Record<string, Declarations>> =>
  pipe(
    withoutComments(css)
      .replace(/@[^{};]+;/g, '')
      .replace(/@[^{}]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ''),
    source => [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)],
    Array.flatMap(([, selectors = '', body = '']) =>
      Array.map(selectors.split(','), selector => ({
        selector: selector.trim().replace(/\s+/g, ' '),
        declarations: declarationsOf(body),
      })),
    ),
    Array.reduce(noRules, (rules, rule) => ({
      ...rules,
      [rule.selector]: { ...rules[rule.selector], ...rule.declarations },
    })),
  )

const rules = topLevelRules(styles)

const value = (selector: string, property: string): string => {
  const found = rules[selector]?.[property]
  if (found === undefined) {
    throw new Error(`styles.css: no ${property} in ${selector}`)
  }
  return found
}

const px = (selector: string, property: string): number => {
  const raw = value(selector, property)
  if (raw !== '0' && !raw.endsWith('px')) {
    throw new Error(`styles.css: ${selector} { ${property}: ${raw} } is not px`)
  }
  return Number.parseFloat(raw)
}

const inlinePadding = (selector: string): number => {
  const parts = value(selector, 'padding').split(/\s+/)
  const inline = parts.length === 1 ? parts[0] : parts[1]
  return Number.parseFloat(inline ?? '0')
}

const columnGap = (selector: string): number => {
  const parts = value(selector, 'gap').split(/\s+/)
  return Number.parseFloat(parts[1] ?? parts[0] ?? '0')
}

const flexShrink = (selector: string): number =>
  Number.parseFloat(value(selector, 'flex').split(/\s+/)[1] ?? '0')

/** Самая узкая лента из `steps` шагов: каждый пункт на своём минимуме. */
const narrowestTimeline = (steps: number, perItem: number): number =>
  steps * perItem +
  (steps - 1) * columnGap('.timeline-steps') +
  2 * inlinePadding('.timeline')

// FIXTURE

const plainStep = (id: string): LessonStep<FlowTypes> => ({
  id,
  ops: [],
  stage: [],
})

const taskStep = (id: string): LessonStep<FlowTypes> => ({
  id,
  ops: [],
  stage: [],
  task: {
    id,
    palette: ['cache'],
    goals: [{ id: 'cache', goal: Goal.HasKind({ kind: 'cache' }) }],
    solution: [addNode('cache-1', 'cache', 450, 130, { locked: false })],
  },
})

const TASK_STEPS = [4, 9, 14]

const longLesson: LessonDefinition<FlowTypes> = defineLesson(flow, {
  slug: 'long-lesson',
  steps: [
    {
      id: 'step-1',
      ops: [
        addNode('users', 'client', 100, 280),
        addNode('app1', 'server', 450, 280),
        connect('users', 'app1'),
      ],
      stage: [],
    },
    ...Array.makeBy(LONG_LESSON - 1, index =>
      Array.contains(TASK_STEPS, index + 2)
        ? taskStep(`step-${index + 2}`)
        : plainStep(`step-${index + 2}`),
    ),
  ],
})

const longLessonEntry: Lesson = {
  course: 'system-design',
  folder: '99-long-lesson',
  meta: {
    course: 'system-design',
    slug: 'long-lesson',
    module: 'distributed',
    order: 99,
    available: true,
    locales: ['en'],
    unlocks: [],
  },
  texts: [
    {
      locale: 'en',
      text: {
        title: 'Long lesson. Sixteen steps',
        summary: 'A lesson as long as an advanced one.',
        steps: Record.fromEntries(
          Array.map(longLesson.steps, ({ id }) => [
            id,
            { title: id, body: id },
          ]),
        ),
      },
    },
  ],
}

const pointerReady = Mount.resolve(
  BoardPointer,
  Board.Message.CancelledPointer(),
)

describe('step timeline on a phone', () => {
  test('desktop and short lessons keep their sizes: a 34px bar, a 21px box with an 11px diamond', () => {
    expect(value('.timeline-item', 'width')).toBe('34px')
    expect(value('.timeline-item.task', 'width')).toBe('21px')
    expect(value('.timeline-step.task .bar', 'width')).toBe('11px')
  })

  test('the steps shrink with the screen instead of holding a fixed width', () => {
    expect(flexShrink('.timeline-item')).toBeGreaterThan(0)
    expect(value('.timeline-steps', 'min-width')).toBe('0')
    expect(value('.timeline-step', 'width')).toBe('100%')
    expect(value('.timeline-step .bar', 'width')).toBe('100%')
    expect(px('.timeline-item', 'min-width')).toBeLessThan(34)
    expect(px('.timeline-item.task', 'min-width')).toBeLessThan(21)
  })

  test(`${LONG_LESSON} steps fit ${PHONE_WIDTH}px even if every step is a task and a scrollbar takes its share`, () => {
    const widest = Math.max(
      px('.timeline-item', 'min-width'),
      px('.timeline-item.task', 'min-width'),
    )

    expect(narrowestTimeline(LONG_LESSON, widest)).toBeLessThanOrEqual(
      PHONE_WIDTH - SCROLLBAR,
    )
  })

  test('the diamond shrinks with its box and stays inside it', () => {
    const box = px('.timeline-item.task', 'min-width')
    const side = Math.min(
      px('.timeline-step.task .bar', 'width'),
      (Number.parseFloat(value('.timeline-step.task .bar', 'max-width')) /
        100) *
        box,
    )

    expect(side * Math.SQRT2).toBeLessThanOrEqual(box)
  })

  test('a 16-step lesson marks every item of the timeline, tasks apart', () => {
    scene(
      {
        update: (playerModel: Player.Model, playerMessage: Player.Message) =>
          Player.updateWith(longLesson)(playerModel, playerMessage),
        view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
          lessonView(
            longLesson,
            longLessonEntry,
            playerModel,
            { locale: 'en', prefersDark: false },
            h,
          ),
      },
      given(Player.init('system-design', longLesson, 0)),
      pointerReady,
      expectAll(all.selector('li.timeline-item')).toHaveCount(LONG_LESSON),
      expectAll(all.selector('li.timeline-item.task')).toHaveCount(
        TASK_STEPS.length,
      ),
      expectAll(
        all.selector('li.timeline-item.task .timeline-step.task'),
      ).toHaveCount(TASK_STEPS.length),
    )
  })
})
