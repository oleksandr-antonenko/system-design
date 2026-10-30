import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { add, cable, host, internet, router, tcp, udp } from '../../net/build'
import { Intent } from '../../net/packet'
import { buildWorld } from '../../net/testing'
import { sendIntent } from '../../net/world'
import { isAddressQuestion } from './envelope'

// Подпись конверта «кому»: вопрос «у кого этот адрес?» слышат все в доме,
// поэтому он адресован всем, а не тому, кто услышал его последним
// (раньше конверт ноутбука к router подписывался «кому: Printer»).

const world = buildWorld([
  add(
    router('router', 300, 300, {
      lan: '192.168.1.1/24',
      wan: '203.0.113.7',
      dns: '192.0.2.53',
    }),
  ),
  add(host('laptop', 'laptop', 100, 300)),
  add(host('printer', 'printer', 300, 500)),
  add(internet('internet', 500, 300)),
  add(
    host('dns', 'server', 500, 100, {
      address: '192.0.2.53/24',
      listeners: [udp(53)],
      records: [{ name: 'shop.example', ip: '198.51.100.10' }],
    }),
  ),
  add(
    host('shop', 'server', 700, 300, {
      address: '198.51.100.10/24',
      listeners: [tcp(80)],
    }),
  ),
  cable('laptop', 'router'),
  cable('printer', 'router'),
  cable('router', 'internet'),
  cable('internet', 'dns'),
  cable('internet', 'shop'),
])

const arpOf = (kind: 'request' | 'reply') =>
  Array.findFirst(
    sendIntent(
      world,
      Intent.Browse({ from: 'laptop', url: 'http://shop.example/' }),
    )[0].hops,
    hop =>
      Array.some(
        hop.envelope,
        layer => layer._tag === 'Arp' && layer.kind === kind,
      ),
  )

describe('envelope addressee', () => {
  test('the question “who has this address?” is addressed to everyone', () => {
    expect(Option.map(arpOf('request'), isAddressQuestion)).toEqual(
      Option.some(true),
    )
  })

  test('the answer to it goes to the one who asked', () => {
    expect(Option.map(arpOf('reply'), isAddressQuestion)).toEqual(
      Option.some(false),
    )
  })
})
