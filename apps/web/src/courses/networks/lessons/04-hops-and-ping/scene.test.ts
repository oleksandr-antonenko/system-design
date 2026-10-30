import { Array, Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  Command,
  click,
  expect,
  given,
  role,
  scene,
  submit,
  text,
  type,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import type { Locale } from '../../../../i18n/locale'
import * as Player from '../../../../lesson/player'
import { lessonView } from '../../../../lesson/view'
import { findLesson } from '../../../registry'
import lesson from './lesson'

// Урок 4 глазами ученика: вопрос «куда дальше» на доске, задача в
// терминале ноутбука и на доске (вставить выдернутый кабель) — руками и
// через «Показать решение».

const entry = Option.getOrThrow(findLesson('networks', 'hops-and-ping'))

const sceneIn = (locale: Locale) => ({
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(lesson)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(lesson, entry, playerModel, { locale, prefersDark: false }, h),
})

const atQuiz = (): Player.Model => Player.init('networks', lesson, 2)

/** Шаг задачи: на вопрос уже ответили. */
const atTask = (): Player.Model => ({
  ...Player.init('networks', lesson, 0),
  quizzes: { 'next-hop': { picked: 'core', isCorrect: true } },
  step: 3,
})

const replayStep = Command.resolve(
  Player.WaitBeforeReplayStep,
  Player.Message.CompletedWaitBeforeReplayStep(),
)

const command = (line: string) => [
  type(role('textbox', { name: 'Команда' }), line),
  submit(role('form', { name: 'Команда' })),
]

describe('lesson 4: hops and ping', () => {
  test('ru: the chain shows names, not addresses, before lesson 8', () => {
    scene(
      sceneIn('ru'),
      given(Player.init('networks', lesson, 0)),
      expect(text('вход в интернет')).toExist(),
      expect(text('203.0.113.1')).not.toExist(),
      expect(text('192.168.1.42')).toExist(),
    )
  })

  test('ru: a wrong next hop explains itself and shows the right one', () => {
    scene(
      sceneIn('ru'),
      given(atQuiz()),
      click(role('button', { name: /^Hosting router/ })),
      expect(text(/нет прямого кабеля/)).toExist(),
      expect(text(/Router знает только следующий шаг/)).toExist(),
    )
  })

  test('ru: solved by hand — ping the router, ping the site, plug the cable in, ping again', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      ...command('ping 192.168.1.1'),
      expect(text('64 bytes from 192.168.1.1: icmp_seq=0 time=6 ms')).toExist(),
      ...command('ping shop.example'),
      expect(text('Request timeout for icmp_seq 0')).toExist(),
      ...command('traceroute shop.example'),
      expect(text(/traceroute появится в уроке 8/)).toExist(),
      click(role('button', { name: /^Вставить кабель Router — ISP router/ })),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Кабель на месте/)).toExist(),
      ...command('ping shop.example'),
      expect(
        text('64 bytes from 198.51.100.10: icmp_seq=0 time=90 ms'),
      ).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/обрыв был сразу за router/)).toExist(),
    )
  })

  test('en: show solution plugs the cable in and repeats the pings through the journal', () => {
    scene(
      sceneIn('en'),
      given(atTask()),
      ...Array.makeBy(3, () => click(role('button', { name: /^Hint/ }))),
      click(role('button', { name: 'Show solution' })),
      replayStep,
      replayStep,
      replayStep,
      replayStep,
      expect(text(/the break was right behind the router/)).toExist(),
      expect(
        text('64 bytes from 198.51.100.10: icmp_seq=0 time=90 ms'),
      ).toExist(),
    )
  })
})
