import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import {
  add,
  cable,
  host,
  networkSwitch,
  radio,
  router,
  setLinkUp,
  wifi,
} from './build'
import { NetOp } from './doc'
import {
  Goal,
  type GoalCheck,
  allGoalsMet,
  checkGoal,
  countMet,
  firstFailedGoal,
} from './goals'
import { NetMessage } from './message'
import { Addressing, type NetDoc, emptyState } from './model'
import { Intent } from './packet'
import { buildNet, homeNet } from './testing'

const check = (doc: NetDoc, goal: Goal): GoalCheck =>
  checkGoal(doc, emptyState, goal)

const failureOf = (doc: NetDoc, goal: Goal): NetMessage =>
  Option.getOrThrowWith(
    check(doc, goal).maybeFailure,
    () => new Error('goal is met'),
  )

describe('link goals', () => {
  test('Linked checks presence, medium and state, and focuses the link', () => {
    const doc = homeNet()
    expect(
      check(
        doc,
        Goal.Linked({ a: 'internet', b: 'router', maybeMedium: Option.none() }),
      ).met,
    ).toBe(true)
    expect(
      failureOf(
        doc,
        Goal.Linked({
          a: 'phone',
          b: 'router',
          maybeMedium: Option.some('cable'),
        }),
      ),
    ).toEqual(
      NetMessage.GoalWrongMedium({ a: 'phone', b: 'router', want: 'cable' }),
    )
    const down = buildNet([setLinkUp('router', 'internet', false)], doc)
    const failed = check(
      down,
      Goal.Linked({ a: 'router', b: 'internet', maybeMedium: Option.none() }),
    )
    expect(failed.maybeFailure).toEqual(
      Option.some(NetMessage.GoalLinkDown({ a: 'router', b: 'internet' })),
    )
    expect(failed.focusLinks).toEqual(['router-internet'])
    expect(
      failureOf(
        doc,
        Goal.Linked({ a: 'phone', b: 'shop', maybeMedium: Option.none() }),
      ),
    ).toEqual(NetMessage.GoalNotLinked({ a: 'phone', b: 'shop' }))
  })

  test('Associated needs a radio link to that access point', () => {
    expect(
      failureOf(homeNet(), Goal.Associated({ device: 'phone', ap: 'shop' })),
    ).toEqual(NetMessage.GoalNoRadioLink({ device: 'phone', ap: 'shop' }))
  })
})

describe('address goals', () => {
  test('HasAddress: DHCP hosts settle first; a wanted address is compared', () => {
    const doc = homeNet()
    expect(
      check(doc, Goal.HasAddress({ device: 'phone', maybeIp: Option.none() }))
        .met,
    ).toBe(true)
    expect(
      check(
        doc,
        Goal.HasAddress({
          device: 'laptop',
          maybeIp: Option.some('192.168.1.42'),
        }),
      ).met,
    ).toBe(true)
    expect(
      failureOf(
        doc,
        Goal.HasAddress({
          device: 'phone',
          maybeIp: Option.some('192.168.1.23'),
        }),
      ),
    ).toEqual(
      NetMessage.GoalWrongAddress({
        device: 'phone',
        have: '192.168.1.100',
        want: '192.168.1.23',
      }),
    )
    const unset = buildNet(
      [
        NetOp.SetAddressing({
          device: 'phone',
          addressing: Addressing.Unset(),
        }),
      ],
      doc,
    )
    expect(
      failureOf(
        unset,
        Goal.HasAddress({ device: 'phone', maybeIp: Option.none() }),
      ),
    ).toEqual(NetMessage.NoAddress({ device: 'phone' }))
    expect(
      failureOf(
        doc,
        Goal.HasAddress({ device: 'router', maybeIp: Option.none() }),
      ),
    ).toEqual(NetMessage.NotAHost({ id: 'router' }))
  })

  test('NoAddressConflict compares addresses inside one segment only', () => {
    const neighbours = buildNet(
      [
        add(
          router('router2', 340, 760, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.8',
            wifi: wifi('Neighbours', 'their-secret'),
          }),
        ),
        cable('router2', 'internet'),
        add(networkSwitch('switch2', 340, 860)),
        cable('switch2', 'router2'),
        add(host('their-pc', 'pc', 200, 900, { address: '192.168.1.42/24' })),
        cable('their-pc', 'switch2'),
      ],
      homeNet(),
    )
    expect(check(neighbours, Goal.NoAddressConflict()).met).toBe(true)

    const twinServer = buildNet(
      [
        add(
          host('mirror', 'server', 820, 500, { address: '198.51.100.10/24' }),
        ),
        cable('mirror', 'internet'),
      ],
      homeNet(),
    )
    const conflict = check(twinServer, Goal.NoAddressConflict())
    expect(conflict.maybeFailure).toEqual(
      Option.some(
        NetMessage.AddressConflict({
          ip: '198.51.100.10',
          devices: ['shop', 'mirror'],
        }),
      ),
    )
    expect(conflict.focusDevices).toEqual(['shop', 'mirror'])
  })
})

