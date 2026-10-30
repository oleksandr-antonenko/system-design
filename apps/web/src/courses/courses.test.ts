import { Array, Option, Order } from 'effect'
import { describe, expect, test } from 'vitest'

import { type Locale, locales } from '../i18n/locale'
import {
  type CatalogSources,
  assembleCatalog,
  courseTextFor,
  lessonTextFor,
} from './assemble'
import {
  type CourseText,
  type LessonMeta,
  type LessonText,
  defineCourse,
} from './model'
import networks from './networks/course'
import { UiFeature } from './networks/features'
import {
  catalog,
  courses,
  findCourse,
  findDefinition,
  findLesson,
  isUnlocked,
  lessonsOf,
  newFeatures,
  unlockedFeatures,
} from './registry'
import systemDesign from './system-design/course'
import { isSurfaceOpen } from './unlocks'

const sorted = (values: ReadonlyArray<string>) =>
  Array.sort(values, Order.String)

describe('course registry', () => {
  test('all course and lesson modules are valid', () => {
    expect(catalog.problems).toEqual([])
  })

  test('the catalogue lists System Design, then Networking', () => {
    expect(courses.map(course => course.definition.id)).toEqual([
      'system-design',
      'networks',
    ])
  })

  test('System Design has 13 available lessons in order, in all four languages', () => {
    const lessons = lessonsOf('system-design')
    expect(lessons.map(lesson => lesson.meta.order)).toEqual(Array.range(1, 13))
    expect(lessons.every(lesson => lesson.meta.available)).toBe(true)
    lessons.forEach(lesson => {
      expect(sorted(lesson.texts.map(entry => entry.locale))).toEqual(
        sorted(locales),
      )
    })
  })

  test('Networking shows the 16 lessons of the programme as “coming soon”', () => {
    const lessons = lessonsOf('networks')
    expect(lessons.map(lesson => lesson.meta.slug)).toEqual([
      'phone-online',
      'addresses',
      'site-names',
      'hops-and-ping',
      'wifi-range',
      'ports-and-localhost',
      'under-the-hood',
      'routing',
      'nat',
      'dns-records',
      'https',
      'firewall',
      'vpn',
      'dev-networks',
      'troubleshooting',
      'ship-it',
    ])
    expect(lessons.map(lesson => lesson.meta.order)).toEqual(Array.range(1, 16))
    expect(lessons.map(lesson => lesson.meta.module)).toEqual([
      ...Array.replicate('local', 7),
      ...Array.replicate('internet', 4),
      ...Array.replicate('developer', 5),
    ])
    expect(
      lessons
        .filter(lesson => lesson.meta.available)
        .every(lesson =>
          Option.isSome(findDefinition('networks', lesson.meta.slug)),
        ),
      'an available lesson has a script',
    ).toBe(true)
    expect(
      Option.map(
        findLesson('networks', 'ports-and-localhost'),
        lesson => lesson.meta.available,
      ),
    ).toEqual(Option.some(true))
    lessons.forEach(lesson => {
      expect(sorted(lesson.texts.map(entry => entry.locale))).toEqual(
        sorted(locales),
      )
    })
  })

  test('course titles in every language', () => {
    const titles = (id: string) =>
      Option.match(findCourse(id), {
        onNone: () => [],
        onSome: course =>
          locales.map(locale => courseTextFor(course, locale).text.title),
      })
    expect(titles('networks')).toEqual([
      'Мережі для вайбкодерів',
      'Сети для вайбкодеров',
      'Networking for vibe coders',
      'Tinklai vaibkoderiams',
    ])
    expect(titles('system-design')).toEqual(Array.replicate('System Design', 4))
  })

  test('lessons are found by course and slug', () => {
    expect(findLesson('system-design', 'load-balancer')._tag).toBe('Some')
    expect(findLesson('networks', 'load-balancer')._tag).toBe('None')
    expect(findLesson('networks', 'phone-online')._tag).toBe('Some')
    expect(findLesson('no-such-course', 'phone-online')._tag).toBe('None')
  })
})

describe('unlocks in the real courses (plan 3.4)', () => {
  test('every Networking feature is unlocked by exactly one lesson', () => {
    const unlocked = lessonsOf('networks').flatMap(
      lesson => lesson.meta.unlocks,
    )
    expect(sorted(unlocked)).toEqual(sorted(UiFeature.literals))
  })

  test('ping opens in lesson 4 and stays open afterwards', () => {
    expect(isUnlocked(networks, 3, 'terminal.ping')).toBe(false)
    expect(isUnlocked(networks, 4, 'terminal.ping')).toBe(true)
    expect(isUnlocked(networks, 5, 'terminal.ping')).toBe(true)
    expect(newFeatures(networks, 4)).toContain('terminal.ping')
    expect(newFeatures(networks, 5)).not.toContain('terminal.ping')
  })

  test('lesson 1 opens only the Run button, the envelope and the phone', () => {
    expect(unlockedFeatures(networks, 1)).toEqual([
      'transport.run',
      'board.devices',
      'board.envelope',
      'board.routerSticker',
      'quiz.pickDevice',
      'wifi.join',
      'browser.page',
    ])
    expect(isSurfaceOpen(unlockedFeatures(networks, 1), 'terminal')).toBe(false)
    expect(isSurfaceOpen(unlockedFeatures(networks, 4), 'terminal')).toBe(true)
    expect(isSurfaceOpen(unlockedFeatures(networks, 4), 'router')).toBe(false)
    expect(isSurfaceOpen(unlockedFeatures(networks, 5), 'router')).toBe(true)
  })

  test('the last lesson has everything open', () => {
    expect(unlockedFeatures(networks, 16)).toEqual(UiFeature.literals)
  })

  test('System Design unlocks nothing', () => {
    expect(systemDesign.features).toEqual([])
    expect(unlockedFeatures(systemDesign, 13)).toEqual([])
  })
})

