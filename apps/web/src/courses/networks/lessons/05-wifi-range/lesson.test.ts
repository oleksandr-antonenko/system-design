import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import { visibleTabs } from '../../../../kinds/packet/surfaces/panel/panel'
import { routerPanel } from '../../../../kinds/packet/surfaces/panel/router'
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
import { configureWifi, wifi } from '../../../../net/build'
import { checkGoal } from '../../../../net/goals'
import type { NetMessage } from '../../../../net/message'
import { associationOf, hostLinkOf } from '../../../../net/topology'
import { findCourse, unlockedFeatures } from '../../../registry'
import wifiRange from './lesson'

// Проверки урока 5 из сценария (раздел 8): кто на каком диапазоне по шагам,
// ответ квиза, сломанная сеть в начале задачи, эталон и типичные ошибки.

const lesson: LessonDefinition<PacketTypes> = wifiRange

const kind = lesson.kind

const stepIndex = (id: string): number =>
  lesson.steps.findIndex(lessonStep => lessonStep.id === id)

const TASK = stepIndex('kitchen-wifi')

const task = Option.getOrThrow(taskOf(lesson.steps[TASK]!))

const association = (world: PacketDoc, device: string) =>
  Option.flatMap(hostLinkOf(world.doc, device), link =>
    associationOf(world.doc, link),
  )

const bandOf = (world: PacketDoc, device: string) =>
  Option.flatMap(association(world, device), current =>
    current._tag === 'Associated' ? Option.some(current.band) : Option.none(),
  )

const reasonOf = (world: PacketDoc, device: string) =>
  Option.flatMap(association(world, device), current =>
    current._tag === 'NotAssociated'
      ? Option.some(current.reason._tag)
      : Option.none(),
  )

const start = taskStartBoard(lesson, TASK, {})

const goalsAfter = (ops: ReadonlyArray<PacketTypes['Op']>) => {
  const world = foldDoc(kind, start, ops)
  const run = kind.run(world)
  return Array.map(task.goals, ({ id, goal }) => {
    const check = checkGoal(world.doc, run.settled, goal)
    return {
      id,
      met: check.met,
      failure: Option.map(
        check.maybeFailure,
        (message: NetMessage) => message._tag,
      ),
    }
  })
}

describe('lesson 5: Wi-Fi range', () => {
  test('steps 1–3: phone and laptop are online; in the kitchen the phone is on 2.4, the laptop on 5', () => {
    const plan = boardAt(lesson, stepIndex('floor-plan'), {})
    expect(bandOf(plan, 'phone')).toEqual(Option.some('5'))
    expect(bandOf(plan, 'laptop')).toEqual(Option.some('5'))
    const kitchen = boardAt(lesson, stepIndex('two-bands'), {})
    expect(bandOf(kitchen, 'phone')).toEqual(Option.some('2.4'))
    expect(bandOf(kitchen, 'laptop')).toEqual(Option.some('5'))
  })

  test('step 4: the answer is the phone; the laptop stays online, the printer is on a cable', () => {
    const index = stepIndex('who-drops')
    const world = boardAt(lesson, index, {})
    const quiz = Option.getOrThrow(quizOf(lesson.steps[index]!))
    expect(quizAnswer(quiz, world, kind.run(world))).toBe('phone')
    expect(bandOf(world, 'laptop')).toEqual(Option.some('5'))
    expect(reasonOf(world, 'phone')).toEqual(Option.some('OutOfRange'))
    expect(association(world, 'printer')).toEqual(Option.none())
  })

  test('task start: the phone is out of range, the bulb does not speak 5 GHz', () => {
    expect(reasonOf(start, 'phone')).toEqual(Option.some('OutOfRange'))
    expect(reasonOf(start, 'bulb')).toEqual(Option.some('BandUnsupported'))
  })

  test('both bands meet every goal; the laptop keeps 5 GHz', () => {
    expect(goalsAfter(task.solution).every(goal => goal.met)).toBe(true)
    const solved = foldDoc(kind, start, task.solution)
    expect(bandOf(solved, 'phone')).toEqual(Option.some('2.4'))
    expect(bandOf(solved, 'bulb')).toEqual(Option.some('2.4'))
    expect(bandOf(solved, 'laptop')).toEqual(Option.some('5'))
  })

  test('2.4 GHz only also works, but the laptop slows down', () => {
    const only24 = [
      configureWifi('router', wifi('Router-7C21', '12345678', { band: '2.4' })),
    ]
    expect(goalsAfter(only24).every(goal => goal.met)).toBe(true)
    expect(bandOf(foldDoc(kind, start, only24), 'laptop')).toEqual(
      Option.some('2.4'),
    )
  })

  test('an open network fails the password goal', () => {
    expect(
      goalsAfter([
        configureWifi(
          'router',
          wifi('Router-7C21', '12345678', { band: 'dual', security: 'open' }),
        ),
      ]),
    ).toEqual([
      { id: 'phone', met: true, failure: Option.none() },
      { id: 'bulb', met: true, failure: Option.none() },
      { id: 'password', met: false, failure: Option.some('GoalWifiTooWeak') },
    ])
  })

  test('a new name or password drops everyone with the model’s reason', () => {
    const renamed = foldDoc(kind, start, [
      configureWifi('router', wifi('Kitchen', '12345678', { band: 'dual' })),
    ])
    expect(reasonOf(renamed, 'phone')).toEqual(Option.some('WrongSsid'))
    const repassworded = foldDoc(kind, start, [
      configureWifi(
        'router',
        wifi('Router-7C21', 'new-password', { band: 'dual' }),
      ),
    ])
    expect(reasonOf(repassworded, 'laptop')).toEqual(
      Option.some('WrongPassword'),
    )
  })

  test('a password under 8 characters is refused', () => {
    expect(
      Result.getFailure(
        kind.apply(
          start,
          configureWifi(
            'router',
            wifi('Router-7C21', '1234', { band: 'dual' }),
          ),
        ),
      ).pipe(Option.map(message => message._tag)),
    ).toEqual(Option.some('WifiPasswordTooShort'))
  })

  test('no terminal or browser; the router panel shows only the Wi-Fi tab', () => {
    expect(taskSurfaces(task)).toEqual(['board', 'router'])
    const unlocked = Option.match(findCourse('networks'), {
      onNone: () => [],
      onSome: course => unlockedFeatures(course.definition, 5),
    })
    expect(visibleTabs(routerPanel, unlocked).map(tab => tab.id)).toEqual([
      'wifi',
    ])
  })
})
