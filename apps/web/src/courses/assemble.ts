import { Array, Option, Order, String, pipe } from 'effect'

import { type Locale, isLocale } from '../i18n/locale'
import type {
  CourseDefinition,
  CourseText,
  LessonMeta,
  LessonText,
} from './model'

// Реестр курсов (design D2): курсы и их уроки собираются из модулей папок,
// а всё, что нарушает правила, возвращается списком проблем для тестов.

export type LocalizedText<Text> = Readonly<{ locale: Locale; text: Text }>

export type Lesson = Readonly<{
  course: string
  folder: string
  meta: LessonMeta
  texts: Array.NonEmptyReadonlyArray<LocalizedText<LessonText>>
}>

export type Course = Readonly<{
  definition: CourseDefinition
  texts: Array.NonEmptyReadonlyArray<LocalizedText<CourseText>>
  lessons: ReadonlyArray<Lesson>
}>

/** Модули по путям `import.meta.glob` относительно `src/courses/`. */
export type CatalogSources = Readonly<{
  courses: Readonly<Record<string, CourseDefinition>>
  courseTexts: Readonly<Record<string, CourseText>>
  metas: Readonly<Record<string, LessonMeta>>
  texts: Readonly<Record<string, LessonText>>
}>

export type AssembledCatalog = Readonly<{
  courses: ReadonlyArray<Course>
  problems: ReadonlyArray<string>
}>

const RESERVED_COURSE_IDS: ReadonlyArray<string> = ['lessons']

const segmentAt =
  (index: number) =>
  (modulePath: string): string =>
    pipe(
      modulePath,
      String.split('/'),
      Array.get(index),
      Option.getOrElse(() => modulePath),
    )

const courseFolderOf = segmentAt(1)
const lessonFolderOf = segmentAt(3)

const localeIn =
  (pattern: RegExp) =>
  (modulePath: string): Option.Option<string> =>
    pipe(modulePath, String.match(pattern), Option.flatMap(Array.get(1)))

const courseTextLocaleOf = localeIn(/course\.([^./]+)\.ts$/)
const lessonTextLocaleOf = localeIn(/text\.([^./]+)\.ts$/)

const isBlank = (value: string | undefined): boolean =>
  String.isEmpty(String.trim(value ?? ''))

const isKebabCase = (value: string): boolean =>
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)

const listed = (values: ReadonlyArray<string>): string => values.join(', ')

// TEXTS

type TextEntry<Text> = Readonly<{
  owner: string
  locale: string
  text: Text
}>

const textEntries = <Text>(
  texts: Readonly<Record<string, Text>>,
  ownerOf: (modulePath: string) => string,
  localeOf: (modulePath: string) => Option.Option<string>,
): ReadonlyArray<TextEntry<Text>> =>
  Array.getSomes(
    Array.map(Object.entries(texts), ([modulePath, text]) =>
      Option.map(localeOf(modulePath), locale => ({
        owner: ownerOf(modulePath),
        locale,
        text,
      })),
    ),
  )

const localizedTexts = <Text>(
  locales: ReadonlyArray<Locale>,
  entries: ReadonlyArray<TextEntry<Text>>,
): Option.Option<Array.NonEmptyReadonlyArray<LocalizedText<Text>>> =>
  pipe(
    Array.getSomes(
      Array.map(locales, locale =>
        Option.map(
          Array.findFirst(entries, entry => entry.locale === locale),
          ({ text }) => ({ locale, text }),
        ),
      ),
    ),
    Array.match({
      onEmpty: () => Option.none(),
      onNonEmpty: found => Option.some(found),
    }),
  )

const undeclaredLocaleProblems = <Text>(
  where: string,
  file: (locale: string) => string,
  declaredIn: string,
  locales: ReadonlyArray<Locale>,
  entries: ReadonlyArray<TextEntry<Text>>,
): ReadonlyArray<string> =>
  Array.map(
    Array.filter(
      entries,
      entry =>
        !isLocale(entry.locale) ||
        !Array.some(locales, locale => locale === entry.locale),
    ),
    entry =>
      `${where}: ${file(entry.locale)} exists but "${entry.locale}" is not declared in ${declaredIn}`,
  )

