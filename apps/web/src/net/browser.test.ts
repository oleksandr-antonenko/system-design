import { describe, expect, test } from 'vitest'

import { browse } from './browser'
import { forgetWifi, setStatic, wait } from './build'
import { NetMessage } from './message'
import { emptyState } from './model'
import { buildNet, buildWorld, homeNet } from './testing'
import { foldWorld } from './world'

describe('browser', () => {
  test('a page shows its host as title, the lock and the address the server saw', () => {
    const result = browse(
      homeNet(),
      emptyState,
      'phone',
      'https://shop.example/',
    )
    expect(result.url).toBe('https://shop.example/')
    expect(result.view).toMatchObject({
      _tag: 'Page',
      title: 'shop.example',
      status: 200,
      secure: true,
      seenFrom: '203.0.113.7',
    })
    expect(result.trace.hops.length).toBeGreaterThan(0)
  })

  test('the address bar adds http:// when the scheme is missing', () => {
    expect(browse(homeNet(), emptyState, 'phone', 'shop.example').url).toBe(
      'http://shop.example',
    )
  })

  test('real error codes come from the reason of the outcome', () => {
    const codeOf = (
      doc = homeNet(),
      from = 'phone',
      url = 'https://shop.example/',
    ) => browse(doc, emptyState, from, url).view
    expect(codeOf(buildNet([forgetWifi('phone')], homeNet()))).toMatchObject({
      code: 'ERR_INTERNET_DISCONNECTED',
      reason: NetMessage.NoWifiProfile({ device: 'phone' }),
    })
    expect(
      codeOf(
        buildNet(
          [
            setStatic(
              'laptop',
              '192.168.1.42/24',
              '192.168.1.254',
              '192.0.2.53',
            ),
          ],
          homeNet(),
        ),
        'laptop',
      ),
    ).toMatchObject({
      code: 'ERR_NAME_NOT_RESOLVED',
      reason: NetMessage.GatewayUnreachable({
        device: 'laptop',
        gateway: '192.168.1.254',
      }),
    })
    expect(
      codeOf(
        buildNet(
          [
            setStatic(
              'laptop',
              '192.168.1.42/24',
              '192.168.1.254',
              '192.0.2.53',
            ),
          ],
          homeNet(),
        ),
        'laptop',
        'http://198.51.100.10/',
      ),
    ).toMatchObject({ code: 'ERR_ADDRESS_UNREACHABLE' })
    expect(codeOf(homeNet(), 'shop', 'http://203.0.113.7:5173/')).toMatchObject(
      {
        code: 'ERR_CONNECTION_TIMED_OUT',
        reason: NetMessage.NatNoMapping({
          router: 'router',
          proto: 'tcp',
          port: 5173,
        }),
      },
    )
  })

  test('an expired certificate after waiting past its date gives NET::ERR_CERT_DATE_INVALID', () => {
    const later = foldWorld(buildWorld([], homeNet()), [wait(200 * 86400)])
    expect(
      browse(later.doc, later.state, 'phone', 'https://shop.example/').view,
    ).toMatchObject({
      code: 'NET::ERR_CERT_DATE_INVALID',
    })
  })
})
