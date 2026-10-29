import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import {
  formatIp,
  inSubnet,
  isMac,
  isPrivate,
  isUsableHost,
  macFromId,
  maskOf,
  networkAddress,
  parseIp,
  parseUrl,
} from './address'

describe('IP addresses', () => {
  test('parse and format round-trip, garbage is rejected', () => {
    expect(Option.map(parseIp('192.168.1.23'), formatIp)).toEqual(
      Option.some('192.168.1.23'),
    )
    expect(Option.map(parseIp('203.0.113.7'), formatIp)).toEqual(
      Option.some('203.0.113.7'),
    )
    expect(
      Array.map(['256.1.1.1', '1.2.3', '01.2.3.4', 'a.b.c.d', ''], parseIp),
    ).toEqual(Array.makeBy(5, () => Option.none()))
  })

  test('the mask is a stencil: same network part means same subnet', () => {
    expect(maskOf(24)).toBe('255.255.255.0')
    expect(maskOf(16)).toBe('255.255.0.0')
    expect(inSubnet('192.168.1.23', '192.168.1.200', 24)).toBe(true)
    expect(inSubnet('192.168.1.23', '192.168.2.23', 24)).toBe(false)
    expect(inSubnet('192.168.1.23', '192.168.2.23', 16)).toBe(true)
    expect(networkAddress('192.168.1.23', 24)).toBe('192.168.1.0')
  })

  test('network and broadcast addresses are not usable for a device', () => {
    expect(isUsableHost('192.168.1.0', 24)).toBe(false)
    expect(isUsableHost('192.168.1.255', 24)).toBe(false)
    expect(isUsableHost('192.168.1.1', 24)).toBe(true)
    expect(isUsableHost('198.51.100.10', 32)).toBe(true)
  })

  test('private ranges are told apart from public ones', () => {
    expect(
      Array.map(['10.1.2.3', '172.20.0.1', '192.168.1.1'], isPrivate),
    ).toEqual([true, true, true])
    expect(
      Array.map(['203.0.113.7', '198.51.100.10', '172.32.0.1'], isPrivate),
    ).toEqual([false, false, false])
  })
})

describe('MAC addresses', () => {
  test('a MAC derived from the id is valid, stable and locally administered', () => {
    const mac = macFromId('phone')
    expect(isMac(mac)).toBe(true)
    expect(mac.startsWith('02:')).toBe(true)
    expect(macFromId('phone')).toBe(mac)
    expect(macFromId('laptop')).not.toBe(mac)
  })
})

describe('URLs', () => {
  test('scheme, host, default port and path', () => {
    expect(parseUrl('https://shop.example/')).toEqual(
      Option.some({
        scheme: 'https',
        host: 'shop.example',
        port: 443,
        path: '/',
      }),
    )
    expect(parseUrl('http://192.168.1.42:5173')).toEqual(
      Option.some({
        scheme: 'http',
        host: '192.168.1.42',
        port: 5173,
        path: '/',
      }),
    )
    expect(parseUrl('ftp://shop.example/')).toEqual(Option.none())
    expect(parseUrl('http://shop.example:99999/')).toEqual(Option.none())
  })
})
