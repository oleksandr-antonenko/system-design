import { Array, Option, Order, Record, pipe } from 'effect'

import { isL3Boundary, linksOf, otherEnd, reach } from '../../net/doc'
import {
  type Band,
  type Device,
  type DeviceId,
  type DeviceKind,
  type Link,
  type NetDoc,
  type Wall,
  kindOf,
} from '../../net/model'
import { associationOf, radioDistance, wifiOf } from '../../net/topology'
import { bandsOf, rangeOf, signalBars, wifiRules } from '../../net/wifi'
import type { Room } from './dsl'

// Геометрия доски сетей (design D2 add-network-board): где стоят устройства,
// зоны, облако «Интернет» и связи. Координаты документа — поле макета урока 1
// (960 × 600). На узком экране доска раскладывается сверху вниз: x и y
// меняются местами и сжимаются, чтобы подписи остались читаемыми.

// METRICS

export type Point = Readonly<{ x: number; y: number }>

type Metrics = Readonly<{
  nodeHeight: number
  minNodeWidth: number
  charWidth: number
  textInset: number
  cloud: Readonly<{ rx: number; ry: number }>
  /** Масштаб по осям документа: x и y на узком экране — это y и x. */
  alongX: number
  alongY: number
  minWidth: number
  minHeight: number
}>

const WIDE: Metrics = {
  nodeHeight: 54,
  minNodeWidth: 150,
  charWidth: 7.6,
  textInset: 44,
  cloud: { rx: 128, ry: 96 },
  alongX: 1,
  alongY: 1,
  minWidth: 760,
  minHeight: 480,
}

const NARROW: Metrics = {
  nodeHeight: 46,
  minNodeWidth: 112,
  charWidth: 6.6,
  textInset: 36,
  cloud: { rx: 116, ry: 70 },
  alongX: 0.62,
  alongY: 0.95,
  minWidth: 380,
  minHeight: 460,
}

export const metricsFor = (isNarrow: boolean): Metrics =>
  isNarrow ? NARROW : WIDE

/** Точка документа на доске: на узком экране оси меняются местами. */
export const placeWith =
  (isNarrow: boolean) =>
  (point: Point): Point =>
    isNarrow
      ? { x: point.y * NARROW.alongY, y: point.x * NARROW.alongX }
      : point

// INPUT

/** `hint` — всплывающая подсказка и доступное описание устройства: его
    английское имя вида с родным названием и пояснением. */
export type NodeText = Readonly<{ title: string; sub: string; hint: string }>

export type LayoutInput = Readonly<{
  doc: NetDoc
  unlocked: ReadonlyArray<string>
  isNarrow: boolean
  /** Облако раскрыто: сценой шага или нажатием. */
  isCloudOpen: boolean
  /** Туман: видны только эти устройства. */
  maybeFog: Option.Option<ReadonlyArray<DeviceId>>
  rooms: ReadonlyArray<Room>
  /** Устройства в пути (`walk`) или в руке ученика: координаты документа. */
  moved: Readonly<Record<DeviceId, Point>>
  text: (id: DeviceId) => NodeText
  /** Сколько места оставить под устройством: строки черновика сцены. */
  below?: Readonly<Record<DeviceId, number>>
}>

// SHAPES

export type NodeBox = Readonly<{
  id: DeviceId
  kind: DeviceKind
  x: number
  y: number
  w: number
  h: number
  text: NodeText
}>

export type ZoneKind = 'home' | 'cafe' | 'office' | 'docker' | 'plan'

export type ZoneBox = Readonly<{
  id: string
  kind: ZoneKind
  x: number
  y: number
  w: number
  h: number
  roof: number
  members: ReadonlyArray<DeviceId>
}>

export type Ellipse = Readonly<{ x: number; y: number; rx: number; ry: number }>

/** Сеть внутри раскрытого облака урока 1: картинка, а не устройство. */
export type InnerNet = Readonly<{ id: string; x: number; y: number }>

