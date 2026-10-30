import { describe, expect, test } from 'vitest'

import type { FlowTypes } from '../kinds/types'
import {
  type QuizSpec,
  allOf,
  isCorrectPick,
  isValidPick,
  matchOf,
  pickParts,
} from './quiz'

// Ответы из нескольких частей (add-network-board): несколько вариантов
// (`allOf`) и пары «место=чип» (`matchOf`) сравниваются без учёта порядка.

const spec = (fields: Partial<QuizSpec<FlowTypes>>): QuizSpec<FlowTypes> => ({
  id: 'q',
  kind: 'SpotFault',
  candidates: ['a', 'b', 'c'],
  answer: 'a',
  ...fields,
})

describe('several-part answers', () => {
  test('allOf and matchOf do not depend on the order', () => {
    expect(allOf('b', 'a', 'b')).toBe('a+b')
    expect(matchOf({ B: 'y', A: 'x' })).toBe('A=x+B=y')
    expect(pickParts('a+b')).toEqual(['a', 'b'])
    expect(isCorrectPick('b+a', allOf('a', 'b'))).toBe(true)
    expect(isCorrectPick('a', allOf('a', 'b'))).toBe(false)
  })

  test('a single-answer quiz takes one candidate only', () => {
    expect(isValidPick(spec({}), 'a')).toBe(true)
    expect(isValidPick(spec({}), 'a+b')).toBe(false)
    expect(isValidPick(spec({}), 'z')).toBe(false)
  })

  test('several answers: distinct candidates; PickLinks is always several', () => {
    expect(isValidPick(spec({ multiple: true }), 'c+a')).toBe(true)
    expect(isValidPick(spec({ multiple: true }), 'a+a')).toBe(false)
    expect(isValidPick(spec({ multiple: true }), '')).toBe(false)
    expect(isValidPick(spec({ kind: 'PickLinks' }), 'a+b')).toBe(true)
  })

  test('Match: each place once, chips from the candidates', () => {
    const match = spec({ kind: 'Match', slots: ['A', 'B'] })
    expect(isValidPick(match, 'A=a+B=b')).toBe(true)
    expect(isValidPick(match, 'A=a+A=b')).toBe(false)
    expect(isValidPick(match, 'C=a')).toBe(false)
    expect(isValidPick(match, 'A=z')).toBe(false)
  })
})
