import { Array, Option, Schema, String, pipe } from 'effect'
import { Route } from 'foldkit'
import {
  defineRouteUnion,
  literal,
  schemaSegment,
  slash,
  string,
} from 'foldkit/route'
import type { Url } from 'foldkit/url'

import { Locale, isLocale } from './i18n/locale'

export const AppRoute = defineRouteUnion({
  Home: { locale: Locale },
  Lesson: { locale: Locale, slug: Schema.String },
  NotFound: { locale: Locale, path: Schema.String },
  Unlocalized: { path: Schema.String },
})
export type AppRoute = typeof AppRoute.Type

const localeSegment = schemaSegment('locale', Locale)

export const homeRouter = pipe(localeSegment, Route.mapTo(AppRoute.Home))

export const lessonRouter = pipe(
  localeSegment,
  slash(literal('lessons')),
  slash(string('slug')),
  Route.mapTo(AppRoute.Lesson),
)

const parseKnownRoute = Route.parseUrlWithFallback(
  Route.oneOf(lessonRouter, homeRouter),
  AppRoute.Unlocalized,
)

const pathSegments = (path: string): ReadonlyArray<string> =>
  Array.filter(String.split(path, '/'), String.isNonEmpty)

const localeOfPath = (path: string): Option.Option<Locale> =>
  pipe(pathSegments(path), Array.head, Option.filter(isLocale))

const classifyUnmatched = (path: string): AppRoute =>
  Option.match(localeOfPath(path), {
    onNone: () => AppRoute.Unlocalized({ path }),
    onSome: locale => AppRoute.NotFound({ locale, path }),
  })

export const urlToAppRoute = (url: Url): AppRoute => {
  const route = parseKnownRoute(url)

  return AppRoute.match(route, {
    Unlocalized: ({ path }) => classifyUnmatched(path),
    Home: () => route,
    Lesson: () => route,
    NotFound: () => route,
  })
}

export const localeOf = (route: AppRoute): Option.Option<Locale> =>
  AppRoute.match(route, {
    Home: ({ locale }) => Option.some(locale),
    Lesson: ({ locale }) => Option.some(locale),
    NotFound: ({ locale }) => Option.some(locale),
    Unlocalized: () => Option.none(),
  })

export const homeUrl = (locale: Locale): string => `${homeRouter({ locale })}/`

const withoutLocale = (path: string): string =>
  pipe(pathSegments(path), Array.drop(1), segments => `/${segments.join('/')}`)

export const localizedPath = (locale: Locale, path: string): string =>
  path === '/' ? homeUrl(locale) : `/${locale}${path}`

export const urlForRoute = (route: AppRoute): string =>
  AppRoute.match(route, {
    Home: ({ locale }) => homeUrl(locale),
    Lesson: ({ locale, slug }) => lessonRouter({ locale, slug }),
    NotFound: ({ path }) => path,
    Unlocalized: ({ path }) => path,
  })

export const routeInLocale = (route: AppRoute, locale: Locale): AppRoute =>
  AppRoute.match(route, {
    Home: () => AppRoute.Home({ locale }),
    Lesson: ({ slug }) => AppRoute.Lesson({ locale, slug }),
    NotFound: ({ path }) =>
      AppRoute.NotFound({
        locale,
        path: localizedPath(locale, withoutLocale(path)),
      }),
    Unlocalized: ({ path }) =>
      AppRoute.NotFound({ locale, path: localizedPath(locale, path) }),
  })
