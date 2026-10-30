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
} from '../../../../lesson/dsl'
import { quizAnswer, quizOf } from '../../../../lesson/quiz'
import { macFromId } from '../../../../net/address'
import { sourceAddressSeenBy } from '../../../../net/answers'
import { forward, reserve } from '../../../../net/build'
import { checkGoal } from '../../../../net/goals'
import type { Proto } from '../../../../net/model'
import { type Layer, type Trace } from '../../../../net/packet'
import { addressOf } from '../../../../net/topology'
import { foldWorld, sendIntent } from '../../../../net/world'
import { unlockedFeatures } from '../../../registry'
import course from '../../course'
import nat, { friendGame, shopPage } from './lesson'

// Проверки урока 9 из сценария (раздел 8, «Проверки контента»): у телефона
// и компьютера друга один адрес, а конверт друга на .42 не выходит из его
// дома; на хопе router → internet обратный адрес 203.0.113.7 и в NAT table
// одна новая строка; конверт друга гибнет на router без строки NAT; на
// старте задачи выполнена только `only-game`, эталон выполняет все три, а
// лишний port forwarding и типичные ошибки дают свои сообщения.

const lesson: LessonDefinition<PacketTypes> = nat

const kind = lesson.kind

const stepIndex = (id: string): number =>
  lesson.steps.findIndex(lessonStep => lessonStep.id === id)

const TASK = stepIndex('let-friend-in')

const task = Option.getOrThrow(taskOf(lesson.steps[TASK]!))

const start = taskStartBoard(lesson, TASK, {})

const unlocked = unlockedFeatures(course, 9)

const goalsAfter = (ops: ReadonlyArray<PacketTypes['Op']>) => {
  const world = foldDoc(kind, start, ops)
  const run = kind.run(world)
  return Array.map(task.goals, ({ id, goal }) => {
    const check = checkGoal(world.doc, run.settled, goal)
    return {
      id,
      met: check.met,
      failure: Option.getOrUndefined(check.maybeFailure),
    }
  })
}

const gameRule = (
  insideIp: string,
  options: Readonly<{ proto?: Proto; outsidePort?: number }> = {},
) =>
  forward('router', {
    proto: options.proto ?? 'tcp',
    outsidePort: options.outsidePort ?? 25565,
    insideIp,
    insidePort: 25565,
  })

const playOf = (index: number): Play =>
  Option.getOrThrow(
    Array.findFirst(
      lesson.steps[index]!.stage,
      (item): item is Play => item._tag === 'Play',
    ),
  )

/** Трасса, которую проигрывает сцена шага: после невидимой подготовки. */
const shownTrace = (index: number): Trace => {
  const play = playOf(index)
  const world = boardAt(lesson, index, {})
  return sendIntent(foldWorld(world, play.after ?? []), play.intent)[0]
}

const ipOf = (envelope: ReadonlyArray<Layer>) =>
  Array.findFirst(
    envelope,
    (layer): layer is Extract<Layer, { _tag: 'Ip' }> => layer._tag === 'Ip',
  )

const legsOf = (world: PacketDoc, index: number) => {
  const layout = layoutBoard({
    doc: world.doc,
    unlocked,
    isNarrow: false,
    isCloudOpen: false,
    maybeFog: Option.none(),
    rooms: [],
    moved: {},
    text: id => ({ title: id, sub: '', hint: '' }),
  })
  return timelineOf({
    world,
    stage: lesson.steps[index]!.stage,
    layout,
    unlocked,
  })
}