describe('reachability, ports and names', () => {
  test('CannotReach fails with the path when the packet gets through', () => {
    const failed = check(
      homeNet(),
      Goal.CannotReach({
        intent: Intent.Ping({ from: 'phone', ip: '198.51.100.10' }),
      }),
    )
    expect(failed.maybeFailure).toEqual(
      Option.some(NetMessage.GoalReachable({ from: 'phone', at: 'shop' })),
    )
    expect(failed.focusDevices).toEqual(
      expect.arrayContaining(['phone', 'router', 'internet', 'shop']),
    )
    expect(failed.focusLinks).toEqual(
      expect.arrayContaining([
        'phone-router',
        'router-internet',
        'internet-shop',
      ]),
    )
  })

  test('Listening checks the port and, if asked, the bind address', () => {
    expect(
      failureOf(
        homeNet(),
        Goal.Listening({
          device: 'laptop',
          proto: 'tcp',
          port: 5173,
          maybeBind: Option.none(),
        }),
      ),
    ).toEqual(
      NetMessage.GoalNotListening({
        device: 'laptop',
        proto: 'tcp',
        port: 5173,
      }),
    )
    expect(
      check(
        homeNet(),
        Goal.Listening({
          device: 'shop',
          proto: 'tcp',
          port: 443,
          maybeBind: Option.some('0.0.0.0'),
        }),
      ).met,
    ).toBe(true)
  })

  test('Resolves follows the trace: right address, wrong address, unknown name', () => {
    const doc = homeNet()
    expect(
      check(
        doc,
        Goal.Resolves({
          device: 'laptop',
          name: 'shop.example',
          maybeIp: Option.some('198.51.100.10'),
        }),
      ).met,
    ).toBe(true)
    expect(
      failureOf(
        doc,
        Goal.Resolves({
          device: 'laptop',
          name: 'shop.example',
          maybeIp: Option.some('203.0.113.50'),
        }),
      ),
    ).toEqual(
      NetMessage.GoalResolvesElsewhere({
        name: 'shop.example',
        have: '198.51.100.10',
        want: '203.0.113.50',
      }),
    )
    const unknown = check(
      doc,
      Goal.Resolves({
        device: 'laptop',
        name: 'myapp.example',
        maybeIp: Option.none(),
      }),
    )
    expect(unknown.maybeFailure).toEqual(
      Option.some(NetMessage.NameNotFound({ name: 'myapp.example' })),
    )
    expect(unknown.focusDevices).toEqual(['laptop', 'dns'])
    expect(Option.isSome(unknown.maybeHop)).toBe(true)
  })

  test('a goal list reports the first failure and the count', () => {
    const doc = buildNet(
      [add(host('tablet', 'phone', 250, 300)), radio('tablet', 'router')],
      homeNet(),
    )
    const goals = [
      Goal.Associated({ device: 'phone', ap: 'router' }),
      Goal.Associated({ device: 'tablet', ap: 'router' }),
      Goal.NoAddressConflict(),
    ]
    expect(
      Option.map(
        firstFailedGoal(doc, emptyState, goals),
        ({ index, check }) => [index, check.maybeFailure],
      ),
    ).toEqual(
      Option.some([
        1,
        Option.some(NetMessage.NoWifiProfile({ device: 'tablet' })),
      ]),
    )
    expect(countMet(doc, emptyState, goals)).toBe(2)
    expect(allGoalsMet(doc, emptyState, goals)).toBe(false)
    expect(allGoalsMet(homeNet(), emptyState, Array.take(goals, 1))).toBe(true)
  })
})
