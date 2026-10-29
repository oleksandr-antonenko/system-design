import { Array, Option, pipe } from 'effect'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'

import { DomainMessage, renderDomainMessage } from './i18n/domainMessage'
import { type Locale, localeEndonym, locales } from './i18n/locale'
import { type UiStrings, uiFor } from './i18n/ui'
import * as Player from './lesson/view'
import { type Lesson, lessonTextFor } from './lessons/assemble'
import { moduleOrder } from './lessons/model'
import { findLesson, lessons } from './lessons/registry'
import { Message, type Model, currentSession } from './main'
import {
  AppRoute,
  homeUrl,
  lessonRouter,
  localeOf,
  routeInLocale,
  urlForRoute,
} from './route'

// HEADER

const languageLinkView = (
  route: AppRoute,
  locale: Locale,
  currentLocale: Locale,
  h: HtmlBuilder<Message>,
): Html =>
  h.a(
    [
      h.Href(urlForRoute(routeInLocale(route, locale))),
      h.Hreflang(locale),
      h.Lang(locale),
      ...(locale === currentLocale ? [h.AriaCurrent('true')] : []),
      h.Class(
        locale === currentLocale
          ? 'rounded-md bg-accent px-2 py-1 text-[12px] font-semibold text-page no-underline'
          : 'rounded-md px-2 py-1 text-[12px] text-muted no-underline hover:text-ink',
      ),
    ],
    [localeEndonym[locale]],
  )

const headerView = (
  route: AppRoute,
  locale: Locale,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): Html =>
  h.header(
    [
      h.Class(
        'flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-page px-4 py-2.5 sm:px-6',
      ),
    ],
    [
      h.a(
        [
          h.Href(homeUrl(locale)),
          h.Class('font-display text-[14px] text-ink no-underline'),
        ],
        [ui.courseTitle],
      ),
      h.nav(
        [h.AriaLabel(ui.languageSwitcherLabel), h.Class('ml-auto')],
        [
          h.ul(
            [h.Class('m-0 flex list-none flex-wrap gap-1 p-0')],
            Array.map(locales, candidate =>
              h.li([], [languageLinkView(route, candidate, locale, h)]),
            ),
          ),
        ],
      ),
    ],
  )

// HOME

const lessonCardView = (
  lesson: Lesson,
  locale: Locale,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): Html => {
  const { text } = lessonTextFor(lesson, locale)
  const number = h.div(
    [h.Class('text-[11px] uppercase tracking-[0.09em] text-muted')],
    [ui.home.lessonNumber(lesson.meta.order)],
  )
  const title = lesson.meta.available
    ? h.a(
        [
          h.Href(
            lessonRouter({
              locale,
              slug: lesson.meta.slug,
              step: Option.none(),
            }),
          ),
          h.Class('text-accent underline-offset-4 hover:underline'),
        ],
        [text.title],
      )
    : h.span([], [text.title])

  return h.keyed('li')(
    lesson.meta.slug,
    [
      h.Class(
        'grid gap-1 border-t border-line py-4 first:border-t-0 sm:grid-cols-[110px_1fr_auto] sm:gap-4',
      ),
    ],
    [
      number,
      h.div(
        [h.Class('min-w-0')],
        [
          h.h3(
            [h.Class('m-0 font-prose text-[18px] font-semibold leading-snug')],
            [title],
          ),
          h.p(
            [
              h.Class(
                'm-0 mt-1 font-prose text-[15px] leading-relaxed text-muted',
              ),
            ],
            [text.summary],
          ),
        ],
      ),
      lesson.meta.available
        ? h.empty
        : h.span(
            [
              h.Class(
                'self-start justify-self-start rounded-full border border-line px-2 py-0.5 text-[11px] text-muted',
              ),
            ],
            [ui.home.comingSoon],
          ),
    ],
  )
}

const homeView = (
  locale: Locale,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): Html =>
  h.main(
    [h.Class('mx-auto w-full max-w-3xl px-4 py-10 sm:px-6')],
    [
      h.p(
        [h.Class('m-0 text-[12px] uppercase tracking-[0.1em] text-muted')],
        [ui.home.lessonCount(lessons.length)],
      ),
      h.h1(
        [
          h.Class(
            'mt-2 mb-2 font-display text-[28px] font-medium leading-tight',
          ),
        ],
        [ui.home.heading],
      ),
      h.p(
        [
          h.Class(
            'm-0 mb-8 max-w-[62ch] font-prose text-[17px] leading-relaxed text-muted',
          ),
        ],
        [ui.courseTagline],
      ),
      ...Array.map(moduleOrder, module =>
        h.keyed('section')(
          module,
          [h.Class('mb-10')],
          [
            h.h2(
              [
                h.Class(
                  'mb-1 text-[12px] font-semibold uppercase tracking-[0.09em] text-accent',
                ),
              ],
              [ui.home.moduleTitle[module]],
            ),
            h.ol(
              [h.Class('m-0 list-none p-0')],
              pipe(
                lessons,
                Array.filter(lesson => lesson.meta.module === module),
                Array.map(lesson => lessonCardView(lesson, locale, ui, h)),
              ),
            ),
          ],
        ),
      ),
    ],
  )

// LESSON

