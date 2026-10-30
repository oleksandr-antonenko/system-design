import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  Command,
  click,
  expect,
  given,
  label,
  role,
  scene,
  text,
  type,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import { findLesson } from '../../courses/registry'
import * as Player from '../../lesson/player'
import { type LessonEntry, lessonView } from '../../lesson/view'
import { phoneOnline } from './testing'

// Хост поверхностей в плеере (design D5): вкладка видна на шаге задачи,
// поверхность пишет ходы в журнал, и цели задачи отмечаются сразу.

const meta = Option.getOrThrow(findLesson('networks', 'phone-online')).meta

const entry: LessonEntry = {
  course: 'networks',
  meta,
  texts: [
    {
      locale: 'en',
      text: {
        title: 'Router. How a phone gets online',
        summary: 'The phone talks to the internet through the router.',
        preview: { alt: 'A phone and a router.' },
        labels: { phone: { name: 'Phone' }, router: { name: 'Router' } },
        steps: {
          home: {
            title: 'Home',
            body: 'The [[router|router]] is the door.\n\nAt home:\n- a phone\n- a router',
            more: {
              title: 'More: why a router',
              body: 'It joins two networks.',
            },
          },
          join: { title: 'Join', body: 'Connect the phone to Home.' },
          online: { title: 'Online', body: 'The phone is online.' },
        },
        annotations: { door: () => 'door to the internet' },
        askAi: {
          lead: 'Start with what you see:',
          template: 'My phone shows Home but no internet. What should I check?',
        },
        tasks: {
          'join-home': {
            prompt: 'Connect the phone to the home Wi-Fi.',
            goals: { associated: 'The phone is on the home Wi-Fi' },
            hints: [
              'Open Wi-Fi.',
              'Pick Home.',
              'The password is on the router.',
            ],
            solvedNote: 'The phone is home.',
          },
        },
      },
    },
  ],
}

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(phoneOnline)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      phoneOnline,
      entry,
      playerModel,
      { locale: 'en', prefersDark: false },
      h,
    ),
}

const goal = text('The phone is on the home Wi-Fi')

describe('task surfaces', () => {
  test('a theory step has no surfaces', () => {
    scene(
      sceneFor,
      given(Player.init('networks', phoneOnline, 0)),
      expect(label('Where to solve the task')).not.toExist(),
      expect(role('button', { name: /▶ Run/ })).toExist(),
    )
  })

  test('the task step shows the Wi-Fi tab; joining ticks the goal', () => {
    scene(
      sceneFor,
      given(Player.init('networks', phoneOnline, 1)),
      expect(role('tab', { name: 'Screen · Phone' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(role('button', { name: 'Join' })).not.toExist(),
      click(role('button', { name: /^Home,/ })),
      type(label('Password'), 'correct-horse'),
      click(role('button', { name: 'Join' })),
      expect(role('img', { name: 'Connected to “Home”' })).toExist(),
      click(role('button', { name: 'Check' })),
      expect(text('The phone is home.')).toExist(),
      expect(goal).toExist(),
    )
  })
})

describe('step text extras', () => {
  test('a bullet list and a collapsed “More” block that opens on click', () => {
    scene(
      sceneFor,
      given(Player.init('networks', phoneOnline, 0)),
      expect(role('listitem', { name: 'a phone' })).toExist(),
      expect(text('It joins two networks.')).toBeAbsent(),
      click(role('button', { name: /More: why a router/ })),
      expect(role('button', { name: /More: why a router/ })).toHaveAttr(
        'aria-expanded',
        'true',
      ),
      expect(text('It joins two networks.')).toExist(),
    )
  })

  test('the last step offers the AI template with a copy button', () => {
    const solved = {
      ...Player.init('networks', phoneOnline, 1),
      tasks: {
        'join-home': {
          ...Player.taskStateOf(Player.init('networks', phoneOnline, 1), 'x'),
          check: Player.CheckState.Solved({ withHint: false }),
        },
      },
      step: 2,
    }
    scene(
      sceneFor,
      given(solved),
      expect(role('heading', { name: 'How to ask an AI' })).toExist(),
      expect(
        text('My phone shows Home but no internet. What should I check?'),
      ).toExist(),
      click(role('button', { name: 'Copy' })),
      Command.resolve(
        Player.CopyAskAiTemplate,
        Player.Message.CompletedCopyAskAiTemplate({ isCopied: true }),
      ),
      expect(text('Copied')).toExist(),
    )
  })
})
