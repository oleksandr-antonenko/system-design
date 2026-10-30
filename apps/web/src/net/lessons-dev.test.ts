import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { macFromId } from './address'
import {
  deathDeviceOf,
  ruleHitBy,
  scanPorts,
  sourceAddressSeenBy,
} from './answers'
import { browse } from './browser'
import {
  add,
  cable,
  certificateAuthority,
  compose,
  composeFile,
  composeUp,
  container,
  dockerHost,
  firewall,
  forward,
  host,
  internet,
  issueCert,
  joinWifi,
  listen,
  meshJoin,
  radio,
  relay,
  reserve,
  router,
  rule,
  run,
  service,
  setCert,
  setDns,
  setRecord,
  setStatic,
  tcp,
  udp,
  vpnClient,
  vpnGateway,
  vpnSettings,
  webServer,
  wifi,
} from './build'
import { Goal, checkGoal, goals } from './goals'
import { NetMessage } from './message'
import { type NetDoc, emptyState } from './model'
import { Intent, type Trace } from './packet'
import { loginBanner, runCommand } from './terminal'
import {
  HOME_PASSWORD,
  HOME_SSID,
  buildNet,
  buildWorld,
  homeRouter,
} from './testing'
import { settle, trace } from './trace'
import { type World, foldWorld, sshLockedOut } from './world'

const traceOn = (doc: NetDoc, intent: Intent, world?: World): Trace =>
  trace(doc, settle(doc, world?.state ?? emptyState), intent)[0]

const metAll = (world: World, list: ReadonlyArray<Goal>) =>
  Array.map(list, goal => checkGoal(world.doc, world.state, goal).met)

const failureOf = (world: World, goal: Goal) =>
  checkGoal(world.doc, world.state, goal).maybeFailure

const home = [
  homeRouter,
  add(
    host('phone', 'phone', 130, 220, {
      wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
    }),
  ),
  add(
    host('laptop', 'laptop', 130, 430, {
      mac: '3c:22:fb:4a:10:42',
      wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
    }),
  ),
  add(internet('internet', 520, 325)),
  radio('phone', 'router'),
  radio('laptop', 'router'),
  cable('router', 'internet'),
]

const dnsHost = (
  records: ReadonlyArray<Readonly<{ name: string; ip: string }>>,
) =>
  add(
    host('dns', 'server', 520, 110, {
      address: '192.0.2.53/24',
      listeners: [udp(53)],
      records,
    }),
  )

