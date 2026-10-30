import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { fromString } from 'foldkit/url'
import { describe, expect, test } from 'vitest'

import * as Menu from '@foldkit/ui/menu'

import * as Player from './lesson/player'
import {
  AppRoute,
  Flags,
  Message,
  Model,
  NavigateInternal,
  RedirectToCourse,
  RedirectToLocale,
  ReplaceStepUrl,
  RevealLessonStep,
  SaveLocale,
  init,
  initialLanguageMenu,
  update,
} from './main'

const urlOf = (path: string) =>
  Option.getOrThrowWith(
    fromString(`http://localhost${path}`),
    () => new Error(`bad url ${path}`),
  )

const flags = (saved: string | null, browserLanguages: ReadonlyArray<string>) =>
  Flags.make({
    maybeSavedLocale: Option.fromNullishOr(saved),
    browserLanguages,
    prefersDark: false,
  })

const LOAD_BALANCER = 'system-design/load-balancer'

type CommandLike = Readonly<{ name: string; args?: Record<string, unknown> }>

const describeCommands = (commands: ReadonlyArray<CommandLike> | undefined) =>
  (commands ?? []).map(({ name, args }) => ({ name, args }))

describe('init', () => {
  test('/ redirects to the browser language and replaces history', () => {
    const result = init(flags(null, ['uk-UA', 'en-US']), urlOf('/'))

    expect(result.model.preferredLocale).toBe('uk')
    expect(describeCommands(result.commands)).toEqual(
      describeCommands([RedirectToLocale({ url: '/uk/' })]),
    )
  })

  test('/ lands on English when no browser language is supported', () => {
    const result = init(flags(null, ['de-DE', 'fr-FR']), urlOf('/'))

    expect(describeCommands(result.commands)).toEqual(
      describeCommands([RedirectToLocale({ url: '/en/' })]),
    )
  })

  test('/ picks the first supported browser language, in order', () => {
    const result = init(flags(null, ['de-DE', 'lt-LT', 'ru-RU']), urlOf('/'))

    expect(describeCommands(result.commands)).toEqual(
      describeCommands([RedirectToLocale({ url: '/lt/' })]),
    )
  })

  test('a saved choice wins over the browser languages', () => {
    const result = init(flags('uk', ['lt-LT']), urlOf('/'))

    expect(describeCommands(result.commands)).toEqual(
      describeCommands([RedirectToLocale({ url: '/uk/' })]),
    )
  })

  test('a link without a prefix keeps its path and query', () => {
    const result = init(
      flags('ru', ['uk-UA']),
      urlOf('/lessons/load-balancer?step=2'),
    )

    expect(describeCommands(result.commands)).toEqual(
      describeCommands([
        RedirectToLocale({ url: '/ru/lessons/load-balancer?step=2' }),
      ]),
    )
  })

  test('a corrupted saved value is ignored', () => {
    const result = init(flags('xx', ['lt-LT']), urlOf('/'))

    expect(describeCommands(result.commands)).toEqual(
      describeCommands([RedirectToLocale({ url: '/lt/' })]),
    )
  })

  test('opening a prefixed page does not save its language', () => {
    const result = init(
      flags('ru', ['ru-RU']),
      urlOf('/en/system-design/lessons/load-balancer'),
    )

    expect(result.model.route).toEqual(
      AppRoute.Lesson({
        locale: 'en',
        course: 'system-design',
        slug: 'load-balancer',
        step: Option.some(1),
      }),
    )
    expect(describeCommands(result.commands)).toEqual(
      describeCommands([
        ReplaceStepUrl({
          url: '/en/system-design/lessons/load-balancer?step=1',
        }),
      ]),
    )
    expect(result.model.lessonSessions[LOAD_BALANCER]?.step).toBe(0)
  })

  test('a requested step beyond an unsolved task is clamped to the task', () => {
    const result = init(
      flags('en', ['en-US']),
      urlOf('/en/system-design/lessons/load-balancer?step=6'),
    )

    expect(result.model.lessonSessions[LOAD_BALANCER]?.step).toBe(3)
    expect(describeCommands(result.commands)).toEqual(
      describeCommands([
        ReplaceStepUrl({
          url: '/en/system-design/lessons/load-balancer?step=4',
        }),
        RevealLessonStep({ step: 3 }),
      ]),
    )
  })

  test.each([
    ['2.5', 2],
    ['NaN', 1],
    ['-4', 1],
  ])('?step=%s is corrected to step %i', (requested, expected) => {
    const result = init(
      flags('en', ['en-US']),
      urlOf(`/en/system-design/lessons/load-balancer?step=${requested}`),
    )

    expect(result.model.lessonSessions[LOAD_BALANCER]?.step).toBe(expected - 1)
    expect(result.model.route).toEqual(
      AppRoute.Lesson({
        locale: 'en',
        course: 'system-design',
        slug: 'load-balancer',
        step: Option.some(expected),
      }),
    )
    expect(describeCommands(result.commands)).toEqual(
      describeCommands([
        ReplaceStepUrl({
          url: `/en/system-design/lessons/load-balancer?step=${expected}`,
        }),
        ...(expected > 1 ? [RevealLessonStep({ step: expected - 1 })] : []),
      ]),
    )
  })

  test('a canonical step url is not rewritten', () => {
    const result = init(
      flags('en', ['en-US']),
      urlOf('/en/system-design/lessons/load-balancer?step=2'),
    )

    expect(result.model.lessonSessions[LOAD_BALANCER]?.step).toBe(1)
    expect(describeCommands(result.commands)).toEqual(
      describeCommands([RevealLessonStep({ step: 1 })]),
    )
  })

  test('an old lesson address is replaced by the System Design one with the same step', () => {
    const result = init(
      flags('ru', ['ru-RU']),
      urlOf('/ru/lessons/caching?step=2'),
    )

    expect(result.model.route).toEqual(
      AppRoute.LegacyLesson({
        locale: 'ru',
        slug: 'caching',
        step: Option.some(2),
      }),
    )
    expect(describeCommands(result.commands)).toEqual(
      describeCommands([
        RedirectToCourse({ url: '/ru/system-design/lessons/caching?step=2' }),
      ]),
    )
  })

  test('the already saved language is not saved again', () => {
    const result = init(flags('en', ['ru-RU']), urlOf('/en/'))

    expect(describeCommands(result.commands)).toEqual([])
  })
})