// ASSEMBLE

const demoCourse = defineCourse({
  id: 'demo',
  order: 1,
  board: 'flow',
  modules: ['basics', 'advanced'],
  features: ['panel.a', 'panel.b'],
  locales: ['uk', 'ru', 'en', 'lt'],
})

const courseText = (title: string): CourseText => ({
  title,
  tagline: `${title} tagline`,
  modules: { basics: 'Basics', advanced: 'Advanced' },
})

const text = (title: string): LessonText => ({
  title,
  summary: `${title} summary`,
})

const meta = (overrides: Partial<LessonMeta> = {}): LessonMeta => ({
  course: 'demo',
  slug: 'intro',
  module: 'basics',
  order: 1,
  available: false,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: [],
  ...overrides,
})

const courseTexts = (
  folder: string,
  languages: ReadonlyArray<Locale> = locales,
) =>
  Object.fromEntries(
    languages.map(locale => [
      `./${folder}/course.${locale}.ts`,
      courseText(`${folder} ${locale}`),
    ]),
  )

const lessonTexts = (
  folder: string,
  languages: ReadonlyArray<Locale> = locales,
) =>
  Object.fromEntries(
    languages.map(locale => [
      `./demo/lessons/${folder}/text.${locale}.ts`,
      text(`${folder} ${locale}`),
    ]),
  )

const demo = (
  lessons: Readonly<Record<string, LessonMeta>>,
  texts: Readonly<Record<string, LessonText>>,
): CatalogSources => ({
  courses: { './demo/course.ts': demoCourse },
  courseTexts: courseTexts('demo'),
  metas: lessons,
  texts,
})

