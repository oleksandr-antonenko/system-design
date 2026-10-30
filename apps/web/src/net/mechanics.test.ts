import { Array, Option, Order, pipe } from 'effect'
import { describe, expect, test } from 'vitest'

import {
  accessPoint,
  add,
  cable,
  configureWifi,
  forgetWifi,
  host,
  joinWifi,
  listen,
  networkSwitch,
  radio,
  reserve,
  setDhcpPool,
  setLinkUp,
  setStatic,
  stopListening,
  tcp,
  wifi,
} from './build'
import { type NetOp, NetOp as Op, findHost } from './doc'
import { Goal, checkGoal } from './goals'
import { NetMessage } from './message'
import { type NetDoc, type NetState, emptyState } from './model'
import {
  Answer,
  Intent,
  type Layer,
  Outcome,
  type Trace,
  levelOf,
} from './packet'
import {
  HOME_PASSWORD,
  HOME_SSID,
  buildNet,
  firstPacketWith,
  homeNet,
  homeOps,
  hopsOfPacket,
  innerTag,
  layerOf,
  routeOf,
  tagsOf,
} from './testing'
import { addressOf, associationOf, channelConflicts } from './topology'
import { settle, trace, traceAll } from './trace'
import { Association } from './wifi'

const run = (
  doc: NetDoc,
  intent: Intent,
  state: NetState = emptyState,
): Trace => trace(doc, state, intent)[0]

const firstIndex = (result: Trace, tag: Layer['_tag']): number =>
  Option.getOrThrowWith(
    Array.findFirstIndex(result.hops, hop =>
      Array.some(hop.envelope, layer => layer._tag === tag),
    ),
    () => new Error(`no ${tag}`),
  )

const tcpFlagsOf = (result: Trace): ReadonlyArray<string> =>
  pipe(
    result.hops,
    Array.flatMap(hop =>
      Array.filter(hop.envelope, layer => layer._tag === 'Tcp'),
    ),
    Array.flatMap(layer => (layer._tag === 'Tcp' ? [layer.flags] : [])),
    Array.dedupeAdjacent,
  )

const reasonOf = (result: Trace): NetMessage =>
  Outcome.match(result.outcome, {
    Delivered: () => {
      throw new Error('delivered')
    },
    Dropped: ({ reason }) => reason,
    Refused: ({ reason }) => reason,
  })

const failureOf = (doc: NetDoc, goal: Goal, state = emptyState) =>
  Option.getOrThrowWith(
    checkGoal(doc, state, goal).maybeFailure,
    () => new Error('goal is met'),
  )

