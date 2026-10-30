import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { macFromId } from './address'
import {
  lastReplyOf,
  observerView,
  sourceAddressSeenBy,
  staleAnswerOn,
} from './answers'
import { browse } from './browser'
import {
  add,
  addRecord,
  cable,
  certificateAuthority,
  fastForward,
  flushDns,
  forward,
  host,
  internet,
  issueCert,
  joinWifi,
  listen,
  radio,
  reserve,
  router,
  run,
  send,
  setCert,
  setLinkUp,
  setRecord,
  setRedirect,
  setStatic,
  stopListening,
  tcp,
  transit,
  transitRoute,
  udp,
  useDhcp,
  wait,
  wifi,
} from './build'
import { NetOp } from './doc'
import { Goal, checkGoal, goals } from './goals'
import { NetMessage } from './message'
import { type NetDoc, type NetState, emptyState } from './model'
import { Intent, type Trace } from './packet'
import { runCommand } from './terminal'
import {
  HOME_PASSWORD,
  HOME_SSID,
  buildNet,
  buildWorld,
  chainOps,
  homeNet,
  homeRouter,
  routeOf,
} from './testing'
import { addressOf } from './topology'
import { settle, trace } from './trace'
import { type World, applyWorld, foldWorld } from './world'

const traceOn = (
  doc: NetDoc,
  intent: Intent,
  state: NetState = emptyState,
): Trace => trace(doc, settle(doc, state), intent)[0]

const metAll = (world: World, list: ReadonlyArray<Goal>) =>
  Array.map(list, goal => checkGoal(world.doc, world.state, goal).met)

const failureOf = (world: World, goal: Goal) =>
  checkGoal(world.doc, world.state, goal).maybeFailure

