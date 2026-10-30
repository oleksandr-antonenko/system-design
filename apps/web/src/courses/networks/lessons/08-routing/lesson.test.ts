import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import { layoutBoard } from '../../../../kinds/packet/layout'
import {
  printoutFeatures,
  terminalFeatures,
} from '../../../../kinds/packet/surfaces/unlocks'
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
import { macFromId } from '../../../../net/address'
import { setStatic, useDhcp } from '../../../../net/build'
import { checkGoal } from '../../../../net/goals'
import { NetMessage } from '../../../../net/message'
import { Intent } from '../../../../net/packet'
import { runCommand } from '../../../../net/terminal'
import { routeOf } from '../../../../net/testing'
import { applyWorld, runInTerminal, sendIntent } from '../../../../net/world'
import { unlockedFeatures } from '../../../registry'
import course from '../../course'
import routing from './lesson'

// Проверки урока 8 из сценария (раздел 8, «Проверки контента»): конверт
// «не в наш дом» уходит на MAC router; таблицы ведут конверт по строкам;
// traceroute доходит до сайта за 5 hops и печатает строки сценария; ответ
// квиза — core; на старте задачи выполнена только цель «принтер», эталон и
// «Автоматически» выполняют все три; урок пользуется только открытым к нему.

const lesson: LessonDefinition<PacketTypes> = routing

const kind = lesson.kind

const stepIndex = (id: string): number =>
  lesson.steps.findIndex(lessonStep => lessonStep.id === id)

const TASK = stepIndex('fix-gateway')

const task = Option.getOrThrow(taskOf(lesson.steps[TASK]!))

const unlocked = unlockedFeatures(course, 8)

const shopPage = Intent.Browse({ from: 'laptop', url: 'https://shop.example/' })

const say = (world: PacketDoc, line: string): ReadonlyArray<string> =>
  runCommand(world.doc, world.state, 'laptop', line, terminalFeatures(unlocked))
    .output

const TRACEROUTE = [
  'traceroute to shop.example (198.51.100.10), 30 hops max, 60 byte packets',
  ' 1  192.168.1.1 (192.168.1.1)  6.0 ms  6.2 ms  6.1 ms',
  ' 2  gw.isp.example (203.0.113.1)  8.0 ms  8.2 ms  8.1 ms',
  ' 3  core.isp.example (192.0.2.1)  48.0 ms  48.2 ms  48.1 ms',
  ' 4  gw.hosting.example (198.51.100.1)  88.0 ms  88.2 ms  88.1 ms',
  ' 5  shop.example (198.51.100.10)  90.0 ms  90.2 ms  90.1 ms',
]

/** После задачи доска — с ходами ученика: здесь с эталоном. */
const solved = { 'fix-gateway': task.solution }

const printed = (index: number): ReadonlyArray<string> =>
  runInTerminal(
    boardAt(lesson, index, solved),
    'laptop',
    'traceroute shop.example',
    printoutFeatures(unlocked),
  )[0].output

const legsOf = (index: number): ReadonlyArray<string> => {
  const world = boardAt(lesson, index, {})
  const layout = layoutBoard({
    doc: world.doc,
    unlocked,
    isNarrow: false,
    isCloudOpen: true,
    maybeFog: Option.none(),
    rooms: [],
    moved: {},
    text: id => ({ title: id, sub: '', hint: '' }),
  })
  return Array.map(
    timelineOf({ world, stage: lesson.steps[index]!.stage, layout, unlocked })
      .legs,
    leg => `${leg.from}>${leg.to}${leg.isReply ? '*' : ''}`,
  )
}

const goalsAfter = (ops: ReadonlyArray<PacketTypes['Op']>) => {
  const world = foldDoc(kind, taskStartBoard(lesson, TASK, {}), ops)
  const run = kind.run(world)
  return Array.map(task.goals, ({ id, goal }) => {
    const check = checkGoal(world.doc, run.settled, goal)
    return { id, met: check.met, failure: check.maybeFailure }
  })
}

