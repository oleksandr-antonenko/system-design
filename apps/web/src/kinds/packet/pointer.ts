import { Effect, Queue, Stream } from 'effect'
import { Mount } from 'foldkit'

import { Message } from './message'

// Перетаскивание устройства по доске сетей (задача разрешает двигать).
// Точка экрана переводится в координаты документа: на узком экране оси
// доски повёрнуты (layout.ts), поэтому svg несёт `data-narrow` и масштабы.

type DragMessage =
  | typeof Message.MovedDevice.Type
  | typeof Message.DroppedDevice.Type

const NARROW_ALONG_X = 0.62
const NARROW_ALONG_Y = 0.95

const docPoint = (
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): Readonly<{ x: number; y: number }> => {
  const matrix = svg.getScreenCTM()
  if (matrix === null) {
    return { x: 0, y: 0 }
  }
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
  return svg.dataset['narrow'] === 'true'
    ? { x: point.y / NARROW_ALONG_X, y: point.x / NARROW_ALONG_Y }
    : { x: point.x, y: point.y }
}

const attach = (
  container: Element,
  emit: (message: DragMessage) => void,
): (() => void) => {
  const state = { isDragging: false }
  const svg = () => container.querySelector<SVGSVGElement>('svg[data-board]')

  const onDown = (event: Event) => {
    if (!(event instanceof PointerEvent) || event.button !== 0) {
      return
    }
    const target = event.target instanceof Element ? event.target : null
    state.isDragging =
      target !== null && target.closest('.pb-node.movable') !== null
  }
  const onMove = (event: Event) => {
    const board = svg()
    if (state.isDragging && event instanceof PointerEvent && board !== null) {
      emit(Message.MovedDevice(docPoint(board, event.clientX, event.clientY)))
    }
  }
  const onUp = () => {
    if (state.isDragging) {
      state.isDragging = false
      emit(Message.DroppedDevice())
    }
  }

  container.addEventListener('pointerdown', onDown)
  container.addEventListener('pointermove', onMove)
  container.addEventListener('pointerup', onUp)
  container.addEventListener('pointercancel', onUp)
  return () => {
    container.removeEventListener('pointerdown', onDown)
    container.removeEventListener('pointermove', onMove)
    container.removeEventListener('pointerup', onUp)
    container.removeEventListener('pointercancel', onUp)
  }
}

export const DevicePointer = Mount.defineStream('PacketDevicePointer', {
  messages: [Message.MovedDevice, Message.DroppedDevice],
  execute: ({ element }) =>
    Stream.callback<DragMessage>(queue =>
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
