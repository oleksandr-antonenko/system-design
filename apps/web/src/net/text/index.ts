import { type Locale } from '../../i18n/locale'
import { type NetMessage } from '../message'
import { type DeviceId } from '../model'
import { en } from './en'
import { lt } from './lt'
import { ru } from './ru'
import { type NetMessageOf, type NetTexts, type TextContext } from './types'
import { uk } from './uk'

export type { NetTexts, TextContext } from './types'

/** Тексты кодов модели пакетов на четырёх языках. */
export const netTexts: Readonly<Record<Locale, NetTexts>> = { uk, ru, en, lt }

const renderTagged = <Tag extends keyof NetMessageOf>(
  texts: NetTexts,
  tag: Tag,
  message: NetMessageOf[Tag],
  context: TextContext,
): string => texts[tag](message, context)

/** Текст кода на языке страницы. `name` — подпись устройства на доске
    (по умолчанию его id). */
export const renderNetMessage = (
  locale: Locale,
  message: NetMessage,
  name: (id: DeviceId) => string = id => id,
): string => renderTagged(netTexts[locale], message._tag, message, { name })