describe('mechanics for lessons 1 and 3: DHCP, DNS, then the page hop by hop', () => {
  const browse = Intent.Browse({ from: 'phone', url: 'http://shop.example/' })

  test('the phone gets an address, asks DNS, then fetches the page hop by hop', () => {
    const result = run(homeNet(), browse)
    expect(result.outcome).toEqual(
      Outcome.Delivered({
        at: 'shop',
        answer: Answer.Page({
          url: 'http://shop.example/',
          status: 200,
          seenFrom: '203.0.113.7',
          secure: false,
          maybeCert: Option.none(),
          redirects: [],
          maybeProblem: Option.none(),
        }),
      }),
    )
    const stages: ReadonlyArray<Layer['_tag']> = [
      'Dhcp',
      'Arp',
      'Dns',
      'Tcp',
      'Http',
    ]
    const order = Array.map(stages, tag => firstIndex(result, tag))
    expect(order).toEqual(Array.sort(order, Order.Number))

    const request = firstPacketWith(
      result,
      layer => layer._tag === 'Http' && Option.isNone(layer.maybeStatus),
    )
    const response = firstPacketWith(
      result,
      layer => layer._tag === 'Http' && Option.isSome(layer.maybeStatus),
    )
    expect(routeOf(result, request)).toEqual([
      'phone>router',
      'router>internet',
      'internet>shop',
    ])
    expect(routeOf(result, response)).toEqual([
      'shop>internet',
      'internet>router',
      'router>phone',
    ])
  })

  test('quiz first-hop: the engine knows the packet goes to the router first', () => {
    const result = run(homeNet(), browse)
    const syn = firstPacketWith(
      result,
      layer => layer._tag === 'Tcp' && layer.flags === 'SYN',
    )
    expect(hopsOfPacket(result, syn)[0]).toMatchObject({
      from: 'phone',
      to: 'router',
      link: 'phone-router',
    })
  })

  test('task connect-it: a cable to the internet and Wi-Fi on the phone open the page', () => {
    const associated = Goal.Associated({ device: 'phone', ap: 'router' })
    const goals = [
      Goal.Linked({
        a: 'router',
        b: 'internet',
        maybeMedium: Option.some('cable'),
      }),
      associated,
      Goal.CanReach({ intent: browse }),
    ]
    const start = buildNet(
      [Op.Disconnect({ a: 'router', b: 'internet' }), forgetWifi('phone')],
      homeNet(),
    )
    expect(
      Array.map(goals, goal => checkGoal(start, emptyState, goal).met),
    ).toEqual([false, false, false])
    expect(failureOf(start, associated)).toEqual(
      NetMessage.NoWifiProfile({ device: 'phone' }),
    )

    const wifiOnly = buildNet(
      [joinWifi('phone', HOME_SSID, HOME_PASSWORD)],
      start,
    )
    const blocked = checkGoal(
      wifiOnly,
      emptyState,
      Goal.CanReach({ intent: browse }),
    )
    expect(blocked.maybeFailure).toEqual(
      Option.some(NetMessage.NoWanLink({ router: 'router' })),
    )
    expect(blocked.focusDevices).toEqual(['router'])
    expect(
      Option.flatMap(blocked.maybeHop, index =>
        Option.flatMap(blocked.maybeTrace, result =>
          Array.get(result.hops, index),
        ),
      ).pipe(Option.map(hop => `${hop.from}>${hop.to}`)),
    ).toEqual(Option.some('phone>router'))

    const solved = buildNet([cable('router', 'internet')], wifiOnly)
    expect(
      Array.map(goals, goal => checkGoal(solved, emptyState, goal).met),
    ).toEqual([true, true, true])
  })
})

describe('mechanics for lesson 7: layers', () => {
  test('HTTP goes in TCP, IP and a frame; each hop swaps only the outer envelope', () => {
    const result = run(
      homeNet(),
      Intent.Browse({ from: 'phone', url: 'https://shop.example/' }),
    )
    const request = firstPacketWith(
      result,
      layer => layer._tag === 'Http' && Option.isNone(layer.maybeStatus),
    )
    const hops = hopsOfPacket(result, request)
    expect(Array.map(hops, tagsOf)).toEqual([
      ['WiFi', 'Ip', 'Tcp', 'Tls', 'Http'],
      ['Ethernet', 'Ip', 'Tcp', 'Tls', 'Http'],
      ['Ethernet', 'Ip', 'Tcp', 'Tls', 'Http'],
    ])
    expect(Array.map(hops[0]?.envelope ?? [], levelOf)).toEqual([
      'link',
      'internet',
      'transport',
      'application',
      'application',
    ])
    expect(
      Array.dedupe(
        Array.map(hops, hop => JSON.stringify(layerOf(hop, 'Http'))),
      ),
    ).toHaveLength(1)
    expect(
      Array.dedupe(Array.map(hops, hop => JSON.stringify(hop.envelope[0]))),
    ).toHaveLength(3)
    expect(Array.map(hops, hop => layerOf(hop, 'Ip').dst)).toEqual([
      '198.51.100.10',
      '198.51.100.10',
      '198.51.100.10',
    ])
    expect(Array.map(hops, hop => layerOf(hop, 'Ip').ttl)).toEqual([64, 63, 62])
    expect(Array.map(hops, hop => layerOf(hop, 'Ip').src)).toEqual([
      '192.168.1.100',
      '203.0.113.7',
      '203.0.113.7',
    ])
    expect(Array.map(hops, hop => layerOf(hop, 'Tcp').dst)).toEqual([
      443, 443, 443,
    ])
  })

  test('quiz "which layer broke": cable, foreign address and closed port fail differently', () => {
    const office: ReadonlyArray<NetOp> = [
      ...homeOps,
      add(
        host('pc', 'pc', 340, 520, {
          address: '192.168.1.20/24',
          gateway: '192.168.1.1',
        }),
      ),
      cable('pc', 'router'),
    ]
    const browse = Intent.Browse({ from: 'pc', url: 'http://198.51.100.10/' })
    expect(run(buildNet(office), browse).outcome._tag).toBe('Delivered')

    const pulled = buildNet([...office, setLinkUp('pc', 'router', false)])
    const foreign = buildNet([
      ...office,
      setStatic('pc', '10.0.0.5/24', '10.0.0.1'),
    ])
    const closed = buildNet([...office, stopListening('shop', 'tcp', 80)])
    expect(
      Array.map([pulled, foreign, closed], doc => reasonOf(run(doc, browse))),
    ).toEqual([
      NetMessage.LinkDown({ device: 'pc', link: 'pc-router' }),
      NetMessage.GatewayUnreachable({ device: 'pc', gateway: '10.0.0.1' }),
      NetMessage.PortClosed({ device: 'shop', proto: 'tcp', port: 80 }),
    ])
  })
})

