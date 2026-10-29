import { type Locale, intlTag } from './locale'

const numberFormats: Readonly<Record<Locale, Intl.NumberFormat>> = {
  uk: new Intl.NumberFormat(intlTag.uk),
  ru: new Intl.NumberFormat(intlTag.ru),
  en: new Intl.NumberFormat(intlTag.en),
  lt: new Intl.NumberFormat(intlTag.lt),
}

// В украинской, русской и литовской типографике четырёхзначные числа
// пишутся без пробела (1600), а разряды отделяются с пяти знаков (12 500).
// Так числа из симуляции совпадают с числами, написанными в тексте урока.
const ungroupedFormats: Readonly<Record<Locale, Intl.NumberFormat>> = {
  uk: new Intl.NumberFormat(intlTag.uk, { useGrouping: false }),
  ru: new Intl.NumberFormat(intlTag.ru, { useGrouping: false }),
  en: new Intl.NumberFormat(intlTag.en),
  lt: new Intl.NumberFormat(intlTag.lt, { useGrouping: false }),
}

export const formatNumber = (locale: Locale, value: number): string =>
  (Math.abs(value) < 10000 ? ungroupedFormats : numberFormats)[locale].format(
    value,
  )