export type CloudShape = Readonly<{
  id: string
  maybeDevice: Option.Option<DeviceId>
  x: number
  y: number
  rx: number
  ry: number
  isOpen: boolean
  bumps: ReadonlyArray<Ellipse>
  inner: ReadonlyArray<InnerNet>
  innerLinks: ReadonlyArray<readonly [string, string]>
}>

export type LinkShape = Readonly<{
  id: string
  a: DeviceId
  b: DeviceId
  medium: Link['medium'] | 'tunnel'
  d: string
  from: Point
  to: Point
  isUp: boolean
  /** Радио подключено (у кабеля — всегда). */
  isActive: boolean
  maybeBand: Option.Option<Band>
}>

export type Ring = Readonly<{ device: DeviceId; band: Band; d: string }>

export type Bars = Readonly<{ device: DeviceId; bars: number; band: Band }>

export type Layout = Readonly<{
  isNarrow: boolean
  viewBox: Readonly<{ x: number; y: number; w: number; h: number }>
  nodes: ReadonlyArray<NodeBox>
  zones: ReadonlyArray<ZoneBox>
  maybeCloud: Option.Option<CloudShape>
  links: ReadonlyArray<LinkShape>
  /** Устройства, спрятанные в свёрнутом облаке. */
  inCloud: ReadonlyArray<DeviceId>
  walls: ReadonlyArray<Wall>
  rooms: ReadonlyArray<Room>
  rings: ReadonlyArray<Ring>
  bars: ReadonlyArray<Bars>
  place: (point: Point) => Point
}>

// DEVICES

const isUnlocked = (input: LayoutInput, feature: string): boolean =>
  Array.contains(input.unlocked, feature)

const positionOf = (input: LayoutInput, device: Device): Point =>
  input.moved[device.id] ?? { x: device.x, y: device.y }

const withPositions = (input: LayoutInput): NetDoc =>
  Record.isEmptyRecord(input.moved)
    ? input.doc
    : {
        devices: Array.map(input.doc.devices, device => {
          const moved = input.moved[device.id]
          return moved === undefined
            ? device
            : { ...device, x: moved.x, y: moved.y }
        }),
        links: input.doc.links,
        walls: input.doc.walls,
      }

const isTransit = (device: Device): boolean => device._tag === 'Transit'

/** Справочная и другие узлы, у которых все связи ведут к транзиту: они
    внутри облака и видны, только когда облако раскрыто. */
const isInsideCloud = (doc: NetDoc, device: Device): boolean =>
  isTransit(device) ||
  (device._tag === 'Host' &&
    kindOf(device) === 'resolver' &&
    Array.isReadonlyArrayNonEmpty(linksOf(doc, device.id)) &&
    Array.every(linksOf(doc, device.id), link =>
      Array.some(
        doc.devices,
        peer => peer.id === otherEnd(link, device.id) && isTransit(peer),
      ),
    ))

/** Устройство рисуется на доске (облако «Интернет» — отдельной фигурой). */
const isDrawable = (input: LayoutInput, device: Device): boolean =>
  device._tag !== 'Internet' &&
  !(device._tag === 'AccessPoint' && !device.onBoard) &&
  (kindOf(device) !== 'resolver' ||
    isInsideCloud(input.doc, device) ||
    isUnlocked(input, 'board.dnsServer')) &&
  Option.match(input.maybeFog, {
    onNone: () => true,
    onSome: visible => Array.contains(visible, device.id),
  })

const nodeWidth = (metrics: Metrics, text: NodeText): number =>
  Math.max(
    metrics.minNodeWidth,
    Math.round(
      metrics.textInset +
        Math.max(text.title.length, text.sub.length) * metrics.charWidth +
        14,
    ),
  )

// ZONES

const ZONE_PAD_X = 22
const ZONE_PAD_TOP = 34
const ZONE_PAD_BOTTOM = 26

