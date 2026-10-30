import { Array, Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  Command,
  click,
  expect,
  given,
  inside,
  label,
  role,
  scene,
  submit,
  text,
  type,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import type { Locale } from '../../../../i18n/locale'
import * as Board from '../../../../kinds/packet/board'
import { FLY_MS, LEAD_MS, SLOT_MS } from '../../../../kinds/packet/timeline'
import * as Player from '../../../../lesson/player'
import { lessonView } from '../../../../lesson/view'
import { findLesson } from '../../../registry'
import lesson from './lesson'

// Урок 8 глазами ученика: адреса цепочки и метка gateway, таблицы routers
// на паузах с подсвеченной строкой, вопрос «где обрыв» по выводу
// traceroute и задача — чужой gateway ноутбука: в терминале и в сведениях
// о сети руками и через «Показать решение».

const entry = Option.getOrThrow(findLesson('networks', 'routing'))

const sceneIn = (locale: Locale) => ({
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(lesson)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(lesson, entry, playerModel, { locale, prefersDark: false }, h),
})

/** Шаг «таблицы»: конверт стоит у устройства после перелёта номер `leg`. */
const pausedAt = (leg: number): Player.Model => {
  const at = LEAD_MS + leg * SLOT_MS + FLY_MS + 10
  return {
    ...Player.init('networks', lesson, 1),
    board: lesson.kind.board.state.wrap({
      ...Board.initialModel,
      playhead: at,
      stopAt: at,
      hasStarted: true,
      playedTotal: Board.AUTO_PLAY,
    }),
  }
}

const atQuiz = (): Player.Model => Player.init('networks', lesson, 3)

/** Шаг задачи: на вопрос уже ответили. */
const atTask = (): Player.Model => ({
  ...Player.init('networks', lesson, 0),
  quizzes: { 'where-it-breaks': { picked: 'core', isCorrect: true } },
  step: 4,
})

const replayStep = Command.resolve(
  Player.WaitBeforeReplayStep,
  Player.Message.CompletedWaitBeforeReplayStep(),
)

const command = (line: string) => [
  type(role('textbox', { name: 'Команда' }), line),
  submit(role('form', { name: 'Команда' })),
]

describe('lesson 8: routing and the gateway', () => {
  test('ru: the chain shows its addresses now, and the router is marked as the gateway', () => {
    scene(
      sceneIn('ru'),
      given(Player.init('networks', lesson, 0)),
      expect(text('203.0.113.1')).toExist(),
      expect(text('192.0.2.1')).toExist(),
      expect(text('gateway 192.168.1.1')).toExist(),
    )
  })

  test('ru: at each pause the card is the router holding the envelope, with its line lit', () => {
    scene(
      sceneIn('ru'),
      given(pausedAt(1)),
      inside(
        role('complementary', { name: 'Карточка устройства «ISP router»' }),
        expect(text('Routing table')).toExist(),
        expect(role('row', { name: /^default\s*192\.0\.2\.1/ })).toHaveClass(
          'matched',
        ),
        expect(
          role('row', { name: /^203\.0\.113\.0\/24\s*connected/ }),
        ).not.toHaveClass('matched'),
      ),
    )
    scene(
      sceneIn('ru'),
      given(pausedAt(2)),
      inside(
        role('complementary', { name: 'Карточка устройства «Core router»' }),
        expect(
          role('row', { name: /^198\.51\.100\.0\/24\s*198\.51\.100\.1/ }),
        ).toHaveClass('matched'),
      ),
    )
  })

  test('ru: a wrong pick (the hosting router) is explained; the cut shows only after the answer', () => {
    scene(
      sceneIn('ru'),
      given(atQuiz()),
      expect(text(' 4  * * *', { exact: false })).toExist(),
      expect(text(/кабель выдернут/)).not.toExist(),
      click(role('button', { name: /^Hosting router,/ })),
      expect(text(/первое отделение, которое промолчало/)).toExist(),
      expect(text(/Последним ответил core router/)).toExist(),
      expect(text(/Core router — Hosting router: кабель выдернут/)).toExist(),
    )
  })

  test('ru: the right pick in a fresh session', () => {
    scene(
      sceneIn('ru'),
      given(atQuiz()),
      click(role('button', { name: /^Core router,/ })),
      expect(text(/первое отделение, которое промолчало/)).not.toExist(),
      expect(text(/Последним ответил core router/)).toExist(),
    )
  })

  test('ru: solved by hand — ip route, traceroute, then the gateway in the network details', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      expect(role('tab', { name: 'Терминал · Laptop' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(role('button', { name: /^traceroute/ })).toHaveText(/новое/),
      ...command('ip route'),
      expect(text('default via 192.168.1.254 dev en0')).toExist(),
      ...command('traceroute 198.51.100.10'),
      expect(
        text(
          ' 1  192.168.1.42 (192.168.1.42)  3000.0 ms !H  3000.0 ms !H  3000.0 ms !H',
        ),
      ).toExist(),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Gateway 192.168.1.254 не отвечает/)).toExist(),
      click(role('tab', { name: 'Экран · Laptop' })),
      click(role('button', { name: 'Сведения о сети Router-7C21' })),
      expect(text('192.168.1.254')).toExist(),
      click(role('button', { name: /^Настройка IP/ })),
      type(label('Router (gateway)'), '192.168.1.1'),
      click(role('button', { name: 'Сохранить' })),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Gateway ноутбука снова 192.168.1.1/)).toExist(),
    )
  })

  test('ru: the ping that never leaves the laptop is still addressed to the shop', () => {
    scene(
      sceneIn('ru'),
      given({
        ...atTask(),
        board: lesson.kind.board.state.wrap({
          ...Board.initialModel,
          playhead: LEAD_MS + 10,
          stopAt: LEAD_MS + 10,
          hasStarted: true,
          playedTotal: Board.AUTO_PLAY,
        }),
      }),
      expect(
        role('img', { name: /^от: Laptop.*кому: Сайт магазина/ }),
      ).toExist(),
      expect(text(/Gateway 192\.168\.1\.254 не отвечает/)).toExist(),
    )
  })

  test('ru: a ping in the terminal first asks everyone at home who has the foreign gateway', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      ...command('ping 198.51.100.10'),
      click(role('button', { name: /Пуск|Ещё раз/ })),
      expect(
        role('button', {
          name: /^Открыть конверт: от: Laptop 192\.168\.1\.42, кому: всем в сети$/,
        }),
      ).toExist(),
    )
  })

  test('ru: the laptop card shows its gateway', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      click(role('button', { name: /^Laptop,/ })),
      inside(
        role('complementary', { name: 'Карточка устройства «Laptop»' }),
        expect(text('Gateway')).toExist(),
        expect(text('192.168.1.254')).toExist(),
      ),
    )
  })

  test('ru: the printer as the gateway is explained by the lesson', () => {
    scene(
      sceneIn('ru'),
      given(atTask()),
      click(role('tab', { name: 'Экран · Laptop' })),
      click(role('button', { name: 'Сведения о сети Router-7C21' })),
      click(role('button', { name: /^Настройка IP/ })),
      type(label('Router (gateway)'), '192.168.1.101'),
      click(role('button', { name: 'Сохранить' })),
      click(role('button', { name: 'Проверить' })),
      expect(text(/Принтер получил конверт для 198.51.100.10/)).toExist(),
    )
  })

  test('en: show solution fixes the gateway through the journal', () => {
    scene(
      sceneIn('en'),
      given(atTask()),
      ...Array.makeBy(3, () => click(role('button', { name: /^Hint/ }))),
      click(role('button', { name: 'Show solution' })),
      replayStep,
      replayStep,
      expect(text(/The laptop’s gateway is 192.168.1.1 again/)).toExist(),
    )
  })
})
