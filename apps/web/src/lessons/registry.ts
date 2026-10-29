import { Array, Option } from 'effect'

import type { LessonDefinition } from '../lesson/dsl'
import { type Lesson, assembleCourse } from './assemble'
import type { LessonMeta, LessonText } from './model'

const metas = import.meta.glob<LessonMeta>('./*/meta.ts', {
  eager: true,
  import: 'default',
})

const texts = import.meta.glob<LessonText>('./*/text.*.ts', {
  eager: true,
  import: 'default',
})

export const course = assembleCourse({ metas, texts })

export const lessons: ReadonlyArray<Lesson> = course.lessons

export const findLesson = (slug: string): Option.Option<Lesson> =>
  Array.findFirst(lessons, lesson => lesson.meta.slug === slug)

const definitions = import.meta.glob<LessonDefinition>('./*/lesson.ts', {
  eager: true,
  import: 'default',
})

export const lessonDefinitions: ReadonlyArray<LessonDefinition> =
  Object.values(definitions)

export const findDefinition = (slug: string): Option.Option<LessonDefinition> =>
  Array.findFirst(lessonDefinitions, definition => definition.slug === slug)
