import { Effect, Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { fromString } from 'foldkit/url'
import { afterEach, describe, expect, test } from 'vitest'

import { forgetLoadedLesson, loadLesson } from './courses/registry'
import {
  Flags,
  LessonLoad,
  LoadLesson,
  Message,
  RevealLessonStep,
  init,
  update,
} from './main'

// A lesson's script and texts are their own file: opening a lesson that has
// not been loaded yet loads it first, then opens it on the asked step.

const COURSE = 'system-design'
const SLUG = 'load-balancer'
const KEY = `${COURSE}/${SLUG}`

const openAt = (path: string) =>
  init(
    Flags.make({
      maybeSavedLocale: Option.some('en'),
      browserLanguages: ['en'],
      prefersDark: false,
      isStackedScreen: false,
      isDesktopNoticeDismissed: false,
    }),
    Option.getOrThrow(fromString(`http://localhost${path}`)),
  )

afterEach(async () => {
  await Effect.runPromise(loadLesson(COURSE, SLUG))
})

describe('loading a lesson', () => {
  test('a lesson that is not loaded yet is loaded before it opens', async () => {
    forgetLoadedLesson(COURSE, SLUG)
    const start = openAt(`/en/${COURSE}/lessons/${SLUG}?step=2`)

    expect(start.model.lessonSessions).toEqual({})
    expect(start.model.lessonLoads).toEqual({ [KEY]: LessonLoad.Loading() })
    expect(
      (start.commands ?? []).map(({ name, args }) => ({ name, args })),
    ).toContainEqual({
      name: LoadLesson.name,
      args: { course: COURSE, slug: SLUG },
    })

    await Effect.runPromise(loadLesson(COURSE, SLUG))
    story(
      update,
      given(start.model),
      message(Message.SucceededLoadLesson({ course: COURSE, slug: SLUG })),
      model(next => {
        expect(next.lessonLoads).toEqual({})
        expect(next.lessonSessions[KEY]?.step).toBe(1)
      }),
      Command.expectExact(RevealLessonStep({ step: 1 })),
      Command.resolve(RevealLessonStep, Message.CompletedRevealLessonStep()),
    )
  })

  test('a failed load says so, and Try again loads once more', () => {
    forgetLoadedLesson(COURSE, SLUG)
    const start = openAt(`/en/${COURSE}/lessons/${SLUG}`)

    story(
      update,
      given(start.model),
      message(Message.FailedLoadLesson({ course: COURSE, slug: SLUG })),
      model(next => {
        expect(next.lessonLoads).toEqual({ [KEY]: LessonLoad.Failed() })
      }),
      message(Message.ClickedRetryLessonLoad()),
      model(next => {
        expect(next.lessonLoads).toEqual({ [KEY]: LessonLoad.Loading() })
      }),
      Command.expectExact(LoadLesson({ course: COURSE, slug: SLUG })),
      Command.resolve(
        LoadLesson,
        Message.FailedLoadLesson({ course: COURSE, slug: SLUG }),
      ),
    )
  })

  test('a lesson that arrives after the student left it is kept, not opened', async () => {
    forgetLoadedLesson(COURSE, SLUG)
    const start = openAt(`/en/${COURSE}/lessons/${SLUG}`)
    const elsewhere = openAt(`/en/${COURSE}/`)

    await Effect.runPromise(loadLesson(COURSE, SLUG))
    story(
      update,
      given({ ...elsewhere.model, lessonLoads: start.model.lessonLoads }),
      message(Message.SucceededLoadLesson({ course: COURSE, slug: SLUG })),
      model(next => {
        expect(next.lessonLoads).toEqual({})
        expect(next.lessonSessions).toEqual({})
      }),
    )
  })

  test('a loaded lesson opens at once', () => {
    const start = openAt(`/en/${COURSE}/lessons/${SLUG}?step=2`)

    expect(start.model.lessonLoads).toEqual({})
    expect(start.model.lessonSessions[KEY]?.step).toBe(1)
  })
})
