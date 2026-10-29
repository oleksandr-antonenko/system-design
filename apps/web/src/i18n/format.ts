import { type Locale, intlTag } from './locale'

const numberFormats: Readonly<Record<Locale, Intl.NumberFormat>> = {
  uk: new Intl.NumberFormat(intlTag.uk),
  ru: new Intl.NumberFormat(intlTag.ru),
  en: new Intl.NumberFormat(intlTag.en),
  lt: new Intl.NumberFormat(intlTag.lt),
}

export const formatNumber = (locale: Locale, value: number): string =>
  numberFormats[locale].format(value)
