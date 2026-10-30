import { Array, Option, pipe } from 'effect'
import { describe, expect, test } from 'vitest'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import { layerRows } from '../../../../kinds/packet/envelope'
import { layoutBoard } from '../../../../kinds/packet/layout'
import { timelineOf } from '../../../../kinds/packet/timeline'
import type { PacketTypes } from '../../../../kinds/types'
import {
  type LessonDefinition,
  boardAt,
  foldDoc,
  taskOf,
  taskStartBoard,
} from '../../../../lesson/dsl'
import { quizAnswer, quizOf } from '../../../../lesson/quiz'
import { send } from '../../../../net/build'
import { checkGoal } from '../../../../net/goals'
import { NetMessage } from '../../../../net/message'
import {
  type Hop,
  Intent,
  Outcome,
  type StackLevel,
  type Trace,
} from '../../../../net/packet'
import { sendIntent } from '../../../../net/world'
import { unlockedFeatures } from '../../../registry'
import course from '../../course'
import underTheHood, { STACK_ORDER } from './lesson'

// Проверки урока 7 из сценария (раздел 8, «Что проверяют тесты контента»):
// внешний frame меняется на каждом хопе, адрес и port получателя — нет;
// ответ квиза; собранный конверт доходит или гаснет там, где сказано; в
// конверте урока 7 нет TTL и флагов TCP.

const lesson: LessonDefinition<PacketTypes> = underTheHood

const kind = lesson.kind

const stepIndex = (id: string): number =>
  lesson.steps.findIndex(lessonStep => lessonStep.id === id)

const TASK = stepIndex('pack')

const task = Option.getOrThrow(taskOf(lesson.steps[TASK]!))

const unlocked: ReadonlyArray<string> = unlockedFeatures(course, 7)

const isOpen = (feature: string): boolean => Array.contains(unlocked, feature)

const shopPage = Intent.Browse({ from: 'phone', url: 'https://shop.example/' })

const traceOn = (world: PacketDoc, intent: Intent): Trace =>
  sendIntent(world, intent)[0]

/** Хопы запроса страницы: конверт с HTTP без статуса ответа. */
const requestHops = (trace: Trace): ReadonlyArray<Hop> =>
  Array.filter(trace.hops, hop =>
    Array.some(
      hop.envelope,
      layer => layer._tag === 'Http' && Option.isNone(layer.maybeStatus),
    ),
  )

const raw = (order: ReadonlyArray<StackLevel>) =>
  Intent.Raw({ from: 'phone', url: 'https://shop.example/', order })

const start = taskStartBoard(lesson, TASK, {})

const goalsAfter = (ops: ReadonlyArray<PacketTypes['Op']>) => {
  const world = foldDoc(kind, start, ops)
  const run = kind.run(world)
  return Array.map(
    task.goals,
    ({ goal }) => checkGoal(world.doc, run.settled, goal).met,
  )
}

describe('lesson 7: an envelope in an envelope', () => {
  test('the page request: Wi-Fi on hop 1, Ethernet on hop 2; the recipient address and port never change', () => {
    const hops = requestHops(traceOn(boardAt(lesson, 0, {}), shopPage))
    expect(Array.map(hops, hop => hop.envelope[0]?._tag)).toEqual([
      'WiFi',
      'Ethernet',
      'Ethernet',
    ])
    const recipients = Array.map(hops, hop =>
      Array.getSomes(
        Array.map(hop.envelope, layer =>
          layer._tag === 'Ip'
            ? Option.some(layer.dst)
            : layer._tag === 'Tcp'
              ? Option.some(`${layer.dst}`)
              : Option.none(),
        ),
      ),
    )
    expect(Array.dedupe(Array.map(recipients, pair => pair.join(':')))).toEqual(
      ['198.51.100.10:443'],
    )
  })

  test('the quiz answer is the transport layer, computed from the envelope', () => {
    const index = stepIndex('which-layer')
    const world = boardAt(lesson, index, {})
    const quiz = Option.getOrThrow(quizOf(lesson.steps[index]!))
    expect(quizAnswer(quiz, world, kind.run(world))).toBe('env:transport')
  })

  test('the packed envelope reaches the shop; each wrong order dies where the script says', () => {
    const outcome = (order: ReadonlyArray<StackLevel>) =>
      traceOn(start, raw(order)).outcome
    expect(outcome(STACK_ORDER)._tag).toBe('Delivered')
    expect(outcome(['internet', 'link', 'transport', 'application'])).toEqual(
      Outcome.Dropped({
        at: 'phone',
        reason: NetMessage.NoLinkLayer({ device: 'phone' }),
      }),
    )
    expect(outcome(['link', 'transport', 'internet', 'application'])).toEqual(
      Outcome.Dropped({
        at: 'router',
        reason: NetMessage.NoAddressLayer({ device: 'router' }),
      }),
    )
    expect(outcome(['link', 'internet', 'application', 'transport'])).toEqual(
      Outcome.Refused({
        at: 'shop',
        reason: NetMessage.NoPortLayer({ device: 'shop' }),
      }),
    )
  })

  test('the task starts unsolved; the port too deep meets only the first goal; the reference meets both', () => {
    expect(goalsAfter([])).toEqual([false, false])
    expect(
      goalsAfter([send(raw(['link', 'internet', 'application', 'transport']))]),
    ).toEqual([true, false])
    expect(goalsAfter(task.solution)).toEqual([true, true])
  })

  test('the lesson 7 envelope has no TTL and no TCP flags; HTTP inside TLS is one row', () => {
    const hop = Option.getOrThrow(
      Array.head(requestHops(traceOn(boardAt(lesson, 0, {}), shopPage))),
    )
    const rows = layerRows(hop, isOpen)
    expect(Array.map(rows, row => [row.level, row.title])).toEqual([
      ['link', 'Wi-Fi'],
      ['internet', 'IP'],
      ['transport', 'TCP'],
      ['application', 'HTTP'],
    ])
    const keys = Array.flatMap(rows, row =>
      Array.map(row.fields, field => `${row.title}.${field.key}`),
    )
    expect(keys).not.toContain('IP.ttl')
    expect(keys).not.toContain('TCP.flags')
    expect(
      pipe(
        layerRows(hop),
        Array.flatMap(row => Array.map(row.fields, field => field.key)),
      ),
    ).toEqual(expect.arrayContaining(['ttl', 'flags']))
  })

  test('the summary plays the first visit in full: MAC lookup, DNS, handshake and the page, eleven envelopes', () => {
    const index = stepIndex('summary')
    const world = boardAt(lesson, index, { pack: task.solution })
    const timeline = timelineOf({
      world,
      stage: lesson.steps[index]!.stage,
      layout: layoutBoard({
        doc: world.doc,
        unlocked,
        isNarrow: false,
        isCloudOpen: false,
        maybeFog: Option.none(),
        rooms: [],
        moved: {},
        text: id => ({ title: id, sub: '', hint: '' }),
      }),
      unlocked,
    })
    expect(Array.dedupe(Array.map(timeline.legs, leg => leg.protocol))).toEqual(
      ['arp', 'dns', 'tcp', 'tls', 'http'],
    )
    expect(
      Array.dedupe(Array.map(timeline.legs, leg => leg.envelopes)),
    ).toEqual([11])
    expect(Option.map(Array.last(timeline.legs), leg => leg.envelope)).toEqual(
      Option.some(11),
    )
  })
})