describe('mechanics for lesson 7: Ethernet, MAC and a switch', () => {
  const pcs = ['pc1', 'pc2', 'pc3']
  const office = buildNet([
    add(networkSwitch('switch', 300, 300)),
    ...Array.flatMap(pcs, (id, index) => [
      add(
        host(id, 'pc', 100, 100 + 100 * index, {
          address: `192.168.1.${10 + index}/24`,
        }),
      ),
      cable(id, 'switch'),
    ]),
    add(
      host('printer', 'pc', 500, 300, {
        address: '192.168.1.50/24',
        listeners: [tcp(9100)],
      }),
    ),
    cable('printer', 'switch'),
  ])
  const printerMac = Option.getOrThrow(
    Option.map(findHost(office, 'printer'), printer => printer.mac),
  )
  const ping = (from: string): Intent =>
    Intent.Ping({ from, host: '192.168.1.50' })

  test('an empty table floods the broadcast, then the switch answers from what it learned', () => {
    const result = run(office, ping('pc1'))
    expect(result.outcome._tag).toBe('Delivered')
    const request = hopsOfPacket(result, 1)
    expect(Array.map(request, hop => `${hop.to}:${hop.note._tag}`)).toEqual([
      'switch:FrameBroadcast',
      'pc2:ArpNotMine',
      'pc3:ArpNotMine',
      'printer:ArpIsMine',
    ])
    expect(Array.map(request, hop => layerOf(hop, 'Ethernet').dst)).toEqual(
      Array.makeBy(4, () => 'ff:ff:ff:ff:ff:ff'),
    )
    expect(request[0]?.changes).toEqual([
      expect.objectContaining({
        _tag: 'MacLearned',
        device: 'switch',
        link: 'pc1-switch',
      }),
    ])
    const reply = hopsOfPacket(result, 2)
    expect(Array.map(reply, hop => hop.note)).toEqual([
      NetMessage.FrameForwarded({ device: 'switch', link: 'pc1-switch' }),
      NetMessage.FrameReceived({ device: 'pc1' }),
    ])
    expect(routeOf(result, 3)).toEqual(['pc1>switch', 'switch>printer'])
  })

  test('an unknown destination MAC is flooded to every other port', () => {
    const knowsPrinter: NetState = {
      ...emptyState,
      arp: [{ device: 'pc1', ip: '192.168.1.50', mac: printerMac }],
    }
    const result = run(office, ping('pc1'), knowsPrinter)
    expect(routeOf(result, 1)).toEqual([
      'pc1>switch',
      'switch>pc2',
      'switch>pc3',
      'switch>printer',
    ])
    expect(Array.map(hopsOfPacket(result, 1), hop => hop.note._tag)).toEqual([
      'FrameFlooded',
      'FrameNotForMe',
      'FrameNotForMe',
      'FrameReceived',
    ])
  })

  test('task: pings fill the MAC table, and a print job goes out of exactly one port', () => {
    const [, learned] = traceAll(office, emptyState, Array.map(pcs, ping))
    expect(
      pipe(
        learned.macTables,
        Array.filter(entry => entry.device === 'switch'),
        Array.map(entry => entry.link),
        Array.sort(Order.String),
      ),
    ).toEqual(['pc1-switch', 'pc2-switch', 'pc3-switch', 'printer-switch'])

    const job = run(
      office,
      Intent.Browse({ from: 'pc2', url: 'http://192.168.1.50:9100/' }),
      learned,
    )
    expect(job.outcome._tag).toBe('Delivered')
    expect(
      Array.dedupe(
        pipe(
          job.hops,
          Array.filter(hop => hop.to === 'switch'),
          Array.map(hop => hop.note._tag),
        ),
      ),
    ).toEqual(['FrameForwarded'])
  })
})

