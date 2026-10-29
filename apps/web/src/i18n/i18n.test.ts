import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { DomainMessage, renderDomainMessage } from './domainMessage'
import { formatNumber } from './format'
import { type Locale, locales, resolveLocale } from './locale'
import { uiFor, uiStrings } from './ui'

describe('resolveLocale', () => {
  test.each([
    {
      name: 'saved choice wins over the browser',
      saved: Option.some('lt'),
      browser: ['uk-UA'],
      expected: 'lt',
    },
    {
      name: 'first supported browser language',
      saved: Option.none(),
      browser: ['uk-UA', 'en-US'],
      expected: 'uk',
    },
    {
      name: 'browser languages are matched by primary subtag, in order',
      saved: Option.none(),
      browser: ['de-DE', 'RU', 'en'],
      expected: 'ru',
    },
    {
      name: 'unsupported browser language falls back to English',
      saved: Option.none(),
      browser: ['de-DE'],
      expected: 'en',
    },
    {
      name: 'corrupted saved value is ignored',
      saved: Option.some('xx'),
      browser: ['lt-LT'],
      expected: 'lt',
    },
    {
      name: 'nothing known falls back to English',
      saved: Option.none(),
      browser: [],
      expected: 'en',
    },
  ])('$name', ({ saved, browser, expected }) => {
    expect(
      resolveLocale({ maybeSavedLocale: saved, browserLanguages: browser }),
    ).toBe(expected)
  })
})

describe('plural forms', () => {
  const lessonCounts = (locale: Locale) =>
    [0, 1, 2, 3, 5, 10, 11, 21, 22, 1.5].map(uiFor(locale).home.lessonCount)

  test('Ukrainian', () => {
    expect(lessonCounts('uk')).toEqual([
      '0 уроків',
      '1 урок',
      '2 уроки',
      '3 уроки',
      '5 уроків',
      '10 уроків',
      '11 уроків',
      '21 урок',
      '22 уроки',
      '1,5 уроку',
    ])
  })

  test('Russian', () => {
    expect(lessonCounts('ru')).toEqual([
      '0 уроков',
      '1 урок',
      '2 урока',
      '3 урока',
      '5 уроков',
      '10 уроков',
      '11 уроков',
      '21 урок',
      '22 урока',
      '1,5 урока',
    ])
  })

  test('Lithuanian', () => {
    expect(lessonCounts('lt')).toEqual([
      '0 pamokų',
      '1 pamoka',
      '2 pamokos',
      '3 pamokos',
      '5 pamokos',
      '10 pamokų',
      '11 pamokų',
      '21 pamoka',
      '22 pamokos',
      '1,5 pamokos',
    ])
  })

  test('English', () => {
    expect(lessonCounts('en')).toEqual([
      '0 lessons',
      '1 lesson',
      '2 lessons',
      '3 lessons',
      '5 lessons',
      '10 lessons',
      '11 lessons',
      '21 lessons',
      '22 lessons',
      '1.5 lessons',
    ])
  })
})

describe('number formatting', () => {
  test('English uses a comma as the thousands separator', () => {
    expect(formatNumber('en', 12500)).toBe('12,500')
  })

  test.each(['uk', 'ru', 'lt'] as const)(
    '%s groups thousands with a space',
    locale => {
      expect(formatNumber(locale, 12500)).toMatch(/^12\s500$/u)
    },
  )
})

const collectStrings = (
  value: unknown,
  path: string,
): ReadonlyArray<[string, string]> => {
  if (typeof value === 'string') {
    return [[path, value]]
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) =>
      collectStrings(child, `${path}.${key}`),
    )
  }
  return []
}

describe('UI dictionaries', () => {
  test.each(locales)('%s has no blank strings', locale => {
    const blank = collectStrings(uiStrings[locale], locale).filter(
      ([, text]) => text.trim() === '',
    )
    expect(blank).toEqual([])
  })

  test('every dictionary has the same keys as English', () => {
    const keysOf = (locale: Locale) =>
      collectStrings(uiStrings[locale], '').map(([path]) => path)
    locales.forEach(locale => {
      expect(keysOf(locale)).toEqual(keysOf('en'))
    })
  })
})

describe('domain messages', () => {
  test('the same message renders in every language with the same parameters', () => {
    const message = DomainMessage.UnknownLesson({ slug: 'quantum-cache' })
    const rendered = locales.map(locale =>
      renderDomainMessage(uiFor(locale).domain, message),
    )

    rendered.forEach(text => expect(text).toContain('quantum-cache'))
    expect(new Set(rendered).size).toBe(locales.length)
  })

  test('the untranslated-lesson notice names the language shown', () => {
    const message = DomainMessage.LessonNotTranslated({ shownIn: 'en' })

    expect(renderDomainMessage(uiFor('lt').domain, message)).toContain(
      'anglų kalba',
    )
    expect(renderDomainMessage(uiFor('uk').domain, message)).toContain(
      'англійською',
    )
  })
})
