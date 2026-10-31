import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { fromString } from 'foldkit/url'
import { describe, expect, test } from 'vitest'

import { Dialog } from '@foldkit/ui'

import { defineCourse, recommendsDesktopOf } from './courses/model'
import { courseRecommendsDesktop } from './courses/registry'
import {
  Flags,
  Message,
  type Model,
  SaveDesktopNoticeDismissed,
  init,
  isDesktopNoticeDue,
  update,
} from './main'

// «Эти уроки удобнее на компьютере»: один раз на телефоне в курсе, который
// это советует; закрытый совет больше не показывается в этом браузере.

const urlOf = (path: string) =>
  Option.getOrThrowWith(
    fromString(`http://localhost${path}`),
    () => new Error(`bad url ${path}`),
  )

const openAt = (
  path: string,
  screen: Readonly<{ isStackedScreen: boolean; isDismissed?: boolean }>,
): Model =>
  init(
    Flags.make({
      maybeSavedLocale: Option.some('en'),
      browserLanguages: ['en'],
      prefersDark: false,
      isStackedScreen: screen.isStackedScreen,
      isDesktopNoticeDismissed: screen.isDismissed ?? false,
    }),
    urlOf(path),
  ).model

const SD_LESSON = '/en/system-design/lessons/load-balancer'
const NETWORKS_LESSON = '/en/networks/lessons/phone-online'

const closed = Command.resolve(
  Dialog.CloseDialog,
  Dialog.Message.CompletedCloseDialog(),
)
const saved = Command.resolve(
  SaveDesktopNoticeDismissed,
  Message.CompletedSaveDesktopNoticeDismissed(),
)

describe('the «better on a computer» notice', () => {
  test('opens on a phone in a lesson, and never again once closed', () => {
    const opened = openAt(SD_LESSON, { isStackedScreen: true })
    expect(opened.desktopNotice.dialog.isOpen).toBe(true)

    story(
      update,
      given(opened),
      message(
        Message.GotDesktopNoticeMessage({
          message: Dialog.Message.RequestedClose(),
        }),
      ),
      Command.expectHas(SaveDesktopNoticeDismissed()),
      closed,
      saved,
      model(next => {
        expect(next.desktopNotice.dialog.isOpen).toBe(false)
        expect(next.desktopNotice.isDismissed).toBe(true)
        expect(isDesktopNoticeDue(next)).toBe(false)
      }),
    )
  })

  test('after closing, the other course does not show it either', () => {
    const dismissed = openAt(SD_LESSON, {
      isStackedScreen: true,
      isDismissed: true,
    })
    expect(dismissed.desktopNotice.dialog.isOpen).toBe(false)
    expect(
      openAt(NETWORKS_LESSON, { isStackedScreen: true, isDismissed: true })
        .desktopNotice.dialog.isOpen,
    ).toBe(false)
  })

  test('the networks course recommends a computer too', () => {
    expect(
      openAt(NETWORKS_LESSON, { isStackedScreen: true }).desktopNotice.dialog
        .isOpen,
    ).toBe(true)
  })

  test('not shown on a desktop', () => {
    const wide = openAt(SD_LESSON, { isStackedScreen: false })
    expect(wide.desktopNotice.dialog.isOpen).toBe(false)
    expect(isDesktopNoticeDue(wide)).toBe(false)
  })

  test('narrowing the window inside a lesson opens it', () => {
    story(
      update,
      given(openAt(SD_LESSON, { isStackedScreen: false })),
      message(Message.ChangedStackedScreen({ isStacked: true })),
      Command.expectHas(Dialog.ShowDialog),
      Command.resolve(Dialog.ShowDialog, Dialog.Message.SucceededShowDialog()),
      model(next => {
        expect(next.desktopNotice.dialog.isOpen).toBe(true)
      }),
    )
  })

  test('not shown outside lessons', () => {
    expect(
      openAt('/en/', { isStackedScreen: true }).desktopNotice.dialog.isOpen,
    ).toBe(false)
    expect(
      openAt('/en/system-design/', { isStackedScreen: true }).desktopNotice
        .dialog.isOpen,
    ).toBe(false)
  })

  test('not shown for a course without the flag', () => {
    const plain = defineCourse({
      id: 'plain',
      order: 9,
      board: 'flow',
      modules: ['only'],
      features: [],
      locales: ['en'],
    })
    expect(recommendsDesktopOf(plain)).toBe(false)
    expect(courseRecommendsDesktop('no-such-course')).toBe(false)
    expect(courseRecommendsDesktop('system-design')).toBe(true)
    expect(courseRecommendsDesktop('networks')).toBe(true)
    expect(courseRecommendsDesktop('security')).toBe(false)
    expect(
      openAt('/en/security/lessons/shared-room', { isStackedScreen: true })
        .desktopNotice.dialog.isOpen,
    ).toBe(false)
    expect(
      openAt('/en/no-such-course/lessons/anything', { isStackedScreen: true })
        .desktopNotice.dialog.isOpen,
    ).toBe(false)
  })
})