const duplicateProblems = <Entry>(
  entries: ReadonlyArray<Entry>,
  key: (entry: Entry) => string,
  name: (entry: Entry) => string,
  label: string,
): ReadonlyArray<string> =>
  Array.map(
    Array.filter(
      Object.entries(Array.groupBy(entries, key)),
      ([, group]) => group.length > 1,
    ),
    ([value, group]) =>
      `duplicate ${label} "${value}" in ${listed(Array.map(group, name))}`,
  )

// COURSES

type CourseEntry = Readonly<{ folder: string; definition: CourseDefinition }>

const courseProblems = (
  { folder, definition }: CourseEntry,
  entries: ReadonlyArray<TextEntry<CourseText>>,
): ReadonlyArray<string> => {
  const idProblems = [
    ...(folder === definition.id
      ? []
      : [
          `${folder}: course folder must be named "${definition.id}" (id from course.ts)`,
        ]),
    ...(isKebabCase(definition.id) &&
    !Array.some(RESERVED_COURSE_IDS, reserved => reserved === definition.id)
      ? []
      : [
          `${folder}: course id "${definition.id}" must be kebab-case and not one of ${listed(RESERVED_COURSE_IDS)}`,
        ]),
  ]

  const declaredProblems = Array.flatMap(definition.locales, locale =>
    Option.match(
      Array.findFirst(entries, entry => entry.locale === locale),
      {
        onNone: () => [
          `${folder}: missing course text for declared locale "${locale}" (course.${locale}.ts)`,
        ],
        onSome: ({ text }) => [
          ...(isBlank(text.title)
            ? [`${folder}: empty title in course.${locale}.ts`]
            : []),
          ...(isBlank(text.tagline)
            ? [`${folder}: empty tagline in course.${locale}.ts`]
            : []),
          ...Array.map(
            Array.filter(definition.modules, module =>
              isBlank(text.modules[module]),
            ),
            module =>
              `${folder}: missing title of module "${module}" in course.${locale}.ts`,
          ),
        ],
      },
    ),
  )

  return [
    ...idProblems,
    ...declaredProblems,
    ...undeclaredLocaleProblems(
      folder,
      locale => `course.${locale}.ts`,
      'course.ts',
      definition.locales,
      entries,
    ),
  ]
}

// LESSONS

const expectedFolder = (meta: LessonMeta): string =>
  `${`${meta.order}`.padStart(2, '0')}-${meta.slug}`

type LessonEntry = Readonly<{
  courseFolder: string
  folder: string
  meta: LessonMeta
}>

const lessonName = (entry: LessonEntry): string =>
  `${entry.courseFolder}/${entry.folder}`

const lessonProblems = (
  entry: LessonEntry,
  definition: CourseDefinition,
  entries: ReadonlyArray<TextEntry<LessonText>>,
): ReadonlyArray<string> => {
  const { folder, meta } = entry
  const where = lessonName(entry)

  const structureProblems = [
    ...(folder === expectedFolder(meta)
      ? []
      : [
          `${where}: folder must be named "${expectedFolder(meta)}" (order and slug from meta.ts)`,
        ]),
    ...(meta.course === definition.id
      ? []
      : [
          `${where}: meta.ts is defined with course "${meta.course}", but the lesson lives in "${definition.id}"`,
        ]),
    ...(Array.some(definition.modules, module => module === meta.module)
      ? []
      : [
          `${where}: module "${meta.module}" is not a module of ${definition.id} (${listed(definition.modules)})`,
        ]),
    ...Array.map(
      Array.filter(
        meta.unlocks,
        feature => !Array.some(definition.features, known => known === feature),
      ),
      feature =>
        `${where}: unlocks "${feature}", which is not a feature of ${definition.id}`,
    ),
  ]

  const declaredProblems = Array.flatMap(meta.locales, locale =>
    Option.match(
      Array.findFirst(entries, text => text.locale === locale),
      {
        onNone: () => [
          `${where}: missing translation for declared locale "${locale}" (text.${locale}.ts)`,
        ],
        onSome: ({ text }) => [
          ...(isBlank(text.title)
            ? [`${where}: empty title in text.${locale}.ts`]
            : []),
          ...(isBlank(text.summary)
            ? [`${where}: empty summary in text.${locale}.ts`]
            : []),
        ],
      },
    ),
  )

  return [
    ...structureProblems,
    ...declaredProblems,
    ...undeclaredLocaleProblems(
      where,
      locale => `text.${locale}.ts`,
      'meta.ts',
      meta.locales,
      entries,
    ),
  ]
}

