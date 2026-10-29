import { type Locale, intlTag } from './locale'

type SlavicOrBalticForms = Readonly<{
  one: string
  few: string
  many: string
  other: string
}>

type EnglishForms = Readonly<{ one: string; other: string }>

export type PluralForms<L extends Locale> = L extends 'en'
  ? EnglishForms
  : SlavicOrBalticForms

const pluralRules: Readonly<Record<Locale, Intl.PluralRules>> = {
  uk: new Intl.PluralRules(intlTag.uk),
  ru: new Intl.PluralRules(intlTag.ru),
  en: new Intl.PluralRules(intlTag.en),
  lt: new Intl.PluralRules(intlTag.lt),
}

export const plural = <L extends Locale>(
  locale: L,
  count: number,
  forms: PluralForms<L>,
): string => {
  const formsByCategory: Readonly<Record<string, string>> = forms
  const category = pluralRules[locale].select(count)

  return formsByCategory[category] ?? forms.other
}