describe('lesson 12 (firewall): a guard with a list', () => {
  const lesson = buildNet([
    ...home,
    dnsHost([
      { name: 'shop.example', ip: '198.51.100.10' },
      { name: 'myapp.example', ip: '198.51.100.20' },
    ]),
    add(
      host('scanner', 'pc', 520, 530, {
        address: '203.0.113.66/24',
        dns: '192.0.2.53',
      }),
    ),
    add(
      host('shop', 'server', 800, 140, {
        address: '198.51.100.10/24',
        listeners: [tcp(22), tcp(80), tcp(443)],
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
      host('vps', 'server', 800, 430, {
        address: '198.51.100.20/24',
        listeners: [tcp(22), tcp(80), tcp(443), tcp(5432)],
        certs: [
          {
            names: ['myapp.example'],
            issuer: 'Example CA',
            notAfter: '2027-03-14',
          },
        ],
      }),
    ),
    firewall('vps', { enabled: false, defaultIn: 'drop' }),
    cable('internet', 'dns'),
    cable('internet', 'scanner'),
    cable('internet', 'shop'),
    cable('internet', 'vps'),
  ])
  const shopGuard = firewall('shop', {
    enabled: true,
    defaultIn: 'drop',
    rules: [
      rule({ action: 'allow', proto: 'tcp', port: 443 }),
      rule({ action: 'allow', proto: 'tcp', port: 80 }),
      rule({ action: 'allow', proto: 'tcp', port: 22, from: '192.0.2.77' }),
    ],
  })
  const sshToShop = Intent.Connect({
    from: 'laptop',
    host: 'shop.example',
    port: 22,
  })
  const sshFromHome = Intent.Connect({
    from: 'laptop',
    host: 'myapp.example',
    port: 22,
  })
  const taskGoals = [
    Goal.CanReach({
      intent: Intent.Browse({ from: 'scanner', url: 'https://myapp.example/' }),
    }),
    Goal.CanReach({ intent: sshFromHome }),
    Goal.CannotReach({
      intent: Intent.Connect({
        from: 'laptop',
        host: 'myapp.example',
        port: 5432,
      }),
    }),
    goals.onlyOpenPorts('vps', 'scanner', [80, 443], true),
  ]

  test('the open server: the scanner reaches the database; ss -ltn lists four doors', () => {
    expect(
      traceOn(
        lesson,
        Intent.Connect({ from: 'scanner', host: 'myapp.example', port: 5432 }),
      ).outcome,
    ).toMatchObject({ _tag: 'Delivered', at: 'vps' })
    expect(
      runCommand(lesson, emptyState, 'vps', 'ss -ltn').output,
    ).toHaveLength(5)
  })

  test('the shop guard: the matched line is on the hop; drop is silence, a closed port is a fast refusal', () => {
    const guarded = buildNet([shopGuard], lesson)
    const page = traceOn(
      guarded,
      Intent.Browse({ from: 'laptop', url: 'https://shop.example/' }),
    )
    expect(page.outcome._tag).toBe('Delivered')
    expect(
      ruleHitBy(
        guarded,
        emptyState,
        Intent.Browse({ from: 'laptop', url: 'https://shop.example/' }),
        'shop',
      ),
    ).toEqual(
      Option.some({
        device: 'shop',
        scope: 'os',
        maybeRule: Option.some(1),
        action: 'allow',
      }),
    )
    expect(
      traceOn(
        guarded,
        Intent.Connect({ from: 'scanner', host: 'shop.example', port: 5432 }),
      ).outcome,
    ).toEqual({
      _tag: 'Dropped',
      at: 'shop',
      reason: NetMessage.FirewallDropped({
        device: 'shop',
        scope: 'os',
        maybeRule: Option.none(),
      }),
    })
    expect(
      traceOn(
        guarded,
        Intent.Connect({ from: 'scanner', host: 'myapp.example', port: 8080 }),
      ).outcome,
    ).toMatchObject({
      _tag: 'Refused',
      reason: NetMessage.PortClosed({
        device: 'vps',
        proto: 'tcp',
        port: 8080,
      }),
    })
    expect(ruleHitBy(guarded, emptyState, sshToShop, 'shop')).toEqual(
      Option.some({
        device: 'shop',
        scope: 'os',
        maybeRule: Option.none(),
        action: 'drop',
      }),
    )
    expect(
      traceOn(guarded, Intent.Ping({ from: 'scanner', host: '198.51.100.10' }))
        .outcome._tag,
    ).toBe('Delivered')
  })

  test('task lock-server: the panel and ufw give the same list; the scanner sees only 80 and 443', () => {
    const start = buildWorld([], lesson)
    expect(metAll(start, taskGoals)).toEqual([true, true, false, false])
    expect(loginBanner(start.doc, start.state, 'vps', 'laptop')).toEqual(
      Option.some('Last login: Thu Oct 29 21:14:03 2026 from 203.0.113.7'),
    )
    const panel = foldWorld(start, [
      firewall('vps', {
        enabled: true,
        defaultIn: 'drop',
        rules: [
          rule({
            action: 'allow',
            proto: 'tcp',
            port: 22,
            from: '203.0.113.7',
          }),
          rule({ action: 'allow', proto: 'tcp', port: 80 }),
          rule({ action: 'allow', proto: 'tcp', port: 443 }),
        ],
      }),
    ])
    expect(metAll(panel, taskGoals)).toEqual([true, true, true, true])
    const terminal = foldWorld(start, [
      run('vps', 'sudo ufw allow from 203.0.113.7 to any port 22 proto tcp'),
      run('vps', 'sudo ufw allow 80/tcp'),
      run('vps', 'sudo ufw allow 443/tcp'),
      run('vps', 'sudo ufw enable'),
    ])
    expect(metAll(terminal, taskGoals)).toEqual([true, true, true, true])
    expect(
      runCommand(terminal.doc, terminal.state, 'vps', 'sudo ufw status').output,
    ).toEqual([
      'Status: active',
      '',
      'To                         Action      From',
      '--                         ------      ----',
      '22/tcp                     ALLOW       203.0.113.7',
      '80/tcp                     ALLOW       Anywhere',
      '443/tcp                    ALLOW       Anywhere',
    ])
    expect(
      Array.map(
        scanPorts(
          terminal.doc,
          terminal.state,
          'scanner',
          '198.51.100.20',
          [22, 80, 443, 5432],
        ),
        row => row.status,
      ),
    ).toEqual(['filtered', 'open', 'open', 'filtered'])
    expect(
      runCommand(
        terminal.doc,
        terminal.state,
        'laptop',
        'nc -zv myapp.example 5432',
      ).output,
    ).toEqual([
      'nc: connect to myapp.example (198.51.100.20) port 5432 (tcp) timed out',
    ])
    expect(
      runCommand(start.doc, start.state, 'laptop', 'nc -zv myapp.example 5432')
        .output,
    ).toEqual([
      'Connection to myapp.example (198.51.100.20) 5432 port [tcp/postgresql] succeeded!',
    ])

    const lockedOut = foldWorld(start, [run('vps', 'sudo ufw enable')])
    expect(sshLockedOut(start, lockedOut, sshFromHome, 'vps')).toEqual(
      Option.some(NetMessage.SshLockedOut({ device: 'vps' })),
    )
    const homeAddress = foldWorld(start, [
      firewall('vps', {
        enabled: true,
        rules: [
          rule({
            action: 'allow',
            proto: 'tcp',
            port: 22,
            from: '192.168.1.42',
          }),
        ],
      }),
    ])
    expect(
      failureOf(homeAddress, Goal.CanReach({ intent: sshFromHome })),
    ).toEqual(
      Option.some(
        NetMessage.FirewallDropped({
          device: 'vps',
          scope: 'os',
          maybeRule: Option.none(),
        }),
      ),
    )
  })
})

describe('lesson 13 (vpn): full tunnel eats the printer, split tunnel brings it back', () => {
  const lesson = buildNet([
    ...home,
    add(host('printer', 'printer', 260, 520, { listeners: [tcp(631)] })),
    cable('printer', 'router'),
    reserve('router', macFromId('printer'), '192.168.1.50'),
    listen('laptop', 'tcp', '0.0.0.0', 5173),
    dnsHost([
      { name: 'shop.example', ip: '198.51.100.10' },
      { name: 'vpn.corp.example', ip: '192.0.2.200' },
    ]),
    add(
      host('shop', 'server', 500, 520, {
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
    add(
      vpnGateway('vpn-gw', 720, 300, {
        wan: '192.0.2.200',
        lan: '10.20.0.1/16',
        pool: '10.99.0.0/24',
        records: [{ name: 'wiki.corp.example', ip: '10.20.0.5' }],
      }),
    ),
    add(
      host('wiki', 'server', 860, 450, {
        address: '10.20.0.5/16',
        gateway: '10.20.0.1',
        listeners: [tcp(80)],
      }),
    ),
    cable('internet', 'dns'),
    cable('internet', 'shop'),
    cable('internet', 'vpn-gw'),
    cable('vpn-gw', 'wiki'),
    vpnClient('laptop', {
      gateway: 'vpn-gw',
      address: '10.99.0.23',
      mode: 'full',
      dns: { zone: 'corp.example', server: '10.20.0.1' },
      connected: false,
    }),
  ])
  const wikiPage = Intent.Browse({
    from: 'laptop',
    url: 'http://wiki.corp.example/',
  })
  const shopPage = Intent.Browse({
    from: 'laptop',
    url: 'https://shop.example/',
  })
  const printJob = Intent.Connect({
    from: 'laptop',
    host: '192.168.1.50',
    port: 631,
  })
  const devFromPhone = Intent.Browse({
    from: 'phone',
    url: 'http://192.168.1.42:5173/',
  })
  const taskGoals = [
    Goal.Via({ intent: wikiPage, device: 'vpn-gw', through: true }),
    Goal.CanReach({ intent: printJob }),
    Goal.CanReach({ intent: devFromPhone }),
    Goal.Via({ intent: shopPage, device: 'vpn-gw', through: false }),
  ]

  test('quiz seen-address: with the full tunnel the shop sees the office gateway', () => {
    const on = buildNet([vpnSettings('laptop', { connected: true })], lesson)
    const page = traceOn(on, shopPage)
    expect(page.outcome._tag).toBe('Delivered')
    expect(sourceAddressSeenBy(page, 'shop')).toEqual(
      Option.some('192.0.2.200'),
    )
    const tunneled = Option.getOrThrow(
      Array.findFirst(
        page.hops,
        hop =>
          hop.from === 'laptop' &&
          hop.envelope.some(layer => layer._tag === 'Tunnel'),
      ),
    )
    expect(
      Array.filter(tunneled.envelope, layer => layer._tag === 'Ip'),
    ).toHaveLength(2)
    expect(sourceAddressSeenBy(traceOn(lesson, shopPage), 'shop')).toEqual(
      Option.some('203.0.113.7'),
    )
  })

  test('task split-tunnel: only 10.0.0.0/8 goes into the tunnel', () => {
    const start = buildWorld(
      [vpnSettings('laptop', { connected: true })],
      lesson,
    )
    expect(metAll(start, taskGoals)).toEqual([true, false, false, false])
    expect(failureOf(start, Goal.CanReach({ intent: printJob }))).toEqual(
      Option.some(
        NetMessage.TunnelNoRoute({ gateway: 'vpn-gw', ip: '192.168.1.50' }),
      ),
    )
    expect(failureOf(start, Goal.CanReach({ intent: devFromPhone }))).toEqual(
      Option.some(
        NetMessage.TunnelNoRoute({ gateway: 'vpn-gw', ip: '192.168.1.100' }),
      ),
    )
    expect(
      runCommand(start.doc, start.state, 'laptop', 'traceroute 10.20.0.5')
        .output[1],
    ).toMatch(/^ 1 {2}10\.99\.0\.1 \(10\.99\.0\.1\)/)
    const solved = foldWorld(start, [
      vpnSettings('laptop', {
        connected: true,
        mode: 'split',
        networks: ['10.0.0.0/8'],
      }),
    ])
    expect(metAll(solved, taskGoals)).toEqual([true, true, true, true])
    const off = foldWorld(start, [vpnSettings('laptop', { connected: false })])
    expect(failureOf(off, taskGoals[0] ?? Goal.NoAddressConflict())).toEqual(
      Option.some(NetMessage.NameNotFound({ name: 'wiki.corp.example' })),
    )
    const narrow = foldWorld(start, [
      vpnSettings('laptop', { mode: 'split', networks: ['10.0.0.0/24'] }),
    ])
    expect(
      checkGoal(
        narrow.doc,
        narrow.state,
        taskGoals[0] ?? Goal.NoAddressConflict(),
      ).met,
    ).toBe(false)
  })

  test('split DNS: the office directory is asked through the tunnel even when its network is not on the list', () => {
    const one = buildWorld(
      [
        vpnSettings('laptop', {
          connected: true,
          mode: 'split',
          networks: ['10.20.0.5/32'],
        }),
      ],
      lesson,
    )
    expect(metAll(one, taskGoals)).toEqual([true, true, true, true])
    expect(runCommand(one.doc, one.state, 'laptop', 'ip route').output).toEqual(
      expect.arrayContaining(['10.20.0.5/32 dev wg0', '10.20.0.1/32 dev wg0']),
    )
    const wide = buildWorld(
      [
        vpnSettings('laptop', {
          connected: true,
          mode: 'split',
          networks: ['10.0.0.0/8'],
        }),
      ],
      lesson,
    )
    expect(
      runCommand(wide.doc, wide.state, 'laptop', 'ip route').output,
    ).not.toContain('10.20.0.1/32 dev wg0')
    expect(
      runCommand(wide.doc, wide.state, 'laptop', 'nslookup wiki.corp.example')
        .output[0],
    ).toBe('Server:\t\t10.20.0.1')
    expect(
      runCommand(wide.doc, wide.state, 'laptop', 'nslookup shop.example')
        .output[0],
    ).toBe('Server:\t\t192.0.2.53')
  })
})

describe('lesson 14 (dev-networks): localhost, Docker and a tunnel', () => {
  const startCompose = composeFile([
    service('app', {
      image: 'shop-app',
      port: 3000,
      environment: { DATABASE_URL: 'postgres://shop:shop@localhost:5432/shop' },
      needsEnv: 'DATABASE_URL',
    }),
    service('db', { image: 'postgres:16', port: 5432, ports: ['5432:5432'] }),
  ])
  const solvedCompose = composeFile([
    service('app', {
      image: 'shop-app',
      port: 3000,
      environment: { DATABASE_URL: 'postgres://shop:shop@db:5432/shop' },
      ports: ['8080:3000'],
      needsEnv: 'DATABASE_URL',
    }),
    service('db', { image: 'postgres:16', port: 5432 }),
  ])
  const lesson = buildNet([
    ...home,
    dockerHost('laptop', { bridge: '172.18.0.1/16', network: 'shop_default' }),
    add(
      container('db', 'laptop', 330, 480, {
        image: 'postgres:16',
        ip: '172.18.0.2',
        listeners: [tcp(5432)],
      }),
    ),
    add(
      container('app', 'laptop', 170, 480, {
        image: 'shop-app',
        ip: '172.18.0.3',
        listeners: [tcp(3000)],
      }),
    ),
    compose('laptop', startCompose),
    composeUp('laptop'),
    dnsHost([]),
    setRecord('dns', 'tunnel.example', {
      type: 'A',
      name: 'quiet-river-42',
      value: '198.51.100.80',
    }),
    add(
      relay('relay', 790, 130, {
        address: '198.51.100.80/24',
        domain: 'tunnel.example',
        certNames: ['quiet-river-42.tunnel.example'],
      }),
    ),
    add(
      router('friend-router', 740, 430, {
        lan: '192.168.1.1/24',
        wan: '203.0.113.77',
        dns: '192.0.2.53',
        wifi: wifi('Friend', '87654321'),
      }),
    ),
    add(
      host('friend', 'phone', 860, 520, {
        wifi: { ssid: 'Friend', password: '87654321' },
      }),
    ),
    cable('internet', 'dns'),
    cable('internet', 'relay'),
    cable('friend-router', 'internet'),
    radio('friend', 'friend-router'),
  ])
  const appToLocalDb = Intent.Connect({
    from: 'app',
    host: 'localhost',
    port: 5432,
  })
  const appToDbName = Intent.Connect({ from: 'app', host: 'db', port: 5432 })
  const dbFromPhone = Intent.Connect({
    from: 'phone',
    host: '192.168.1.42',
    port: 5432,
  })
  const shopLocal = Intent.Browse({
    from: 'laptop',
    url: 'http://localhost:8080/',
  })
  const devForFriend = Intent.Browse({
    from: 'friend',
    url: 'https://quiet-river-42.tunnel.example/',
  })
  const taskGoals = [
    Goal.CanReach({ intent: shopLocal }),
    Goal.CannotReach({ intent: dbFromPhone }),
    Goal.CanReach({ intent: devForFriend }),
  ]

  test('localhost in a container is the container; the database is found by its service name', () => {
    expect(traceOn(lesson, appToLocalDb).outcome).toEqual({
      _tag: 'Refused',
      at: 'app',
      reason: NetMessage.PortClosed({
        device: 'app',
        proto: 'tcp',
        port: 5432,
      }),
    })
    expect(traceOn(lesson, appToDbName).outcome).toMatchObject({
      _tag: 'Delivered',
      at: 'db',
    })
    expect(traceOn(lesson, dbFromPhone).outcome).toMatchObject({
      _tag: 'Delivered',
      at: 'db',
    })
  })

  test('quiz where-it-breaks: -p 3000:3000 to an app on 8080 breaks inside the container with an empty reply', () => {
    const quiz = buildNet(
      [
        compose(
          'laptop',
          composeFile([
            service('app', {
              image: 'shop-app',
              port: 8080,
              environment: {
                DATABASE_URL: 'postgres://shop:shop@db:5432/shop',
              },
              ports: ['3000:3000'],
              needsEnv: 'DATABASE_URL',
            }),
            service('db', { image: 'postgres:16', port: 5432 }),
          ]),
        ),
        composeUp('laptop'),
      ],
      lesson,
    )
    const quizBrowse = Intent.Browse({
      from: 'laptop',
      url: 'http://localhost:3000/',
    })
    expect(deathDeviceOf(traceOn(quiz, quizBrowse))).toEqual(Option.some('app'))
    expect(
      browse(quiz, emptyState, 'laptop', 'localhost:3000').view,
    ).toMatchObject({
      code: 'ERR_EMPTY_RESPONSE',
      reason: NetMessage.PublishedPortClosed({ device: 'app', port: 3000 }),
    })
  })

  test('task demo-for-friend: fix compose, compose up, start the tunnel', () => {
    const start = buildWorld([], lesson)
    expect(metAll(start, taskGoals)).toEqual([false, false, false])
    expect(
      runCommand(start.doc, start.state, 'laptop', 'docker compose logs app')
        .output,
    ).toEqual([
      'app-1  | Starting on 0.0.0.0:3000',
      'app-1  | Connecting to localhost:5432...',
      'app-1  | Error: connect ECONNREFUSED 127.0.0.1:5432',
      'app-1 exited with code 1',
    ])
    const saved = foldWorld(start, [compose('laptop', solvedCompose)])
    expect(metAll(saved, taskGoals)).toEqual([false, false, false])
    const solved = foldWorld(saved, [
      run('laptop', 'docker compose up -d'),
      run('laptop', 'tunnel http 8080'),
    ])
    expect(metAll(solved, taskGoals)).toEqual([true, true, true])
    expect(
      runCommand(
        solved.doc,
        solved.state,
        'laptop',
        'docker compose logs app',
      ).output.at(-1),
    ).toBe('app-1  | Connected.')
    expect(
      runCommand(solved.doc, solved.state, 'laptop', 'tunnel http 8080').output,
    ).toEqual([
      'Tunnel started',
      'Forwarding  https://quiet-river-42.tunnel.example -> http://localhost:8080',
    ])
    const wrongPort = foldWorld(saved, [
      run('laptop', 'docker compose up -d'),
      run('laptop', 'tunnel http 3000'),
    ])
    expect(
      failureOf(wrongPort, Goal.CanReach({ intent: devForFriend })),
    ).toEqual(
      Option.some(NetMessage.UpstreamFailed({ device: 'laptop', port: 3000 })),
    )
    expect(traceOn(start.doc, devForFriend).outcome).toMatchObject({
      answer: { status: 404 },
    })
  })
})

describe('lesson 15 (troubleshooting): five broken networks, terminal only', () => {
  const base = [
    ...home,
    dnsHost([{ name: 'myapp.example', ip: '198.51.100.20' }]),
    add(
      host('vps', 'server', 800, 300, {
        address: '198.51.100.20/24',
        listeners: [tcp(22), tcp(443)],
        certs: [
          {
            names: ['myapp.example'],
            issuer: 'Example CA',
            notAfter: '2027-03-14',
          },
        ],
      }),
    ),
    cable('internet', 'dns'),
    cable('internet', 'vps'),
  ]
  const tagsOf = (doc: NetDoc, line: string) =>
    Array.map(
      runCommand(doc, emptyState, 'laptop', line).lines,
      current => current.tag,
    )

  test('each fault leaves its own fingerprint in the output', () => {
    const wrongDns = buildNet([
      ...base,
      setDns('laptop', { mode: 'manual', servers: ['192.0.2.99'] }),
    ])
    expect(tagsOf(wrongDns, 'nslookup myapp.example')).toEqual(['dnsTimeout'])
    expect(
      runCommand(wrongDns, emptyState, 'laptop', 'ping -c 1 198.51.100.20')
        .output[1],
    ).toMatch(/^64 bytes/)

    const wrongGateway = buildNet([
      ...base,
      setStatic('laptop', '192.168.1.42/24', '192.168.1.254', '192.0.2.53'),
    ])
    expect(tagsOf(wrongGateway, 'traceroute 198.51.100.20')[1]).toBe(
      'gatewayUnreachable',
    )

    const firewalled = buildNet([
      ...base,
      firewall('vps', {
        enabled: true,
        rules: [rule({ action: 'allow', proto: 'tcp', port: 22 })],
      }),
    ])
    expect(
      runCommand(
        firewalled,
        emptyState,
        'laptop',
        'curl -v https://myapp.example/',
      ).output.at(-1),
    ).toBe(
      'curl: (28) Failed to connect to myapp.example port 443 after 75004 ms: Timeout was reached',
    )
    expect(
      runCommand(firewalled, emptyState, 'laptop', 'ping -c 1 myapp.example')
        .output[1],
    ).toMatch(/^64 bytes/)

    const loopback = buildNet([...base, listen('vps', 'tcp', '127.0.0.1', 443)])
    expect(tagsOf(loopback, 'curl -v https://myapp.example/').at(-1)).toBe(
      'loopbackOnly',
    )
    expect(
      runCommand(loopback, emptyState, 'vps', 'ss -ltn').lines.some(
        current => current.tag === 'loopbackOnly',
      ),
    ).toBe(true)

    const otherName = buildNet([
      ...base,
      setCert('vps', {
        names: ['vps-20.hosting.example'],
        issuer: 'Example CA',
        notAfter: '2027-03-14',
      }),
    ])
    expect(tagsOf(otherName, 'curl -v https://myapp.example/').at(-1)).toBe(
      'certProblem',
    )
  })
})

describe('lesson 16 (ship-it): HTTPS from the cafe, closed database, ssh from home, home server via mesh', () => {
  const lesson = buildNet([
    homeRouter,
    add(
      host('laptop', 'laptop', 110, 120, {
        mac: '3c:22:fb:4a:10:42',
        wifi: { ssid: HOME_SSID, password: HOME_PASSWORD },
      }),
    ),
    add(host('homelab', 'server', 110, 250, { listeners: [tcp(8080)] })),
    reserve('router', macFromId('homelab'), '192.168.1.60'),
    add(
      router('cafe', 290, 440, {
        lan: '10.10.0.1/24',
        wan: '203.0.113.90',
        dns: '192.0.2.53',
        wifi: wifi('Кафе Утро', ''),
      }),
    ),
    add(host('phone', 'phone', 110, 440)),
    add(internet('internet', 500, 300)),
    add(
      host('dns', 'server', 450, 80, {
        address: '192.0.2.53/24',
        listeners: [udp(53)],
        resolver: true,
      }),
    ),
    add(
      host('ns', 'server', 620, 80, {
        address: '203.0.113.53/24',
        listeners: [udp(53)],
        zones: [{ name: 'myapp.example', records: [] }],
      }),
    ),
    add(
      certificateAuthority('ca', 900, 90, {
        address: '198.51.100.30/24',
        dns: '192.0.2.53',
      }),
    ),
    add(
      host('scanner', 'pc', 500, 540, {
        address: '203.0.113.66/24',
        dns: '192.0.2.53',
      }),
    ),
    add(
      relay('meshhub', 650, 520, {
        address: '198.51.100.90/24',
        domain: 'mesh.example',
        mesh: true,
      }),
    ),
    radio('laptop', 'router'),
    radio('phone', 'cafe'),
    joinWifi('phone', 'Кафе Утро', ''),
    cable('homelab', 'router'),
    cable('router', 'internet'),
    cable('cafe', 'internet'),
    cable('internet', 'dns'),
    cable('internet', 'ns'),
    cable('internet', 'ca'),
    cable('internet', 'scanner'),
    cable('internet', 'meshhub'),
  ])
  const lesson14Compose = composeFile([
    service('app', {
      image: 'shop-app',
      port: 3000,
      environment: { DATABASE_URL: 'postgres://shop:shop@db:5432/shop' },
      ports: ['8080:3000'],
      needsEnv: 'DATABASE_URL',
    }),
    service('db', { image: 'postgres:16', port: 5432 }),
  ])
  const server = [
    add(
      host('vps', 'server', 840, 300, {
        address: '198.51.100.20/24',
        listeners: [tcp(22)],
      }),
    ),
    cable('internet', 'vps'),
    ...webServer('vps', {
      listen: [80, 443],
      upstream: '127.0.0.1:3000',
      redirect: true,
    }),
    setCert('vps', {
      names: ['vps-20.hosting.example'],
      issuer: 'Example CA',
      notAfter: '2027-03-14',
    }),
    dockerHost('vps', { bridge: '172.18.0.1/16', network: 'shop_default' }),
    add(
      container('db', 'vps', 800, 420, {
        image: 'postgres:16',
        ip: '172.18.0.2',
        listeners: [tcp(5432)],
      }),
    ),
    add(
      container('app', 'vps', 880, 420, {
        image: 'shop-app',
        ip: '172.18.0.3',
        listeners: [tcp(3000)],
      }),
    ),
    compose('vps', lesson14Compose),
    composeUp('vps'),
    firewall('vps', { enabled: false, defaultIn: 'drop' }),
  ]
  const site = Intent.Browse({ from: 'phone', url: 'https://myapp.example/' })
  const siteWww = Intent.Browse({
    from: 'phone',
    url: 'https://www.myapp.example/',
  })
  const sshFromHome = Intent.Connect({
    from: 'laptop',
    host: 'myapp.example',
    port: 22,
  })
  const photos = Intent.Browse({ from: 'phone', url: 'http://homelab:8080/' })
  const taskGoals = [
    Goal.CanReach({ intent: site }),
    Goal.CanReach({ intent: siteWww }),
    Goal.CanReach({ intent: sshFromHome }),
    goals.onlyOpenPorts('vps', 'scanner', [80, 443]),
    Goal.Via({ intent: photos, device: 'meshhub', through: true }),
    goals.onlyOpenPorts('203.0.113.7', 'scanner', []),
  ]
  const solvedCompose = composeFile([
    service('app', {
      image: 'shop-app',
      port: 3000,
      environment: { DATABASE_URL: 'postgres://shop:shop@db:5432/shop' },
      ports: ['127.0.0.1:3000:3000'],
      needsEnv: 'DATABASE_URL',
    }),
    service('db', { image: 'postgres:16', port: 5432 }),
  ])
  const solution = [
    setRecord('ns', 'myapp.example', {
      type: 'A',
      name: '@',
      value: '198.51.100.20',
    }),
    setRecord('ns', 'myapp.example', {
      type: 'CNAME',
      name: 'www',
      value: 'myapp.example',
    }),
    compose('vps', solvedCompose),
    composeUp('vps'),
    firewall('vps', {
      enabled: true,
      defaultIn: 'drop',
      rules: [
        rule({ action: 'allow', proto: 'tcp', port: 22, from: '203.0.113.7' }),
        rule({ action: 'allow', proto: 'tcp', port: 80 }),
        rule({ action: 'allow', proto: 'tcp', port: 443 }),
      ],
    }),
    issueCert('vps', ['myapp.example', 'www.myapp.example']),
    meshJoin('phone'),
    meshJoin('homelab'),
  ]

  test('with the server dragged in: 502 from the proxy, 8080 open to the world, nothing else met but the home', () => {
    const start = buildWorld(server, lesson)
    expect(metAll(start, taskGoals)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ])
    const withDns = foldWorld(start, solution.slice(0, 2))
    expect(
      traceOn(
        withDns.doc,
        Intent.Fetch({ from: 'phone', url: 'http://myapp.example/' }),
        withDns,
      ).outcome,
    ).toMatchObject({ _tag: 'Delivered', answer: { status: 301 } })
    expect(failureOf(withDns, Goal.CanReach({ intent: site }))).toEqual(
      Option.some(
        NetMessage.CertNameMismatch({
          device: 'vps',
          name: 'myapp.example',
          names: ['vps-20.hosting.example'],
        }),
      ),
    )
    const certified = foldWorld(withDns, [
      issueCert('vps', ['myapp.example', 'www.myapp.example']),
    ])
    expect(failureOf(certified, Goal.CanReach({ intent: site }))).toEqual(
      Option.some(NetMessage.UpstreamFailed({ device: 'vps', port: 3000 })),
    )
    expect(
      failureOf(certified, taskGoals[3] ?? Goal.NoAddressConflict()),
    ).toEqual(
      Option.some(
        NetMessage.GoalExtraOpenPort({
          target: 'vps',
          port: 22,
          device: 'vps',
        }),
      ),
    )
  })

  test('the reference solution meets every goal', () => {
    const solved = foldWorld(buildWorld(server, lesson), solution)
    expect(metAll(solved, taskGoals)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ])
    expect(
      runCommand(solved.doc, solved.state, 'vps', 'docker ps').output[1],
    ).toContain('127.0.0.1:3000->3000/tcp')
    const photosTrace = traceOn(solved.doc, photos, solved)
    expect(photosTrace.outcome).toMatchObject({
      _tag: 'Delivered',
      at: 'homelab',
    })
    expect(
      browse(solved.doc, solved.state, 'phone', 'http://192.168.1.60:8080')
        .view,
    ).toMatchObject({ code: 'ERR_CONNECTION_TIMED_OUT' })
  })

  test('typical holes: 3000:3000 opens the app to the world, a forward opens the home', () => {
    const base = foldWorld(buildWorld(server, lesson), solution)
    const open3000 = foldWorld(base, [
      compose(
        'vps',
        composeFile([
          service('app', {
            image: 'shop-app',
            port: 3000,
            environment: { DATABASE_URL: 'postgres://shop:shop@db:5432/shop' },
            ports: ['3000:3000'],
            needsEnv: 'DATABASE_URL',
          }),
          service('db', { image: 'postgres:16', port: 5432 }),
        ]),
      ),
      composeUp('vps'),
    ])
    expect(metAll(open3000, taskGoals.slice(0, 4))).toEqual([
      true,
      true,
      true,
      false,
    ])
    const forwarded = foldWorld(base, [
      forward('router', {
        proto: 'tcp',
        outsidePort: 8080,
        insideIp: '192.168.1.60',
        insidePort: 8080,
      }),
    ])
    expect(
      failureOf(forwarded, taskGoals[5] ?? Goal.NoAddressConflict()),
    ).toEqual(
      Option.some(
        NetMessage.GoalExtraOpenPort({
          target: '203.0.113.7',
          port: 8080,
          device: 'homelab',
        }),
      ),
    )
    const onlyPhone = foldWorld(buildWorld(server, lesson), [
      ...solution.slice(0, 6),
      meshJoin('phone'),
    ])
    expect(
      checkGoal(
        onlyPhone.doc,
        onlyPhone.state,
        taskGoals[4] ?? Goal.NoAddressConflict(),
      ).met,
    ).toBe(false)
  })
})
