import { Option, Record } from 'effect'
import {
  expectNoOutMessage,
  expectOutMessage,
  given,
  message,
  model,
  story,
} from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { uiFor } from '../../../../i18n/ui'
import {
  add,
  addRecord,
  addRoute,
  certificateAuthority,
  compose,
  composeFile,
  composeUp,
  dockerHost,
  firewall,
  forward,
  host,
  listen,
  meshJoin,
  meshLeave,
  relay,
  removeRecord,
  reserve,
  rule,
  service,
  setDhcpPool,
  setRecord,
  setRedirect,
  tcp,
  udp,
  unforward,
  vpnClient,
  vpnGateway,
  vpnSettings,
} from '../../../../net/build'
import { NetOp } from '../../../../net/doc'
import type { NetOp as Op } from '../../../../net/doc'
import { NetMessage } from '../../../../net/message'
import { SurfaceOutMessage } from '../../../contract'
import { composePanel, isRunningFile } from './compose'
import { dnsPanel } from './dns'
import { meshPanel } from './mesh'
import * as Panel from './panel'
import { routerPanel } from './router'
import {
  type FieldProblem,
  type PanelDefinition,
  PanelProblem,
  cellPath,
  problemAt,
  refusedAt,
} from './schema'
import { serverPanel } from './server'
import { kitchenOps, surfaceFor, worldOf } from './testing'
import { vpnPanel } from './vpn'

// Панели модулей 2 и 3 на уровне update: какие операции даёт «Сохранить»
// и где появляются отказы. Каждая панель — на своей маленькой доске.

const ALL_TABS = [
  'router.wifi',
  'router.devices',
  'router.addresses',
  'router.ports',
  'router.routes',
  'dnsPanel.records',
  'server.site',
  'server.cert',
  'server.firewall',
  'vpn.settings',
  'mesh.members',
  'compose.file',
]

const harness = (
  definition: PanelDefinition,
  ops: ReadonlyArray<Op>,
  tab: string,
  target = '',
) => {
  const surface = surfaceFor(worldOf(ops), { target, unlocked: ALL_TABS })
  const update = Panel.update({ definition, surface })
  const start: Panel.Model = {
    ...Panel.initialModel,
    maybeTab: Option.some(tab),
  }
  const context = Option.getOrThrow(Panel.panelContext(definition, surface))
  return { update, start, context }
}

const field = (name: string, value: string) =>
  message(Panel.Message.UpdatedField({ field: name, value }))

const cell = (list: string, row: string, column: string, value: string) =>
  message(Panel.Message.UpdatedCell({ list, row, column, value }))

const addRow = (list: string) => message(Panel.Message.ClickedAddRow({ list }))

const removeRow = (list: string, row: string) =>
  message(Panel.Message.ClickedRemoveRow({ list, row }))

const save = message(Panel.Message.SubmittedPanel())

const produced = (...ops: ReadonlyArray<Op>) =>
  expectOutMessage(SurfaceOutMessage.ProducedOps(ops))

const problemsOf = (
  next: Panel.Model,
  tab: string,
): ReadonlyArray<FieldProblem> =>
  Option.match(Record.get(next.drafts, tab), {
    onNone: () => [],
    onSome: draft => draft.problems,
  })

// ROUTER

const LAPTOP_MAC = '3c:22:fb:4a:10:42'