const featureProblems = (
  courseId: string,
  entries: ReadonlyArray<LessonEntry>,
): ReadonlyArray<string> =>
  Array.map(
    Array.filter(
      Object.entries(
        Array.groupBy(
          Array.flatMap(entries, entry =>
            Array.map(Array.dedupe(entry.meta.unlocks), feature => ({
              feature,
              entry,
            })),
          ),
          ({ feature }) => feature,
        ),
      ),
      ([, group]) => group.length > 1,
    ),
    ([feature, group]) =>
      `${courseId}: feature "${feature}" is unlocked by more than one lesson: ${listed(Array.map(group, ({ entry }) => entry.folder))}`,
  )

const lessonOrderIn = (definition: CourseDefinition): Order.Order<Lesson> => {
  const moduleRank = (module: string): number =>
    Option.getOrElse(
      Array.findFirstIndex(
        definition.modules,
        candidate => candidate === module,
      ),
      () => definition.modules.length,
    )

  return Order.combine(
    Order.mapInput(Order.Number, (lesson: Lesson) =>
      moduleRank(lesson.meta.module),
    ),
    Order.mapInput(Order.Number, (lesson: Lesson) => lesson.meta.order),
  )
}

type AssembledLessons = Readonly<{
  lessons: ReadonlyArray<Lesson>
  problems: ReadonlyArray<string>
}>

const assembleLessons = (
  definition: CourseDefinition,
  entries: ReadonlyArray<LessonEntry>,
  texts: ReadonlyArray<TextEntry<LessonText>>,
): AssembledLessons => {
  const assembled = Array.map(entries, entry => {
    const own = Array.filter(texts, text => text.owner === lessonName(entry))
    const problems = lessonProblems(entry, definition, own)
    const maybeLesson: Option.Option<Lesson> = Array.isReadonlyArrayEmpty(
      problems,
    )
      ? Option.map(localizedTexts(entry.meta.locales, own), found => ({
          course: definition.id,
          folder: entry.folder,
          meta: entry.meta,
          texts: found,
        }))
      : Option.none()
    return { problems, maybeLesson }
  })

  return {
    lessons: Array.sort(
      Array.getSomes(Array.map(assembled, ({ maybeLesson }) => maybeLesson)),
      lessonOrderIn(definition),
    ),
    problems: [
      ...Array.flatMap(assembled, ({ problems }) => problems),
      ...duplicateProblems(
        entries,
        ({ meta }) => meta.slug,
        lessonName,
        'slug',
      ),
      ...duplicateProblems(
        entries,
        ({ meta }) => `${meta.order}`,
        lessonName,
        'order',
      ),
      ...featureProblems(definition.id, entries),
    ],
  }
}

// CATALOG

const byCourseOrder = Order.mapInput(
  Order.Number,
  (course: Course) => course.definition.order,
)

