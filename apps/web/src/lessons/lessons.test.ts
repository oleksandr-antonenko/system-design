import { Array, Order } from 'effect'
import { describe, expect, test } from 'vitest'

import { locales } from '../i18n/locale'
import { assembleCourse, lessonTextFor } from './assemble'
import type { LessonMeta, LessonText } from './model'
import { course, findLesson, lessons } from './registry'

const text = (title: string): LessonText => ({ title, summary: `${title} summary` })

const meta = (overrides: Partial<LessonMeta> = {}): LessonMeta => ({
  slug: 'demo',
  module: 'foundations',
  order: 1,
  available: false,
  locales: ['uk', 'ru', 'en', 'lt'],
  ...overrides,
})

describe('course registry', () => {
  test('all lesson modules are valid', () => {
    expect(course.problems).toEqual([])
  })

  test('the course has 13 lessons in order', () => {
    expect(lessons.map(lesson => lesson.meta.order)).toEqual(
      Array.range(1, 13),
    )
  })

  test('every lesson ships all four languages', () => {
    lessons.forEach(lesson => {
      expect(
        Array.sort(
          lesson.texts.map(entry => entry.locale),
          Order.String,
        ),
      ).toEqual(Array.sort(locales, Order.String))
    })
  })

  test('lessons are found by slug', () => {
    expect(findLesson('load-balancer')._tag).toBe('Some')
    expect(findLesson('no-such-lesson')._tag).toBe('None')
  })
})

describe('assembleCourse', () => {
  const fullTexts = (folder: string) =>
    Object.fromEntries(
      locales.map(locale => [`./${folder}/text.${locale}.ts`, text(`${folder} ${locale}`)]),
    )

  test('a new folder joins the course without touching other files', () => {
    const assembled = assembleCourse({
      metas: {
        './01-demo/meta.ts': meta(),
        './02-extra/meta.ts': meta({ slug: 'extra', order: 2 }),
      },
      texts: { ...fullTexts('01-demo'), ...fullTexts('02-extra') },
    })

    expect(assembled.problems).toEqual([])
    expect(assembled.lessons.map(lesson => lesson.meta.slug)).toEqual([
      'demo',
      'extra',
    ])
  })

  test('a missing translation of a declared language names the lesson and language', () => {
    const { ['./01-demo/text.lt.ts']: _removed, ...withoutLithuanian } =
      fullTexts('01-demo')

    const assembled = assembleCourse({
      metas: { './01-demo/meta.ts': meta() },
      texts: withoutLithuanian,
    })

    expect(assembled.problems).toEqual([
      '01-demo: missing translation for declared locale "lt" (text.lt.ts)',
    ])
    expect(assembled.lessons).toEqual([])
  })

  test('folder name, blank text, undeclared language and duplicates are reported', () => {
    const assembled = assembleCourse({
      metas: {
        './1-demo/meta.ts': meta({ locales: ['en'] }),
        './02-copy/meta.ts': meta({ slug: 'copy', order: 2, locales: ['en'] }),
        './03-copy/meta.ts': meta({ slug: 'copy', order: 3, locales: ['en'] }),
      },
      texts: {
        './1-demo/text.en.ts': { title: ' ', summary: 'ok' },
        './02-copy/text.en.ts': text('copy'),
        './02-copy/text.ru.ts': text('копия'),
        './03-copy/text.en.ts': text('copy'),
      },
    })

    expect(assembled.problems).toEqual([
      '1-demo: folder must be named "01-demo" (order and slug from meta.ts)',
      '1-demo: empty title in text.en.ts',
      '02-copy: text.ru.ts exists but "ru" is not declared in meta.ts',
      'duplicate slug "copy" in 02-copy, 03-copy',
    ])
  })
})

describe('lessonTextFor', () => {
  const lessonIn = (languages: LessonMeta['locales']) => {
    const assembled = assembleCourse({
      metas: { './01-demo/meta.ts': meta({ locales: languages }) },
      texts: Object.fromEntries(
        languages.map(locale => [`./01-demo/text.${locale}.ts`, text(locale)]),
      ),
    })
    return Array.headNonEmpty(
      Array.match(assembled.lessons, {
        onEmpty: () => {
          throw new Error(assembled.problems.join('\n'))
        },
        onNonEmpty: nonEmpty => nonEmpty,
      }),
    )
  }

  test('uses the page language when the lesson has it', () => {
    expect(lessonTextFor(lessonIn(['ru', 'en']), 'ru')).toEqual({
      text: text('ru'),
      shownIn: 'ru',
      isFallback: false,
    })
  })

  test('falls back to English for a lesson written in English and Russian opened in Lithuanian', () => {
    expect(lessonTextFor(lessonIn(['en', 'ru']), 'lt')).toEqual({
      text: text('en'),
      shownIn: 'en',
      isFallback: true,
    })
  })

  test('falls back to the first declared language when there is no English', () => {
    expect(lessonTextFor(lessonIn(['uk', 'ru']), 'lt')).toEqual({
      text: text('uk'),
      shownIn: 'uk',
      isFallback: true,
    })
  })
})