describe('router panel: addresses', () => {
  const { update, start, context } = harness(
    routerPanel,
    kitchenOps,
    'addresses',
  )
  const printerMac = Option.getOrThrow(
    Option.map(
      Option.fromNullishOr(
        context.world.doc.devices.find(device => device.id === 'printer'),
      ),
      device => (device._tag === 'Host' ? device.mac : ''),
    ),
  )

  test('the pool and a new reservation become setDhcpPool and reserve', () => {
    story(
      update,
      given(start),
      field('poolEnd', '192.168.1.149'),
      addRow('reservations'),
      cell('reservations', 'new-1', 'device', printerMac),
      cell('reservations', 'new-1', 'ip', '192.168.1.50'),
      save,
      produced(
        setDhcpPool('router', '192.168.1.100', '192.168.1.149'),
        reserve('router', printerMac, '192.168.1.50'),
      ),
    )
  })

  test('removing a row removes the reservation', () => {
    story(
      update,
      given(start),
      removeRow('reservations', LAPTOP_MAC),
      save,
      produced(NetOp.RemoveReservation({ router: 'router', mac: LAPTOP_MAC })),
    )
  })

  test('a bad address stays on its cell; a foreign one is refused by the model', () => {
    story(
      update,
      given(start),
      cell('reservations', LAPTOP_MAC, 'ip', '192.168.1'),
      save,
      expectNoOutMessage(),
      model(next => {
        expect(problemsOf(next, 'addresses')).toEqual([
          problemAt(
            cellPath('reservations', LAPTOP_MAC, 'ip'),
            PanelProblem.Refused({
              message: NetMessage.InvalidIp({ value: '192.168.1' }),
            }),
          ),
        ])
      }),
      cell('reservations', LAPTOP_MAC, 'ip', '10.0.0.42'),
      save,
      expectNoOutMessage(),
      model(next => {
        expect(problemsOf(next, 'addresses')).toEqual([
          refusedAt(
            Option.some('reservations'),
            NetMessage.ReservationOutsideSubnet({
              mac: LAPTOP_MAC,
              ip: '10.0.0.42',
            }),
          ),
        ])
      }),
    )
  })
})

describe('router panel: ports and routes', () => {
  const withForward = [
    ...kitchenOps,
    forward('router', {
      proto: 'tcp',
      outsidePort: 8080,
      insideIp: '192.168.1.42',
      insidePort: 3000,
    }),
  ]

  test('a new rule becomes forward; a removed one unforward', () => {
    const { update, start } = harness(routerPanel, withForward, 'ports')
    story(
      update,
      given(start),
      removeRow('forwards', 'tcp:8080'),
      addRow('forwards'),
      cell('forwards', 'new-1', 'proto', 'udp'),
      cell('forwards', 'new-1', 'outsidePort', '25565'),
      cell('forwards', 'new-1', 'insideIp', '192.168.1.50'),
      cell('forwards', 'new-1', 'insidePort', '25565'),
      save,
      produced(
        unforward('router', 'tcp', 8080),
        forward('router', {
          proto: 'udp',
          outsidePort: 25565,
          insideIp: '192.168.1.50',
          insidePort: 25565,
        }),
      ),
    )
  })

  test('a port out of range and a word are refused on their cells', () => {
    const { update, start } = harness(routerPanel, withForward, 'ports')
    story(
      update,
      given(start),
      cell('forwards', 'tcp:8080', 'outsidePort', '70000'),
      cell('forwards', 'tcp:8080', 'insidePort', 'web'),
      save,
      expectNoOutMessage(),
      model(next => {
        expect(problemsOf(next, 'ports')).toEqual([
          problemAt(
            cellPath('forwards', 'tcp:8080', 'outsidePort'),
            PanelProblem.Refused({
              message: NetMessage.InvalidPort({ value: 70000 }),
            }),
          ),
          problemAt(
            cellPath('forwards', 'tcp:8080', 'insidePort'),
            PanelProblem.NotANumber({ value: 'web' }),
          ),
        ])
      }),
    )
  })

  test('a route row becomes addRoute', () => {
    const { update, start } = harness(routerPanel, kitchenOps, 'routes')
    story(
      update,
      given(start),
      addRow('routes'),
      cell('routes', 'new-1', 'network', '10.0.0.0/8'),
      cell('routes', 'new-1', 'via', '192.168.1.254'),
      save,
      produced(addRoute('router', '10.0.0.0/8', '192.168.1.254')),
    )
  })
})

// DNS

