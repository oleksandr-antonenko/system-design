import { describe, expect, test } from 'vitest'

import { Goal } from '../domain/goals'
import { annotate, flow } from '../kinds/flow/dsl'
import { packet } from '../kinds/packet/dsl'
import { type LessonTexts, defineLesson } from './dsl'

// Полнота текстов проверяется типами по lesson.ts (design D3): пропущенный
// ключ не компилируется. Строки с @ts-expect-error — сами проверки.

const flowLesson = defineLesson(flow, {
  slug: 'texts',
  steps: [
    { id: 'intro', ops: [], stage: [annotate('app1', 'load', 'ink')] },
    {
      id: 'task',
      ops: [],
      stage: [],
      task: {
        id: 'place',
        palette: ['lb'],
        goals: [{ id: 'lb', goal: Goal.HasKind({ kind: 'lb' }) }],
        solution: [],
      },
    },
  ],
})

const packetLesson = defineLesson(packet, {
  slug: 'texts',
  labels: ['phone'],
  steps: [{ id: 'intro', ops: [], stage: [] }],
})

const flowTexts = {
  title: 'Texts',
  summary: 'Summary',
  steps: {
    intro: { title: 'Intro', body: ({ sim }) => `${sim.load} rps` },
    task: { title: 'Task', body: 'Place a balancer.' },
  },
  annotations: { load: sim => `${sim.load} rps` },
  tasks: {
    place: {
      prompt: 'Place it.',
      goals: { lb: 'There is a balancer' },
      hints: ['One', 'Two', 'Three'],
      solvedNote: 'Done.',
    },
  },
  feedback: { ConnectSelf: 'Not to itself.' },
} satisfies LessonTexts<typeof flowLesson>

const packetTexts = {
  title: 'Texts',
  summary: 'Summary',
  labels: { phone: { name: 'Phone', note: 'in your hand' } },
  steps: {
    intro: {
      title: 'Intro',
      body: ({ doc }) => `${doc.doc.devices.length} devices`,
    },
  },
  annotations: {},
  tasks: {},
  feedback: { WrongPassword: ({ ssid }) => `Wrong password for ${ssid}.` },
} satisfies LessonTexts<typeof packetLesson>

describe('lesson texts are checked against lesson.ts', () => {
  test('complete texts compile for both board kinds', () => {
    expect(flowTexts.tasks.place.goals.lb).toBe('There is a balancer')
    expect(packetTexts.labels.phone.name).toBe('Phone')
  })

  test('a missing goal, annotation or label does not compile', () => {
    const missingGoal = {
      ...flowTexts,
      tasks: {
        place: {
          prompt: 'Place it.',
          // @ts-expect-error: the goal `lb` has no text
          goals: {},
          hints: ['One', 'Two', 'Three'],
          solvedNote: 'Done.',
        },
      },
    } satisfies LessonTexts<typeof flowLesson>
    const missingAnnotation = {
      ...flowTexts,
      // @ts-expect-error: the annotation `load` has no text
      annotations: {},
    } satisfies LessonTexts<typeof flowLesson>
    const missingLabel = {
      title: 'Texts',
      summary: 'Summary',
      steps: { intro: { title: 'Intro', body: 'Body' } },
      annotations: {},
      tasks: {},
      // @ts-expect-error: the label `phone` has no caption
    } satisfies LessonTexts<typeof packetLesson>

    expect([missingGoal, missingAnnotation, missingLabel]).toHaveLength(3)
  })
})
