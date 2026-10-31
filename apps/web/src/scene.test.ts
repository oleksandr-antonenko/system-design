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
  keydown,
  label,
  role,
  scene,
  text,
  within,
} from 'foldkit/scene'
import { fromString } from 'foldkit/url'
import { describe, test } from 'vitest'

import * as Menu from '@foldkit/ui/menu'

import * as Board from './board/board'
import { BoardPointer } from './board/pointer'
import { courseTextFor, lessonTextFor } from './courses/assemble'
import { courses, findCourse, lessonsOf } from './courses/registry'
import type { BoardOp } from './domain/board'
import type { Locale } from './i18n/locale'
import { uiFor } from './i18n/ui'
import { addNode, connect } from './kinds/flow/dsl'
import { KindOp } from './kinds/state'
import * as Player from './lesson/player'
import {
  AppRoute,
  Flags,
  Message,
  Model,
  NavigateInternal,
  ReplaceStepUrl,
  SaveLocale,
  init,
  initialDesktopNotice,
  initialLanguageMenu,
  update,
} from './main'
import { view } from './view'

const at = (route: AppRoute, locale: Locale) =>
  Model.make({
    route,
    preferredLocale: locale,
    languageMenu: initialLanguageMenu(),
    prefersDark: false,
    lessonSessions: {},
    lessonLoads: {},
    desktopNotice: initialDesktopNotice(),
  })

describe('header', () => {
  test('the language button shows the current language and opens the menu', () => {
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
      expect(role('link', { name: 'English' })).toBeAbsent(),
      expect(role('button', { name: 'Язык: RU' })).toHaveAttr(
        'aria-haspopup',
        'menu',
      ),
      expect(role('button', { name: 'Язык: RU' })).toHaveAttr(
        'aria-expanded',
        'false',
      ),
      click(role('button', { name: 'Язык: RU' })),
      Mount.resolve(Menu.AnchorMenu, Menu.Message.CompletedAnchorMenu()),
      Mount.resolve(
        Menu.PortalMenuBackdrop,
        Menu.Message.CompletedPortalMenuBackdrop(),
      ),
      Command.resolve(Menu.FocusItems, Menu.Message.CompletedFocusItems()),
      expect(role('button', { name: 'Язык: RU' })).toHaveAttr(
        'aria-expanded',
        'true',
      ),
      expectAll(all.role('menuitem')).toHaveCount(4),
      expect(role('menuitem', { name: 'Русский, текущий' })).toExist(),
      expect(role('menuitem', { name: 'Українська' })).toExist(),
      expect(role('menuitem', { name: 'English' })).toExist(),
      expect(role('menuitem', { name: 'Lietuvių' })).toExist(),
      click(role('menuitem', { name: 'English' })),
      Command.resolve(SaveLocale, Message.CompletedSaveLocale()),
      Command.resolve(
        NavigateInternal({ url: '/en/system-design/lessons/load-balancer' }),
        Message.CompletedNavigateInternal(),
      ),
      Command.resolve(Menu.FocusButton, Menu.Message.CompletedFocusButton()),
      Mount.expectEnded(Menu.AnchorMenu),
      Mount.expectEnded(Menu.PortalMenuBackdrop),
      expect(role('menuitem', { name: 'English' })).toBeAbsent(),
    )
  })

  test('Escape closes the language menu', () => {
    scene(
      { update, view },
      given(at(AppRoute.Home({ locale: 'en' }), 'en')),
      click(role('button', { name: 'Language: EN' })),
      Mount.resolve(Menu.AnchorMenu, Menu.Message.CompletedAnchorMenu()),
      Mount.resolve(
        Menu.PortalMenuBackdrop,
        Menu.Message.CompletedPortalMenuBackdrop(),
      ),
      Command.resolve(Menu.FocusItems, Menu.Message.CompletedFocusItems()),
      keydown(role('menu'), 'Escape'),
      Command.resolve(Menu.FocusButton, Menu.Message.CompletedFocusButton()),
      Mount.expectEnded(Menu.AnchorMenu),
      Mount.expectEnded(Menu.PortalMenuBackdrop),
      expect(role('menu')).toBeAbsent(),
      expect(role('button', { name: 'Language: EN' })).toHaveAttr(
        'aria-expanded',
        'false',
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
      expect(
        role('heading', { name: 'Load balancer. Sharing the load' }),
      ).toExist(),
      expect(role('link', { name: 'Interactive courses' })).toHaveAttr(
        'href',
        '/en/',
      ),
      expect(role('link', { name: 'Courses' })).toHaveAttr('href', '/en/'),
      expect(role('link', { name: '← Back to the course outline' })).toHaveAttr(
        'href',
        '/en/system-design/',
      ),
    )
  })

  test('the header has one link to the catalogue instead of a link per course', () => {
    scene(
      { update, view },
      given(at(AppRoute.Course({ locale: 'ru', course: 'networks' }), 'ru')),
      expect(
        within(role('banner'), role('link', { name: 'Курсы' })),
      ).toHaveAttr('href', '/ru/'),
      expect(role('navigation', { name: 'Курс' })).not.toExist(),
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
      expectAll(all.selector('main li')).toHaveCount(courses.length),
      expect(
        within(role('main'), role('link', { name: 'System Design' })),
      ).toHaveAttr('href', '/lt/system-design/'),
      expect(
        within(role('main'), role('link', { name: 'Tinklai vaibkoderiams' })),
      ).toHaveAttr('href', '/lt/networks/'),
      expect(
        within(
          role('main'),
          role('link', { name: 'Kibernetinis saugumas biure' }),
        ),
      ).toHaveAttr('href', '/lt/security/'),
      expect(
        within(
          role('main'),
          text(uiFor('lt').home.lessonCount(lessonsOf('system-design').length)),
        ),
      ).toExist(),
      expect(
        within(
          role('main'),
          text(uiFor('lt').home.lessonCount(lessonsOf('networks').length)),
        ),
      ).toExist(),
      expectAll(all.text('Netrukus')).toHaveCount(0),
    )
  })
})

