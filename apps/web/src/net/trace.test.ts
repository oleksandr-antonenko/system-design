import { Array, Option, Order, Schema, pipe } from 'effect'
import { describe, expect, test } from 'vitest'

import { add, cable, host, internet, radio, router, wifi } from './build'
import { NetMessage } from './message'
import { NetDoc, NetState, emptyState } from './model'
import {
  Answer,
  Intent,
  Outcome,
  Trace,
  durationOf,
  failingHop,
  packetCount,
} from './packet'
import { buildNet, homeNet, homeOps, innerTag, layerOf } from './testing'
import { settle, trace, traceAll } from './trace'

const browse = Intent.Browse({ from: 'phone', url: 'http://shop.example/' })

const reasonOf = (result: Trace): NetMessage =>
  Outcome.match(result.outcome, {
    Delivered: () => {
      throw new Error('delivered')
    },
    Dropped: ({ reason }) => reason,
    Refused: ({ reason }) => reason,
  })

describe('determinism', () => {
  test('the same document, state and intent give the same trace and state', () => {
    const settled = settle(homeNet(), emptyState)
    const intents = [
      browse,
      Intent.Ping({ from: 'laptop', ip: '192.168.1.100' }),
      Intent.Resolve({ from: 'laptop', name: 'shop.example' }),
      Intent.Arp({ from: 'phone', ip: '192.168.1.1' }),
      Intent.DhcpJoin({ device: 'phone' }),
    ]
    expect(traceAll(homeNet(), settled, intents)).toStrictEqual(
      traceAll(
        buildNet(homeOps),
        settle(buildNet(homeOps), emptyState),
        intents,
      ),
    )
    expect(trace(homeNet(), emptyState, browse)).toStrictEqual(
      trace(homeNet(), emptyState, browse),
    )
  })

  test('documents, states and traces are Schema values (they can live in a Model)', () => {
    const doc = homeNet()
    const [result, state] = trace(doc, emptyState, browse)
    expect(Schema.is(NetDoc)(doc)).toBe(true)
    expect(Schema.is(NetState)(state)).toBe(true)
    expect(Schema.is(Trace)(result)).toBe(true)
  })

  test('hops come in time order, packets are numbered by first appearance', () => {
    const doc = homeNet()
    const [result] = trace(doc, emptyState, browse)
    const times = Array.map(result.hops, hop => hop.arrivedAt)
    expect(times).toEqual(Array.sort(times, Order.Number))
    const packets = Array.dedupe(Array.map(result.hops, hop => hop.packet))
    expect(packets).toEqual(Array.makeBy(packets.length, index => index + 1))
    expect(packetCount(result)).toBe(packets.length)
    expect(
      Array.every(result.hops, hop =>
        Array.some(doc.links, link => link.id === hop.link),
      ),
    ).toBe(true)
    expect(durationOf(result)).toBe(319)
  })

  test('ephemeral and NAT ports come from counters, the second visit reuses caches', () => {
    const doc = homeNet()
    const [first, afterFirst] = trace(doc, emptyState, browse)
    expect(
      pipe(
        first.hops,
        Array.flatMap(hop => hop.changes),
        Array.filter(change => change._tag === 'NatAdded'),
      ),
    ).toEqual([
      expect.objectContaining({
        proto: 'udp',
        inside: '192.168.1.100',
        insidePort: 51514,
        outside: '203.0.113.7',
        outsidePort: 40001,
        remote: '192.0.2.53',
        remotePort: 53,
      }),
      expect.objectContaining({
        proto: 'tcp',
        insidePort: 51515,
        outsidePort: 40002,
        remote: '198.51.100.10',
        remotePort: 80,
      }),
    ])
    const [second, afterSecond] = trace(doc, afterFirst, browse)
    expect(
      Array.dedupe(Array.map(second.hops, innerTag)).filter(
        tag => tag === 'Dhcp' || tag === 'Arp' || tag === 'Dns',
      ),
    ).toEqual([])
    expect(
      Option.map(Array.head(second.hops), hop => layerOf(hop, 'Tcp').src),
    ).toEqual(Option.some(51516))
    expect([afterSecond.nextPort, afterSecond.nextNatPort]).toEqual([
      51517, 40004,
    ])
  })
})

