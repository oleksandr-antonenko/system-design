import { Effect, Option } from 'effect'
import { Runtime } from 'foldkit'

import { Flags, LOCALE_STORAGE_KEY, Message, Model, init, update } from './main'
import { view } from './view'

const readSavedLocale = Effect.try(() =>
  localStorage.getItem(LOCALE_STORAGE_KEY),
).pipe(
  Effect.map(Option.fromNullishOr),
  Effect.orElseSucceed(() => Option.none<string>()),
)

const readFlags = Effect.gen(function* () {
  const maybeSavedLocale = yield* readSavedLocale
  const browserLanguages = yield* Effect.sync(() =>
    navigator.languages.length > 0 ? navigator.languages : [navigator.language],
  )

  return Flags.make({ maybeSavedLocale, browserLanguages })
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
  devTools: {
    Message,
  },
})

Runtime.run(application, { flags: readFlags })
