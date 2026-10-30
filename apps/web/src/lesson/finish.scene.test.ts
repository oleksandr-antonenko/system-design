import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  Mount,
  expect,
  given,
  role,
  scene,
  selector,
  text,
  within,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Board from '../board/board'
import { BoardPointer } from '../board/pointer'
import { lessonTextFor } from '../courses/assemble'
import { findLesson } from '../courses/registry'
import loadBalancer from '../courses/system-design/lessons/03-load-balancer/lesson'
import urlShortener from '../courses/system-design/lessons/13-url-shortener/lesson'
import type { FlowTypes } from '../kinds/types'
import type { LessonDefinition } from './dsl'
import * as Player from './player'
import { lessonView, loadedEntry } from './view'

// Конец урока: ссылка на следующий урок курса, а после последнего урока —
// конец курса и дорога к программе.

const COURSE = 'system-design'

const sceneFor = (lesson: LessonDefinition<FlowTypes>) => {
  const entry = Option.getOrThrow(loadedEntry(COURSE, lesson.slug))
  return {
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
  }
}

const pointerReady = Mount.resolve(
  BoardPointer,
  Board.Message.CancelledPointer(),
)

const atEnd = (lesson: LessonDefinition<FlowTypes>): Player.Model => ({
  ...Player.init(COURSE, lesson, 0),
  step: lesson.steps.length - 1,
})

describe('end of a lesson', () => {
  test('links to the next lesson of the course', () => {
    const next = Option.getOrThrow(findLesson(COURSE, 'caching'))
    scene(
      sceneFor(loadBalancer),
      given(atEnd(loadBalancer)),
      pointerReady,
      expect(text('Lesson complete')).toExist(),
      expect(
        role('link', {
          name: `Next lesson: ${lessonTextFor(next, 'en').text.title} →`,
        }),
      ).toHaveAttr('href', '/en/system-design/lessons/caching'),
    )
  })

  test('the last lesson of the course ends the course and leads back to the outline', () => {
    scene(
      sceneFor(urlShortener),
      given(atEnd(urlShortener)),
      pointerReady,
      expect(text('Course complete')).toExist(),
      expect(text('This was the last lesson of the course.')).toExist(),
      expect(role('link', { name: /^Next lesson/ })).not.toExist(),
      expect(
        within(
          selector('.finish'),
          role('link', { name: '← Back to the course outline' }),
        ),
      ).toHaveAttr('href', '/en/system-design/'),
    )
  })
})
