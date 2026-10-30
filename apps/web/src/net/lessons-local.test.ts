import { Array, Option, pipe } from 'effect'
import { describe, expect, test } from 'vitest'

import { macFromId } from './address'
import {
  dhcpServerOf,
  exitOf,
  firstAddressee,
  nextHopAfter,
  notConnected,
} from './answers'
import { browse } from './browser'
import {
  add,
  cable,
  configureWifi,
  forgetWifi,
  host,
  joinWifi,
  listen,
  move,
  nearbyAp,
  radio,
  run,
  send,
  setDns,
  setLinkUp,
  tcp,
  transit,
  udp,
  wall,
  wifi,
} from './build'
import { Goal, checkGoal, goals } from './goals'
import { NetMessage } from './message'
import { type NetDoc, emptyState } from './model'
import { Answer, Intent, Outcome, type Trace, levelOf } from './packet'
import {
  HOME_PASSWORD,
  HOME_SSID,
  buildNet,
  buildWorld,
  homeNet,
  homeRouter,
  layerOf,
  routeOf,
} from './testing'
import { addressOf, checkJoin, nearbyNetworks } from './topology'
import { settle, trace } from './trace'
import { foldWorld } from './world'

const traceOf = (doc: NetDoc, intent: Intent): Trace =>
  trace(doc, settle(doc, emptyState), intent)[0]

const metAll = (doc: NetDoc, list: ReadonlyArray<Goal>, state = emptyState) =>
  Array.map(list, goal => checkGoal(doc, state, goal).met)

const failureOf = (doc: NetDoc, goal: Goal, state = emptyState) =>
  checkGoal(doc, state, goal).maybeFailure

const shopPage = (from: string) =>
  Intent.Browse({ from, url: 'https://shop.example/' })

describe('lesson 1 (phone-online): the phone joins home Wi-Fi and reaches the shop', () => {
  const nearby = [
    add(nearbyAp('cafe', 60, 120, wifi('Кафе Утро', ''))),
    add(
      nearbyAp(
        'neighbour',
        560,
        40,
        wifi('Router-3A90', 'their-secret', { band: '2.4', channel: 1 }),
      ),
    ),
  ]
  const lesson = buildNet(nearby, homeNet())

  test('a photo from the laptop to the phone goes through the router', () => {
    const photo = traceOf(
      lesson,
      Intent.Send({ from: 'laptop', to: 'phone', what: 'photo' }),
    )
    expect(photo.outcome).toEqual(
      Outcome.Delivered({
        at: 'phone',
        answer: Answer.Received({ ip: '192.168.1.100', what: 'photo' }),
      }),
    )
    expect(
      routeOf(photo, Option.getOrThrow(Array.last(photo.hops)).packet),
    ).toEqual(['laptop>router', 'router>phone'])
  })

  test('the envelope to the shop goes phone → router → internet → shop and back; the router is the way out', () => {
    const page = traceOf(lesson, shopPage('phone'))
    expect(page.outcome._tag).toBe('Delivered')
    const request = Option.getOrThrow(
      Array.findFirst(page.hops, hop =>
        Array.some(hop.envelope, layer => layer._tag === 'Http'),
      ),
    ).packet
    expect(routeOf(page, request)).toEqual([
      'phone>router',
      'router>internet',
      'internet>shop',
    ])
    expect(exitOf(lesson, page)).toEqual(Option.some('router'))
  })

  test('task join-wifi: the phone sees three networks and joins its own with the sticker password', () => {
    const start = buildNet([forgetWifi('phone')], lesson)
    const taskGoals = [
      Goal.Associated({ device: 'phone', ap: 'router' }),
      Goal.CanReach({ intent: shopPage('phone') }),
    ]
    expect(metAll(start, taskGoals)).toEqual([false, false])
    expect(failureOf(start, taskGoals[0] ?? Goal.NoAddressConflict())).toEqual(
      Option.some(NetMessage.NoWifiProfile({ device: 'phone' })),
    )

    const networks = nearbyNetworks(start, 'phone')
    expect(Array.map(networks, network => network.ssid)).toEqual([
      HOME_SSID,
      'Кафе Утро',
      'Router-3A90',
    ])
    expect(Array.map(networks, network => network.security)).toEqual([
      'wpa2',
      'open',
      'wpa2',
    ])
    const signal = (ssid: string) =>
      Option.getOrThrow(
        Array.findFirst(networks, network => network.ssid === ssid),
      ).signal
    expect(signal('Router-3A90')).toBeLessThan(signal(HOME_SSID))

    expect([
      checkJoin(start, 'phone', 'Кафе Утро', ''),
      checkJoin(start, 'phone', 'Router-3A90', '12345678'),
      checkJoin(start, 'phone', HOME_SSID, '1234567'),
      checkJoin(start, 'phone', HOME_SSID, HOME_PASSWORD),
    ]).toEqual([
      Option.some(
        NetMessage.ForeignOpenNetwork({ device: 'phone', ssid: 'Кафе Утро' }),
      ),
      Option.some(
        NetMessage.ForeignNetwork({ device: 'phone', ssid: 'Router-3A90' }),
      ),
      Option.some(
        NetMessage.WrongPassword({ device: 'phone', ssid: HOME_SSID }),
      ),
      Option.none(),
    ])

    const solved = buildNet(
      [joinWifi('phone', HOME_SSID, HOME_PASSWORD)],
      start,
    )
    expect(metAll(solved, taskGoals)).toEqual([true, true])
  })
})