const lanMembers = (doc: NetDoc, id: DeviceId): ReadonlyArray<DeviceId> =>
  reach(id, current =>
    pipe(
      linksOf(doc, current),
      Array.filter(link => !isL3Boundary(doc, link)),
      Array.map(link => otherEnd(link, current)),
      Array.filter(peer =>
        Array.some(
          doc.devices,
          device =>
            device.id === peer &&
            device._tag !== 'Router' &&
            device._tag !== 'Transit' &&
            device._tag !== 'Internet',
        ),
      ),
    ),
  )

const zoneKindOf = (device: Device): ZoneKind =>
  device._tag === 'Router' && Option.isSome(device.maybeVpnServer)
    ? 'office'
    : Option.exists(wifiOf(device), wifi => wifi.security === 'open')
      ? 'cafe'
      : 'home'

const isLoose = (doc: NetDoc, device: Device): boolean =>
  (device._tag === 'Host' || device._tag === 'Switch') &&
  Array.isReadonlyArrayEmpty(linksOf(doc, device.id))

const LOOSE_REACH = 360

/** Устройство без связей — в зоне ближайшего роутера, если тот рядом. */
const looseMembers = (
  doc: NetDoc,
  routers: ReadonlyArray<Device>,
  router: Device,
): ReadonlyArray<DeviceId> =>
  pipe(
    doc.devices,
    Array.filter(device => isLoose(doc, device)),
    Array.filter(device => {
      const distanceTo = (other: Device) =>
        Math.hypot(other.x - device.x, other.y - device.y)
      const nearest = Array.reduce(
        routers,
        Option.none<Device>(),
        (best, candidate) =>
          Option.exists(
            best,
            current => distanceTo(current) <= distanceTo(candidate),
          )
            ? best
            : Option.some(candidate),
      )
      return (
        Option.exists(nearest, found => found.id === router.id) &&
        distanceTo(router) <= LOOSE_REACH
      )
    }),
    Array.map(device => device.id),
  )

const boxAround = (
  nodes: ReadonlyArray<NodeBox>,
): Option.Option<Readonly<{ x: number; y: number; w: number; h: number }>> =>
  Array.match(nodes, {
    onEmpty: () => Option.none(),
    onNonEmpty: all => {
      const left = Math.min(...Array.map(all, node => node.x - node.w / 2))
      const right = Math.max(...Array.map(all, node => node.x + node.w / 2))
      const top = Math.min(...Array.map(all, node => node.y - node.h / 2))
      const bottom = Math.max(...Array.map(all, node => node.y + node.h / 2))
      return Option.some({
        x: left - ZONE_PAD_X,
        y: top - ZONE_PAD_TOP,
        w: right - left + ZONE_PAD_X * 2,
        h: bottom - top + ZONE_PAD_TOP + ZONE_PAD_BOTTOM,
      })
    },
  })

const zonesOf = (
  input: LayoutInput,
  nodes: ReadonlyArray<NodeBox>,
  isPlan: boolean,
): ReadonlyArray<ZoneBox> => {
  const { doc } = input
  const routers = Array.filter(doc.devices, device => device._tag === 'Router')
  const nodeOf = (id: DeviceId) =>
    Array.findFirst(nodes, node => node.id === id)
  const lanZones = Array.getSomes(
    Array.map(routers, router => {
      const members = Array.dedupe([
        ...lanMembers(doc, router.id),
        ...looseMembers(doc, routers, router),
      ])
      const kind = zoneKindOf(router)
      return Option.map(
        boxAround(Array.getSomes(Array.map(members, nodeOf))),
        (box): ZoneBox => ({
          id: router.id,
          kind: isPlan && kind === 'home' ? 'plan' : kind,
          ...box,
          roof: kind === 'home' && !isPlan ? Math.min(56, box.w / 6) : 0,
          members,
        }),
      )
    }),
  )
  const dockerZones = isUnlocked(input, 'board.dockerHost')
    ? Array.getSomes(
        Array.map(
          Array.filter(
            doc.devices,
            device =>
              device._tag === 'Host' && Option.isSome(device.maybeDocker),
          ),
          dockerHost => {
            const members = [
              dockerHost.id,
              ...Array.map(
                Array.filter(
                  doc.devices,
                  device =>
                    device._tag === 'Host' &&
                    Option.exists(
                      device.maybeContainer,
                      info => info.host === dockerHost.id,
                    ),
                ),
                device => device.id,
              ),
            ]
            return Option.map(
              boxAround(Array.getSomes(Array.map(members, nodeOf))),
              (box): ZoneBox => ({
                id: dockerHost.id,
                kind: 'docker',
                ...box,
                roof: 0,
                members,
              }),
            )
          },
        ),
      )
    : []
  return [...lanZones, ...dockerZones]
}

