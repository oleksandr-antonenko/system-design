import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import phoneOnline from '../../courses/networks/lessons/01-phone-online/lesson'
import { boardAt, taskStartBoard } from '../../lesson/dsl'
import {
  add,
  cable,
  host,
  radio,
  router,
  transit,
  udp,
  wifi,
} from '../../net/build'
import { Intent } from '../../net/packet'
import { type World, emptyWorld, foldWorld } from '../../net/world'
import { expand, pauseAt, play, walk } from './dsl'
import { type LayoutInput, layoutBoard } from './layout'
import {
  FLY_MS,
  LEAD_MS,
  SLOT_MS,
  arrivalOf,
  momentAt,
  nextHopStop,
  nextStop,
  timelineOf,
  walkPositions,
} from './timeline'

// Проигрывание трассы (design D3): конверты разговора, облако, паузы.

const LESSON_1 = ['transport.run', 'board.devices', 'board.envelope']

const browse = Intent.Browse({ from: 'phone', url: 'https://shop.example/' })

const layoutOf = (world: World, overrides: Partial<LayoutInput> = {}) =>
  layoutBoard({
    doc: world.doc,
    unlocked: LESSON_1,
    isNarrow: false,
    isCloudOpen: false,
    maybeFog: Option.none(),
    rooms: [],
    moved: {},
    text: id => ({ title: id, sub: '', hint: '' }),
    ...overrides,
  })

const route = (
  world: World,
  overrides: Partial<LayoutInput>,
  stage = [play(browse)],
) =>
  Array.map(
    timelineOf({
      world,
      stage,
      layout: layoutOf(world, overrides),
      unlocked: overrides.unlocked ?? LESSON_1,
    }).legs,
    leg => `${leg.from}>${leg.to}${leg.isReply ? '*' : ''}`,
  )

const toTheSite = boardAt(phoneOnline, 1, {})

describe('envelopes of a conversation (letters)', () => {
  test('lesson 1: the request and the reply, no DNS, handshakes or MAC lookups', () => {
    expect(route(toTheSite, {})).toEqual([
      'phone>router',
      'router>internet',
      'internet>shop',
      'shop>internet*',
      'internet>router*',
      'router>phone*',
    ])
  })

  test('the directory question shows once the DNS server is open (lesson 3)', () => {
    const legs = route(toTheSite, {
      unlocked: [...LESSON_1, 'board.dnsServer'],
    })
    expect(Array.take(legs, 3)).toEqual([
      'phone>router',
      'router>internet',
      'internet>dns',
    ])
  })

  test('an open cloud of lesson 1 sends the envelope through its networks', () => {
    const legs = route(toTheSite, { isCloudOpen: true })
    expect(legs[0]).toBe('phone>router')
    expect(legs[1]).toMatch(/^router>~/)
    expect(Array.filter(legs, leg => leg.includes('~')).length).toBeGreaterThan(
      3,
    )
    expect(legs).toContain('router>phone*')
  })

  test('the photo goes laptop → router → phone', () => {
    const world = boardAt(phoneOnline, 0, {})
    expect(
      route(world, {}, [
        play(Intent.Send({ from: 'laptop', to: 'phone', what: 'photo' })),
      ]),
    ).toEqual(['laptop>router', 'router>phone'])
  })
})

describe('drops', () => {
  test('a phone without Wi-Fi: the envelope is stuck at the phone with the reason', () => {
    const start = taskStartBoard(phoneOnline, 4, {})
    const layout = layoutOf(start)
    const timeline = timelineOf({
      world: start,
      stage: [play(browse)],
      layout,
      unlocked: LESSON_1,
    })
    expect(timeline.legs).toEqual([])
    expect(
      Option.map(timeline.plays[0]?.maybeDrop ?? Option.none(), drop => [
        drop.at,
        drop.outcome._tag,
      ]),
    ).toEqual(Option.some(['phone', 'Dropped']))
    expect(momentAt(timeline, LEAD_MS, true)._tag).toBe('Stuck')
    expect(momentAt(timeline, timeline.totalMs, true)._tag).toBe('Done')
  })
})