describe('lesson 2 (addresses): every device has its own address', () => {
  const lesson = buildNet(
    [add(host('printer', 'printer', 300, 500))],
    homeNet(),
  )
  const photo = (to: string) =>
    Intent.Send({ from: 'phone', to, what: 'photo' })
  const print = (to: string) =>
    Intent.Send({ from: 'laptop', to, what: 'document' })
  const taskGoals = [
    goals.performed('phone', 'laptop', { intent: 'Send' }),
    Goal.HasAddress({ device: 'printer', maybeIp: Option.none() }),
    goals.performed('laptop', 'printer', { intent: 'Send' }),
  ]

  test('the router hands out .100 to the phone and keeps .42 for the laptop; it is the answer to the quiz', () => {
    const state = settle(lesson, emptyState)
    expect(
      Array.map(['phone', 'laptop', 'printer'], id =>
        addressOf(lesson, state, id),
      ),
    ).toEqual([
      Option.some('192.168.1.100'),
      Option.some('192.168.1.42'),
      Option.none(),
    ])
    expect(dhcpServerOf(lesson, 'phone')).toEqual(Option.some('router'))
  })

  test('typical wrong addresses land elsewhere or nowhere', () => {
    const outcomeOf = (to: string) => traceOf(lesson, photo(to)).outcome
    expect(outcomeOf('192.168.1.1')).toMatchObject({
      _tag: 'Delivered',
      at: 'router',
    })
    const self = traceOf(lesson, photo('192.168.1.100'))
    expect(self.outcome).toMatchObject({ _tag: 'Delivered', at: 'phone' })
    expect(self.hops).toEqual([])
    expect(outcomeOf('192.168.1.43')).toEqual(
      Outcome.Dropped({
        at: 'phone',
        reason: NetMessage.ArpNoReply({ device: 'phone', ip: '192.168.1.43' }),
      }),
    )
    expect(outcomeOf('198.51.100.10')).toMatchObject({
      _tag: 'Delivered',
      at: 'shop',
    })
    expect(outcomeOf('192.168.142')).toMatchObject({ _tag: 'Dropped' })
  })

  test('task photo-and-printer: none of the goals at the start, all after the reference solution', () => {
    const start = buildWorld([], lesson)
    expect(metAll(start.doc, taskGoals, start.state)).toEqual([
      false,
      false,
      false,
    ])

    const solved = foldWorld(start, [
      send(photo('192.168.1.42')),
      cable('printer', 'router'),
      send(print('192.168.1.101')),
    ])
    expect(addressOf(solved.doc, solved.state, 'printer')).toEqual(
      Option.some('192.168.1.101'),
    )
    expect(metAll(solved.doc, taskGoals, solved.state)).toEqual([
      true,
      true,
      true,
    ])
  })

  test('a cable from the printer to the laptop is refused: the laptop has one socket, taken by Wi-Fi', () => {
    expect(() => buildNet([cable('printer', 'laptop')], lesson)).toThrow(
      /PortBusy/,
    )
  })
})

