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

const OBSTACLE_MARGIN = 6
const DETOURS: ReadonlyArray<number> = [-90, 90, -150, 150]

const curveWithLift = (start: Point, end: Point, lift: number): Curve => {
  const bend = Math.max(30, Math.abs(end.x - start.x) * 0.5)
  return {
    start,
    control1: { x: start.x + bend, y: start.y + lift },
    control2: { x: end.x - bend, y: end.y + lift },
    end,
  }
}

const crossesNode = (curve: Curve, obstacle: Point): boolean =>
  Array.from({ length: 19 }, (_, index) => (index + 1) / 20).some(t => {
    const point = pointOnCurve(curve, t)
    return (
      Math.abs(point.x - obstacle.x) < NODE_WIDTH / 2 + OBSTACLE_MARGIN &&
      Math.abs(point.y - obstacle.y) < NODE_HEIGHT / 2 + OBSTACLE_MARGIN
    )
  })

/** Кривая связи от правого края `from` к левому краю `to`. Если прямой путь
    проходит сквозь другой блок из `obstacles`, связь огибает его сверху или
    снизу — иначе она пряталась бы под блоком и её нельзя было бы выбрать. */
export const edgeCurve = (
  from: Point,
  to: Point,
  obstacles: ReadonlyArray<Point> = [],
): Curve => {
  const start = { x: from.x + NODE_WIDTH / 2, y: from.y }
  const end = { x: to.x - NODE_WIDTH / 2 - ARROW_GAP, y: to.y }
  const direct = curveWithLift(start, end, 0)
  const isClear = (curve: Curve) =>
    obstacles.every(obstacle => !crossesNode(curve, obstacle))

  return isClear(direct)
    ? direct
    : (DETOURS.map(lift => curveWithLift(start, end, lift)).find(isClear) ??
        direct)
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
  x: Math.min(
    Math.max(snapToGrid(x), NODE_WIDTH / 2 + 6),
    BOARD_WIDTH - NODE_WIDTH / 2 - 6,
  ),
  y: Math.min(
    Math.max(snapToGrid(y), NODE_HEIGHT / 2 + 44),
    BOARD_HEIGHT - NODE_HEIGHT / 2 - 6,
  ),
})

export const nodeCenter = (node: BoardNode): Point => ({ x: node.x, y: node.y })

const overlaps = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) < NODE_WIDTH && Math.abs(a.y - b.y) < NODE_HEIGHT

export const isSpotFree = (
  nodes: ReadonlyArray<BoardNode>,
  spot: Point,
): boolean => nodes.every(node => !overlaps(nodeCenter(node), spot))