const dnsOps: ReadonlyArray<Op> = [
  add(
    host('ns', 'server', 700, 200, {
      address: '192.0.2.53/24',
      listeners: [udp(53)],
      records: [{ name: 'myapp.example', ip: '198.51.100.200', ttl: 3600 }],
    }),
  ),
]

describe('DNS provider panel', () => {
  const { update, start, context } = harness(dnsPanel, dnsOps, 'records')

  test('finds the provider and its domain on the board', () => {
    expect(context.device).toBe('ns')
    expect(dnsPanel.heading(context, uiFor('en').panel)).toBe(
      'myapp.example · ns',
    )
  })

  test('a changed A record and a new CNAME become setRecord', () => {
    story(
      update,
      given(start),
      cell('records', 'r0', 'value', '198.51.100.20'),
      cell('records', 'r0', 'ttl', '300'),
      addRow('records'),
      cell('records', 'new-1', 'type', 'CNAME'),
      cell('records', 'new-1', 'name', 'www.myapp.example'),
      cell('records', 'new-1', 'value', 'myapp.example'),
      save,
      produced(
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
      ),
    )
  })

  test('two A records for one name: remove, then add both', () => {
    story(
      update,
      given(start),
      addRow('records'),
      cell('records', 'new-1', 'value', '198.51.100.20'),
      cell('records', 'new-1', 'ttl', '3600'),
      save,
      produced(
        removeRecord('ns', 'myapp.example', '@', 'A'),
        addRecord('ns', 'myapp.example', {
          type: 'A',
          name: '@',
          value: '198.51.100.200',
          ttl: 3600,
        }),
        addRecord('ns', 'myapp.example', {
          type: 'A',
          name: '@',
          value: '198.51.100.20',
          ttl: 3600,
        }),
      ),
    )
  })

  test('CNAME on the domain itself is refused with the model’s reason', () => {
    story(
      update,
      given(start),
      cell('records', 'r0', 'type', 'CNAME'),
      cell('records', 'r0', 'value', 'other.example'),
      save,
      expectNoOutMessage(),
      model(next => {
        expect(problemsOf(next, 'records')).toEqual([
          refusedAt(
            Option.some('records'),
            NetMessage.CnameAtApex({ zone: 'myapp.example' }),
          ),
        ])
      }),
    )
  })
})

// SERVER

const serverOps: ReadonlyArray<Op> = [
  add(
    host('vps', 'server', 700, 200, {
      address: '198.51.100.20/24',
      listeners: [tcp(443), tcp(3000, '127.0.0.1'), tcp(5432)],
      certs: [
        {
          names: ['vps-20.hosting.example'],
          issuer: 'Example CA',
          notAfter: '2027-03-14',
        },
      ],
    }),
  ),
]