describe('lesson 3 (site-names): the name turns into an address', () => {
  const taskGoals = [
    Goal.HasDnsServer({ device: 'phone' }),
    goals.resolves('phone', 'shop.example', '198.51.100.10'),
    goals.performed('phone', 'shop', { intent: 'Browse' }),
  ]

  test('quiz who-first: with empty contacts the phone writes to the DNS server first', () => {
    const page = traceOf(homeNet(), shopPage('phone'))
    expect(firstAddressee(page)).toEqual(Option.some('dns'))
  })

  test('task no-dns: manual DNS with an empty list gives ERR_NAME_NOT_RESOLVED until DNS is automatic', () => {
    const start = buildWorld(
      [setDns('phone', { mode: 'manual', servers: [] })],
      homeNet(),
    )
    expect(metAll(start.doc, taskGoals, start.state)).toEqual([
      false,
      false,
      false,
    ])
    const broken = browse(
      start.doc,
      start.state,
      'phone',
      'https://shop.example/',
    )
    expect(broken.view).toMatchObject({
      _tag: 'Error',
      code: 'ERR_NAME_NOT_RESOLVED',
      reason: NetMessage.NoDnsServer({ device: 'phone' }),
    })

    const solved = foldWorld(start, [
      setDns('phone', { mode: 'auto' }),
      send(shopPage('phone')),
    ])
    expect(metAll(solved.doc, taskGoals, solved.state)).toEqual([
      true,
      true,
      true,
    ])
    expect(
      Array.some(
        solved.state.dnsCache,
        entry => entry.device === 'phone' && entry.name === 'shop.example',
      ),
    ).toBe(true)
  })

  test('manual DNS: the resolver works, the shop does not answer names, the router is simplified', () => {
    const page = (servers: ReadonlyArray<string>) =>
      browse(
        buildNet([setDns('phone', { mode: 'manual', servers })], homeNet()),
        emptyState,
        'phone',
        'shop.example',
      ).view
    expect(page(['192.0.2.53'])).toMatchObject({ _tag: 'Page', status: 200 })
    expect(page(['198.51.100.10'])).toMatchObject({
      _tag: 'Error',
      code: 'ERR_NAME_NOT_RESOLVED',
      reason: NetMessage.PortClosed({ device: 'shop', proto: 'udp', port: 53 }),
    })
    expect(page(['192.168.1.1'])).toMatchObject({
      _tag: 'Error',
      reason: NetMessage.PortClosed({
        device: 'router',
        proto: 'udp',
        port: 53,
      }),
    })
  })
})

/** Дом уроков 4 и 8: облако раскрыто в цепочку роутеров провайдера. */
const chainOps = [
  add(
    host('phone', 'phone', 110, 170, {
      wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
    }),
  ),
  add(
    host('laptop', 'laptop', 110, 300, {
      mac: '3c:22:fb:4a:10:42',
      wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
    }),
  ),
  add(host('printer', 'printer', 110, 430)),
  homeRouter,
  add(transit('isp', 490, 300, { ip: '203.0.113.1', name: 'gw.isp.example' })),
  add(transit('core', 640, 300, { ip: '192.0.2.1', name: 'core.isp.example' })),
  add(
    transit('hosting', 780, 300, {
      ip: '198.51.100.1',
      name: 'gw.hosting.example',
    }),
  ),
  add(
    host('dns', 'server', 640, 140, {
      address: '192.0.2.53/24',
      listeners: [udp(53)],
      records: [{ name: 'shop.example', ip: '198.51.100.10' }],
    }),
  ),
  add(
    host('shop', 'server', 890, 300, {
      address: '198.51.100.10/24',
      listeners: [tcp(80), tcp(443)],
      certs: [
        {
          names: ['shop.example'],
          issuer: 'Example CA',
          notAfter: '2027-03-14',
        },
      ],
    }),
  ),
  radio('phone', 'router'),
  radio('laptop', 'router'),
  cable('printer', 'router'),
  cable('router', 'isp'),
  cable('isp', 'core'),
  cable('core', 'dns'),
  cable('core', 'hosting'),
  cable('hosting', 'shop'),
]

