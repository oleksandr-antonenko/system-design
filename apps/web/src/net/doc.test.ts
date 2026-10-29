import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import {
  accessPoint,
  add,
  cable,
  configureWifi,
  host,
  internet,
  listen,
  networkSwitch,
  radio,
  reserve,
  router,
  setDhcpPool,
  setLinkUp,
  stopListening,
  tcp,
  unplug,
  wifi,
} from './build'
import {
  type NetOp,
  NetOp as Op,
  apply,
  applyAll,
  findRouter,
  foldNet,
  linkBetween,
} from './doc'
import { NetMessage } from './message'
import { type NetDoc, emptyNet } from './model'
import { buildNet, homeNet } from './testing'

const refusalOf = (doc: NetDoc, op: NetOp): NetMessage =>
  Result.match(apply(doc, op), {
    onFailure: refusal => refusal,
    onSuccess: () => {
      throw new Error(`${op._tag} was accepted`)
    },
  })

const routerOf = (doc: NetDoc) =>
  Option.getOrThrowWith(findRouter(doc, 'router'), () => new Error('router'))

describe('devices', () => {
  test('ids and MACs are unique, there is one internet', () => {
    const doc = homeNet()
    expect(refusalOf(doc, add(host('phone', 'phone', 0, 0)))).toEqual(
      NetMessage.DuplicateDeviceId({ id: 'phone' }),
    )
    expect(
      refusalOf(
        doc,
        add(host('tablet', 'phone', 0, 0, { mac: '3c:22:fb:4a:10:42' })),
      ),
    ).toEqual(
      NetMessage.DuplicateMac({ mac: '3c:22:fb:4a:10:42', owner: 'laptop' }),
    )
    expect(refusalOf(doc, add(internet('cloud-2', 0, 0)))).toEqual(
      NetMessage.OnlyOneInternet(),
    )
  })

  test('static addresses are validated', () => {
    expect(
      refusalOf(
        emptyNet,
        add(host('pc', 'pc', 0, 0, { address: '192.168.1.300/24' })),
      ),
    ).toEqual(NetMessage.InvalidIp({ value: '192.168.1.300' }))
    expect(
      refusalOf(
        emptyNet,
        add(host('pc', 'pc', 0, 0, { address: '192.168.1.10' })),
      )._tag,
    ).toBe('InvalidPrefix')
    expect(
      refusalOf(
        emptyNet,
        add(host('pc', 'pc', 0, 0, { address: '192.168.1.0/24' })),
      ),
    ).toEqual(NetMessage.AddressNotUsable({ ip: '192.168.1.0', prefix: 24 }))
    expect(
      refusalOf(
        emptyNet,
        add(
          host('pc', 'pc', 0, 0, {
            address: '192.168.1.10/24',
            gateway: '10.0.0.1',
          }),
        ),
      ),
    ).toEqual(
      NetMessage.GatewayOutsideSubnet({
        gateway: '10.0.0.1',
        ip: '192.168.1.10',
        prefix: 24,
      }),
    )
  })

  test('removing a device removes its links', () => {
    const doc = buildNet([Op.RemoveDevice({ id: 'router' })], homeNet())
    expect(
      Array.some(doc.links, link => link.a === 'router' || link.b === 'router'),
    ).toBe(false)
    expect(doc.links.length).toBe(2)
  })
})

describe('links', () => {
  const office = buildNet([
    add(networkSwitch('s1', 0, 0)),
    add(networkSwitch('s2', 100, 0)),
    add(networkSwitch('s3', 200, 0)),
    add(host('pc', 'pc', 0, 100)),
    cable('s1', 's2'),
    cable('s2', 's3'),
    cable('pc', 's1'),
  ])

  test('a second cable between bridged switches would make an L2 loop', () => {
    expect(refusalOf(office, cable('s3', 's1'))).toEqual(
      NetMessage.LinkMakesLoop({ a: 's3', b: 's1' }),
    )
  })

  test('a host has one port; self-links and duplicates are refused', () => {
    expect(refusalOf(office, cable('pc', 's2'))).toEqual(
      NetMessage.PortBusy({ device: 'pc' }),
    )
    expect(refusalOf(office, cable('s1', 's1'))).toEqual(
      NetMessage.ConnectSelf({ id: 's1' }),
    )
    expect(refusalOf(office, cable('s2', 's1'))).toEqual(
      NetMessage.AlreadyLinked({ a: 's2', b: 's1' }),
    )
  })

  test('radio needs an access point and a Wi-Fi device', () => {
    const doc = buildNet(
      [add(host('phone', 'phone', 0, 0)), add(host('desk', 'pc', 0, 0))],
      office,
    )
    expect(refusalOf(doc, radio('phone', 's1'))).toEqual(
      NetMessage.RadioNeedsAccessPoint({ a: 'phone', b: 's1' }),
    )
    const withAp = buildNet(
      [add(accessPoint('ap', 0, 0, wifi('Office', 'office-pass')))],
      doc,
    )
    expect(refusalOf(withAp, radio('desk', 'ap'))).toEqual(
      NetMessage.NoWifiOnDevice({ device: 'desk' }),
    )
    expect(Result.isSuccess(apply(withAp, radio('phone', 'ap')))).toBe(true)
  })

  test('the internet takes a router or a server, and a router has one WAN', () => {
    const home = homeNet()
    const withSwitch = buildNet([add(networkSwitch('sw', 0, 0))], home)
    expect(refusalOf(withSwitch, cable('sw', 'internet'))).toEqual(
      NetMessage.InternetNeedsRouter({ device: 'sw' }),
    )
    const detached = buildNet([unplug('router', 'internet')], home)
    expect(Option.isNone(linkBetween(detached, 'router', 'internet'))).toBe(
      true,
    )
    expect(refusalOf(home, cable('internet', 'router'))).toEqual(
      NetMessage.AlreadyLinked({ a: 'internet', b: 'router' }),
    )
  })

  test('a link can be switched off and on', () => {
    const doc = buildNet([setLinkUp('router', 'internet', false)], homeNet())
    expect(
      Option.map(linkBetween(doc, 'internet', 'router'), link => link.up),
    ).toEqual(Option.some(false))
    expect(refusalOf(doc, unplug('phone', 'shop'))).toEqual(
      NetMessage.UnknownLink({ a: 'phone', b: 'shop' }),
    )
  })
})

