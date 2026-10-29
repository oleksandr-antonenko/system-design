import { Array, Effect, Option, Record, Schema, pipe } from 'effect'
import { Command, Dom, Runtime, Subscription, Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest, load, pushUrl, replaceUrl } from 'foldkit/navigation'
import { modifyFields } from 'foldkit/struct'
import { Url, toString as urlToString } from 'foldkit/url'

import { findDefinition, lessonKey } from './courses/registry'
import { Locale, isLocale, resolveLocale } from './i18n/locale'
import * as Player from './lesson/player'
import {
  AppRoute,
  lessonUrl,
  localeOf,
  localizedPath,
  urlForRoute,
  urlToAppRoute,
} from './route'

export { AppRoute } from './route'

// MODEL

export const Model = Schema.Struct({
  route: AppRoute,
  preferredLocale: Locale,
  maybeSavedLocale: Schema.Option(Locale),
  prefersDark: Schema.Boolean,
  lessonSessions: Schema.Record(Schema.String, Player.Model),
})
export type Model = typeof Model.Type

// FLAGS

export const Flags = Schema.Struct({
  maybeSavedLocale: Schema.Option(Schema.String),
  browserLanguages: Schema.Array(Schema.String),
  prefersDark: Schema.Boolean,
})
export type Flags = typeof Flags.Type

// MESSAGE

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  CompletedRedirectToLocale: {},
  CompletedRedirectToCourse: {},
  CompletedSaveLocale: {},
  CompletedReplaceStepUrl: {},
  CompletedRevealLessonStep: {},
  GotPlayerMessage: { message: Player.Message },
  TickedAnimationFrame: { deltaMs: Schema.Number },
  ChangedColorScheme: { prefersDark: Schema.Boolean },
})
export type Message = typeof Message.Type

// COMMAND

export const LOCALE_STORAGE_KEY = 'sd.locale'

export const NavigateInternal = Command.define('NavigateInternal', {
  args: { url: Schema.String },
  messages: [Message.CompletedNavigateInternal],
  execute: ({ url }) =>
    pushUrl(url).pipe(Effect.as(Message.CompletedNavigateInternal())),
})

export const LoadExternal = Command.define('LoadExternal', {
  args: { href: Schema.String },
  messages: [Message.CompletedLoadExternal],
  execute: ({ href }) =>
    load(href).pipe(Effect.as(Message.CompletedLoadExternal())),
})

export const RedirectToLocale = Command.define('RedirectToLocale', {
  args: { url: Schema.String },
  messages: [Message.CompletedRedirectToLocale],
  execute: ({ url }) =>
    replaceUrl(url).pipe(Effect.as(Message.CompletedRedirectToLocale())),
})

// Старый адрес урока `/:locale/lessons/:slug` ведёт в курс System Design
// с тем же шагом; запись в истории заменяется, «Назад» туда не вернёт.
export const RedirectToCourse = Command.define('RedirectToCourse', {
  args: { url: Schema.String },
  messages: [Message.CompletedRedirectToCourse],
  execute: ({ url }) =>
    replaceUrl(url).pipe(Effect.as(Message.CompletedRedirectToCourse())),
})

// Шаг уже записан в Model, поэтому адрес меняем тихо, без события смены
// адреса: иначе запоздавшее событие от быстрых «Далее» откатывало бы шаг.
export const ReplaceStepUrl = Command.define('ReplaceStepUrl', {
  args: { url: Schema.String },
  messages: [Message.CompletedReplaceStepUrl],
  execute: ({ url }) =>
    Effect.sync(() =>
      window.history.replaceState(window.history.state, '', url),
    ).pipe(Effect.as(Message.CompletedReplaceStepUrl())),
})

// Урок открыли по ссылке на шаг или вернулись к нему кнопками браузера:
// текст теории прокручивается к текущему шагу.
export const RevealLessonStep = Command.define('RevealLessonStep', {
  args: { step: Schema.Number },
  messages: [Message.CompletedRevealLessonStep],
  execute: ({ step }) =>
    Dom.scrollIntoViewAfterPaint(`[data-step="${step}"]`, {
      block: 'nearest',
    }).pipe(
      Effect.as(Message.CompletedRevealLessonStep()),
      Effect.catch(() => Effect.succeed(Message.CompletedRevealLessonStep())),
    ),
})

