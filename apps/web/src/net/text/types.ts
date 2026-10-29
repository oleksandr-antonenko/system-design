import { type NetMessage } from '../message'
import { type DeviceId } from '../model'

/** Что тексту нужно кроме параметров кода: подпись устройства на доске
    вместо его id. */
export type TextContext = Readonly<{
  name: (id: DeviceId) => string
}>

/** Код сообщения по его тегу. */
export type NetMessageOf = {
  readonly [M in NetMessage as M['_tag']]: M
}

/** По функции на каждый код: пропуск кода не компилируется. */
export type NetTexts = {
  readonly [Tag in keyof NetMessageOf]: (
    message: NetMessageOf[Tag],
    context: TextContext,
  ) => string
}