describe('timing', () => {
  const layout = layoutOf(toTheSite)
  const timeline = timelineOf({
    world: toTheSite,
    stage: [play(browse), pauseAt('internet')],
    layout,
    unlocked: LESSON_1,
  })

  test('discrete hops: wait, fly, rest; nothing before Run', () => {
    expect(momentAt(timeline, 0, false)._tag).toBe('Idle')
    expect(momentAt(timeline, 10, true)._tag).toBe('Waiting')
    expect(momentAt(timeline, LEAD_MS + FLY_MS / 2, true)._tag).toBe('Flying')
    expect(momentAt(timeline, LEAD_MS + FLY_MS + 10, true)._tag).toBe('Resting')
    expect(timeline.totalMs).toBe(LEAD_MS + 6 * SLOT_MS)
  })

  test('pauseAt stops each time the envelope reaches the device; Step at every hop', () => {
    expect(timeline.pauses).toEqual([
      arrivalOf(timeline, 1),
      arrivalOf(timeline, 3),
    ])
    expect(nextStop(timeline, 0)).toBe(arrivalOf(timeline, 1))
    expect(nextStop(timeline, arrivalOf(timeline, 3))).toBe(timeline.totalMs)
    expect(nextHopStop(timeline, 0)).toBe(arrivalOf(timeline, 0))
  })

  test('a walk moves the device along its points', () => {
    const walking = timelineOf({
      world: toTheSite,
      stage: [
        walk('phone', [
          [0, 0],
          [100, 0],
          [100, 100],
        ]),
      ],
      layout,
      unlocked: LESSON_1,
    })
    expect(walking.totalMs).toBe(walking.walkMs)
    expect(walkPositions(walking, walking.walkMs / 4, true)).toEqual({
      phone: { x: 50, y: 0 },
    })
    expect(walkPositions(walking, walking.walkMs, true)).toEqual({
      phone: { x: 100, y: 100 },
    })
  })
})

describe('layout', () => {
  test('the directory is on the board only from lesson 3', () => {
    const ids = (unlocked: ReadonlyArray<string>) =>
      Array.map(layoutOf(toTheSite, { unlocked }).nodes, node => node.id)
    expect(ids(LESSON_1)).not.toContain('dns')
    expect(ids([...LESSON_1, 'board.dnsServer'])).toContain('dns')
  })

  test('the home zone holds the phone, the laptop and the router; the cloud is the internet', () => {
    const layout = layoutOf(toTheSite)
    expect(Array.map(layout.zones, zone => [zone.kind, zone.members])).toEqual([
      ['home', ['router', 'phone', 'laptop']],
    ])
    expect(Option.map(layout.maybeCloud, cloud => cloud.id)).toEqual(
      Option.some('internet'),
    )
  })

  test('transit routers hide in the collapsed cloud and show when it opens', () => {
    const world = foldWorld(emptyWorld, [
      add(
        router('router', 300, 300, {
          lan: '192.168.1.1/24',
          wan: '203.0.113.7',
          wifi: wifi('Home', 'password1'),
        }),
      ),
      add(transit('isp', 490, 300, { ip: '203.0.113.1' })),
      add(transit('core', 640, 300, { ip: '192.0.2.1' })),
      add(
        host('dns', 'server', 640, 140, {
          address: '192.0.2.53/24',
          listeners: [udp(53)],
        }),
      ),
      add(host('shop', 'server', 890, 300, { address: '198.51.100.10/24' })),
      add(
        host('phone', 'phone', 110, 170, {
          wifi: { ssid: 'Home', password: 'password1' },
        }),
      ),
      radio('phone', 'router'),
      cable('router', 'isp'),
      cable('isp', 'core'),
      cable('core', 'dns'),
      cable('core', 'shop'),
    ])
    const unlocked = [...LESSON_1, 'board.dnsServer', 'board.routerChain']
    const collapsed = layoutOf(world, { unlocked })
    const opened = layoutOf(world, { unlocked, isCloudOpen: true })
    expect(collapsed.inCloud).toEqual(['isp', 'core', 'dns'])
    expect(Array.map(collapsed.nodes, node => node.id)).not.toContain('isp')
    expect(Array.map(opened.nodes, node => node.id)).toContain('isp')
    expect(Array.map(collapsed.links, link => link.id).sort()).toEqual([
      'core-shop',
      'phone-router',
      'router-isp',
    ])
  })

  test('on a narrow screen the board runs top to bottom', () => {
    const wide = layoutOf(toTheSite)
    const narrow = layoutOf(toTheSite, { isNarrow: true })
    const at = (layout: typeof wide, id: string) =>
      Option.getOrThrow(Array.findFirst(layout.nodes, node => node.id === id))
    expect(at(wide, 'shop').x).toBeGreaterThan(at(wide, 'router').x)
    expect(at(narrow, 'shop').y).toBeGreaterThan(at(narrow, 'router').y)
    expect(narrow.viewBox.w).toBeLessThan(narrow.viewBox.h)
  })

  test('an open cloud of lesson 1 has five networks inside', () => {
    expect(
      Option.map(
        layoutOf(boardAt(phoneOnline, 2, {}), { isCloudOpen: true }).maybeCloud,
        cloud => cloud.inner.length,
      ),
    ).toEqual(Option.some(5))
    expect(expand()).toEqual({ _tag: 'Expand', target: 'internet' })
  })
})