// CLOUD

/** Облако — объединение эллипсов в единицах rx = 100, ry = 70 (макет). */
const BUMPS: ReadonlyArray<readonly [number, number, number]> = [
  [-58, 18, 36],
  [-20, -16, 46],
  [32, -12, 42],
  [66, 18, 32],
  [6, 24, 40],
]

const INNER: ReadonlyArray<readonly [string, number, number]> = [
  ['~a', -0.6, 0.18],
  ['~b', -0.18, 0.5],
  ['~c', -0.16, -0.36],
  ['~d', 0.3, 0.28],
  ['~e', 0.64, -0.04],
]

const INNER_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['~a', '~b'],
  ['~a', '~c'],
  ['~b', '~d'],
  ['~c', '~d'],
  ['~c', '~e'],
  ['~d', '~e'],
]

export const isInnerNet = (id: string): boolean => id.startsWith('~')

const CLOUD_PAD = 30

const cloudOf = (
  input: LayoutInput,
  internal: ReadonlyArray<NodeBox>,
  place: (point: Point) => Point,
  metrics: Metrics,
): Option.Option<CloudShape> => {
  const internetDevice = Array.findFirst(
    input.doc.devices,
    device => device._tag === 'Internet',
  )
  const hasTransit = Array.some(input.doc.devices, isTransit)
  if (Option.isNone(internetDevice) && !hasTransit) {
    return Option.none()
  }
  const centre = Option.match(internetDevice, {
    onSome: device => place(positionOf(input, device)),
    onNone: () =>
      Option.match(boxAround(internal), {
        onNone: () => ({ x: 0, y: 0 }),
        onSome: box => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 }),
      }),
  })
  const span = Option.match(boxAround(internal), {
    onNone: () => metrics.cloud,
    onSome: box =>
      input.isCloudOpen
        ? {
            rx: Math.max(metrics.cloud.rx, box.w / 2 + CLOUD_PAD),
            ry: Math.max(metrics.cloud.ry, box.h / 2 + CLOUD_PAD),
          }
        : metrics.cloud,
  })
  const sx = span.rx / 100
  const sy = span.ry / 70
  const flip = (fx: number, fy: number) =>
    input.isNarrow ? ([fy, fx] as const) : ([fx, fy] as const)
  const isDecorative = input.isCloudOpen && Array.isReadonlyArrayEmpty(internal)
  return Option.some({
    id: Option.match(internetDevice, {
      onNone: () => 'internet',
      onSome: device => device.id,
    }),
    maybeDevice: Option.map(internetDevice, device => device.id),
    x: centre.x,
    y: centre.y,
    rx: span.rx,
    ry: span.ry,
    isOpen: input.isCloudOpen,
    bumps: Array.map(BUMPS, ([bx, by, r]) => ({
      x: centre.x + bx * sx,
      y: centre.y + by * sy,
      rx: r * sx,
      ry: r * sy,
    })),
    inner: isDecorative
      ? Array.map(INNER, ([id, fx, fy]) => {
          const [ox, oy] = flip(fx, fy)
          return {
            id,
            x: centre.x + ox * span.rx * 0.95,
            y: centre.y + oy * span.ry * 0.85,
          }
        })
      : [],
    innerLinks: isDecorative ? INNER_LINKS : [],
  })
}

