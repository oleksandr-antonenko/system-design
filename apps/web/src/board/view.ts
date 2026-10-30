import { Array, Option, Result, pipe } from 'effect'
import { Canvas, Submodel } from 'foldkit'
import { type Html, type HtmlBuilder } from 'foldkit/html'

import {
  type BoardDoc,
  type BoardNode,
  BoardOp,
  applyOp,
  edgeKey,
  isRegionDown,
} from '../domain/board'
import {
  type ComponentKind,
  catalog,
  componentName,
  hasFiniteCapacity,
  isSink,
} from '../domain/catalog'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  type Curve,
  NODE_HEIGHT,
  NODE_WIDTH,
  type Point,
  type Zone,
  curveLength,
  curvePath,
  edgeCurve,
  pointOnCurve,
  regionZones,
} from '../domain/geometry'
import type { SimResult } from '../domain/simulate'
import type { Locale } from '../i18n/locale'
import { type UiStrings, uiFor } from '../i18n/ui'
import type { Tone } from '../kinds/contract'
import { Gesture, Message, type Model, Selection, previewDoc } from './board'
import { BoardPointer } from './pointer'

export type BoardFlows = Readonly<{
  clock: number
  nodeUtil: Readonly<Record<string, number>>
  nodeIncoming: Readonly<Record<string, number>>
  edgeFlow: Readonly<Record<string, number>>
}>

export type GhostPlan = Readonly<{
  nodes: ReadonlyArray<Readonly<{ kind: ComponentKind; x: number; y: number }>>
  edges: ReadonlyArray<Readonly<{ from: Point; to: Point }>>
  removeEdges: ReadonlyArray<string>
}>

export type LaterKind = Readonly<{ kind: ComponentKind; lesson: number }>

/** Квиз «выберите блок» (`PickDevice`): кандидаты, выбор и ответ. */
export type BoardPick = Readonly<{
  candidates: ReadonlyArray<string>
  maybePicked: Option.Option<string>
  maybeAnswer: Option.Option<string>
  tags: Readonly<Record<string, string>>
  hidden: ReadonlyArray<string>
}>

export type BoardViewInputs = Readonly<{
  locale: Locale
  doc: BoardDoc
  mode: 'View' | 'Edit' | 'Replay' | 'Pick'
  palette: ReadonlyArray<ComponentKind>
  newKinds: ReadonlyArray<ComponentKind>
  later: ReadonlyArray<LaterKind>
  halos: ReadonlyArray<Readonly<{ id: string; tone: Tone }>>
  annotations: ReadonlyArray<Readonly<{ id: string; text: string; tone: Tone }>>
  focusEdges: ReadonlyArray<string>
  ghost: Option.Option<GhostPlan>
  maybeHoveredRef: Option.Option<string>
  flows: BoardFlows
  sim: SimResult
  prefersDark: boolean
  isReducedMotion: boolean
  pick?: BoardPick
}>

// ICONS