describe('lesson 8 (routing): gateway and traceroute', () => {
  const routed = buildNet([
    ...chainOps,
    NetOp.SetTransitRoutes({
      transit: 'isp',
      routes: [
        transitRoute('203.0.113.0/24'),
        transitRoute('0.0.0.0/0', 'core'),
      ],
    }),
    NetOp.SetTransitRoutes({
      transit: 'core',
      routes: [
        transitRoute('192.0.2.0/24'),
        transitRoute('203.0.113.0/24', 'isp'),
        transitRoute('198.51.100.0/24', 'hosting'),
      ],
    }),
    NetOp.SetTransitRoutes({
      transit: 'hosting',
      routes: [
        transitRoute('198.51.100.0/24'),
        transitRoute('0.0.0.0/0', 'core'),
      ],
    }),
  ])

  test('traceroute prints every post office with three timings', () => {
    const result = runCommand(
      routed,
      emptyState,
      'laptop',
      'traceroute shop.example',
    )
    expect(result.output).toEqual([
      'traceroute to shop.example (198.51.100.10), 30 hops max, 60 byte packets',
      ' 1  192.168.1.1 (192.168.1.1)  6.0 ms  6.2 ms  6.1 ms',
      ' 2  gw.isp.example (203.0.113.1)  8.0 ms  8.2 ms  8.1 ms',
      ' 3  core.isp.example (192.0.2.1)  48.0 ms  48.2 ms  48.1 ms',
      ' 4  gw.hosting.example (198.51.100.1)  88.0 ms  88.2 ms  88.1 ms',
      ' 5  shop.example (198.51.100.10)  90.0 ms  90.2 ms  90.1 ms',
    ])
    const hops = Array.filter(
      traceOn(
        routed,
        Intent.Browse({ from: 'laptop', url: 'http://shop.example/' }),
      ).hops,
      hop =>
        Option.isSome(hop.maybeRoute) &&
        hop.from === 'core' &&
        hop.to === 'hosting',
    )
    expect(Option.map(Array.head(hops), hop => hop.maybeRoute)).toEqual(
      Option.some(
        Option.some({
          device: 'core',
          kind: 'transit',
          network: '198.51.100.0',
          prefix: 24,
          maybeVia: Option.some('hosting'),
        }),
      ),
    )
  })

  test('quiz where-it-breaks: after the core–hosting cut the last reply is from core', () => {
    const cut = buildNet([setLinkUp('core', 'hosting', false)], routed)
    const result = runCommand(
      cut,
      emptyState,
      'laptop',
      'traceroute shop.example',
    )
    expect(Array.drop(result.output, 4)).toEqual([
      ' 4  * * *',
      ' 5  * * *',
      ' 6  * * *',
      '^C',
    ])
    expect(
      lastReplyOf(
        traceOn(
          cut,
          Intent.Traceroute({ from: 'laptop', host: 'shop.example' }),
        ),
      ),
    ).toEqual(Option.some('core'))
    expect(
      traceOn(cut, Intent.Ping({ from: 'laptop', host: '198.51.100.10' }))
        .outcome,
    ).toMatchObject({
      _tag: 'Dropped',
      at: 'core',
      reason: NetMessage.FrameLost({ device: 'core' }),
    })
  })

  test('task fix-gateway: a foreign gateway keeps the printer but loses the internet', () => {
    const start = buildWorld(
      [setStatic('laptop', '192.168.1.42/24', '192.168.1.254', '192.0.2.53')],
      routed,
    )
    const taskGoals = [
      Goal.CanReach({
        intent: Intent.Ping({ from: 'laptop', host: '198.51.100.10' }),
      }),
      Goal.CanReach({
        intent: Intent.Browse({ from: 'laptop', url: 'https://shop.example/' }),
      }),
      Goal.CanReach({
        intent: Intent.Ping({ from: 'laptop', host: '192.168.1.101' }),
      }),
    ]
    expect(metAll(start, taskGoals)).toEqual([false, false, true])
    expect(failureOf(start, taskGoals[0] ?? Goal.NoAddressConflict())).toEqual(
      Option.some(
        NetMessage.GatewayUnreachable({
          device: 'laptop',
          gateway: '192.168.1.254',
        }),
      ),
    )
    const say = (line: string) =>
      runCommand(start.doc, start.state, 'laptop', line).output
    expect(say('ip route')).toEqual([
      'default via 192.168.1.254 dev en0',
      '192.168.1.0/24 dev en0 src 192.168.1.42',
    ])
    expect(say('ping -c 1 198.51.100.10')[1]).toBe(
      'From 192.168.1.42 icmp_seq=0 Destination Host Unreachable',
    )
    expect(say('traceroute 198.51.100.10')[1]).toBe(
      ' 1  192.168.1.42 (192.168.1.42)  3000.0 ms !H  3000.0 ms !H  3000.0 ms !H',
    )

    const wrong = (gateway: string) =>
      failureOf(
        foldWorld(start, [
          setStatic('laptop', '192.168.1.42/24', gateway, '192.0.2.53'),
        ]),
        taskGoals[0] ?? Goal.NoAddressConflict(),
      )
    expect(wrong('192.168.1.42')).toEqual(
      Option.some(NetMessage.GatewayIsSelf({ device: 'laptop' })),
    )
    expect(wrong('192.168.1.101')).toEqual(
      Option.some(
        NetMessage.GatewayNotARouter({
          device: 'laptop',
          gateway: '192.168.1.101',
        }),
      ),
    )
    expect(
      Option.isSome(
        Option.filter(
          Option.some(
            applyWorld(
              start,
              setStatic('laptop', '192.168.1.42/24', '203.0.113.1'),
            ),
          ),
          result => result._tag === 'Failure',
        ),
      ),
    ).toBe(true)

    const fixed = foldWorld(start, [
      setStatic('laptop', '192.168.1.42/24', '192.168.1.1', '192.0.2.53'),
    ])
    expect(metAll(fixed, taskGoals)).toEqual([true, true, true])
    expect(metAll(foldWorld(start, [useDhcp('laptop')]), taskGoals)).toEqual([
      true,
      true,
      true,
    ])
  })

  test('a static route reaches the second office network behind a router on the LAN', () => {
    const office = buildNet([
      ...chainOps,
      add(
        router('branch', 300, 520, {
          lan: '10.0.2.1/24',
          wan: '192.168.1.2',
          dhcp: false,
          nat: false,
        }),
      ),
      cable('branch', 'router'),
      add(
        host('files', 'server', 420, 560, {
          address: '10.0.2.10/24',
          gateway: '10.0.2.1',
        }),
      ),
      cable('files', 'branch'),
    ])
    const ping = Intent.Ping({ from: 'printer', host: '10.0.2.10' })
    expect(traceOn(office, ping).outcome).toMatchObject({
      _tag: 'Dropped',
      reason: NetMessage.PrivateAddressNotRoutable({ ip: '10.0.2.10' }),
    })
    const routedOffice = buildNet(
      [
        NetOp.AddRoute({
          router: 'router',
          network: '10.0.2.0',
          prefix: 24,
          via: '192.168.1.2',
        }),
      ],
      office,
    )
    const reached = traceOn(routedOffice, ping)
    expect(reached.outcome).toMatchObject({ _tag: 'Delivered', at: 'files' })
  })
})