// LINK PATHS

const fixed = (value: number): string => value.toFixed(1)

const pointText = (point: Point): string =>
  `${fixed(point.x)},${fixed(point.y)}`

/** Волна радио между двумя точками (макет урока 1). */
export const wavePath = (from: Point, to: Point): string => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.max(Math.hypot(dx, dy), 1)
  const ux = dx / length
  const uy = dy / length
  const points = Array.map(
    Array.makeBy(Math.max(1, Math.floor(length / 2)), index => index * 2),
    distance => {
      const offset =
        4 *
        Math.min(1, distance / 10, (length - distance) / 10) *
        Math.sin((2 * Math.PI * distance) / 13)
      return pointText({
        x: from.x + ux * distance - uy * offset,
        y: from.y + uy * distance + ux * offset,
      })
    },
  )
  return `M${[...points, pointText(to)].join(' L')}`
}

/** Двойная линия туннеля: две параллельные прямые. */
export const doublePath = (from: Point, to: Point, gap = 3): string => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.max(Math.hypot(dx, dy), 1)
  const nx = (-dy / length) * gap
  const ny = (dx / length) * gap
  return `M${pointText({ x: from.x + nx, y: from.y + ny })} L${pointText({ x: to.x + nx, y: to.y + ny })} M${pointText({ x: from.x - nx, y: from.y - ny })} L${pointText({ x: to.x - nx, y: to.y - ny })}`
}

const linePath = (from: Point, to: Point): string =>
  `M${pointText(from)} L${pointText(to)}`

// LAYOUT

export type Shape =
  | Readonly<{ _tag: 'Box'; node: NodeBox }>
  | Readonly<{ _tag: 'Cloud'; cloud: CloudShape }>
  | Readonly<{ _tag: 'Inner'; inner: InnerNet }>

/** Край фигуры в сторону точки: прямоугольник устройства или эллипс облака. */
export const edgeToward = (shape: Shape, toward: Point, pad = 3): Point => {
  const centre =
    shape._tag === 'Box'
      ? { x: shape.node.x, y: shape.node.y }
      : shape._tag === 'Cloud'
        ? { x: shape.cloud.x, y: shape.cloud.y }
        : { x: shape.inner.x, y: shape.inner.y }
  const dx = toward.x - centre.x
  const dy = toward.y - centre.y
  if (dx === 0 && dy === 0) {
    return centre
  }
  if (shape._tag === 'Box') {
    const k = Math.min(
      (shape.node.w / 2 + pad) / Math.max(Math.abs(dx), 1e-9),
      (shape.node.h / 2 + pad) / Math.max(Math.abs(dy), 1e-9),
    )
    return { x: centre.x + dx * k, y: centre.y + dy * k }
  }
  if (shape._tag === 'Inner') {
    const distance = Math.hypot(dx, dy)
    return {
      x: centre.x + (dx / distance) * (12 + pad),
      y: centre.y + (dy / distance) * (12 + pad),
    }
  }
  const k =
    1 /
    Math.sqrt(
      (dx / (shape.cloud.rx * 0.98)) ** 2 + (dy / (shape.cloud.ry * 0.98)) ** 2,
    )
  return { x: centre.x + dx * k, y: centre.y + dy * k }
}

export const shapeOf = (layout: Layout, id: string): Option.Option<Shape> =>
  pipe(
    Array.findFirst(layout.nodes, node => node.id === id),
    Option.map((node): Shape => ({ _tag: 'Box', node })),
    Option.orElse(() =>
      Option.flatMap(layout.maybeCloud, cloud =>
        cloud.id === id
          ? Option.some<Shape>({ _tag: 'Cloud', cloud })
          : Option.map(
              Array.findFirst(cloud.inner, inner => inner.id === id),
              (inner): Shape => ({ _tag: 'Inner', inner }),
            ),
      ),
    ),
  )

