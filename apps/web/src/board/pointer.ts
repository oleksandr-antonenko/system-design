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
    startX: 0,
    startY: 0,
    swallowUntil: 0,
  }
  const svg = () => container.querySelector<SVGSVGElement>('svg[data-board]')

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
    emit(
      Message.MovedPointer({
        point: boardPoint(svg(), event.clientX, event.clientY),
        isOverBoard: isInside(svg(), event.clientX, event.clientY),
      }),
    )
  }

  const onUp = (event: Event) => {
    if (!state.isPressed || !(event instanceof PointerEvent)) {
      return
    }
    state.isPressed = false
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

  container.addEventListener('pointerdown', onDown)
  container.addEventListener('pointermove', onMove)
  container.addEventListener('pointerup', onUp)
  container.addEventListener('pointercancel', onCancel)
  container.addEventListener('click', onClickCapture, true)

  return () => {
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