describe('mechanics for lessons 1 and 5: Wi-Fi', () => {
  const browse = Intent.Browse({ from: 'phone', url: 'http://shop.example/' })

  test('a wrong password keeps the phone out: nothing leaves it', () => {
    const doc = buildNet(
      [joinWifi('phone', HOME_SSID, 'wrong-horse')],
      homeNet(),
    )
    const reason = NetMessage.WrongPassword({
      device: 'phone',
      ssid: HOME_SSID,
    })
    expect(
      failureOf(doc, Goal.Associated({ device: 'phone', ap: 'router' })),
    ).toEqual(reason)
    const result = run(doc, browse)
    expect(result.outcome).toEqual(Outcome.Dropped({ at: 'phone', reason }))
    expect(result.hops).toEqual([])

    const fixed = buildNet([joinWifi('phone', HOME_SSID, HOME_PASSWORD)], doc)
    expect(
      checkGoal(
        fixed,
        emptyState,
        Goal.Associated({ device: 'phone', ap: 'router' }),
      ).met,
    ).toBe(true)
  })

  test('a 2.4 GHz-only bulb does not join a 5 GHz-only network', () => {
    const doc = buildNet(
      [
        add(
          host('bulb', 'pc', 300, 300, {
            wifiBands: ['2.4'],
            wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
          }),
        ),
        radio('bulb', 'router'),
      ],
      homeNet(),
    )
    const fiveOnly = buildNet(
      [
        configureWifi(
          'router',
          wifi(HOME_SSID, HOME_PASSWORD, { band: '5', channel: 36 }),
        ),
      ],
      doc,
    )
    expect(
      failureOf(fiveOnly, Goal.Associated({ device: 'bulb', ap: 'router' })),
    ).toEqual(NetMessage.BandUnsupported({ device: 'bulb', band: '5' }))
    expect(
      checkGoal(
        fiveOnly,
        emptyState,
        Goal.Associated({ device: 'phone', ap: 'router' }),
      ).met,
    ).toBe(true)
    expect(
      checkGoal(
        doc,
        emptyState,
        Goal.Associated({ device: 'bulb', ap: 'router' }),
      ).met,
    ).toBe(true)
  })

  test('the far room is reached on 2.4 GHz only', () => {
    const far = buildNet(
      [Op.MoveDevice({ id: 'laptop', x: 740, y: 360 })],
      homeNet(),
    )
    const association = (doc: NetDoc) =>
      Option.flatMap(
        Array.findFirst(doc.links, link => link.id === 'laptop-router'),
        link => associationOf(doc, link),
      )
    expect(association(homeNet())).toEqual(
      Option.some(Association.Associated({ band: '5', channel: 36 })),
    )
    expect(association(far)).toEqual(
      Option.some(Association.Associated({ band: '2.4', channel: 6 })),
    )
    const fiveOnly = buildNet(
      [
        configureWifi(
          'router',
          wifi(HOME_SSID, HOME_PASSWORD, { band: '5', channel: 36 }),
        ),
      ],
      far,
    )
    expect(association(fiveOnly)).toEqual(
      Option.some(
        Association.NotAssociated({
          reason: NetMessage.OutOfRange({ device: 'laptop', ap: 'router' }),
        }),
      ),
    )
  })

  test('a neighbour on an overlapping channel; channel 11 clears it', () => {
    const doc = buildNet(
      [
        add(
          accessPoint(
            'neighbour',
            520,
            200,
            wifi('Neighbours', 'their-secret', { band: '2.4', channel: 4 }),
          ),
        ),
      ],
      homeNet(),
    )
    expect(channelConflicts(doc, 'router')).toEqual(['neighbour'])
    const moved = buildNet(
      [
        configureWifi(
          'router',
          wifi(HOME_SSID, HOME_PASSWORD, { channel: 11 }),
        ),
      ],
      doc,
    )
    expect(channelConflicts(moved, 'router')).toEqual([])
  })
})

