import { describe, expect, test } from 'vitest'

import { parseBlocks, parseProse, referencedIds } from './markup'

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

describe('lists in step text', () => {
  test('lines starting with "- " become a list after the lead paragraph', () => {
    expect(
      parseBlocks(
        'Now envelopes carry addresses:\n- **IP address** is a number\n  written as four numbers\n- the [[router|router]] hands it out',
      ),
    ).toEqual([
      {
        _tag: 'Paragraph',
        inlines: [{ _tag: 'Text', text: 'Now envelopes carry addresses:' }],
      },
      {
        _tag: 'List',
        items: [
          [
            { _tag: 'Strong', text: 'IP address' },
            { _tag: 'Text', text: ' is a number written as four numbers' },
          ],
          [
            { _tag: 'Text', text: 'the ' },
            { _tag: 'Ref', id: 'router', text: 'router' },
            { _tag: 'Text', text: ' hands it out' },
          ],
        ],
      },
    ])
  })

  test('a paragraph without bullets stays a paragraph; refs inside lists are found', () => {
    expect(parseBlocks('One - two.')).toEqual([
      { _tag: 'Paragraph', inlines: [{ _tag: 'Text', text: 'One - two.' }] },
    ])
    expect(
      referencedIds('Intro.\n\n- [[link:a-b|cable]]\n- [[env:transport|TCP]]'),
    ).toEqual(['link:a-b', 'env:transport'])
  })
})
