import { describe, expect, test } from 'vitest'

import { suggestions } from './unlocks'

// Кнопки-подсказки терминала: только открытые команды, в порядке открытия,
// новые помечены; со свободным вводом подсказок нет.

describe('terminal suggestions', () => {
  test('open commands only, in the order they open; the new one is marked', () => {
    expect(
      suggestions(
        ['terminal.ufw', 'terminal.ping', 'terminal.ss'],
        ['terminal.ufw'],
      ),
    ).toEqual([
      { command: 'ping ', isNew: false },
      { command: 'ss -ltn', isNew: false },
      { command: 'sudo ufw status', isNew: true },
    ])
  })

  test('free input hides the suggestions', () => {
    expect(
      suggestions(['terminal.ping', 'terminal.freeInput'], ['terminal.ping']),
    ).toEqual([])
  })
})