describe('server panel', () => {
  test('site: open port 80 to everyone and redirect to https', () => {
    const { update, start } = harness(serverPanel, serverOps, 'site', 'vps')
    story(
      update,
      given(start),
      field('port-80', 'everyone'),
      field('port-5432', 'local'),
      field('redirect', 'on'),
      save,
      produced(
        listen('vps', 'tcp', '0.0.0.0', 80),
        listen('vps', 'tcp', '127.0.0.1', 5432),
        setRedirect('vps', true),
      ),
    )
  })

  test('site: the redirect is unavailable while port 80 is closed', () => {
    const { context } = harness(serverPanel, serverOps, 'site', 'vps')
    const site = Option.getOrThrow(
      Panel.activeTab(
        serverPanel,
        { ...Panel.initialModel, maybeTab: Option.some('site') },
        ALL_TABS,
      ),
    )
    const redirect = site.fields(context).find(each => each.id === 'redirect')
    expect(
      redirect !== undefined &&
        redirect._tag === 'Check' &&
        redirect.enabled?.(site.read(context)),
    ).toBe(false)
  })

  test('certificate: without a CA on the board the model refuses the issue', () => {
    const { update, start } = harness(serverPanel, serverOps, 'cert', 'vps')
    story(
      update,
      given(start),
      cell('names', 'n0', 'name', 'myapp.example'),
      save,
      expectNoOutMessage(),
      model(next => {
        expect(problemsOf(next, 'cert')).toEqual([
          refusedAt(Option.some('names'), NetMessage.NoCertificateAuthority()),
        ])
      }),
    )
  })

  test('certificate: an empty list of names is refused before the CA', () => {
    const withCa = [
      ...serverOps,
      add(certificateAuthority('ca', 800, 300, { address: '192.0.2.99/24' })),
    ]
    const { update, start } = harness(serverPanel, withCa, 'cert', 'vps')
    story(
      update,
      given(start),
      removeRow('names', 'n0'),
      save,
      expectNoOutMessage(),
      model(next => {
        expect(problemsOf(next, 'cert')).toEqual([
          refusedAt(Option.some('names'), NetMessage.EmptyName()),
        ])
      }),
    )
  })

  test('firewall: the rules and the default become one firewall op', () => {
    const { update, start } = harness(serverPanel, serverOps, 'firewall', 'vps')
    story(
      update,
      given(start),
      field('enabled', 'on'),
      addRow('rules'),
      cell('rules', 'new-1', 'from', '203.0.113.7'),
      cell('rules', 'new-1', 'port', '22'),
      addRow('rules'),
      cell('rules', 'new-2', 'port', '443'),
      save,
      produced(
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
            rule({ action: 'allow', proto: 'tcp', port: 443 }),
          ],
        }),
      ),
    )
  })

  test('firewall: a bad source is refused on its cell', () => {
    const { update, start } = harness(serverPanel, serverOps, 'firewall', 'vps')
    story(
      update,
      given(start),
      addRow('rules'),
      cell('rules', 'new-1', 'from', '203.0.113.0/40'),
      save,
      expectNoOutMessage(),
      model(next => {
        expect(problemsOf(next, 'firewall')).toEqual([
          problemAt(
            cellPath('rules', 'new-1', 'from'),
            PanelProblem.Refused({
              message: NetMessage.InvalidCidr({ value: '203.0.113.0/40' }),
            }),
          ),
        ])
      }),
    )
  })
})

// VPN

const vpnOps: ReadonlyArray<Op> = [
  add(
    vpnGateway('office', 700, 200, {
      wan: '192.0.2.200',
      lan: '10.20.0.1/16',
      pool: '10.99.0.0/24',
    }),
  ),
  add(host('laptop', 'laptop', 300, 300)),
  vpnClient('laptop', {
    gateway: 'office',
    address: '10.99.0.23',
    mode: 'full',
    dns: { zone: 'corp.example', server: '10.20.0.1' },
  }),
]

describe('VPN client settings', () => {
  const { update, start, context } = harness(vpnPanel, vpnOps, 'vpn', 'laptop')

  test('shows the gateway and the tunnel address', () => {
    const tab = Option.getOrThrow(Panel.activeTab(vpnPanel, start, ALL_TABS))
    expect(tab.read(context).fields).toEqual({
      connected: 'on',
      gateway: '192.0.2.200',
      address: '10.99.0.23',
      mode: 'full',
    })
  })

  test('work networks only: one vpnSettings op', () => {
    story(
      update,
      given(start),
      field('mode', 'split'),
      addRow('networks'),
      cell('networks', 'new-1', 'network', '10.0.0.0/8'),
      save,
      produced(
        vpnSettings('laptop', {
          connected: true,
          mode: 'split',
          networks: ['10.0.0.0/8'],
        }),
      ),
    )
  })

  test('an empty list of work networks is refused', () => {
    story(
      update,
      given(start),
      field('mode', 'split'),
      save,
      expectNoOutMessage(),
      model(next => {
        expect(problemsOf(next, 'vpn')).toEqual([
          refusedAt(Option.some('networks'), NetMessage.SplitTunnelEmpty()),
        ])
      }),
    )
  })
})

