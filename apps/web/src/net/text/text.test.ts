import { Array, Record } from 'effect'
import { describe, expect, test } from 'vitest'

import { locales } from '../../i18n/locale'
import { NetMessage } from '../message'
import { netTexts, renderNetMessage } from './index'
import { sampleNames, samples } from './samples'

const nameOf = (id: string): string => sampleNames[id] ?? id

describe('NetMessage texts', () => {
  const messages = Record.values(samples)

  test('every code has a sample', () => {
    expect(Array.map(messages, message => message._tag).sort()).toEqual(
      Record.keys(netTexts.en).sort(),
    )
  })

  test.each(locales)('every code renders in %s with device labels', locale => {
    const bad = Array.filter(messages, message => {
      const text = renderNetMessage(locale, message, nameOf)
      return (
        text.trim() === '' ||
        text.includes('undefined') ||
        text.includes('[object') ||
        text.includes('dev-a') ||
        text.includes('dev-b')
      )
    })
    expect(Array.map(bad, message => message._tag)).toEqual([])
  })

  test('a label replaces the id, and each language says it its own way', () => {
    const message = NetMessage.ListensOnlyOnLoopback({
      device: 'laptop',
      port: 5173,
    })
    const label = (id: string): string => (id === 'laptop' ? 'Laptop' : id)
    expect(renderNetMessage('ru', message, label)).toBe(
      'Port 5173 на устройстве «Laptop» открыт только для него самого (127.0.0.1).',
    )
    expect(renderNetMessage('en', message, () => 'Laptop')).toBe(
      'Port 5173 on Laptop is open only to the device itself (127.0.0.1).',
    )
    expect(
      Array.dedupe(
        Array.map(locales, locale => renderNetMessage(locale, message)),
      ),
    ).toHaveLength(4)
  })

  test('the course says “envelope”, never “letter”', () => {
    const texts = Array.flatMap(locales, locale =>
      Array.map(messages, message =>
        renderNetMessage(locale, message, nameOf).toLowerCase(),
      ),
    )
    expect(
      Array.filter(texts, text =>
        ['письм', 'лист ', 'letter', 'laišk'].some(word => text.includes(word)),
      ),
    ).toEqual([])
  })
})
