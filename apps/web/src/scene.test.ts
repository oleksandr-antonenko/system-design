import { Option } from 'effect'
import {
  all,
  expect,
  expectAll,
  given,
  label,
  role,
  scene,
  text,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import type { Locale } from './i18n/locale'
import { AppRoute, Model, update } from './main'
import { view } from './view'

const at = (route: AppRoute, locale: Locale) =>
  Model.make({
    route,
    preferredLocale: locale,
    maybeSavedLocale: Option.some(locale),
  })

describe('header', () => {
  test('the language switcher keeps the current lesson', () => {
    scene(
      { update, view },
      given(at(AppRoute.Lesson({ locale: 'ru', slug: 'load-balancer' }), 'ru')),
      expect(role('link', { name: 'English' })).toHaveAttr(
        'href',
        '/en/lessons/load-balancer',
      ),
      expect(role('link', { name: 'Lietuvių' })).toHaveAttr('hreflang', 'lt'),
      expect(role('link', { name: 'Русский' })).toHaveAttr(
        'aria-current',
        'true',
      ),
    )
  })

  test('after switching, the lesson is shown in English', () => {
    scene(
      { update, view },
      given(at(AppRoute.Lesson({ locale: 'en', slug: 'load-balancer' }), 'en')),
      expect(role('heading', { name: 'Load balancer' })).toExist(),
      expect(role('link', { name: 'System Design' })).toHaveAttr(
        'href',
        '/en/',
      ),
    )
  })
})

describe('home', () => {
  test('lists all 13 lessons; only available ones are links', () => {
    scene(
      { update, view },
      given(at(AppRoute.Home({ locale: 'uk' }), 'uk')),
      expect(role('heading', { name: 'Програма курсу' })).toExist(),
      expect(text('13 уроків')).toExist(),
      expectAll(all.role('listitem')).toHaveCount(17),
      expectAll(all.selector('main a')).toHaveCount(1),
      expect(role('link', { name: 'Балансувальник навантаження' })).toHaveAttr(
        'href',
        '/uk/lessons/load-balancer',
      ),
      expect(text('Один сервер')).toExist(),
      expect(role('link', { name: 'Один сервер' })).toBeAbsent(),
    )
  })
})

describe('lesson page', () => {
  test('has theory, board and instruments regions', () => {
    scene(
      { update, view },
      given(at(AppRoute.Lesson({ locale: 'uk', slug: 'load-balancer' }), 'uk')),
      expect(label('Теорія')).toExist(),
      expect(label('Дошка')).toExist(),
      expect(label('Прилади')).toExist(),
    )
  })

  test('an unknown lesson shows the not-found page', () => {
    scene(
      { update, view },
      given(
        at(AppRoute.Lesson({ locale: 'en', slug: 'no-such-lesson' }), 'en'),
      ),
      expect(role('heading', { name: 'Page not found' })).toExist(),
      expect(
        text('There is no lesson “no-such-lesson” in the course.'),
      ).toExist(),
    )
  })
})

describe('not found', () => {
  test('is shown in the route language with a link home', () => {
    scene(
      { update, view },
      given(
        at(AppRoute.NotFound({ locale: 'lt', path: '/lt/unknown/path' }), 'lt'),
      ),
      expect(role('heading', { name: 'Puslapis nerastas' })).toExist(),
      expect(role('link', { name: 'Atgal į kurso programą' })).toHaveAttr(
        'href',
        '/lt/',
      ),
    )
  })
})
