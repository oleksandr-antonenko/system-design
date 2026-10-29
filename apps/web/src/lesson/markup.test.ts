import { describe, expect, test } from 'vitest'

import { parseProse, referencedIds } from './markup'

describe('lesson markup', () => {
  test('bold text and block references inside a paragraph', () => {
    expect(
      parseProse('Users reach [[app1|the server]] at **400 rps**.'),
    ).toEqual([
      [
        { _tag: 'Text', text: 'Users reach ' },
        { _tag: 'Ref', id: 'app1', text: 'the server' },
        { _tag: 'Text', text: ' at ' },
        { _tag: 'Strong', text: '400 rps' },
        { _tag: 'Text', text: '.' },
      ],
    ])
  })

  test('blank lines split paragraphs and single newlines join lines', () => {
    expect(parseProse('First line\nsame paragraph.\n\n  Second.  ')).toEqual([
      [{ _tag: 'Text', text: 'First line same paragraph.' }],
      [{ _tag: 'Text', text: 'Second.' }],
    ])
  })

  test('HTML stays plain text', () => {
    expect(parseProse('<img src=x onerror=alert(1)> **<b>**')).toEqual([
      [
        { _tag: 'Text', text: '<img src=x onerror=alert(1)> ' },
        { _tag: 'Strong', text: '<b>' },
      ],
    ])
  })

  test('unfinished markup is left as written', () => {
    expect(parseProse('**open and [[app1 broken')).toEqual([
      [{ _tag: 'Text', text: '**open and [[app1 broken' }],
    ])
  })

  test('referenced ids are collected from every paragraph', () => {
    expect(
      referencedIds('[[users|Users]] call [[app1|it]].\n\n[[db|DB]]'),
    ).toEqual(['users', 'app1', 'db'])
  })
})
