import { describe, expect, test } from 'vitest'

import { add, certificateAuthority, host } from './build'
import { buildNet } from './testing'
import { ACME_DAYS, addDays, certChecks, dateAt } from './tls'

// Три проверки certificate по отдельности — для паспорта сайта на доске
// (урок 11): имя, срок, издатель.

const doc = buildNet([
  add(host('shop', 'server', 0, 0, { address: '198.51.100.10/24' })),
])

const shopCert = {
  names: ['shop.example'],
  issuer: 'Example CA',
  notAfter: '2027-03-14',
}

describe('certificate checks one by one', () => {
  test('a good certificate passes all three', () => {
    expect(certChecks(doc, 0, 'shop.example', shopCert)).toEqual({
      name: true,
      date: true,
      issuer: true,
    })
  })

  test('each check fails on its own', () => {
    expect(certChecks(doc, 0, 'myapp.example', shopCert)).toEqual({
      name: false,
      date: true,
      issuer: true,
    })
    expect(
      certChecks(doc, 0, 'shop.example', {
        ...shopCert,
        notAfter: '2026-10-29',
      }),
    ).toEqual({ name: true, date: false, issuer: true })
    expect(
      certChecks(doc, 0, 'shop.example', { ...shopCert, issuer: 'Home CA' }),
    ).toEqual({ name: true, date: true, issuer: false })
  })

  test('the date moves with the network clock; a CA on the board is trusted', () => {
    const later = 200 * 86400
    expect(dateAt(later) > shopCert.notAfter).toBe(true)
    expect(certChecks(doc, later, 'shop.example', shopCert).date).toBe(false)
    expect(addDays(dateAt(0), ACME_DAYS)).toBe('2027-01-28')
    const withCa = buildNet([
      add(
        certificateAuthority('ca', 0, 0, {
          address: '198.51.100.30/24',
          issuer: 'Home CA',
        }),
      ),
    ])
    expect(
      certChecks(withCa, 0, 'shop.example', { ...shopCert, issuer: 'Home CA' })
        .issuer,
    ).toBe(true)
  })
})
