import { Array, Effect, Option, Record, Schema, pipe } from 'effect'
import { Command, Dom, Runtime, Subscription, Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest, load, pushUrl, replaceUrl } from 'foldkit/navigation'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'
import { Url, toString as urlToString } from 'foldkit/url'

import { Dialog } from '@foldkit/ui'
import * as Menu from '@foldkit/ui/menu'

import {
  courseRecommendsDesktop,
  findDefinition,
  findLesson,
  isLessonLoaded,
  lessonKey,
  loadLesson,
} from './courses/registry'
import { Locale, resolveLocale } from './i18n/locale'
import * as Player from './lesson/player'
import {
  AppRoute,
  lessonUrl,
  localeOf,
  localizedPath,
  routeInLocale,
  urlForRoute,
  urlToAppRoute,
} from './route'

export { AppRoute } from './route'

// MODEL

/** A lesson whose script and texts are still on their way, or did not come. */
export const LessonLoad = defineTaggedUnion({
  Loading: {},
  Failed: {},
})
export type LessonLoad = typeof LessonLoad.Type

/** «These lessons are better on a computer», said once on a phone in a
    course that recommends a computer (`defineCourse({ recommendsDesktop })`).
    `isDismissed` comes from the browser's storage at start, so a closed notice
    never shows again in that browser, in either course. */
export const DesktopNotice = Schema.Struct({
  isDismissed: Schema.Boolean,
  isStackedScreen: Schema.Boolean,
  dialog: Dialog.Model,
})
export type DesktopNotice = typeof DesktopNotice.Type

export const DESKTOP_NOTICE_ID = 'desktop-notice'

export const initialDesktopNotice = (
  config: Readonly<{ isDismissed: boolean; isStackedScreen: boolean }> = {
    isDismissed: false,
    isStackedScreen: false,
  },
): DesktopNotice => ({
  isDismissed: config.isDismissed,
  isStackedScreen: config.isStackedScreen,
  dialog: Dialog.init({ id: DESKTOP_NOTICE_ID }),
})

export const Model = Schema.Struct({
  route: AppRoute,
  preferredLocale: Locale,
  languageMenu: Menu.Model,
  prefersDark: Schema.Boolean,
  lessonSessions: Schema.Record(Schema.String, Player.Model),
  /** Lessons being loaded, by `lessonKey`; a loaded lesson is not listed. */
  lessonLoads: Schema.Record(Schema.String, LessonLoad),
  desktopNotice: DesktopNotice,
})
export type Model = typeof Model.Type

/** The header's language menu: a button with the current language that opens
    the list of all four. */
export const LanguageMenu = Menu.create<Locale>()

export const initialLanguageMenu = (): Menu.Model =>
  Menu.init({ id: 'language-menu' })

// FLAGS

export const Flags = Schema.Struct({
  maybeSavedLocale: Schema.Option(Schema.String),
  browserLanguages: Schema.Array(Schema.String),
  prefersDark: Schema.Boolean,
  isStackedScreen: Schema.Boolean,
  isDesktopNoticeDismissed: Schema.Boolean,
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
  GotLanguageMenuMessage: { message: Menu.Message },
  TickedAnimationFrame: { deltaMs: Schema.Number },
  ChangedColorScheme: { prefersDark: Schema.Boolean },
  SucceededLoadLesson: { course: Schema.String, slug: Schema.String },
  FailedLoadLesson: { course: Schema.String, slug: Schema.String },
  ClickedRetryLessonLoad: {},
  ChangedStackedScreen: { isStacked: Schema.Boolean },
  GotDesktopNoticeMessage: { message: Dialog.Message },
  CompletedSaveDesktopNoticeDismissed: {},
})
export type Message = typeof Message.Type

// COMMAND

export const LOCALE_STORAGE_KEY = 'sd.locale'
export const DESKTOP_NOTICE_STORAGE_KEY = 'sd.desktop-notice-dismissed'

export const SaveDesktopNoticeDismissed = Command.define(
  'SaveDesktopNoticeDismissed',
  {
    messages: [Message.CompletedSaveDesktopNoticeDismissed],
    execute: Effect.try(() =>
      localStorage.setItem(DESKTOP_NOTICE_STORAGE_KEY, '1'),
    ).pipe(
      Effect.as(Message.CompletedSaveDesktopNoticeDismissed()),
      Effect.catch(() =>
        Effect.succeed(Message.CompletedSaveDesktopNoticeDismissed()),
      ),
    ),
  },
)

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

