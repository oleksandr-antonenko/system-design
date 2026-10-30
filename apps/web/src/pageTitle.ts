import { Option } from 'effect'

import { courseTextFor, lessonTextFor } from './courses/assemble'
import { findCourse, findLesson } from './courses/registry'
import type { Locale } from './i18n/locale'
import type { UiStrings } from './i18n/ui'
import { AppRoute } from './route'

// Заголовок вкладки: его ставит приложение и пишет в <title> пререндер
// страниц (seo/site.ts), поэтому оба берут его отсюда.

const titled = (page: string, context: string): string => `${page} · ${context}`

const courseTitleIn = (course: string, locale: Locale): Option.Option<string> =>
  Option.map(
    findCourse(course),
    found => courseTextFor(found, locale).text.title,
  )

export const pageTitle = (
  route: AppRoute,
  locale: Locale,
  ui: UiStrings,
): string =>
  AppRoute.match(route, {
    Home: () => ui.siteTitle,
    Course: ({ course }) =>
      Option.match(courseTitleIn(course, locale), {
        onNone: () => titled(ui.notFound.title, ui.siteTitle),
        onSome: title => titled(ui.home.heading, title),
      }),
    Lesson: ({ course, slug }) =>
      Option.match(
        Option.all([findLesson(course, slug), courseTitleIn(course, locale)]),
        {
          onNone: () => titled(ui.notFound.title, ui.siteTitle),
          onSome: ([lesson, title]) =>
            titled(lessonTextFor(lesson, locale).text.title, title),
        },
      ),
    LegacyLesson: () => ui.siteTitle,
    NotFound: () => titled(ui.notFound.title, ui.siteTitle),
    Unlocalized: () => ui.siteTitle,
  })
