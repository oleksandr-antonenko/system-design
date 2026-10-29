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

/** Курс, к которому ведут старые адреса `/:locale/lessons/:slug`. */
export const LEGACY_COURSE = 'system-design'

const Step = Schema.Option(Schema.Number)

export const AppRoute = defineRouteUnion({
  Home: { locale: Locale },
  Course: { locale: Locale, course: Schema.String },
  Lesson: {
    locale: Locale,
    course: Schema.String,
    slug: Schema.String,
    step: Step,
  },
  LegacyLesson: { locale: Locale, slug: Schema.String, step: Step },
  NotFound: { locale: Locale, path: Schema.String },
  Unlocalized: { path: Schema.String },
})
export type AppRoute = typeof AppRoute.Type

const localeSegment = schemaSegment('locale', Locale)

const stepQuery = Route.query(
  Schema.Struct({ step: Schema.OptionFromOptional(Schema.NumberFromString) }),
)

export const homeRouter = pipe(localeSegment, Route.mapTo(AppRoute.Home))

export const courseRouter = pipe(
  localeSegment,
  slash(string('course')),
  Route.mapTo(AppRoute.Course),
)

export const lessonRouter = pipe(
  localeSegment,
  slash(string('course')),
  slash(literal('lessons')),
  slash(string('slug')),
  stepQuery,
  Route.mapTo(AppRoute.Lesson),
)

const legacyLessonRouter = pipe(
  localeSegment,
  slash(literal('lessons')),
  slash(string('slug')),
  stepQuery,
  Route.mapTo(AppRoute.LegacyLesson),
)

const parseKnownRoute = Route.parseUrlWithFallback(
  Route.oneOf(lessonRouter, legacyLessonRouter, courseRouter, homeRouter),
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
    Course: () => route,
    Lesson: () => route,
    LegacyLesson: () => route,
    NotFound: () => route,
  })
}

export const localeOf = (route: AppRoute): Option.Option<Locale> =>
  AppRoute.match(route, {
    Home: ({ locale }) => Option.some(locale),
    Course: ({ locale }) => Option.some(locale),
    Lesson: ({ locale }) => Option.some(locale),
    LegacyLesson: ({ locale }) => Option.some(locale),
    NotFound: ({ locale }) => Option.some(locale),
    Unlocalized: () => Option.none(),
  })

/** Курс страницы: карта курса и его уроки. */
export const courseOf = (route: AppRoute): Option.Option<string> =>
  AppRoute.match(route, {
    Course: ({ course }) => Option.some(course),
    Lesson: ({ course }) => Option.some(course),
    LegacyLesson: () => Option.some(LEGACY_COURSE),
    Home: () => Option.none(),
    NotFound: () => Option.none(),
    Unlocalized: () => Option.none(),
  })

// URLS

/** `/uk/` — каталог курсов. */
export const homeUrl = (locale: Locale): string => `${homeRouter({ locale })}/`

/** `/uk/networks/` — карта курса. */
export const courseUrl = (locale: Locale, course: string): string =>
  `${courseRouter({ locale, course })}/`

/** `/uk/networks/lessons/phone-online?step=2` — урок, шаг с 1. */
export const lessonUrl = (
  lesson: Readonly<{
    locale: Locale
    course: string
    slug: string
    step: Option.Option<number>
  }>,
): string => lessonRouter(lesson)

const withoutLocale = (path: string): string =>
  pipe(pathSegments(path), Array.drop(1), segments => `/${segments.join('/')}`)

export const localizedPath = (locale: Locale, path: string): string =>
  path === '/' ? homeUrl(locale) : `/${locale}${path}`

export const urlForRoute = (route: AppRoute): string =>
  AppRoute.match(route, {
    Home: ({ locale }) => homeUrl(locale),
    Course: ({ locale, course }) => courseUrl(locale, course),
    Lesson: ({ locale, course, slug, step }) =>
      lessonUrl({ locale, course, slug, step }),
    LegacyLesson: ({ locale, slug, step }) =>
      lessonUrl({ locale, course: LEGACY_COURSE, slug, step }),
    NotFound: ({ path }) => path,
    Unlocalized: ({ path }) => path,
  })

export const routeInLocale = (route: AppRoute, locale: Locale): AppRoute =>
  AppRoute.match(route, {
    Home: () => AppRoute.Home({ locale }),
    Course: ({ course }) => AppRoute.Course({ locale, course }),
    Lesson: ({ course, slug, step }) =>
      AppRoute.Lesson({ locale, course, slug, step }),
    LegacyLesson: ({ slug, step }) =>
      AppRoute.Lesson({ locale, course: LEGACY_COURSE, slug, step }),
    NotFound: ({ path }) =>
      AppRoute.NotFound({
        locale,
        path: localizedPath(locale, withoutLocale(path)),
      }),
    Unlocalized: ({ path }) =>
      AppRoute.NotFound({ locale, path: localizedPath(locale, path) }),
  })
