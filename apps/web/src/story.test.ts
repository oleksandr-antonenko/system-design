import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { fromString } from 'foldkit/url'
import { describe, expect, test } from 'vitest'

import * as Player from './lesson/player'
import {
  AppRoute,
  Flags,
  Message,
  Model,
  RedirectToLocale,
  ReplaceStepUrl,
  SaveLocale,
  init,
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

const emptyOutcome: Player.Outcome = {
  errorRate: 0,
  p95: Option.none(),
  serverUtilization: [],
  costPerHour: 0,
}

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

    expect(result.model.maybeSavedLocale).toEqual(Option.none())
    expect(describeCommands(result.commands)).toEqual(
      describeCommands([RedirectToLocale({ url: '/lt/' })]),
    )
  })

  test('opening a prefixed page saves its language', () => {
    const result = init(
      flags('ru', ['ru-RU']),
      urlOf('/en/lessons/load-balancer'),
    )

    expect(result.model.route).toEqual(
      AppRoute.Lesson({
        locale: 'en',
        slug: 'load-balancer',
        step: Option.none(),
      }),
    )
    expect(describeCommands(result.commands)).toEqual(
      describeCommands([
        SaveLocale({ locale: 'en' }),
        ReplaceStepUrl({ url: '/en/lessons/load-balancer?step=1' }),
      ]),
    )
    expect(result.model.lessonSessions['load-balancer']?.step).toBe(0)
  })

  test('a requested step beyond an unsolved task is clamped to the task', () => {
    const result = init(
      flags('en', ['en-US']),
      urlOf('/en/lessons/load-balancer?step=6'),
    )

    expect(result.model.lessonSessions['load-balancer']?.step).toBe(3)
    expect(describeCommands(result.commands)).toEqual(
      describeCommands([
        ReplaceStepUrl({ url: '/en/lessons/load-balancer?step=4' }),
      ]),
    )
  })

  test('a canonical step url is not rewritten', () => {
    const result = init(
      flags('en', ['en-US']),
      urlOf('/en/lessons/load-balancer?step=2'),
    )

    expect(result.model.lessonSessions['load-balancer']?.step).toBe(1)
    expect(describeCommands(result.commands)).toEqual([])
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
      slug: 'load-balancer',
      step: Option.none(),
    }),
    preferredLocale: locale,
    maybeSavedLocale: Option.some(locale),
    prefersDark: false,
    lessonSessions: {},
  })

describe('update', () => {
  test('switching language moves to the same lesson and saves the choice', () => {
    story(
      update,
      given(onLesson('ru')),
      message(Message.ChangedUrl({ url: urlOf('/en/lessons/load-balancer') })),
      model(next => {
        expect(next.route).toEqual(
          AppRoute.Lesson({
            locale: 'en',
            slug: 'load-balancer',
            step: Option.none(),
          }),
        )
        expect(next.maybeSavedLocale).toEqual(Option.some('en'))
      }),
      Command.expectHas(SaveLocale({ locale: 'en' })),
      Command.resolve(SaveLocale, Message.CompletedSaveLocale()),
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

describe('lesson sessions', () => {
  test('a solved task survives leaving the lesson and coming back', () => {
    const opened = init(
      flags('en', ['en-US']),
      urlOf('/en/lessons/load-balancer?step=4'),
    ).model
    const session = opened.lessonSessions['load-balancer']
    const solved = Model.make({
      ...opened,
      lessonSessions: {
        'load-balancer': {
          ...session!,
          tasks: {
            'place-lb': {
              log: [],
              redo: [],
              attempts: 1,
              hintsShown: 0,
              check: Player.CheckState.Solved({
                withHint: false,
                before: emptyOutcome,
                after: emptyOutcome,
              }),
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
        Message.ChangedUrl({ url: urlOf('/en/lessons/load-balancer?step=6') }),
      ),
      model(next => {
        const back = next.lessonSessions['load-balancer']
        expect(back?.step).toBe(5)
        expect(back?.tasks['place-lb']?.check._tag).toBe('Solved')
      }),
    )
  })
})
