import { Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { macFromId } from './address'
import {
  add,
  cable,
  fastForward,
  flushDns,
  host,
  reserve,
  run,
  send,
  wait,
} from './build'
import { NetMessage } from './message'
import { Intent } from './packet'
import { buildNet, buildWorld, homeNet } from './testing'
import { addressOf } from './topology'
import { applyWorld, foldWorld, nextExpiry } from './world'

describe('world fold', () => {
  const browse = Intent.Browse({ from: 'phone', url: 'http://shop.example/' })

  test('send keeps the state of its trace and records where the envelope went', () => {
    const world = foldWorld(buildWorld([], homeNet()), [send(browse)])
    expect(world.state.performed).toEqual([
      {
        intent: 'Browse',
        from: 'phone',
        maybeAt: Option.some('shop'),
        delivered: true,
        maybePort: Option.some(80),
        devices: expect.arrayContaining([
          'phone',
          'router',
          'internet',
          'shop',
        ]),
      },
    ])
    expect(world.state.nat.length).toBeGreaterThan(0)
  })

  test('wait moves the clock; the contacts expire; fast-forward jumps to the next expiry; flush forgets', () => {
    const world = foldWorld(buildWorld([], homeNet()), [send(browse)])
    expect(nextExpiry(world.state)).toEqual(Option.some(300))
    const later = foldWorld(world, [wait(120)])
    expect(later.state.clock).toBe(120)
    expect(foldWorld(later, [fastForward()]).state.clock).toBe(300)
    const forgot = foldWorld(world, [flushDns('phone')])
    expect(
      forgot.state.dnsCache.filter(entry => entry.device === 'phone'),
    ).toEqual([])
  })

  test('a reservation applies at once: the device re-leases the reserved address', () => {
    const lesson = buildNet(
      [add(host('pc', 'pc', 110, 470)), cable('pc', 'router')],
      homeNet(),
    )
    const start = buildWorld([], lesson)
    const settled = foldWorld(start, [
      send(Intent.Ping({ from: 'pc', host: '192.168.1.1' })),
    ])
    expect(addressOf(settled.doc, settled.state, 'pc')).toEqual(
      Option.some('192.168.1.101'),
    )
    const reserved = foldWorld(settled, [
      reserve('router', macFromId('pc'), '192.168.1.50'),
    ])
    expect(addressOf(reserved.doc, reserved.state, 'pc')).toEqual(
      Option.some('192.168.1.50'),
    )
  })

  test('a refused operation leaves the world as it was; a command is journaled', () => {
    const start = buildWorld([], homeNet())
    expect(Result.isFailure(applyWorld(start, cable('phone', 'laptop')))).toBe(
      true,
    )
    const ran = foldWorld(start, [run('laptop', 'ip a')])
    expect(ran.state.commandLog).toEqual([
      {
        device: 'laptop',
        line: 'ip a',
        program: 'ip',
        maybeTarget: Option.none(),
        saw: ['192.168.1.42'],
      },
    ])
    expect(Result.isFailure(applyWorld(start, run('nobody', 'ip a')))).toBe(
      false,
    )
    expect(NetMessage.NotAHost({ id: 'x' })._tag).toBe('NotAHost')
  })
})