const iconPaths: Readonly<Record<ComponentKind, ReadonlyArray<string>>> = {
  client: [
    'M9 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z',
    'M2.5 20c0-4 2.9-6.5 6.5-6.5s6.5 2.5 6.5 6.5',
    'M17.5 6.4a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z',
    'M16 13.7c3.3-.3 5.6 1.9 5.6 5.3',
  ],
  server: [
    'M4.6 3.5h14.8a1.6 1.6 0 0 1 1.6 1.6v3.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 8.9V5.1a1.6 1.6 0 0 1 1.6-1.6z',
    'M4.6 13.5h14.8a1.6 1.6 0 0 1 1.6 1.6v3.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 18.9v-3.8a1.6 1.6 0 0 1 1.6-1.6z',
    'M7 7h.01M7 17h.01M11 7h6M11 17h6',
  ],
  db: [
    'M4 5.5c0-1.7 3.6-3 8-3s8 1.3 8 3s-3.6 3-8 3s-8-1.3-8-3z',
    'M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13',
    'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  ],
  lb: [
    'M5 9.4a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z',
    'M7.6 12h3.4M11 12l8.5-7M11 12h8.5M11 12l8.5 7',
    'M16.8 4.6l2.7.4-.4 2.7M16.8 19.4l2.7-.4-.4-2.7M17.3 9.8l2.2 2.2-2.2 2.2',
  ],
  cache: ['M13 2.5 4.5 13.5h7l-1 8 8.5-11h-7z'],
  cdn: [
    'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z',
    'M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18',
  ],
  queue: ['M2.5 7h5v10h-5zM9.5 7h5v10h-5zM16.5 7h5v10h-5z'],
  limiter: ['M3 4.5h18l-7 8.2v6.3l-4 2v-8.3z'],
  events: [
    'M12 10.4a1.6 1.6 0 1 1 0 3.2a1.6 1.6 0 1 1 0-3.2z',
    'M8.6 8.6a4.8 4.8 0 0 0 0 6.8M15.4 8.6a4.8 4.8 0 0 1 0 6.8',
    'M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8',
  ],
  worker: [
    'M12 8.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z',
    'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  ],
  replica: [
    'M3 5c0-1.4 2.7-2.5 6-2.5s6 1.1 6 2.5s-2.7 2.5-6 2.5s-6-1.1-6-2.5z',
    'M3 5v10c0 1.4 2.7 2.5 6 2.5M15 5v3',
    'M9 11c0-1.4 2.7-2.5 6-2.5s6 1.1 6 2.5s-2.7 2.5-6 2.5s-6-1.1-6-2.5z',
    'M9 11v8c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-8',
  ],
  search: ['M10.5 3.5a7 7 0 1 1 0 14a7 7 0 1 1 0-14z', 'M15.6 15.6l5.4 5.4'],
}

const iconView = (kind: ComponentKind, h: HtmlBuilder<Message>): Html =>
  h.g(
    [h.Class('board-icon')],
    Array.map(iconPaths[kind], d => h.path([h.Attribute('d', d)])),
  )

// NODES

const isLoadHidden = (inputs: BoardViewInputs, id: string): boolean =>
  inputs.pick !== undefined &&
  (Array.contains(inputs.pick.hidden, 'load') ||
    Array.contains(inputs.pick.hidden, id))

/** Класс блока в квизе: можно выбрать, выбран неверно, верный ответ. */
const pickClass = (inputs: BoardViewInputs, id: string): string => {
  const pick = inputs.pick
  if (pick === undefined) {
    return ''
  }
  if (Option.exists(pick.maybeAnswer, answer => answer === id)) {
    return ' pick-right'
  }
  if (Option.exists(pick.maybePicked, picked => picked === id)) {
    return ' pick-wrong'
  }
  return inputs.mode === 'Pick' && Array.contains(pick.candidates, id)
    ? ' pickable'
    : ''
}

const isPickable = (inputs: BoardViewInputs, id: string): boolean =>
  inputs.mode === 'Pick' &&
  inputs.pick !== undefined &&
  Array.contains(inputs.pick.candidates, id)

const utilizationClass = (utilization: number, isDown: boolean): string =>
  isDown || utilization > 1
    ? 'util bad'
    : utilization > 0.8
      ? 'util warn'
      : 'util'

const nodeView = (
  node: BoardNode,
  inputs: BoardViewInputs,
  ui: UiStrings,
  model: Model,
  h: HtmlBuilder<Message>,
): Html => {
  const isDown = Array.contains(inputs.doc.failed, node.id)
  const incoming = inputs.flows.nodeIncoming[node.id] ?? 0
  const utilization = inputs.flows.nodeUtil[node.id] ?? 0
  const isEditable = inputs.mode === 'Edit'
  const isSelected = Option.exists(model.maybeSelection, selection =>
    Selection.match(selection, {
      Node: ({ id }) => id === node.id,
      Edge: () => false,
    }),
  )
  const isHovered = Option.exists(inputs.maybeHoveredRef, id => id === node.id)
  const connectState = Gesture.match(model.gesture, {
    Connecting: ({ from }) =>
      from === node.id
        ? ''
        : Result.isSuccess(
              applyOp(inputs.doc, BoardOp.Connect({ from, to: node.id })),
            )
          ? ' drop-ok'
          : ' drop-no',
    Idle: () => '',
    DraggingNode: () => '',
    Placing: () => '',
  })
  const isHiddenLoad = isLoadHidden(inputs, node.id)
  const hasCapacity = hasFiniteCapacity(node.kind) && !isHiddenLoad
  const flow = inputs.sim.nodes[node.id]
  const backlog = flow?.backlog ?? 0
  const rejected = flow?.rejected ?? 0
  const isGrowing =
    (node.kind === 'queue' || node.kind === 'events') && backlog >= 1
  const isRejecting = node.kind === 'limiter' && rejected >= 1
  const subText = isDown
    ? ui.board.nodeDown
    : isHiddenLoad
      ? ui.board.loadHidden
      : node.kind === 'client'
        ? ui.board.clientsLoad(incoming)
        : isGrowing
          ? ui.board.queueGrowing(backlog)
          : isRejecting
            ? ui.board.rejecting(rejected)
            : ui.board.nodeLoad(incoming, utilization)
  const classes = [
    'board-node',
    isEditable ? 'editable' : '',
    isSelected || isHovered ? 'selected' : '',
    isDown ? 'down' : '',
  ].join(' ')

  return h.keyed('g')(
    node.id,
    [
      h.DataAttribute('node', node.id),
      h.Class(`${classes}${connectState}${pickClass(inputs, node.id)}`),
      h.Transform(
        `translate(${node.x - NODE_WIDTH / 2},${node.y - NODE_HEIGHT / 2})`,
      ),
      ...(isPickable(inputs, node.id)
        ? [
            h.Role('button'),
            h.Tabindex(0),
            h.OnKeyDownPreventDefault(key =>
              key === 'Enter' || key === ' '
                ? Option.some(Message.PressedPickKey({ id: node.id }))
                : Option.none(),
            ),
          ]
        : [h.Role('img')]),
      h.AriaLabel(`${componentName[node.kind]} ${node.id}, ${subText}`),
      h.AriaDescription(ui.kindHint[node.kind]),
    ],
    [
      h.rect([
        h.Class('body'),
        h.Width(`${NODE_WIDTH}`),
        h.Height(`${NODE_HEIGHT}`),
        h.Attribute('rx', '10'),
      ]),
      h.g(
        [h.Transform(`translate(12,${hasCapacity ? 14 : 18})`)],
        [iconView(node.kind, h)],
      ),
      h.text(
        [
          h.Class('title'),
          h.Attribute('x', '46'),
          h.Attribute('y', hasCapacity ? '24' : '27'),
        ],
        [node.id === 'users' ? componentName.client : node.id],
      ),
      h.text(
        [
          h.Class(!isDown && (isGrowing || isRejecting) ? 'sub alert' : 'sub'),
          h.Attribute('x', '46'),
          h.Attribute('y', hasCapacity ? '40' : '44'),
        ],
        [subText],
      ),
      ...(hasCapacity
        ? [
            h.rect([
              h.Class('track'),
              h.Attribute('x', '12'),
              h.Attribute('y', `${NODE_HEIGHT - 11}`),
              h.Width(`${NODE_WIDTH - 24}`),
              h.Height('4'),
              h.Attribute('rx', '2'),
            ]),
            h.rect([
              h.Class(utilizationClass(utilization, isDown)),
              h.Attribute('x', '12'),
              h.Attribute('y', `${NODE_HEIGHT - 11}`),
              h.Width(
                `${((NODE_WIDTH - 24) * Math.min(utilization, 1)).toFixed(1)}`,
              ),
              h.Height('4'),
              h.Attribute('rx', '2'),
            ]),
          ]
        : []),
      ...(isDown
        ? [
            h.path([
              h.Class('xmark'),
              h.Attribute('d', `M${NODE_WIDTH - 24},10 l12,12 m0,-12 l-12,12`),
            ]),
          ]
        : []),
      ...(isEditable && !isSink(node.kind)
        ? [
            h.circle([
              h.Class('port-hit'),
              h.DataAttribute('port', node.id),
              h.Cx(`${NODE_WIDTH}`),
              h.Cy(`${NODE_HEIGHT / 2}`),
              h.Attribute('r', '18'),
            ]),
            h.circle(
              [
                h.Class('port'),
                h.DataAttribute('port', node.id),
                h.Cx(`${NODE_WIDTH}`),
                h.Cy(`${NODE_HEIGHT / 2}`),
                h.Attribute('r', '7.5'),
              ],
              [h.title([], [ui.board.connectHint])],
            ),
          ]
        : []),
    ],
  )
}

// EDGES

const curveBetween = (
  nodes: ReadonlyArray<BoardNode>,
  from: BoardNode,
  to: BoardNode,
): Curve =>
  edgeCurve(
    from,
    to,
    Array.filter(nodes, node => node.id !== from.id && node.id !== to.id),
  )

const edgeView = (
  from: BoardNode,
  to: BoardNode,
  inputs: BoardViewInputs,
  model: Model,
  removeEdges: ReadonlyArray<string>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const key = edgeKey({ from: from.id, to: to.id })
  const curve = curveBetween(inputs.doc.nodes, from, to)
  const path = curvePath(curve)
  const isSelected = Option.exists(model.maybeSelection, selection =>
    Selection.match(selection, {
      Edge: edge => edge.from === from.id && edge.to === to.id,
      Node: () => false,
    }),
  )
  const isFocused =
    Array.contains(inputs.focusEdges, key) || Array.contains(removeEdges, key)
  const flow = inputs.flows.edgeFlow[key] ?? 0
  const label =
    inputs.mode === 'Edit' ||
    flow < 1 ||
    curveLength(curve) < 110 ||
    isLoadHidden(inputs, from.id) ||
    isLoadHidden(inputs, to.id)
      ? Option.none()
      : Option.some(uiFor(inputs.locale).board.edgeFlow(flow))
  const middle = pointOnCurve(curve, 0.5)

  return [
    h.keyed('path')(`edge-${key}`, [
      h.Class(
        `board-edge${isSelected ? ' selected' : ''}${isFocused ? ' focus' : ''}`,
      ),
      h.Attribute('d', path),
      h.Attribute(
        'marker-end',
        `url(#${isSelected ? 'arrow-accent' : 'arrow'})`,
      ),
    ]),
    ...(inputs.mode === 'Edit'
      ? [
          h.keyed('path')(`hit-${key}`, [
            h.Class('board-edge-hit'),
            h.Attribute('d', path),
            h.DataAttribute('edge-from', from.id),
            h.DataAttribute('edge-to', to.id),
          ]),
        ]
      : []),
    ...Option.match(label, {
      onNone: () => [],
      onSome: text => [
        h.keyed('g')(
          `label-${key}`,
          [
            h.Class('edge-label'),
            h.Transform(`translate(${middle.x},${middle.y})`),
          ],
          [
            h.rect([
              h.Attribute('x', `${-(text.length * 6.1 + 14) / 2}`),
              h.Attribute('y', '-9'),
              h.Width(`${text.length * 6.1 + 14}`),
              h.Height('18'),
              h.Attribute('rx', '9'),
            ]),
            h.text([h.TextAnchor('middle'), h.Attribute('y', '3.5')], [text]),
          ],
        ),
      ],
    }),
  ]
}

// REGIONS

const zoneView = (
  zone: Zone,
  doc: BoardDoc,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): Html => {
  const isDown = isRegionDown(doc, zone.region)
  return h.keyed('g')(
    `zone-${zone.region}`,
    [
      h.Class(`region-zone${isDown ? ' down' : ''}`),
      h.DataAttribute('region', zone.region),
    ],
    [
      h.rect([
        h.Attribute('x', `${zone.x}`),
        h.Attribute('y', `${zone.y}`),
        h.Width(`${zone.width}`),
        h.Height(`${zone.height}`),
        h.Attribute('rx', '16'),
      ]),
      h.text(
        [
          h.Attribute('x', `${zone.x + 14}`),
          h.Attribute('y', `${zone.y + 17}`),
        ],
        [isDown ? ui.board.zoneDown(zone.region) : ui.regionName[zone.region]],
      ),
    ],
  )
}

// OVERLAYS

const haloView = (node: BoardNode, tone: Tone, h: HtmlBuilder<Message>): Html =>
  h.keyed('rect')(`halo-${node.id}`, [
    h.Class(`halo ${tone}`),
    h.Attribute('x', `${node.x - NODE_WIDTH / 2 - 7}`),
    h.Attribute('y', `${node.y - NODE_HEIGHT / 2 - 7}`),
    h.Width(`${NODE_WIDTH + 14}`),
    h.Height(`${NODE_HEIGHT + 14}`),
    h.Attribute('rx', '15'),
  ])

const annotationView = (
  node: BoardNode,
  text: string,
  tone: Tone,
  h: HtmlBuilder<Message>,
  keyPrefix = 'note',
): Html => {
  const width = text.length * 6.75 + 20
  const x = Math.min(Math.max(node.x - width / 2, 6), BOARD_WIDTH - width - 6)
  const y = node.y - NODE_HEIGHT / 2 - 34
  return h.keyed('g')(
    `${keyPrefix}-${node.id}`,
    [h.Class(`annotation ${tone}`)],
    [
      h.path([
        h.Class('stem'),
        h.Attribute(
          'd',
          `M${node.x},${y + 22} V${node.y - NODE_HEIGHT / 2 - 1}`,
        ),
      ]),
      h.rect([
        h.Attribute('x', `${x}`),
        h.Attribute('y', `${y}`),
        h.Width(`${width}`),
        h.Height('22'),
        h.Attribute('rx', '6'),
      ]),
      h.text(
        [
          h.Attribute('x', `${x + width / 2}`),
          h.Attribute('y', `${y + 15}`),
          h.TextAnchor('middle'),
        ],
        [text],
      ),
    ],
  )
}

const isAt = (node: Point, point: Point): boolean =>
  node.x === point.x && node.y === point.y

const ghostView = (
  plan: GhostPlan,
  blocks: ReadonlyArray<Point>,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  ...Array.map(plan.edges, edge =>
    h.path([
      h.Class('ghost-edge'),
      h.Attribute(
        'd',
        curvePath(
          edgeCurve(
            edge.from,
            edge.to,
            Array.filter(
              [...blocks, ...plan.nodes],
              block => !isAt(block, edge.from) && !isAt(block, edge.to),
            ),
          ),
        ),
      ),
    ]),
  ),
  ...Array.map(plan.nodes, node =>
    h.g(
      [h.Class('ghost')],
      [
        h.rect([
          h.Attribute('x', `${node.x - NODE_WIDTH / 2}`),
          h.Attribute('y', `${node.y - NODE_HEIGHT / 2}`),
          h.Width(`${NODE_WIDTH}`),
          h.Height(`${NODE_HEIGHT}`),
          h.Attribute('rx', '10'),
        ]),
        h.text(
          [
            h.Attribute('x', `${node.x}`),
            h.Attribute('y', `${node.y + 4}`),
            h.TextAnchor('middle'),
          ],
          [ui.board.ghost(node.kind)],
        ),
      ],
    ),
  ),
]

const deleteButton = (
  point: Point,
  data: ReadonlyArray<readonly [string, string]>,
  label: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.g(
    [
      h.Class('delete'),
      h.Transform(`translate(${point.x},${point.y})`),
      h.Role('button'),
      h.AriaLabel(label),
      ...Array.map(data, ([key, value]) => h.DataAttribute(key, value)),
    ],
    [
      h.title([], [label]),
      h.circle([h.Attribute('r', '10')]),
      h.path([h.Attribute('d', 'M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5')]),
    ],
  )

const selectionControls = (
  doc: BoardDoc,
  model: Model,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  Option.match(model.maybeSelection, {
    onNone: () => [],
    onSome: selection =>
      Selection.match(selection, {
        Edge: ({ from, to }) =>
          pipe(
            Option.all([
              Array.findFirst(doc.nodes, node => node.id === from),
              Array.findFirst(doc.nodes, node => node.id === to),
            ]),
            Option.match({
              onNone: () => [],
              onSome: ([fromNode, toNode]) => {
                const middle = pointOnCurve(
                  curveBetween(doc.nodes, fromNode, toNode),
                  0.5,
                )
                return [
                  deleteButton(
                    { x: middle.x, y: middle.y - 22 },
                    [
                      ['delete-from', from],
                      ['delete-to', to],
                    ],
                    ui.board.deleteEdge,
                    h,
                  ),
                ]
              },
            }),
          ),
        Node: ({ id }) =>
          pipe(
            Array.findFirst(doc.nodes, node => node.id === id && !node.locked),
            Option.match({
              onNone: () => [],
              onSome: node => [
                deleteButton(
                  {
                    x: node.x + NODE_WIDTH / 2 - 2,
                    y: node.y - NODE_HEIGHT / 2 + 2,
                  },
                  [['delete-node', id]],
                  ui.board.deleteNode,
                  h,
                ),
              ],
            }),
          ),
      }),
  })

const gestureOverlay = (
  doc: BoardDoc,
  model: Model,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  Gesture.match(model.gesture, {
    Connecting: ({ from, pointer }) =>
      pipe(
        Array.findFirst(doc.nodes, node => node.id === from),
        Option.match({
          onNone: () => [],
          onSome: node => {
            const start = { x: node.x + NODE_WIDTH / 2, y: node.y }
            const bend = Math.max(30, Math.abs(pointer.x - start.x) * 0.5)
            return [
              h.path([
                h.Class('rubber'),
                h.Attribute(
                  'd',
                  `M${start.x},${start.y} C${start.x + bend},${start.y} ${pointer.x - bend},${pointer.y} ${pointer.x},${pointer.y}`,
                ),
              ]),
            ]
          },
        }),
      ),
    Placing: ({ kind, pointer, hasMoved, isOverBoard }) =>
      hasMoved && isOverBoard
        ? ghostView(
            {
              nodes: [{ kind, x: pointer.x, y: pointer.y }],
              edges: [],
              removeEdges: [],
            },
            [],
            ui,
            h,
          )
        : [],
    Idle: () => [],
    DraggingNode: () => [],
  })

// PARTICLES

export const particleColors = (prefersDark: boolean) =>
  prefersDark
    ? {
        ok: '#3dc48b',
        warn: '#e8aa3c',
        bad: '#f2675c',
        badFade: 'rgba(242,103,92,',
        warnFade: 'rgba(232,170,60,',
      }
    : {
        ok: '#148a55',
        warn: '#c27c05',
        bad: '#cf3f36',
        badFade: 'rgba(207,63,54,',
        warnFade: 'rgba(194,124,5,',
      }

const SCALE = 2

export const particleShapes = (
  inputs: BoardViewInputs,
): ReadonlyArray<Canvas.Shape> => {
  if (inputs.isReducedMotion) {
    return []
  }
  const colors = particleColors(inputs.prefersDark)
  const nodeById = (id: string) =>
    Array.findFirst(inputs.doc.nodes, node => node.id === id)
  const flowParticles = Array.flatMap(inputs.doc.edges, edge => {
    const flow = inputs.flows.edgeFlow[edgeKey(edge)] ?? 0
    if (flow < 1) {
      return []
    }
    return pipe(
      Option.all([nodeById(edge.from), nodeById(edge.to)]),
      Option.match({
        onNone: () => [],
        onSome: ([from, to]) => {
          const curve = curveBetween(inputs.doc.nodes, from, to)
          const target = inputs.sim.nodes[to.id]
          const lostShare =
            target === undefined
              ? 0
              : target.isDown
                ? 1
                : target.incoming > 0
                  ? (target.dropped + target.rejected) / target.incoming
                  : 0
          const isHot =
            target !== undefined && !target.isDown && target.utilization > 0.85
          const count = Math.max(
            1,
            Math.min(14, Math.round(Math.sqrt(flow) / 2.1)),
          )
          return Array.makeBy(count, index => {
            const point = pointOnCurve(
              curve,
              (inputs.flows.clock * 0.42 + index / count) % 1,
            )
            const isLost = (index * 0.618) % 1 < lostShare
            return Canvas.Circle({
              x: point.x * SCALE,
              y: point.y * SCALE,
              radius: 3.4 * SCALE,
              fill: isLost ? colors.bad : isHot ? colors.warn : colors.ok,
            })
          })
        },
      }),
    )
  })
  const dropParticles = Array.flatMap(inputs.doc.nodes, node => {
    const flow = inputs.sim.nodes[node.id]
    const lost = flow === undefined ? 0 : flow.dropped + flow.rejected
    if (lost < 5) {
      return []
    }
    const count = Math.max(2, Math.min(12, Math.round(lost / 45)))
    return Array.makeBy(count, index => {
      const t = (inputs.flows.clock * 0.7 + index / count) % 1
      return Canvas.Circle({
        x:
          (node.x -
            NODE_WIDTH / 2 +
            14 +
            ((index * 0.618) % 1) * (NODE_WIDTH - 28)) *
          SCALE,
        y: (node.y + NODE_HEIGHT / 2 + 5 + t * 38) * SCALE,
        radius: 3 * SCALE,
        fill: `${colors.badFade}${(1 - t).toFixed(2)})`,
      })
    })
  })
  const backlogParticles = Array.flatMap(inputs.doc.nodes, node => {
    const backlog = inputs.sim.nodes[node.id]?.backlog ?? 0
    if (backlog < 5) {
      return []
    }
    const count = Math.max(2, Math.min(10, Math.round(Math.sqrt(backlog) / 2)))
    return Array.makeBy(count, index => {
      const t = (inputs.flows.clock * 0.35 + index / count) % 1
      return Canvas.Circle({
        x:
          (node.x -
            NODE_WIDTH / 2 +
            14 +
            ((index * 0.618) % 1) * (NODE_WIDTH - 28)) *
          SCALE,
        y: (node.y - NODE_HEIGHT / 2 - 5 - t * 26) * SCALE,
        radius: 3 * SCALE,
        fill: `${colors.warnFade}${(1 - t).toFixed(2)})`,
      })
    })
  })
  return [...flowParticles, ...dropParticles, ...backlogParticles]
}

// PALETTE

const paletteTooltip = (hint: string, note: string): string =>
  `${hint}\n${note}`

const paletteTag = (
  kind: ComponentKind,
  inputs: BoardViewInputs,
  ui: UiStrings,
): Readonly<{ text: string; isNew: boolean }> =>
  Array.contains(inputs.newKinds, kind)
    ? { text: ui.board.newBadge, isNew: true }
    : hasFiniteCapacity(kind)
      ? { text: ui.board.capacityTag(catalog[kind].capacity), isNew: false }
      : { text: '', isNew: false }

const paletteView = (
  inputs: BoardViewInputs,
  ui: UiStrings,
  h: HtmlBuilder<Message>,
): Html => {
  const isEditable = inputs.mode === 'Edit'
  return h.aside(
    [
      h.Class(`board-palette${isEditable ? '' : ' off'}`),
      h.AriaLabel(ui.board.paletteTitle),
    ],
    [
      h.div([h.Class('palette-title')], [ui.board.paletteTitle]),
      ...Array.map(inputs.palette, kind => {
        const tag = paletteTag(kind, inputs, ui)
        return h.keyed('button')(
          kind,
          [
            h.Type('button'),
            h.Class('palette-item'),
            h.DataAttribute('palette', kind),
            ...(isEditable
              ? [h.OnClick(Message.ClickedPaletteItem({ kind }))]
              : [h.Disabled(true)]),
            h.Title(
              paletteTooltip(
                ui.kindHint[kind],
                isEditable ? ui.board.paletteHint : ui.board.paletteClosed,
              ),
            ),
          ],
          [
            h.svg(
              [h.ViewBox('0 0 24 24'), h.AriaHidden(true)],
              [iconView(kind, h)],
            ),
            h.span(
              [],
              [
                h.span([h.Class('name')], [componentName[kind]]),
                h.span([h.Class(tag.isNew ? 'tag new' : 'tag')], [tag.text]),
              ],
            ),
          ],
        )
      }),
      ...(isEditable
        ? []
        : [h.p([h.Class('palette-note')], [ui.board.paletteClosed])]),
      ...Array.match(inputs.later, {
        onEmpty: () => [],
        onNonEmpty: later => [
          h.div([h.Class('palette-title')], [ui.board.laterTitle]),
          ...Array.map(later, ({ kind, lesson }) =>
            h.keyed('button')(
              `later-${kind}`,
              [
                h.Type('button'),
                h.Class('palette-item locked'),
                h.Disabled(true),
                h.Title(ui.kindHint[kind]),
              ],
              [
                h.svg(
                  [h.ViewBox('0 0 24 24'), h.AriaHidden(true)],
                  [iconView(kind, h)],
                ),
                h.span(
                  [],
                  [
                    h.span([h.Class('name')], [componentName[kind]]),
                    h.span(
                      [h.Class('tag')],
                      [ui.board.lockedUntilLesson(lesson)],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      }),
    ],
  )
}

// QUIZ

/** Метки квиза у выбранного блока и у верного ответа. */
const pickTags = (
  inputs: BoardViewInputs,
  nodeById: (id: string) => Option.Option<BoardNode>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const pick = inputs.pick
  if (pick === undefined) {
    return []
  }
  const tagged = (
    maybeId: Option.Option<string>,
    tone: Tone,
  ): ReadonlyArray<Html> =>
    Option.match(
      Option.flatMap(maybeId, id =>
        Option.all([nodeById(id), Option.fromNullishOr(pick.tags[id])]),
      ),
      {
        onNone: () => [],
        onSome: ([node, text]) => [annotationView(node, text, tone, h, 'tag')],
      },
    )
  const wrongPick = Option.filter(
    pick.maybePicked,
    picked => !Option.exists(pick.maybeAnswer, answer => answer === picked),
  )
  return [...tagged(wrongPick, 'bad'), ...tagged(pick.maybeAnswer, 'ok')]
}

// BOARD

export const view = Submodel.defineView<Model, Message, BoardViewInputs>(
  (model, inputs, h) => {
    const ui = uiFor(inputs.locale)
    const doc = previewDoc(inputs.doc, model.gesture)
    const nodeById = (id: string) =>
      Array.findFirst(doc.nodes, node => node.id === id)
    const removeEdges = Option.match(inputs.ghost, {
      onNone: () => [],
      onSome: plan => plan.removeEdges,
    })
    const modeLabel =
      inputs.mode === 'Edit'
        ? ui.board.modeEdit
        : inputs.mode === 'Replay'
          ? ui.board.modeReplay
          : inputs.mode === 'Pick'
            ? ui.board.modePick
            : ui.board.modeView

    return h.div(
      [h.Class('board-wrap'), h.OnMount(BoardPointer())],
      [
        paletteView(inputs, ui, h),
        h.div(
          [h.Class('board-scroll')],
          [
            h.div(
              [h.Class('board-stage board-surface')],
              [
                Canvas.view(
                  {
                    width: BOARD_WIDTH * SCALE,
                    height: BOARD_HEIGHT * SCALE,
                    shapes: particleShapes({ ...inputs, doc }),
                    className: 'board-particles',
                  },
                  h,
                ),
                h.svg(
                  [
                    h.DataAttribute('board', 'true'),
                    h.ViewBox(`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`),
                    h.Attribute('preserveAspectRatio', 'xMidYMid meet'),
                    h.AriaLabel(ui.board.label),
                    h.Class('board-svg'),
                  ],
                  [
                    h.defs(
                      [],
                      [
                        h.marker(
                          [
                            h.Id('arrow'),
                            h.ViewBox('0 0 10 10'),
                            h.Attribute('refX', '9'),
                            h.Attribute('refY', '5'),
                            h.Attribute('markerWidth', '10'),
                            h.Attribute('markerHeight', '10'),
                            h.Attribute('markerUnits', 'userSpaceOnUse'),
                            h.Attribute('orient', 'auto'),
                          ],
                          [
                            h.path([
                              h.Class('arrow-head'),
                              h.Attribute('d', 'M0,1 L10,5 L0,9 z'),
                            ]),
                          ],
                        ),
                        h.marker(
                          [
                            h.Id('arrow-accent'),
                            h.ViewBox('0 0 10 10'),
                            h.Attribute('refX', '9'),
                            h.Attribute('refY', '5'),
                            h.Attribute('markerWidth', '10'),
                            h.Attribute('markerHeight', '10'),
                            h.Attribute('markerUnits', 'userSpaceOnUse'),
                            h.Attribute('orient', 'auto'),
                          ],
                          [
                            h.path([
                              h.Class('arrow-head accent'),
                              h.Attribute('d', 'M0,1 L10,5 L0,9 z'),
                            ]),
                          ],
                        ),
                      ],
                    ),
                    ...Array.map(regionZones(doc.nodes), zone =>
                      zoneView(zone, doc, ui, h),
                    ),
                    ...Array.getSomes(
                      Array.map(inputs.halos, ({ id, tone }) =>
                        Option.map(nodeById(id), node =>
                          haloView(node, tone, h),
                        ),
                      ),
                    ),
                    ...Array.flatMap(doc.edges, edge =>
                      Option.match(
                        Option.all([nodeById(edge.from), nodeById(edge.to)]),
                        {
                          onNone: () => [],
                          onSome: ([from, to]) =>
                            edgeView(
                              from,
                              to,
                              { ...inputs, doc },
                              model,
                              removeEdges,
                              h,
                            ),
                        },
                      ),
                    ),
                    ...Option.match(inputs.ghost, {
                      onNone: () => [],
                      onSome: plan => ghostView(plan, doc.nodes, ui, h),
                    }),
                    ...Array.map(doc.nodes, node =>
                      nodeView(node, { ...inputs, doc }, ui, model, h),
                    ),
                    ...Array.getSomes(
                      Array.map(inputs.annotations, ({ id, text, tone }) =>
                        Option.map(nodeById(id), node =>
                          annotationView(node, text, tone, h),
                        ),
                      ),
                    ),
                    ...pickTags(inputs, nodeById, h),
                    ...(inputs.mode === 'Edit'
                      ? selectionControls(doc, model, ui, h)
                      : []),
                    ...gestureOverlay(doc, model, ui, h),
                  ],
                ),
                h.div(
                  [
                    h.Class(
                      `mode-chip${inputs.mode === 'Edit' ? ' edit' : ''}`,
                    ),
                  ],
                  [modeLabel],
                ),
              ],
            ),
          ],
        ),
      ],
    )
  },
)