describe('assembleCatalog', () => {
  test('a new course folder with a lesson joins the catalogue', () => {
    const assembled = assembleCatalog(
      demo(
        {
          './demo/lessons/02-next/meta.ts': meta({
            slug: 'next',
            order: 2,
            module: 'advanced',
          }),
          './demo/lessons/01-intro/meta.ts': meta(),
        },
        { ...lessonTexts('01-intro'), ...lessonTexts('02-next') },
      ),
    )

    expect(assembled.problems).toEqual([])
    expect(assembled.courses.map(course => course.definition.id)).toEqual([
      'demo',
    ])
    expect(
      assembled.courses.flatMap(course =>
        course.lessons.map(lesson => `${lesson.course}/${lesson.meta.slug}`),
      ),
    ).toEqual(['demo/intro', 'demo/next'])
  })

  test('a missing translation of a declared language names the lesson and language', () => {
    const { ['./demo/lessons/01-intro/text.lt.ts']: _removed, ...rest } =
      lessonTexts('01-intro')

    const assembled = assembleCatalog(
      demo({ './demo/lessons/01-intro/meta.ts': meta() }, rest),
    )

    expect(assembled.problems).toEqual([
      'demo/01-intro: missing translation for declared locale "lt" (text.lt.ts)',
    ])
    expect(assembled.courses.flatMap(course => course.lessons)).toEqual([])
  })

  test('folder name, blank text, undeclared language and duplicates are reported', () => {
    const assembled = assembleCatalog(
      demo(
        {
          './demo/lessons/1-intro/meta.ts': meta({ locales: ['en'] }),
          './demo/lessons/02-copy/meta.ts': meta({
            slug: 'copy',
            order: 2,
            locales: ['en'],
          }),
          './demo/lessons/03-copy/meta.ts': meta({
            slug: 'copy',
            order: 3,
            locales: ['en'],
          }),
        },
        {
          './demo/lessons/1-intro/text.en.ts': { title: ' ', summary: 'ok' },
          './demo/lessons/02-copy/text.en.ts': text('copy'),
          './demo/lessons/02-copy/text.ru.ts': text('копия'),
          './demo/lessons/03-copy/text.en.ts': text('copy'),
        },
      ),
    )

    expect(assembled.problems).toEqual([
      'demo/1-intro: folder must be named "01-intro" (order and slug from meta.ts)',
      'demo/1-intro: empty title in text.en.ts',
      'demo/02-copy: text.ru.ts exists but "ru" is not declared in meta.ts',
      'duplicate slug "copy" in demo/02-copy, demo/03-copy',
    ])
  })

  test('a lesson is checked against the modules and features of its own course', () => {
    const assembled = assembleCatalog(
      demo(
        {
          './demo/lessons/01-intro/meta.ts': meta({
            module: 'scaling',
            unlocks: ['panel.a', 'terminal.telnet'],
          }),
          './demo/lessons/02-next/meta.ts': meta({
            slug: 'next',
            order: 2,
            unlocks: ['panel.a'],
          }),
          './demo/lessons/03-foreign/meta.ts': meta({
            course: 'other',
            slug: 'foreign',
            order: 3,
          }),
        },
        {
          ...lessonTexts('01-intro'),
          ...lessonTexts('02-next'),
          ...lessonTexts('03-foreign'),
        },
      ),
    )

    expect(assembled.problems).toEqual([
      'demo/01-intro: module "scaling" is not a module of demo (basics, advanced)',
      'demo/01-intro: unlocks "terminal.telnet", which is not a feature of demo',
      'demo/03-foreign: meta.ts is defined with course "other", but the lesson lives in "demo"',
      'demo: feature "panel.a" is unlocked by more than one lesson: 01-intro, 02-next',
    ])
  })

  test('course folder, id, texts and order are checked', () => {
    const assembled = assembleCatalog({
      courses: {
        './renamed/course.ts': demoCourse,
        './lessons/course.ts': defineCourse({
          id: 'lessons',
          order: 2,
          board: 'flow',
          modules: ['basics'],
          features: [],
          locales: ['en'],
        }),
        './twin/course.ts': defineCourse({
          id: 'twin',
          order: 2,
          board: 'packet',
          modules: ['basics'],
          features: [],
          locales: ['en', 'lt'],
        }),
      },
      courseTexts: {
        ...courseTexts('renamed'),
        './lessons/course.en.ts': courseText('Lessons'),
        './twin/course.en.ts': {
          title: 'Twin',
          tagline: ' ',
          modules: {},
        },
        './twin/course.ru.ts': courseText('Близнец'),
      },
      metas: { './ghost/lessons/01-intro/meta.ts': meta() },
      texts: {},
    })

    expect(assembled.problems).toEqual([
      'renamed: course folder must be named "demo" (id from course.ts)',
      'lessons: course id "lessons" must be kebab-case and not one of lessons',
      'twin: empty tagline in course.en.ts',
      'twin: missing title of module "basics" in course.en.ts',
      'twin: missing course text for declared locale "lt" (course.lt.ts)',
      'twin: course.ru.ts exists but "ru" is not declared in course.ts',
      'ghost/01-intro: there is no course.ts in "ghost"',
      'duplicate course order "2" in lessons, twin',
    ])
    expect(assembled.courses).toEqual([])
  })

  test('courses are ordered by their place in the catalogue', () => {
    const assembled = assembleCatalog({
      courses: {
        './beta/course.ts': defineCourse({
          id: 'beta',
          order: 2,
          board: 'packet',
          modules: ['basics'],
          features: [],
          locales: ['en'],
        }),
        './alpha/course.ts': defineCourse({
          id: 'alpha',
          order: 1,
          board: 'flow',
          modules: ['basics'],
          features: [],
          locales: ['en'],
        }),
      },
      courseTexts: {
        './beta/course.en.ts': courseText('Beta'),
        './alpha/course.en.ts': courseText('Alpha'),
      },
      metas: {},
      texts: {},
    })

    expect(assembled.problems).toEqual([])
    expect(assembled.courses.map(course => course.definition.id)).toEqual([
      'alpha',
      'beta',
    ])
  })
})

describe('texts in the page language', () => {
  const lessonIn = (languages: LessonMeta['locales']) => {
    const assembled = assembleCatalog(
      demo(
        { './demo/lessons/01-intro/meta.ts': meta({ locales: languages }) },
        Object.fromEntries(
          languages.map(locale => [
            `./demo/lessons/01-intro/text.${locale}.ts`,
            text(locale),
          ]),
        ),
      ),
    )
    return Array.headNonEmpty(
      Array.match(
        assembled.courses.flatMap(course => course.lessons),
        {
          onEmpty: () => {
            throw new Error(assembled.problems.join('\n'))
          },
          onNonEmpty: nonEmpty => nonEmpty,
        },
      ),
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

  test('a course written only in Ukrainian is shown in Ukrainian with a notice flag', () => {
    const assembled = assembleCatalog({
      courses: {
        './solo/course.ts': defineCourse({
          id: 'solo',
          order: 1,
          board: 'flow',
          modules: ['basics'],
          features: [],
          locales: ['uk'],
        }),
      },
      courseTexts: { './solo/course.uk.ts': courseText('Соло') },
      metas: {},
      texts: {},
    })

    expect(
      assembled.courses.map(course => courseTextFor(course, 'lt')),
    ).toEqual([{ text: courseText('Соло'), shownIn: 'uk', isFallback: true }])
  })
})
