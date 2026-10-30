import { Array, Data, Effect, Option, pipe } from 'effect'

import type { Locale } from '../i18n/locale'
import type { CourseLesson } from '../lesson/course'
import type { AnyLesson } from '../lesson/dsl'
import {
  type Course,
  type Lesson,
  type LessonSummary,
  type LocalizedText,
  type TextChoice,
  assembleCatalog,
  textFor,
} from './assemble'
import {
  type CourseDefinition,
  type CourseText,
  type FeatureOf,
  type LessonMeta,
  type LessonText,
  type PaletteMode,
  paletteModeOf,
  recommendsDesktopOf,
} from './model'
import { unlockedIn, unlockedThrough } from './unlocks'

// Курсы и уроки — модули папок `src/courses/<курс>/` (design D1, D2):
// новый курс или урок подхватывается без правок этого файла.
//
// Сразу в сборку попадают описания курсов, `meta.ts` уроков и то, что видно
// на карте курса: название и аннотация урока, палитры его задач (их достаёт
// из исходников плагин `build/lessonIndex.ts`). Сценарий `lesson.ts` и тексты
// урока загружаются отдельным файлом, когда урок открывают.

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

const summaries = import.meta.glob<LessonSummary>('./*/lessons/*/text.*.ts', {
  eager: true,
  import: 'default',
  query: '?lesson-summary',
})

const palettes = import.meta.glob<
  Readonly<{
    palette: ReadonlyArray<string>
    introduces: ReadonlyArray<string>
  }>
>('./*/lessons/*/lesson.ts', {
  eager: true,
  import: 'default',
  query: '?lesson-palette',
})

const scriptLoaders = import.meta.glob<AnyLesson>('./*/lessons/*/lesson.ts', {
  import: 'default',
})

const textLoaders = import.meta.glob<LessonText>('./*/lessons/*/text.*.ts', {
  import: 'default',
})

export const catalog = assembleCatalog({
  courses: definitionsOfCourses,
  courseTexts,
  metas,
  texts: summaries,
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

// LOADING

/** Урок после загрузки: сценарий (у урока-заглушки его нет) и все тексты. */
export type LoadedLesson = Readonly<{
  maybeDefinition: Option.Option<AnyLesson>
  texts: ReadonlyArray<LocalizedText<LessonText>>
}>

export class LessonLoadError extends Data.TaggedError('LessonLoadError')<{
  readonly course: string
  readonly slug: string
  readonly cause: unknown
}> {}

const loadedLessons = new Map<string, LoadedLesson>()

const folderPath = (lesson: Lesson) =>
  `./${lesson.course}/lessons/${lesson.folder}`

const fetchLesson = (lesson: Lesson) =>
  Effect.tryPromise({
    try: async (): Promise<LoadedLesson> => {
      const folder = folderPath(lesson)
      const loadScript = scriptLoaders[`${folder}/lesson.ts`]
      const [maybeDefinition, texts] = await Promise.all([
        loadScript === undefined
          ? Promise.resolve(Option.none<AnyLesson>())
          : loadScript().then(Option.some),
        Promise.all(
          Array.map(lesson.meta.locales, async locale => {
            const loadText = textLoaders[`${folder}/text.${locale}.ts`]
            if (loadText === undefined) {
              throw new Error(`${folder}: no text.${locale}.ts`)
            }
            return { locale, text: await loadText() }
          }),
        ),
      ])
      return { maybeDefinition, texts }
    },
    catch: cause =>
      new LessonLoadError({
        course: lesson.course,
        slug: lesson.meta.slug,
        cause,
      }),
  })

/** Загружает урок (один раз): потом он доступен синхронно через
    `loadedLesson`, `findDefinition` и `loadedTextFor`. */
export const loadLesson = (
  course: string,
  slug: string,
): Effect.Effect<LoadedLesson, LessonLoadError> =>
  Option.match(loadedLesson(course, slug), {
    onSome: Effect.succeed,
    onNone: () =>
      Option.match(findLesson(course, slug), {
        onNone: () =>
          Effect.fail(
            new LessonLoadError({ course, slug, cause: 'unknown lesson' }),
          ),
        onSome: lesson =>
          fetchLesson(lesson).pipe(
            Effect.tap(loaded =>
              Effect.sync(() =>
                loadedLessons.set(lessonKey(course, slug), loaded),
              ),
            ),
          ),
      }),
  })

/** Все уроки всех курсов: для тестов контента. */
export const loadAllLessons: Effect.Effect<void, LessonLoadError> =
  Effect.forEach(
    Array.flatMap(courses, course => course.lessons),
    lesson => loadLesson(lesson.course, lesson.meta.slug),
    { concurrency: 'unbounded', discard: true },
  )

/** Tests only: makes a loaded lesson look not loaded yet. */
export const forgetLoadedLesson = (course: string, slug: string): void => {
  loadedLessons.delete(lessonKey(course, slug))
}

export const loadedLesson = (
  course: string,
  slug: string,
): Option.Option<LoadedLesson> =>
  Option.fromNullishOr(loadedLessons.get(lessonKey(course, slug)))

export const isLessonLoaded = (course: string, slug: string): boolean =>
  Option.isSome(loadedLesson(course, slug))

export const findDefinition = (
  course: string,
  slug: string,
): Option.Option<AnyLesson> =>
  Option.flatMap(loadedLesson(course, slug), loaded => loaded.maybeDefinition)

/** Тексты загруженного урока на языке страницы (или запасном). */
export const loadedTextFor = (
  course: string,
  slug: string,
  locale: Locale,
): Option.Option<TextChoice<LessonText>> =>
  pipe(
    loadedLesson(course, slug),
    Option.flatMap(loaded =>
      Array.match(loaded.texts, {
        onEmpty: () => Option.none(),
        onNonEmpty: texts => Option.some(textFor(texts, locale)),
      }),
    ),
  )

export type CourseLessonDefinition = Readonly<{
  course: string
  definition: AnyLesson
}>

/** Сценарии всех загруженных уроков (после `loadAllLessons` — всех). */
export const loadedDefinitions = (): ReadonlyArray<CourseLessonDefinition> =>
  Array.flatMap(courses, course =>
    Array.getSomes(
      Array.map(course.lessons, lesson =>
        Option.map(
          findDefinition(course.definition.id, lesson.meta.slug),
          definition => ({ course: course.definition.id, definition }),
        ),
      ),
    ),
  )

// PALETTES

/** Палитры уроков курса в порядке программы: из них строится палитра
    «Позже в курсе» (D8). Известны без загрузки уроков. */
export const courseLessons = (course: string): ReadonlyArray<CourseLesson> =>
  Array.getSomes(
    Array.map(lessonsOf(course), lesson =>
      Option.map(
        Option.fromNullishOr(palettes[`${folderPath(lesson)}/lesson.ts`]),
        index => ({
          order: lesson.meta.order,
          palette: index.palette,
          introduces: index.introduces,
        }),
      ),
    ),
  )

/** Как палитра курса подаёт блоки (`defineCourse({ palette })`). */
export const coursePaletteMode = (course: string): PaletteMode =>
  Option.match(findCourse(course), {
    onNone: () => 'progressive',
    onSome: found => paletteModeOf(found.definition),
  })

/** Советует ли курс проходить уроки на компьютере
    (`defineCourse({ recommendsDesktop })`). */
export const courseRecommendsDesktop = (course: string): boolean =>
  Option.match(findCourse(course), {
    onNone: () => false,
    onSome: found => recommendsDesktopOf(found.definition),
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