describe('mechanics for lessons 2, 7 and 9: subnets and the DHCP pool', () => {
  test('Discover, Offer, Request, Ack hand out the lowest free address', () => {
    const doc = buildNet(
      [add(host('desk', 'pc', 340, 520)), cable('desk', 'router')],
      homeNet(),
    )
    const [joins, state] = traceAll(doc, emptyState, [
      Intent.DhcpJoin({ device: 'phone' }),
      Intent.DhcpJoin({ device: 'laptop' }),
      Intent.DhcpJoin({ device: 'desk' }),
    ])
    const phoneJoin = joins[0]
    expect(
      pipe(
        phoneJoin?.hops ?? [],
        Array.filter(hop => hop.to === 'phone' || hop.to === 'router'),
        Array.flatMap(hop =>
          Array.flatMap(hop.envelope, layer =>
            layer._tag === 'Dhcp' ? [layer.kind] : [],
          ),
        ),
        Array.dedupeAdjacent,
      ),
    ).toEqual(['discover', 'offer', 'request', 'ack'])
    expect(phoneJoin?.outcome).toEqual(
      Outcome.Delivered({
        at: 'router',
        answer: Answer.Leased({
          ip: '192.168.1.100',
          prefix: 24,
          gateway: '192.168.1.1',
          maybeDns: Option.some('192.0.2.53'),
        }),
      }),
    )
    expect(
      Array.map(['phone', 'laptop', 'desk'], id => addressOf(doc, state, id)),
    ).toEqual([
      Option.some('192.168.1.100'),
      Option.some('192.168.1.42'),
      Option.some('192.168.1.101'),
    ])
  })

  test('task party: 14 guests do not fit a pool of 10 until it is widened', () => {
    const guests = Array.makeBy(14, index => `guest${index + 1}`)
    const party = buildNet(
      [
        setDhcpPool('router', '192.168.1.100', '192.168.1.109'),
        add(
          host('printer', 'pc', 340, 520, {
            address: '192.168.1.50/24',
            gateway: '192.168.1.1',
          }),
        ),
        cable('printer', 'router'),
        ...Array.flatMap(guests, id => [
          add(
            host(id, 'phone', 300, 300, {
              wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
            }),
          ),
          radio(id, 'router'),
        ]),
      ],
      homeNet(),
    )
    const goals = [
      ...Array.map(guests, device =>
        Goal.HasAddress({ device, maybeIp: Option.none() }),
      ),
      Goal.NoAddressConflict(),
      Goal.HasAddress({
        device: 'printer',
        maybeIp: Option.some('192.168.1.50'),
      }),
    ]
    const met = (doc: NetDoc) =>
      Array.filter(goals, goal => !checkGoal(doc, emptyState, goal).met).length
    expect(
      failureOf(
        party,
        Goal.HasAddress({ device: 'guest14', maybeIp: Option.none() }),
      ),
    ).toEqual(NetMessage.DhcpPoolExhausted({ router: 'router' }))
    expect(met(party)).toBe(5)

    const overPrinter = buildNet(
      [setDhcpPool('router', '192.168.1.40', '192.168.1.199')],
      party,
    )
    expect(failureOf(overPrinter, Goal.NoAddressConflict())._tag).toBe(
      'AddressConflict',
    )

    const widened = buildNet(
      [setDhcpPool('router', '192.168.1.100', '192.168.1.199')],
      party,
    )
    expect(met(widened)).toBe(0)
  })

  test('quiz: a device from another subnet cannot reach its neighbours', () => {
    const doc = buildNet(
      [
        add(host('stray', 'pc', 340, 520, { address: '192.168.2.10/24' })),
        cable('stray', 'router'),
      ],
      homeNet(),
    )
    expect(
      reasonOf(run(doc, Intent.Ping({ from: 'stray', host: '192.168.1.1' }))),
    ).toEqual(NetMessage.NoGateway({ device: 'stray', ip: '192.168.1.1' }))
  })
})

