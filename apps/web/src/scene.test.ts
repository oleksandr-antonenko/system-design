import { Option } from 'effect'
import {
  Mount,
  all,
  click,
  expect,
  expectAll,
  given,
  label,
  role,
  scene,
  text,
} from 'foldkit/scene'
import { fromString } from 'foldkit/url'
import { describe, test } from 'vitest'

import * as Board from './board/board'
import { BoardPointer } from './board/pointer'
import type { Locale } from './i18n/locale'
import { AppRoute, Flags, Model, init, update } from './main'
import { view } from './view'

const at = (route: AppRoute, locale: Locale) =>
  Model.make({
    route,
    preferredLocale: locale,
    maybeSavedLocale: Option.some(locale),
    prefersDark: false,
    lessonSessions: {},
  })

describe('header', () => {
  test('the language switcher keeps the current lesson', () => {
    scene(
      { update, view },
      given(
        at(
          AppRoute.Lesson({
            locale: 'ru',
            slug: 'load-balancer',
            step: Option.none(),
          }),
          'ru',
        ),
      ),
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
      given(
        at(
          AppRoute.Lesson({
            locale: 'en',
            slug: 'load-balancer',
            step: Option.none(),
          }),
          'en',
        ),
      ),
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
      given(
        at(
          AppRoute.Lesson({
            locale: 'uk',
            slug: 'load-balancer',
            step: Option.none(),
          }),
          'uk',
        ),
      ),
      expect(label('Теорія')).toExist(),
      expect(label('Дошка')).toExist(),
      expect(label('Прилади')).toExist(),
    )
  })

  test('an unknown lesson shows the not-found page', () => {
    scene(
      { update, view },
      given(
        at(
          AppRoute.Lesson({
            locale: 'en',
            slug: 'no-such-lesson',
            step: Option.none(),
          }),
          'en',
        ),
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

const openLesson = (path: string) =>
  init(
    Flags.make({
      maybeSavedLocale: Option.some('ru'),
      browserLanguages: ['ru-RU'],
      prefersDark: false,
    }),
    Option.getOrThrowWith(
      fromString(`http://localhost${path}`),
      () => new Error(`bad url ${path}`),
    ),
  ).model

const pointerReady = Mount.resolve(
  BoardPointer,
  Board.Message.CancelledPointer(),
)

describe('lesson player', () => {
  test('a theory step shows the text, a read-only board and the instruments', () => {
    scene(
      { update, view },
      given(openLesson('/ru/lessons/load-balancer?step=1')),
      pointerReady,
      expect(label('Теория')).toExist(),
      expect(role('heading', { name: 'Балансировщик нагрузки' })).toExist(),
      expect(role('img', { name: /^Сервер app1/ })).toExist(),
      expect(role('img', { name: /^Пользователи users/ })).toExist(),
      expect(label('Приборы')).toExist(),
      expect(role('button', { name: /Балансировщик/ })).toBeDisabled(),
      expect(text('Доска следует за текстом')).toExist(),
      expect(role('button', { name: 'Далее →' })).toBeEnabled(),
    )
  })

  test('the task step has a live checklist and locks Next', () => {
    scene(
      { update, view },
      given(openLesson('/ru/lessons/load-balancer?step=4')),
      pointerReady,
      expect(role('button', { name: /Балансировщик/ })).toBeEnabled(),
      expect(text('На доске есть балансировщик')).toExist(),
      expect(text('Ещё один критерий проверяется прогоном нагрузки')).toExist(),
      expect(role('button', { name: 'Проверить' })).toBeEnabled(),
      expect(role('button', { name: 'Далее →' })).toBeDisabled(),
    )
  })

  test('the operation log shows the script of the step', () => {
    scene(
      { update, view },
      given(openLesson('/ru/lessons/load-balancer?step=2')),
      pointerReady,
      expect(label('Журнал операций')).toBeAbsent(),
      click(role('button', { name: 'Журнал операций' })),
      expect(label('Журнал операций')).toExist(),
      expect(text('Сценарий шага «Распродажа»')).toExist(),
    )
  })
})
