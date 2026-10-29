import { Effect, Option, Queue, Schema, Stream } from 'effect'
import { Mount } from 'foldkit'

import { ComponentKind } from '../domain/catalog'
import type { Point } from '../domain/geometry'
import { Message, PointerTarget } from './message'

const isComponentKind = Schema.is(ComponentKind)

const datasetValue = (
  element: Element | null,
  key: string,
): Option.Option<string> =>
  element instanceof HTMLElement || element instanceof SVGElement
    ? Option.fromNullishOr(element.dataset[key])
    : Option.none()

const closest = (element: Element | null, selector: string): Element | null =>
  element === null ? null : element.closest(selector)

const targetOf = (
  element: Element | null,
  board: Element | null,
): PointerTarget => {
  const deleteNode = closest(element, '[data-delete-node]')
  if (deleteNode !== null) {
    return PointerTarget.DeleteNode({
      id: Option.getOrElse(datasetValue(deleteNode, 'deleteNode'), () => ''),
    })
  }
  const deleteEdge = closest(element, '[data-delete-from]')
  if (deleteEdge !== null) {
    return PointerTarget.DeleteEdge({
      from: Option.getOrElse(datasetValue(deleteEdge, 'deleteFrom'), () => ''),
      to: Option.getOrElse(datasetValue(deleteEdge, 'deleteTo'), () => ''),
    })
  }
  const port = closest(element, '[data-port]')
  if (port !== null) {
    return PointerTarget.Port({
      id: Option.getOrElse(datasetValue(port, 'port'), () => ''),
    })
  }
  const edge = closest(element, '[data-edge-from]')
  if (edge !== null) {
    return PointerTarget.Edge({
      from: Option.getOrElse(datasetValue(edge, 'edgeFrom'), () => ''),
      to: Option.getOrElse(datasetValue(edge, 'edgeTo'), () => ''),
    })
  }
  const node = closest(element, '[data-node]')
  if (node !== null) {
    return PointerTarget.Node({
      id: Option.getOrElse(datasetValue(node, 'node'), () => ''),
    })
  }
  const palette = closest(element, '[data-palette]')
  if (palette !== null) {
    const kind = Option.getOrElse(datasetValue(palette, 'palette'), () => '')
    return isComponentKind(kind)
      ? PointerTarget.Palette({ kind })
      : PointerTarget.Outside()
  }
  return board !== null && element !== null && board.contains(element)
    ? PointerTarget.Background()
    : PointerTarget.Outside()
}

const isEditableNode = (element: Element | null): boolean =>
  closest(element, '[data-node]')?.classList.contains('editable') === true

// A press that carries something across the board: near the edge of a
// scrolled (narrow-screen) board the board scrolls under it.
const isDragSource = (
  element: Element | null,
  target: PointerTarget,
): boolean =>
  PointerTarget.match(target, {
    Port: () => true,
    Node: () => isEditableNode(element),
    Palette: () =>
      closest(element, '[data-palette]')?.matches(':disabled') === false,
    Edge: () => false,
    DeleteNode: () => false,
    DeleteEdge: () => false,
    Background: () => false,
    Outside: () => false,
  })

// A touch that must reach the board instead of panning the page. On a narrow
// screen the board background allows panning, and Chrome ignores
// `touch-action` on SVG children, so the pan is refused at touchstart. Palette
// buttons are HTML with `touch-action: none` and need the tap's click.
const keepsTouch = (element: Element | null, target: PointerTarget): boolean =>
  PointerTarget.match(target, {
    Port: () => true,
    Node: () => isEditableNode(element),
    Edge: () => true,
    DeleteNode: () => true,
    DeleteEdge: () => true,
    Palette: () => false,
    Background: () => false,
    Outside: () => false,
  })

const EDGE_ZONE_PX = 40
const EDGE_SPEED_PX = 14

const edgeScrollStep = (
  scroller: HTMLElement | null,
  clientX: number,
  clientY: number,
): number => {
  if (scroller === null || scroller.scrollWidth <= scroller.clientWidth) {
    return 0
  }
  const rect = scroller.getBoundingClientRect()
  if (clientY < rect.top || clientY > rect.bottom) {
    return 0
  }
  const speed = (distance: number) =>
    Math.ceil(EDGE_SPEED_PX * (1 - Math.max(distance, 0) / EDGE_ZONE_PX))
  const toLeft = clientX - rect.left
  const toRight = rect.right - clientX
  return toLeft < EDGE_ZONE_PX
    ? -speed(toLeft)
    : toRight < EDGE_ZONE_PX
      ? speed(toRight)
      : 0
}

const boardPoint = (
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
): Point => {
  const matrix = svg === null ? null : svg.getScreenCTM()
  if (matrix === null) {
    return { x: 0, y: 0 }
  }
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
  return { x: point.x, y: point.y }
}

const isInside = (
  element: Element | null,
  clientX: number,
  clientY: number,
): boolean => {
  if (element === null) {
    return false
  }
  const rect = element.getBoundingClientRect()
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  )
}

type PointerMessage =
  | typeof Message.PressedPointer.Type
  | typeof Message.MovedPointer.Type
  | typeof Message.ReleasedPointer.Type
  | typeof Message.CancelledPointer.Type