describe('lesson 9 (nat): home addresses, NAT and port forwarding', () => {
  const lesson = buildNet(
    [
      add(host('printer', 'printer', 110, 360)),
      add(host('pc', 'pc', 110, 470, { listeners: [tcp(25565), tcp(5432)] })),
      cable('printer', 'router'),
      cable('pc', 'router'),
      add(
        router('friend-router', 720, 430, {
          lan: '192.168.1.1/24',
          wan: '203.0.113.77',
          dns: '192.0.2.53',
        }),
      ),
      add(host('friend', 'pc', 880, 430)),
      cable('friend-router', 'internet'),
      cable('friend', 'friend-router'),
    ],
    homeNet(),
  )
  const game = Intent.Connect({
    from: 'friend',
    host: '203.0.113.7',
    port: 25565,
  })
  const taskGoals = [
    Goal.HasAddress({ device: 'pc', maybeIp: Option.some('192.168.1.50') }),
    Goal.CanReach({ intent: game }),
    goals.onlyOpenPorts('203.0.113.7', 'friend', [25565]),
  ]
  const forwardGame = (insideIp: string) =>
    forward('router', {
      proto: 'tcp',
      outsidePort: 25565,
      insideIp,
      insidePort: 25565,
    })

  test('the friend has the same .100 at home; his envelope to .42 never leaves his house', () => {
    const state = settle(lesson, emptyState)
    expect([
      addressOf(lesson, state, 'phone'),
      addressOf(lesson, state, 'friend'),
    ]).toEqual([Option.some('192.168.1.100'), Option.some('192.168.1.100')])
    expect(checkGoal(lesson, emptyState, Goal.NoAddressConflict()).met).toBe(
      true,
    )
    expect(
      traceOn(lesson, Intent.Ping({ from: 'friend', host: '192.168.1.42' }))
        .outcome,
    ).toEqual({
      _tag: 'Dropped',
      at: 'friend',
      reason: NetMessage.ArpNoReply({ device: 'friend', ip: '192.168.1.42' }),
    })
  })

  test('quiz what-site-sees: the shop sees the router outside address; one NAT row appears', () => {
    const page = traceOn(
      lesson,
      Intent.Browse({ from: 'laptop', url: 'https://shop.example/' }),
    )
    expect(sourceAddressSeenBy(page, 'shop')).toEqual(
      Option.some('203.0.113.7'),
    )
    const rows = Array.flatMap(page.hops, hop =>
      Array.filter(
        hop.changes,
        change => change._tag === 'NatAdded' && change.proto === 'tcp',
      ),
    )
    expect(rows).toHaveLength(1)
  })

  test('task let-friend-in: reserve .50 and forward 25565 only', () => {
    const start = buildWorld([], lesson)
    expect(metAll(start, taskGoals)).toEqual([false, false, true])
    expect(failureOf(start, Goal.CanReach({ intent: game }))).toEqual(
      Option.some(
        NetMessage.NatNoMapping({
          router: 'router',
          proto: 'tcp',
          port: 25565,
        }),
      ),
    )
    const solved = foldWorld(start, [
      reserve('router', macFromId('pc'), '192.168.1.50'),
      forwardGame('192.168.1.50'),
    ])
    expect(metAll(solved, taskGoals)).toEqual([true, true, true])
    const seen = traceOn(solved.doc, game, solved.state)
    expect(seen.outcome).toMatchObject({
      _tag: 'Delivered',
      at: 'pc',
      answer: { _tag: 'Connected', seenFrom: '203.0.113.77' },
    })

    const leaky = foldWorld(solved, [
      forward('router', {
        proto: 'tcp',
        outsidePort: 5432,
        insideIp: '192.168.1.50',
        insidePort: 5432,
      }),
    ])
    expect(failureOf(leaky, taskGoals[2] ?? Goal.NoAddressConflict())).toEqual(
      Option.some(
        NetMessage.GoalExtraOpenPort({
          target: '203.0.113.7',
          port: 5432,
          device: 'pc',
        }),
      ),
    )
    const notReserved = foldWorld(start, [forwardGame('192.168.1.102')])
    expect(metAll(notReserved, taskGoals)).toEqual([false, true, true])
    const toLaptop = foldWorld(start, [forwardGame('192.168.1.42')])
    expect(failureOf(toLaptop, Goal.CanReach({ intent: game }))).toEqual(
      Option.some(
        NetMessage.PortClosed({ device: 'laptop', proto: 'tcp', port: 25565 }),
      ),
    )
  })

  test('behind CGNAT a forward on the home router does not help: the provider drops the envelope', () => {
    const cgnat = buildNet([
      add(internet('internet', 600, 300)),
      add(
        router('router', 300, 300, {
          lan: '192.168.1.1/24',
          wan: '100.64.12.34',
          forwards: [
            {
              proto: 'tcp',
              outsidePort: 25565,
              insideIp: '192.168.1.50',
              insidePort: 25565,
            },
          ],
          reservations: [{ mac: macFromId('pc'), ip: '192.168.1.50' }],
        }),
      ),
      add(
        transit('isp', 450, 300, { ip: '203.0.113.1', cgnat: '203.0.113.70' }),
      ),
      add(host('pc', 'pc', 110, 470, { listeners: [tcp(25565)] })),
      add(host('friend', 'pc', 800, 300, { address: '198.51.100.66/24' })),
      cable('pc', 'router'),
      cable('router', 'isp'),
      cable('isp', 'internet'),
      cable('friend', 'internet'),
    ])
    const shop = traceOn(
      cgnat,
      Intent.Connect({ from: 'pc', host: '198.51.100.66', port: 80 }),
    )
    expect(shop.outcome).toMatchObject({ reason: { _tag: 'PortClosed' } })
    expect(sourceAddressSeenBy(shop, 'friend')).toEqual(
      Option.some('203.0.113.70'),
    )
    expect(
      traceOn(
        cgnat,
        Intent.Connect({ from: 'friend', host: '203.0.113.70', port: 25565 }),
      ).outcome,
    ).toMatchObject({
      _tag: 'Dropped',
      at: 'isp',
      reason: { _tag: 'NatNoMapping', router: 'isp' },
    })
  })
})