export const assembleCatalog = (sources: CatalogSources): AssembledCatalog => {
  const courseEntries: ReadonlyArray<CourseEntry> = Array.map(
    Object.entries(sources.courses),
    ([modulePath, definition]) => ({
      folder: courseFolderOf(modulePath),
      definition,
    }),
  )
  const courseTexts = textEntries(
    sources.courseTexts,
    courseFolderOf,
    courseTextLocaleOf,
  )
  const lessonEntries: ReadonlyArray<LessonEntry> = Array.map(
    Object.entries(sources.metas),
    ([modulePath, meta]) => ({
      courseFolder: courseFolderOf(modulePath),
      folder: lessonFolderOf(modulePath),
      meta,
    }),
  )
  const lessonTexts = textEntries(
    sources.texts,
    modulePath => `${courseFolderOf(modulePath)}/${lessonFolderOf(modulePath)}`,
    lessonTextLocaleOf,
  )

  const orphanProblems = Array.map(
    Array.filter(
      lessonEntries,
      entry =>
        !Array.some(
          courseEntries,
          course => course.folder === entry.courseFolder,
        ),
    ),
    entry =>
      `${lessonName(entry)}: there is no course.ts in "${entry.courseFolder}"`,
  )

  const assembled = Array.map(courseEntries, entry => {
    const problems = courseProblems(
      entry,
      Array.filter(courseTexts, text => text.owner === entry.folder),
    )
    const lessons = assembleLessons(
      entry.definition,
      Array.filter(
        lessonEntries,
        lesson => lesson.courseFolder === entry.folder,
      ),
      lessonTexts,
    )
    const maybeCourse: Option.Option<Course> = Array.isReadonlyArrayEmpty(
      problems,
    )
      ? Option.map(
          localizedTexts(
            entry.definition.locales,
            Array.filter(courseTexts, text => text.owner === entry.folder),
          ),
          texts => ({
            definition: entry.definition,
            texts,
            lessons: lessons.lessons,
          }),
        )
      : Option.none()
    return { problems: [...problems, ...lessons.problems], maybeCourse }
  })

  return {
    courses: Array.sort(
      Array.getSomes(Array.map(assembled, ({ maybeCourse }) => maybeCourse)),
      byCourseOrder,
    ),
    problems: [
      ...Array.flatMap(assembled, ({ problems }) => problems),
      ...orphanProblems,
      ...duplicateProblems(
        courseEntries,
        ({ definition }) => definition.id,
        ({ folder }) => folder,
        'course id',
      ),
      ...duplicateProblems(
        courseEntries,
        ({ definition }) => `${definition.order}`,
        ({ folder }) => folder,
        'course order',
      ),
    ],
  }
}

// MODULES

export type CourseModule = Readonly<{
  module: string
  lessons: Array.NonEmptyReadonlyArray<Lesson>
}>

/** Модули курса с их уроками в порядке курса. Модуль без уроков не
    показывается: его уроков в этой сборке нет. */
export const courseModules = (course: Course): ReadonlyArray<CourseModule> =>
  Array.getSomes(
    Array.map(course.definition.modules, module =>
      Option.map(
        Array.match(
          Array.filter(course.lessons, lesson => lesson.meta.module === module),
          {
            onEmpty: () => Option.none(),
            onNonEmpty: lessons => Option.some(lessons),
          },
        ),
        lessons => ({ module, lessons }),
      ),
    ),
  )

// TEXT CHOICE

export type TextChoice<Text> = Readonly<{
  text: Text
  shownIn: Locale
  isFallback: boolean
}>

const FALLBACK_LOCALE: Locale = 'en'

/** Текст на языке страницы, иначе на английском, иначе на первом объявленном. */
export const textFor = <Text>(
  texts: Array.NonEmptyReadonlyArray<LocalizedText<Text>>,
  locale: Locale,
): TextChoice<Text> => {
  const textIn = (wanted: Locale) =>
    Array.findFirst(texts, entry => entry.locale === wanted)

  return pipe(
    textIn(locale),
    Option.map(({ text, locale: shownIn }) => ({
      text,
      shownIn,
      isFallback: false,
    })),
    Option.orElse(() =>
      Option.map(textIn(FALLBACK_LOCALE), ({ text, locale: shownIn }) => ({
        text,
        shownIn,
        isFallback: true,
      })),
    ),
    Option.getOrElse(() => {
      const first = Array.headNonEmpty(texts)
      return { text: first.text, shownIn: first.locale, isFallback: true }
    }),
  )
}

export type LessonTextChoice = TextChoice<LessonText>

export const lessonTextFor = (
  lesson: Lesson,
  locale: Locale,
): LessonTextChoice => textFor(lesson.texts, locale)

export const courseTextFor = (
  course: Course,
  locale: Locale,
): TextChoice<CourseText> => textFor(course.texts, locale)
