import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

// Сообщения доски вида «сценарий». Поле страницы-двойника сообщает только
// «заполнено» или «пусто»: текст из поля в сообщение не попадает.

export const TrapField = Schema.Literals(['email', 'password'])
export type TrapField = typeof TrapField.Type

// MESSAGE

export const Message = defineMessageUnion({
  ClickedSign: {},
  ClickedCloseSign: {},
  UpdatedTrapField: { field: TrapField, isFilled: Schema.Boolean },
  ClickedTrapSkip: {},
  ClickedTrapLogin: {},
  ClickedSpot: { spot: Schema.String },
})
export type Message = typeof Message.Type
