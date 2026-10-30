import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Fault } from '../../../../net/model'

// MESSAGE

export const Message = defineMessageUnion({
  ToggledLine: { text: Schema.String, tag: Schema.String },
  SelectedFault: { fault: Fault },
  ClickedSend: {},
  ClickedApply: {},
  CompletedScrollToReply: {},
})
export type Message = typeof Message.Type
