import type { BoardNode } from './board'

export const BOARD_WIDTH = 900
export const BOARD_HEIGHT = 560
export const NODE_WIDTH = 148
export const NODE_HEIGHT = 60
export const GRID_STEP = 10
const ARROW_GAP = 3

export type Point = Readonly<{ x: number; y: number }>

export type Curve = Readonly<{
  start: Point
  control1: Point
  control2: Point
  end: Point
}>

export const edgeCurve = (from: Point, to: Point): Curve => {
  const start = { x: from.x + NODE_WIDTH / 2, y: from.y }
  const end = { x: to.x - NODE_WIDTH / 2 - ARROW_GAP, y: to.y }
  const bend = Math.max(30, Math.abs(end.x - start.x) * 0.5)

  return {
    start,
    control1: { x: start.x + bend, y: start.y },
    control2: { x: end.x - bend, y: end.y },
    end,
  }
}

export const curvePath = ({ start, control1, control2, end }: Curve): string =>
  `M${start.x},${start.y} C${control1.x},${control1.y} ${control2.x},${control2.y} ${end.x},${end.y}`

export const pointOnCurve = (
  { start, control1, control2, end }: Curve,
  t: number,
): Point => {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * start.x + b * control1.x + c * control2.x + d * end.x,
    y: a * start.y + b * control1.y + c * control2.y + d * end.y,
  }
}

export const curveLength = ({ start, end }: Curve): number =>
  Math.hypot(end.x - start.x, end.y - start.y)

export const snapToGrid = (value: number): number =>
  Math.round(value / GRID_STEP) * GRID_STEP

export const clampToBoard = ({ x, y }: Point): Point => ({
  x: Math.min(Math.max(snapToGrid(x), NODE_WIDTH / 2 + 6), BOARD_WIDTH - NODE_WIDTH / 2 - 6),
  y: Math.min(Math.max(snapToGrid(y), NODE_HEIGHT / 2 + 44), BOARD_HEIGHT - NODE_HEIGHT / 2 - 6),
})

export const nodeCenter = (node: BoardNode): Point => ({ x: node.x, y: node.y })

const overlaps = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) < NODE_WIDTH && Math.abs(a.y - b.y) < NODE_HEIGHT

export const isSpotFree = (nodes: ReadonlyArray<BoardNode>, spot: Point): boolean =>
  nodes.every(node => !overlaps(nodeCenter(node), spot))
