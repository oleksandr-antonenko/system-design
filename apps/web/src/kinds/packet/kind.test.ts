import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import addresses from '../../courses/networks/lessons/02-addresses/lesson'
import { boardAt, foldDoc, taskOf, taskStartBoard } from '../../lesson/dsl'
import { referencedIds } from '../../lesson/markup'
import { cable, joinWifi, run, send, unplug } from '../../net/build'
import { Goal } from '../../net/goals'
import { Intent } from '../../net/packet'
import { buildWorld, chainOps } from '../../net/testing'
import type { PacketTypes } from '../types'
import { isAddressOpen } from './picture'
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

    expect(start.doc.devices).toHaveLength(4)
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

    expect(before.state.performed).toEqual([])
    expect(after.state.performed).toHaveLength(1)
    expect(after.state.performed[0]?.delivered).toBe(true)
    expect(after.state.arp.length).toBeGreaterThan(before.state.arp.length)
  })

  test('a wrong password is a refusal-free op whose goal names the reason', () => {
    const start = taskStartBoard(phoneOnline, TASK_STEP, {})
    const wrong = Result.getOrThrow(
      kind.apply(start, joinWifi('phone', 'Home', '12345678')),
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

  test('a ping in the terminal plays its echo once, through the open cloud of transit routers', () => {
    const world = buildWorld(chainOps)
    expect(kind.moveStage(world, run('laptop', 'ping shop.example'))).toEqual([
      { _tag: 'Expand', target: 'internet' },
      {
        _tag: 'Play',
        intent: Intent.Ping({ from: 'laptop', host: 'shop.example' }),
      },
    ])
    expect(
      kind.moveStage(
        taskStartBoard(phoneOnline, TASK_STEP, {}),
        send(Intent.Ping({ from: 'phone', host: '198.51.100.10' })),
      ),
    ).toEqual([
      {
        _tag: 'Play',
        intent: Intent.Ping({ from: 'phone', host: '198.51.100.10' }),
      },
    ])
  })

  test('transit routers show their address only from lesson 8, with the route tables', () => {
    const world = buildWorld(chainOps)
    const open = (unlocked: ReadonlyArray<string>, id: string) =>
      isAddressOpen({ doc: world, unlocked }, id)
    expect(open(['board.addresses'], 'router')).toBe(true)
    expect(open(['board.addresses'], 'isp')).toBe(false)
    expect(open(['board.addresses', 'board.routes'], 'isp')).toBe(true)
    expect(open([], 'router')).toBe(false)
  })

  test('the journal names each operation; ops round-trip through the stored union', () => {
    const op = joinWifi('phone', 'Home', 'correct-horse')

    expect(kind.describeOp(op)).toBe('JoinWifi phone · Home · correct-horse')
    expect(kind.op.unwrap(kind.op.wrap(op))).toEqual(Option.some(op))
    expect(
      kind.describeOp(
        send(Intent.Ping({ from: 'phone', host: '198.51.100.10' })),
      ),
    ).toBe('Send Ping phone · 198.51.100.10')
  })

  test('a cable that gives a host its address plays how the host asks for it', () => {
    const start = taskStartBoard(addresses, 3, {})
    const plugged = cable('printer', 'router')

    expect(kind.moveStage(start, plugged)).toEqual([
      {
        _tag: 'Play',
        intent: Intent.DhcpJoin({ device: 'printer' }),
        after: [plugged],
      },
    ])
    expect(kind.moveStage(start, cable('printer', 'internet'))).toEqual([])
    expect(
      kind.moveStage(
        foldDoc(kind, start, [plugged]),
        unplug('printer', 'router'),
      ),
    ).toEqual([])
  })
})
