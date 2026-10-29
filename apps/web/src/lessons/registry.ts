import { Array, Option } from 'effect'

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
