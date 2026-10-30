import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import {
  printoutFeatures,
  terminalFeatures,
} from '../../../../kinds/packet/surfaces/unlocks'
import type { PacketTypes } from '../../../../kinds/types'
import {
  type LessonDefinition,
  boardAt,
  foldDoc,
  taskOf,
  taskStartBoard,
} from '../../../../lesson/dsl'
import { quizAnswer, quizOf } from '../../../../lesson/quiz'
import { deathDeviceOf } from '../../../../net/answers'
import { setLinkUp } from '../../../../net/build'
import { checkGoal } from '../../../../net/goals'
import { Intent } from '../../../../net/packet'
import { runCommand } from '../../../../net/terminal'
import { routeOf } from '../../../../net/testing'
import { runInTerminal, sendIntent } from '../../../../net/world'
import { unlockedFeatures } from '../../../registry'
import course from '../../course'
import hopsAndPing, { echoMs } from './lesson'

// Проверки урока 4 из сценария (раздел 8, «Что проверяют тесты контента»):
// путь до сайта и числа ping совпадают с движком, ответ квиза считает
// движок, обрыв на старте задачи виден ping'ом, эталон чинит обе цели, и в
// терминале к уроку 4 открыт только ping.

const lesson: LessonDefinition<PacketTypes> = hopsAndPing

const kind = lesson.kind

const stepIndex = (id: string): number =>
  lesson.steps.findIndex(lessonStep => lessonStep.id === id)

const TASK = stepIndex('find-break')

const task = Option.getOrThrow(taskOf(lesson.steps[TASK]!))

const unlocked = unlockedFeatures(course, 4)

const shopPage = Intent.Browse({ from: 'laptop', url: 'https://shop.example/' })

const ping = (world: PacketDoc, line: string) =>
  runCommand(world.doc, world.state, 'laptop', line, terminalFeatures(unlocked))

const goalsAfter = (ops: ReadonlyArray<PacketTypes['Op']>) => {
  const world = foldDoc(kind, taskStartBoard(lesson, TASK, {}), ops)
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

describe('lesson 4: hops and ping', () => {
  test('the way to the shop is five hops; ping takes 6 ms to the router and 90 ms to the shop', () => {
    const world = boardAt(lesson, stepIndex('chain'), {})
    const page = sendIntent(world, shopPage)[0]
    const request = Option.getOrThrow(
      Array.findFirst(page.hops, hop =>
        Array.some(hop.envelope, layer => layer._tag === 'Http'),
      ),
    ).packet
    expect(routeOf(page, request)).toEqual([
      'laptop>router',
      'router>isp',
      'isp>core',
      'core>hosting',
      'hosting>shop',
    ])
    expect(ping(world, 'ping 192.168.1.1').output[1]).toBe(
      '64 bytes from 192.168.1.1: icmp_seq=0 time=6 ms',
    )
    expect(echoMs(boardAt(lesson, stepIndex('ping'), {}))).toBe(90)
  })

  test('step 2: the printout is the script’s ping, without ttl until lesson 8', () => {
    const world = boardAt(lesson, stepIndex('ping'), {})
    expect(
      runInTerminal(
        world,
        'laptop',
        'ping shop.example',
        printoutFeatures(unlocked),
      )[0].output,
    ).toEqual([
      'PING shop.example (198.51.100.10): 56 data bytes',
      '64 bytes from 198.51.100.10: icmp_seq=0 time=90 ms',
      '64 bytes from 198.51.100.10: icmp_seq=1 time=90 ms',
      '64 bytes from 198.51.100.10: icmp_seq=2 time=90 ms',
      '',
      '--- shop.example ping statistics ---',
      '3 packets transmitted, 3 packets received, 0.0% packet loss',
    ])
  })

  test('the quiz answer is the core router, and it is one of the candidates', () => {
    const index = stepIndex('next-hop')
    const world = boardAt(lesson, index, {})
    const quiz = Option.getOrThrow(quizOf(lesson.steps[index]!))
    expect(quizAnswer(quiz, world, kind.run(world))).toBe('core')
    expect(quiz.candidates).toContain('core')
  })

  test('task start: the router answers, the ping to the shop dies at the router; no goal is met', () => {
    const start = taskStartBoard(lesson, TASK, {})
    expect(ping(start, 'ping 192.168.1.1').output.slice(1, 4)).toEqual([
      '64 bytes from 192.168.1.1: icmp_seq=0 time=6 ms',
      '64 bytes from 192.168.1.1: icmp_seq=1 time=6 ms',
      '64 bytes from 192.168.1.1: icmp_seq=2 time=6 ms',
    ])
    const shop = ping(start, 'ping shop.example')
    expect(shop.output).toEqual([
      'PING shop.example (198.51.100.10): 56 data bytes',
      'Request timeout for icmp_seq 0',
      'Request timeout for icmp_seq 1',
      'Request timeout for icmp_seq 2',
      '',
      '--- shop.example ping statistics ---',
      '3 packets transmitted, 0 packets received, 100.0% packet loss',
    ])
    expect(Array.map(shop.traces, deathDeviceOf)).toEqual(
      Array.replicate(Option.some('router'), 3),
    )
    expect(goalsAfter([])).toEqual([
      { id: 'site-opens', met: false, failure: Option.some('NoWanLink') },
      {
        id: 'ping-site',
        met: false,
        failure: Option.some('GoalNotPerformed'),
      },
    ])
  })

  test('the reference solution meets both goals; a cable without a new ping leaves the ping goal', () => {
    expect(goalsAfter(task.solution).every(goal => goal.met)).toBe(true)
    expect(goalsAfter([setLinkUp('router', 'isp', true)])).toEqual([
      { id: 'site-opens', met: true, failure: Option.none() },
      {
        id: 'ping-site',
        met: false,
        failure: Option.some('GoalNotPerformed'),
      },
    ])
  })

  test('the terminal of lesson 4 knows only ping; traceroute is locked', () => {
    expect(terminalFeatures(unlocked)).toEqual(['ping'])
    const start = taskStartBoard(lesson, TASK, {})
    expect(
      Option.map(ping(start, 'traceroute shop.example').maybeHint, hint =>
        hint._tag === 'CommandLocked' ? hint.command : hint._tag,
      ),
    ).toEqual(Option.some('traceroute'))
  })
})
