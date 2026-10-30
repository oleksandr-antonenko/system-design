import { Array, Option, pipe } from 'effect'

import {
  type Course,
  type Lesson,
  courseTextFor,
  lessonTextFor,
} from '../courses/assemble'
import {
  type LessonPreview,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  previewOf,
} from '../courses/previews'
import { courses as registeredCourses } from '../courses/registry'
import { DEFAULT_LOCALE, type Locale, locales } from '../i18n/locale'
import { uiFor } from '../i18n/ui'
import { pageTitle } from '../pageTitle'
import { AppRoute, courseUrl, homeUrl, lessonUrl } from '../route'

// Страницы для поисковиков.
// Приложение рисуется в браузере, поэтому сборка (build/prerender.ts) пишет
// для каждого адреса каталога, курса и урока свой index.html: заголовок,
// описание, canonical, hreflang, Open Graph и <noscript> с текстом страницы.
// Здесь только чистые функции; файлы пишет плагин сборки.

/** Адрес сайта без `/` в конце: `https://example.org`. */
export type SiteUrl = string

/** Переводит адрес картинки из исходников в адрес в сборке. */
export type AssetUrl = (sourceUrl: string) => string

export type Alternate = Readonly<{ hreflang: string; href: string }>

export type PageImage = Readonly<{
  url: string
  alt: string
  width: number
  height: number
}>

export type PageLink = Readonly<{ href: string; text: string; note: string }>

export type SitePage = Readonly<{
  /** Путь адреса страницы: `/en/system-design/lessons/load-balancer`. */
  path: string
  locale: Locale
  type: 'website' | 'article'
  title: string
  heading: string
  description: string
  alternates: ReadonlyArray<Alternate>
  maybeImage: Option.Option<PageImage>
  links: ReadonlyArray<PageLink>
}>

export type SiteFile = Readonly<{ file: string; content: string }>

export const DEFAULT_SITE_URL: SiteUrl = 'http://localhost:4173'

/** Адрес сайта из переменной сборки `SITE_URL`: без `/` в конце. */
export const siteUrlOf = (value: string | undefined): SiteUrl => {
  const raw =
    value === undefined || value.trim() === '' ? DEFAULT_SITE_URL : value
  const url = new URL(raw.trim())
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
}

const OG_LOCALE: Readonly<Record<Locale, string>> = {
  uk: 'uk_UA',
  ru: 'ru_RU',
  en: 'en_US',
  lt: 'lt_LT',
}

// PAGES

type PageInput = Readonly<{
  courses: ReadonlyArray<Course>
  siteUrl: SiteUrl
  assetUrl: AssetUrl
}>

const absolute = (siteUrl: SiteUrl, path: string): string =>
  /^https?:\/\//.test(path) ? path : `${siteUrl}${path}`

const alternatesFor = (
  siteUrl: SiteUrl,
  pageLocales: ReadonlyArray<Locale>,
  pathIn: (locale: Locale) => string,
  xDefault: string,
): ReadonlyArray<Alternate> => [
  ...Array.map(pageLocales, locale => ({
    hreflang: locale,
    href: absolute(siteUrl, pathIn(locale)),
  })),
  { hreflang: 'x-default', href: absolute(siteUrl, xDefault) },
]

const defaultLocaleOf = (pageLocales: ReadonlyArray<Locale>): Locale =>
  Array.contains(pageLocales, DEFAULT_LOCALE)
    ? DEFAULT_LOCALE
    : Option.getOrElse(Array.head(pageLocales), () => DEFAULT_LOCALE)

const imageOf = (
  { siteUrl, assetUrl }: PageInput,
  preview: LessonPreview,
  alt: string,
): PageImage => ({
  url: absolute(siteUrl, assetUrl(preview.src)),
  alt,
  width: PREVIEW_WIDTH,
  height: PREVIEW_HEIGHT,
})

const lessonPath = (lesson: Lesson, locale: Locale): string =>
  lessonUrl({
    locale,
    course: lesson.course,
    slug: lesson.meta.slug,
    step: Option.none(),
  })

const lessonImage = (
  input: PageInput,
  lesson: Lesson,
  locale: Locale,
): Option.Option<PageImage> =>
  Option.map(previewOf(lesson), preview =>
    imageOf(input, preview, lessonTextFor(lesson, locale).text.preview.alt),
  )

const availableLessons = (course: Course): ReadonlyArray<Lesson> =>
  Array.filter(course.lessons, lesson => lesson.meta.available)

/** Картинка курса и каталога: картинка первого урока, у которого она есть. */
const firstImage = (
  input: PageInput,
  lessons: ReadonlyArray<Lesson>,
  locale: Locale,
): Option.Option<PageImage> =>
  Array.findFirst(lessons, lesson => lessonImage(input, lesson, locale))