describe('lesson 10 (dns-records): records, TTL and the resolver cache', () => {
  const lesson = buildNet([
    homeRouter,
    add(
      host('phone', 'phone', 110, 140, {
        wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
      }),
    ),
    add(
      host('laptop', 'laptop', 110, 260, {
        mac: '3c:22:fb:4a:10:42',
        wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
      }),
    ),
    add(internet('internet', 470, 300)),
    add(
      host('dns', 'server', 420, 90, {
        address: '192.0.2.53/24',
        listeners: [udp(53)],
        resolver: true,
      }),
    ),
    add(
      host('ns', 'server', 640, 90, {
        address: '203.0.113.53/24',
        listeners: [udp(53)],
        zones: [
          {
            name: 'myapp.example',
            records: [
              { name: '@', rtype: 'A', value: '198.51.100.200', ttl: 3600 },
            ],
          },
          {
            name: 'shop.example',
            records: [
              { name: '@', rtype: 'A', value: '198.51.100.10', ttl: 3600 },
            ],
          },
          {
            name: 'dns.example',
            records: [
              { name: 'ns1', rtype: 'A', value: '203.0.113.53', ttl: 3600 },
            ],
          },
        ],
      }),
    ),
    add(
      host('vps', 'server', 700, 230, {
        address: '198.51.100.20/24',
        listeners: [tcp(80)],
      }),
    ),
    add(
      host('parking', 'server', 860, 230, {
        address: '198.51.100.200/24',
        listeners: [tcp(80)],
      }),
    ),
    add(
      router('friend-router', 700, 440, {
        lan: '192.168.1.1/24',
        wan: '203.0.113.77',
        dns: '1.1.1.1',
      }),
    ),
    add(host('friend', 'laptop', 870, 440, { wifiBands: [] })),
    add(
      host('cf', 'server', 520, 520, {
        address: '1.1.1.1/24',
        listeners: [udp(53)],
        resolver: true,
      }),
    ),
    radio('phone', 'router'),
    radio('laptop', 'router'),
    cable('router', 'internet'),
    cable('internet', 'dns'),
    cable('internet', 'ns'),
    cable('internet', 'vps'),
    cable('internet', 'parking'),
    cable('internet', 'cf'),
    cable('friend-router', 'internet'),
    cable('friend', 'friend-router'),
  ])
  const page = (from: string) =>
    Intent.Browse({ from, url: 'http://myapp.example/' })
  const taskGoals = [
    goals.resolves('laptop', 'myapp.example', '198.51.100.20', 'ns'),
    goals.hasRecord('myapp.example', 'www', 'CNAME', 'myapp.example'),
    goals.hasRecord('myapp.example', '@', 'TXT', 'myapp-verify=4f9c2a'),
    goals.ranCommand('laptop', ['dig', 'nslookup'], {
      name: 'myapp.example',
      saw: '198.51.100.20',
    }),
  ]
  const solution = [
    setRecord('ns', 'myapp.example', {
      type: 'A',
      name: '@',
      value: '198.51.100.20',
      ttl: 300,
    }),
    setRecord('ns', 'myapp.example', {
      type: 'CNAME',
      name: 'www',
      value: 'myapp.example',
      ttl: 300,
    }),
    setRecord('ns', 'myapp.example', {
      type: 'TXT',
      name: '@',
      value: 'myapp-verify=4f9c2a',
      ttl: 300,
    }),
    run('laptop', 'dig myapp.example'),
  ]

  test('the domain first leads to the parking page via the provider resolver and the DNS host', () => {
    const result = traceOn(lesson, page('laptop'))
    expect(result.outcome).toMatchObject({ _tag: 'Delivered', at: 'parking' })
    const query = Option.getOrThrow(
      Array.findFirst(
        result.hops,
        hop => hop.from === 'internet' && hop.to === 'ns',
      ),
    )
    expect(query.envelope.some(layer => layer._tag === 'Dns')).toBe(true)
  })

  test('the friend resolver remembers the old answer for its TTL', () => {
    const remembered = foldWorld(buildWorld([], lesson), [
      send(Intent.Resolve({ from: 'friend', name: 'myapp.example' })),
      wait(1800),
    ])
    const cached = Array.filter(
      remembered.state.dnsCache,
      entry => entry.device === 'cf',
    )
    expect(cached).toEqual([
      {
        device: 'cf',
        name: 'myapp.example',
        rtype: 'A',
        value: '198.51.100.200',
        expiresAt: 3600,
      },
    ])
  })

  test('task point-domain: A, CNAME, TXT and a dig; the friend sees the old site until the TTL runs out', () => {
    const start = foldWorld(buildWorld([], lesson), [
      send(Intent.Resolve({ from: 'friend', name: 'myapp.example' })),
      wait(1800),
    ])
    expect(metAll(start, taskGoals)).toEqual([false, false, false, false])
    const solved = foldWorld(start, solution)
    expect(metAll(solved, taskGoals)).toEqual([true, true, true, true])
    expect(
      runCommand(solved.doc, solved.state, 'laptop', 'dig myapp.example')
        .output,
    ).toEqual([
      '',
      ';; ANSWER SECTION:',
      'myapp.example.\t\t300\tIN\tA\t198.51.100.20',
      '',
      ';; SERVER: 192.0.2.53#53',
    ])
    expect(
      runCommand(
        solved.doc,
        solved.state,
        'laptop',
        'dig @ns1.dns.example myapp.example',
      ).output,
    ).toContain(';; flags: qr aa')
    expect(
      checkGoal(
        solved.doc,
        solved.state,
        goals.resolves('laptop', 'www.myapp.example', '198.51.100.20'),
      ).met,
    ).toBe(true)

    const quiz = foldWorld(solved, [flushDns('friend')])
    expect(
      staleAnswerOn(quiz.doc, quiz.state, 'friend', 'myapp.example'),
    ).toEqual(Option.some('cf'))
    expect(traceOn(quiz.doc, page('friend'), quiz.state).outcome).toMatchObject(
      { at: 'parking' },
    )
    const later = foldWorld(quiz, [fastForward('cf')])
    expect(later.state.clock).toBe(3600)
    expect(
      traceOn(later.doc, page('friend'), later.state).outcome,
    ).toMatchObject({ at: 'vps' })
  })

  test('typical mistakes: a second A record, CNAME at @, CNAME to an address, dig before the change', () => {
    const start = buildWorld([], lesson)
    const twoA = foldWorld(start, [
      addRecord('ns', 'myapp.example', {
        type: 'A',
        name: '@',
        value: '198.51.100.20',
      }),
    ])
    expect(failureOf(twoA, taskGoals[0] ?? Goal.NoAddressConflict())).toEqual(
      Option.some(
        NetMessage.SeveralAddresses({
          name: 'myapp.example',
          ips: ['198.51.100.200', '198.51.100.20'],
        }),
      ),
    )
    expect(
      applyWorld(
        start,
        setRecord('ns', 'myapp.example', {
          type: 'CNAME',
          name: '@',
          value: 'x.example',
        }),
      ),
    ).toMatchObject({
      _tag: 'Failure',
      failure: NetMessage.CnameAtApex({ zone: 'myapp.example' }),
    })
    expect(
      applyWorld(
        start,
        setRecord('ns', 'myapp.example', {
          type: 'CNAME',
          name: 'www',
          value: '198.51.100.20',
        }),
      ),
    ).toMatchObject({
      _tag: 'Failure',
      failure: NetMessage.CnameNeedsName({ value: '198.51.100.20' }),
    })
    const early = foldWorld(start, [
      run('laptop', 'dig myapp.example'),
      ...solution.slice(0, 3),
      run('laptop', 'dig myapp.example'),
    ])
    expect(failureOf(early, taskGoals[3] ?? Goal.NoAddressConflict())).toEqual(
      Option.some(
        NetMessage.GoalCommandSawOther({
          device: 'laptop',
          name: 'myapp.example',
          saw: ['198.51.100.200'],
          want: '198.51.100.20',
        }),
      ),
    )
  })
})