export const SaveLocale = Command.define('SaveLocale', {
  args: { locale: Locale },
  messages: [Message.CompletedSaveLocale],
  execute: ({ locale }) =>
    Effect.try(() => localStorage.setItem(LOCALE_STORAGE_KEY, locale)).pipe(
      Effect.as(Message.CompletedSaveLocale()),
      Effect.catch(() => Effect.succeed(Message.CompletedSaveLocale())),
    ),
})

// UPDATE

type UpdateReturn = Update.Return<Model, Message>

const searchSuffix = (url: Url): string =>
  Option.match(url.search, {
    onNone: () => '',
    onSome: search => `?${search}`,
  })

export const currentSession = (model: Model): Option.Option<Player.Model> =>
  AppRoute.match(model.route, {
    Lesson: ({ course, slug }) =>
      Record.get(model.lessonSessions, lessonKey(course, slug)),
    Home: () => Option.none(),
    Course: () => Option.none(),
    LegacyLesson: () => Option.none(),
    NotFound: () => Option.none(),
    Unlocalized: () => Option.none(),
  })

type LessonPlace = Readonly<{ locale: Locale; course: string; slug: string }>

const stepUrl = ({ locale, course, slug }: LessonPlace, step: number): string =>
  lessonUrl({ locale, course, slug, step: Option.some(step + 1) })

const enterLesson = (
  model: Model,
  place: LessonPlace,
  maybeRequestedStep: Option.Option<number>,
): UpdateReturn =>
  Option.match(findDefinition(place.course, place.slug), {
    onNone: () => ({ model }),
    onSome: lesson => {
      const key = lessonKey(place.course, place.slug)
      const requested = Option.map(maybeRequestedStep, step => step - 1)
      const maybeExisting = Record.get(model.lessonSessions, key)
      const session = Option.match(maybeExisting, {
        onNone: () =>
          Player.init(
            place.course,
            lesson,
            Option.getOrElse(requested, () => 0),
          ),
        onSome: existing =>
          Option.match(requested, {
            onNone: () => existing,
            onSome: step => Player.goToStep(lesson, existing, step).model,
          }),
      })
      const isCanonical = Option.exists(
        maybeRequestedStep,
        step => step === session.step + 1,
      )
      const isStepShown = Option.match(maybeExisting, {
        onNone: () => session.step === 0,
        onSome: existing => existing.step === session.step,
      })
      const commands = [
        ...(isCanonical
          ? []
          : [ReplaceStepUrl({ url: stepUrl(place, session.step) })]),
        ...(isStepShown ? [] : [RevealLessonStep({ step: session.step })]),
      ]
      return {
        model: modifyFields(model, {
          route: () =>
            AppRoute.Lesson({
              locale: place.locale,
              course: place.course,
              slug: place.slug,
              step: Option.some(session.step + 1),
            }),
          lessonSessions: sessions => Record.set(sessions, key, session),
        }),
        ...(Array.isReadonlyArrayNonEmpty(commands) ? { commands } : {}),
      }
    },
  })

const arriveAt = (model: Model, url: Url): UpdateReturn => {
  const route = urlToAppRoute(url)

  return Option.match(localeOf(route), {
    onNone: () => ({
      model: modifyFields(model, { route: () => route }),
      commands: [
        RedirectToLocale({
          url: `${localizedPath(model.preferredLocale, url.pathname)}${searchSuffix(url)}`,
        }),
      ],
    }),
    onSome: locale => {
      const routed = modifyFields(model, {
        route: () => route,
        preferredLocale: () => locale,
        maybeSavedLocale: () => Option.some(locale),
      })
      const isAlreadySaved = Option.exists(
        model.maybeSavedLocale,
        saved => saved === locale,
      )
      const lessonStep: UpdateReturn = AppRoute.match(route, {
        Lesson: ({ course, slug, step }) =>
          enterLesson(routed, { locale, course, slug }, step),
        LegacyLesson: () => ({
          model: routed,
          commands: [RedirectToCourse({ url: urlForRoute(route) })],
        }),
        Home: () => ({ model: routed }),
        Course: () => ({ model: routed }),
        NotFound: () => ({ model: routed }),
        Unlocalized: () => ({ model: routed }),
      })
      return isAlreadySaved
        ? lessonStep
        : {
            model: lessonStep.model,
            commands: [SaveLocale({ locale }), ...(lessonStep.commands ?? [])],
          }
    },
  })
}