describe('lesson 9: NAT and port forwarding', () => {
  test('step 1: the phone and the friend’s PC both have 192.168.1.100; the envelope to .42 never leaves his home', () => {
    const index = stepIndex('home-only')
    const world = boardAt(lesson, index, {})
    const run = kind.run(world)
    expect([
      addressOf(world.doc, run.settled, 'phone'),
      addressOf(world.doc, run.settled, 'friend'),
    ]).toEqual([Option.some('192.168.1.100'), Option.some('192.168.1.100')])
    const [ping] = sendIntent(world, playOf(index).intent)
    expect(ping.outcome).toMatchObject({
      _tag: 'Dropped',
      at: 'friend',
      reason: { _tag: 'ArpNoReply', device: 'friend', ip: '192.168.1.42' },
    })
    expect(
      Array.every(
        ping.hops,
        hop =>
          Array.contains(['friend', 'friend-router'], hop.from) &&
          Array.contains(['friend', 'friend-router'], hop.to),
      ),
    ).toBe(true)
  })

  test('step 2: past the router the return address is 203.0.113.7, and the NAT table gets one new row', () => {
    const index = stepIndex('nat')
    const page = shownTrace(index)
    expect(page.outcome).toMatchObject({ _tag: 'Delivered', at: 'shop' })
    expect(
      Array.some(page.hops, hop =>
        Array.some(hop.envelope, layer => layer._tag === 'Dns'),
      ),
    ).toBe(false)
    const outside = Array.filter(
      page.hops,
      hop => hop.from === 'router' && hop.to === 'internet',
    )
    expect(Array.isReadonlyArrayNonEmpty(outside)).toBe(true)
    outside.forEach(hop =>
      expect(Option.map(ipOf(hop.envelope), ip => ip.src)).toEqual(
        Option.some('203.0.113.7'),
      ),
    )
    const rows = Array.flatMap(page.hops, hop =>
      Array.filter(hop.changes, change => change._tag === 'NatAdded'),
    )
    expect(rows).toEqual([
      expect.objectContaining({
        router: 'router',
        proto: 'tcp',
        inside: '192.168.1.42',
        outside: '203.0.113.7',
        remote: '198.51.100.10',
        remotePort: 443,
      }),
    ])
    expect(boardAt(lesson, index, {}).state.nat).toEqual([])
  })

  test('step 2: the board stops before and after the router, there and back', () => {
    const index = stepIndex('nat')
    const timeline = legsOf(boardAt(lesson, index, {}), index)
    expect(
      Array.map(
        timeline.legs,
        leg => `${leg.from}>${leg.to}${leg.isReply ? '*' : ''}`,
      ),
    ).toEqual([
      'laptop>router',
      'router>internet',
      'internet>shop',
      'shop>internet*',
      'internet>router*',
      'router>laptop*',
    ])
    expect(timeline.pauses).toHaveLength(4)
  })

  test('step 3: the friend’s envelope to 203.0.113.7:25565 dies on the router without a NAT row', () => {
    const world = boardAt(lesson, stepIndex('no-way-in'), {})
    const [game] = sendIntent(world, friendGame)
    expect(game.outcome).toEqual({
      _tag: 'Dropped',
      at: 'router',
      reason: {
        _tag: 'NatNoMapping',
        router: 'router',
        proto: 'tcp',
        port: 25565,
      },
    })
    expect(
      Array.some(game.hops, hop =>
        Array.some(
          hop.changes,
          change =>
            change._tag === 'NatAdded' && change.router === 'friend-router',
        ),
      ),
    ).toBe(true)
  })

  test('the quiz answer is what the shop sees, 203.0.113.7, one of the chips', () => {
    const index = stepIndex('what-site-sees')
    const world = boardAt(lesson, index, {})
    const quiz = Option.getOrThrow(quizOf(lesson.steps[index]!))
    expect(quizAnswer(quiz, world, kind.run(world))).toBe('203.0.113.7')
    expect(quiz.candidates).toContain('203.0.113.7')
    expect(sourceAddressSeenBy(sendIntent(world, shopPage)[0], 'shop')).toEqual(
      Option.some('203.0.113.7'),
    )
  })

  test('task start: the PC has .102 from DHCP, only the security goal is met', () => {
    expect(addressOf(start.doc, kind.run(start).settled, 'pc')).toEqual(
      Option.some('192.168.1.102'),
    )
    expect(goalsAfter([])).toEqual([
      {
        id: 'pc-address',
        met: false,
        failure: expect.objectContaining({ _tag: 'GoalWrongAddress' }),
      },
      {
        id: 'friend-in',
        met: false,
        failure: expect.objectContaining({ _tag: 'NatNoMapping', port: 25565 }),
      },
      { id: 'only-game', met: true, failure: undefined },
    ])
  })

  test('the reference reserves .50 and forwards TCP 25565 only; it meets every goal', () => {
    expect(task.solution).toEqual([
      reserve('router', macFromId('pc'), '192.168.1.50'),
      gameRule('192.168.1.50'),
    ])
    expect(goalsAfter(task.solution).every(goal => goal.met)).toBe(true)
    const [game] = sendIntent(foldDoc(kind, start, task.solution), friendGame)
    expect(game.outcome).toMatchObject({
      _tag: 'Delivered',
      at: 'pc',
      answer: { _tag: 'Connected', seenFrom: '203.0.113.77' },
    })
  })

  test('forwarding 5432 too breaks only-game and names the database port', () => {
    expect(
      goalsAfter([
        ...task.solution,
        forward('router', {
          proto: 'tcp',
          outsidePort: 5432,
          insideIp: '192.168.1.50',
          insidePort: 5432,
        }),
      ])[2],
    ).toEqual({
      id: 'only-game',
      met: false,
      failure: expect.objectContaining({
        _tag: 'GoalExtraOpenPort',
        port: 5432,
        device: 'pc',
      }),
    })
  })

  test('typical mistakes from the script get their own messages', () => {
    const reserved = reserve('router', macFromId('pc'), '192.168.1.50')
    const notReserved = goalsAfter([gameRule('192.168.1.102')])
    expect(Array.map(notReserved, goal => goal.met)).toEqual([
      false,
      true,
      true,
    ])
    expect(goalsAfter([gameRule('192.168.1.50')])[1]?.failure).toMatchObject({
      _tag: 'ArpNoReply',
      device: 'router',
      ip: '192.168.1.50',
    })
    expect(
      goalsAfter([reserved, gameRule('192.168.1.42')])[1]?.failure,
    ).toEqual(
      expect.objectContaining({
        _tag: 'PortClosed',
        device: 'laptop',
        port: 25565,
      }),
    )
    expect(
      goalsAfter([reserved, gameRule('192.168.1.50', { proto: 'udp' })])[1]
        ?.failure,
    ).toMatchObject({ _tag: 'NatNoMapping', proto: 'tcp', port: 25565 })
    expect(
      goalsAfter([
        reserved,
        gameRule('192.168.1.50', { outsidePort: 25566 }),
      ])[1]?.failure,
    ).toMatchObject({ _tag: 'NatNoMapping', port: 25565 })
    expect(
      Result.getFailure(
        kind.apply(start, reserve('router', macFromId('pc'), '192.168.1.42')),
      ),
    ).toEqual(
      Option.some(
        expect.objectContaining({
          _tag: 'ReservationTaken',
          ip: '192.168.1.42',
        }),
      ),
    )
    expect(
      Result.getFailure(
        kind.apply(start, reserve('router', macFromId('pc'), '192.168.2.50')),
      ),
    ).toEqual(
      Option.some(
        expect.objectContaining({ _tag: 'ReservationOutsideSubnet' }),
      ),
    )
  })
})
