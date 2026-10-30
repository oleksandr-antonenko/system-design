import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
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

import phoneOnline from '../../courses/networks/lessons/01-phone-online/lesson'
import { findLesson } from '../../courses/registry'
import * as Player from '../../lesson/player'
import { lessonView } from '../../lesson/view'

// Урок 1 на доске сетей (план, раздел 5): устройства с подписями, «Пуск»,
// конверт «от → кому», вопрос «где выход из дома» на доске, наклейка на
// роутере и задача «подключите телефон».

const entry = Option.getOrThrow(findLesson('networks', 'phone-online'))

const sceneIn = (locale: 'en' | 'ru') => ({
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(phoneOnline)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      phoneOnline,
      entry,
      playerModel,
      { locale, prefersDark: false },
      h,
    ),
})

const atStep = (step: number): Player.Model =>
  Player.init('networks', phoneOnline, step)

const answered = (picked: string): Player.Model => ({
  ...atStep(3),
  quizzes: { 'way-out': { picked, isCorrect: picked === 'router' } },
  step: 4,
})

describe('lesson 1 on the network board', () => {
  test('home: devices with their notes, one Run button, no task tools', () => {
    scene(
      sceneIn('en'),
      given(atStep(0)),
      expect(role('img', { name: 'Phone, in your hand' })).toExist(),
      expect(role('img', { name: 'Laptop, on the desk' })).toExist(),
      expect(
        role('button', {
          name: 'Sticker on the router: network name and password',
        }),
      ).toExist(),
      expect(role('button', { name: /▶ Run/ })).toExist(),
      expect(role('button', { name: 'Step ▸' })).not.toExist(),
      expect(role('button', { name: /Undo/ })).not.toExist(),
      expect(text('Press “Run” under the board to send the envelope.')).toExist(),
      click(role('button', { name: /▶ Run/ })),
      expect(text('Laptop is preparing the envelope.')).toExist(),
    )
  })

  test('the website step adds the internet cloud and the shop; no addresses yet', () => {
    scene(
      sceneIn('ru'),
      given(atStep(1)),
      expect(role('img', { name: 'Интернет: весь мир' })).toExist(),
      expect(role('img', { name: 'Сайт магазина, где-то далеко' })).toExist(),
      expect(text('192.168.1.100')).not.toExist(),
    )
  })

  test('the question: candidates on the board, the run hidden until the answer', () => {
    scene(
      sceneIn('en'),
      given(atStep(3)),
      expect(role('button', { name: 'Wi-Fi router, your home post office' })).toExist(),
      expect(role('button', { name: 'Laptop, on the desk' })).toExist(),
      expect(role('button', { name: /▶ Run/ })).toBeDisabled(),
      click(role('button', { name: 'Wi-Fi router, your home post office' })),
      expect(text('the way out to the internet')).toExist(),
      expect(role('heading', { name: /Correct/ })).not.toExist(),
      expect(text(/Correct/)).toExist(),
    )
  })

  test('a wrong pick: the laptop flashes with its reason, the router is the answer', () => {
    scene(
      sceneIn('en'),
      given(atStep(3)),
      click(role('button', { name: 'Laptop, on the desk' })),
      expect(text('does not carry other envelopes')).toExist(),
      expect(text('the way out to the internet')).toExist(),
      expect(
        text(
          'The laptop is the phone’s neighbour at home. It sends its own envelopes through the router; other devices’ envelopes do not pass through it.',
        ),
      ).toExist(),
    )
  })

  test('the task: the phone has no Wi-Fi, the sticker shows the name and password, joining solves it', () => {
    scene(
      sceneIn('en'),
      given(answered('router')),
      expect(role('img', { name: 'Phone, no Wi-Fi' })).toExist(),
      click(
        role('button', {
          name: 'Sticker on the router: network name and password',
        }),
      ),
      expect(role('dialog', { name: 'Sticker on the router' })).toExist(),
      expect(text('Router-7C21')).toExist(),
      expect(text('12345678')).toExist(),
      expect(text('Solve the task on the board and in the panels below it.')).toExist(),
      click(role('button', { name: /^Router-7C21,/ })),
      type(label('Password'), '12345678'),
      click(role('button', { name: 'Join' })),
      click(role('button', { name: 'Check' })),
      expect(
        text(
          'The phone is on the home Wi-Fi: the wavy line to the router has appeared. Press “Run” — the envelope will reach the website and come back with the page.',
        ),
      ).toExist(),
      expect(role('img', { name: 'Phone, in your hand' })).toExist(),
    )
  })

  test('a wrong password explains itself in the words of the lesson', () => {
    scene(
      sceneIn('ru'),
      given(answered('router')),
      click(role('button', { name: /^Router-7C21,/ })),
      type(label('Пароль'), '1234567'),
      click(role('button', { name: 'Подключиться' })),
      click(role('button', { name: 'Проверить' })),
      expect(
        text('Пароль не подошёл. Сверьте его с наклейкой: важна каждая цифра.'),
      ).toExist(),
    )
  })
})