describe('mechanics for lessons 7 and 9: ARP and reservations', () => {
  const lan: ReadonlyArray<NetOp> = [
    ...homeOps,
    add(networkSwitch('switch', 340, 560)),
    cable('switch', 'router'),
    add(
      host('printer', 'pc', 200, 640, {
        address: '192.168.1.50/24',
        gateway: '192.168.1.1',
      }),
    ),
    cable('printer', 'switch'),
    add(host('desk', 'pc', 480, 640)),
    cable('desk', 'switch'),
  ]

  test('everyone hears "who has .100?", only the phone answers, the cache remembers', () => {
    const doc = buildNet(lan)
    const state = settle(doc, emptyState)
    const [first, afterFirst] = trace(
      doc,
      state,
      Intent.Ping({ from: 'laptop', host: '192.168.1.100' }),
    )
    expect(first.outcome._tag).toBe('Delivered')
    const notes = pipe(
      hopsOfPacket(first, 1),
      Array.map(hop => `${hop.to}:${hop.note._tag}`),
    )
    expect(notes).toEqual(
      expect.arrayContaining([
        'router:ArpNotMine',
        'phone:ArpIsMine',
        'printer:ArpNotMine',
        'desk:ArpNotMine',
      ]),
    )
    expect(
      Array.findFirst(
        afterFirst.arp,
        entry => entry.device === 'laptop' && entry.ip === '192.168.1.100',
      ),
    ).toEqual(Option.some(expect.objectContaining({ device: 'laptop' })))

    const arpPackets = (result: Trace) =>
      Array.dedupe(
        pipe(
          result.hops,
          Array.filter(hop => innerTag(hop) === 'Arp'),
          Array.map(hop => hop.packet),
        ),
      ).length
    const [second] = trace(
      doc,
      afterFirst,
      Intent.Ping({ from: 'laptop', host: '192.168.1.100' }),
    )
    expect([arpPackets(first), arpPackets(second)]).toEqual([2, 0])
  })

  test('task: a static .50 collides with a DHCP lease until the router reserves it', () => {
    const doc = buildNet([
      ...lan,
      setDhcpPool('router', '192.168.1.50', '192.168.1.59'),
    ])
    const state = settle(doc, emptyState)
    expect(addressOf(doc, state, 'phone')).toEqual(Option.some('192.168.1.50'))
    expect(failureOf(doc, Goal.NoAddressConflict())).toEqual(
      NetMessage.AddressConflict({
        ip: '192.168.1.50',
        devices: ['phone', 'printer'],
      }),
    )
    const [probe] = trace(
      doc,
      state,
      Intent.Arp({ from: 'laptop', ip: '192.168.1.50' }),
    )
    expect(
      Outcome.match(probe.outcome, {
        Delivered: ({ answer }) =>
          answer._tag === 'MacFound' ? answer.macs.length : 0,
        Dropped: () => 0,
        Refused: () => 0,
      }),
    ).toBe(2)

    const printerMac = Option.getOrThrow(
      Option.map(findHost(doc, 'printer'), printer => printer.mac),
    )
    const fixed = buildNet([reserve('router', printerMac, '192.168.1.50')], doc)
    const [renewed, after] = trace(
      fixed,
      state,
      Intent.DhcpJoin({ device: 'phone' }),
    )
    expect(renewed.outcome._tag).toBe('Delivered')
    expect(addressOf(fixed, after, 'phone')).toEqual(
      Option.some('192.168.1.52'),
    )
    expect(checkGoal(fixed, after, Goal.NoAddressConflict()).met).toBe(true)
    const [single] = trace(
      fixed,
      after,
      Intent.Arp({ from: 'laptop', ip: '192.168.1.50' }),
    )
    expect(single.outcome).toEqual(
      Outcome.Delivered({
        at: 'printer',
        answer: Answer.MacFound({ ip: '192.168.1.50', macs: [printerMac] }),
      }),
    )
  })
})