export const centreOf = (shape: Shape): Point =>
  shape._tag === 'Box'
    ? { x: shape.node.x, y: shape.node.y }
    : shape._tag === 'Cloud'
      ? { x: shape.cloud.x, y: shape.cloud.y }
      : { x: shape.inner.x, y: shape.inner.y }

/** Где стоит конверт у фигуры: над ней, чтобы не закрывать подпись. */
export const anchorOf = (
  layout: Layout,
  id: string,
): Option.Option<Readonly<{ x: number; y: number; scale: number }>> =>
  Option.map(shapeOf(layout, id), shape =>
    shape._tag === 'Box'
      ? { x: shape.node.x, y: shape.node.y - shape.node.h / 2 - 26, scale: 1 }
      : shape._tag === 'Cloud'
        ? {
            x: shape.cloud.x,
            y:
              shape.cloud.y -
              shape.cloud.ry * (shape.cloud.isOpen ? 0.2 : 0.42),
            scale: 0.85,
          }
        : { x: shape.inner.x, y: shape.inner.y - 26, scale: 0.72 },
  )

/** Фигура, которая видна вместо устройства: само устройство или облако,
    если устройство спрятано в нём. */
export const visibleIdOf = (
  layout: Layout,
  id: DeviceId,
): Option.Option<string> =>
  Array.contains(layout.inCloud, id)
    ? Option.map(layout.maybeCloud, cloud => cloud.id)
    : Option.isSome(shapeOf(layout, id))
      ? Option.some(id)
      : Option.none()

const RING_RAYS = 72

/** Граница дальности диапазона со стенами: вдоль каждого луча расстояние
    плюс штраф стен не больше дальности. */
const ringPath = (
  doc: NetDoc,
  centre: Point,
  band: Band,
  place: (point: Point) => Point,
): string => {
  const range = rangeOf(band)
  const points = Array.makeBy(RING_RAYS, index => {
    const angle = (index / RING_RAYS) * 2 * Math.PI
    const ux = Math.cos(angle)
    const uy = Math.sin(angle)
    const crossings = pipe(
      doc.walls,
      Array.map(wall => {
        const wx = wall.x2 - wall.x1
        const wy = wall.y2 - wall.y1
        const denominator = ux * wy - uy * wx
        if (Math.abs(denominator) < 1e-9) {
          return Option.none<number>()
        }
        const t =
          ((wall.x1 - centre.x) * wy - (wall.y1 - centre.y) * wx) / denominator
        const s =
          ((wall.x1 - centre.x) * uy - (wall.y1 - centre.y) * ux) / denominator
        return t > 0 && s >= 0 && s <= 1 ? Option.some(t) : Option.none()
      }),
      Array.getSomes,
      Array.sort(Order.Number),
    )
    const radius = Array.reduce(
      crossings,
      { radius: range, walls: 0 },
      (current, distance) =>
        distance < current.radius
          ? {
              radius: Math.max(
                distance,
                range - (current.walls + 1) * wifiRules.wallPenalty,
              ),
              walls: current.walls + 1,
            }
          : current,
    ).radius
    return place({ x: centre.x + ux * radius, y: centre.y + uy * radius })
  })
  return `M${Array.map(points, pointText).join(' L')} Z`
}

