import type { HtmlBuilder } from 'foldkit/html'
import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { defineLessonMeta } from '../../courses/model'
import networks from '../../courses/networks/course'
import {
  type LessonDefinition,
  type LessonStep,
  defineLesson,
} from '../../lesson/dsl'
import * as Player from '../../lesson/player'
import { type QuizKind, allOf, matchOf } from '../../lesson/quiz'
import { type LessonEntry, lessonView } from '../../lesson/view'
import {
  add,
  cable,
  firewall,
  host,
  radio,
  router,
  rule,
  tcp,
  transit,
  wifi,
} from '../../net/build'
import { Intent } from '../../net/packet'
import type { PacketTypes } from '../types'
import { expand, openEnvelope, packet, pauseAt, play } from './dsl'

// Виды квизов на доске сетей (план 3.3): кандидаты на доске, клик и
// клавиатура, «Готово» у квиза с несколькими ответами, чипы на места.
// Урока-стенда нет в программе курса, поэтому ему открыт весь интерфейс.

const browse = Intent.Browse({ from: 'laptop', url: 'http://198.51.100.10/' })

const network = [
  add(
    router('router', 300, 300, {
      lan: '192.168.1.1/24',
      wan: '203.0.113.7',
      wifi: wifi('Home', 'password1'),
    }),
  ),
  add(
    host('laptop', 'laptop', 110, 300, {
      wifi: { ssid: 'Home', password: 'password1' },
    }),
  ),
  add(transit('isp', 490, 300, { ip: '203.0.113.1' })),
  add(transit('core', 640, 300, { ip: '192.0.2.1' })),
  add(
    host('shop', 'server', 820, 300, {
      address: '198.51.100.10/24',
      listeners: [tcp(80), tcp(22)],
    }),
  ),
  radio('laptop', 'router'),
  cable('router', 'isp'),
  cable('isp', 'core'),
  cable('core', 'shop'),
  firewall('shop', {
    enabled: true,
    rules: [rule({ action: 'allow', proto: 'tcp', port: 80 })],
  }),
]

type QuizCase = Readonly<{
  kind: QuizKind
  candidates: ReadonlyArray<string>
  answer: string
  multiple?: boolean
  slots?: ReadonlyArray<string>
  stage: LessonStep<PacketTypes>['stage']
}>

const lessonWith = (quiz: QuizCase): LessonDefinition<PacketTypes> =>
  defineLesson(packet, {
    slug: 'quiz-kinds',
    steps: [
      {
        id: 'quiz',
        ops: network,
        stage: quiz.stage,
        quiz: {
          id: 'quiz',
          kind: quiz.kind,
          candidates: quiz.candidates,
          answer: quiz.answer,
          ...(quiz.multiple === undefined ? {} : { multiple: quiz.multiple }),
          ...(quiz.slots === undefined ? {} : { slots: quiz.slots }),
        },
      },
    ],
  })

const meta = defineLessonMeta(networks, {
  slug: 'quiz-kinds',
  module: 'developer',
  order: 99,
  available: true,
  locales: ['en'],
})

const entryWith = (
  options: Readonly<Record<string, string>> = {},
  slots: Readonly<Record<string, string>> = {},
): LessonEntry => ({
  course: 'networks',
  meta,
  texts: [
    {
      locale: 'en',
      text: {
        title: 'Quiz kinds',
        summary: 'Quiz kinds on the network board.',
        preview: { alt: 'Quiz kinds.' },
        steps: { quiz: { title: 'Quiz', body: 'Answer on the board.' } },
        quizzes: {
          quiz: { question: 'Which one?', explain: 'Because.', options, slots },
        },
      },
    },
  ],
})

const sceneFor = (
  lesson: LessonDefinition<PacketTypes>,
  entry: LessonEntry = entryWith(),
) => ({
  update: (playerModel: Player.Model, playerMessage: Player.Message) =>
    Player.updateWith(lesson)(playerModel, playerMessage),
  view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
    lessonView(
      lesson,
      entry,
      playerModel,
      { locale: 'en', prefersDark: false },
      h,
    ),
})

const start = (lesson: LessonDefinition<PacketTypes>) =>
  Player.init('networks', lesson, 0)

