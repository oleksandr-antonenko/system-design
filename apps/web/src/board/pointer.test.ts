import { Array, Option, pipe } from 'effect'
import { afterEach, describe, expect, test } from 'vitest'

import { type Message, PointerTarget } from './message'
import { attach } from './pointer'

// The palette and the board as the view renders them: one container listens
// to the pointer, the palette button has its own click listener (Foldkit puts
// `OnClick` on the element itself).
const BOARD_MARKUP = `
  <aside class="board-palette">
    <button type="button" class="palette-item" data-palette="server">
      <svg viewBox="0 0 24 24"></svg>
      <span><span class="name">Server</span><span class="tag">400 rps</span></span>
    </button>
  </aside>
  <div class="board-scroll">
    <svg data-board="true" viewBox="0 0 900 560">
      <g data-node="app1" class="editable"><rect width="120" height="56"></rect></g>
    </svg>
  </div>`

const POINTER_ID = 1

const detachers: Array<() => void> = []

afterEach(() => {
  Array.forEach(detachers.splice(0), detach => detach())
  document.body.replaceChildren()
})

const mountBoard = () => {
  const container = document.createElement('div')
  container.className = 'board-wrap'
  container.innerHTML = BOARD_MARKUP
  document.body.append(container)
  const messages: Array<Message> = []
  detachers.push(attach(container, message => messages.push(message)))
  const button = container.querySelector('[data-palette="server"]')
  const label = container.querySelector('.palette-item .name')
  const node = container.querySelector('[data-node="app1"] rect')
  if (button === null || label === null || node === null) {
    throw new Error('board markup is incomplete')
  }
  const paletteClicks: Array<Event> = []
  button.addEventListener('click', event => paletteClicks.push(event))
  return { container, label, node, messages, paletteClicks }
}

const pointerEvent = (type: string, x: number, y: number) =>
  new PointerEvent(type, {
    pointerId: POINTER_ID,
    button: 0,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  })

// As a real browser does it: after pointerdown, pointer events go to the
// element holding the pointer capture, and so does the click after pointerup.
const receiverOf = (container: Element, hit: Element): Element =>
  pipe(
    [container, ...container.querySelectorAll('*')],
    Array.findFirst(element => element.hasPointerCapture(POINTER_ID)),
    Option.getOrElse(() => hit),
  )

const press = (hit: Element, x: number, y: number) => {
  hit.dispatchEvent(pointerEvent('pointerdown', x, y))
}

const moveTo = (container: Element, hit: Element, x: number, y: number) => {
  receiverOf(container, hit).dispatchEvent(pointerEvent('pointermove', x, y))
}

const releaseAndClick = (
  container: Element,
  hit: Element,
  x: number,
  y: number,
) => {
  const receiver = receiverOf(container, hit)
  receiver.dispatchEvent(pointerEvent('pointerup', x, y))
  receiver.releasePointerCapture(POINTER_ID)
  receiver.dispatchEvent(
    new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }),
  )
}

const tags = (messages: ReadonlyArray<Message>) =>
  Array.map(messages, message => message._tag)

describe('palette pointer', () => {
  test('a tap on a palette item clicks the item, which places a block at a free spot', () => {
    const board = mountBoard()

    press(board.label, 600, 150)
    releaseAndClick(board.container, board.label, 600, 150)

    expect(board.paletteClicks).toHaveLength(1)
    expect(tags(board.messages)).toEqual(['PressedPointer', 'ReleasedPointer'])
    expect(board.messages[0]).toMatchObject({
      target: PointerTarget.Palette({ kind: 'server' }),
    })
  })

  test('a drag from the palette reaches the board and does not click the item', () => {
    const board = mountBoard()

    press(board.label, 600, 150)
    moveTo(board.container, board.node, 800, 400)
    releaseAndClick(board.container, board.node, 800, 400)

    expect(tags(board.messages)).toEqual([
      'PressedPointer',
      'MovedPointer',
      'ReleasedPointer',
    ])
    expect(board.paletteClicks).toHaveLength(0)
  })

  test('the keyboard clicks a palette item without any pointer events', () => {
    const board = mountBoard()
    const button = board.label.closest('button')

    button?.click()

    expect(board.paletteClicks).toHaveLength(1)
    expect(board.messages).toEqual([])
  })

  test('a press on a block keeps the pointer on the board while it is dragged', () => {
    const board = mountBoard()

    press(board.node, 520, 280)

    expect(board.container.hasPointerCapture(POINTER_ID)).toBe(true)
    expect(board.messages[0]).toMatchObject({
      target: PointerTarget.Node({ id: 'app1' }),
    })
  })
})
