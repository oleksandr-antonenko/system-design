import { Array } from 'effect'
import { describe, expect, test } from 'vitest'

import { defineCourse, paletteModeOf } from '../courses/model'
import { courseLessons, coursePaletteMode } from '../courses/registry'
import systemDesign from '../courses/system-design/course'
import type { ComponentKind } from '../domain/catalog'
import { flow } from '../kinds/flow/dsl'
import {
  type CourseLesson,
  kindDebuts,
  laterInCourse,
  newInLesson,
} from './course'
import { defineLesson, lessonPalette } from './dsl'

const scriptWith = (
  order: number,
  palette: ReadonlyArray<ComponentKind>,
  introduces: ReadonlyArray<ComponentKind> = [],
) =>
  defineLesson(flow, {
    slug: `lesson-${order}`,
    introduces,
    steps: [
      { id: 'intro', ops: [], stage: [] },
      {
        id: 'task',
        ops: [],
        stage: [],
        task: { id: 'task', palette, goals: [], solution: [] },
      },
    ],
  })

const lessonWith = (
  order: number,
  palette: ReadonlyArray<ComponentKind>,
  introduces: ReadonlyArray<ComponentKind> = [],
): CourseLesson => {
  const script = scriptWith(order, palette, introduces)
  return {
    order,
    palette: lessonPalette(script),
    introduces: script.introduces,
  }
}

const caching = lessonWith(4, ['cache', 'server'])

// Порядок в массиве нарочно перепутан: список строится по номеру урока.
const course: ReadonlyArray<CourseLesson> = [
  lessonWith(6, ['replica', 'server']),
  caching,
  lessonWith(3, ['lb', 'server']),
  lessonWith(5, ['cdn', 'lb']),
  lessonWith(8, ['limiter']),
  lessonWith(7, ['queue', 'worker']),
]

describe('later in the course (D8)', () => {
  test('on lesson 4 the cache is in the task palette, not later; CDN is later', () => {
    expect(caching.palette).toEqual(['cache', 'server'])
    expect(laterInCourse(course, 4)).toEqual([
      { kind: 'cdn', lesson: 5 },
      { kind: 'replica', lesson: 6 },
      { kind: 'queue', lesson: 7 },
      { kind: 'worker', lesson: 7 },
    ])
  })

  test('a kind is listed once, at its first lesson', () => {
    expect(kindDebuts(course).map(({ kind }) => kind)).toEqual([
      'lb',
      'server',
      'cache',
      'cdn',
      'replica',
      'queue',
      'worker',
      'limiter',
    ])
    expect(laterInCourse(course, 7)).toEqual([{ kind: 'limiter', lesson: 8 }])
    expect(laterInCourse(course, 8)).toEqual([])
  })

  test('kinds that debut in the lesson get the “new” badge', () => {
    expect(newInLesson(course, 3)).toEqual(['lb', 'server'])
    expect(newInLesson(course, 4)).toEqual(['cache'])
    expect(newInLesson(course, 9)).toEqual([])
  })

  test('the real course places the load balancer in lesson 3', () => {
    const systemDesign = courseLessons('system-design')
    expect(newInLesson(systemDesign, 3)).toContain('lb')
    expect(
      laterInCourse(systemDesign, 3).every(({ lesson }) => lesson > 3),
    ).toBe(true)
  })

  test('the palette is computed within one course', () => {
    expect(courseLessons('system-design')).toHaveLength(13)
    expect(
      courseLessons('networks').every(({ order }) => order >= 1 && order <= 16),
    ).toBe(true)
    expect(
      laterInCourse(courseLessons('networks'), 1).some(
        ({ kind }) => kind === 'lb',
      ),
    ).toBe(false)
    expect(courseLessons('no-such-course')).toEqual([])
  })
})

describe('a course whose students know every block (palette: all-known)', () => {
  const advanced: ReadonlyArray<CourseLesson> = [
    lessonWith(1, ['lb', 'server', 'cache']),
    lessonWith(2, ['queue', 'worker']),
    lessonWith(3, ['search', 'server'], ['search']),
    lessonWith(4, ['limiter', 'cdn']),
  ]

  test('no block is new and nothing is listed for a later lesson', () => {
    expect(newInLesson(advanced, 1, 'all-known')).toEqual([])
    expect(newInLesson(advanced, 2, 'all-known')).toEqual([])
    expect(newInLesson(advanced, 4, 'all-known')).toEqual([])
    expect(laterInCourse(advanced, 3, 'all-known')).toEqual([])
  })

  test('a block the lesson introduces is new in it and listed as later before it', () => {
    expect(newInLesson(advanced, 3, 'all-known')).toEqual(['search'])
    expect(laterInCourse(advanced, 1, 'all-known')).toEqual([
      { kind: 'search', lesson: 3 },
    ])
  })

  test('the same lessons in a progressive course keep the badges from their task palettes', () => {
    expect(newInLesson(advanced, 2)).toEqual(['queue', 'worker'])
    expect(laterInCourse(advanced, 1)).toEqual([
      { kind: 'queue', lesson: 2 },
      { kind: 'worker', lesson: 2 },
      { kind: 'search', lesson: 3 },
      { kind: 'limiter', lesson: 4 },
    ])
  })

  test('in a progressive course `introduces` makes a block new before its first task', () => {
    const early = [
      lessonWith(2, ['server'], ['cache']),
      lessonWith(5, ['cache']),
    ]

    expect(newInLesson(early, 2)).toEqual(['server', 'cache'])
    expect(newInLesson(early, 5)).toEqual([])
  })

  test('the System Design lessons in an all-known course show no badge and no later section', () => {
    const lessons = courseLessons('system-design')
    const mode = paletteModeOf(
      defineCourse({ ...systemDesign, palette: 'all-known' }),
    )

    expect(mode).toBe('all-known')
    expect(
      Array.flatMap(lessons, ({ order }) => [
        ...newInLesson(lessons, order, mode),
        ...Array.map(laterInCourse(lessons, order, mode), ({ kind }) => kind),
      ]),
    ).toEqual([])
  })

  test('a course without `palette` keeps the progressive palette', () => {
    expect(paletteModeOf(systemDesign)).toBe('progressive')
    expect(coursePaletteMode('system-design')).toBe('progressive')
    expect(coursePaletteMode('networks')).toBe('progressive')
    expect(coursePaletteMode('no-such-course')).toBe('progressive')
    expect(
      Array.every(courseLessons('system-design'), ({ introduces }) =>
        Array.isReadonlyArrayEmpty(introduces),
      ),
    ).toBe(true)
  })

  test('only known palette modes type-check', () => {
    defineCourse({
      ...systemDesign,
      // @ts-expect-error the palette mode is one of PaletteMode
      palette: 'beginner',
    })
  })
})