const lessonPages = (
  input: PageInput,
  course: Course,
): ReadonlyArray<SitePage> =>
  Array.flatMap(availableLessons(course), lesson =>
    Array.map(lesson.meta.locales, (locale): SitePage => {
      const { text } = lessonTextFor(lesson, locale)
      const courseText = courseTextFor(course, locale).text
      return {
        path: lessonPath(lesson, locale),
        locale,
        type: 'article',
        title: pageTitle(
          AppRoute.Lesson({
            locale,
            course: lesson.course,
            slug: lesson.meta.slug,
            step: Option.none(),
          }),
          locale,
          uiFor(locale),
        ),
        heading: text.title,
        description: text.summary,
        alternates: alternatesFor(
          input.siteUrl,
          lesson.meta.locales,
          candidate => lessonPath(lesson, candidate),
          lessonPath(lesson, defaultLocaleOf(lesson.meta.locales)),
        ),
        maybeImage: lessonImage(input, lesson, locale),
        links: [
          {
            href: courseUrl(locale, course.definition.id),
            text: courseText.title,
            note: courseText.tagline,
          },
        ],
      }
    }),
  )

const coursePages = (
  input: PageInput,
  course: Course,
): ReadonlyArray<SitePage> =>
  Array.map(course.definition.locales, (locale): SitePage => {
    const { text } = courseTextFor(course, locale)
    const id = course.definition.id
    return {
      path: courseUrl(locale, id),
      locale,
      type: 'website',
      title: pageTitle(
        AppRoute.Course({ locale, course: id }),
        locale,
        uiFor(locale),
      ),
      heading: text.title,
      description: text.tagline,
      alternates: alternatesFor(
        input.siteUrl,
        course.definition.locales,
        candidate => courseUrl(candidate, id),
        courseUrl(defaultLocaleOf(course.definition.locales), id),
      ),
      maybeImage: firstImage(input, availableLessons(course), locale),
      links: Array.map(availableLessons(course), lesson => {
        const lessonText = lessonTextFor(lesson, locale).text
        return {
          href: lessonPath(lesson, locale),
          text: lessonText.title,
          note: lessonText.summary,
        }
      }),
    }
  })

const catalogPages = (input: PageInput): ReadonlyArray<SitePage> =>
  Array.map(locales, (locale): SitePage => {
    const ui = uiFor(locale)
    return {
      path: homeUrl(locale),
      locale,
      type: 'website',
      title: pageTitle(AppRoute.Home({ locale }), locale, ui),
      heading: ui.siteTitle,
      description: ui.siteTagline,
      alternates: alternatesFor(input.siteUrl, locales, homeUrl, '/'),
      maybeImage: firstImage(
        input,
        Array.flatMap(input.courses, availableLessons),
        locale,
      ),
      links: Array.map(input.courses, course => {
        const courseText = courseTextFor(course, locale).text
        return {
          href: courseUrl(locale, course.definition.id),
          text: courseText.title,
          note: courseText.tagline,
        }
      }),
    }
  })

/** Все страницы сайта: каталог, карты курсов и доступные уроки на каждом
    языке, на котором они написаны. */
export const sitePages = (input: PageInput): ReadonlyArray<SitePage> => [
  ...catalogPages(input),
  ...Array.flatMap(input.courses, course => [
    ...coursePages(input, course),
    ...lessonPages(input, course),
  ]),
]

// HTML

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

/** Файл страницы в сборке: `en/system-design/lessons/load-balancer/index.html`. */
export const pageFile = (page: SitePage): string =>
  `${page.path.replace(/^\/+/, '').replace(/\/?$/, '/')}index.html`

const meta = (attribute: 'name' | 'property', key: string, value: string) =>
  `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`

const headTags = (siteUrl: SiteUrl, page: SitePage): ReadonlyArray<string> => [
  `<link rel="canonical" href="${escapeHtml(absolute(siteUrl, page.path))}" />`,
  ...Array.map(
    page.alternates,
    ({ hreflang, href }) =>
      `<link rel="alternate" hreflang="${hreflang}" href="${escapeHtml(href)}" />`,
  ),
  meta('property', 'og:type', page.type),
  meta('property', 'og:site_name', uiFor(page.locale).siteTitle),
  meta('property', 'og:title', page.title),
  meta('property', 'og:description', page.description),
  meta('property', 'og:url', absolute(siteUrl, page.path)),
  meta('property', 'og:locale', OG_LOCALE[page.locale]),
  ...pipe(
    locales,
    Array.filter(
      locale =>
        locale !== page.locale &&
        Array.some(page.alternates, ({ hreflang }) => hreflang === locale),
    ),
    Array.map(locale =>
      meta('property', 'og:locale:alternate', OG_LOCALE[locale]),
    ),
  ),
  ...Option.match(page.maybeImage, {
    onNone: () => [],
    onSome: image => [
      meta('property', 'og:image', image.url),
      meta('property', 'og:image:type', 'image/webp'),
      meta('property', 'og:image:width', `${image.width}`),
      meta('property', 'og:image:height', `${image.height}`),
      meta('property', 'og:image:alt', image.alt),
    ],
  }),
  meta('name', 'twitter:card', 'summary_large_image'),
  ...Option.match(page.maybeImage, {
    onNone: () => [],
    onSome: image => [meta('name', 'twitter:image:alt', image.alt)],
  }),
]

