import { type Array, Schema } from 'effect'

import type { Locale } from '../i18n/locale'
import type { LooseLessonTexts } from '../lesson/dsl'

// COURSE

export const BoardKindId = Schema.Literals(['flow', 'packet'])
export type BoardKindId = typeof BoardKindId.Type

export type CourseDefinition<
  Id extends string = string,
  Module extends string = string,
  Feature extends string = string,
> = Readonly<{
  id: Id
  /** Место курса в каталоге. */
  order: number
  board: BoardKindId
  modules: Array.NonEmptyReadonlyArray<Module>
  /** Элементы интерфейса, которые могут открыть уроки курса (`unlocks`). */
  features: ReadonlyArray<Feature>
  locales: Array.NonEmptyReadonlyArray<Locale>
}>

export const defineCourse = <
  const Id extends string,
  const Module extends string,
  const Feature extends string = never,
>(
  course: CourseDefinition<Id, Module, Feature>,
): CourseDefinition<Id, Module, Feature> => course

export type ModuleOf<Course extends CourseDefinition> =
  Course['modules'][number]

export type FeatureOf<Course extends CourseDefinition> =
  Course['features'][number]

/** Тексты курса на одном языке: `course.<locale>.ts`. */
export type CourseText<Course extends CourseDefinition = CourseDefinition> =
  Readonly<{
    title: string
    tagline: string
    modules: Readonly<Record<ModuleOf<Course>, string>>
  }>

// LESSON

export type LessonMeta<
  Module extends string = string,
  Feature extends string = string,
> = Readonly<{
  course: string
  slug: string
  module: Module
  order: number
  available: boolean
  locales: Array.NonEmptyReadonlyArray<Locale>
  /** Что нового в интерфейсе открывает урок (план, раздел 3.4). */
  unlocks: ReadonlyArray<Feature>
}>

export type LessonMetaFields<
  Module extends string,
  Feature extends string,
> = Readonly<{
  slug: string
  module: Module
  order: number
  available: boolean
  locales: Array.NonEmptyReadonlyArray<Locale>
  unlocks?: ReadonlyArray<Feature>
}>

/** Meta урока своего курса: модуль и `unlocks` проверяются по описанию курса. */
export const defineLessonMeta = <const Course extends CourseDefinition>(
  course: Course,
  meta: LessonMetaFields<ModuleOf<Course>, FeatureOf<Course>>,
): LessonMeta<ModuleOf<Course>, FeatureOf<Course>> => ({
  course: course.id,
  slug: meta.slug,
  module: meta.module,
  order: meta.order,
  available: meta.available,
  locales: meta.locales,
  unlocks: meta.unlocks ?? [],
})

export type LessonText = LooseLessonTexts
