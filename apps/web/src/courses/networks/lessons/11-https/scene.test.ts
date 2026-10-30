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
import { findLesson } from '../../../registry'
import lesson from './lesson'

// Урок 11 глазами ученика: вопрос «что видит кафе» с неверным ответом,
// задача руками — красный экран, панель сервера (выпуск до порта 80,
// порт 80, оба имени, перенаправление), замок после «Обновить» — и через
// «Показать решение».

const entry = Option.getOrThrow(findLesson('networks', 'https'))

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
  quizzes: { 'cafe-sees': { picked: 'address-port-name', isCorrect: true } },
  step: 4,
})

const replayStep = Command.resolve(
  Player.WaitBeforeReplayStep,
  Player.Message.CompletedWaitBeforeReplayStep(),
)

describe('lesson 11: HTTPS and a certificate for your site', () => {
  test('ru: the shop.example passport lies under the board with three passed checks', () => {
    scene(
      sceneIn('ru'),
      given(Player.init('networks', lesson, 2)),
      expect(role('region', { name: 'Certificate: Сайт магазина' })).toHaveText(
        /Issued toshop\.exampleIssued byExample CAValid until2027-03-14/,
      ),
      expect(
        role('listitem', { name: 'имя совпадает с адресом: да' }),
      ).toExist(),
      expect(role('listitem', { name: 'срок не вышел: да' })).toExist(),
      expect(
        role('listitem', {
          name: 'выдан центром, которому браузер верит: да',
        }),
      ).toExist(),
    )
  })

  test('ru: a wrong answer to “what the café sees” gets its reason and the explanation', () => {
    scene(
      sceneIn('ru'),
      given(atQuiz()),
      click(role('button', { name: 'Ничего: HTTPS прячет всё' })),
      expect(text(/адрес на нём писать приходится/)).toExist(),
      expect(
        text(/в чужом Wi-Fi пароли вводят только на сайтах с замком/),
      ).toExist(),
    )
  })

  test('ru: solved by hand — the red screen, a refused issue, port 80, both names, the redirect', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      expect(role('tab', { name: 'Экран · Phone' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(role('heading', { name: 'Подключение не защищено' })).toExist(),
      click(role('button', { name: 'Дополнительные' })),
      expect(
        text(/его certificate выдан на vps-20\.hosting\.example/),
      ).toExist(),
      click(role('tab', { name: 'Server: VPS' })),
      click(role('tab', { name: 'Certificate новое' })),
      expect(
        text(
          'Сейчас: vps-20.hosting.example · выдан Example CA · до 2027-03-14',
        ),
      ).toExist(),
      type(label('Имя, строка 1'), 'myapp.example'),
      click(role('button', { name: 'Выпустить' })),
      expect(
        text(
          /Certificate authority не подтвердил myapp\.example: port 80 закрыт/,
        ),
      ).toExist(),
      click(role('tab', { name: 'Сайт новое' })),
      change(label('Web server, http, port 80'), 'everyone'),
      click(role('button', { name: 'Сохранить' })),
      click(role('tab', { name: 'Certificate новое' })),
      type(label('Имя, строка 1'), 'myapp.example'),
      click(role('button', { name: '+ Добавить' })),
      type(label('Имя, строка 2'), 'www.myapp.example'),
      click(role('button', { name: 'Выпустить' })),
      expect(
        text(
          'Сейчас: myapp.example, www.myapp.example · выдан Example CA · до 2027-01-28',
        ),
      ).toExist(),
      click(role('tab', { name: 'Сайт новое' })),
      click(label('Перенаправлять http:// на https://')),
      click(role('button', { name: 'Сохранить' })),
      click(role('tab', { name: 'Экран · Phone' })),
      click(role('button', { name: 'Обновить' })),
      click(role('button', { name: 'Соединение защищено' })),
      expect(role('dialog', { name: 'Сертификат' })).toHaveText(
        /myapp\.example, www\.myapp\.example/,
      ),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Certificate выпущен на оба имени/)).toExist(),
    )
  })

  test('ru: a certificate for one name leaves www with the lesson’s words', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      click(role('tab', { name: 'Server: VPS' })),
      change(label('Web server, http, port 80'), 'everyone'),
      click(role('button', { name: 'Сохранить' })),
      click(role('tab', { name: 'Certificate новое' })),
      type(label('Имя, строка 1'), 'myapp.example'),
      click(role('button', { name: 'Выпустить' })),
      click(role('button', { name: 'Проверить' })),
      expect(text(/В паспорте нет имени www\.myapp\.example/)).toExist(),
    )
  })

  test('en: show solution replays the panel moves; the phone gets its padlock', () => {
    scene(
      sceneIn('en'),
      given(atTask()),
      ...Array.makeBy(3, () => click(role('button', { name: /^Hint/ }))),
      click(role('button', { name: 'Show solution' })),
      replayStep,
      replayStep,
      replayStep,
      replayStep,
      replayStep,
      expect(text(/The certificate covers both names/)).toExist(),
      click(role('tab', { name: 'Screen · Phone' })),
      expect(role('button', { name: 'Connection is secure' })).toExist(),
    )
  })
})