describe('ping', () => {
  test('the echo reply reports TTL and time from link delays', () => {
    const doc = homeNet()
    const [first, after] = trace(
      doc,
      settle(doc, emptyState),
      Intent.Ping({ from: 'phone', ip: '198.51.100.10' }),
    )
    expect(first.outcome).toEqual(
      Outcome.Delivered({
        at: 'shop',
        answer: Answer.EchoReply({ ip: '198.51.100.10', ttl: 62, ms: 92 }),
      }),
    )
    const [second] = trace(
      doc,
      after,
      Intent.Ping({ from: 'phone', ip: '198.51.100.10' }),
    )
    expect(second.outcome).toEqual(
      Outcome.Delivered({
        at: 'shop',
        answer: Answer.EchoReply({ ip: '198.51.100.10', ttl: 62, ms: 86 }),
      }),
    )
  })

  test('pinging yourself never leaves the device', () => {
    const [result] = trace(
      homeNet(),
      emptyState,
      Intent.Ping({ from: 'shop', ip: '127.0.0.1' }),
    )
    expect(result.hops).toEqual([])
    expect(result.outcome._tag).toBe('Delivered')
  })
})

describe('failures name the place and the reason', () => {
  test('bad input and devices that cannot send', () => {
    const doc = buildNet([add(host('lonely', 'pc', 0, 0))], homeNet())
    const cases: ReadonlyArray<readonly [Intent, NetMessage]> = [
      [
        Intent.Browse({ from: 'phone', url: 'shop.example' }),
        NetMessage.InvalidUrl({ url: 'shop.example' }),
      ],
      [
        Intent.Ping({ from: 'ghost', ip: '192.168.1.1' }),
        NetMessage.UnknownDevice({ id: 'ghost' }),
      ],
      [
        Intent.Ping({ from: 'router', ip: '192.168.1.1' }),
        NetMessage.NotAHost({ id: 'router' }),
      ],
      [
        Intent.Ping({ from: 'lonely', ip: '192.168.1.1' }),
        NetMessage.NoLink({ device: 'lonely' }),
      ],
      [
        Intent.Ping({ from: 'phone', ip: '999.1.1.1' }),
        NetMessage.InvalidIp({ value: '999.1.1.1' }),
      ],
      [
        Intent.DhcpJoin({ device: 'shop' }),
        NetMessage.UsesStaticAddress({ device: 'shop' }),
      ],
    ]
    expect(
      Array.map(cases, ([intent]) =>
        reasonOf(trace(doc, emptyState, intent)[0]),
      ),
    ).toEqual(Array.map(cases, ([, reason]) => reason))
  })

  test('an unknown name is refused by the resolver, the failing hop is marked', () => {
    const [result] = trace(
      homeNet(),
      emptyState,
      Intent.Resolve({ from: 'phone', name: 'nowhere.example' }),
    )
    expect(result.outcome).toEqual(
      Outcome.Refused({
        at: 'dns',
        reason: NetMessage.NameNotFound({ name: 'nowhere.example' }),
      }),
    )
    expect(
      pipe(
        failingHop(result),
        Option.flatMap(index => Array.get(result.hops, index)),
        Option.map(hop => `${hop.from}>${hop.to}`),
      ),
    ).toEqual(Option.some('internet>dns'))
  })

  test('a router without DNS settings leaves names unresolved', () => {
    const doc = buildNet([
      add(internet('internet', 590, 360)),
      add(
        router('router', 340, 360, {
          lan: '192.168.1.1/24',
          wan: '203.0.113.7',
          wifi: wifi('Home', 'correct-horse'),
        }),
      ),
      add(
        host('phone', 'phone', 200, 300, {
          wifi: { ssid: 'Home', password: 'correct-horse' },
        }),
      ),
      radio('phone', 'router'),
      cable('router', 'internet'),
    ])
    expect(reasonOf(trace(doc, emptyState, browse)[0])).toEqual(
      NetMessage.NoDnsServer({ device: 'phone' }),
    )
  })

  test('an address nobody has on the board has no route in the internet', () => {
    const [result] = trace(
      homeNet(),
      settle(homeNet(), emptyState),
      Intent.Ping({ from: 'phone', ip: '203.0.113.99' }),
    )
    expect(result.outcome).toEqual(
      Outcome.Dropped({
        at: 'internet',
        reason: NetMessage.NoRouteToHost({ ip: '203.0.113.99' }),
      }),
    )
  })
})
