import { Schema } from 'effect'

import { Locale } from '../i18n/locale'
import type { LooseLessonTexts } from '../lesson/dsl'

export const ModuleId = Schema.Literals([
  'foundations',
  'scaling',
  'distributed',
])
export type ModuleId = typeof ModuleId.Type

export const moduleOrder: ReadonlyArray<ModuleId> = ModuleId.literals

export const LessonMeta = Schema.Struct({
  slug: Schema.String,
  module: ModuleId,
  order: Schema.Number,
  available: Schema.Boolean,
  locales: Schema.NonEmptyArray(Locale),
})
export type LessonMeta = typeof LessonMeta.Type

export type LessonText = LooseLessonTexts

export const defineLessonMeta = (meta: LessonMeta): LessonMeta => meta
