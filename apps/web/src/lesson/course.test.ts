import { describe, expect, test } from 'vitest'

import { courseLessons } from '../courses/registry'
import type { ComponentKind } from '../domain/catalog'
import { flow } from '../kinds/flow/dsl'
import {
  type CourseLesson,
  kindDebuts,
  laterInCourse,
  newInLesson,
} from './course'
import { defineLesson, lessonPalette } from './dsl'

const scriptWith = (order: number, palette: ReadonlyArray<ComponentKind>) =>
  defineLesson(flow, {
    slug: `lesson-${order}`,
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
): CourseLesson => ({
  order,
  palette: lessonPalette(scriptWith(order, palette)),
})

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
    expect(courseLessons('networks')).toEqual([])
    expect(laterInCourse(courseLessons('networks'), 1)).toEqual([])
    expect(courseLessons('no-such-course')).toEqual([])
  })
})
