import { Array, Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  Command,
  change,
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

import type { Locale } from '../../../../i18n/locale'
import * as Player from '../../../../lesson/player'
import { lessonView } from '../../../../lesson/view'
import { macFromId } from '../../../../net/address'
import { findLesson } from '../../../registry'
import lesson from './lesson'

// Урок 9 глазами ученика: вопрос «какой адрес увидит сайт» с одной
// попыткой, задача в панели «Router» — закрепить адрес на вкладке «Адреса»
// и пробросить port на вкладке «Ports» руками и через «Показать решение»,
// лишний port forwarding и призрак третьей подсказки.

const entry = Option.getOrThrow(findLesson('networks', 'nat'))

const sceneIn = (locale: Locale) => ({
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(lesson)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(lesson, entry, playerModel, { locale, prefersDark: false }, h),
})

const atQuiz = (): Player.Model => Player.init('networks', lesson, 3)

/** Шаг задачи: на вопрос уже ответили. */
const atTask = (): Player.Model => ({
  ...Player.init('networks', lesson, 0),
  quizzes: { 'what-site-sees': { picked: '203.0.113.7', isCorrect: true } },
  step: 4,
})

const replayStep = Command.resolve(
  Player.WaitBeforeReplayStep,
  Player.Message.CompletedWaitBeforeReplayStep(),
)

const reservePc = (locale: 'ru' | 'en') => {
  const words =
    locale === 'ru'
      ? {
          tab: 'Адреса новое',
          add: '+ Добавить',
          device: 'Устройство, строка 2',
          address: 'IP address, строка 2',
          save: 'Сохранить',
        }
      : {
          tab: 'Addresses new',
          add: '+ Add',
          device: 'Device, row 2',
          address: 'IP address, row 2',
          save: 'Save',
        }
  return [
    click(role('tab', { name: words.tab })),
    click(role('button', { name: words.add })),
    change(label(words.device), macFromId('pc')),
    type(label(words.address), '192.168.1.50'),
    click(role('button', { name: words.save })),
  ]
}

const forwardPort = (
  locale: 'ru' | 'en',
  row: number,
  outsidePort: string,
  insidePort: string,
) => {
  const words =
    locale === 'ru'
      ? {
          tab: 'Ports новое',
          add: '+ Добавить',
          row: `строка ${row}`,
          ip: 'IP address (дома)',
          save: 'Сохранить',
        }
      : {
          tab: 'Ports new',
          add: '+ Add',
          row: `row ${row}`,
          ip: 'IP address at home',
          save: 'Save',
        }
  return [
    click(role('tab', { name: words.tab })),
    click(role('button', { name: words.add })),
    type(label(`Outside port, ${words.row}`), outsidePort),
    type(label(`${words.ip}, ${words.row}`), '192.168.1.50'),
    type(label(`Inside port, ${words.row}`), insidePort),
    click(role('button', { name: words.save })),
  ]
}

describe('lesson 9: NAT and port forwarding', () => {
  test('ru: one attempt at the question — a wrong chip shows why and the right answer', () => {
    scene(
      sceneIn('ru'),
      given(atQuiz()),
      click(role('button', { name: '192.168.1.42' })),
      expect(text(/Это адрес ноутбука внутри дома/)).toExist(),
      expect(text(/Сайт видит 203.0.113.7, внешний адрес router/)).toExist(),
      expect(role('button', { name: 'Далее →' })).toBeEnabled(),
    )
  })

  test('en: the right chip gets the explanation without a wrong note', () => {
    scene(
      sceneIn('en'),
      given(atQuiz()),
      click(role('button', { name: '203.0.113.7' })),
      expect(text(/The website sees 203.0.113.7/)).toExist(),
      expect(text(/That is the laptop’s address inside the home/)).toBeAbsent(),
    )
  })

  test('ru: solved by hand — reserve .50 on “Адреса”, forward TCP 25565 on “Ports”', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      expect(role('tab', { name: 'Router' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(role('tab', { name: 'Адреса новое' })).toExist(),
      expect(role('tab', { name: 'Ports новое' })).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/У игрового компьютера сейчас 192.168.1.102/)).toExist(),
      ...reservePc('ru'),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Router не нашёл правила для TCP 25565/)).toExist(),
      ...forwardPort('ru', 1, '25565', '25565'),
      click(role('button', { name: 'Проверить' })),
      expect(
        text(/Друг в игре, а база данных снаружи не видна. Адрес/),
      ).toExist(),
    )
  })

  test('ru: an extra rule for the database breaks the security goal', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      ...reservePc('ru'),
      ...forwardPort('ru', 1, '25565', '25565'),
      ...forwardPort('ru', 2, '5432', '5432'),
      click(role('button', { name: 'Проверить' })),
      expect(
        text(
          'Снаружи виден port 5432 — это база данных проекта. Удалите это правило.',
        ),
      ).toExist(),
    )
  })

  test('en: the third hint frames the two lists, not the read-only devices', () => {
    scene(
      sceneIn('en'),
      given(atTask()),
      ...Array.makeBy(3, index =>
        click(role('button', { name: `Hint · ${index} of 3` })),
      ),
      expect(role('tab', { name: 'Addresses new' })).toHaveClass('ghost'),
      expect(role('tab', { name: 'Ports new' })).toHaveClass('ghost'),
      expect(role('tab', { name: 'Devices' })).not.toHaveClass('ghost'),
      expect(role('tab', { name: 'Wi-Fi' })).not.toHaveClass('ghost'),
    )
  })

  test('en: “Show solution” replays both moves and solves the task', () => {
    scene(
      sceneIn('en'),
      given(atTask()),
      ...Array.makeBy(3, index =>
        click(role('button', { name: `Hint · ${index} of 3` })),
      ),
      click(role('button', { name: 'Show solution' })),
      replayStep,
      replayStep,
      replayStep,
      expect(
        text(
          /Your friend is in the game, and the database is not visible from outside. The computer/,
        ),
      ).toExist(),
      click(role('tab', { name: 'Ports new' })),
      expect(label('Outside port, row 1')).toHaveValue('25565'),
    )
  })
})
