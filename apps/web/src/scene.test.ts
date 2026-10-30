import { Array, Option } from 'effect'
import {
  Command,
  Mount,
  all,
  blur,
  click,
  expect,
  expectAll,
  filter,
  first,
  focus,
  given,
  hover,
  label,
  role,
  scene,
  text,
  within,
} from 'foldkit/scene'
import { fromString } from 'foldkit/url'
import { describe, test } from 'vitest'

import * as Board from './board/board'
import { BoardPointer } from './board/pointer'
import { lessonTextFor } from './courses/assemble'
import { lessonsOf } from './courses/registry'
import type { BoardOp } from './domain/board'
import type { Locale } from './i18n/locale'
import { addNode, connect } from './kinds/flow/dsl'
import { KindOp } from './kinds/state'
import * as Player from './lesson/player'
import {
  AppRoute,
  Flags,
  Message,
  Model,
  ReplaceStepUrl,
  init,
  update,
} from './main'
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
            course: 'system-design',
            slug: 'load-balancer',
            step: Option.none(),
          }),
          'ru',
        ),
      ),
      expect(role('link', { name: 'English' })).toHaveAttr(
        'href',
        '/en/system-design/lessons/load-balancer',
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
            course: 'system-design',
            slug: 'load-balancer',
            step: Option.none(),
          }),
          'en',
        ),
      ),
      expect(role('heading', { name: 'Load balancer' })).toExist(),
      expect(role('link', { name: 'Interactive courses' })).toHaveAttr(
        'href',
        '/en/',
      ),
      expect(role('link', { name: 'System Design' })).toHaveAttr(
        'href',
        '/en/system-design/',
      ),
      expect(role('link', { name: 'System Design' })).toHaveAttr(
        'aria-current',
        'page',
      ),
      expect(role('link', { name: '← Back to the course outline' })).toHaveAttr(
        'href',
        '/en/system-design/',
      ),
    )
  })

  test('the course switcher lists every course and marks the current one', () => {
    scene(
      { update, view },
      given(at(AppRoute.Course({ locale: 'ru', course: 'networks' }), 'ru')),
      expect(
        within(
          role('navigation', { name: 'Курс' }),
          role('link', { name: 'System Design' }),
        ),
      ).toHaveAttr('href', '/ru/system-design/'),
      expect(
        within(
          role('navigation', { name: 'Курс' }),
          role('link', { name: 'Сети для вайбкодеров' }),
        ),
      ).toHaveAttr('aria-current', 'page'),
    )
  })
})

const ukTitle = (lesson: ReturnType<typeof lessonsOf>[number]) =>
  lessonTextFor(lesson, 'uk').text.title

describe('catalogue', () => {
  test('has a card per course; a course with open lessons is not “coming soon”', () => {
    scene(
      { update, view },
      given(at(AppRoute.Home({ locale: 'lt' }), 'lt')),
      expect(role('heading', { name: 'Interaktyvūs kursai' })).toExist(),
      expectAll(all.selector('main li')).toHaveCount(2),
      expect(
        within(role('main'), role('link', { name: 'System Design' })),
      ).toHaveAttr('href', '/lt/system-design/'),
      expect(
        within(role('main'), role('link', { name: 'Tinklai vaibkoderiams' })),
      ).toHaveAttr('href', '/lt/networks/'),
      expect(within(role('main'), text('13 pamokų'))).toExist(),
      expect(within(role('main'), text('16 pamokų'))).toExist(),
      expectAll(all.text('Netrukus')).toHaveCount(0),
    )
  })
})