export const layoutBoard = (input: LayoutInput): Layout => {
  const metrics = metricsFor(input.isNarrow)
  const place = placeWith(input.isNarrow)
  const doc = withPositions(input)
  const internalIds = Array.map(
    Array.filter(doc.devices, device => isInsideCloud(doc, device)),
    device => device.id,
  )
  const boxOf = (device: Device): NodeBox => {
    const text = input.text(device.id)
    const point = place(positionOf(input, device))
    return {
      id: device.id,
      kind: kindOf(device),
      x: point.x,
      y: point.y,
      w: nodeWidth(metrics, text),
      h: metrics.nodeHeight,
      text,
    }
  }
  const drawable = Array.filter(doc.devices, device =>
    isDrawable(input, device),
  )
  const internal = Array.map(
    Array.filter(drawable, device => Array.contains(internalIds, device.id)),
    boxOf,
  )
  const inCloud = input.isCloudOpen ? [] : Array.map(internal, node => node.id)
  const nodes = Array.map(
    Array.filter(drawable, device => !Array.contains(inCloud, device.id)),
    boxOf,
  )
  const isPlan =
    isUnlocked(input, 'board.floorPlan') &&
    Array.isReadonlyArrayNonEmpty(doc.walls)
  const planXs = [
    ...Array.flatMap(doc.walls, wall => [
      place({ x: wall.x1, y: wall.y1 }),
      place({ x: wall.x2, y: wall.y2 }),
    ]),
    ...Array.flatMap(input.rooms, room => [
      place({ x: room.x, y: room.y }),
      place({ x: room.x + room.width, y: room.y + room.height }),
    ]),
  ]
  const zones = Array.map(zonesOf(input, nodes, isPlan), zone =>
    zone.kind !== 'plan' || Array.isReadonlyArrayEmpty(planXs)
      ? zone
      : (() => {
          const left = Math.min(zone.x, ...Array.map(planXs, point => point.x))
          const top = Math.min(zone.y, ...Array.map(planXs, point => point.y))
          const right = Math.max(
            zone.x + zone.w,
            ...Array.map(planXs, point => point.x),
          )
          const bottom = Math.max(
            zone.y + zone.h,
            ...Array.map(planXs, point => point.y),
          )
          return { ...zone, x: left, y: top, w: right - left, h: bottom - top }
        })(),
  )
  const maybeCloud = cloudOf(input, internal, place, metrics)
  const partial: Layout = {
    isNarrow: input.isNarrow,
    viewBox: { x: 0, y: 0, w: 0, h: 0 },
    nodes,
    zones,
    maybeCloud,
    links: [],
    inCloud,
    walls: Array.map(doc.walls, wall => {
      const from = place({ x: wall.x1, y: wall.y1 })
      const to = place({ x: wall.x2, y: wall.y2 })
      return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
    }),
    rooms: Array.map(input.rooms, room => {
      const corner = place({ x: room.x, y: room.y })
      const opposite = place({
        x: room.x + room.width,
        y: room.y + room.height,
      })
      return {
        ...room,
        x: Math.min(corner.x, opposite.x),
        y: Math.min(corner.y, opposite.y),
        width: Math.abs(opposite.x - corner.x),
        height: Math.abs(opposite.y - corner.y),
      }
    }),
    rings: [],
    bars: [],
    place,
  }
  const links = Array.getSomes(
    Array.map(doc.links, link => linkShape(partial, doc, link)),
  )
  const showRadio = isUnlocked(input, 'board.wifiRange') && isPlan
  const rings = showRadio
    ? Array.flatMap(doc.devices, device =>
        Option.match(wifiOf(device), {
          onNone: () => [],
          onSome: wifi =>
            device._tag === 'AccessPoint' && !device.onBoard
              ? []
              : Array.map(bandsOf(wifi.band), band => ({
                  device: device.id,
                  band,
                  d: ringPath(doc, { x: device.x, y: device.y }, band, place),
                })),
        }),
      )
    : []
  const bars = showRadio
    ? Array.getSomes(
        Array.map(doc.links, link =>
          Option.flatMap(associationOf(doc, link), association =>
            association._tag === 'Associated'
              ? Option.flatMap(
                  Option.all([
                    Array.findFirst(
                      doc.devices,
                      device => device.id === link.a,
                    ),
                    Array.findFirst(
                      doc.devices,
                      device => device.id === link.b,
                    ),
                  ]),
                  ([left, right]) => {
                    const station = left._tag === 'Host' ? left : right
                    const ap = left._tag === 'Host' ? right : left
                    return Option.some({
                      device: station.id,
                      band: association.band,
                      bars: signalBars(
                        radioDistance(doc, station, ap),
                        association.band,
                      ),
                    })
                  },
                )
              : Option.none(),
          ),
        ),
      )
    : []
  const withLinks: Layout = { ...partial, links, rings, bars }
  return {
    ...withLinks,
    viewBox: viewBoxOf(withLinks, metrics, input.below ?? {}),
  }
}

