import { Array, Option, pipe } from 'effect'

import type { KindTypes } from '../kinds/contract'
import type { CourseLesson } from '../lesson/course'
import {
  type AnyLesson,
  type LessonDefinition,
  lessonPalette,
  withLesson,
} from '../lesson/dsl'
import { type Course, type Lesson, assembleCatalog } from './assemble'
import {
  type CourseDefinition,
  type CourseText,
  type FeatureOf,
  type LessonMeta,
  type LessonText,
  type PaletteMode,
  paletteModeOf,
} from './model'
import { unlockedIn, unlockedThrough } from './unlocks'

// Курсы и уроки — модули папок `src/courses/<курс>/` (design D1, D2):
// новый курс или урок подхватывается без правок этого файла.

const definitionsOfCourses = import.meta.glob<CourseDefinition>(
  './*/course.ts',
  { eager: true, import: 'default' },
)

const courseTexts = import.meta.glob<CourseText>('./*/course.*.ts', {
  eager: true,
  import: 'default',
})

const metas = import.meta.glob<LessonMeta>('./*/lessons/*/meta.ts', {
  eager: true,
  import: 'default',
})

const texts = import.meta.glob<LessonText>('./*/lessons/*/text.*.ts', {
  eager: true,
  import: 'default',
})

const scripts = import.meta.glob<AnyLesson>('./*/lessons/*/lesson.ts', {
  eager: true,
  import: 'default',
})

export const catalog = assembleCatalog({
  courses: definitionsOfCourses,
  courseTexts,
  metas,
  texts,
})

export const courses: ReadonlyArray<Course> = catalog.courses

export const findCourse = (course: string): Option.Option<Course> =>
  Array.findFirst(courses, candidate => candidate.definition.id === course)

export const lessonsOf = (course: string): ReadonlyArray<Lesson> =>
  Option.match(findCourse(course), {
    onNone: () => [],
    onSome: found => found.lessons,
  })

export const findLesson = (
  course: string,
  slug: string,
): Option.Option<Lesson> =>
  Array.findFirst(lessonsOf(course), lesson => lesson.meta.slug === slug)

/** Ключ урока в Model и в прогрессе: slug уникален только внутри курса. */
export const lessonKey = (course: string, slug: string): string =>
  `${course}/${slug}`

// SCRIPTS

export type CourseLessonDefinition = Readonly<{
  course: string
  definition: AnyLesson
}>

const courseOfScript = (modulePath: string): string =>
  pipe(
    modulePath.split('/'),
    Array.get(1),
    Option.getOrElse(() => modulePath),
  )

/** Сценарии `lesson.ts` всех курсов. */
export const lessonDefinitions: ReadonlyArray<CourseLessonDefinition> =
  Array.map(Object.entries(scripts), ([modulePath, definition]) => ({
    course: courseOfScript(modulePath),
    definition,
  }))

export const findDefinition = (
  course: string,
  slug: string,
): Option.Option<AnyLesson> =>
  pipe(
    Array.findFirst(
      lessonDefinitions,
      entry => entry.course === course && entry.definition.slug === slug,
    ),
    Option.map(({ definition }) => definition),
  )

/** Палитры уроков курса в порядке программы: из них строится палитра
    «Позже в курсе» (D8). */
export const courseLessons = (course: string): ReadonlyArray<CourseLesson> =>
  Array.getSomes(
    Array.map(lessonsOf(course), lesson =>
      Option.map(findDefinition(course, lesson.meta.slug), definition =>
        withLesson(
          definition,
          <T extends KindTypes>(script: LessonDefinition<T>) => ({
            order: lesson.meta.order,
            palette: Array.map(lessonPalette(script), item => `${item}`),
            introduces: Array.map(script.introduces, item => `${item}`),
          }),
        ),
      ),
    ),
  )

/** Как палитра курса подаёт блоки (`defineCourse({ palette })`). */
export const coursePaletteMode = (course: string): PaletteMode =>
  Option.match(findCourse(course), {
    onNone: () => 'progressive',
    onSome: found => paletteModeOf(found.definition),
  })

// UNLOCKS

const unlockingOf = (course: CourseDefinition) =>
  Array.map(lessonsOf(course.id), lesson => ({
    order: lesson.meta.order,
    unlocks: lesson.meta.unlocks,
  }))

/** Открыт ли элемент интерфейса на уроке `lessonOrder` курса (план, 3.4). */
export const isUnlocked = <Definition extends CourseDefinition>(
  course: Definition,
  lessonOrder: number,
  feature: FeatureOf<Definition>,
): boolean =>
  Array.some(
    unlockedThrough(unlockingOf(course), lessonOrder),
    unlocked => unlocked === feature,
  )

/** Всё, что открыто на уроке, в порядке набора элементов курса. */
export const unlockedFeatures = <Definition extends CourseDefinition>(
  course: Definition,
  lessonOrder: number,
): ReadonlyArray<FeatureOf<Definition>> => {
  const unlocked = unlockedThrough(unlockingOf(course), lessonOrder)
  return Array.filter(course.features, feature =>
    Array.some(unlocked, candidate => candidate === feature),
  )
}

/** Что открывает сам урок: у этих элементов метка «новое». */
export const newFeatures = <Definition extends CourseDefinition>(
  course: Definition,
  lessonOrder: number,
): ReadonlyArray<FeatureOf<Definition>> => {
  const opened = unlockedIn(unlockingOf(course), lessonOrder)
  return Array.filter(course.features, feature =>
    Array.some(opened, candidate => candidate === feature),
  )
}
