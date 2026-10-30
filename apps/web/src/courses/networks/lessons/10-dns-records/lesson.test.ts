import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import { type Play } from '../../../../kinds/packet/dsl'
import type { PacketTypes } from '../../../../kinds/types'
import {
  type LessonDefinition,
  type TaskLogs,
  boardAt,
  foldDoc,
  taskOf,
  taskStartBoard,
  taskSurfaces,
} from '../../../../lesson/dsl'
import { quizAnswer, quizOf } from '../../../../lesson/quiz'
import { addRecord, removeRecord, run, setRecord } from '../../../../net/build'
import { checkGoal } from '../../../../net/goals'
import { addressOf } from '../../../../net/topology'
import { settle } from '../../../../net/trace'
import { runInTerminal, sendIntent } from '../../../../net/world'
import { loadedLesson } from '../../../registry'
import dnsRecords, {
  DOMAIN,
  PARKING_IP,
  VERIFY,
  VPS_IP,
  friendAsks,
  friendPage,
  laptopPage,
} from './lesson'

// Проверки урока 10 из сценария (раздел 8 «Проверки контента»): заглушка в
// начале, память справочной друга и её срок, задача с четырьмя целями и
// типичными ошибками, ответ квиза по эталону, друг на вашем сервере после
// конца TTL.

const lesson: LessonDefinition<PacketTypes> = dnsRecords

const kind = lesson.kind

const stepIndex = (id: string): number =>
  lesson.steps.findIndex(lessonStep => lessonStep.id === id)

const TASK = stepIndex('point-domain')

const task = Option.getOrThrow(taskOf(lesson.steps[TASK]!))

const solved: TaskLogs<PacketTypes['Op']> = {
  'point-domain': task.solution,
}

const start = taskStartBoard(lesson, TASK, {})

const goalsAfter = (ops: ReadonlyArray<PacketTypes['Op']>) => {
  const world = foldDoc(kind, start, ops)
  const settled = kind.run(world).settled
  return Array.map(task.goals, ({ id, goal }) => {
    const check = checkGoal(world.doc, settled, goal)
    return {
      id,
      met: check.met,
      failure: Option.map(check.maybeFailure, message => message._tag),
    }
  })
}

const failureOf = (ops: ReadonlyArray<PacketTypes['Op']>, id: string) => {
  const world = foldDoc(kind, start, ops)
  const goal = Option.getOrThrow(
    Array.findFirst(task.goals, each => each.id === id),
  ).goal
  return checkGoal(world.doc, kind.run(world).settled, goal).maybeFailure
}

const refusalOf = (op: PacketTypes['Op']) =>
  Option.map(Result.getFailure(kind.apply(start, op)), message => message._tag)

const playsOf = (index: number): ReadonlyArray<Play> =>
  Array.filter(
    lesson.steps[index]!.stage,
    (item): item is Play => item._tag === 'Play',
  )

const cacheOf = (world: PacketDoc, device: string) =>
  Array.map(
    Array.filter(world.state.dnsCache, entry => entry.device === device),
    entry => ({
      name: entry.name,
      value: entry.value,
      left: entry.expiresAt - world.state.clock,
    }),
  )

const terminal = (ops: ReadonlyArray<PacketTypes['Op']>, line: string) =>
  runInTerminal(foldDoc(kind, start, ops), 'laptop', line)[0].output

