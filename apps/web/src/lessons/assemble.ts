import { Array, Option, Order, String, pipe } from 'effect'

import type { Locale } from '../i18n/locale'
import {
  type LessonMeta,
  type LessonText,
  type ModuleId,
  moduleOrder,
} from './model'

export type LocalizedText = Readonly<{ locale: Locale; text: LessonText }>

export type Lesson = Readonly<{
  folder: string
  meta: LessonMeta
  texts: Array.NonEmptyReadonlyArray<LocalizedText>
}>

export type LessonSources = Readonly<{
  metas: Readonly<Record<string, LessonMeta>>
  texts: Readonly<Record<string, LessonText>>
}>

export type AssembledCourse = Readonly<{
  lessons: ReadonlyArray<Lesson>
  problems: ReadonlyArray<string>
}>

const folderOf = (modulePath: string): string =>
  pipe(
    modulePath,
    String.split('/'),
    Array.get(1),
    Option.getOrElse(() => modulePath),
  )

const textLocaleOf = (modulePath: string): Option.Option<string> =>
  pipe(
    modulePath,
    String.match(/text\.([^.]+)\.ts$/),
    Option.flatMap(Array.get(1)),
  )

const expectedFolder = (meta: LessonMeta): string =>
  `${`${meta.order}`.padStart(2, '0')}-${meta.slug}`

type TextEntry = Readonly<{ folder: string; locale: string; text: LessonText }>

const textEntries = (texts: LessonSources['texts']): ReadonlyArray<TextEntry> =>
  Array.getSomes(
    Array.map(Object.entries(texts), ([modulePath, text]) =>
      Option.map(textLocaleOf(modulePath), locale => ({
        folder: folderOf(modulePath),
        locale,
        text,
      })),
    ),
  )

const isBlank = (value: string): boolean => String.isEmpty(String.trim(value))

const problemsForLesson = (
  folder: string,
  meta: LessonMeta,
  entries: ReadonlyArray<TextEntry>,
): ReadonlyArray<string> => {
  const folderProblems =
    folder === expectedFolder(meta)
      ? []
      : [
          `${folder}: folder must be named "${expectedFolder(meta)}" (order and slug from meta.ts)`,
        ]

  const declaredProblems = Array.flatMap(meta.locales, locale =>
    Option.match(
      Array.findFirst(entries, entry => entry.locale === locale),
      {
        onNone: () => [
          `${folder}: missing translation for declared locale "${locale}" (text.${locale}.ts)`,
        ],
        onSome: ({ text }) => [
          ...(isBlank(text.title)
            ? [`${folder}: empty title in text.${locale}.ts`]
            : []),
          ...(isBlank(text.summary)
            ? [`${folder}: empty summary in text.${locale}.ts`]
            : []),
        ],
      },
    ),
  )

  const undeclaredProblems = Array.map(
    Array.filter(
      entries,
      entry => !Array.some(meta.locales, locale => locale === entry.locale),
    ),
    entry =>
      `${folder}: text.${entry.locale}.ts exists but "${entry.locale}" is not declared in meta.ts`,
  )

  return [...folderProblems, ...declaredProblems, ...undeclaredProblems]
}

type FolderMeta = Readonly<{ folder: string; meta: LessonMeta }>

const duplicateProblems = (
  entries: ReadonlyArray<FolderMeta>,
  key: (entry: FolderMeta) => string,
  label: string,
): ReadonlyArray<string> =>
  Array.map(
    Array.filter(
      Object.entries(Array.groupBy(entries, key)),
      ([, group]) => group.length > 1,
    ),
    ([value, group]) =>
      `duplicate ${label} "${value}" in ${Array.map(group, entry => entry.folder).join(', ')}`,
  )

const moduleRank = (module: ModuleId): number =>
  Option.getOrElse(
    Array.findFirstIndex(moduleOrder, candidate => candidate === module),
    () => moduleOrder.length,
  )

const lessonOrder: Order.Order<Lesson> = Order.combine(
  Order.mapInput(Order.Number, (lesson: Lesson) =>
    moduleRank(lesson.meta.module),
  ),
  Order.mapInput(Order.Number, (lesson: Lesson) => lesson.meta.order),
)

const toLocalizedTexts = (
  meta: LessonMeta,
  entries: ReadonlyArray<TextEntry>,
): Option.Option<Array.NonEmptyReadonlyArray<LocalizedText>> =>
  pipe(
    Array.getSomes(
      Array.map(meta.locales, locale =>
        Option.map(
          Array.findFirst(entries, entry => entry.locale === locale),
          ({ text }) => ({ locale, text }),
        ),
      ),
    ),
    Array.match({
      onEmpty: () => Option.none(),
      onNonEmpty: localizedTexts => Option.some(localizedTexts),
    }),
  )

export const assembleCourse = ({
  metas,
  texts,
}: LessonSources): AssembledCourse => {
  const allTexts = textEntries(texts)

  const folderMetas = Array.map(
    Object.entries(metas),
    ([modulePath, meta]) => ({
      folder: folderOf(modulePath),
      meta,
    }),
  )

  const assembled = Array.map(folderMetas, ({ folder, meta }) => {
    const entries = Array.filter(allTexts, entry => entry.folder === folder)
    const problems = problemsForLesson(folder, meta, entries)
    const maybeLesson = Array.isReadonlyArrayEmpty(problems)
      ? Option.map(toLocalizedTexts(meta, entries), localizedTexts => ({
          folder,
          meta,
          texts: localizedTexts,
        }))
      : Option.none()

    return { problems, maybeLesson }
  })

  const lessons = Array.sort(
    Array.getSomes(Array.map(assembled, ({ maybeLesson }) => maybeLesson)),
    lessonOrder,
  )

  return {
    lessons,
    problems: [
      ...Array.flatMap(assembled, ({ problems }) => problems),
      ...duplicateProblems(folderMetas, ({ meta }) => meta.slug, 'slug'),
      ...duplicateProblems(folderMetas, ({ meta }) => `${meta.order}`, 'order'),
    ],
  }
}

export type LessonTextChoice = Readonly<{
  text: LessonText
  shownIn: Locale
  isFallback: boolean
}>

const FALLBACK_LOCALE: Locale = 'en'

export const lessonTextFor = (
  lesson: Lesson,
  locale: Locale,
): LessonTextChoice => {
  const textIn = (wanted: Locale) =>
    Array.findFirst(lesson.texts, entry => entry.locale === wanted)

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
      const first = Array.headNonEmpty(lesson.texts)
      return { text: first.text, shownIn: first.locale, isFallback: true }
    }),
  )
}
