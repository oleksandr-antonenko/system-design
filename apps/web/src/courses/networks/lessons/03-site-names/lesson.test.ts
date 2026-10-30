import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import { type Play } from '../../../../kinds/packet/dsl'
import { layoutBoard } from '../../../../kinds/packet/layout'
import { timelineOf } from '../../../../kinds/packet/timeline'
import type { PacketTypes } from '../../../../kinds/types'
import {
  type LessonDefinition,
  boardAt,
  foldDoc,
  taskOf,
  taskStartBoard,
  taskSurfaces,
} from '../../../../lesson/dsl'
import { quizAnswer, quizOf } from '../../../../lesson/quiz'
import { firstAddressee } from '../../../../net/answers'
import { browse } from '../../../../net/browser'
import { send, setDns } from '../../../../net/build'
import { checkGoal } from '../../../../net/goals'
import { Intent } from '../../../../net/packet'
import { addressOf } from '../../../../net/topology'
import { settle } from '../../../../net/trace'
import { sendIntent } from '../../../../net/world'
import { findCourse, findLesson, unlockedFeatures } from '../../../registry'
import siteNames from './lesson'

// Проверки урока 3 из сценария (раздел 8 «Что проверяют тесты контента»):
// трасса и первый адресат, ответ квиза, сломанный DNS в начале задачи,
// эталон и «вручную 192.0.2.53», адреса в текстах, без терминала и набора
// адреса.

const lesson: LessonDefinition<PacketTypes> = siteNames

const kind = lesson.kind

const stepIndex = (id: string): number =>
  lesson.steps.findIndex(lessonStep => lessonStep.id === id)

const TASK = stepIndex('no-dns')

const task = Option.getOrThrow(taskOf(lesson.steps[TASK]!))

const shopPage = Intent.Browse({ from: 'phone', url: 'https://shop.example/' })

const start = taskStartBoard(lesson, TASK, {})

const goalsAfter = (ops: ReadonlyArray<PacketTypes['Op']>) => {
  const world = foldDoc(kind, start, ops)
  const run = kind.run(world)
  return Array.map(task.goals, ({ id, goal }) => {
    const check = checkGoal(world.doc, run.settled, goal)
    return {
      id,
      met: check.met,
      failure: Option.map(check.maybeFailure, message => message._tag),
    }
  })
}

const pageAfter = (ops: ReadonlyArray<PacketTypes['Op']>) => {
  const world = foldDoc(kind, start, ops)
  return browse(world.doc, world.state, 'phone', shopPage.url).view
}

const isDns = (world: PacketDoc, intent: Intent) =>
  Array.some(sendIntent(world, intent)[0].hops, hop =>
    Array.some(hop.envelope, layer => layer._tag === 'Dns'),
  )

const playsOf = (index: number): ReadonlyArray<Play> =>
  Array.filter(
    lesson.steps[index]!.stage,
    (item): item is Play => item._tag === 'Play',
  )

