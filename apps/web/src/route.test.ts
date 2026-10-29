import { Option } from 'effect'
import { fromString } from 'foldkit/url'
import { describe, expect, test } from 'vitest'

import { locales } from './i18n/locale'
import { AppRoute, routeInLocale, urlForRoute, urlToAppRoute } from './route'

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
      AppRoute.Lesson({ locale, slug: 'load-balancer', step: Option.none() }),
      AppRoute.NotFound({ locale, path: `/${locale}/unknown/path` }),
    ]

    routes.forEach(route => {
      expect(parse(urlForRoute(route))).toEqual(route)
    })
  })

  test('home parses with and without the trailing slash', () => {
    expect(parse('/uk')).toEqual(AppRoute.Home({ locale: 'uk' }))
    expect(parse('/uk/')).toEqual(AppRoute.Home({ locale: 'uk' }))
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
  })

  test('switching language keeps the page', () => {
    expect(
      urlForRoute(
        routeInLocale(
          AppRoute.Lesson({
            locale: 'ru',
            slug: 'load-balancer',
            step: Option.none(),
          }),
          'en',
        ),
      ),
    ).toBe('/en/lessons/load-balancer')
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