describe('router settings', () => {
  test('Wi-Fi: SSID, WPA2 password length, channel of the band', () => {
    const doc = homeNet()
    expect(
      refusalOf(doc, configureWifi('router', wifi('Home', 'short'))),
    ).toEqual(NetMessage.WifiPasswordTooShort({ min: 8 }))
    expect(
      refusalOf(
        doc,
        configureWifi(
          'router',
          wifi('Home', 'correct-horse', { band: '2.4', channel: 36 }),
        ),
      ),
    ).toEqual(NetMessage.InvalidChannel({ band: '2.4', channel: 36 }))
    expect(
      refusalOf(doc, configureWifi('router', wifi(' ', 'correct-horse'))),
    ).toEqual(NetMessage.EmptySsid())
    expect(
      Result.isSuccess(
        apply(
          doc,
          configureWifi('router', wifi('Cafe', '', { security: 'open' })),
        ),
      ),
    ).toBe(true)
  })

  test('the DHCP pool stays inside the LAN and away from the router', () => {
    const doc = homeNet()
    expect(
      refusalOf(doc, setDhcpPool('router', '192.168.1.1', '192.168.1.50')),
    ).toEqual(NetMessage.DhcpPoolIncludesRouter({ ip: '192.168.1.1' }))
    expect(
      refusalOf(doc, setDhcpPool('router', '192.168.1.100', '192.168.2.10')),
    ).toEqual(
      NetMessage.DhcpPoolOutsideSubnet({
        start: '192.168.1.100',
        end: '192.168.2.10',
        network: '192.168.1.0',
        prefix: 24,
      }),
    )
    expect(
      refusalOf(doc, setDhcpPool('router', '192.168.1.200', '192.168.1.100')),
    ).toEqual(
      NetMessage.DhcpPoolReversed({
        start: '192.168.1.200',
        end: '192.168.1.100',
      }),
    )
    expect(
      refusalOf(doc, reserve('router', '02:00:00:00:00:99', '192.168.1.42')),
    ).toEqual(
      NetMessage.ReservationTaken({
        ip: '192.168.1.42',
        mac: '3c:22:fb:4a:10:42',
      }),
    )
  })

  test('moving the LAN moves the pool and reservations with it', () => {
    const doc = buildNet(
      [Op.SetLan({ router: 'router', ip: '192.168.0.1', prefix: 24 })],
      homeNet(),
    )
    const moved = routerOf(doc)
    expect([moved.lan.ip, moved.dhcp.start, moved.dhcp.end]).toEqual([
      '192.168.0.1',
      '192.168.0.100',
      '192.168.0.199',
    ])
    expect(moved.dhcp.reservations).toEqual([
      { mac: '3c:22:fb:4a:10:42', ip: '192.168.0.42' },
    ])
  })
})

describe('hosts', () => {
  test('listening on a port replaces the previous bind; stop removes it', () => {
    const doc = buildNet(
      [
        listen('laptop', 'tcp', '127.0.0.1', 5173),
        listen('laptop', 'tcp', '0.0.0.0', 5173),
      ],
      homeNet(),
    )
    const laptop = Array.findFirst(
      doc.devices,
      device => device.id === 'laptop',
    )
    expect(
      Option.map(laptop, device =>
        device._tag === 'Host' ? device.listeners : [],
      ),
    ).toEqual(Option.some([tcp(5173)]))
    const stopped = buildNet([stopListening('laptop', 'tcp', 5173)], doc)
    expect(
      Option.map(
        Array.findFirst(stopped.devices, device => device.id === 'laptop'),
        device => (device._tag === 'Host' ? device.listeners : []),
      ),
    ).toEqual(Option.some([]))
    expect(refusalOf(doc, listen('laptop', 'tcp', '0.0.0.0', 70000))).toEqual(
      NetMessage.InvalidPort({ value: 70000 }),
    )
  })

  test('settings that need a host or a router say so', () => {
    const doc = homeNet()
    expect(refusalOf(doc, listen('router', 'tcp', '0.0.0.0', 80))).toEqual(
      NetMessage.NotAHost({ id: 'router' }),
    )
    expect(
      refusalOf(doc, setDhcpPool('phone', '192.168.1.2', '192.168.1.9')),
    ).toEqual(NetMessage.NotARouter({ id: 'phone' }))
  })

  test('the strict fold stops at the first refusal, the board fold skips it', () => {
    const ops: ReadonlyArray<NetOp> = [
      add(networkSwitch('sw', 0, 0)),
      cable('sw', 'nowhere'),
      add(
        router('router', 0, 0, { lan: '192.168.1.1/24', wan: '203.0.113.7' }),
      ),
    ]
    expect(applyAll(emptyNet, ops)).toEqual(
      Result.fail(NetMessage.UnknownDevice({ id: 'nowhere' })),
    )
    expect(foldNet(emptyNet, ops).devices.length).toBe(2)
  })
})
