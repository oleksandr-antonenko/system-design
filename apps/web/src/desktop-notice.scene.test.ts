import { Option } from 'effect'
import {
  Command,
  Mount,
  click,
  expect,
  given,
  role,
  scene,
  selector,
} from 'foldkit/scene'
import { fromString } from 'foldkit/url'
import { describe, test } from 'vitest'

import { Dialog } from '@foldkit/ui'

import {
  Flags,
  Message,
  SaveDesktopNoticeDismissed,
  init,
  update,
} from './main'
import { view } from './view'

const openedOnPhone = init(
  Flags.make({
    maybeSavedLocale: Option.some('ru'),
    browserLanguages: ['ru-RU'],
    prefersDark: false,
    isStackedScreen: true,
    isDesktopNoticeDismissed: false,
  }),
  Option.getOrThrow(
    fromString('http://localhost/ru/networks/lessons/phone-online'),
  ),
).model

const notice = role('dialog', { name: 'Удобнее на компьютере' })

describe('the «better on a computer» notice', () => {
  test('is a labelled dialog that «Понятно» closes for good', () => {
    scene(
      { update, view },
      given(openedOnPhone),
      Mount.resolve(
        Dialog.AcquireResources,
        Dialog.Message.SucceededAcquireResources(),
      ),
      expect(notice).toExist(),
      expect(notice).toHaveAttr('aria-modal', 'true'),
      expect(notice).toHaveAttr(
        'aria-describedby',
        'desktop-notice-dialog-description',
      ),
      expect(selector('#desktop-notice-dialog-description')).toHaveText(
        'Эти уроки удобнее проходить на компьютере: доска и задачи там видны целиком. На телефоне тоже можно: текст и доска переключаются кнопкой.',
      ),
      click(role('button', { name: 'Понятно' })),
      Command.resolve(
        Dialog.CloseDialog,
        Dialog.Message.CompletedCloseDialog(),
      ),
      Command.resolve(
        SaveDesktopNoticeDismissed,
        Message.CompletedSaveDesktopNoticeDismissed(),
      ),
      Mount.expectEnded(Dialog.AcquireResources),
      expect(role('button', { name: 'Понятно' })).not.toExist(),
    )
  })
})