export const chainNet = (): NetDoc => buildNet(chainOps)

describe('lesson 4 (hops-and-ping): the envelope passes several post offices', () => {
  test('the path to the shop is five hops; ping takes 6 ms to the router and 90 ms to the shop', () => {
    const doc = chainNet()
    const page = traceOf(doc, shopPage('laptop'))
    const request = Option.getOrThrow(
      Array.findFirst(page.hops, hop =>
        Array.some(hop.envelope, layer => layer._tag === 'Http'),
      ),
    ).packet
    expect(routeOf(page, request)).toEqual([
      'laptop>router',
      'router>isp',
      'isp>core',
      'core>hosting',
      'hosting>shop',
    ])
    const echo = (target: string) =>
      traceOf(doc, Intent.Ping({ from: 'laptop', host: target })).outcome
    expect(echo('192.168.1.1')).toMatchObject({
      answer: { _tag: 'EchoReply', ms: 6, ttl: 64 },
    })
    expect(echo('shop.example')).toMatchObject({
      answer: { _tag: 'EchoReply', ip: '198.51.100.10', ms: 90, ttl: 60 },
    })
  })

  test('quiz next-hop: from the provider router the envelope goes to the core node', () => {
    const page = traceOf(chainNet(), shopPage('laptop'))
    const request = Option.getOrThrow(
      Array.findFirst(page.hops, hop =>
        Array.some(hop.envelope, layer => layer._tag === 'Http'),
      ),
    ).packet
    expect(nextHopAfter(page, 'isp', request)).toEqual(Option.some('core'))
  })

  test('task find-break: the provider cable is out; the router answers, the shop does not; plugging it back fixes both', () => {
    const remembered = foldWorld(buildWorld([], chainNet()), [
      send(Intent.Ping({ from: 'laptop', host: 'shop.example' })),
    ])
    const start = foldWorld(remembered, [setLinkUp('router', 'isp', false)])
    const ping = Intent.Ping({ from: 'laptop', host: 'shop.example' })
    const taskGoals = [
      Goal.CanReach({ intent: ping }),
      Goal.CanReach({ intent: shopPage('laptop') }),
    ]
    expect(metAll(start.doc, taskGoals, start.state)).toEqual([false, false])
    expect(
      failureOf(start.doc, Goal.CanReach({ intent: ping }), start.state),
    ).toEqual(Option.some(NetMessage.NoWanLink({ router: 'router' })))
    expect(
      checkGoal(
        start.doc,
        start.state,
        Goal.CanReach({
          intent: Intent.Ping({ from: 'laptop', host: '192.168.1.1' }),
        }),
      ).met,
    ).toBe(true)
    const solved = foldWorld(start, [setLinkUp('router', 'isp', true)])
    expect(metAll(solved.doc, taskGoals, solved.state)).toEqual([true, true])
  })
})