// Сценарий и тексты урока — отдельный файл сборки; он загружается, когда
// урок открывают, и дальше доступен из реестра синхронно.
export const LoadLesson = Command.define('LoadLesson', {
  args: { course: Schema.String, slug: Schema.String },
  messages: [Message.SucceededLoadLesson, Message.FailedLoadLesson],
  execute: ({ course, slug }) =>
    loadLesson(course, slug).pipe(
      Effect.as(Message.SucceededLoadLesson({ course, slug })),
      Effect.catch(() =>
        Effect.succeed(Message.FailedLoadLesson({ course, slug })),
      ),
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

const openSession = (
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
          Player.initLesson(
            place.course,
            lesson,
            Option.getOrElse(requested, () => 0),
          ),
        onSome: existing =>
          Option.match(requested, {
            onNone: () => existing,
            onSome: step => Player.goToLessonStep(lesson, existing, step).model,
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

const startLoading = (model: Model, place: LessonPlace): UpdateReturn => {
  const key = lessonKey(place.course, place.slug)
  const isLoading = Option.exists(
    Record.get(model.lessonLoads, key),
    load => load._tag === 'Loading',
  )
  return isLoading
    ? { model }
    : {
        model: modifyFields(model, {
          lessonLoads: loads => Record.set(loads, key, LessonLoad.Loading()),
        }),
        commands: [LoadLesson({ course: place.course, slug: place.slug })],
      }
}

/** Opens the lesson of the route: at once when it is loaded, otherwise once
    its file has come. */
const enterLesson = (
  model: Model,
  place: LessonPlace,
  maybeRequestedStep: Option.Option<number>,
): UpdateReturn => {
  if (Option.isNone(findLesson(place.course, place.slug))) {
    return { model }
  }
  return isLessonLoaded(place.course, place.slug)
    ? openSession(model, place, maybeRequestedStep)
    : startLoading(model, place)
}

type LessonRoute = LessonPlace & Readonly<{ step: Option.Option<number> }>

const lessonRouteOf = (route: AppRoute): Option.Option<LessonRoute> =>
  AppRoute.match(route, {
    Lesson: ({ locale, course, slug, step }) =>
      Option.some({ locale, course, slug, step }),
    Home: () => Option.none(),
    Course: () => Option.none(),
    LegacyLesson: () => Option.none(),
    NotFound: () => Option.none(),
    Unlocalized: () => Option.none(),
  })

const isRouteOf = (
  model: Model,
  course: string,
  slug: string,
): Option.Option<LessonRoute> =>
  Option.filter(
    lessonRouteOf(model.route),
    place => place.course === course && place.slug === slug,
  )

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
      })
      return AppRoute.match<UpdateReturn>(route, {
        Lesson: ({ course, slug, step }) =>
          Update.combine(routed, [
            stepModel => enterLesson(stepModel, { locale, course, slug }, step),
            offerDesktopNotice,
          ]),
        LegacyLesson: () => ({
          model: routed,
          commands: [RedirectToCourse({ url: urlForRoute(route) })],
        }),
        Home: () => ({ model: routed }),
        Course: () => ({ model: routed }),
        NotFound: () => ({ model: routed }),
        Unlocalized: () => ({ model: routed }),
      })
    },
  })
}

/** The student picked a language in the header menu: the choice is saved, so
    it wins over the browser's languages next time, and the same page opens
    in that language. */
const chooseLocale = (model: Model, locale: Locale): UpdateReturn => {
  const isCurrent = Option.exists(
    localeOf(model.route),
    current => current === locale,
  )
  return {
    model,
    commands: [
      SaveLocale({ locale }),
      ...(isCurrent
        ? []
        : [
            NavigateInternal({
              url: urlForRoute(routeInLocale(model.route, locale)),
            }),
          ]),
    ],
  }
}

const foldLanguageMenu = Update.foldChild({
  update: LanguageMenu.update,
  read: (model: Model) => Option.some(model.languageMenu),
  write: (model: Model, nextLanguageMenu: Menu.Model) =>
    modifyFields(model, { languageMenu: () => nextLanguageMenu }),
  toParentMessage: (message: Menu.Message) =>
    Message.GotLanguageMenuMessage({ message }),
  foldOutMessage: (outMessage: Menu.OutMessage<Locale>) => (model: Model) =>
    chooseLocale(model, outMessage.value),
})

const writeDesktopNoticeDialog = (model: Model, nextDialog: Dialog.Model) =>
  modifyFields(model, {
    desktopNotice: notice => modifyFields(notice, { dialog: () => nextDialog }),
  })