describe('lesson 11 (https): postcard, sealed envelope and a certificate', () => {
  const lesson = buildNet([
    homeRouter,
    add(
      host('laptop', 'laptop', 110, 140, {
        mac: '3c:22:fb:4a:10:42',
        wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
      }),
    ),
    add(
      router('cafe', 290, 430, {
        lan: '10.10.0.1/24',
        wan: '203.0.113.90',
        dns: '192.0.2.53',
        wifi: wifi('Кафе Утро', ''),
      }),
    ),
    add(host('phone', 'phone', 110, 380)),
    add(
      host('stranger', 'laptop', 110, 490, {
        wifi: { ssid: 'Кафе Утро', password: '' },
      }),
    ),
    add(internet('internet', 500, 310)),
    add(
      host('dns', 'server', 500, 90, {
        address: '192.0.2.53/24',
        listeners: [udp(53)],
        records: [
          { name: 'myapp.example', ip: '198.51.100.20' },
          { name: 'www.myapp.example', ip: '198.51.100.20' },
          { name: 'shop.example', ip: '198.51.100.10' },
          { name: 'ca.example', ip: '198.51.100.30' },
        ],
      }),
    ),
    add(
      host('vps', 'server', 760, 180, {
        address: '198.51.100.20/24',
        listeners: [tcp(80), tcp(3000, '127.0.0.1'), tcp(5432, '127.0.0.1')],
      }),
    ),
    add(
      host('shop', 'server', 760, 420, {
        address: '198.51.100.10/24',
        listeners: [tcp(80), tcp(443)],
        redirect: true,
        certs: [
          {
            names: ['shop.example'],
            issuer: 'Example CA',
            notAfter: '2027-03-14',
          },
        ],
      }),
    ),
    add(
      certificateAuthority('ca', 890, 300, {
        address: '198.51.100.30/24',
        dns: '192.0.2.53',
      }),
    ),
    radio('laptop', 'router'),
    radio('phone', 'cafe'),
    radio('stranger', 'cafe'),
    joinWifi('phone', 'Кафе Утро', ''),
    cable('router', 'internet'),
    cable('cafe', 'internet'),
    cable('internet', 'dns'),
    cable('internet', 'vps'),
    cable('internet', 'shop'),
    cable('internet', 'ca'),
  ])
  const login = (url: string) =>
    Intent.Submit({
      from: 'phone',
      url,
      fields: [
        { name: 'login', value: 'anna' },
        { name: 'password', value: 'kotik2024' },
      ],
    })
  const cafeHop = (result: Trace) =>
    Option.getOrThrow(
      Array.findFirst(
        result.hops,
        hop =>
          hop.from === 'phone' &&
          hop.to === 'cafe' &&
          hop.envelope.some(layer => layer._tag === 'Http'),
      ),
    )

  test('plain http is a postcard: the password is readable on the cafe hop', () => {
    const seen = observerView(
      cafeHop(traceOn(lesson, login('http://myapp.example/login'))),
    )
    expect(seen.sealed).toBe(false)
    expect(Option.map(seen.maybeHttp, layer => layer.fields)).toEqual(
      Option.some([
        { name: 'login', value: 'anna' },
        { name: 'password', value: 'kotik2024' },
      ]),
    )
  })

  test('https seals it: the cafe sees the address, port 443 and the site name only', () => {
    const result = traceOn(lesson, login('https://shop.example/login'))
    const seen = observerView(cafeHop(result))
    expect([
      seen.dst,
      seen.dstPort,
      seen.maybeSni,
      seen.sealed,
      seen.maybeHttp,
    ]).toEqual([
      Option.some('198.51.100.10'),
      Option.some(443),
      Option.some('shop.example'),
      true,
      Option.none(),
    ])
    expect(result.outcome).toMatchObject({
      _tag: 'Delivered',
      answer: { status: 200, secure: true },
    })
    expect(
      browse(lesson, emptyState, 'phone', 'http://shop.example/').view,
    ).toMatchObject({
      _tag: 'Page',
      url: 'https://shop.example/',
      secure: true,
    })
  })

  test('task get-certificate: open 80, issue for both names, redirect', () => {
    const start = buildWorld(
      [
        stopListening('vps', 'tcp', 80),
        listen('vps', 'tcp', '0.0.0.0', 443),
        setCert('vps', {
          names: ['vps-20.hosting.example'],
          issuer: 'Example CA',
          notAfter: '2027-03-14',
        }),
      ],
      lesson,
    )
    const taskGoals = [
      Goal.ValidCert({ from: 'phone', url: 'https://myapp.example/' }),
      Goal.ValidCert({ from: 'phone', url: 'https://www.myapp.example/' }),
      Goal.RedirectsToHttps({ from: 'phone', url: 'http://myapp.example/' }),
      goals.onlyOpenPorts('vps', 'stranger', [80, 443]),
    ]
    expect(metAll(start, taskGoals)).toEqual([false, false, false, true])
    expect(
      browse(start.doc, start.state, 'phone', 'https://myapp.example').view,
    ).toMatchObject({
      code: 'NET::ERR_CERT_COMMON_NAME_INVALID',
    })
    expect(
      applyWorld(start, issueCert('vps', ['myapp.example'])),
    ).toMatchObject({
      _tag: 'Failure',
      failure: NetMessage.AcmeChallengeFailed({
        name: 'myapp.example',
        problem: 'refused',
        maybeIp: Option.some('198.51.100.20'),
      }),
    })
    const opened = foldWorld(start, [listen('vps', 'tcp', '0.0.0.0', 80)])
    expect(
      applyWorld(opened, issueCert('vps', ['shop.example'])),
    ).toMatchObject({
      failure: { problem: 'wrong-server' },
    })
    expect(
      applyWorld(opened, issueCert('vps', ['myap.example'])),
    ).toMatchObject({
      failure: { problem: 'not-found' },
    })
    const solved = foldWorld(opened, [
      issueCert('vps', ['myapp.example', 'www.myapp.example']),
      setRedirect('vps', true),
    ])
    expect(metAll(solved, taskGoals)).toEqual([true, true, true, true])
    expect(
      Option.flatMap(
        Array.findFirst(solved.doc.devices, device => device.id === 'vps'),
        device =>
          device._tag === 'Host' ? Array.head(device.certs) : Option.none(),
      ),
    ).toEqual(
      Option.some({
        names: ['myapp.example', 'www.myapp.example'],
        issuer: 'Example CA',
        notAfter: '2027-01-28',
      }),
    )
    const leaky = foldWorld(solved, [listen('vps', 'tcp', '0.0.0.0', 5432)])
    expect(failureOf(leaky, taskGoals[3] ?? Goal.NoAddressConflict())).toEqual(
      Option.some(
        NetMessage.GoalExtraOpenPort({
          target: 'vps',
          port: 5432,
          device: 'vps',
        }),
      ),
    )
  })

  test('curl -v shows the certificate problem and the redirect', () => {
    const broken = buildWorld(
      [
        setCert('vps', {
          names: ['vps-20.hosting.example'],
          issuer: 'Example CA',
          notAfter: '2027-03-14',
        }),
        listen('vps', 'tcp', '0.0.0.0', 443),
      ],
      lesson,
    )
    const output = runCommand(
      broken.doc,
      broken.state,
      'laptop',
      'curl -v https://myapp.example/',
    ).output
    expect(output.at(-1)).toBe(
      "curl: (60) SSL: no alternative certificate subject name matches target host name 'myapp.example'",
    )
    expect(output).toContain('*  subjectAltName: vps-20.hosting.example')
    const redirect = runCommand(
      lesson,
      emptyState,
      'laptop',
      'curl -v http://shop.example/',
    ).output
    expect(redirect).toContain('< HTTP/1.1 301 Moved Permanently')
    expect(redirect).toContain('< Location: https://shop.example/')
    expect(routeOf).toBeDefined()
  })
})
