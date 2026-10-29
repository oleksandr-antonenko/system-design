import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { boardAt, foldDoc, taskOf, taskStartBoard } from '../../lesson/dsl'
import { referencedIds } from '../../lesson/markup'
import { joinWifi } from '../../net/build'
import { Goal } from '../../net/goals'
import { Intent } from '../../net/packet'
import type { PacketTypes } from '../types'
import { edit, send } from './dsl'
import { phoneOnline } from './testing'

// Контракт вида доски на крошечном уроке сетей (design D6): документ —
// свёртка операций, состояние сети — свёртка трасс `send`, цели модели
// пакетов проверяются через `BoardKind`.

const kind = phoneOnline.kind
const TASK_STEP = 1

const solution = Option.getOrThrow(
  Option.flatMap(Array.get(phoneOnline.steps, TASK_STEP), step =>
    taskOf<PacketTypes>(step),
  ),
)

describe('packet board kind', () => {
  test('a step board is the fold of NetOps; the task starts unsolved', () => {
    const start = taskStartBoard(phoneOnline, TASK_STEP, {})
    const goal = Goal.Associated({ device: 'phone', ap: 'router' })
    const check = kind.checkGoal(start, kind.run(start), goal)

    expect(start.net.devices).toHaveLength(4)
    expect(check.met).toBe(false)
    expect(Option.map(check.maybeFailure, failure => failure._tag)).toEqual(
      Option.some('NoWifiProfile'),
    )
    expect(check.focusNodes).toContain('phone')
  })

  test('the reference solution meets the goal through the contract', () => {
    const start = taskStartBoard(phoneOnline, TASK_STEP, {})
    const solved = foldDoc(kind, start, solution.solution)

    expect(
      solution.goals.every(
        ({ goal }) => kind.checkGoal(solved, kind.run(solved), goal).met,
      ),
    ).toBe(true)
  })

  test('send folds a trace into the network state and keeps it', () => {
    const logs = { [solution.id]: solution.solution }
    const before = boardAt(phoneOnline, 1, logs)
    const after = boardAt(phoneOnline, 2, logs)

    expect(before.traces).toEqual([])
    expect(after.traces).toHaveLength(1)
    expect(after.traces[0]?.outcome._tag).toBe('Delivered')
    expect(after.state.arp.length).toBeGreaterThan(before.state.arp.length)
  })

  test('a wrong password is a refusal-free op whose goal names the reason', () => {
    const start = taskStartBoard(phoneOnline, TASK_STEP, {})
    const wrong = Result.getOrThrow(
      kind.apply(start, edit(joinWifi('phone', 'Home', '12345678'))),
    )
    const check = kind.checkGoal(
      wrong,
      kind.run(wrong),
      Goal.Associated({ device: 'phone', ap: 'router' }),
    )

    expect(Option.map(check.maybeFailure, failure => failure._tag)).toEqual(
      Option.some('WrongPassword'),
    )
  })

  test('targets: devices, links and envelope layers resolve; unknown ones do not', () => {
    const doc = taskStartBoard(phoneOnline, TASK_STEP, {})
    const resolves = (target: string) =>
      Option.isSome(kind.resolveTarget(doc, target))

    expect(resolves('router')).toBe(true)
    expect(resolves('link:phone-router')).toBe(true)
    expect(resolves('env:transport')).toBe(true)
    expect(resolves('printer')).toBe(false)
    expect(resolves('link:phone-shop')).toBe(false)
    expect(resolves('env:session')).toBe(false)
    expect(
      referencedIds('[[link:phone-router|радио]] и [[env:transport|TCP]]'),
    ).toEqual(['link:phone-router', 'env:transport'])
  })

  test('scene items name their targets; play never changes the document', () => {
    const online = Option.getOrThrow(Array.get(phoneOnline.steps, 2))
    const home = Option.getOrThrow(Array.get(phoneOnline.steps, 0))

    expect(Array.flatMap(online.stage, kind.stage.targets)).toEqual(['phone'])
    expect(
      Array.getSomes(Array.map(home.stage, kind.stage.annotationKey)),
    ).toEqual(['door'])
  })

  test('the journal names each operation; ops round-trip through the stored union', () => {
    const op = edit(joinWifi('phone', 'Home', 'correct-horse'))

    expect(kind.describeOp(op)).toBe('JoinWifi phone · Home · correct-horse')
    expect(kind.op.unwrap(kind.op.wrap(op))).toEqual(Option.some(op))
    expect(
      kind.describeOp(
        send(Intent.Ping({ from: 'phone', ip: '198.51.100.10' })),
      ),
    ).toBe('Send Ping phone · 198.51.100.10')
  })
})
