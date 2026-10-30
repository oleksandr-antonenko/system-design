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
import { describe, expect as expectValue, test } from 'vitest'

import phoneOnline from '../../../../courses/networks/lessons/01-phone-online/lesson'
import * as Player from '../../../../lesson/player'
import { lessonView, loadedEntry } from '../../../../lesson/view'
import { joinWifi } from '../../../../net/build'
import { packet } from '../../dsl'
import { currentPage } from './network'

// Стартовая страница браузера (`homePage` хоста): урок 1 даёт телефону
// магазин, и браузер показывает его, как только телефон в сети, — без
// адресной строки, которая откроется в уроке 3.

const entry = Option.getOrThrow(loadedEntry('networks', 'phone-online'))

const shopName = Option.getOrThrow(
  Option.map(
    Option.fromNullishOr(
      entry.texts.find(each => each.locale === 'en')?.text.labels?.shop,
    ),
    shop => shop.name,
  ),
)

const atTask = (): Player.Model => ({
  ...Player.init('networks', phoneOnline, 3),
  quizzes: { 'way-out': { picked: 'router', isCorrect: true } },
  step: 4,
})

const joined = (): Player.Model => {
  const model = atTask()
  return {
    ...model,
    tasks: {
      ...model.tasks,
      'join-wifi': {
        ...Player.taskStateOf(model, 'join-wifi'),
        log: [packet.op.wrap(joinWifi('phone', 'Router-7C21', '12345678'))],
      },
    },
  }
}

const pageOf = (model: Player.Model) =>
  Option.map(
    currentPage(Player.surfaceContext(phoneOnline, model, 'phone')),
    page => ({ url: page.url, screen: page.view._tag }),
  )

describe('the browser start page', () => {
  test('offline the browser is blank; once the phone is on Wi-Fi it shows the start page', () => {
    expectValue(pageOf(atTask())).toEqual(Option.none())
    expectValue(pageOf(joined())).toEqual(
      Option.some({ url: 'https://shop.example/', screen: 'Page' }),
    )
  })

  test('lesson 1: the shop opens in the phone’s browser after joining Wi-Fi', () => {
    scene(
      {
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
      },
      given(atTask()),
      click(role('tab', { name: 'Browser' })),
      expect(text('The site will open here.')).toExist(),
      expect(role('heading', { name: shopName })).not.toExist(),
      click(role('tab', { name: 'Settings' })),
      click(role('button', { name: /^Router-7C21,/ })),
      type(label('Password'), '12345678'),
      click(role('button', { name: 'Join' })),
      click(role('tab', { name: 'Browser' })),
      expect(role('heading', { name: shopName })).toExist(),
      expect(role('textbox', { name: 'Site address' })).not.toExist(),
    )
  })
})
