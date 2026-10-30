import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import type { PacketDoc } from '../../../../kinds/packet/doc'
import type { PacketTypes } from '../../../../kinds/types'
import {
  type LessonDefinition,
  boardAt,
  foldDoc,
  taskOf,
  taskStartBoard,
  taskSurfaces,
} from '../../../../lesson/dsl'
import { referencedIds } from '../../../../lesson/markup'
import { quizAnswer, quizOf } from '../../../../lesson/quiz'
import { cable, send } from '../../../../net/build'
import { checkGoal } from '../../../../net/goals'
import { Intent } from '../../../../net/packet'
import { addressOf } from '../../../../net/topology'
import { findCourse, findLesson, unlockedFeatures } from '../../../registry'
import addresses from './lesson'

// Проверки урока 2 из сценария (раздел 8, «Что проверяют тесты контента»):
// адреса из движка совпадают с числами в текстах, ответ квиза, задача и
// эталон, ссылки по шагам, открытые к уроку элементы и типичные ошибки.

const lesson: LessonDefinition<PacketTypes> = addresses

const kind = lesson.kind

const stepIndex = (id: string): number =>
  lesson.steps.findIndex(lessonStep => lessonStep.id === id)

const TASK = stepIndex('photo-and-printer')

const task = Option.getOrThrow(taskOf(lesson.steps[TASK]!))

const start = taskStartBoard(lesson, TASK, {})

const texts = Option.match(findLesson('networks', 'addresses'), {
  onNone: () => [],
  onSome: found => found.texts,
})

const address = (world: PacketDoc, device: string): Option.Option<string> =>
  addressOf(world.doc, kind.run(world).settled, device)

type GoalResult = Readonly<{
  id: string
  met: boolean
  failure: Option.Option<string>
}>