const onLesson = (locale: 'ru' | 'en') =>
  Model.make({
    route: AppRoute.Lesson({
      locale,
      course: 'system-design',
      slug: 'load-balancer',
      step: Option.none(),
    }),
    preferredLocale: locale,
    languageMenu: initialLanguageMenu(),
    prefersDark: false,
    lessonSessions: {},
    lessonLoads: {},
  })

describe('update', () => {
  test('picking a language saves the choice and opens the same lesson in it', () => {
    story(
      update,
      given(onLesson('ru')),
      message(
        Message.GotLanguageMenuMessage({
          message: Menu.Message.SelectedItem({ index: 2, item: 'en' }),
        }),
      ),
      Command.expectHas(
        SaveLocale({ locale: 'en' }),
        NavigateInternal({ url: '/en/system-design/lessons/load-balancer' }),
      ),
      Command.resolve(SaveLocale, Message.CompletedSaveLocale()),
      Command.resolve(NavigateInternal, Message.CompletedNavigateInternal()),
    )
  })

  test('picking the current language saves it and stays on the page', () => {
    story(
      update,
      given(onLesson('ru')),
      message(
        Message.GotLanguageMenuMessage({
          message: Menu.Message.SelectedItem({ index: 1, item: 'ru' }),
        }),
      ),
      Command.expectHas(SaveLocale({ locale: 'ru' })),
      Command.expectExact(SaveLocale),
      Command.resolve(SaveLocale, Message.CompletedSaveLocale()),
    )
  })

  test('following a link to another language does not save it', () => {
    story(
      update,
      given(onLesson('ru')),
      message(
        Message.ChangedUrl({
          url: urlOf('/en/system-design/lessons/load-balancer'),
        }),
      ),
      model(next => {
        expect(next.route).toEqual(
          AppRoute.Lesson({
            locale: 'en',
            course: 'system-design',
            slug: 'load-balancer',
            step: Option.some(1),
          }),
        )
        expect(next.preferredLocale).toBe('en')
      }),
      Command.expectExact(ReplaceStepUrl),
      Command.resolve(ReplaceStepUrl, Message.CompletedReplaceStepUrl()),
    )
  })

  test('navigating within the same language does not save again', () => {
    story(
      update,
      given(onLesson('en')),
      message(Message.ChangedUrl({ url: urlOf('/en/') })),
      model(next => {
        expect(next.route).toEqual(AppRoute.Home({ locale: 'en' }))
      }),
      Command.expectNone(),
    )
  })
})

describe('old lesson addresses', () => {
  test('after the redirect the lesson opens on the same step', () => {
    story(
      update,
      given(
        init(flags('ru', ['ru-RU']), urlOf('/ru/lessons/caching?step=2')).model,
      ),
      message(
        Message.ChangedUrl({
          url: urlOf('/ru/system-design/lessons/caching?step=2'),
        }),
      ),
      model(next => {
        expect(next.route).toEqual(
          AppRoute.Lesson({
            locale: 'ru',
            course: 'system-design',
            slug: 'caching',
            step: Option.some(2),
          }),
        )
        expect(next.lessonSessions['system-design/caching']?.step).toBe(1)
      }),
      Command.expectExact(RevealLessonStep({ step: 1 })),
      Command.resolve(RevealLessonStep, Message.CompletedRevealLessonStep()),
    )
  })
})

describe('lesson sessions', () => {
  test('a solved task survives leaving the lesson and coming back', () => {
    const opened = init(
      flags('en', ['en-US']),
      urlOf('/en/system-design/lessons/load-balancer?step=4'),
    ).model
    const session = opened.lessonSessions[LOAD_BALANCER]
    const solved = Model.make({
      ...opened,
      lessonSessions: {
        [LOAD_BALANCER]: {
          ...session!,
          tasks: {
            'place-lb': {
              log: [],
              redo: [],
              attempts: 1,
              hintsShown: 0,
              check: Player.CheckState.Solved({ withHint: false }),
              maybeReplayIndex: Option.none(),
            },
          },
        },
      },
    })

    story(
      update,
      given(solved),
      message(Message.ChangedUrl({ url: urlOf('/en/') })),
      message(
        Message.ChangedUrl({
          url: urlOf('/en/system-design/lessons/load-balancer?step=6'),
        }),
      ),
      model(next => {
        const back = next.lessonSessions[LOAD_BALANCER]
        expect(back?.step).toBe(5)
        expect(back?.tasks['place-lb']?.check._tag).toBe('Solved')
      }),
      Command.expectExact(RevealLessonStep({ step: 5 })),
      Command.resolve(RevealLessonStep, Message.CompletedRevealLessonStep()),
    )
  })
})