describe('mechanics for lesson 6: ports, TCP and UDP', () => {
  const browse = Intent.Browse({
    from: 'phone',
    url: 'http://192.168.1.42:5173/',
  })
  const devOn127 = buildNet(
    [listen('laptop', 'tcp', '127.0.0.1', 5173)],
    homeNet(),
  )

  test('npm run dev listens on 127.0.0.1: the laptop opens it, the phone gets RST', () => {
    const state = settle(devOn127, emptyState)
    const own = run(
      devOn127,
      Intent.Browse({ from: 'laptop', url: 'http://localhost:5173/' }),
      state,
    )
    expect(own.outcome._tag).toBe('Delivered')
    expect(own.hops).toEqual([])

    const refused = run(devOn127, browse, state)
    const reason = NetMessage.ListensOnlyOnLoopback({
      device: 'laptop',
      port: 5173,
    })
    expect(refused.outcome).toEqual(Outcome.Refused({ at: 'laptop', reason }))
    expect(tcpFlagsOf(refused)).toEqual(['SYN', 'RST'])
    expect(
      routeOf(
        refused,
        firstPacketWith(refused, layer => layer._tag === 'Tcp'),
      ),
    ).toEqual(['phone>router', 'router>laptop'])
  })

  test('task: restarted with --host on 0.0.0.0, the phone opens the page', () => {
    const goals = [
      Goal.Listening({
        device: 'laptop',
        proto: 'tcp',
        port: 5173,
        maybeBind: Option.some('0.0.0.0'),
      }),
      Goal.CanReach({ intent: browse }),
    ]
    expect(Array.map(goals, goal => failureOf(devOn127, goal))).toEqual([
      NetMessage.GoalListeningOnWrongAddress({
        device: 'laptop',
        port: 5173,
        bind: '127.0.0.1',
        want: '0.0.0.0',
      }),
      NetMessage.ListensOnlyOnLoopback({ device: 'laptop', port: 5173 }),
    ])
    const failing = checkGoal(
      devOn127,
      emptyState,
      Goal.CanReach({ intent: browse }),
    )
    expect(
      pipe(
        Option.all([failing.maybeHop, failing.maybeTrace]),
        Option.flatMap(([index, result]) => Array.get(result.hops, index)),
        Option.map(hop => `${hop.from}>${hop.to}:${layerOf(hop, 'Tcp').flags}`),
      ),
    ).toEqual(Option.some('router>laptop:SYN'))

    const host0 = buildNet([listen('laptop', 'tcp', '0.0.0.0', 5173)], devOn127)
    expect(
      Array.map(goals, goal => checkGoal(host0, emptyState, goal).met),
    ).toEqual([true, true])
    const opened = run(host0, browse, settle(host0, emptyState))
    expect(tcpFlagsOf(opened)).toEqual(['SYN', 'SYN-ACK', 'ACK', 'DATA'])
    expect(
      routeOf(
        opened,
        firstPacketWith(opened, layer => layer._tag === 'Http'),
      ),
    ).toEqual(['phone>router', 'router>laptop'])
  })

  test('nothing listening: connection refused on a closed port', () => {
    const result = run(homeNet(), browse, settle(homeNet(), emptyState))
    expect(reasonOf(result)).toEqual(
      NetMessage.PortClosed({ device: 'laptop', proto: 'tcp', port: 5173 }),
    )
  })

  test('DNS rides on UDP to port 53, the page on TCP', () => {
    const result = run(
      homeNet(),
      Intent.Browse({ from: 'phone', url: 'http://shop.example/' }),
    )
    const query = Option.getOrThrow(
      Array.findFirst(result.hops, hop => innerTag(hop) === 'Dns'),
    )
    expect(layerOf(query, 'Udp').dst).toBe(53)
    expect(levelOf(layerOf(query, 'Udp'))).toBe('transport')
    expect(tcpFlagsOf(result)).toEqual(['SYN', 'SYN-ACK', 'ACK', 'DATA'])
  })

  test('the dev server is not reachable from the internet, even on 0.0.0.0', () => {
    const doc = buildNet([listen('laptop', 'tcp', '0.0.0.0', 5173)], homeNet())
    const viaWan = Intent.Browse({
      from: 'shop',
      url: 'http://203.0.113.7:5173/',
    })
    const viaLan = Intent.Browse({
      from: 'shop',
      url: 'http://192.168.1.42:5173/',
    })
    expect(
      Array.map([viaWan, viaLan], intent =>
        reasonOf(run(doc, intent, settle(doc, emptyState))),
      ),
    ).toEqual([
      NetMessage.NatNoMapping({ router: 'router', proto: 'tcp', port: 5173 }),
      NetMessage.PrivateAddressNotRoutable({ ip: '192.168.1.42' }),
    ])
    expect(
      Array.map(
        [viaWan, viaLan],
        intent => checkGoal(doc, emptyState, Goal.CannotReach({ intent })).met,
      ),
    ).toEqual([true, true])
  })
})
