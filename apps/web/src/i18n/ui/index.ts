import type { Locale } from '../locale'
import { en } from './en'
import { lt } from './lt'
import { ru } from './ru'
import type { UiStrings } from './types'
import { uk } from './uk'

export type { UiStrings } from './types'

export const uiStrings: Readonly<Record<Locale, UiStrings>> = { uk, ru, en, lt }

export const uiFor = (locale: Locale): UiStrings => uiStrings[locale]
