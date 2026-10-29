import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { Locale } from './locale'

export const DomainMessage = defineTaggedUnion({
  UnknownLesson: { slug: Schema.String },
  LessonNotTranslated: { shownIn: Locale },
})
export type DomainMessage = typeof DomainMessage.Type

type ParamsOf<Tag extends DomainMessage['_tag']> = Omit<
  Extract<DomainMessage, { _tag: Tag }>,
  '_tag'
>

export type DomainMessageTexts = Readonly<{
  [Tag in DomainMessage['_tag']]: (params: ParamsOf<Tag>) => string
}>

export const renderDomainMessage = (
  texts: DomainMessageTexts,
  message: DomainMessage,
): string =>
  DomainMessage.match(message, {
    UnknownLesson: params => texts.UnknownLesson(params),
    LessonNotTranslated: params => texts.LessonNotTranslated(params),
  })
