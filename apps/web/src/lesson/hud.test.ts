import { describe, expect, test } from 'vitest'

import { emptyBoard, foldOps } from '../domain/board'
import { uiFor } from '../i18n/ui'
import { type Anim, initialAnim } from './anim'
import { addNode } from './dsl'
import { extraMetrics } from './view'

describe('instruments that depend on the board', () => {
  const ui = uiFor('en')
  const anim: Anim = { ...initialAnim, hudRejected: 900, hudBacklog: 200 }
  const boardWith = (kinds: ReadonlyArray<'limiter' | 'queue' | 'events'>) =>
    foldOps(emptyBoard, [
      addNode('users', 'client', 100, 280),
      addNode('app1', 'server', 520, 280),
      ...kinds.map((kind, index) =>
        addNode(`${kind}-1`, kind, 300, 100 + index * 120),
      ),
    ])

  test('a board without a limiter or a queue shows none of them', () => {
    expect(extraMetrics(boardWith([]), anim, ui)).toEqual([])
  })

  test('a limiter adds the rejected requests', () => {
    expect(extraMetrics(boardWith(['limiter']), anim, ui)).toEqual([
      { label: 'Rejected', value: '900 rps' },
    ])
  })

  test('a queue or an event bus adds the queue growth', () => {
    const growth = { label: 'Queue growing', value: '+200 rps' }

    expect(extraMetrics(boardWith(['queue']), anim, ui)).toEqual([growth])
    expect(extraMetrics(boardWith(['events']), anim, ui)).toEqual([growth])
    expect(extraMetrics(boardWith(['limiter', 'events']), anim, ui)).toEqual([
      { label: 'Rejected', value: '900 rps' },
      growth,
    ])
  })
})