describe('lesson 8: routing and the gateway', () => {
  test('step 1: to the printer the outer envelope carries the printer’s MAC, to the shop the router’s', () => {
    const world = boardAt(lesson, stepIndex('gateway'), {})
    const firstLetter = (host: string) => {
      const trace = sendIntent(world, Intent.Ping({ from: 'laptop', host }))[0]
      return Option.getOrThrow(
        Array.findFirst(trace.hops, hop =>
          Array.some(
            hop.envelope,
            layer => layer._tag === 'Icmp' && layer.kind === 'echo-request',
          ),
        ),
      )
    }
    const toPrinter = firstLetter('192.168.1.101')
    expect(toPrinter.envelope[0]).toMatchObject({
      _tag: 'WiFi',
      dst: macFromId('printer'),
    })
    const toShop = firstLetter('198.51.100.10')
    expect(toShop.envelope[0]).toMatchObject({
      _tag: 'WiFi',
      dst: macFromId('router'),
    })
    expect(toShop.maybeRoute).toEqual(
      Option.some({
        device: 'laptop',
        kind: 'default',
        network: '0.0.0.0',
        prefix: 0,
        maybeVia: Option.some('192.168.1.1'),
      }),
    )
  })

  test('step 2: the page goes there and back without a DNS question; each router takes its table line', () => {
    const index = stepIndex('route-tables')
    expect(legsOf(index)).toEqual([
      'laptop>router',
      'router>isp',
      'isp>core',
      'core>hosting',
      'hosting>shop',
      'shop>hosting*',
      'hosting>core*',
      'core>isp*',
      'isp>router*',
      'router>laptop*',
    ])
    const page = sendIntent(boardAt(lesson, index, {}), shopPage)[0]
    const lines = Array.getSomes(
      Array.map(
        Array.filter(page.hops, hop =>
          Array.some(hop.envelope, layer => layer._tag === 'Http'),
        ),
        hop =>
          Option.map(
            hop.maybeRoute,
            route => `${route.device}: ${route.network}/${route.prefix}`,
          ),
      ),
    )
    expect(Array.take(lines, 5)).toEqual([
      'laptop: 0.0.0.0/0',
      'router: 0.0.0.0/0',
      'isp: 0.0.0.0/0',
      'core: 198.51.100.0/24',
      'hosting: 198.51.100.0/24',
    ])
  })

  test('step 3: traceroute reaches the shop in five hops, and the printout is the script’s', () => {
    const index = stepIndex('traceroute')
    expect(printed(index)).toEqual(TRACEROUTE)
    const world = boardAt(lesson, index, {})
    const trace = sendIntent(
      world,
      Intent.Traceroute({ from: 'laptop', host: 'shop.example' }),
    )[0]
    expect(trace.outcome).toMatchObject({
      _tag: 'Delivered',
      at: 'shop',
      answer: { _tag: 'Route', reached: true },
    })
    const lastProbe = Option.getOrThrow(
      Array.findLast(trace.hops, hop => hop.to === 'shop'),
    ).packet
    expect(routeOf(trace, lastProbe)).toEqual([
      'laptop>router',
      'router>isp',
      'isp>core',
      'core>hosting',
      'hosting>shop',
    ])
    expect(printed(stepIndex('summary'))).toEqual(TRACEROUTE)
  })

  test('from lesson 8 ping shows ttl= and the terminal knows traceroute and ip route', () => {
    const world = boardAt(lesson, stepIndex('gateway'), {})
    expect(say(world, 'ping 192.168.1.1')[1]).toBe(
      '64 bytes from 192.168.1.1: icmp_seq=0 ttl=64 time=6 ms',
    )
    expect(say(world, 'ip route')).toEqual([
      'default via 192.168.1.1 dev en0',
      '192.168.1.0/24 dev en0 src 192.168.1.42',
    ])
    expect(terminalFeatures(unlocked)).toEqual(
      expect.arrayContaining(['traceroute', 'ip.route', 'ping.ttl']),
    )
    expect(terminalFeatures(unlockedFeatures(course, 7))).not.toContain(
      'traceroute',
    )
  })

  test('step 4: three post offices answer, the rest is stars; the answer is core and the ping dies there quietly', () => {
    const index = stepIndex('where-it-breaks')
    expect(printed(index)).toEqual([
      ...Array.take(TRACEROUTE, 4),
      ' 4  * * *',
      ' 5  * * *',
      ' 6  * * *',
      '^C',
    ])
    const world = boardAt(lesson, index, {})
    const quiz = Option.getOrThrow(quizOf(lesson.steps[index]!))
    expect(quizAnswer(quiz, world, kind.run(world))).toBe('core')
    expect(quiz.candidates).toContain('core')
    expect(quiz.hideUntilAnswered).toEqual(['play', 'links'])
    expect(
      sendIntent(
        world,
        Intent.Ping({ from: 'laptop', host: '198.51.100.10' }),
      )[0].outcome,
    ).toMatchObject({
      _tag: 'Dropped',
      at: 'core',
      reason: NetMessage.FrameLost({ device: 'core' }),
    })
  })

  test('task start: a foreign gateway; only the printer goal is met; the terminal shows why', () => {
    const start = taskStartBoard(lesson, TASK, {})
    expect(goalsAfter([])).toEqual([
      {
        id: 'out',
        met: false,
        failure: Option.some(
          NetMessage.GatewayUnreachable({
            device: 'laptop',
            gateway: '192.168.1.254',
          }),
        ),
      },
      {
        id: 'site',
        met: false,
        failure: Option.some(
          NetMessage.GatewayUnreachable({
            device: 'laptop',
            gateway: '192.168.1.254',
          }),
        ),
      },
      { id: 'printer', met: true, failure: Option.none() },
    ])
    expect(say(start, 'ip route')).toEqual([
      'default via 192.168.1.254 dev en0',
      '192.168.1.0/24 dev en0 src 192.168.1.42',
    ])
    expect(say(start, 'ping 192.168.1.1')[1]).toBe(
      '64 bytes from 192.168.1.1: icmp_seq=0 ttl=64 time=6 ms',
    )
    expect(say(start, 'ping 198.51.100.10')[1]).toBe(
      'From 192.168.1.42 icmp_seq=0 Destination Host Unreachable',
    )
    expect(say(start, 'traceroute 198.51.100.10')).toEqual([
      'traceroute to 198.51.100.10 (198.51.100.10), 30 hops max, 60 byte packets',
      ' 1  192.168.1.42 (192.168.1.42)  3000.0 ms !H  3000.0 ms !H  3000.0 ms !H',
    ])
    expect(taskSurfaces(task)).toEqual([
      'board',
      'terminal:laptop',
      'wifi:laptop',
    ])
  })

  test('the reference and “Automatic” meet every goal; after it ip route shows the router', () => {
    const met = (ops: ReadonlyArray<PacketTypes['Op']>) =>
      Array.map(goalsAfter(ops), goal => goal.met)
    expect(met(task.solution)).toEqual([true, true, true])
    expect(met([useDhcp('laptop')])).toEqual([true, true, true])
    const fixed = foldDoc(kind, taskStartBoard(lesson, TASK, {}), task.solution)
    expect(say(fixed, 'ip route')[0]).toBe('default via 192.168.1.1 dev en0')
  })

  test('typical mistakes get the script’s explanations', () => {
    const outFailure = (ops: ReadonlyArray<PacketTypes['Op']>) =>
      Option.map(goalsAfter(ops)[0]!.failure, message => message._tag)
    const gateway = (ip: string) =>
      setStatic('laptop', '192.168.1.42/24', ip, '192.0.2.53')
    expect(outFailure([gateway('192.168.1.42')])).toEqual(
      Option.some('GatewayIsSelf'),
    )
    expect(outFailure([gateway('192.168.1.101')])).toEqual(
      Option.some('GatewayNotARouter'),
    )
    expect(
      outFailure([
        setStatic('laptop', '192.168.1.42/24', '192.168.1.254', '8.8.8.8'),
      ]),
    ).toEqual(Option.some('GatewayUnreachable'))
    expect(
      outFailure([
        setStatic('laptop', '192.168.1.42/24', undefined, '192.0.2.53'),
      ]),
    ).toEqual(Option.some('NoGateway'))
    const refused = applyWorld(
      taskStartBoard(lesson, TASK, {}),
      gateway('203.0.113.1'),
    )
    expect(
      Result.match(refused, {
        onSuccess: () => '',
        onFailure: refusal => refusal._tag,
      }),
    ).toBe('GatewayOutsideSubnet')
  })
})