const foldDesktopNotice = Update.foldChild({
  update: Dialog.update,
  read: (model: Model) => Option.some(model.desktopNotice.dialog),
  write: writeDesktopNoticeDialog,
  toParentMessage: (message: Dialog.Message) =>
    Message.GotDesktopNoticeMessage({ message }),
  foldOutMessage: (outMessage: Dialog.OutMessage) => (model: Model) =>
    Dialog.OutMessage.match(outMessage, {
      Opened: () => ({ model }),
      Closed: () => ({
        model: modifyFields(model, {
          desktopNotice: notice =>
            modifyFields(notice, { isDismissed: () => true }),
        }),
        commands: [SaveDesktopNoticeDismissed()],
      }),
    }),
})

const openDesktopNotice = Update.foldChildStep({
  update: Dialog.open,
  read: (model: Model) => Option.some(model.desktopNotice.dialog),
  write: writeDesktopNoticeDialog,
  toParentMessage: (message: Dialog.Message) =>
    Message.GotDesktopNoticeMessage({ message }),
  foldOutMessage: () => (model: Model) => ({ model }),
})

/** On a phone, in a lesson of a course that recommends a computer, the
    notice opens unless it was closed before. */
export const isDesktopNoticeDue = (model: Model): boolean =>
  model.desktopNotice.isStackedScreen &&
  !model.desktopNotice.isDismissed &&
  !model.desktopNotice.dialog.isOpen &&
  Option.exists(lessonRouteOf(model.route), place =>
    courseRecommendsDesktop(place.course),
  )

const offerDesktopNotice = (model: Model): UpdateReturn =>
  isDesktopNoticeDue(model) ? openDesktopNotice(model) : { model }

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
    GotLanguageMenuMessage: ({ message: menuMessage }) =>
      foldLanguageMenu(model, menuMessage),
    TickedAnimationFrame: ({ deltaMs }) => advancePlayerFrame(deltaMs)(model),
    ChangedColorScheme: ({ prefersDark }) => ({
      model: modifyFields(model, { prefersDark: () => prefersDark }),
    }),
    SucceededLoadLesson: ({ course, slug }) => {
      const loaded = modifyFields(model, {
        lessonLoads: loads => Record.remove(loads, lessonKey(course, slug)),
      })
      return Option.match(isRouteOf(loaded, course, slug), {
        onNone: () => ({ model: loaded }),
        onSome: place => enterLesson(loaded, place, place.step),
      })
    },
    FailedLoadLesson: ({ course, slug }) => ({
      model: modifyFields(model, {
        lessonLoads: loads =>
          Record.set(loads, lessonKey(course, slug), LessonLoad.Failed()),
      }),
    }),
    ChangedStackedScreen: ({ isStacked }) =>
      offerDesktopNotice(
        modifyFields(model, {
          desktopNotice: notice =>
            modifyFields(notice, { isStackedScreen: () => isStacked }),
        }),
      ),
    GotDesktopNoticeMessage: ({ message: dialogMessage }) =>
      foldDesktopNotice(model, dialogMessage),
    CompletedSaveDesktopNoticeDismissed: () => ({ model }),
    ClickedRetryLessonLoad: () =>
      Option.match(lessonRouteOf(model.route), {
        onNone: () => ({ model }),
        onSome: place =>
          startLoading(
            modifyFields(model, {
              lessonLoads: loads =>
                Record.remove(loads, lessonKey(place.course, place.slug)),
            }),
            place,
          ),
      }),
  })

// INIT

export const init: Runtime.RoutingApplicationInit<Model, Message, Flags> = (
  flags,
  url,
) => {
  const preferredLocale = resolveLocale({
    maybeSavedLocale: flags.maybeSavedLocale,
    browserLanguages: flags.browserLanguages,
  })

  return arriveAt(
    Model.make({
      route: AppRoute.Unlocalized({ path: url.pathname }),
      preferredLocale,
      languageMenu: initialLanguageMenu(),
      prefersDark: flags.prefersDark,
      lessonSessions: {},
      lessonLoads: {},
      desktopNotice: initialDesktopNotice({
        isDismissed: flags.isDesktopNoticeDismissed,
        isStackedScreen: flags.isStackedScreen,
      }),
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
  desktopNoticeScreen: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: Player.STACKED_QUERY,
      mapMatches: isMatching =>
        Message.ChangedStackedScreen({ isStacked: isMatching }),
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
