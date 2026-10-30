import { Effect, Option } from 'effect'
import { Runtime } from 'foldkit'

import { STACKED_QUERY } from './lesson/player'
import {
  DESKTOP_NOTICE_STORAGE_KEY,
  Flags,
  LOCALE_STORAGE_KEY,
  Message,
  Model,
  init,
  subscriptions,
  update,
} from './main'
import { view } from './view'

const readSavedLocale = Effect.try(() =>
  localStorage.getItem(LOCALE_STORAGE_KEY),
).pipe(
  Effect.map(Option.fromNullishOr),
  Effect.orElseSucceed(() => Option.none<string>()),
)

const readDesktopNoticeDismissed = Effect.try(
  () => localStorage.getItem(DESKTOP_NOTICE_STORAGE_KEY) !== null,
).pipe(Effect.orElseSucceed(() => false))

const readFlags = Effect.gen(function* () {
  const maybeSavedLocale = yield* readSavedLocale
  const browserLanguages = yield* Effect.sync(() =>
    navigator.languages.length > 0 ? navigator.languages : [navigator.language],
  )

  const prefersDark = yield* Effect.sync(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  const isStackedScreen = yield* Effect.sync(
    () => window.matchMedia(STACKED_QUERY).matches,
  )
  const isDesktopNoticeDismissed = yield* readDesktopNoticeDismissed

  return Flags.make({
    maybeSavedLocale,
    browserLanguages,
    prefersDark,
    isStackedScreen,
    isDesktopNoticeDismissed,
  })
})

const application = Runtime.makeApplication({
  Model,
  Flags,
  init,
  update,
  view,
  container: document.getElementById('root'),
  routing: {
    onUrlRequest: request => Message.ClickedLink({ request }),
    onUrlChange: url => Message.ChangedUrl({ url }),
  },
  subscriptions,
  devTools: {
    Message,
    excludeFromHistory: ['TickedAnimationFrame'],
  },
})

Runtime.run(application, { flags: readFlags })
