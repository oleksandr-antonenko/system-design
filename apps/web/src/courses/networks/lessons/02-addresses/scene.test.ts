import { Array, Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  Command,
  click,
  expect,
  given,
  role,
  scene,
  selector,
  submit,
  text,
  type,
  within,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import type { Locale } from '../../../../i18n/locale'
import * as Player from '../../../../lesson/player'
import { lessonView } from '../../../../lesson/view'
import { findLesson } from '../../../registry'
import lesson from './lesson'

// Урок 2 глазами ученика: адреса под устройствами и на конверте, выдача
// адреса двумя конвертами, вопрос «кто выдал адрес» и задача в карточках
// устройств и инструментом «Кабель» — руками и через «Показать решение».

const entry = Option.getOrThrow(findLesson('networks', 'addresses'))

const sceneIn = (locale: Locale) => ({
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(lesson)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(lesson, entry, playerModel, { locale, prefersDark: false }, h),
})

const atStep = (step: number): Player.Model =>
  Player.init('networks', lesson, step)

/** Шаг задачи: на вопрос уже ответили. */
const atTask = (): Player.Model => ({
  ...atStep(0),
  quizzes: { 'who-gave': { picked: 'router', isCorrect: true } },
  step: 3,
})

const hideToast = Command.resolve(
  Player.WaitBeforeHidingToast,
  Player.Message.CompletedWaitBeforeHidingToast({ serial: 1 }),
)

const replayStep = Command.resolve(
  Player.WaitBeforeReplayStep,
  Player.Message.CompletedWaitBeforeReplayStep(),
)

describe('lesson 2: everyone has an address', () => {
  test('ru: addresses under the devices; the photo envelope carries numbers', () => {
    scene(
      sceneIn('ru'),
      given(atStep(0)),
      expect(role('button', { name: 'Phone, 192.168.1.100' })).toExist(),
      expect(role('button', { name: 'Laptop, 192.168.1.42' })).toExist(),
      expect(role('button', { name: 'Router, 192.168.1.1' })).toExist(),
      click(role('button', { name: /▶ Пуск/ })),
      expect(
        role('img', {
          name: 'от: Phone 192.168.1.100, кому: Laptop 192.168.1.42',
        }),
      ).toExist(),
    )
  })

  test('en: the phone asks everyone for a number before it has one', () => {
    scene(
      sceneIn('en'),
      given(atStep(1)),
      click(role('button', { name: /▶ Run/ })),
      expect(
        role('img', {
          name: 'from: Phone (no address), to: everyone on the network',
        }),
      ).toExist(),
    )
  })

  test('ru: a wrong pick explains itself; the router is the answer', () => {
    scene(
      sceneIn('ru'),
      given(atStep(2)),
      click(role('button', { name: 'Laptop, 192.168.1.42' })),
      expect(text('номеров не раздаёт')).toExist(),
      expect(text('выдал адрес')).toExist(),
      expect(
        text(
          'Ноутбук — такой же жилец дома, как телефон. Он сам получил адрес от router и номеров не раздаёт.',
        ),
      ).toExist(),
    )
  })

  test('ru: solved by hand — the laptop’s card, the photo, the cable, the print', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      expect(role('button', { name: 'Printer, нет адреса' })).toExist(),
      click(role('button', { name: 'Laptop, 192.168.1.42' })),
      expect(
        role('complementary', { name: 'Карточка устройства «Laptop»' }),
      ).toExist(),
      expect(text('на столе')).toExist(),
      click(role('button', { name: 'Phone, 192.168.1.100' })),
      type(
        within(role('form', { name: 'Отправить фото' }), role('textbox')),
        '192.168.1.1',
      ),
      submit(role('form', { name: 'Отправить фото' })),
      click(role('button', { name: 'Проверить' })),
      expect(
        text(
          'Фото пока не дошло до ноутбука. Сверьте адрес с карточкой ноутбука: нужны все четыре числа.',
        ),
      ).toExist(),
      click(role('button', { name: 'Phone, 192.168.1.100' })),
      type(
        within(role('form', { name: 'Отправить фото' }), role('textbox')),
        '192.168.1.42',
      ),
      submit(role('form', { name: 'Отправить фото' })),
      click(role('button', { name: /Кабель/ })),
      click(role('button', { name: 'Printer, нет адреса' })),
      click(role('button', { name: 'Router, 192.168.1.1' })),
      expect(
        role('img', {
          name: 'от: Printer (нет адреса), кому: всем в сети',
        }),
      ).toExist(),
      expect(role('button', { name: 'Printer, 192.168.1.101' })).toExist(),
      expect(role('button', { name: /Кабель/ })).toHaveAttr(
        'aria-pressed',
        'false',
      ),
      click(role('button', { name: 'Laptop, 192.168.1.42' })),
      type(
        within(role('form', { name: 'Напечатать документ' }), role('textbox')),
        '192.168.1.101',
      ),
      submit(role('form', { name: 'Напечатать документ' })),
      click(role('button', { name: 'Проверить' })),
      expect(
        text(
          'У каждого устройства в доме свой адрес. Router выдал принтеру свободный номер, и ноутбук нашёл принтер по этому номеру.',
        ),
      ).toExist(),
    )
  })

  test('ru: a cable into the laptop is refused in the words of the lesson', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      click(role('button', { name: /Кабель/ })),
      click(role('button', { name: 'Printer, нет адреса' })),
      click(role('button', { name: 'Laptop, 192.168.1.42' })),
      expect(
        text(
          'Ноутбук и телефон адресов не раздают и чужие конверты не передают. Подключите принтер к router.',
        ),
      ).toExist(),
      hideToast,
    )
  })

  test('en: the third hint outlines the cable and the address fields; show solution replays the three moves', () => {
    scene(
      sceneIn('en'),
      given(atTask()),
      ...Array.makeBy(3, () => click(role('button', { name: /^Hint/ }))),
      expect(selector('[data-ghost="printer-router"]')).toExist(),
      click(role('button', { name: 'Phone, 192.168.1.100' })),
      expect(
        within(role('form', { name: 'Send a photo' }), role('textbox')),
      ).toHaveClass('ghost'),
      click(role('button', { name: 'Show solution' })),
      replayStep,
      replayStep,
      replayStep,
      replayStep,
      expect(
        text(
          'Every device in the house has its own address. The router gave the printer a free number, and the laptop found the printer by that number.',
        ),
      ).toExist(),
      expect(selector('[data-ghost="printer-router"]')).not.toExist(),
      expect(role('button', { name: 'Printer, 192.168.1.101' })).toExist(),
    )
  })
})
