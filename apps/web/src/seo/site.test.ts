import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import template from '../../index.html?raw'
import { courses } from '../courses/registry'
import { locales } from '../i18n/locale'
import {
  type SiteFile,
  pageFile,
  renderPage,
  renderSite,
  sitePages,
  siteUrlOf,
} from './site'

// Страницы для поисковиков, которые пишет сборка (build/prerender.ts).

const SITE = 'https://courses.example.org'

const builtAsset = (sourceUrl: string): string =>
  `/assets/${sourceUrl.split('/').slice(-3).join('-')}`

const files = renderSite({ siteUrl: SITE, template, assetUrl: builtAsset })

const fileNamed = (name: string): string =>
  Option.match(
    Array.findFirst(files, (file: SiteFile) => file.file === name),
    {
      onNone: () => '',
      onSome: file => file.content,
    },
  )

const pages = sitePages({ courses, siteUrl: SITE, assetUrl: builtAsset })

const lessonCount = Array.reduce(
  courses,
  0,
  (sum, course) =>
    sum +
    Array.reduce(
      Array.filter(course.lessons, lesson => lesson.meta.available),
      0,
      (count, lesson) => count + lesson.meta.locales.length,
    ),
)
const courseCount = Array.reduce(
  courses,
  0,
  (sum, course) => sum + course.definition.locales.length,
)

describe('prerendered pages', () => {
  test('a lesson page has its own head, alternates and noscript text', () => {
    const html = fileNamed('ru/system-design/lessons/load-balancer/index.html')
    const lesson = `${SITE}/ru/system-design/lessons/load-balancer`
    const image = `${SITE}/assets/lessons-03-load-balancer-preview.webp`

    expect(html).toContain('<html lang="ru">')
    expect(html).toContain(
      '<title>Load balancer. Нагрузка делится поровну · System Design</title>',
    )
    expect(html).toContain(
      '<meta name="description" content="Горизонтальное масштабирование (horizontal scaling): load balancer как единый вход в систему, health check и правило N+1." />',
    )
    expect(html).not.toContain('Interactive System Design course')
    expect(html).toContain(`<link rel="canonical" href="${lesson}" />`)
    expect(html).toContain(
      `<link rel="alternate" hreflang="x-default" href="${SITE}/en/system-design/lessons/load-balancer" />`,
    )
    expect(html).toContain('<meta property="og:type" content="article" />')
    expect(html).toContain('<meta property="og:locale" content="ru_RU" />')
    expect(html).toContain(`<meta property="og:url" content="${lesson}" />`)
    expect(html).toContain(`<meta property="og:image" content="${image}" />`)
    expect(html).toContain('<meta property="og:image:width" content="1200" />')
    expect(html).toContain('<meta property="og:image:height" content="630" />')
    expect(html).toContain(
      '<meta name="twitter:card" content="summary_large_image" />',
    )
    expect(html).toContain(
      `<noscript>\n<main>\n<h1>Load balancer. Нагрузка делится поровну</h1>`,
    )
    expect(html).toMatch(
      new RegExp(
        `<img src="${image}" alt="Схема: load balancer [^"]+" width="1200" height="630" />`,
      ),
    )
    expect(html).toContain('<div id="root"></div>')
    expect(html).toMatch(/<script type="module"[^>]*src="[^"]+entry\.ts"/)
  })

  test('every catalogue, course and lesson address gets a page', () => {
    expect(pages).toHaveLength(locales.length + courseCount + lessonCount)
    expect(Array.dedupe(Array.map(pages, pageFile))).toHaveLength(pages.length)
    expect(Array.map(Array.take(pages, 4), pageFile)).toEqual([
      'uk/index.html',
      'ru/index.html',
      'en/index.html',
      'lt/index.html',
    ])
    expect(fileNamed('en/networks/index.html')).toContain(
      '<a href="/en/networks/lessons/phone-online">',
    )
  })

  test('hreflang alternates name every language of the page and x-default', () => {
    const urls = new Set(Array.map(pages, page => `${SITE}${page.path}`))
    Array.forEach(pages, page => {
      const languages = Array.map(page.alternates, ({ hreflang }) => hreflang)
      expect(languages.at(-1), page.path).toBe('x-default')
      expect(languages, page.path).toContain(page.locale)
      expect(Array.dedupe(languages), page.path).toHaveLength(languages.length)
      Array.forEach(
        Array.filter(
          page.alternates,
          ({ hreflang }) => hreflang !== 'x-default',
        ),
        ({ hreflang, href }) => {
          expect(urls.has(href), `${page.path} → ${href}`).toBe(true)
          expect(
            Array.some(
              pages,
              other =>
                `${SITE}${other.path}` === href &&
                other.locale === hreflang &&
                Array.some(
                  other.alternates,
                  back => back.href === `${SITE}${page.path}`,
                ),
            ),
            `${href} links back to ${page.path}`,
          ).toBe(true)
        },
      )
    })
  })

  test('the sitemap lists every page with its alternates and lesson images', () => {
    const sitemap = fileNamed('sitemap.xml')
    const entries = sitemap.split('<url>').slice(1)

    expect(sitemap).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/)
    expect(entries).toHaveLength(pages.length)
    const entry = Option.getOrElse(
      Array.findFirst(entries, candidate =>
        candidate.includes(
          `<loc>${SITE}/en/system-design/lessons/load-balancer</loc>`,
        ),
      ),
      () => '',
    )
    expect(
      Array.map(locales, locale => entry.includes(`hreflang="${locale}"`)),
    ).toEqual([true, true, true, true])
    expect(entry).toContain(
      `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/en/system-design/lessons/load-balancer" />`,
    )
    expect(entry).toContain(
      `<image:image><image:loc>${SITE}/assets/lessons-03-load-balancer-preview.webp</image:loc></image:image>`,
    )
    expect(fileNamed('robots.txt')).toContain(`Sitemap: ${SITE}/sitemap.xml`)
  })

  test('texts are escaped and the template must have its anchors', () => {
    const page = {
      ...pages[0]!,
      title: 'A "quoted" <title> & more',
    }
    expect(renderPage(template, SITE, page)).toContain(
      '<title>A &quot;quoted&quot; &lt;title&gt; &amp; more</title>',
    )
    expect(() =>
      renderPage('<html lang="en"><head></head></html>', SITE, page),
    ).toThrow(/<title>/)
  })

  test('the site address comes from SITE_URL without a trailing slash', () => {
    expect(siteUrlOf('https://courses.example.org/')).toBe(SITE)
    expect(siteUrlOf('https://example.org/courses/')).toBe(
      'https://example.org/courses',
    )
    expect(siteUrlOf(undefined)).toBe('http://localhost:4173')
    expect(siteUrlOf(' ')).toBe('http://localhost:4173')
  })
})