const regionView = (
  name: string,
  placeholder: string,
  className: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [h.AriaLabel(name), h.Class(className)],
    [
      h.h2(
        [
          h.Class(
            'm-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted',
          ),
        ],
        [name],
      ),
      h.p(
        [h.Class('m-0 font-prose text-[15px] leading-relaxed text-muted')],
        [placeholder],
      ),
    ],
  )

const lessonView = (
  lesson: Lesson,
  locale: Locale,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): Html => {
  const choice = lessonTextFor(lesson, locale)

  return h.main(
    [
      h.Class(
        'grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(340px,38%)_minmax(0,1fr)]',
      ),
    ],
    [
      h.section(
        [
          h.AriaLabel(ui.lesson.theoryRegion),
          h.Class(
            'min-w-0 border-b border-line bg-page px-4 py-6 sm:px-7 lg:border-b-0 lg:border-r',
          ),
        ],
        [
          h.a(
            [
              h.Href(homeUrl(locale)),
              h.Class('text-[12px] text-accent no-underline hover:underline'),
            ],
            [`← ${ui.lesson.backToCourse}`],
          ),
          h.p(
            [
              h.Class(
                'm-0 mt-5 text-[11px] uppercase tracking-[0.1em] text-muted',
              ),
            ],
            [ui.home.lessonNumber(lesson.meta.order)],
          ),
          h.h1(
            [
              h.Lang(choice.shownIn),
              h.Class(
                'mt-2 mb-3 font-display text-[24px] font-medium leading-tight',
              ),
            ],
            [choice.text.title],
          ),
          choice.isFallback
            ? h.p(
                [
                  h.Role('note'),
                  h.Class(
                    'm-0 mb-4 rounded-lg border border-warn px-3 py-2 text-[12.5px]',
                  ),
                ],
                [
                  renderDomainMessage(
                    ui.domain,
                    DomainMessage.LessonNotTranslated({
                      shownIn: choice.shownIn,
                    }),
                  ),
                ],
              )
            : h.empty,
          h.h2(
            [
              h.Class(
                'm-0 mt-6 mb-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted',
              ),
            ],
            [ui.lesson.theoryRegion],
          ),
          h.p(
            [h.Class('m-0 font-prose text-[16px] leading-relaxed text-muted')],
            [ui.lesson.theoryPlaceholder],
          ),
        ],
      ),
      h.div(
        [h.Class('flex min-h-[60vh] min-w-0 flex-col')],
        [
          regionView(
            ui.lesson.boardRegion,
            ui.lesson.boardPlaceholder,
            'board-surface flex-1 px-4 py-6 sm:px-7',
            h,
          ),
          regionView(
            ui.lesson.instrumentsRegion,
            ui.lesson.instrumentsPlaceholder,
            'border-t border-line bg-page px-4 py-4 sm:px-7',
            h,
          ),
        ],
      ),
    ],
  )
}

// NOT FOUND

const notFoundView = (
  locale: Locale,
  ui: UiStrings,
  details: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.main(
    [h.Class('mx-auto w-full max-w-3xl px-4 py-16 sm:px-6')],
    [
      h.h1(
        [h.Class('m-0 mb-3 font-display text-[26px] font-medium')],
        [ui.notFound.title],
      ),
      h.p([h.Class('m-0 mb-6 font-prose text-[17px] text-muted')], [details]),
      h.a(
        [
          h.Href(homeUrl(locale)),
          h.Class('text-accent underline-offset-4 hover:underline'),
        ],
        [ui.notFound.backHome],
      ),
    ],
  )

// DOCUMENT

const pageTitle = (route: AppRoute, locale: Locale, ui: UiStrings): string =>
  AppRoute.match(route, {
    Home: () => ui.home.heading,
    Lesson: ({ slug }) =>
      Option.match(findLesson(slug), {
        onNone: () => ui.notFound.title,
        onSome: lesson => lessonTextFor(lesson, locale).text.title,
      }),
    NotFound: () => ui.notFound.title,
    Unlocalized: () => ui.courseTitle,
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const locale = Option.getOrElse(
    localeOf(model.route),
    () => model.preferredLocale,
  )
  const ui = uiFor(locale)

  const content = AppRoute.match(model.route, {
    Home: () => homeView(locale, ui, h),
    Lesson: ({ slug }) =>
      Option.match(findLesson(slug), {
        onNone: () =>
          notFoundView(
            locale,
            ui,
            renderDomainMessage(
              ui.domain,
              DomainMessage.UnknownLesson({ slug }),
            ),
            h,
          ),
        onSome: lesson =>
          Option.match(currentSession(model), {
            onNone: () => lessonView(lesson, locale, ui, h),
            onSome: session =>
              h.submodel({
                slotId: 'lesson-player',
                model: session,
                view: Player.view,
                toParentMessage: message =>
                  Message.GotPlayerMessage({ message }),
                viewInputs: { locale, prefersDark: model.prefersDark },
              }),
          }),
      }),
    NotFound: ({ path }) => notFoundView(locale, ui, ui.notFound.body(path), h),
    Unlocalized: () => h.main([]),
  })

  return {
    title: ui.documentTitle(pageTitle(model.route, locale, ui)),
    lang: locale,
    body: h.div(
      [
        h.Class(
          Option.isSome(currentSession(model))
            ? 'app-lesson flex flex-col bg-bg text-ink'
            : 'flex min-h-screen flex-col bg-bg text-ink',
        ),
      ],
      [headerView(model.route, locale, ui, h), content],
    ),
  }
}