describe('course map', () => {
  test('lists all 13 System Design lessons; only available ones are links', () => {
    const lessons = lessonsOf('system-design')
    const available = Array.filter(lessons, lesson => lesson.meta.available)
    const unavailable = Array.filter(lessons, lesson => !lesson.meta.available)
    scene(
      { update, view },
      given(
        at(AppRoute.Course({ locale: 'uk', course: 'system-design' }), 'uk'),
      ),
      expect(role('heading', { name: 'System Design', level: 1 })).toExist(),
      expect(text('13 уроків')).toExist(),
      expectAll(all.selector('main li')).toHaveCount(13),
      expectAll(all.selector('main a')).toHaveCount(available.length),
      expect(role('link', { name: 'Балансувальник навантаження' })).toHaveAttr(
        'href',
        '/uk/system-design/lessons/load-balancer',
      ),
      ...Array.map(available, lesson =>
        expect(role('link', { name: ukTitle(lesson) })).toHaveAttr(
          'href',
          `/uk/system-design/lessons/${lesson.meta.slug}`,
        ),
      ),
      ...Array.map(unavailable, lesson =>
        expect(role('link', { name: ukTitle(lesson) })).toBeAbsent(),
      ),
    )
  })

  test('the networking course shows 16 lessons in three modules; only available ones are links', () => {
    const available = Array.filter(
      lessonsOf('networks'),
      lesson => lesson.meta.available,
    )
    scene(
      { update, view },
      given(at(AppRoute.Course({ locale: 'ru', course: 'networks' }), 'ru')),
      expect(
        role('heading', { name: 'Сети для вайбкодеров', level: 1 }),
      ).toExist(),
      expect(role('heading', { name: 'Как устроена домашняя сеть' })).toExist(),
      expect(role('heading', { name: 'Интернет' })).toExist(),
      expect(role('heading', { name: 'Сеть разработчика' })).toExist(),
      expectAll(all.selector('main li')).toHaveCount(16),
      expectAll(all.selector('main a')).toHaveCount(available.length),
      expectAll(all.text('Скоро')).toHaveCount(16 - available.length),
      expect(role('link', { name: 'Ports: квартиры в одном доме' })).toHaveAttr(
        'href',
        '/ru/networks/lessons/ports-and-localhost',
      ),
      expect(
        role('heading', { name: 'Как телефон попадает в интернет' }),
      ).toExist(),
    )
  })

  test('an unknown course shows the not-found page', () => {
    scene(
      { update, view },
      given(at(AppRoute.Course({ locale: 'en', course: 'nope' }), 'en')),
      expect(role('heading', { name: 'Page not found' })).toExist(),
      expect(text('There is no course “nope”.')).toExist(),
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
            course: 'system-design',
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
            course: 'system-design',
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
      expect(role('link', { name: 'Atgal į kursų sąrašą' })).toHaveAttr(
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
      given(openLesson('/ru/system-design/lessons/load-balancer?step=1')),
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
      given(openLesson('/ru/system-design/lessons/load-balancer?step=4')),
      pointerReady,
      expect(role('button', { name: /Балансировщик/ })).toBeEnabled(),
      expect(text('На доске есть балансировщик')).toExist(),
      expect(text('Ещё один критерий проверяется прогоном нагрузки')).toExist(),
      expect(role('button', { name: 'Проверить' })).toBeEnabled(),
      expect(role('button', { name: 'Далее →' })).toBeDisabled(),
    )
  })

  test('a Next button sits right under the step the student just read', () => {
    scene(
      { update, view },
      given(openLesson('/ru/system-design/lessons/load-balancer?step=1')),
      pointerReady,
      expect(role('button', { name: 'Далее: Распродажа →' })).toExist(),
      click(role('button', { name: 'Далее: Распродажа →' })),
      Command.resolve(
        Player.ScrollStepIntoView,
        Player.Message.CompletedScrollStepIntoView(),
      ),
      Command.resolve(ReplaceStepUrl, Message.CompletedReplaceStepUrl()),
      expect(role('button', { name: /^Далее: Вверх или вширь/ })).toExist(),
    )
  })

  test('an unsolved task has no inline Next', () => {
    scene(
      { update, view },
      given(openLesson('/ru/system-design/lessons/load-balancer?step=4')),
      pointerReady,
      expect(role('button', { name: /^Далее: / })).toBeAbsent(),
    )
  })

  test('the operation log shows the script of the step', () => {
    scene(
      { update, view },
      given(openLesson('/ru/system-design/lessons/load-balancer?step=2')),
      pointerReady,
      expect(label('Журнал операций')).toBeAbsent(),
      click(role('button', { name: 'Журнал операций' })),
      expect(label('Журнал операций')).toExist(),
      expect(text('Сценарий шага «Распродажа»')).toExist(),
    )
  })
})

const TASK_URL = '/ru/system-design/lessons/load-balancer?step=4'

const paletteBalancer = role('button', { name: /Балансировщик/ })

const goal = (name: string) =>
  first(filter(all.selector('ul.goals li'), { hasText: name }))

const journal = (line: string) => within(label('Журнал операций'), text(line))

const app1 = role('img', { name: /^Сервер app1/ })

const LOAD_BALANCER = 'system-design/load-balancer'

const withTaskLog = (model: Model, log: ReadonlyArray<BoardOp>): Model => {
  const session = model.lessonSessions[LOAD_BALANCER]
  if (session === undefined) {
    throw new Error('the lesson session is missing')
  }
  return Model.make({
    ...model,
    lessonSessions: {
      [LOAD_BALANCER]: {
        ...session,
        tasks: {
          'place-lb': {
            log: log.map(op => KindOp.FlowOp({ op })),
            redo: [],
            attempts: 0,
            hintsShown: 0,
            check: Player.CheckState.Unchecked(),
            maybeReplayIndex: Option.none(),
          },
        },
      },
    },
  })
}

describe('task on the board', () => {
  test('placing a balancer ticks its goal at once', () => {
    scene(
      { update, view },
      given(openLesson(TASK_URL)),
      pointerReady,
      expect(goal('На доске есть балансировщик')).not.toHaveClass('met'),
      click(paletteBalancer),
      expect(goal('На доске есть балансировщик')).toHaveClass('met'),
      expect(goal('Балансировщик ведёт к трём серверам')).not.toHaveClass(
        'met',
      ),
    )
  })

  test('the operation log lists the block the student just added', () => {
    scene(
      { update, view },
      given(openLesson(TASK_URL)),
      pointerReady,
      click(role('button', { name: 'Журнал операций' })),
      expect(
        journal('Пока пусто. Ходы появятся, когда начнёте задачу.'),
      ).toExist(),
      click(paletteBalancer),
      expect(journal('AddNode lb-1 · lb')).toExist(),
      expect(
        journal('Пока пусто. Ходы появятся, когда начнёте задачу.'),
      ).toBeAbsent(),
    )
  })

  test('the operation log names connections in the same language', () => {
    scene(
      { update, view },
      given(
        withTaskLog(openLesson(TASK_URL), [
          addNode('lb-1', 'lb', 300, 280, { locked: false }),
          connect('lb-1', 'app1'),
        ]),
      ),
      pointerReady,
      click(role('button', { name: 'Журнал операций' })),
      expect(journal('AddNode lb-1 · lb')).toExist(),
      expect(journal('Connect lb-1 → app1')).toExist(),
    )
  })

  test('at an unsolved task the player says why Next is locked', () => {
    scene(
      { update, view },
      given(openLesson(TASK_URL)),
      pointerReady,
      expect(role('button', { name: 'Далее →' })).toBeDisabled(),
      expect(text('Решите задачу на доске, чтобы продолжить')).toExist(),
    )
  })

  test('before the task Next is open and nothing asks to solve first', () => {
    scene(
      { update, view },
      given(openLesson('/ru/system-design/lessons/load-balancer?step=3')),
      pointerReady,
      expect(role('button', { name: 'Далее →' })).toBeEnabled(),
      expect(text('Решите задачу на доске, чтобы продолжить')).toBeAbsent(),
    )
  })

  test('Show solution appears after the second failed check', () => {
    scene(
      { update, view },
      given(openLesson(TASK_URL)),
      pointerReady,
      expect(role('button', { name: 'Показать решение' })).toBeAbsent(),
      click(role('button', { name: 'Проверить' })),
      expect(role('button', { name: 'Показать решение' })).toBeAbsent(),
      click(role('button', { name: 'Проверить' })),
      expect(role('button', { name: 'Показать решение' })).toBeEnabled(),
    )
  })

  test('the third hint draws the outline and offers the solution', () => {
    const hint = role('button', { name: /^Подсказка/ })
    scene(
      { update, view },
      given(openLesson(TASK_URL)),
      pointerReady,
      click(hint),
      click(hint),
      expect(role('button', { name: 'Показать решение' })).toBeAbsent(),
      expect(text('сюда: Балансировщик')).toBeAbsent(),
      click(hint),
      expect(role('button', { name: 'Показать решение' })).toBeEnabled(),
      expect(text('сюда: Балансировщик')).toExist(),
      expect(hint).toBeDisabled(),
    )
  })
})

describe('theory and board together', () => {
  test('pointing at a term in the text highlights its block', () => {
    scene(
      { update, view },
      given(openLesson('/ru/system-design/lessons/load-balancer?step=1')),
      pointerReady,
      expect(app1).not.toHaveClass('selected'),
      hover(text('сервер приложения')),
      expect(app1).toHaveClass('selected'),
      expect(role('img', { name: /^Пользователи users/ })).not.toHaveClass(
        'selected',
      ),
    )
  })

  test('a focused term highlights its block until focus leaves', () => {
    scene(
      { update, view },
      given(openLesson('/ru/system-design/lessons/load-balancer?step=1')),
      pointerReady,
      focus(text('сервер приложения')),
      expect(app1).toHaveClass('selected'),
      blur(text('сервер приложения')),
      expect(app1).not.toHaveClass('selected'),
    )
  })

  test('Back from step 3 restores the board of step 2 with its marks', () => {
    scene(
      { update, view },
      given(openLesson('/ru/system-design/lessons/load-balancer?step=3')),
      pointerReady,
      expect(role('img', { name: /^Сервер app2/ })).toExist(),
      expectAll(all.selector('rect.halo.warn')).toHaveCount(2),
      expect(text(/^загрузка .* · ошибки /)).toBeAbsent(),
      click(role('button', { name: '← Назад' })),
      Command.resolve(
        Player.ScrollStepIntoView,
        Player.Message.CompletedScrollStepIntoView(),
      ),
      Command.resolve(ReplaceStepUrl, Message.CompletedReplaceStepUrl()),
      expect(role('img', { name: /^Сервер app2/ })).toBeAbsent(),
      expectAll(all.selector('rect.halo.warn')).toHaveCount(0),
      expectAll(all.selector('rect.halo.bad')).toHaveCount(1),
      expect(text('загрузка 225% · ошибки 56%')).toExist(),
      expect(text('0 rps · простаивает')).toBeAbsent(),
    )
  })
})

describe('quiz step', () => {
  const QUIZ_URL = '/ru/system-design/lessons/caching?step=3'
  const option = (name: RegExp) =>
    within(role('group', { name: 'Варианты ответа' }), role('button', { name }))

  test('Next waits for the one attempt; a wrong answer explains and opens it', () => {
    scene(
      { update, view },
      given(openLesson(QUIZ_URL)),
      pointerReady,
      expect(text(/Сколько запросов в секунду дойдёт до базы/)).toExist(),
      expect(text('Сначала ответьте на вопрос')).toExist(),
      expect(role('button', { name: 'Далее →' })).toBeDisabled(),
      expect(role('button', { name: /^Далее: Задача: кеш/ })).toBeDisabled(),
      click(option(/^256 rps/)),
      expect(text('Не совсем')).toExist(),
      expect(text(/это только промахи/)).toExist(),
      expect(text('Правильный ответ: 576 rps')).toExist(),
      expect(option(/^576 rps/)).toHaveClass('right'),
      expect(option(/^256 rps/)).toBeDisabled(),
      expect(role('button', { name: 'Далее →' })).toBeEnabled(),
      expect(role('button', { name: /^Далее: Задача: кеш/ })).toBeEnabled(),
    )
  })

  test('the right answer says so', () => {
    scene(
      { update, view },
      given(openLesson(QUIZ_URL)),
      pointerReady,
      click(option(/^576 rps/)),
      expect(text('Верно с первой попытки')).toExist(),
      expect(text(/Проверьте это в задаче/)).toExist(),
    )
  })
})
