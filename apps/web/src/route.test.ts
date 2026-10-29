import { Option } from 'effect'
import { fromString } from 'foldkit/url'
import { describe, expect, test } from 'vitest'

import { locales } from './i18n/locale'
import {
  AppRoute,
  courseOf,
  courseUrl,
  homeUrl,
  lessonUrl,
  routeInLocale,
  urlForRoute,
  urlToAppRoute,
} from './route'

const parse = (path: string) =>
  urlToAppRoute(
    Option.getOrThrowWith(
      fromString(`http://localhost${path}`),
      () => new Error(`bad url ${path}`),
    ),
  )

describe('routes', () => {
  test.each(locales)('parse → print → parse is stable for %s', locale => {
    const routes = [
      AppRoute.Home({ locale }),
      AppRoute.Course({ locale, course: 'networks' }),
      AppRoute.Lesson({
        locale,
        course: 'system-design',
        slug: 'load-balancer',
        step: Option.none(),
      }),
      AppRoute.Lesson({
        locale,
        course: 'networks',
        slug: 'phone-online',
        step: Option.some(3),
      }),
      AppRoute.NotFound({ locale, path: `/${locale}/unknown/path/deep` }),
    ]

    routes.forEach(route => {
      expect(parse(urlForRoute(route))).toEqual(route)
    })
  })

  test('home and course map parse with and without the trailing slash', () => {
    expect(parse('/uk')).toEqual(AppRoute.Home({ locale: 'uk' }))
    expect(parse('/uk/')).toEqual(AppRoute.Home({ locale: 'uk' }))
    expect(parse('/uk/networks')).toEqual(
      AppRoute.Course({ locale: 'uk', course: 'networks' }),
    )
    expect(parse('/uk/networks/')).toEqual(
      AppRoute.Course({ locale: 'uk', course: 'networks' }),
    )
  })

  test('url helpers print the canonical addresses', () => {
    expect(homeUrl('lt')).toBe('/lt/')
    expect(courseUrl('lt', 'networks')).toBe('/lt/networks/')
    expect(
      lessonUrl({
        locale: 'ru',
        course: 'system-design',
        slug: 'caching',
        step: Option.some(2),
      }),
    ).toBe('/ru/system-design/lessons/caching?step=2')
  })

  test('an old lesson address is recognised and points into System Design with its step', () => {
    const route = parse('/ru/lessons/caching?step=2')

    expect(route).toEqual(
      AppRoute.LegacyLesson({
        locale: 'ru',
        slug: 'caching',
        step: Option.some(2),
      }),
    )
    expect(urlForRoute(route)).toBe('/ru/system-design/lessons/caching?step=2')
    expect(courseOf(route)).toEqual(Option.some('system-design'))
    expect(urlForRoute(parse('/en/lessons/load-balancer'))).toBe(
      '/en/system-design/lessons/load-balancer',
    )
  })

  test('paths without a language prefix are unlocalized', () => {
    expect(parse('/')).toEqual(AppRoute.Unlocalized({ path: '/' }))
    expect(parse('/lessons/load-balancer')).toEqual(
      AppRoute.Unlocalized({ path: '/lessons/load-balancer' }),
    )
    expect(parse('/de/lessons/x')).toEqual(
      AppRoute.Unlocalized({ path: '/de/lessons/x' }),
    )
  })

  test('unknown paths under a language are not found in that language', () => {
    expect(parse('/lt/unknown/path')).toEqual(
      AppRoute.NotFound({ locale: 'lt', path: '/lt/unknown/path' }),
    )
    expect(parse('/lt/networks/lessons')).toEqual(
      AppRoute.NotFound({ locale: 'lt', path: '/lt/networks/lessons' }),
    )
  })

  test('switching language keeps the page', () => {
    expect(
      urlForRoute(
        routeInLocale(
          AppRoute.Lesson({
            locale: 'ru',
            course: 'system-design',
            slug: 'load-balancer',
            step: Option.none(),
          }),
          'en',
        ),
      ),
    ).toBe('/en/system-design/lessons/load-balancer')
    expect(
      urlForRoute(
        routeInLocale(
          AppRoute.Course({ locale: 'ru', course: 'networks' }),
          'uk',
        ),
      ),
    ).toBe('/uk/networks/')
    expect(
      urlForRoute(
        routeInLocale(
          AppRoute.NotFound({ locale: 'lt', path: '/lt/unknown/path' }),
          'uk',
        ),
      ),
    ).toBe('/uk/unknown/path')
    expect(
      urlForRoute(routeInLocale(AppRoute.Home({ locale: 'uk' }), 'lt')),
    ).toBe('/lt/')
  })
})
