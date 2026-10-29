import { Effect, Option, Schema } from 'effect'
import { Command, Runtime, Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest, load, pushUrl, replaceUrl } from 'foldkit/navigation'
import { modifyFields } from 'foldkit/struct'
import { Url, toString as urlToString } from 'foldkit/url'

import { Locale, isLocale, resolveLocale } from './i18n/locale'
import { AppRoute, localeOf, localizedPath, urlToAppRoute } from './route'

export { AppRoute } from './route'

// MODEL

export const Model = Schema.Struct({
  route: AppRoute,
  preferredLocale: Locale,
  maybeSavedLocale: Schema.Option(Locale),
})
export type Model = typeof Model.Type

// FLAGS

export const Flags = Schema.Struct({
  maybeSavedLocale: Schema.Option(Schema.String),
  browserLanguages: Schema.Array(Schema.String),
})
export type Flags = typeof Flags.Type

// MESSAGE

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  CompletedRedirectToLocale: {},
  CompletedSaveLocale: {},
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
      const nextModel = modifyFields(model, {
        route: () => route,
        preferredLocale: () => locale,
        maybeSavedLocale: () => Option.some(locale),
      })
      const isAlreadySaved = Option.exists(
        model.maybeSavedLocale,
        saved => saved === locale,
      )

      return isAlreadySaved
        ? { model: nextModel }
        : { model: nextModel, commands: [SaveLocale({ locale })] }
    },
  })
}

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
    CompletedSaveLocale: () => ({ model }),
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
    }),
    url,
  )
}
