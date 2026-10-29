import { describe, expect, test } from 'vitest'

import {
  type Unlocking,
  isSurfaceOpen,
  isUnlockedThrough,
  unlockedIn,
  unlockedThrough,
} from './unlocks'

// Порядок в массиве нарочно перепутан: открытие считается по номеру урока.
const lessons: ReadonlyArray<Unlocking> = [
  { order: 4, unlocks: ['transport.step', 'terminal.ping'] },
  { order: 1, unlocks: ['transport.run', 'wifi.join'] },
  { order: 2, unlocks: [] },
  { order: 5, unlocks: ['router.wifi'] },
]

describe('features open as the course goes on (plan 3.4)', () => {
  test('a lesson sees everything opened by lessons up to and including it', () => {
    expect(unlockedThrough(lessons, 1)).toEqual(['transport.run', 'wifi.join'])
    expect(unlockedThrough(lessons, 3)).toEqual(['transport.run', 'wifi.join'])
    expect(unlockedThrough(lessons, 4)).toEqual([
      'transport.run',
      'wifi.join',
      'transport.step',
      'terminal.ping',
    ])
  })

  test('nothing is open before the first lesson', () => {
    expect(unlockedThrough(lessons, 0)).toEqual([])
  })

  test('features of the lesson itself are the new ones', () => {
    expect(unlockedIn(lessons, 4)).toEqual(['transport.step', 'terminal.ping'])
    expect(unlockedIn(lessons, 2)).toEqual([])
    expect(unlockedIn(lessons, 9)).toEqual([])
  })

  test('a feature stays open in later lessons', () => {
    expect(isUnlockedThrough(lessons, 3, 'terminal.ping')).toBe(false)
    expect(isUnlockedThrough(lessons, 4, 'terminal.ping')).toBe(true)
    expect(isUnlockedThrough(lessons, 5, 'terminal.ping')).toBe(true)
  })

  test('a surface is open when any of its features is', () => {
    expect(isSurfaceOpen(unlockedThrough(lessons, 4), 'terminal')).toBe(true)
    expect(isSurfaceOpen(unlockedThrough(lessons, 4), 'router')).toBe(false)
    expect(isSurfaceOpen(['terminalish.x'], 'terminal')).toBe(false)
  })
})
