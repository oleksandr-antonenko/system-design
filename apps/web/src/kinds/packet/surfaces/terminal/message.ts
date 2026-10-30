import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

// MESSAGE

export const Message = defineMessageUnion({
  UpdatedDraft: { value: Schema.String },
  SubmittedLine: {},
  PressedInterrupt: {},
  PressedRecall: { direction: Schema.Literals(['Older', 'Newer']) },
  ClickedSuggestion: { command: Schema.String },
  CompletedFocusInput: {},
})
export type Message = typeof Message.Type