describe('lesson 10: DNS records and your own domain', () => {
  test('step 1: the domain leads to the parking page; nobody remembers anything', () => {
    const index = stepIndex('own-domain')
    const world = boardAt(lesson, index, {})
    const [play] = playsOf(index)
    expect(play!.intent).toEqual(laptopPage)
    const [result] = sendIntent(world, laptopPage)
    expect(result.outcome).toMatchObject({ _tag: 'Delivered', at: 'parking' })
    expect(
      Array.some(
        result.hops,
        hop => hop.from === 'internet' && hop.to === 'ns',
      ),
    ).toBe(true)
    expect(world.state.dnsCache).toEqual([])
  })

  test('step 2: the friend’s directory asks the DNS provider and remembers the parking page for an hour', () => {
    const index = stepIndex('ttl')
    const world = boardAt(lesson, index, {})
    expect(world.state.dnsCache).toEqual([])
    const [play] = playsOf(index)
    expect(play!.intent).toEqual(friendAsks)
    const [result, after] = sendIntent(world, friendAsks)
    expect(
      Array.some(
        result.hops,
        hop => hop.from === 'internet' && hop.to === 'ns',
      ),
    ).toBe(true)
    expect(cacheOf(after, 'cf')).toEqual([
      { name: DOMAIN, value: PARKING_IP, left: 3600 },
    ])
  })

  test('task start: the friend’s directory remembers the parking page; no goal is met', () => {
    expect(cacheOf(start, 'cf')).toEqual([
      { name: DOMAIN, value: PARKING_IP, left: 3600 },
    ])
    expect(goalsAfter([])).toEqual([
      {
        id: 'a-record',
        met: false,
        failure: Option.some('GoalResolvesElsewhere'),
      },
      { id: 'www-cname', met: false, failure: Option.some('GoalNoRecord') },
      { id: 'txt', met: false, failure: Option.some('GoalNoRecord') },
      { id: 'checked', met: false, failure: Option.some('GoalCommandNotRun') },
    ])
    expect(taskSurfaces(task)).toEqual([
      'board',
      'dns-panel:ns',
      'terminal:laptop',
    ])
  })

  test('the reference solution meets all four goals; dig prints the new address', () => {
    expect(goalsAfter(task.solution).every(goal => goal.met)).toBe(true)
    expect(terminal(task.solution, `dig ${DOMAIN}`)).toContain(
      `${DOMAIN}.\t\t300\tIN\tA\t${VPS_IP}`,
    )
    expect(terminal(task.solution, `dig www.${DOMAIN}`)).toContain(
      `www.${DOMAIN}.\t\t300\tIN\tCNAME\t${DOMAIN}.`,
    )
    expect(terminal(task.solution, `nslookup ${DOMAIN}`)).toContain(
      `Address: ${VPS_IP}`,
    )
  })

  test('typical mistakes: a second A, CNAME at @, CNAME to an address, A at www, a typo', () => {
    const newA = setRecord('ns', DOMAIN, {
      type: 'A',
      name: '@',
      value: VPS_IP,
      ttl: 300,
    })
    expect(
      failureOf(
        [addRecord('ns', DOMAIN, { type: 'A', name: '@', value: VPS_IP })],
        'a-record',
      ),
    ).toMatchObject(
      Option.some({ _tag: 'SeveralAddresses', ips: [PARKING_IP, VPS_IP] }),
    )
    expect(
      refusalOf(
        setRecord('ns', DOMAIN, {
          type: 'CNAME',
          name: '@',
          value: 'x.example',
        }),
      ),
    ).toEqual(Option.some('CnameAtApex'))
    expect(
      refusalOf(
        setRecord('ns', DOMAIN, { type: 'CNAME', name: 'www', value: VPS_IP }),
      ),
    ).toEqual(Option.some('CnameNeedsName'))
    expect(
      failureOf(
        [
          newA,
          setRecord('ns', DOMAIN, { type: 'A', name: 'www', value: VPS_IP }),
        ],
        'www-cname',
      ),
    ).toMatchObject(Option.some({ _tag: 'GoalNoRecord', rtype: 'CNAME' }))
    expect(
      failureOf(
        [
          setRecord('ns', DOMAIN, {
            type: 'A',
            name: '@',
            value: '198.51.100.2',
          }),
        ],
        'a-record',
      ),
    ).toMatchObject(
      Option.some({ _tag: 'GoalResolvesElsewhere', have: '198.51.100.2' }),
    )
    expect(
      goalsAfter([
        setRecord('ns', DOMAIN, {
          type: 'TXT',
          name: '@',
          value: `"${VERIFY}"`,
        }),
      ])[2],
    ).toEqual({ id: 'txt', met: true, failure: Option.none() })
    expect(
      failureOf(
        [setRecord('ns', DOMAIN, { type: 'TXT', name: '@', value: 'verify' })],
        'txt',
      ),
    ).toMatchObject(Option.some({ _tag: 'GoalRecordValue', want: VERIFY }))
    expect(
      Array.map(
        Array.filter(
          foldDoc(kind, start, [newA, removeRecord('ns', DOMAIN, '@', 'A')]).doc
            .devices,
          device => device.id === 'ns',
        ),
        device => (device._tag === 'Host' ? device.zones[0]?.records : []),
      ),
    ).toEqual([[]])
  })

  test('dig before the change remembers the parking page; asking the DNS provider directly passes', () => {
    const early = [run('laptop', `dig ${DOMAIN}`), ...task.solution.slice(0, 3)]
    const again = [...early, run('laptop', `dig ${DOMAIN}`)]
    expect(failureOf(again, 'checked')).toMatchObject(
      Option.some({ _tag: 'GoalCommandSawOther', saw: [PARKING_IP] }),
    )
    const direct = [...early, run('laptop', `dig @ns1.dns.example ${DOMAIN}`)]
    expect(terminal(direct, `dig @ns1.dns.example ${DOMAIN}`)).toContain(
      ';; flags: qr aa',
    )
    expect(goalsAfter(direct).every(goal => goal.met)).toBe(true)
    expect(
      failureOf(
        [...task.solution.slice(0, 3), run('laptop', `ping ${DOMAIN}`)],
        'checked',
      ),
    ).toMatchObject(Option.some({ _tag: 'GoalCommandNotRun' }))
  })

  test('quiz: half an hour later the old address is stuck in the friend’s directory', () => {
    const index = stepIndex('friend-sees-old')
    const world = boardAt(lesson, index, solved)
    expect(cacheOf(world, 'cf')).toEqual([
      { name: DOMAIN, value: PARKING_IP, left: 1800 },
    ])
    expect(cacheOf(world, 'friend')).toEqual([])
    const quiz = Option.getOrThrow(quizOf(lesson.steps[index]!))
    expect(quizAnswer(quiz, world, kind.run(world))).toBe('cf')
    expect(quiz.candidates).toContain('cf')
    expect(quiz.hideUntilAnswered).toEqual(['tables'])
    expect(sendIntent(world, friendPage)[0].outcome).toMatchObject({
      _tag: 'Delivered',
      at: 'parking',
    })
  })

  test('summary: once the TTL runs out the friend reaches your server', () => {
    const index = stepIndex('summary')
    const world = boardAt(lesson, index, solved)
    expect(cacheOf(world, 'cf')).toEqual([
      { name: DOMAIN, value: PARKING_IP, left: 0 },
    ])
    const [result, after] = sendIntent(world, friendPage)
    expect(result.outcome).toMatchObject({ _tag: 'Delivered', at: 'vps' })
    expect(cacheOf(after, 'cf')).toEqual([
      { name: DOMAIN, value: VPS_IP, left: 300 },
    ])
  })

  test('addresses in the texts are the addresses on the board', () => {
    const world = boardAt(lesson, TASK, {})
    const settled = settle(world.doc, world.state)
    const onBoard = Array.getSomes(
      Array.map(['dns', 'ns', 'vps', 'parking', 'cf'], id =>
        addressOf(world.doc, settled, id),
      ),
    )
    expect(onBoard).toEqual([
      '192.0.2.53',
      '203.0.113.53',
      VPS_IP,
      PARKING_IP,
      '1.1.1.1',
    ])
    const texts = Option.match(loadedLesson('networks', 'dns-records'), {
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
})
