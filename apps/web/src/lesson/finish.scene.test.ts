import { Array, Option } from 'effect'
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
import { type Course, courseTextFor, lessonTextFor } from '../courses/assemble'
import { findCourse, findLesson } from '../courses/registry'
import loadBalancer from '../courses/system-design/lessons/03-load-balancer/lesson'
import urlShortener from '../courses/system-design/lessons/13-url-shortener/lesson'
import type { FlowTypes } from '../kinds/types'
import type { LessonDefinition } from './dsl'
import * as Player from './player'
import { lessonView, loadedEntry } from './view'

// Конец урока: кнопка к следующему открытому уроку курса (уроки «Скоро»
// пропускаются). Когда открытых уроков в курсе не осталось — курс пройден,
// карточка следующего курса каталога (по кругу, но не текущего) и ссылка на
// программу курса.

const COURSE = 'system-design'

const systemDesign = Option.getOrThrow(findCourse(COURSE))
const networks = Option.getOrThrow(findCourse('networks'))

/** Курс, где уроки из `closed` ещё «Скоро». */
const withClosed = (course: Course, closed: ReadonlyArray<string>): Course => ({
  ...course,
  lessons: Array.map(course.lessons, lesson =>
    closed.includes(lesson.meta.slug)
      ? { ...lesson, meta: { ...lesson.meta, available: false } }
      : lesson,
  ),
})

const allClosed = (course: Course): Course =>
  withClosed(
    course,
    Array.map(course.lessons, lesson => lesson.meta.slug),
  )

/** System Design up to url-shortener: lessons after it (if a build has any)
    are closed, so url-shortener is the last open one. */
const throughUrlShortener = (): Course =>
  withClosed(
    systemDesign,
    Array.map(
      Array.filter(systemDesign.lessons, lesson => lesson.meta.order > 13),
      lesson => lesson.meta.slug,
    ),
  )

const sceneFor = (
  lesson: LessonDefinition<FlowTypes>,
  catalogue?: ReadonlyArray<Course>,
) => {
  const entry = Option.getOrThrow(loadedEntry(COURSE, lesson.slug))
  return {
    update: (playerModel: Player.Model, playerMessage: Player.Message) =>
      Player.updateWith(lesson)(playerModel, playerMessage),
    view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
      lessonView(
        lesson,
        entry,
        playerModel,
        { locale: 'en', prefersDark: false, catalogue },
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

const nextLessonName = (slug: string): string =>
  `Next lesson: ${lessonTextFor(Option.getOrThrow(findLesson(COURSE, slug)), 'en').text.title} →`

const networksText = courseTextFor(networks, 'en').text

const finish = (inner: ReturnType<typeof role>) =>
  within(selector('.finish'), inner)

describe('end of a lesson', () => {
  test('offers the next lesson of the course as a button', () => {
    scene(
      sceneFor(loadBalancer),
      given(atEnd(loadBalancer)),
      pointerReady,
      expect(text('Lesson complete')).toExist(),
      expect(role('link', { name: nextLessonName('caching') })).toHaveAttr(
        'href',
        '/en/system-design/lessons/caching',
      ),
      expect(role('link', { name: nextLessonName('caching') })).toHaveClass(
        'primary',
      ),
      expect(role('region', { name: 'Next course' })).not.toExist(),
    )
  })

  test('skips lessons that are not available yet', () => {
    scene(
      sceneFor(loadBalancer, [
        withClosed(systemDesign, ['caching', 'cdn']),
        networks,
      ]),
      given(atEnd(loadBalancer)),
      pointerReady,
      expect(role('link', { name: /^Next lesson/ })).toHaveAttr(
        'href',
        '/en/system-design/lessons/read-replicas',
      ),
      expect(role('link', { name: nextLessonName('caching') })).not.toExist(),
    )
  })

  test('when only unavailable lessons follow, the course is complete for now and the next course is offered', () => {
    const later = Array.map(
      Array.filter(systemDesign.lessons, lesson => lesson.meta.order > 3),
      lesson => lesson.meta.slug,
    )
    scene(
      sceneFor(loadBalancer, [withClosed(systemDesign, later), networks]),
      given(atEnd(loadBalancer)),
      pointerReady,
      expect(role('link', { name: /^Next lesson/ })).not.toExist(),
      expect(text('Course complete')).toExist(),
      expect(
        text('You have completed every available lesson of this course.'),
      ).toExist(),
      expect(
        within(
          role('region', { name: 'Next course' }),
          role('link', { name: 'Go to the course →' }),
        ),
      ).toHaveAttr('href', '/en/networks/'),
    )
  })

  test('the last lesson offers the next course of the catalogue', () => {
    scene(
      sceneFor(urlShortener, [throughUrlShortener(), networks]),
      given(atEnd(urlShortener)),
      pointerReady,
      expect(text('Course complete')).toExist(),
      expect(role('link', { name: /^Next lesson/ })).not.toExist(),
      expect(
        within(
          role('region', { name: 'Next course' }),
          text(networksText.title),
        ),
      ).toExist(),
      expect(
        within(
          role('region', { name: 'Next course' }),
          text(networksText.tagline),
        ),
      ).toExist(),
      expect(
        within(
          role('region', { name: 'Next course' }),
          role('link', { name: 'Go to the course →' }),
        ),
      ).toHaveAttr('href', '/en/networks/'),
      expect(
        finish(role('link', { name: '← Back to the course outline' })),
      ).toHaveAttr('href', '/en/system-design/'),
    )
  })

  test('the catalogue order wraps around to an earlier course', () => {
    scene(
      sceneFor(urlShortener, [networks, throughUrlShortener()]),
      given(atEnd(urlShortener)),
      pointerReady,
      expect(
        within(
          role('region', { name: 'Next course' }),
          role('link', { name: 'Go to the course →' }),
        ),
      ).toHaveAttr('href', '/en/networks/'),
    )
  })

  test('a course without available lessons is not offered', () => {
    scene(
      sceneFor(urlShortener, [throughUrlShortener(), allClosed(networks)]),
      given(atEnd(urlShortener)),
      pointerReady,
      expect(role('region', { name: 'Next course' })).not.toExist(),
      expect(
        finish(role('link', { name: '← Back to the course outline' })),
      ).toExist(),
    )
  })

  test('with a single course only the course outline is offered', () => {
    scene(
      sceneFor(urlShortener, [throughUrlShortener()]),
      given(atEnd(urlShortener)),
      pointerReady,
      expect(text('Course complete')).toExist(),
      expect(role('region', { name: 'Next course' })).not.toExist(),
      expect(role('link', { name: 'Go to the course →' })).not.toExist(),
      expect(
        finish(role('link', { name: '← Back to the course outline' })),
      ).toHaveAttr('href', '/en/system-design/'),
    )
  })
})
