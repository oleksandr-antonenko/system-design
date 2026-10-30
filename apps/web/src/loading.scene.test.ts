import { Option } from 'effect'
import { Effect } from 'effect'
import { Command, click, expect, given, role, scene } from 'foldkit/scene'
import { afterEach, describe, test } from 'vitest'

import { forgetLoadedLesson, loadLesson } from './courses/registry'
import {
  AppRoute,
  LessonLoad,
  LoadLesson,
  Message,
  Model,
  initialLanguageMenu,
  update,
} from './main'
import { view } from './view'

const COURSE = 'networks'
const SLUG = 'phone-online'

const lessonPage = (load: Option.Option<LessonLoad>) =>
  Model.make({
    route: AppRoute.Lesson({
      locale: 'en',
      course: COURSE,
      slug: SLUG,
      step: Option.none(),
    }),
    preferredLocale: 'en',
    languageMenu: initialLanguageMenu(),
    prefersDark: false,
    lessonSessions: {},
    lessonLoads: Option.match(load, {
      onNone: () => ({}),
      onSome: state => ({ [`${COURSE}/${SLUG}`]: state }),
    }),
  })

afterEach(async () => {
  await Effect.runPromise(loadLesson(COURSE, SLUG))
})

describe('lesson page while the lesson loads', () => {
  test('shows the title and says the lesson is loading', () => {
    forgetLoadedLesson(COURSE, SLUG)
    scene(
      { update, view },
      given(lessonPage(Option.some(LessonLoad.Loading()))),
      expect(role('status')).toHaveText('Loading the lesson…'),
      expect(role('heading', { level: 1 })).toExist(),
    )
  })

  test('a failed load offers to try again', () => {
    forgetLoadedLesson(COURSE, SLUG)
    scene(
      { update, view },
      given(lessonPage(Option.some(LessonLoad.Failed()))),
      expect(role('alert')).toHaveText(
        'The lesson did not load. Check your connection and try again.',
      ),
      click(role('button', { name: 'Try again' })),
      expect(role('status')).toHaveText('Loading the lesson…'),
      Command.expectExact(LoadLesson({ course: COURSE, slug: SLUG })),
      Command.resolve(
        LoadLesson,
        Message.FailedLoadLesson({ course: COURSE, slug: SLUG }),
      ),
      expect(role('button', { name: 'Try again' })).toExist(),
    )
  })
})
