import { Array, Option, pipe } from 'effect'

import type { Course, Lesson } from '../courses/assemble'

// Что предложить в конце урока: следующий открытый урок курса, а если
// открытых уроков в курсе не осталось — следующий курс каталога, где они
// есть.

const hasAvailableLessons = (course: Course): boolean =>
  Array.some(course.lessons, lesson => lesson.meta.available)

/** Первый открытый урок после `slug` в порядке курса; уроки «Скоро»
    пропускаются. */
export const nextAvailableLesson = (
  lessons: ReadonlyArray<Lesson>,
  slug: string,
): Option.Option<Lesson> =>
  pipe(
    Array.findFirstIndex(lessons, lesson => lesson.meta.slug === slug),
    Option.flatMap(index =>
      Array.findFirst(
        Array.drop(lessons, index + 1),
        lesson => lesson.meta.available,
      ),
    ),
  )

/** Следующий курс каталога с открытыми уроками. Порядок идёт по кругу, но
    текущий курс не предлагается никогда. */
export const nextCourse = (
  catalogue: ReadonlyArray<Course>,
  courseId: string,
): Option.Option<Course> =>
  pipe(
    Array.findFirstIndex(
      catalogue,
      course => course.definition.id === courseId,
    ),
    Option.getOrElse(() => -1),
    index => [
      ...Array.drop(catalogue, index + 1),
      ...Array.take(catalogue, Math.max(index, 0)),
    ],
    Array.findFirst(
      course =>
        course.definition.id !== courseId && hasAvailableLessons(course),
    ),
  )