const lessonPlaceOf = (model: Model): Option.Option<LessonPlace> =>
  AppRoute.match(model.route, {
    Lesson: ({ locale, course, slug }) => Option.some({ locale, course, slug }),
    Home: () => Option.none(),
    Course: () => Option.none(),
    LegacyLesson: () => Option.none(),
    NotFound: () => Option.none(),
    Unlocalized: () => Option.none(),
  })

const writeSession = (model: Model, nextSession: Player.Model): Model =>
  modifyFields(model, {
    lessonSessions: sessions =>
      Record.set(
        sessions,
        lessonKey(nextSession.course, nextSession.slug),
        nextSession,
      ),
  })

const foldPlayer = Update.foldChild({
  update: Player.update,
  read: currentSession,
  write: writeSession,
  toParentMessage: (message: Player.Message) =>
    Message.GotPlayerMessage({ message }),
  foldOutMessage: (outMessage: Player.OutMessage) => (model: Model) =>
    Player.OutMessage.match(outMessage, {
      ChangedStep: ({ step }) =>
        Option.match(lessonPlaceOf(model), {
          onNone: () => ({ model }),
          onSome: place => ({
            model: modifyFields(model, {
              route: () =>
                AppRoute.Lesson({
                  locale: place.locale,
                  course: place.course,
                  slug: place.slug,
                  step: Option.some(step + 1),
                }),
            }),
            commands: [ReplaceStepUrl({ url: stepUrl(place, step) })],
          }),
        }),
    }),
})

const advancePlayerFrame = (deltaMs: number) =>
  Update.foldChildStep({
    update: Player.advanceFrame(deltaMs),
    read: currentSession,
    write: writeSession,
    toParentMessage: (message: Player.Message) =>
      Message.GotPlayerMessage({ message }),
  })

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    ClickedLink: ({ request }) =>
      UrlRequest.match<UpdateReturn>(request, {
        Internal: ({ url }) => ({
          model,
          commands: [NavigateInternal({ url: urlToString(url) })],
        }),
        External: ({ href }) => ({
          model,
          commands: [LoadExternal({ href })],
        }),
      }),
    ChangedUrl: ({ url }) => arriveAt(model, url),
    CompletedNavigateInternal: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),
    CompletedRedirectToLocale: () => ({ model }),
    CompletedRedirectToCourse: () => ({ model }),
    CompletedSaveLocale: () => ({ model }),
    CompletedReplaceStepUrl: () => ({ model }),
    CompletedRevealLessonStep: () => ({ model }),
    GotPlayerMessage: ({ message: playerMessage }) =>
      foldPlayer(model, playerMessage),
    TickedAnimationFrame: ({ deltaMs }) => advancePlayerFrame(deltaMs)(model),
    ChangedColorScheme: ({ prefersDark }) => ({
      model: modifyFields(model, { prefersDark: () => prefersDark }),
    }),
  })

// INIT

export const init: Runtime.RoutingApplicationInit<Model, Message, Flags> = (
  flags,
  url,
) => {
  const maybeSavedLocale = Option.filter(flags.maybeSavedLocale, isLocale)
  const preferredLocale = resolveLocale({
    maybeSavedLocale: flags.maybeSavedLocale,
    browserLanguages: flags.browserLanguages,
  })

  return arriveAt(
    Model.make({
      route: AppRoute.Unlocalized({ path: url.pathname }),
      preferredLocale,
      maybeSavedLocale,
      prefersDark: flags.prefersDark,
      lessonSessions: {},
    }),
    url,
  )
}

// SUBSCRIPTION

const rootSubscriptions = Subscription.make<Model, Message>()(() => ({
  colorScheme: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-color-scheme: dark)',
      mapMatches: isMatching =>
        Message.ChangedColorScheme({ prefersDark: isMatching }),
    }),
  ),
  frames: Subscription.animationFrameEntry<Model, Message>({
    isActive: model => Option.isSome(currentSession(model)),
    toMessage: deltaMs => Message.TickedAnimationFrame({ deltaMs }),
  }),
}))

const playerSubscriptions = Subscription.lift(Player.subscriptions)<
  Model,
  Message
>({
  read: currentSession,
  toParentMessage: message => Message.GotPlayerMessage({ message }),
})

export const subscriptions = pipe(
  Subscription.aggregate(rootSubscriptions, playerSubscriptions),
)