describe('lesson 3: a site’s name and its address', () => {
  test('step 1: no DNS server yet; the envelope goes straight to the shop’s address', () => {
    const world = boardAt(lesson, stepIndex('names'), {})
    expect(Array.some(world.doc.devices, device => device.id === 'dns')).toBe(
      false,
    )
    const [play] = playsOf(stepIndex('names'))
    const [result] = sendIntent(world, play!.intent)
    expect(result.outcome).toMatchObject({ _tag: 'Delivered', at: 'shop' })
    expect(isDns(world, play!.intent)).toBe(false)
    expect(firstAddressee(result)).toEqual(Option.some('shop'))
  })

  test('steps 2–3: shop.example reaches the shop; with empty contacts the first envelope goes to the DNS server', () => {
    Array.forEach([stepIndex('ask-first'), stepIndex('who-first')], index => {
      const world = boardAt(lesson, index, {})
      const [result] = sendIntent(world, shopPage)
      expect(result.outcome).toMatchObject({ _tag: 'Delivered', at: 'shop' })
      expect(firstAddressee(result)).toEqual(Option.some('dns'))
      expect(world.state.dnsCache).toEqual([])
    })
  })

  test('step 2 shows the question and the answer as letters on the board', () => {
    const index = stepIndex('ask-first')
    const world = boardAt(lesson, index, {})
    const unlocked = Option.match(findCourse('networks'), {
      onNone: () => [],
      onSome: course => unlockedFeatures(course.definition, 3),
    })
    const layout = layoutBoard({
      doc: world.doc,
      unlocked,
      isNarrow: false,
      isCloudOpen: false,
      maybeFog: Option.none(),
      rooms: [],
      moved: {},
      text: id => ({ title: id, sub: '' }),
    })
    const timeline = timelineOf({
      world,
      stage: lesson.steps[index]!.stage,
      layout,
      unlocked,
    })
    expect(
      Array.map(
        timeline.legs,
        leg => `${leg.from}>${leg.to}${leg.isReply ? '*' : ''}`,
      ),
    ).toEqual([
      'phone>router',
      'router>internet',
      'internet>dns',
      'dns>internet*',
      'internet>router*',
      'router>phone*',
      'phone>router',
      'router>internet',
      'internet>shop',
      'shop>internet*',
      'internet>router*',
      'router>phone*',
    ])
    expect(Array.some(layout.nodes, node => node.id === 'dns')).toBe(true)
  })

  test('the quiz answer is the DNS server, one of the candidates', () => {
    const index = stepIndex('who-first')
    const world = boardAt(lesson, index, {})
    const quiz = Option.getOrThrow(quizOf(lesson.steps[index]!))
    expect(quizAnswer(quiz, world, kind.run(world))).toBe('dns')
    expect(quiz.candidates).toContain('dns')
  })

  test('task start: manual DNS with an empty list, no goal met, the browser shows ERR_NAME_NOT_RESOLVED', () => {
    expect(goalsAfter([])).toEqual([
      { id: 'knows-dns', met: false, failure: Option.some('NoDnsServer') },
      { id: 'resolves', met: false, failure: Option.some('NoDnsServer') },
      { id: 'opens', met: false, failure: Option.some('GoalNotPerformed') },
    ])
    expect(pageAfter([])).toMatchObject({
      _tag: 'Error',
      code: 'ERR_NAME_NOT_RESOLVED',
      reason: { _tag: 'NoDnsServer' },
    })
    expect(start.state.dnsCache).toEqual([])
  })

  test('the reference solution meets every goal and fills the phone’s contacts', () => {
    expect(task.solution).toEqual([
      setDns('phone', { mode: 'auto' }),
      send(shopPage),
    ])
    expect(goalsAfter(task.solution).every(goal => goal.met)).toBe(true)
    const solved = foldDoc(kind, start, task.solution)
    expect(
      Array.map(
        Array.filter(solved.state.dnsCache, entry => entry.device === 'phone'),
        entry => [entry.name, entry.value],
      ),
    ).toEqual([['shop.example', '198.51.100.10']])
  })

  test('manual 192.0.2.53 and a reload also solve it', () => {
    expect(
      goalsAfter([
        setDns('phone', { mode: 'manual', servers: ['192.0.2.53'] }),
        send(shopPage),
      ]).every(goal => goal.met),
    ).toBe(true)
  })

  test('typical wrong moves: reload as is, a name, the shop, the router', () => {
    expect(goalsAfter([send(shopPage)])[2]).toEqual({
      id: 'opens',
      met: false,
      failure: Option.some('GoalNotPerformed'),
    })
    expect(
      Result.getFailure(
        kind.apply(
          start,
          setDns('phone', { mode: 'manual', servers: ['shop.example'] }),
        ),
      ).pipe(Option.map(message => message._tag)),
    ).toEqual(Option.some('InvalidIp'))
    expect(
      pageAfter([
        setDns('phone', { mode: 'manual', servers: ['198.51.100.10'] }),
      ]),
    ).toMatchObject({
      code: 'ERR_NAME_NOT_RESOLVED',
      reason: { _tag: 'PortClosed', device: 'shop', proto: 'udp', port: 53 },
    })
    expect(
      pageAfter([
        setDns('phone', { mode: 'manual', servers: ['192.168.1.1'] }),
      ]),
    ).toMatchObject({
      code: 'ERR_NAME_NOT_RESOLVED',
      reason: { _tag: 'PortClosed', device: 'router', proto: 'udp', port: 53 },
    })
  })

  test('addresses in the texts are the addresses on the board', () => {
    const world = boardAt(lesson, stepIndex('ask-first'), {})
    const settled = settle(world.doc, world.state)
    const onBoard = Array.getSomes(
      Array.map(['phone', 'router', 'dns', 'shop'], id =>
        addressOf(world.doc, settled, id),
      ),
    )
    expect(onBoard).toEqual([
      '192.168.1.100',
      '192.168.1.1',
      '192.0.2.53',
      '198.51.100.10',
    ])
    const texts = Option.match(findLesson('networks', 'site-names'), {
      onNone: () => [],
      onSome: found => found.texts,
    })
    expect(texts.length).toBe(4)
    Array.forEach(texts, ({ locale, text }) => {
      const mentioned = Array.dedupe(
        Array.map(
          Array.fromIterable(
            JSON.stringify(text).matchAll(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g),
          ),
          match => match[0],
        ),
      )
      expect(mentioned.length, locale).toBeGreaterThan(0)
      Array.forEach(mentioned, ip =>
        expect(onBoard, `${locale}: ${ip}`).toContain(ip),
      )
    })
  })

  test('no terminal and no typing in the address bar', () => {
    expect(taskSurfaces(task)).toEqual(['board', 'browser:phone', 'wifi:phone'])
    const unlocked = Option.match(findCourse('networks'), {
      onNone: () => [],
      onSome: course => unlockedFeatures(course.definition, 3),
    })
    expect(unlocked).not.toContain('browser.typeAddress')
    expect(
      Array.some(unlocked, feature => feature.startsWith('terminal.')),
    ).toBe(false)
  })
})
