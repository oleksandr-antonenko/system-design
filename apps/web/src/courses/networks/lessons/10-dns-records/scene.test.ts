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
  submit,
  text,
  type,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import type { Locale } from '../../../../i18n/locale'
import { packet } from '../../../../kinds/packet/dsl'
import type { PacketTypes } from '../../../../kinds/types'
import { type LessonDefinition, taskOf } from '../../../../lesson/dsl'
import * as Player from '../../../../lesson/player'
import { lessonView, loadedEntry } from '../../../../lesson/view'
import lesson from './lesson'

// Урок 10 глазами ученика: задача в панели DNS-провайдера и терминале
// ноутбука — руками и через «Показать решение»; вопрос «где застрял старый
// адрес» с карточкой справочной, которая открывается только после ответа.

const entry = Option.getOrThrow(loadedEntry('networks', 'dns-records'))

const TASK_STEP = 2
const QUIZ_STEP = 3

const definition: LessonDefinition<PacketTypes> = lesson

const solution = Option.match(taskOf(definition.steps[TASK_STEP]!), {
  onNone: (): ReadonlyArray<PacketTypes['Op']> => [],
  onSome: task => task.solution,
})

const sceneIn = (locale: Locale) => ({
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(lesson)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(lesson, entry, playerModel, { locale, prefersDark: false }, h),
})

const atTask = (): Player.Model => ({
  ...Player.init('networks', lesson, 0),
  step: TASK_STEP,
})

/** Шаг квиза: задача уже решена эталоном. */
const atQuiz = (): Player.Model => {
  const model = atTask()
  return {
    ...model,
    tasks: {
      ...model.tasks,
      'point-domain': {
        ...Player.taskStateOf(model, 'point-domain'),
        log: Array.map(solution, packet.op.wrap),
        check: Player.CheckState.Solved({ withHint: false }),
      },
    },
    step: QUIZ_STEP,
  }
}

const replayStep = Command.resolve(
  Player.WaitBeforeReplayStep,
  Player.Message.CompletedWaitBeforeReplayStep(),
)

describe('lesson 10: DNS records and your own domain', () => {
  test('ru: a wrong pick (your provider’s directory) is explained; then the friend’s directory card opens with its timer', () => {
    scene(
      sceneIn('ru'),
      given(atQuiz()),
      expect(text('осталось 30:00')).not.toExist(),
      click(role('button', { name: 'DNS server, 192.0.2.53' })),
      expect(text(/Но друг ею не пользуется/)).toExist(),
      expect(text('друг её не спрашивает')).toExist(),
      expect(text('помнит заглушку')).toExist(),
      expect(
        text(/Старый адрес застрял в памяти справочной 1\.1\.1\.1/),
      ).toExist(),
      expect(text('осталось 30:00')).toExist(),
    )
  })

  test('ru: the right pick in a fresh session', () => {
    scene(
      sceneIn('ru'),
      given(atQuiz()),
      click(role('button', { name: 'DNS server, 1.1.1.1' })),
      expect(text('помнит заглушку')).toExist(),
      expect(text(/Но друг ею не пользуется/)).not.toExist(),
      expect(
        text(/Старый адрес застрял в памяти справочной 1\.1\.1\.1/),
      ).toExist(),
    )
  })

  test('ru: solved by hand — the A, a CNAME and a TXT in the panel, then dig', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      expect(role('tab', { name: /DNS: myapp\.example/ })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(label('Value, строка 1')).toHaveValue('198.51.100.200'),
      type(label('Value, строка 1'), '198.51.100.20'),
      click(role('button', { name: '+ Добавить' })),
      change(label('Type, строка 2'), 'CNAME'),
      type(label('Name, строка 2'), 'www'),
      type(label('Value, строка 2'), 'myapp.example'),
      click(role('button', { name: '+ Добавить' })),
      change(label('Type, строка 3'), 'TXT'),
      type(label('Value, строка 3'), 'myapp-verify=4f9c2a'),
      click(role('button', { name: 'Сохранить' })),
      expect(text('Сохранено')).toExist(),
      click(role('tab', { name: /Терминал · Laptop/ })),
      type(role('textbox', { name: 'Команда' }), 'dig myapp.example'),
      submit(role('form', { name: 'Команда' })),
      expect(text(/IN\s+A\s+198\.51\.100\.20$/)).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Команда dig показала новый адрес/)).toExist(),
    )
  })

  test('en: a CNAME at @ is refused; a second A fails the address goal with the lesson’s words', () => {
    scene(
      sceneIn('en'),
      given(atTask()),
      change(label('Type, row 1'), 'CNAME'),
      type(label('Value, row 1'), 'myapp.example'),
      click(role('button', { name: 'Save' })),
      expect(
        text(/A CNAME cannot sit on the domain myapp\.example itself/),
      ).toExist(),
      change(label('Type, row 1'), 'A'),
      type(label('Value, row 1'), '198.51.100.200'),
      click(role('button', { name: '+ Add' })),
      type(label('Value, row 2'), '198.51.100.20'),
      click(role('button', { name: 'Save' })),
      click(role('button', { name: 'Check' })),
      expect(
        text(
          /myapp\.example has several addresses: 198\.51\.100\.200 and 198\.51\.100\.20/,
        ),
      ).toExist(),
    )
  })

  test('en: show solution replays the records and dig through the journal', () => {
    scene(
      sceneIn('en'),
      given(atTask()),
      ...Array.makeBy(3, () => click(role('button', { name: /^Hint/ }))),
      click(role('button', { name: 'Show solution' })),
      ...Array.makeBy(5, () => replayStep),
      expect(text(/The dig command showed the new address/)).toExist(),
      click(role('tab', { name: /Terminal · Laptop/ })),
      expect(text(/IN\s+A\s+198\.51\.100\.20$/)).toExist(),
    )
  })
})