const linkShape = (
  layout: Layout,
  doc: NetDoc,
  link: Link,
): Option.Option<LinkShape> => {
  const ends = Option.all([
    Option.flatMap(visibleIdOf(layout, link.a), id => shapeOf(layout, id)),
    Option.flatMap(visibleIdOf(layout, link.b), id => shapeOf(layout, id)),
  ])
  return Option.flatMap(ends, ([left, right]) => {
    const leftCentre = centreOf(left)
    const rightCentre = centreOf(right)
    if (left._tag === 'Cloud' && right._tag === 'Cloud') {
      return Option.none()
    }
    const from = edgeToward(left, rightCentre)
    const to = edgeToward(right, leftCentre)
    const association = associationOf(doc, link)
    const isActive = Option.match(association, {
      onNone: () => true,
      onSome: found => found._tag === 'Associated',
    })
    return Option.some({
      id: link.id,
      a: link.a,
      b: link.b,
      medium: link.medium,
      d: link.medium === 'radio' ? wavePath(from, to) : linePath(from, to),
      from,
      to,
      isUp: link.up,
      isActive,
      maybeBand: Option.flatMap(association, found =>
        found._tag === 'Associated' ? Option.some(found.band) : Option.none(),
      ),
    })
  })
}

const MARGIN = 28

const viewBoxOf = (
  layout: Layout,
  metrics: Metrics,
  below: Readonly<Record<DeviceId, number>>,
): Readonly<{ x: number; y: number; w: number; h: number }> => {
  const xs = [
    ...Array.flatMap(layout.nodes, node => [
      node.x - node.w / 2,
      node.x + node.w / 2,
    ]),
    ...Array.flatMap(layout.zones, zone => [zone.x, zone.x + zone.w]),
    ...Option.match(layout.maybeCloud, {
      onNone: () => [],
      onSome: cloud => [cloud.x - cloud.rx - 14, cloud.x + cloud.rx + 14],
    }),
    ...Array.flatMap(layout.walls, wall => [wall.x1, wall.x2]),
  ]
  const ys = [
    ...Array.flatMap(layout.nodes, node => [
      node.y - node.h / 2 - 56,
      node.y + node.h / 2 + 8 + (below[node.id] ?? 0),
    ]),
    ...Array.flatMap(layout.zones, zone => [
      zone.y - zone.roof - 24,
      zone.y + zone.h,
    ]),
    ...Option.match(layout.maybeCloud, {
      onNone: () => [],
      onSome: cloud => [cloud.y - cloud.ry - 30, cloud.y + cloud.ry + 14],
    }),
    ...Array.flatMap(layout.walls, wall => [wall.y1, wall.y2]),
  ]
  if (Array.isReadonlyArrayEmpty(xs) || Array.isReadonlyArrayEmpty(ys)) {
    return { x: 0, y: 0, w: metrics.minWidth, h: metrics.minHeight }
  }
  const left = Math.min(...xs) - MARGIN
  const right = Math.max(...xs) + MARGIN
  const top = Math.min(...ys) - MARGIN
  const bottom = Math.max(...ys) + MARGIN
  const width = Math.max(right - left, metrics.minWidth)
  const height = Math.max(bottom - top, metrics.minHeight)
  return {
    x: Math.round((left + right) / 2 - width / 2),
    y: Math.round((top + bottom) / 2 - height / 2),
    w: Math.round(width),
    h: Math.round(height),
  }
}