// MESH

const meshOps: ReadonlyArray<Op> = [
  add(
    relay('meshhub', 800, 100, {
      address: '192.0.2.10/24',
      domain: 'mesh.example',
      mesh: true,
    }),
  ),
  add(host('laptop', 'laptop', 300, 300)),
  add(host('phone', 'phone', 400, 300)),
  meshJoin('laptop'),
]

describe('mesh membership', () => {
  const { update, start, context } = harness(meshPanel, meshOps, 'members')

  test('lists your devices with their mesh address', () => {
    const tab = Option.getOrThrow(Panel.activeTab(meshPanel, start, ALL_TABS))
    expect(tab.read(context).lists['members']).toEqual([
      {
        id: 'laptop',
        cells: {
          device: 'laptop',
          member: 'on',
          name: 'laptop',
          address: '100.100.0.2',
        },
      },
      {
        id: 'phone',
        cells: { device: 'phone', member: '', name: 'phone', address: '' },
      },
    ])
  })

  test('ticking joins, unticking leaves', () => {
    story(
      update,
      given(start),
      cell('members', 'phone', 'member', 'on'),
      cell('members', 'laptop', 'member', ''),
      save,
      produced(meshLeave('laptop'), meshJoin('phone')),
    )
  })
})

// COMPOSE

const composeOps: ReadonlyArray<Op> = [
  add(host('laptop', 'laptop', 300, 300)),
  dockerHost('laptop', { bridge: '172.18.0.1/16', network: 'shop_default' }),
  compose(
    'laptop',
    composeFile([
      service('app', {
        image: 'shop-app',
        port: 3000,
        environment: {
          DATABASE_URL: 'postgres://shop:shop@localhost:5432/shop',
        },
        needsEnv: 'DATABASE_URL',
      }),
      service('db', { image: 'postgres:16', port: 5432, ports: ['5432:5432'] }),
    ]),
  ),
  composeUp('laptop'),
]

describe('compose.yaml editor', () => {
  const { update, start, context } = harness(
    composePanel,
    composeOps,
    'compose',
    'laptop',
  )

  test('the file is running until it is saved with changes', () => {
    expect(isRunningFile(context)).toBe(true)
    const changed = harness(
      composePanel,
      [
        ...composeOps,
        compose(
          'laptop',
          composeFile([service('app', { image: 'shop-app', port: 3000 })]),
        ),
      ],
      'compose',
      'laptop',
    )
    expect(isRunningFile(changed.context)).toBe(false)
  })

  test('DATABASE_URL and ports become one compose op (the file only)', () => {
    story(
      update,
      given(start),
      field('env:app:DATABASE_URL', 'postgres://shop:shop@db:5432/shop'),
      addRow('ports:app'),
      cell('ports:app', 'new-1', 'mapping', '8080:3000'),
      removeRow('ports:db', 'p0'),
      save,
      produced(
        compose(
          'laptop',
          composeFile([
            service('app', {
              image: 'shop-app',
              port: 3000,
              environment: {
                DATABASE_URL: 'postgres://shop:shop@db:5432/shop',
              },
              ports: ['8080:3000'],
              needsEnv: 'DATABASE_URL',
            }),
            service('db', { image: 'postgres:16', port: 5432 }),
          ]),
        ),
      ),
    )
  })

  test('a port written the wrong way is refused on its cell', () => {
    story(
      update,
      given(start),
      cell('ports:db', 'p0', 'mapping', '5432-5432'),
      save,
      expectNoOutMessage(),
      model(next => {
        expect(problemsOf(next, 'compose')).toEqual([
          problemAt(
            cellPath('ports:db', 'p0', 'mapping'),
            PanelProblem.Refused({
              message: NetMessage.InvalidPortMapping({ value: '5432-5432' }),
            }),
          ),
        ])
      }),
    )
  })
})
