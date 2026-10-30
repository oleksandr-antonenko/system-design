import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import {
  add,
  cable,
  certificateAuthority,
  host,
  internet,
  issueCert,
  radio,
  router,
  tcp,
  udp,
  wifi,
} from '../../net/build'
import { Intent, type Trace } from '../../net/packet'
import { buildWorld } from '../../net/testing'
import { type World, sendIntent } from '../../net/world'
import { play, showCert } from './dsl'
import { isSealed, layerRows } from './envelope'
import { packet } from './kind'
import { layoutBoard } from './layout'
import { stageFeatures, stageTargets } from './targets'
import { timelineOf } from './timeline'

// Запечатанный конверт урока 11 на доске: поля формы в открытом HTTP, слой
// под шифром без полей, договорённость о шифре в показе `handshake`,
// паспорт сайта как элемент сцены и проверка центра сертификации после
// «Выпустить».

const LESSON_11 = [
  'transport.run',
  'board.devices',
  'board.envelope',
  'board.dnsServer',
  'board.sealedEnvelope',
  'browser.certificate',
]

const world: World = buildWorld([
  add(
    router('cafe', 290, 430, {
      lan: '10.10.0.1/24',
      wan: '203.0.113.90',
      dns: '192.0.2.53',
      wifi: wifi('Cafe', ''),
    }),
  ),
  add(
    host('phone', 'phone', 110, 380, { wifi: { ssid: 'Cafe', password: '' } }),
  ),
  add(internet('internet', 500, 310)),
  add(
    host('dns', 'server', 500, 90, {
      address: '192.0.2.53/24',
      listeners: [udp(53)],
      records: [
        { name: 'shop.example', ip: '198.51.100.10' },
        { name: 'myapp.example', ip: '198.51.100.20' },
      ],
    }),
  ),
  add(
    host('shop', 'server', 760, 420, {
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
    host('vps', 'server', 760, 180, {
      address: '198.51.100.20/24',
      listeners: [tcp(80)],
    }),
  ),
  add(
    certificateAuthority('ca', 890, 300, {
      address: '198.51.100.30/24',
      dns: '192.0.2.53',
    }),
  ),
  radio('phone', 'cafe'),
  cable('cafe', 'internet'),
  cable('internet', 'dns'),
  cable('internet', 'shop'),
  cable('internet', 'vps'),
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

const requestHop = (trace: Trace) =>
  Option.getOrThrow(
    Array.findFirst(
      trace.hops,
      hop =>
        hop.from === 'phone' &&
        Array.some(hop.envelope, layer => layer._tag === 'Http'),
    ),
  )

const protocolsShown = (intent: Intent, show: 'letters' | 'handshake') =>
  Array.dedupe(
    Array.map(
      timelineOf({
        world,
        stage: [play(intent, { show })],
        layout: layoutBoard({
          doc: world.doc,
          unlocked: LESSON_11,
          isNarrow: false,
          isCloudOpen: false,
          maybeFog: Option.none(),
          rooms: [],
          moved: {},
          text: id => ({ title: id, sub: '', hint: '' }),
        }),
        unlocked: LESSON_11,
      }).legs,
      leg => leg.protocol,
    ),
  )

describe('the sealed envelope on the board', () => {
  test('plain http shows the form fields; nothing is sealed', () => {
    const hop = requestHop(
      sendIntent(world, login('http://shop.example/login'))[0],
    )
    expect(isSealed(hop)).toBe(false)
    const http = Option.getOrThrow(
      Array.findFirst(layerRows(hop, true), row => row.title === 'HTTP'),
    )
    expect([http.isSealed, http.fields]).toEqual([
      false,
      [
        { key: 'POST', value: '/login' },
        { key: 'host', value: 'shop.example' },
        { key: 'login', value: 'anna' },
        { key: 'password', value: 'kotik2024' },
      ],
    ])
  })

  test('under the TLS cipher the HTTP layer keeps only its name — once the sealed envelope is open', () => {
    const hop = requestHop(
      sendIntent(world, login('https://shop.example/login'))[0],
    )
    expect(isSealed(hop)).toBe(true)
    const rows = layerRows(hop, true)
    expect(
      Array.map(rows, row => [row.title, row.isSealed, row.fields.length > 0]),
    ).toEqual([
      ['Wi-Fi', false, true],
      ['IP', false, true],
      ['TCP', false, true],
      ['TLS', false, true],
      ['HTTP', true, false],
    ])
    expect(Array.some(layerRows(hop), row => row.isSealed)).toBe(false)
  })

  test('the handshake show adds the cipher agreement before the request; letters do not', () => {
    const page = login('https://shop.example/login')
    expect(protocolsShown(page, 'letters')).not.toContain('tls')
    expect(protocolsShown(page, 'handshake')).toEqual(['dns', 'tls', 'http'])
  })

  test('the passport and the handshake need what lesson 11 opens', () => {
    expect(stageFeatures(showCert('shop', 'shop.example'))).toContain(
      'browser.certificate',
    )
    expect(stageTargets(showCert('shop', 'shop.example'))).toEqual(['shop'])
    expect(
      stageFeatures(
        play(login('https://shop.example/'), { show: 'handshake' }),
      ),
    ).toContain('board.sealedEnvelope')
    expect(
      stageFeatures(play(login('https://shop.example/'), { show: 'letters' })),
    ).not.toContain('board.sealedEnvelope')
  })

  test('after “Issue” the board plays the authority fetching the password file over http://', () => {
    expect(
      packet.moveStage(world, issueCert('vps', ['myapp.example'])),
    ).toEqual([
      {
        _tag: 'Play',
        intent: Intent.Fetch({
          from: 'ca',
          url: 'http://myapp.example/.well-known/acme-challenge/vps',
        }),
        show: 'letters',
      },
    ])
  })
})