describe('lesson 5 (wifi-range): range, walls and two bands', () => {
  const flat = [
    add(
      host('phone', 'phone', 400, 220, {
        wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
      }),
    ),
    add(
      host('laptop', 'laptop', 420, 400, {
        mac: '3c:22:fb:4a:10:42',
        wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
      }),
    ),
    add(host('printer', 'printer', 180, 440)),
    homeRouter,
    radio('phone', 'router'),
    radio('laptop', 'router'),
    cable('printer', 'router'),
    wall(470, 40, 470, 470),
    wall(560, 40, 560, 470),
  ]
  const room = buildNet([...flat, move('router', 300, 320)])
  const kitchen = buildNet([move('phone', 640, 260)], room)
  const band = (doc: NetDoc, device: string) =>
    Option.getOrThrow(
      Array.findFirst(nearbyNetworks(doc, device), network => network.linked),
    )

  test('in the room both devices are on 5 GHz; in the kitchen two walls leave the phone only 2.4 GHz', () => {
    expect(band(room, 'phone').signal).toBe(3)
    expect(
      checkGoal(
        kitchen,
        emptyState,
        Goal.Associated({ device: 'phone', ap: 'router' }),
      ).met,
    ).toBe(true)
  })

  test('task kitchen-wifi: 5 GHz only loses the kitchen phone and the 2.4 GHz bulb; both bands bring them in', () => {
    const fiveOnly = buildNet(
      [
        configureWifi(
          'router',
          wifi(HOME_SSID, HOME_PASSWORD, { band: '5', channel: 36 }),
        ),
        add(
          host('bulb', 'bulb', 640, 400, {
            wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
          }),
        ),
        radio('bulb', 'router'),
      ],
      kitchen,
    )
    const taskGoals = [
      Goal.Associated({ device: 'phone', ap: 'router' }),
      Goal.Associated({ device: 'bulb', ap: 'router' }),
      Goal.WifiSecurity({ ap: 'router', min: 'wpa2' }),
    ]
    expect(metAll(fiveOnly, taskGoals)).toEqual([false, false, true])
    expect(
      Array.map(taskGoals.slice(0, 2), goal => failureOf(fiveOnly, goal)),
    ).toEqual([
      Option.some(NetMessage.OutOfRange({ device: 'phone', ap: 'router' })),
      Option.some(NetMessage.BandUnsupported({ device: 'bulb', band: '5' })),
    ])
    expect(
      notConnected(fiveOnly, ['phone', 'laptop', 'printer', 'bulb']),
    ).toEqual(['phone', 'bulb'])

    const solved = buildNet(
      [
        configureWifi(
          'router',
          wifi(HOME_SSID, HOME_PASSWORD, { band: 'dual', channel: 6 }),
        ),
      ],
      fiveOnly,
    )
    expect(metAll(solved, taskGoals)).toEqual([true, true, true])
    expect(addressOf(solved, settle(solved, emptyState), 'bulb')).toEqual(
      Option.some('192.168.1.102'),
    )
    const open = buildNet(
      [
        configureWifi(
          'router',
          wifi(HOME_SSID, '', { band: 'dual', channel: 6 }),
        ),
      ],
      fiveOnly,
    )
    expect(
      failureOf(open, Goal.WifiSecurity({ ap: 'router', min: 'wpa2' })),
    ).toEqual(
      Option.some(
        NetMessage.GoalWifiTooWeak({
          ap: 'router',
          security: 'open',
          want: 'wpa2',
        }),
      ),
    )
  })
})

describe('lesson 6 (ports-and-localhost): a dev server opened from the phone', () => {
  const devUrl = 'http://192.168.1.42:5173/'
  const taskGoals = [
    Goal.Listening({
      device: 'laptop',
      proto: 'tcp',
      port: 5173,
      maybeBind: Option.some('0.0.0.0'),
    }),
    goals.performed('phone', 'laptop', { intent: 'Browse', port: 5173 }),
  ]

  test('localhost on the phone is the phone itself; the laptop address is refused while the server listens on 127.0.0.1', () => {
    const start = buildWorld([run('laptop', 'npm run dev')], homeNet())
    expect(
      browse(start.doc, start.state, 'phone', 'localhost:5173').view,
    ).toMatchObject({
      _tag: 'Error',
      code: 'ERR_CONNECTION_REFUSED',
      reason: NetMessage.PortClosed({
        device: 'phone',
        proto: 'tcp',
        port: 5173,
      }),
    })
    expect(
      browse(start.doc, start.state, 'phone', '192.168.1.42:5173').view,
    ).toMatchObject({
      _tag: 'Error',
      code: 'ERR_CONNECTION_REFUSED',
      reason: NetMessage.ListensOnlyOnLoopback({
        device: 'laptop',
        port: 5173,
      }),
    })
    expect(
      browse(start.doc, start.state, 'laptop', 'localhost:5173').view,
    ).toMatchObject({
      _tag: 'Page',
      status: 200,
    })
    expect(
      browse(start.doc, start.state, 'phone', 'https://192.168.1.42:5173').view,
    ).toMatchObject({
      code: 'ERR_CONNECTION_REFUSED',
    })
  })

  test('task: restart with -- --host, then the phone opens the laptop address; --host without -- stays local', () => {
    const start = buildWorld([run('laptop', 'npm run dev')], homeNet())
    expect(metAll(start.doc, taskGoals, start.state)).toEqual([false, false])
    const wrong = foldWorld(start, [
      run('laptop', 'Ctrl+C'),
      run('laptop', 'npm run dev --host'),
    ])
    expect(
      checkGoal(
        wrong.doc,
        wrong.state,
        taskGoals[0] ?? Goal.NoAddressConflict(),
      ).met,
    ).toBe(false)
    const solved = foldWorld(start, [
      run('laptop', 'Ctrl+C'),
      run('laptop', 'npm run dev -- --host'),
      send(Intent.Browse({ from: 'phone', url: devUrl })),
    ])
    expect(metAll(solved.doc, taskGoals, solved.state)).toEqual([true, true])
    const tls = browse(
      buildNet([listen('laptop', 'tcp', '0.0.0.0', 5173)], homeNet()),
      emptyState,
      'phone',
      'https://192.168.1.42:5173',
    ).view
    expect(tls).toMatchObject({ code: 'ERR_SSL_PROTOCOL_ERROR' })
  })
})

