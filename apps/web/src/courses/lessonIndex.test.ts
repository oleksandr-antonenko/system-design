import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import type { KindTypes } from '../kinds/contract'
import { type LessonDefinition, lessonPalette, withLesson } from '../lesson/dsl'
import {
  courseLessons,
  courses,
  findDefinition,
  loadedLesson,
} from './registry'

// The course map shows titles and summaries, and the palette “later in the
// course” lists blocks, before any lesson is loaded. They are read from the
// lesson sources by `build/lessonIndex.ts`; here they are checked against
// the loaded lessons.

const lessons = Array.flatMap(courses, course =>
  Array.map(
    course.lessons,
    lesson => [`${lesson.course}/${lesson.folder}`, lesson] as const,
  ),
)

describe('lesson index', () => {
  test.each(lessons)(
    '%s: the map shows the lesson’s own title and summary',
    (_, lesson) => {
      const texts = Option.getOrThrow(
        loadedLesson(lesson.course, lesson.meta.slug),
      ).texts
      expect(
        Array.map(lesson.summaries, ({ locale, text }) => ({
          locale,
          ...text,
        })),
      ).toEqual(
        Array.map(texts, ({ locale, text }) => ({
          locale,
          title: text.title,
          summary: text.summary,
        })),
      )
    },
  )

  test.each(lessons)(
    '%s: the palette read from the source is the lesson’s',
    (_, lesson) => {
      const indexed = Array.findFirst(
        courseLessons(lesson.course),
        entry => entry.order === lesson.meta.order,
      )
      const fromScript = Option.map(
        findDefinition(lesson.course, lesson.meta.slug),
        definition =>
          withLesson(
            definition,
            <T extends KindTypes>(script: LessonDefinition<T>) =>
              Array.map(lessonPalette(script), item => `${item}`),
          ),
      )
      expect(Option.map(indexed, entry => entry.palette)).toEqual(
        Option.match(fromScript, {
          onNone: () => Option.map(indexed, () => []),
          onSome: palette => Option.some(palette),
        }),
      )
    },
  )
})
