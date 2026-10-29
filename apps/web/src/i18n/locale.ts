import { Array, Option, Schema, String, pipe } from 'effect'

export const Locale = Schema.Literals(['uk', 'ru', 'en', 'lt'])
export type Locale = typeof Locale.Type

export const locales: ReadonlyArray<Locale> = Locale.literals

export const DEFAULT_LOCALE: Locale = 'en'

export const isLocale = Schema.is(Locale)

export const localeEndonym: Readonly<Record<Locale, string>> = {
  uk: 'Українська',
  ru: 'Русский',
  en: 'English',
  lt: 'Lietuvių',
}

export const intlTag: Readonly<Record<Locale, string>> = {
  uk: 'uk-UA',
  ru: 'ru-RU',
  en: 'en-US',
  lt: 'lt-LT',
}

const primarySubtag = (languageTag: string): string =>
  pipe(languageTag, String.toLowerCase, String.split('-'), Array.headNonEmpty)

export const localeFromLanguageTag = (
  languageTag: string,
): Option.Option<Locale> =>
  Option.liftPredicate(primarySubtag(languageTag), isLocale)

export type LocaleSources = Readonly<{
  maybeSavedLocale: Option.Option<string>
  browserLanguages: ReadonlyArray<string>
}>

export const resolveLocale = ({
  maybeSavedLocale,
  browserLanguages,
}: LocaleSources): Locale =>
  pipe(
    maybeSavedLocale,
    Option.filter(isLocale),
    Option.orElse(() =>
      Array.head(
        Array.getSomes(Array.map(browserLanguages, localeFromLanguageTag)),
      ),
    ),
    Option.getOrElse(() => DEFAULT_LOCALE),
  )