describe('lesson 7 (under-the-hood): an envelope in an envelope', () => {
  const raw = (
    order: ReadonlyArray<'link' | 'internet' | 'transport' | 'application'>,
  ) => Intent.Raw({ from: 'phone', url: 'https://shop.example/', order })

  test('the request has the same HTTP on every hop, a new outer frame each time and TTL 64, 63, 62', () => {
    const page = traceOf(homeNet(), shopPage('phone'))
    const request = Array.filter(page.hops, hop =>
      Array.some(
        hop.envelope,
        layer => layer._tag === 'Http' && Option.isNone(layer.maybeStatus),
      ),
    )
    expect(Array.map(request, hop => hop.envelope[0]?._tag)).toEqual([
      'WiFi',
      'Ethernet',
      'Ethernet',
    ])
    expect(Array.map(request, hop => layerOf(hop, 'Ip').ttl)).toEqual([
      64, 63, 62,
    ])
    expect(
      levelOf(layerOf(Option.getOrThrow(Array.head(request)), 'Tcp')),
    ).toBe('transport')
  })

  test('task: a wrong order fails where the envelope cannot be read; the right one reaches the shop', () => {
    const outcome = (order: Parameters<typeof raw>[0]) =>
      traceOf(homeNet(), raw(order)).outcome
    expect(outcome(['internet', 'link', 'transport', 'application'])).toEqual(
      Outcome.Dropped({
        at: 'phone',
        reason: NetMessage.NoLinkLayer({ device: 'phone' }),
      }),
    )
    expect(outcome(['link', 'transport', 'internet', 'application'])).toEqual(
      Outcome.Dropped({
        at: 'router',
        reason: NetMessage.NoAddressLayer({ device: 'router' }),
      }),
    )
    expect(outcome(['link', 'internet', 'application', 'transport'])).toEqual(
      Outcome.Refused({
        at: 'shop',
        reason: NetMessage.NoPortLayer({ device: 'shop' }),
      }),
    )
    const taskGoals = [
      goals.performed('phone', 'internet', { intent: 'Raw', reaches: true }),
      goals.performed('phone', 'shop', { intent: 'Raw' }),
    ]
    const start = buildWorld([], homeNet())
    expect(metAll(start.doc, taskGoals, start.state)).toEqual([false, false])
    const halfway = foldWorld(start, [
      send(raw(['link', 'internet', 'application', 'transport'])),
    ])
    expect(metAll(halfway.doc, taskGoals, halfway.state)).toEqual([true, false])
    const solved = foldWorld(start, [
      send(raw(['link', 'internet', 'transport', 'application'])),
    ])
    expect(metAll(solved.doc, taskGoals, solved.state)).toEqual([true, true])
  })

  test('the printer MAC is derived from its id, so lessons can reserve it', () => {
    expect(macFromId('printer')).toMatch(/^02:/)
    expect(
      pipe(
        homeNet().devices,
        Array.map(device => device.id),
      ),
    ).toContain('dns')
  })
})
