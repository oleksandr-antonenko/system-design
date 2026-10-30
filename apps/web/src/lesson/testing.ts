import type { HtmlBuilder } from 'foldkit/html'

import type { LessonText } from '../courses/model'
import type { KindTypes } from '../kinds/contract'
import type { LessonDefinition } from './dsl'
import * as Player from './player'
import { type LessonEntry, lessonView } from './view'

// Уроки-образцы для сценарных тестов плеера: урок собран в самом тесте и
// не лежит в папке курса, поэтому не попадает ни в каталог, ни в программу.

/** Запись каталога для урока-образца: одна локаль, английский текст. */
export const fixtureEntry = (
  course: string,
  slug: string,
  text: LessonText,
): LessonEntry => ({
  course,
  meta: {
    course,
    slug,
    module: 'fixture',
    order: 99,
    available: true,
    locales: ['en'],
    unlocks: [],
  },
  texts: [{ locale: 'en', text }],
})

/** Плеер урока на английском: `update` и `view` для `scene`. */
export const playerScene = <T extends KindTypes>(
  lesson: LessonDefinition<T>,
  entry: LessonEntry,
) => ({
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(lesson)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      lesson,
      entry,
      playerModel,
      { locale: 'en', prefersDark: false },
      h,
    ),
})