const noscriptBody = (page: SitePage): string =>
  [
    '<noscript>',
    '<main>',
    `<h1>${escapeHtml(page.heading)}</h1>`,
    `<p>${escapeHtml(page.description)}</p>`,
    ...Option.match(page.maybeImage, {
      onNone: () => [],
      onSome: image => [
        `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}" />`,
      ],
    }),
    ...Array.match(page.links, {
      onEmpty: () => [],
      onNonEmpty: links => [
        '<ul>',
        ...Array.map(
          links,
          link =>
            `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.text)}</a> — ${escapeHtml(link.note)}</li>`,
        ),
        '</ul>',
      ],
    }),
    '</main>',
    '</noscript>',
  ].join('\n')

const replaceOnce = (
  html: string,
  pattern: RegExp,
  replacement: string,
  what: string,
): string => {
  if (!pattern.test(html)) {
    throw new Error(`prerender: the page template has no ${what}`)
  }
  return html.replace(pattern, () => replacement)
}

/** Страница из шаблона `index.html` сборки: язык, заголовок, описание,
    теги для поисковиков и соцсетей, текст страницы в <noscript>. */
export const renderPage = (
  template: string,
  siteUrl: SiteUrl,
  page: SitePage,
): string =>
  [
    (html: string) =>
      replaceOnce(
        html,
        /<html lang="[^"]*"/,
        `<html lang="${page.locale}"`,
        '<html lang>',
      ),
    (html: string) =>
      replaceOnce(
        html,
        /<title>[^<]*<\/title>/,
        `<title>${escapeHtml(page.title)}</title>`,
        '<title>',
      ),
    (html: string) =>
      replaceOnce(
        html,
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
        meta('name', 'description', page.description),
        'meta description',
      ),
    (html: string) =>
      replaceOnce(
        html,
        /\n?[ \t]*<\/head>/,
        `\n${headTags(siteUrl, page)
          .map(tag => `    ${tag}`)
          .join('\n')}\n  </head>`,
        '</head>',
      ),
    (html: string) =>
      replaceOnce(
        html,
        /<div id="root"><\/div>/,
        `<div id="root"></div>\n${noscriptBody(page)}`,
        '<div id="root">',
      ),
  ].reduce((html, step) => step(html), template)

// SITEMAP

export const renderSitemap = (
  siteUrl: SiteUrl,
  pages: ReadonlyArray<SitePage>,
): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...Array.map(pages, page =>
      [
        '  <url>',
        `    <loc>${escapeHtml(absolute(siteUrl, page.path))}</loc>`,
        ...Array.map(
          page.alternates,
          ({ hreflang, href }) =>
            `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeHtml(href)}" />`,
        ),
        ...(page.type === 'article'
          ? Option.match(page.maybeImage, {
              onNone: () => [],
              onSome: image => [
                `    <image:image><image:loc>${escapeHtml(image.url)}</image:loc></image:image>`,
              ],
            })
          : []),
        '  </url>',
      ].join('\n'),
    ),
    '</urlset>',
    '',
  ].join('\n')

export const renderRobots = (siteUrl: SiteUrl): string =>
  ['User-agent: *', 'Allow: /', '', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join(
    '\n',
  )

// SITE

/** Все файлы для поисковиков: страницы, sitemap.xml и robots.txt. */
export const renderSite = (
  options: Readonly<{
    siteUrl: SiteUrl
    template: string
    assetUrl: AssetUrl
    courses?: ReadonlyArray<Course>
  }>,
): ReadonlyArray<SiteFile> => {
  const pages = sitePages({
    courses: options.courses ?? registeredCourses,
    siteUrl: options.siteUrl,
    assetUrl: options.assetUrl,
  })
  return [
    ...Array.map(pages, page => ({
      file: pageFile(page),
      content: renderPage(options.template, options.siteUrl, page),
    })),
    { file: 'sitemap.xml', content: renderSitemap(options.siteUrl, pages) },
    { file: 'robots.txt', content: renderRobots(options.siteUrl) },
  ]
}