const goalsAfter = (
  ops: ReadonlyArray<PacketTypes['Op']>,
): ReadonlyArray<GoalResult> => {
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

const sendPhoto = (to: string) =>
  send(Intent.Send({ from: 'phone', to, what: 'photo' }))

const print = (to: string) =>
  send(Intent.Send({ from: 'laptop', to, what: 'document' }))

/** Где оказалась последняя отправка ученика. */
const lastSend = (ops: ReadonlyArray<PacketTypes['Op']>) =>
  Option.map(Array.last(foldDoc(kind, start, ops).state.performed), record => ({
    at: Option.getOrElse(record.maybeAt, () => ''),
    delivered: record.delivered,
  }))

const prose = (index: number): ReadonlyArray<string> =>
  Array.flatMap(texts, ({ text }) => {
    const body = text.steps?.[lesson.steps[index]!.id]?.body
    const world = boardAt(lesson, index, {})
    return [
      typeof body === 'string'
        ? body
        : body === undefined
          ? ''
          : body({ doc: world, run: kind.run(world) }),
    ]
  })

describe('lesson 2: everyone has an address', () => {
  test('the engine gives the phone .100 and the laptop .42; the texts quote the same numbers', () => {
    const home = boardAt(lesson, 0, {})
    expect(address(home, 'phone')).toEqual(Option.some('192.168.1.100'))
    expect(address(home, 'laptop')).toEqual(Option.some('192.168.1.42'))
    expect(address(home, 'router')).toEqual(Option.some('192.168.1.1'))
    expect(address(home, 'shop')).toEqual(Option.some('198.51.100.10'))
    prose(0).forEach(body => {
      expect(body).toContain('192.168.1.100')
      expect(body).toContain('192.168.1.42')
      expect(body).toContain('192.168.1.1')
      expect(body).toContain('198.51.100.10')
    })
    prose(stepIndex('router-gives')).forEach(body =>
      expect(body).toContain('192.168.1.100'),
    )
  })

  test('after the cable the printer gets .101, the number the hints and the AI template quote', () => {
    expect(address(start, 'printer')).toEqual(Option.none())
    const plugged = foldDoc(kind, start, [cable('printer', 'router')])
    expect(address(plugged, 'printer')).toEqual(Option.some('192.168.1.101'))
    expect(task.solution).toContainEqual(print('192.168.1.101'))
    texts.forEach(({ text }) =>
      expect(text.askAi?.template).toContain('192.168.1.101'),
    )
  })

  test('the quiz answer is the router, computed by the engine, and it is a candidate', () => {
    const index = stepIndex('who-gave')
    const world = boardAt(lesson, index, {})
    const quiz = Option.getOrThrow(quizOf(lesson.steps[index]!))
    const answer = quizAnswer(quiz, world, kind.run(world))
    expect(answer).toBe('router')
    expect(quiz.candidates).toContain(answer)
  })

  test('no goal is met at the start of the task; the solution meets all three', () => {
    expect(goalsAfter([]).map(goal => goal.met)).toEqual([false, false, false])
    expect(goalsAfter(task.solution).every(goal => goal.met)).toBe(true)
  })

  test('links point at devices of their step; the printer only in the task', () => {
    lesson.steps.forEach((lessonStep, index) => {
      const world =
        index === TASK
          ? start
          : boardAt(lesson, index, { [task.id]: task.solution })
      prose(index).forEach(body =>
        referencedIds(body).forEach(id =>
          expect(
            Array.some(world.doc.devices, device => device.id === id),
            `step ${lessonStep.id}: [[${id}|…]]`,
          ).toBe(true),
        ),
      )
      prose(index).forEach(body =>
        expect(referencedIds(body).includes('printer')).toBe(
          lessonStep.id === 'photo-and-printer',
        ),
      )
    })
    expect(
      Array.some(
        boardAt(lesson, stepIndex('who-gave'), {}).doc.devices,
        device => device.id === 'printer',
      ),
    ).toBe(false)
  })

  test('only what lesson 2 opens: addresses, cards, the cable, sending; no terminal or address bar', () => {
    const unlocked = Option.match(findCourse('networks'), {
      onNone: () => [],
      onSome: course => unlockedFeatures(course.definition, 2),
    })
    expect(unlocked).toEqual(
      expect.arrayContaining([
        'board.addresses',
        'board.deviceCard',
        'board.cable',
        'board.sendTo',
      ]),
    )
    expect(
      unlocked.filter(
        feature =>
          feature.startsWith('terminal.') || feature === 'browser.addressBar',
      ),
    ).toEqual([])
    expect(taskSurfaces(task)).toEqual(['board'])
  })
})

describe('lesson 2: typical wrong moves', () => {
  test('wrong addresses: the router, the phone itself, the shop; nobody at .43; not an address', () => {
    expect(lastSend([sendPhoto('192.168.1.1')])).toEqual(
      Option.some({ at: 'router', delivered: true }),
    )
    expect(lastSend([sendPhoto('192.168.1.100')])).toEqual(
      Option.some({ at: 'phone', delivered: true }),
    )
    expect(lastSend([sendPhoto('198.51.100.10')])).toEqual(
      Option.some({ at: 'shop', delivered: true }),
    )
    expect(lastSend([sendPhoto('192.168.1.43')])).toEqual(
      Option.some({ at: '', delivered: false }),
    )
    expect(lastSend([sendPhoto('192.168.142')])).toEqual(
      Option.some({ at: '', delivered: false }),
    )
    expect(goalsAfter([sendPhoto('192.168.1.1')])[0]).toEqual({
      id: 'photo',
      met: false,
      failure: Option.some('GoalNotPerformed'),
    })
  })

  test('the printer cannot be plugged into the laptop or the phone: one socket, taken by Wi-Fi', () => {
    ;['laptop', 'phone'].forEach(other =>
      expect(
        Result.getFailure(kind.apply(start, cable('printer', other))).pipe(
          Option.map(message => message._tag),
        ),
      ).toEqual(Option.some('PortBusy')),
    )
  })

  test('the printer on the internet cloud gets no address; before any cable it has no link', () => {
    expect(goalsAfter([cable('printer', 'internet')])[1]).toEqual({
      id: 'printer-address',
      met: false,
      failure: Option.some('NoDhcpServer'),
    })
    expect(goalsAfter([print('192.168.1.101')])[1]).toEqual({
      id: 'printer-address',
      met: false,
      failure: Option.some('NoLink'),
    })
    expect(lastSend([print('192.168.1.101')])).toEqual(
      Option.some({ at: '', delivered: false }),
    )
  })

  test('a print to the phone’s address lands on the phone', () => {
    expect(
      lastSend([cable('printer', 'router'), print('192.168.1.100')]),
    ).toEqual(Option.some({ at: 'phone', delivered: true }))
    expect(
      goalsAfter([
        sendPhoto('192.168.1.42'),
        cable('printer', 'router'),
        print('192.168.1.100'),
      ])[2],
    ).toEqual({
      id: 'printed',
      met: false,
      failure: Option.some('GoalNotPerformed'),
    })
  })

  test('every locale explains the lesson’s refusals in its own words', () => {
    texts.forEach(({ text }) =>
      expect(Object.keys(text.feedback ?? {}).sort()).toEqual([
        'GoalNotPerformed',
        'NoDhcpServer',
        'NoLink',
        'PortBusy',
      ]),
    )
  })
})
