import { Array } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  click,
  expect,
  given,
  label,
  role,
  scene,
  submit,
  text,
  type,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Player from '../../../lesson/player'
import { lessonView } from '../../../lesson/view'
import { packet } from '../dsl'
import { HOME, HOME_PASSWORD, devices, devicesEntry } from './testing'

// Поверхности устройств в плеере, глазами ученика: экран телефона с
// настройками и браузером в одной вкладке, терминал сервера с консолью
// хостинга.

const sceneFor = {
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(devices)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      devices,
      devicesEntry,
      playerModel,
      { locale: 'en', prefersDark: false },
      h,
    ),
}

const solved = (ids: ReadonlyArray<string>) =>
  Object.fromEntries(
    Array.map(ids, id => [
      id,
      {
        ...Player.taskStateOf(Player.init('networks', devices, 0), id),
        log: Array.flatMap(devices.steps, step =>
          step.task?.id === id
            ? Array.map(step.task.solution, packet.op.wrap)
            : [],
        ),
        check: Player.CheckState.Solved({ withHint: false }),
      },
    ]),
  )

const atStep = (step: number, before: ReadonlyArray<string>): Player.Model => ({
  ...Player.init('networks', devices, 0),
  tasks: solved(before),
  step,
})

describe('device screen', () => {
  test('the phone joins Wi-Fi in Settings and opens a site in Browser, in one tab', () => {
    scene(
      sceneFor,
      given(atStep(1, [])),
      expect(role('tab', { name: 'Screen · Phone' })).toExist(),
      expect(role('tab', { name: 'Browser' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(text('Type a site address in the bar above.')).toExist(),
      click(role('tab', { name: 'Settings' })),
      expect(text('no network')).toExist(),
      click(role('button', { name: /^Router-3A90,/ })),
      type(label('Password'), 'their-guess'),
      click(role('button', { name: 'Join' })),
      expect(role('alert')).toHaveText(/not your network/),
      click(role('button', { name: 'Cancel' })),
      click(role('button', { name: new RegExp(`^${HOME},`) })),
      type(label('Password'), HOME_PASSWORD),
      click(role('button', { name: 'Show password' })),
      expect(label('Password')).toHaveAttr('type', 'text'),
      click(role('button', { name: 'Join' })),
      expect(role('img', { name: `Connected to “${HOME}”` })).toExist(),
      click(role('tab', { name: 'Browser' })),
      type(role('textbox', { name: 'Site address' }), 'shop.example'),
      submit(role('form', { name: 'Site address' })),
      expect(role('heading', { name: 'shop.example' })).toExist(),
      expect(role('textbox', { name: 'Site address' })).toHaveValue(
        'shop.example',
      ),
    )
  })

  test('an error screen keeps the code untranslated and explains why', () => {
    scene(
      sceneFor,
      given(atStep(1, [])),
      type(role('textbox', { name: 'Site address' }), 'http://shop.example'),
      submit(role('form', { name: 'Site address' })),
      expect(role('heading', { name: 'No internet' })).toExist(),
      expect(text('ERR_INTERNET_DISCONNECTED')).toExist(),
      expect(text(/^Why: /)).toExist(),
    )
  })

  test('network details open the DNS settings', () => {
    scene(
      sceneFor,
      given(atStep(2, ['join'])),
      expect(role('tab', { name: 'Settings' })).not.toExist(),
      click(role('button', { name: `Details of ${HOME}` })),
      expect(role('heading', { name: HOME })).toExist(),
      click(role('button', { name: /Configure DNS/ })),
      click(role('radio', { name: 'Automatic (from the router)' })),
      expect(text('192.0.2.53')).toExist(),
    )
  })
})

describe('server terminal', () => {
  test('ssh shows the login banner; closing port 22 moves to the hosting console', () => {
    scene(
      sceneFor,
      given(atStep(3, ['join', 'dns'])),
      expect(role('tab', { name: 'Terminal · Server' })).toExist(),
      expect(
        text('Last login: Thu Oct 29 21:14:03 2026 from 203.0.113.7'),
      ).toExist(),
      type(role('textbox', { name: 'Command' }), 'sudo ufw enable'),
      submit(role('form', { name: 'Command' })),
      expect(text('client_loop: send disconnect: Broken pipe')).toExist(),
      expect(role('tab', { name: 'Hosting console · Server' })).toExist(),
      type(
        role('textbox', { name: 'Command' }),
        'sudo ufw allow from 203.0.113.7 to any port 22 proto tcp',
      ),
      submit(role('form', { name: 'Command' })),
      expect(role('tab', { name: 'Terminal · Server' })).toExist(),
    )
  })

  test('an unknown command is answered in the interface language', () => {
    scene(
      sceneFor,
      given(atStep(3, ['join', 'dns'])),
      type(role('textbox', { name: 'Command' }), 'rm -rf /'),
      submit(role('form', { name: 'Command' })),
      expect(text(/rm/)).toExist(),
      expect(text(/^There is no rm command here/)).toExist(),
    )
  })
})