describe('quiz modes on the network board', () => {
  test('NextHop: the envelope waits at the device; pressing the next one answers', () => {
    const lesson = lessonWith({
      kind: 'NextHop',
      candidates: ['core', 'router', 'shop'],
      answer: 'core',
      stage: [expand(), play(browse), pauseAt('isp')],
    })
    scene(
      sceneFor(lesson),
      given(start(lesson)),
      expect(role('img', { name: /Drag the envelope/ })).toExist(),
      click(role('button', { name: /^ISP router/ })),
      expect(text(/Correct/)).toExist(),
    )
  })

  test('PickLayer: a highlighted field and the four layers to choose from', () => {
    const lesson = lessonWith({
      kind: 'PickLayer',
      candidates: [
        'env:link',
        'env:internet',
        'env:transport',
        'env:application',
      ],
      answer: 'env:transport',
      stage: [
        play(browse, { show: 'all' }),
        pauseAt('isp'),
        openEnvelope('transport'),
      ],
    })
    scene(
      sceneFor(lesson),
      given(start(lesson)),
      expect(text('Which layer is the highlighted field from?')).toExist(),
      click(role('button', { name: 'Network' })),
      expect(text(/Not quite/)).toExist(),
      expect(role('button', { name: 'Transport' })).toBeDisabled(),
    )
  })

  test('PickRule: the rows of the firewall are the candidates', () => {
    const lesson = lessonWith({
      kind: 'PickRule',
      candidates: ['rule:shop:1', 'rule:shop:0'],
      answer: 'rule:shop:0',
      stage: [
        play(
          Intent.Connect({ from: 'laptop', host: '198.51.100.10', port: 22 }),
        ),
      ],
    })
    scene(
      sceneFor(lesson),
      given(start(lesson)),
      expect(text('Firewall rules: “Server”')).toExist(),
      click(role('button', { name: /everything else/ })),
      expect(text(/Correct/)).toExist(),
    )
  })

  test('SpotFault with several answers: mark, unmark, then Done', () => {
    const lesson = lessonWith({
      kind: 'SpotFault',
      candidates: ['router', 'link:router-isp', 'shop'],
      answer: allOf('router', 'shop'),
      multiple: true,
      stage: [],
    })
    scene(
      sceneFor(lesson),
      given(start(lesson)),
      expect(role('button', { name: 'Done' })).toBeDisabled(),
      click(role('button', { name: /^Server/ })),
      click(role('button', { name: /^Router/ })),
      expect(text('selected: 2')).toExist(),
      click(role('button', { name: 'Done' })),
      expect(text(/Correct/)).toExist(),
    )
  })

  test('PickLinks: cables are the candidates', () => {
    const lesson = lessonWith({
      kind: 'PickLinks',
      candidates: ['link:router-isp', 'link:isp-core', 'link:core-shop'],
      answer: allOf('link:router-isp'),
      stage: [],
    })
    scene(
      sceneFor(lesson),
      given(start(lesson)),
      click(role('button', { name: /^Router — ISP router/ })),
      click(role('button', { name: 'Done' })),
      expect(text(/Correct/)).toExist(),
    )
  })

  test('Match: chips onto places by clicks; Done once every place is filled', () => {
    const lesson = lessonWith({
      kind: 'Match',
      candidates: ['dns', 'gateway'],
      answer: matchOf({ A: 'dns', B: 'gateway' }),
      slots: ['A', 'B'],
      stage: [],
    })
    scene(
      sceneFor(
        lesson,
        entryWith(
          { dns: 'DNS is broken', gateway: 'No gateway' },
          { A: 'nslookup: no servers', B: 'ping: unreachable' },
        ),
      ),
      given(start(lesson)),
      expect(role('button', { name: 'Done' })).toBeDisabled(),
      click(role('button', { name: 'DNS is broken' })),
      click(role('button', { name: 'nslookup: no servers: empty' })),
      click(role('button', { name: 'No gateway' })),
      click(role('button', { name: 'ping: unreachable: empty' })),
      expect(text('selected: 2')).toExist(),
      click(role('button', { name: 'Done' })),
      expect(text(/Correct/)).toExist(),
    )
  })
})