describe('course map', () => {
  test('lists all System Design lessons; only available ones are links', () => {
    const lessons = lessonsOf('system-design')
    const available = Array.filter(lessons, lesson => lesson.meta.available)
    const unavailable = Array.filter(lessons, lesson => !lesson.meta.available)
    scene(
      { update, view },
      given(
        at(AppRoute.Course({ locale: 'uk', course: 'system-design' }), 'uk'),
      ),
      expect(role('heading', { name: 'System Design', level: 1 })).toExist(),
      expect(text(uiFor('uk').home.lessonCount(lessons.length))).toExist(),
      expectAll(all.selector('main li')).toHaveCount(lessons.length),
      expectAll(all.selector('main a')).toHaveCount(available.length),
      expect(
        role('link', { name: 'Load balancer. Навантаження ділиться порівну' }),
      ).toHaveAttr('href', '/uk/system-design/lessons/load-balancer'),
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

  test('the networking course shows its lessons under their modules; only available ones are links', () => {
    const lessons = lessonsOf('networks')
    const available = Array.filter(lessons, lesson => lesson.meta.available)
    const course = Option.getOrThrow(findCourse('networks'))
    const moduleTitle = (module: string) =>
      courseTextFor(course, 'ru').text.modules[module] ?? module
    scene(
      { update, view },
      given(at(AppRoute.Course({ locale: 'ru', course: 'networks' }), 'ru')),
      expect(
        role('heading', { name: 'Сети для вайбкодеров', level: 1 }),
      ).toExist(),
      expect(role('heading', { name: 'Как устроена домашняя сеть' })).toExist(),
      expect(role('heading', { name: 'Интернет' })).toExist(),
      ...Array.map(course.definition.modules, module =>
        Array.some(lessons, lesson => lesson.meta.module === module)
          ? expect(role('heading', { name: moduleTitle(module) })).toExist()
          : expect(role('heading', { name: moduleTitle(module) })).toBeAbsent(),
      ),
      expectAll(all.selector('main li')).toHaveCount(lessons.length),
      expectAll(all.selector('main a')).toHaveCount(available.length),
      expectAll(all.text('Скоро')).toHaveCount(
        lessons.length - available.length,
      ),
      expect(
        role('link', { name: 'Port и localhost. Квартиры в одном доме' }),
      ).toHaveAttr('href', '/ru/networks/lessons/ports-and-localhost'),
      expect(
        role('heading', {
          name: 'Router. Как телефон попадает в интернет',
        }),
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
      isStackedScreen: false,
      isDesktopNoticeDismissed: false,
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
      expect(
        role('heading', { name: 'Load balancer. Нагрузка делится поровну' }),
      ).toExist(),
      expect(role('img', { name: /^Server app1/ })).toExist(),
      expect(role('img', { name: /^Users users/ })).toExist(),
      expect(label('Приборы')).toExist(),
      expect(role('button', { name: /^Load balancer/ })).toBeDisabled(),
      expect(text('Доска следует за текстом')).toExist(),
      expect(role('button', { name: 'Далее →' })).toBeEnabled(),
    )
  })

  test('the board names elements in English and explains them in the page language', () => {
    scene(
      { update, view },
      given(openLesson('/ru/system-design/lessons/load-balancer?step=4')),
      pointerReady,
      expect(role('button', { name: /^Load balancer/ })).toHaveAttr(
        'title',
        'Балансировщик нагрузки: раздаёт запросы между серверами\nПеретащите на доску или нажмите, чтобы добавить',
      ),
      expect(role('img', { name: /^Server app1/ })).toHaveAttr(
        'aria-description',
        'Сервер приложения: выполняет код и отвечает на запросы',
      ),
      expect(role('img', { name: /^Users users/ })).toExist(),
      expect(text('Users')).toExist(),
    )
  })

  test('the task step has a live checklist and locks Next', () => {
    scene(
      { update, view },
      given(openLesson('/ru/system-design/lessons/load-balancer?step=4')),
      pointerReady,
      expect(role('button', { name: /^Load balancer/ })).toBeEnabled(),
      expect(text('На доске есть блок «Load balancer»')).toExist(),
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

const paletteBalancer = role('button', { name: /^Load balancer/ })

const goal = (name: string) =>
  first(filter(all.selector('ul.goals li'), { hasText: name }))

const journal = (line: string) => within(label('Журнал операций'), text(line))

const app1 = role('img', { name: /^Server app1/ })

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
      expect(goal('На доске есть блок «Load balancer»')).not.toHaveClass('met'),
      click(paletteBalancer),
      expect(goal('На доске есть блок «Load balancer»')).toHaveClass('met'),
      expect(
        goal('Load balancer ведёт к трём блокам «Server»'),
      ).not.toHaveClass('met'),
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
      expect(text('сюда: Load balancer')).toBeAbsent(),
      click(hint),
      expect(role('button', { name: 'Показать решение' })).toBeEnabled(),
      expect(text('сюда: Load balancer')).toExist(),
      expect(hint).toBeDisabled(),
    )
  })
})

const proseRef = (name: string) =>
  first(filter(all.selector('span.prose-ref'), { hasText: name }))

describe('theory and board together', () => {
  test('pointing at a term in the text highlights its block', () => {
    scene(
      { update, view },
      given(openLesson('/ru/system-design/lessons/load-balancer?step=1')),
      pointerReady,
      expect(app1).not.toHaveClass('selected'),
      hover(proseRef('server')),
      expect(app1).toHaveClass('selected'),
      expect(role('img', { name: /^Users users/ })).not.toHaveClass('selected'),
    )
  })

  test('a focused term highlights its block until focus leaves', () => {
    scene(
      { update, view },
      given(openLesson('/ru/system-design/lessons/load-balancer?step=1')),
      pointerReady,
      focus(proseRef('server')),
      expect(app1).toHaveClass('selected'),
      blur(proseRef('server')),
      expect(app1).not.toHaveClass('selected'),
    )
  })

  test('Back from step 3 restores the board of step 2 with its marks', () => {
    scene(
      { update, view },
      given(openLesson('/ru/system-design/lessons/load-balancer?step=3')),
      pointerReady,
      expect(role('img', { name: /^Server app2/ })).toExist(),
      expectAll(all.selector('rect.halo.warn')).toHaveCount(2),
      expect(text(/^загрузка .* · ошибки /)).toBeAbsent(),
      click(role('button', { name: '← Назад' })),
      Command.resolve(
        Player.ScrollStepIntoView,
        Player.Message.CompletedScrollStepIntoView(),
      ),
      Command.resolve(ReplaceStepUrl, Message.CompletedReplaceStepUrl()),
      expect(role('img', { name: /^Server app2/ })).toBeAbsent(),
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
      expect(text(/Сколько запросов в секунду дойдёт до database/)).toExist(),
      expect(text('Сначала ответьте на вопрос')).toExist(),
      expect(role('button', { name: 'Далее →' })).toBeDisabled(),
      expect(role('button', { name: /^Далее: Задача: cache/ })).toBeDisabled(),
      click(option(/^256 rps/)),
      expect(text('Не совсем')).toExist(),
      expect(text(/это только cache miss/)).toExist(),
      expect(text('Правильный ответ: 576 rps')).toExist(),
      expect(option(/^576 rps/)).toHaveClass('right'),
      expect(option(/^256 rps/)).toBeDisabled(),
      expect(role('button', { name: 'Далее →' })).toBeEnabled(),
      expect(role('button', { name: /^Далее: Задача: cache/ })).toBeEnabled(),
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