const SWALLOW_CLICK_MS = 500
const PALETTE_DRAG_PX = 6

const attach = (
  container: Element,
  emit: (message: PointerMessage) => void,
): (() => void) => {
  const state = {
    isPressed: false,
    fromPalette: false,
    isDrag: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    swallowUntil: 0,
    scrollFrame: 0,
  }
  const svg = () => container.querySelector<SVGSVGElement>('svg[data-board]')
  const scroller = () => container.querySelector<HTMLElement>('.board-scroll')

  const emitMove = (clientX: number, clientY: number) =>
    emit(
      Message.MovedPointer({
        point: boardPoint(svg(), clientX, clientY),
        isOverBoard: isInside(svg(), clientX, clientY),
      }),
    )

  const stopScrolling = () => {
    cancelAnimationFrame(state.scrollFrame)
    state.scrollFrame = 0
  }

  // The board moves under a resting finger, so the board point changes
  // without a pointermove: re-send the last position after every step.
  const scrollStep = () => {
    state.scrollFrame = 0
    const element = scroller()
    const step = edgeScrollStep(element, state.lastX, state.lastY)
    if (!state.isPressed || element === null || step === 0) {
      return
    }
    const before = element.scrollLeft
    element.scrollLeft = before + step
    if (element.scrollLeft !== before) {
      emitMove(state.lastX, state.lastY)
      state.scrollFrame = requestAnimationFrame(scrollStep)
    }
  }

  const onTouchStart = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null
    if (event.cancelable && keepsTouch(target, targetOf(target, svg()))) {
      event.preventDefault()
    }
  }

  const onDown = (event: Event) => {
    if (!(event instanceof PointerEvent) || event.button !== 0) {
      return
    }
    const target = event.target instanceof Element ? event.target : null
    const pointerTarget = targetOf(target, svg())
    if (pointerTarget._tag === 'Outside') {
      return
    }
    state.isPressed = true
    state.fromPalette = pointerTarget._tag === 'Palette'
    state.isDrag = isDragSource(target, pointerTarget)
    state.startX = event.clientX
    state.startY = event.clientY
    if (!state.fromPalette) {
      event.preventDefault()
    }
    if (container instanceof HTMLElement) {
      container.setPointerCapture(event.pointerId)
    }
    emit(
      Message.PressedPointer({
        target: pointerTarget,
        point: boardPoint(svg(), event.clientX, event.clientY),
      }),
    )
  }

  const onMove = (event: Event) => {
    if (!state.isPressed || !(event instanceof PointerEvent)) {
      return
    }
    state.lastX = event.clientX
    state.lastY = event.clientY
    emitMove(event.clientX, event.clientY)
    if (
      state.isDrag &&
      state.scrollFrame === 0 &&
      edgeScrollStep(scroller(), event.clientX, event.clientY) !== 0
    ) {
      state.scrollFrame = requestAnimationFrame(scrollStep)
    }
  }

  const onUp = (event: Event) => {
    if (!state.isPressed || !(event instanceof PointerEvent)) {
      return
    }
    state.isPressed = false
    stopScrolling()
    const dragged =
      Math.hypot(event.clientX - state.startX, event.clientY - state.startY) >
      PALETTE_DRAG_PX
    if (state.fromPalette && dragged) {
      state.swallowUntil = event.timeStamp + SWALLOW_CLICK_MS
    }
    emit(
      Message.ReleasedPointer({
        target: targetOf(
          document.elementFromPoint(event.clientX, event.clientY),
          svg(),
        ),
        point: boardPoint(svg(), event.clientX, event.clientY),
        isOverBoard: isInside(svg(), event.clientX, event.clientY),
      }),
    )
  }

  const onCancel = () => {
    stopScrolling()
    if (state.isPressed) {
      state.isPressed = false
      emit(Message.CancelledPointer())
    }
  }

  const onClickCapture = (event: Event) => {
    if (event.timeStamp < state.swallowUntil) {
      event.stopPropagation()
      event.preventDefault()
    }
  }

  container.addEventListener('touchstart', onTouchStart, { passive: false })
  container.addEventListener('pointerdown', onDown)
  container.addEventListener('pointermove', onMove)
  container.addEventListener('pointerup', onUp)
  container.addEventListener('pointercancel', onCancel)
  container.addEventListener('click', onClickCapture, true)

  return () => {
    stopScrolling()
    container.removeEventListener('touchstart', onTouchStart)
    container.removeEventListener('pointerdown', onDown)
    container.removeEventListener('pointermove', onMove)
    container.removeEventListener('pointerup', onUp)
    container.removeEventListener('pointercancel', onCancel)
    container.removeEventListener('click', onClickCapture, true)
  }
}

export const BoardPointer = Mount.defineStream('BoardPointer', {
  messages: [
    Message.PressedPointer,
    Message.MovedPointer,
    Message.ReleasedPointer,
    Message.CancelledPointer,
  ],
  execute: ({ element }) =>
    Stream.callback<PointerMessage>(queue =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            attach(element, message => Queue.offerUnsafe(queue, message)),
          ),
          detach => Effect.sync(detach),
        )
        return yield* Effect.never
      }),
    ),
})
