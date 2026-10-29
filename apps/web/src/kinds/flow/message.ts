import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import * as Board from '../../board/board'

// MESSAGE

export const Message = defineMessageUnion({
  GotEditorMessage: { message: Board.Message },
  ClickedPlayPause: {},
  ClickedSpeed: { speed: Schema.Number },
})
export type Message = typeof Message.Type
