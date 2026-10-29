import { Array, Option } from 'effect'

import type { BoardNode } from './board'
import { type Region, regions } from './catalog'

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
  Array.makeBy(19, index => (index + 1) / 20).some(t => {
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

// Пределы округлены внутрь сетки, чтобы блок у края тоже стоял на сетке.
const snapWithin = (value: number, min: number, max: number): number =>
  Math.min(
    Math.max(snapToGrid(value), Math.ceil(min / GRID_STEP) * GRID_STEP),
    Math.floor(max / GRID_STEP) * GRID_STEP,
  )

export const clampToBoard = ({ x, y }: Point): Point => ({
  x: snapWithin(x, NODE_WIDTH / 2 + 6, BOARD_WIDTH - NODE_WIDTH / 2 - 6),
  y: snapWithin(y, NODE_HEIGHT / 2 + 44, BOARD_HEIGHT - NODE_HEIGHT / 2 - 6),
})

export const nodeCenter = (node: BoardNode): Point => ({ x: node.x, y: node.y })

const overlaps = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) < NODE_WIDTH && Math.abs(a.y - b.y) < NODE_HEIGHT

export const isSpotFree = (
  nodes: ReadonlyArray<BoardNode>,
  spot: Point,
): boolean => nodes.every(node => !overlaps(nodeCenter(node), spot))

// REGION ZONES

export type Zone = Readonly<{
  region: Region
  x: number
  y: number
  width: number
  height: number
}>

const ZONE_PADDING = 14
const ZONE_LABEL_HEIGHT = 20
const ZONE_MARGIN = 2

/** Зона региона — прямоугольник вокруг его блоков с местом под подпись
    сверху (D6). Блоки без региона зоны не имеют. */
export const regionZones = (
  nodes: ReadonlyArray<BoardNode>,
): ReadonlyArray<Zone> =>
  Array.getSomes(
    Array.map(regions, region =>
      Array.match(
        Array.filter(nodes, node =>
          Option.exists(node.maybeRegion, nodeRegion => nodeRegion === region),
        ),
        {
          onEmpty: () => Option.none(),
          onNonEmpty: members => {
            const xs = Array.map(members, node => node.x)
            const ys = Array.map(members, node => node.y)
            const left = Math.max(
              ZONE_MARGIN,
              Math.min(...xs) - NODE_WIDTH / 2 - ZONE_PADDING,
            )
            const right = Math.min(
              BOARD_WIDTH - ZONE_MARGIN,
              Math.max(...xs) + NODE_WIDTH / 2 + ZONE_PADDING,
            )
            const top = Math.max(
              ZONE_MARGIN,
              Math.min(...ys) -
                NODE_HEIGHT / 2 -
                ZONE_PADDING -
                ZONE_LABEL_HEIGHT,
            )
            const bottom = Math.min(
              BOARD_HEIGHT - ZONE_MARGIN,
              Math.max(...ys) + NODE_HEIGHT / 2 + ZONE_PADDING,
            )
            return Option.some({
              region,
              x: left,
              y: top,
              width: right - left,
              height: bottom - top,
            })
          },
        },
      ),
    ),
  )

export const zoneAt = (
  zones: ReadonlyArray<Zone>,
  point: Point,
): Option.Option<Zone> =>
  Array.findFirst(
    zones,
    zone =>
      point.x >= zone.x &&
      point.x <= zone.x + zone.width &&
      point.y >= zone.y &&
      point.y <= zone.y + zone.height,
  )
