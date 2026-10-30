import { Array, Option, pipe } from 'effect'
import { Mount } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { scanPorts } from '../../net/answers'
import {
  type DeviceId,
  type DeviceKind,
  deviceKindName,
  kindOf,
} from '../../net/model'
import { levelOf, sourceOf } from '../../net/packet'
import { addressOf, wifiOf } from '../../net/topology'
import { isContainerUp } from '../../net/trace'
import type { BoardSlot, Tone } from '../contract'
import type { PacketTypes } from '../types'
import {
  addressesOf,
  isAddressQuestion,
  isSealed,
  isTunneled,
} from './envelope'
import { deviceIcons } from './icons'
import {
  type CloudShape,
  type LinkShape,
  type NodeBox,
  type Point,
  type ZoneBox,
  anchorOf,
  centreOf,
  doublePath,
  metricsFor,
  shapeOf,
} from './layout'
import { Message } from './message'
import { boardPanels, quizTray, stageOverlays } from './panels'
import {
  DRAFT_ROW,
  type Picture,
  deviceOf,
  draftDevice,
  pictureOf,
  shapeIdOf,
} from './picture'
import { DevicePointer } from './pointer'
import { type OwnerOf, letterOf, outerLetterOf } from './timeline'

// Доска сетей (план 3.1, макет docs/mockups/networks-lesson-1.html): дом с
// крышей, облако «Интернет», устройства со значками и подписями, связи
// (кабель — линия, радио — волна, туннель — двойная линия), конверт «от →
// кому», подсветки, подписи и выбор в квизах. Всё, что ещё не открыто
// уроком, не рисуется (план 3.4).

type Slot<ParentMessage> = BoardSlot<PacketTypes, ParentMessage>

type Draw<ParentMessage> = Readonly<{
  picture: Picture
  slot: Slot<ParentMessage>
  h: HtmlBuilder<ParentMessage>
  send: (message: Message) => ParentMessage
}>

const n = (value: number): string => value.toFixed(1)

/** Адрес «для всех» и адрес того, у кого номера ещё нет (вопрос DHCP). */
const BROADCAST = '255.255.255.255'
const UNSET = '0.0.0.0'

// KEYS

const activateKeys =
  <ParentMessage>(message: ParentMessage) =>
  (key: string): Option.Option<ParentMessage> =>
    key === 'Enter' || key === ' ' ? Option.some(message) : Option.none()

const button = <ParentMessage>(
  draw: Draw<ParentMessage>,
  label: string,
  message: ParentMessage,
) => {
  const { h } = draw
  return [
    h.Role('button'),
    h.Tabindex(0),
    h.AriaLabel(label),
    h.OnClick(message),
    h.OnKeyDownPreventDefault(activateKeys(message)),
  ]
}

// QUIZ ROLES

const isCandidate = (picture: Picture, id: string): boolean =>
  picture.context.mode === 'Pick' &&
  Option.exists(
    picture.quiz,
    marks =>
      !marks.isAnswered &&
      marks.quiz.slots.length === 0 &&
      Array.contains(marks.quiz.candidates, id),
  )

/** Сообщение выбора кандидата: один ответ — сразу, несколько — отметка. */
const candidateMessage = (picture: Picture, id: string): Message =>
  Option.exists(picture.quiz, marks => marks.quiz.multiple)
    ? Message.ToggledCandidate({ id })
    : Message.ClickedCandidate({
        id,
        playTo: firstStop(picture),
        total: picture.revealed.totalMs,
      })

/** Куда доиграть трассу после ответа: до первой паузы сцены или до конца. */
export const firstStop = (picture: Picture): number =>
  Option.getOrElse(
    Array.findFirst(picture.revealed.pauses, pause => pause > 0),
    () => picture.revealed.totalMs,
  )

// ZONES

const zoneTitle = (picture: Picture, zone: ZoneBox): string => {
  const ui = picture.context.ui.packetBoard
  return Option.match(picture.context.label(`zone:${zone.id}`), {
    onSome: label => label.name,
    onNone: () =>
      zone.kind === 'docker'
        ? ui.zone.docker(picture.name(zone.id))
        : zone.kind === 'cafe'
          ? ui.zone.cafe
          : zone.kind === 'office'
            ? ui.zone.office
            : zone.kind === 'plan'
              ? ui.zone.plan
              : ui.zone.home,
  })
}

const housePath = (zone: ZoneBox): string => {
  const r = 14
  const { x, y, w, h: height, roof } = zone
  return `M${x},${y} L${x},${y + height - r} Q${x},${y + height} ${x + r},${y + height} L${x + w - r},${y + height} Q${x + w},${y + height} ${x + w},${y + height - r} L${x + w},${y} L${x + w / 2},${y - roof} Z`
}

const zoneView = <ParentMessage>(
  draw: Draw<ParentMessage>,
  zone: ZoneBox,
): Html => {
  const { h, picture } = draw
  const isHovered = Option.exists(
    picture.context.maybeHoveredRef,
    ref => ref === `zone:${zone.id}`,
  )
  const title = zoneTitle(picture, zone)
  return h.keyed('g')(
    `zone-${zone.id}`,
    [
      h.Class(`pb-zone ${zone.kind}${isHovered ? ' ref-hover' : ''}`),
      h.DataAttribute('zone', zone.id),
    ],
    [
      zone.kind === 'home'
        ? h.path([h.Class('pb-zone-shape'), h.Attribute('d', housePath(zone))])
        : h.rect([
            h.Class('pb-zone-shape'),
            h.Attribute('x', n(zone.x)),
            h.Attribute('y', n(zone.y)),
            h.Attribute('width', n(zone.w)),
            h.Attribute('height', n(zone.h)),
            h.Attribute('rx', zone.kind === 'plan' ? '4' : '16'),
          ]),
      h.text(
        [
          h.Class('pb-zone-label'),
          h.Attribute(
            'x',
            n(zone.kind === 'home' ? zone.x + zone.w / 2 : zone.x + 12),
          ),
          h.Attribute(
            'y',
            n(zone.kind === 'home' ? zone.y - zone.roof - 8 : zone.y - 8),
          ),
          h.TextAnchor(zone.kind === 'home' ? 'middle' : 'start'),
        ],
        [title],
      ),
      ...(zone.kind === 'docker' ? doorViews(draw, zone) : []),
    ],
  )
}

const DOOR_CHAR = 6.4
const DOOR_PAD = 16
const DOOR_GAP = 8

/** Port mapping хоста Docker: «дверь» на рамке его зоны, `8080 → app:3000`,
    справа налево. На узкой доске — на нижней рамке: у верхней стоят подписи
    containers. */
const doorViews = <ParentMessage>(
  draw: Draw<ParentMessage>,
  zone: ZoneBox,
): ReadonlyArray<Html> => {
  const { h, picture } = draw
  const publishes = Option.match(deviceOf(picture, zone.id), {
    onNone: () => [],
    onSome: device => (device._tag === 'Host' ? device.publishes : []),
  })
  const doors = Array.map(publishes, publish => {
    const host =
      publish.bind === '0.0.0.0'
        ? `${publish.hostPort}`
        : `${publish.bind}:${publish.hostPort}`
    const text = `${host} → ${publish.container}:${publish.containerPort}`
    return { text, width: text.length * DOOR_CHAR + DOOR_PAD }
  })
  const right = zone.x + zone.w - 12
  const edge = picture.layout.isNarrow ? zone.y + zone.h : zone.y
  return Array.map(doors, (door, index) => {
    const end =
      right -
      Array.reduce(
        Array.take(doors, index),
        0,
        (sum, before) => sum + before.width + DOOR_GAP,
      )
    return h.g(
      [
        h.Class('pb-door'),
        h.Transform(`translate(${n(end - door.width)},${n(edge - 10)})`),
        h.Role('img'),
        h.AriaLabel(picture.context.ui.packetBoard.zone.door(door.text)),
      ],
      [
        h.rect([
          h.Attribute('width', n(door.width)),
          h.Attribute('height', '20'),
          h.Attribute('rx', '4'),
        ]),
        h.text(
          [
            h.Attribute('x', n(door.width / 2)),
            h.Attribute('y', '14'),
            h.TextAnchor('middle'),
          ],
          [door.text],
        ),
      ],
    )
  })
}

const planView = <ParentMessage>(
  draw: Draw<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, picture } = draw
  const walls = Array.map(picture.layout.walls, (wall, index) =>
    h.keyed('line')(`wall-${index}`, [
      h.Class(
        `pb-wall${
          Array.some(picture.marks, mark => mark.target === `wall:${index}`)
            ? ' hl'
            : ''
        }`,
      ),
      h.Attribute('x1', n(wall.x1)),
      h.Attribute('y1', n(wall.y1)),
      h.Attribute('x2', n(wall.x2)),
      h.Attribute('y2', n(wall.y2)),
    ]),
  )
  const rooms = Array.map(picture.layout.rooms, room =>
    h.keyed('g')(
      `room-${room.id}`,
      [
        h.Class(
          `pb-room${Option.exists(picture.context.maybeHoveredRef, ref => ref === `zone:${room.id}`) ? ' ref-hover' : ''}`,
        ),
      ],
      [
        h.rect([
          h.Attribute('x', n(room.x)),
          h.Attribute('y', n(room.y)),
          h.Attribute('width', n(room.width)),
          h.Attribute('height', n(room.height)),
        ]),
        h.text(
          [
            h.Class('pb-room-label'),
            h.Attribute('x', n(room.x + 10)),
            h.Attribute('y', n(room.y + 18)),
          ],
          [
            Option.match(picture.context.label(`zone:${room.id}`), {
              onNone: () => room.id,
              onSome: label => label.name,
            }),
          ],
        ),
      ],
    ),
  )
  const rings = Array.map(picture.layout.rings, ring =>
    h.keyed('path')(`ring-${ring.device}-${ring.band}`, [
      h.Class(`pb-ring band-${ring.band === '5' ? '5' : '24'}`),
      h.Attribute('d', ring.d),
    ]),
  )
  return [...rooms, ...rings, ...walls]
}

// CLOUD

const cloudView = <ParentMessage>(
  draw: Draw<ParentMessage>,
  cloud: CloudShape,
): Html => {
  const { h, picture, send } = draw
  const ui = picture.context.ui.packetBoard
  const label = picture.context.label(cloud.id)
  const title = Option.match(label, {
    onNone: () => deviceKindName.internet,
    onSome: found => found.name,
  })
  const hint = `${deviceKindName.internet} — ${ui.kindHint.internet}`
  const sub = cloud.isOpen
    ? ui.zone.internetOpenSub
    : Option.match(label, {
        onNone: () => ui.zone.internetSub,
        onSome: found => found.note ?? ui.zone.internetSub,
      })
  const isFlying =
    picture.moment._tag === 'Flying' &&
    (picture.moment.leg.from === cloud.id || picture.moment.leg.to === cloud.id)
  const isHovered = Option.exists(
    picture.context.maybeHoveredRef,
    ref => ref === cloud.id || ref === 'zone:internet' || ref === 'internet',
  )
  const hasInside = Array.some(
    picture.context.doc.doc.devices,
    device => device._tag === 'Transit',
  )
  const canToggle =
    picture.isOpen('board.routerChain') &&
    hasInside &&
    picture.context.mode !== 'Pick'
  const isPick =
    isCandidate(picture, cloud.id) || isCandidate(picture, 'internet')
  const toggle = send(Message.ClickedCloud({ isOpen: !cloud.isOpen }))
  const pickId = isCandidate(picture, cloud.id) ? cloud.id : 'internet'
  const ellipses = (className: string) =>
    Array.map(cloud.bumps, bump =>
      h.ellipse([
        h.Class(className),
        h.Attribute('cx', n(bump.x)),
        h.Attribute('cy', n(bump.y)),
        h.Attribute('rx', n(bump.rx)),
        h.Attribute('ry', n(bump.ry)),
      ]),
    )
  const labelTop = cloud.y - cloud.ry * 0.95 - 12
  return h.g(
    [
      h.Class(
        `pb-cloud${isFlying ? ' hl' : ''}${isHovered ? ' ref-hover' : ''}${cloud.isOpen ? ' open' : ''}${isPick ? ' cand' : ''}`,
      ),
      h.DataAttribute('node', cloud.id),
      h.AriaDescription(hint),
      ...(isPick
        ? button(draw, title, send(candidateMessage(picture, pickId)))
        : canToggle
          ? button(
              draw,
              cloud.isOpen ? ui.zone.collapse : ui.zone.expand,
              toggle,
            )
          : [h.Role('img'), h.AriaLabel(`${title}: ${sub}`)]),
    ],
    [
      h.title([], [hint]),
      ...ellipses('pb-cloud-edge'),
      ...ellipses('pb-cloud-fill'),
      ...(cloud.isOpen
        ? [
            h.text(
              [
                h.Class('pb-cloud-title'),
                h.Attribute(
                  'x',
                  n(picture.layout.isNarrow ? cloud.x - cloud.rx : cloud.x),
                ),
                h.Attribute('y', n(labelTop)),
                h.TextAnchor(picture.layout.isNarrow ? 'start' : 'middle'),
              ],
              [
                title,
                h.tspan(
                  [h.Class('pb-sub'), h.Attribute('dx', '8')],
                  [`· ${sub}`],
                ),
              ],
            ),
          ]
        : [
            h.text(
              [
                h.Class('pb-cloud-title'),
                h.Attribute('x', n(cloud.x)),
                h.Attribute('y', n(cloud.y + 2)),
                h.TextAnchor('middle'),
              ],
              [title],
            ),
            h.text(
              [
                h.Class('pb-sub'),
                h.Attribute('x', n(cloud.x)),
                h.Attribute('y', n(cloud.y + 19)),
                h.TextAnchor('middle'),
              ],
              [sub],
            ),
          ]),
      ...(canToggle && picture.isNew('board.routerChain')
        ? [
            newBadge(draw, {
              x: cloud.x + cloud.rx * 0.55,
              y: cloud.y - cloud.ry * 0.85,
            }),
          ]
        : []),
    ],
  )
}

const innerView = <ParentMessage>(
  draw: Draw<ParentMessage>,
  cloud: CloudShape,
): ReadonlyArray<Html> => {
  const { h, picture } = draw
  const at = (id: string): Point =>
    Option.match(
      Array.findFirst(cloud.inner, inner => inner.id === id),
      { onNone: () => ({ x: cloud.x, y: cloud.y }), onSome: inner => inner },
    )
  const isLit = (a: string, b: string) =>
    Array.contains(picture.litLinks, `${a}|${b}`) ||
    Array.contains(picture.litLinks, `${b}|${a}`)
  const isActive = (id: string) =>
    (picture.moment._tag === 'Flying' || picture.moment._tag === 'Resting') &&
    (picture.moment.leg.from === id || picture.moment.leg.to === id)
  return [
    ...Array.map(cloud.innerLinks, ([a, b]) =>
      h.keyed('line')(`inner-${a}-${b}`, [
        h.Class(`pb-inner-link${isLit(a, b) ? ' lit' : ''}`),
        h.Attribute('x1', n(at(a).x)),
        h.Attribute('y1', n(at(a).y)),
        h.Attribute('x2', n(at(b).x)),
        h.Attribute('y2', n(at(b).y)),
      ]),
    ),
    ...Array.map(cloud.inner, inner =>
      h.keyed('g')(
        `inner-${inner.id}`,
        [
          h.Class(
            `pb-inner${isActive(inner.id) || Array.some(picture.litLinks, link => link.split('|').includes(inner.id)) ? ' lit' : ''}`,
          ),
        ],
        [
          h.circle([
            h.Class('pb-inner-ring'),
            h.Attribute('cx', n(inner.x)),
            h.Attribute('cy', n(inner.y)),
            h.Attribute('r', '12'),
          ]),
          ...Array.map(
            [
              [-4, -3],
              [4, -3],
              [0, 4],
            ],
            ([dx = 0, dy = 0]) =>
              h.circle([
                h.Class('pb-inner-dot'),
                h.Attribute('cx', n(inner.x + dx)),
                h.Attribute('cy', n(inner.y + dy)),
                h.Attribute('r', '2'),
              ]),
          ),
          h.title([], [picture.context.ui.packetBoard.zone.innerNet]),
        ],
      ),
    ),
  ]
}

/** Чей на доске этот IP-адрес: конверт, который не дошёл, подписан своим
    адресатом, а не тем, у кого он пропал. */
const ownerOfIp =
  (picture: Picture): OwnerOf =>
  ip =>
    Option.map(
      Array.findFirst(picture.context.doc.doc.devices, device =>
        Option.contains(
          addressOf(
            picture.context.doc.doc,
            picture.context.run.settled,
            device.id,
          ),
          ip,
        ),
      ),
      device => device.id,
    )

// LINKS

/** Связь выключена, и это видно: квиз «где обрыв» прячет обрыв до ответа
    (`hideUntilAnswered: ['links']`). */
const isShownDown = (picture: Picture, link: LinkShape): boolean =>
  !link.isUp && !Array.contains(picture.hidden, 'links')

const linkTitle = (picture: Picture, link: LinkShape): string => {
  const ui = picture.context.ui.packetBoard.link
  return isShownDown(picture, link)
    ? ui.unplugged
    : !link.isActive
      ? ui.notConnected
      : link.medium === 'radio'
        ? ui.radio
        : link.medium === 'cellular'
          ? ui.cellular
          : link.medium === 'virtual'
            ? ui.virtual
            : link.medium === 'tunnel'
              ? ui.tunnel
              : ui.cable
}

const linkView = <ParentMessage>(
  draw: Draw<ParentMessage>,
  link: LinkShape,
): Html => {
  const { h, picture, send } = draw
  const target = `link:${link.id}`
  const isHiddenLink =
    Array.contains(picture.hidden, 'links') && link.medium === 'radio'
  const isLit =
    Array.contains(picture.litLinks, link.id) ||
    (picture.moment._tag === 'Flying' && picture.moment.leg.link === link.id) ||
    Option.exists(picture.context.maybeHoveredRef, ref => ref === target) ||
    isLayerLink(picture, link.id)
  const mark = Array.findLast(picture.marks, found => found.target === target)
  const isPick = isCandidate(picture, target)
  const isPlugIn =
    picture.context.mode === 'Edit' && !link.isUp && link.medium === 'cable'
  const isUnplugTool =
    picture.context.mode === 'Edit' &&
    picture.model.tool._tag === 'Cable' &&
    link.medium === 'cable'
  const isPlugGhost =
    isPlugIn &&
    Option.exists(
      picture.context.maybeTask,
      task =>
        task.isGhostShown &&
        Array.some(
          task.solution,
          op =>
            op._tag === 'SetLinkUp' &&
            op.up &&
            ((op.a === link.a && op.b === link.b) ||
              (op.a === link.b && op.b === link.a)),
        ),
    )
  const classes = [
    'pb-link',
    link.medium,
    isLit ? 'lit' : '',
    isShownDown(picture, link) ? 'down' : '',
    link.isActive ? '' : 'idle',
    isHiddenLink ? 'unknown' : '',
    Array.some(picture.context.doc.doc.links, each => each.id === link.id)
      ? ''
      : 'draft',
    Option.match(mark, {
      onNone: () => '',
      onSome: found => `mark-${found.tone}`,
    }),
  ].join(' ')
  const isVisible = link.isActive || !link.isUp || isHiddenLink
  const label = `${picture.name(link.a)} — ${picture.name(link.b)}: ${linkTitle(picture, link)}`
  return h.keyed('g')(
    `link-${link.id}`,
    [h.Class('pb-link-group'), h.DataAttribute('link', link.id)],
    isVisible || isPick
      ? [
          h.path(
            [h.Class(classes), h.Attribute('d', link.d)],
            [h.title([], [label])],
          ),
          ...(isPick || isPlugIn || isUnplugTool
            ? [
                h.path([
                  h.Class(
                    `pb-link-hit${isPick ? ' cand' : isPlugIn ? ' plug' : ''}${isPlugGhost ? ` ghost${picture.context.isReducedMotion ? '' : ' pulse'}` : ''}`,
                  ),
                  h.Attribute('d', link.d),
                  ...button(
                    draw,
                    isPick
                      ? label
                      : isPlugIn
                        ? picture.context.ui.packetBoard.tools.plugIn(label)
                        : picture.context.ui.packetBoard.tools.unplug(label),
                    isPick
                      ? send(candidateMessage(picture, target))
                      : isPlugIn
                        ? send(Message.ClickedPlugIn({ a: link.a, b: link.b }))
                        : send(Message.ClickedUnplug({ a: link.a, b: link.b })),
                  ),
                ]),
              ]
            : []),
          ...(isHiddenLink
            ? [
                h.text(
                  [
                    h.Class('pb-link-badge unknown'),
                    h.Attribute('x', n((link.from.x + link.to.x) / 2)),
                    h.Attribute('y', n((link.from.y + link.to.y) / 2 - 6)),
                    h.TextAnchor('middle'),
                  ],
                  ['?'],
                ),
              ]
            : Option.match(link.maybeBand, {
                onNone: () => [],
                onSome: band =>
                  picture.layout.rings.length > 0
                    ? [
                        h.text(
                          [
                            h.Class('pb-link-badge'),
                            h.Attribute('x', n((link.from.x + link.to.x) / 2)),
                            h.Attribute(
                              'y',
                              n((link.from.y + link.to.y) / 2 - 8),
                            ),
                            h.TextAnchor('middle'),
                          ],
                          [picture.context.ui.packetBoard.link.band(band)],
                        ),
                      ]
                    : [],
              })),
        ]
      : [],
  )
}

/** Призрак третьей подсказки: кабели эталона, которых ещё нет на доске, —
    пунктиром между устройствами. */
const ghostLinkViews = <ParentMessage>(
  draw: Draw<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, picture } = draw
  const links = picture.context.doc.doc.links
  const centre = (id: string) =>
    Option.map(
      Option.flatMap(shapeIdOf(picture, id), shapeId =>
        shapeOf(picture.layout, shapeId),
      ),
      centreOf,
    )
  return Option.match(
    Option.filter(picture.context.maybeTask, task => task.isGhostShown),
    {
      onNone: () => [],
      onSome: task =>
        Array.getSomes(
          Array.map(task.solution, op =>
            op._tag !== 'Connect' ||
            op.medium !== 'cable' ||
            Array.some(
              links,
              link =>
                (link.a === op.a && link.b === op.b) ||
                (link.a === op.b && link.b === op.a),
            )
              ? Option.none()
              : Option.map(
                  Option.all([centre(op.a), centre(op.b)]),
                  ([from, to]) =>
                    h.keyed('path')(`ghost-${op.a}-${op.b}`, [
                      h.Class('pb-link ghost'),
                      h.DataAttribute('ghost', `${op.a}-${op.b}`),
                      h.Attribute(
                        'd',
                        `M${n(from.x)},${n(from.y)} L${n(to.x)},${n(to.y)}`,
                      ),
                    ]),
                ),
          ),
        ),
    },
  )
}

/** Туннели, VPN и mesh — двойной линией между клиентом и шлюзом. */
const tunnelViews = <ParentMessage>(
  draw: Draw<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, picture } = draw
  if (!picture.isOpen('board.tunnel')) {
    return []
  }
  const pairs = Array.flatMap(picture.context.doc.doc.devices, device =>
    device._tag === 'Host'
      ? [
          ...Option.toArray(
            pipe(
              device.maybeVpn,
              Option.filter(vpn => vpn.connected),
              Option.map(vpn => [device.id, vpn.gateway, 'vpn'] as const),
            ),
          ),
          ...Option.toArray(
            Option.map(
              device.maybeTunnel,
              tunnel => [device.id, tunnel.relay, 'relay'] as const,
            ),
          ),
          ...Option.toArray(
            Option.map(
              device.maybeMesh,
              mesh => [device.id, mesh.relay, 'mesh'] as const,
            ),
          ),
        ]
      : [],
  )
  return Array.getSomes(
    Array.map(pairs, ([a, b, kind]) =>
      Option.map(
        Option.all([shapeOf(picture.layout, a), shapeOf(picture.layout, b)]),
        ([left, right]) =>
          h.keyed('path')(`tunnel-${a}-${b}`, [
            h.Class(`pb-tunnel ${kind}`),
            h.Attribute('d', doublePath(centreOf(left), centreOf(right))),
          ]),
      ),
    ),
  )
}

// NODES

/** Слой под указателем: строка панели конверта или ссылка текста
    `[[env:<уровень>|…]]` (первый слой этого уровня в конверте хопа). */
const hoveredLayer = (picture: Picture): Option.Option<number> =>
  Option.orElse(picture.model.maybeLayer, () =>
    Option.flatMap(picture.context.maybeHoveredRef, ref =>
      Option.flatMap(picture.maybeLeg, ({ leg }) =>
        Array.findFirstIndex(
          leg.hop.envelope,
          layer => `env:${levelOf(layer)}` === ref,
        ),
      ),
    ),
  )

const isLayerLink = (picture: Picture, link: string): boolean =>
  Option.exists(hoveredLayer(picture), position =>
    Option.exists(picture.maybeLeg, ({ leg }) =>
      Option.exists(
        Array.get(leg.hop.envelope, position),
        layer =>
          (layer._tag === 'Ethernet' ||
            layer._tag === 'WiFi' ||
            layer._tag === 'Arp') &&
          leg.hop.link === link,
      ),
    ),
  )

const layerDevices = (picture: Picture): ReadonlyArray<string> =>
  Option.match(hoveredLayer(picture), {
    onNone: () => [],
    onSome: position =>
      Option.match(picture.maybeLeg, {
        onNone: () => [],
        onSome: ({ leg }) =>
          Option.match(Array.get(leg.hop.envelope, position), {
            onNone: () => [],
            onSome: layer =>
              layer._tag === 'Ethernet' ||
              layer._tag === 'WiFi' ||
              layer._tag === 'Arp'
                ? [leg.hop.from, leg.hop.to]
                : Option.match(Array.get(picture.timeline.plays, leg.play), {
                    onNone: () => [],
                    onSome: play => {
                      const isOuter = Option.exists(
                        Array.findFirstIndex(
                          leg.hop.envelope,
                          inner => inner._tag === 'Tunnel',
                        ),
                        tunnel => position < tunnel,
                      )
                      const letter = (isOuter ? outerLetterOf : letterOf)(
                        play.trace,
                        leg.hop,
                        ownerOfIp(picture),
                      )
                      return [letter.from, letter.to]
                    },
                  }),
          }),
      }),
  })

const iconView = <ParentMessage>(
  h: HtmlBuilder<ParentMessage>,
  kind: DeviceKind,
  x: number,
  y: number,
): Html =>
  h.g(
    [h.Class('pb-icon'), h.Transform(`translate(${n(x)},${n(y)})`)],
    Array.map(deviceIcons[kind], d => h.path([h.Attribute('d', d)])),
  )

const newBadge = <ParentMessage>(
  draw: Draw<ParentMessage>,
  at: Point,
): Html => {
  const { h, picture } = draw
  const text = picture.context.ui.packetBoard.newBadge
  const width = text.length * 6.4 + 12
  return h.g(
    [h.Class('pb-new'), h.Transform(`translate(${n(at.x)},${n(at.y)})`)],
    [
      h.rect([
        h.Attribute('x', n(-width / 2)),
        h.Attribute('y', '-9'),
        h.Attribute('width', n(width)),
        h.Attribute('height', '17'),
        h.Attribute('rx', '8.5'),
      ]),
      h.text([h.Attribute('y', '3.5'), h.TextAnchor('middle')], [text]),
    ],
  )
}

const barsView = <ParentMessage>(
  draw: Draw<ParentMessage>,
  node: NodeBox,
): ReadonlyArray<Html> => {
  const { h, picture } = draw
  if (
    Array.contains(picture.hidden, 'links') ||
    Array.contains(picture.hidden, 'bars')
  ) {
    return []
  }
  return Option.match(
    Array.findFirst(picture.layout.bars, bars => bars.device === node.id),
    {
      onNone: () => [],
      onSome: found => [
        h.g(
          [
            h.Class('pb-bars'),
            h.Transform(
              `translate(${n(node.x + node.w / 2 - 22)},${n(node.y - node.h / 2 + 8)})`,
            ),
            h.Role('img'),
            h.AriaLabel(
              picture.context.ui.packetBoard.signal(
                found.bars,
                picture.context.ui.packetBoard.link.band(found.band),
              ),
            ),
          ],
          Array.map([0, 1, 2], index =>
            h.rect([
              h.Class(index < found.bars ? 'on' : ''),
              h.Attribute('x', `${index * 5}`),
              h.Attribute('y', `${8 - index * 4}`),
              h.Attribute('width', '3.5'),
              h.Attribute('height', `${4 + index * 4}`),
              h.Attribute('rx', '1'),
            ]),
          ),
        ),
      ],
    },
  )
}

const isLocked = (picture: Picture, id: DeviceId): boolean =>
  Option.exists(
    deviceOf(picture, id),
    device =>
      device._tag === 'Internet' ||
      device._tag === 'Transit' ||
      (device._tag === 'Host' &&
        !Array.some(picture.layout.zones, zone =>
          Array.contains(zone.members, id),
        )),
  )

/** Задача разрешает двигать устройства: в эталоне есть перестановка. */
export const canMove = (picture: Picture): boolean =>
  picture.context.mode === 'Edit' &&
  Option.exists(picture.context.maybeTask, task =>
    Array.some(task.solution, op => op._tag === 'MoveDevice'),
  )

const nodeClick = (picture: Picture, id: DeviceId): Option.Option<Message> =>
  isCandidate(picture, id)
    ? Option.some(candidateMessage(picture, id))
    : picture.context.mode === 'Edit' && picture.model.tool._tag === 'Cable'
      ? Option.some(Message.ClickedCableEnd({ id }))
      : picture.isOpen('board.deviceCard') && picture.context.mode !== 'Pick'
        ? Option.some(Message.ClickedDevice({ id }))
        : Option.none()

const MOVE = 20

const moveKeys =
  (picture: Picture, node: NodeBox) =>
  (key: string): Option.Option<Message> =>
    Option.flatMap(deviceOf(picture, node.id), device => {
      const delta =
        key === 'ArrowLeft'
          ? [-MOVE, 0]
          : key === 'ArrowRight'
            ? [MOVE, 0]
            : key === 'ArrowUp'
              ? [0, -MOVE]
              : key === 'ArrowDown'
                ? [0, MOVE]
                : [0, 0]
      const [dx = 0, dy = 0] = picture.layout.isNarrow
        ? [delta[1] ?? 0, delta[0] ?? 0]
        : delta
      return dx === 0 && dy === 0
        ? key === 'Enter' || key === ' '
          ? nodeClick(picture, node.id)
          : Option.none()
        : Option.some(
            Message.PressedMoveKey({
              id: node.id,
              x: device.x + dx,
              y: device.y + dy,
            }),
          )
    })

const nodeView = <ParentMessage>(
  draw: Draw<ParentMessage>,
  node: NodeBox,
): Html => {
  const { h, picture, send } = draw
  const moment = picture.moment
  const isFlying =
    moment._tag === 'Flying' &&
    (moment.leg.from === node.id || moment.leg.to === node.id)
  const isOff = Array.some(
    picture.layout.links,
    link =>
      (link.a === node.id || link.b === node.id) &&
      link.medium === 'radio' &&
      !link.isActive &&
      !Array.contains(picture.hidden, 'links') &&
      Option.exists(
        deviceOf(picture, node.id),
        device => device._tag === 'Host',
      ),
  )
  const isDown = isRestarting(picture, node.id)
  const isHovered = Option.exists(
    picture.context.maybeHoveredRef,
    ref => ref === node.id,
  )
  const isCableFrom =
    picture.model.tool._tag === 'Cable' &&
    Option.exists(picture.model.tool.maybeFrom, from => from === node.id)
  const isCard = Option.exists(picture.maybeCard, card => card === node.id)
  const isLayer = Array.contains(layerDevices(picture), node.id)
  const click = nodeClick(picture, node.id)
  const movable = canMove(picture) && !isLocked(picture, node.id)
  const x0 = node.x - node.w / 2
  const y0 = node.y - node.h / 2
  const icon = picture.layout.isNarrow ? 9 : 11
  const textX = x0 + (picture.layout.isNarrow ? 34 : 42)
  const isCand = isCandidate(picture, node.id)
  const label = `${node.text.title}${node.text.sub === '' ? '' : `, ${node.text.sub}`}`
  return h.keyed('g')(
    `node-${node.id}`,
    [
      h.Class(
        [
          'pb-node',
          isFlying ? 'hl' : '',
          isOff || isDown ? 'off' : '',
          isHovered || isLayer ? 'ref-hover' : '',
          isCableFrom || isCard ? 'selected' : '',
          isCand ? 'cand' : '',
          movable ? 'movable' : '',
          Option.isSome(click) ? 'clickable' : '',
          Option.isNone(deviceOf(picture, node.id)) ? 'draft' : '',
        ].join(' '),
      ),
      h.DataAttribute('node', node.id),
      ...(node.text.hint === '' ? [] : [h.AriaDescription(node.text.hint)]),
      ...(movable
        ? [
            h.Role('button'),
            h.Tabindex(0),
            h.AriaLabel(
              `${label}. ${picture.context.ui.packetBoard.tools.moveHint}`,
            ),
            h.OnKeyDownPreventDefault(key =>
              Option.map(moveKeys(picture, node)(key), send),
            ),
            h.OnPointerDown(() =>
              Option.flatMap(deviceOf(picture, node.id), device =>
                Option.some(
                  send(
                    Message.GrabbedDevice({
                      id: node.id,
                      x: device.x,
                      y: device.y,
                    }),
                  ),
                ),
              ),
            ),
            ...Option.match(click, {
              onNone: () => [],
              onSome: message => [h.OnClick(send(message))],
            }),
          ]
        : Option.match(click, {
            onNone: () => [h.Role('img'), h.AriaLabel(label)],
            onSome: message => button(draw, label, send(message)),
          })),
      ...(Option.exists(
        picture.model.maybeGrab,
        grab => grab._tag === 'Envelope',
      ) && isCand
        ? [
            h.OnPointerUp(() =>
              Option.some(
                send(
                  Message.ReleasedOnCandidate({
                    id: node.id,
                    playTo: firstStop(picture),
                    total: picture.revealed.totalMs,
                  }),
                ),
              ),
            ),
          ]
        : []),
    ],
    [
      ...(node.text.hint === '' ? [] : [h.title([], [node.text.hint])]),
      h.rect([
        h.Class('pb-body'),
        h.Attribute('x', n(x0)),
        h.Attribute('y', n(y0)),
        h.Attribute('width', n(node.w)),
        h.Attribute('height', n(node.h)),
        h.Attribute('rx', '11'),
      ]),
      iconView(h, node.kind, x0 + icon, node.y - 12),
      h.text(
        [
          h.Class('pb-title'),
          h.Attribute('x', n(textX)),
          h.Attribute('y', n(node.y - 2)),
        ],
        [node.text.title],
      ),
      h.text(
        [
          h.Class(`pb-sub${isOff ? ' bad' : ''}`),
          h.Attribute('x', n(textX)),
          h.Attribute('y', n(node.y + 13)),
        ],
        [node.text.sub],
      ),
      ...barsView(draw, node),
      ...(canMove(picture) && isLocked(picture, node.id)
        ? [
            h.g(
              [
                h.Class('pb-lock'),
                h.Transform(`translate(${n(x0 + node.w - 18)},${n(y0 + 6)})`),
              ],
              [
                h.path([h.Attribute('d', 'M2 6h8v6H2zM4 6V4a2 2 0 0 1 4 0v2')]),
                h.title([], [picture.context.ui.packetBoard.tools.locked]),
              ],
            ),
          ]
        : []),
      ...(newFeatureOf(picture, node.id)
        ? [newBadge(draw, { x: node.x + node.w / 2 - 22, y: y0 - 4 })]
        : []),
    ],
  )
}

/** Container падает и перезапускается: рисуется бледным. */
const isRestarting = (picture: Picture, id: DeviceId): boolean =>
  picture.isOpen('board.dockerHost') &&
  Option.exists(
    deviceOf(picture, id),
    device =>
      device._tag === 'Host' &&
      Option.isSome(device.maybeContainer) &&
      !isContainerUp(
        picture.context.doc.doc,
        picture.context.run.settled,
        device,
      ),
  )

/** Новое в уроке устройство: справочная (урок 3), коммутатор (урок 7),
    транзит (урок 4) — с меткой «новое». */
const newFeatureOf = (picture: Picture, id: DeviceId): boolean =>
  Option.exists(deviceOf(picture, id), device =>
    device._tag === 'Transit'
      ? picture.isNew('board.routerChain')
      : device._tag === 'Switch'
        ? picture.isNew('board.switch')
        : kindOf(device) === 'resolver'
          ? picture.isNew('board.dnsServer')
          : false,
  )

// STICKER

const stickerOwner = (picture: Picture): Option.Option<NodeBox> =>
  picture.isOpen('board.routerSticker')
    ? Array.findFirst(picture.layout.nodes, node =>
        Option.exists(
          deviceOf(picture, node.id),
          device =>
            (device._tag === 'Router' || device._tag === 'AccessPoint') &&
            Option.isSome(wifiOf(device)),
        ),
      )
    : Option.none()

const stickerView = <ParentMessage>(
  draw: Draw<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, picture, send } = draw
  const ui = picture.context.ui.packetBoard.sticker
  return Option.match(stickerOwner(picture), {
    onNone: () => [],
    onSome: node => {
      const x = node.x + node.w / 2 - 34
      const y = node.y + node.h / 2 + 12
      const isOn =
        picture.model.isStickerOpen ||
        Option.exists(picture.context.maybeHoveredRef, ref => ref === 'sticker')
      // Наклейка мигает с третьей подсказкой, только если эталон что-то
      // делает с Wi-Fi: в задаче про кабель и адреса она ни при чём.
      const isGhost = Option.exists(
        picture.context.maybeTask,
        task =>
          task.isGhostShown &&
          Array.some(
            task.solution,
            op => op._tag === 'JoinWifi' || op._tag === 'ConfigureWifi',
          ),
      )
      return [
        ...(isGhost
          ? [
              h.rect([
                h.Class(
                  `pb-sticker-halo${picture.context.isReducedMotion ? '' : ' pulse'}`,
                ),
                h.Attribute('x', n(x - 36)),
                h.Attribute('y', n(y - 20)),
                h.Attribute('width', '72'),
                h.Attribute('height', '40'),
                h.Attribute('rx', '6'),
                h.Transform(`rotate(-6 ${n(x)} ${n(y)})`),
              ]),
            ]
          : []),
        h.g(
          [
            h.Class(`pb-sticker${isOn ? ' on' : ''}`),
            h.DataAttribute('sticker', node.id),
            h.Transform(`translate(${n(x)},${n(y)}) rotate(-6)`),
            ...button(draw, ui.open, send(Message.ClickedSticker())),
            h.AriaExpanded(picture.model.isStickerOpen),
          ],
          [
            h.rect([
              h.Class('pb-paper'),
              h.Attribute('x', '-29'),
              h.Attribute('y', '-13'),
              h.Attribute('width', '58'),
              h.Attribute('height', '26'),
              h.Attribute('rx', '2.5'),
            ]),
            h.text(
              [h.Attribute('x', '-24'), h.Attribute('y', '-2.5')],
              ['Wi-Fi'],
            ),
            h.text(
              [
                h.Class('small'),
                h.Attribute('x', '-24'),
                h.Attribute('y', '8'),
              ],
              [ui.short],
            ),
            h.path([
              h.Class('pb-code'),
              h.Attribute(
                'd',
                'M10,-8v6M12,-8v6M15,-8v6M17,-8v6M20,-8v6M23,-8v6',
              ),
            ]),
          ],
        ),
        ...(picture.isNew('board.routerSticker')
          ? [newBadge(draw, { x: x + 34, y: y + 16 })]
          : []),
      ]
    },
  })
}

/** Наклейка крупно: имя сети и пароль. */
const stickerPopView = <ParentMessage>(
  draw: Draw<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, picture, send } = draw
  const ui = picture.context.ui.packetBoard.sticker
  if (!picture.model.isStickerOpen) {
    return []
  }
  return Option.match(stickerOwner(picture), {
    onNone: () => [],
    onSome: node =>
      Option.match(Option.flatMap(deviceOf(picture, node.id), wifiOf), {
        onNone: () => [],
        onSome: wifi => {
          const width = 236
          const height = 150
          const viewBox = picture.layout.viewBox
          const x = Math.min(
            Math.max(node.x - width / 2, viewBox.x + 6),
            viewBox.x + viewBox.w - width - 6,
          )
          const below = node.y + node.h / 2 + 34
          const y =
            below + height > viewBox.y + viewBox.h
              ? node.y - node.h / 2 - height - 12
              : below
          return [
            h.foreignObject(
              [
                h.Attribute('x', n(x)),
                h.Attribute('y', n(y)),
                h.Attribute('width', `${width}`),
                h.Attribute('height', `${height}`),
              ],
              [
                h.div(
                  [
                    h.Class('pb-sticker-pop'),
                    h.Role('dialog'),
                    h.AriaLabel(ui.title),
                  ],
                  [
                    h.div(
                      [h.Class('pb-sticker-head')],
                      [
                        ui.title,
                        h.button(
                          [
                            h.Type('button'),
                            h.Class('pb-x'),
                            h.AriaLabel(ui.close),
                            h.OnClick(send(Message.ClickedCloseSticker())),
                          ],
                          ['×'],
                        ),
                      ],
                    ),
                    h.dl(
                      [],
                      [
                        h.dt([], [ui.ssid]),
                        h.dd([], [wifi.ssid]),
                        h.dt([], [ui.password]),
                        h.dd(
                          [],
                          [wifi.security === 'open' ? '—' : wifi.password],
                        ),
                      ],
                    ),
                    h.p([h.Class('pb-sticker-note')], [ui.note]),
                  ],
                ),
              ],
            ),
          ]
        },
      }),
  })
}

// MARKS

const toneClass = (tone: Tone): string => tone

const haloView = <ParentMessage>(
  draw: Draw<ParentMessage>,
  target: string,
  tone: Tone,
  isPulsing: boolean,
  key: string,
): ReadonlyArray<Html> => {
  const { h, picture } = draw
  return Option.match(
    Option.flatMap(shapeIdOf(picture, target), id =>
      shapeOf(picture.layout, id),
    ),
    {
      onNone: () => [],
      onSome: shape => {
        const className = `pb-halo ${toneClass(tone)}${isPulsing ? ' pulse' : ''}`
        return shape._tag === 'Box'
          ? [
              h.keyed('rect')(key, [
                h.Class(className),
                h.Attribute('x', n(shape.node.x - shape.node.w / 2 - 7)),
                h.Attribute('y', n(shape.node.y - shape.node.h / 2 - 7)),
                h.Attribute('width', n(shape.node.w + 14)),
                h.Attribute('height', n(shape.node.h + 14)),
                h.Attribute('rx', '16'),
              ]),
            ]
          : shape._tag === 'Cloud'
            ? [
                h.keyed('ellipse')(key, [
                  h.Class(className),
                  h.Attribute('cx', n(shape.cloud.x)),
                  h.Attribute('cy', n(shape.cloud.y)),
                  h.Attribute('rx', n(shape.cloud.rx + 12)),
                  h.Attribute('ry', n(shape.cloud.ry + 10)),
                ]),
              ]
            : []
      },
    },
  )
}

const noteAnchor = (
  picture: Picture,
  target: string,
): Option.Option<Readonly<{ x: number; top: number; bottom: number }>> =>
  target.startsWith('link:')
    ? Option.map(
        Array.findFirst(
          picture.layout.links,
          link => `link:${link.id}` === target,
        ),
        link => {
          const x = (link.from.x + link.to.x) / 2
          const y = (link.from.y + link.to.y) / 2
          return { x, top: y - 4, bottom: y + 4 }
        },
      )
    : Option.map(
        Option.flatMap(shapeIdOf(picture, target), id =>
          shapeOf(picture.layout, id),
        ),
        shape =>
          shape._tag === 'Box'
            ? {
                x: shape.node.x,
                top: shape.node.y - shape.node.h / 2,
                bottom: shape.node.y + shape.node.h / 2,
              }
            : shape._tag === 'Cloud'
              ? {
                  x: shape.cloud.x,
                  top: shape.cloud.y - shape.cloud.ry,
                  bottom: shape.cloud.y + shape.cloud.ry,
                }
              : {
                  x: shape.inner.x,
                  top: shape.inner.y - 12,
                  bottom: shape.inner.y + 12,
                },
      )

const noteView = <ParentMessage>(
  draw: Draw<ParentMessage>,
  target: string,
  text: string,
  tone: Tone,
  key: string,
  prefersBelow = false,
): ReadonlyArray<Html> => {
  const { h, picture } = draw
  const viewBox = picture.layout.viewBox
  return Option.match(noteAnchor(picture, target), {
    onNone: () => [],
    onSome: anchor => {
      const width = Math.min(text.length * 6.7 + 20, viewBox.w - 12)
      const x = Math.min(
        Math.max(anchor.x - width / 2, viewBox.x + 6),
        viewBox.x + viewBox.w - width - 6,
      )
      const above = anchor.top - 34
      const isBelow =
        above < viewBox.y + 6 ||
        (prefersBelow && anchor.bottom + 34 < viewBox.y + viewBox.h)
      const y = isBelow ? anchor.bottom + 10 : above
      const stemFrom = isBelow ? y : y + 22
      const stemTo = isBelow ? anchor.bottom + 1 : anchor.top - 1
      return [
        h.keyed('g')(
          key,
          [h.Class(`pb-note ${toneClass(tone)}`)],
          [
            h.path([
              h.Class('pb-stem'),
              h.Attribute('d', `M${n(anchor.x)},${n(stemFrom)} V${n(stemTo)}`),
            ]),
            h.rect([
              h.Attribute('x', n(x)),
              h.Attribute('y', n(y)),
              h.Attribute('width', n(width)),
              h.Attribute('height', '22'),
              h.Attribute('rx', '6'),
            ]),
            h.text(
              [
                h.Attribute('x', n(x + width / 2)),
                h.Attribute('y', n(y + 15)),
                h.TextAnchor('middle'),
              ],
              [text],
            ),
          ],
        ),
      ]
    },
  })
}

// SCAN, DRAFT

const SCAN_CHIP_WIDTH = 84

/** Значки сканера справа от устройства; у правого края доски — слева, у
    нижнего — выше, чтобы не уйти за край. */
const scanViews = <ParentMessage>(
  draw: Draw<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, picture } = draw
  if (!picture.isOpen('board.portScan')) {
    return []
  }
  const ui = picture.context.ui.packetBoard.scan
  return Array.flatMap(picture.context.stage, (item): ReadonlyArray<Html> =>
    item._tag !== 'Scan'
      ? []
      : Option.match(
          Option.flatMap(shapeIdOf(picture, item.target), id =>
            shapeOf(picture.layout, id),
          ),
          {
            onNone: () => [],
            onSome: shape => {
              const centre = centreOf(shape)
              const settled = picture.context.run.settled
              const results = scanPorts(
                picture.context.doc.doc,
                settled,
                item.from,
                Option.getOrElse(
                  addressOf(picture.context.doc.doc, settled, item.target),
                  () => item.target,
                ),
                item.ports,
              )
              const viewBox = picture.layout.viewBox
              const right = centre.x + 92
              const x =
                right + SCAN_CHIP_WIDTH <= viewBox.x + viewBox.w - 6
                  ? right
                  : centre.x - 92 - SCAN_CHIP_WIDTH
              const top = Math.min(
                centre.y - 30,
                viewBox.y + viewBox.h - 6 - (results.length - 1) * 19 - 16,
              )
              return Array.map(results, (result, index) =>
                h.keyed('g')(
                  `scan-${item.target}-${result.port}`,
                  [
                    h.Class(`pb-scan ${result.status}`),
                    h.Transform(`translate(${n(x)},${n(top + index * 19)})`),
                  ],
                  [
                    h.rect([
                      h.Attribute('width', `${SCAN_CHIP_WIDTH}`),
                      h.Attribute('height', '16'),
                      h.Attribute('rx', '8'),
                    ]),
                    h.text(
                      [h.Attribute('x', '8'), h.Attribute('y', '12')],
                      [
                        `${result.port} ${result.status === 'open' ? '✓' : result.status === 'closed' ? '✕' : '…'} ${result.status === 'open' ? ui.open : result.status === 'closed' ? ui.closed : ui.filtered}`,
                      ],
                    ),
                  ],
                ),
              )
            },
          },
        ),
  )
}

/** Черновик сцены (`preview`): новые устройства и кабели черновика стоят на
    доске пунктиром, а остальные операции — строки под своим устройством,
    одна под другой. Устройство и кабель строк не получают: их видно и так. */
const draftViews = <ParentMessage>(
  draw: Draw<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, picture, send } = draw
  const ops = Array.flatMap(picture.previews, preview => preview.ops)
  return Array.getSomes(
    Array.map(ops, (op, index) => {
      const id = `draft:${index}`
      const isPick = isCandidate(picture, id)
      const mark = Array.findLast(picture.marks, found => found.target === id)
      const tone = Option.match(mark, {
        onNone: () => '',
        onSome: found => ` mark-${found.tone}`,
      })
      const device = draftDevice(op)
      const row = Array.filter(
        Array.take(ops, index),
        earlier => draftDevice(earlier) === device,
      ).length
      return Option.map(
        Option.flatMap(visibleIdOptional(picture, device), shapeId =>
          shapeOf(picture.layout, shapeId),
        ),
        shape => {
          const centre = centreOf(shape)
          const text = picture.context.maybeQuiz.pipe(
            Option.flatMap(quiz => Option.fromNullishOr(quiz.names[id])),
            Option.orElse(() =>
              Option.map(picture.context.label(id), label => label.name),
            ),
            Option.getOrElse(
              () => `${picture.context.ui.packetBoard.draft}: ${op._tag}`,
            ),
          )
          const width = Math.min(text.length * 6.4 + 18, 260)
          const below = shape._tag === 'Box' ? shape.node.h / 2 + 6 : 40
          const y = centre.y + below + row * DRAFT_ROW
          return h.keyed('g')(
            `draft-${index}`,
            [
              h.Class(`pb-draft${isPick ? ' cand' : ''}${tone}`),
              h.Transform(`translate(${n(centre.x - width / 2)},${n(y)})`),
              ...(isPick
                ? button(draw, text, send(candidateMessage(picture, id)))
                : []),
            ],
            [
              h.rect([
                h.Attribute('width', n(width)),
                h.Attribute('height', '19'),
                h.Attribute('rx', '6'),
              ]),
              h.text([h.Attribute('x', '9'), h.Attribute('y', '13.5')], [text]),
            ],
          )
        },
      )
    }),
  )
}

/** Готовый блок сцены (`place`): пунктирное место, где встанет устройство.
    Нажатие ставит блок; пока задача не начата или блок уже на доске, места
    нет. С третьей подсказкой место пульсирует, как призрак. */
const placeViews = <ParentMessage>(
  draw: Draw<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, picture, send } = draw
  if (picture.context.mode !== 'Edit' || !picture.isOpen('board.sandbox')) {
    return []
  }
  const metrics = metricsFor(picture.layout.isNarrow)
  const isGhost = Option.exists(
    picture.context.maybeTask,
    task => task.isGhostShown,
  )
  return Array.flatMap(picture.context.stage, item =>
    item._tag !== 'Place'
      ? []
      : Option.match(
          Array.findFirst(item.ops, op =>
            op._tag === 'AddDevice' ? Option.some(op.device) : Option.none(),
          ),
          {
            onNone: () => [],
            onSome: device => {
              if (Option.isSome(deviceOf(picture, device.id))) {
                return []
              }
              const at = picture.layout.place({ x: device.x, y: device.y })
              const title = picture.name(device.id)
              const hint = picture.context.ui.packetBoard.place
              const width = Math.max(
                metrics.minNodeWidth,
                Math.max(title.length, hint.length) * metrics.charWidth * 0.86 +
                  metrics.textInset,
              )
              const x0 = at.x - width / 2
              const y0 = at.y - metrics.nodeHeight / 2
              const icon = picture.layout.isNarrow ? 9 : 11
              const textX = x0 + (picture.layout.isNarrow ? 34 : 42)
              return [
                h.keyed('g')(
                  `place-${device.id}`,
                  [
                    h.Class(
                      `pb-place${isGhost ? ` ghost${picture.context.isReducedMotion ? '' : ' pulse'}` : ''}`,
                    ),
                    h.DataAttribute('place', device.id),
                    ...button(
                      draw,
                      `${title}: ${hint}`,
                      send(Message.ClickedPlace({ ops: item.ops })),
                    ),
                  ],
                  [
                    h.rect([
                      h.Class('pb-body'),
                      h.Attribute('x', n(x0)),
                      h.Attribute('y', n(y0)),
                      h.Attribute('width', n(width)),
                      h.Attribute('height', n(metrics.nodeHeight)),
                      h.Attribute('rx', '11'),
                    ]),
                    iconView(h, kindOf(device), x0 + icon, at.y - 12),
                    h.text(
                      [
                        h.Class('pb-title'),
                        h.Attribute('x', n(textX)),
                        h.Attribute('y', n(at.y - 2)),
                      ],
                      [title],
                    ),
                    h.text(
                      [
                        h.Class('pb-sub'),
                        h.Attribute('x', n(textX)),
                        h.Attribute('y', n(at.y + 13)),
                      ],
                      [hint],
                    ),
                  ],
                ),
              ]
            },
          },
        ),
  )
}

const visibleIdOptional = (
  picture: Picture,
  id: string,
): Option.Option<string> => (id === '' ? Option.none() : shapeIdOf(picture, id))

// ENVELOPE

type LetterPlace = Readonly<{ x: number; y: number; scale: number }>

const letterPlace = (picture: Picture): Option.Option<LetterPlace> => {
  const moment = picture.moment
  const anchor = (id: string) => anchorOf(picture.layout, id)
  if (moment._tag === 'Waiting') {
    return anchor(moment.leg.from)
  }
  if (moment._tag === 'Resting') {
    return anchor(moment.leg.to)
  }
  if (moment._tag === 'Stuck') {
    return anchor(moment.at)
  }
  if (moment._tag === 'Flying') {
    return picture.context.isReducedMotion
      ? anchor(moment.leg.to)
      : Option.map(
          Option.all([anchor(moment.leg.from), anchor(moment.leg.to)]),
          ([from, to]) => ({
            x: from.x + (to.x - from.x) * moment.progress,
            y: from.y + (to.y - from.y) * moment.progress,
            scale: from.scale + (to.scale - from.scale) * moment.progress,
          }),
        )
  }
  if (moment._tag === 'Done' && picture.hasStarted) {
    return Option.flatMap(
      Array.findFirst(picture.timeline.plays, play =>
        Option.isSome(play.maybeDrop),
      ),
      play => Option.flatMap(play.maybeDrop, drop => anchor(drop.at)),
    )
  }
  return Option.none()
}

const letterView = <ParentMessage>(
  draw: Draw<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, picture, send } = draw
  const ui = picture.context.ui.packetBoard
  if (!picture.isOpen('board.envelope')) {
    return []
  }
  return Option.match(letterPlace(picture), {
    onNone: () => [],
    onSome: place => {
      const moment = picture.moment
      const isStuck = moment._tag === 'Stuck'
      const isLost = moment._tag === 'Done'
      const dropPlay = Array.findFirst(picture.timeline.plays, play =>
        Option.isSome(play.maybeDrop),
      )
      const legHop = Option.map(picture.maybeLeg, ({ leg }) => leg)
      const play = Option.match(legHop, {
        onNone: () => dropPlay,
        onSome: leg => Array.get(picture.timeline.plays, leg.play),
      })
      const letter = Option.match(legHop, {
        onNone: () =>
          Option.match(play, {
            onNone: () => ({ from: '', to: '' }),
            onSome: found => ({
              from: sourceOf(found.trace.intent),
              to: lastAddressee(picture, found),
            }),
          }),
        onSome: leg =>
          Option.match(play, {
            onNone: () => ({ from: '', to: '' }),
            onSome: found =>
              outerLetterOf(found.trace, leg.hop, ownerOfIp(picture)),
          }),
      })
      const addresses = Option.flatMap(legHop, leg => addressesOf(leg.hop))
      const isAddressShown =
        picture.isOpen('board.addresses') &&
        !Array.contains(picture.hidden, 'addresses')
      // Выдача адреса (урок 2): у спрашивающего ещё нет номера, вопрос
      // идёт всем; ответ «для всех» несёт только имя получателя.
      // Вопрос «у кого этот адрес?» (ARP) тоже идёт всем в сети.
      const isBroadcast =
        Option.exists(legHop, leg => isAddressQuestion(leg.hop)) ||
        Option.exists(addresses, found => found.to === BROADCAST)
      const isAskingAll =
        isBroadcast && !Option.exists(legHop, leg => leg.isReply)
      const fromAddress = Option.map(addresses, found =>
        found.from === UNSET ? `(${ui.card.noAddress})` : found.from,
      )
      const fromText = `${picture.name(letter.from)}${isAddressShown ? Option.match(fromAddress, { onNone: () => '', onSome: found => ` ${found}` }) : ''}`
      const toText = isAskingAll
        ? ui.envelope.everyone
        : `${picture.name(letter.to)}${isAddressShown && !isBroadcast ? Option.match(addresses, { onNone: () => '', onSome: found => ` ${found.to}` }) : ''}`
      const protocol = Option.match(legHop, {
        onNone: () => 'data',
        onSome: leg => leg.protocol,
      })
      const isReply = Option.exists(legHop, leg => leg.isReply)
      const isLayered = picture.isOpen('board.envelopeLayers')
      const isColoured = picture.isOpen('board.legend')
      const sealed =
        picture.isOpen('board.sealedEnvelope') &&
        Option.exists(legHop, leg => isSealed(leg.hop))
      const tunneled =
        picture.isOpen('board.sealedEnvelope') &&
        Option.exists(legHop, leg => isTunneled(leg.hop))
      const width = Math.ceil(
        Math.max(
          ui.envelope.from.length + fromText.length,
          ui.envelope.to.length + toText.length,
        ) *
          6.9 +
          28,
      )
      const height = 44
      const viewBox = picture.layout.viewBox
      const scaled = { w: width * place.scale, h: height * place.scale }
      const x = Math.min(
        Math.max(place.x, viewBox.x + scaled.w / 2 + 4),
        viewBox.x + viewBox.w - scaled.w / 2 - 4,
      )
      const y = Math.min(
        Math.max(place.y, viewBox.y + scaled.h / 2 + 4),
        viewBox.y + viewBox.h - scaled.h / 2 - 4,
      )
      const isNextHop =
        Option.exists(
          picture.quiz,
          marks => marks.quiz.kind === 'NextHop' && !marks.isAnswered,
        ) && picture.context.mode === 'Pick'
      const canOpen = isLayered && !isNextHop && Option.isSome(legHop)
      const label = `${ui.envelope.from} ${fromText}, ${ui.envelope.to} ${toText}`
      return [
        h.g(
          [
            h.Class(
              [
                'pb-letter',
                isReply ? 'reply' : '',
                isStuck ? 'stuck' : '',
                isLost ? 'lost' : '',
                isColoured ? `proto-${protocol}` : '',
                isNextHop ? 'grab' : '',
                canOpen ? 'clickable' : '',
              ].join(' '),
            ),
            h.DataAttribute('letter', 'true'),
            h.Transform(
              `translate(${n(x)},${n(y)}) scale(${place.scale.toFixed(3)})`,
            ),
            ...(isNextHop
              ? [
                  h.Role('img'),
                  h.AriaLabel(`${label}. ${ui.quiz.dragEnvelope}`),
                  h.OnPointerDown(() =>
                    Option.some(send(Message.PressedEnvelope())),
                  ),
                ]
              : canOpen
                ? button(
                    draw,
                    `${ui.envelope.open}: ${label}`,
                    send(Message.ClickedEnvelope()),
                  )
                : [h.Role('img'), h.AriaLabel(label)]),
          ],
          [
            h.g(
              [h.Class('pb-letter-in')],
              [
                h.rect([
                  h.Class('pb-letter-body'),
                  h.Attribute('x', n(-width / 2)),
                  h.Attribute('y', n(-height / 2)),
                  h.Attribute('width', n(width)),
                  h.Attribute('height', n(height)),
                  h.Attribute('rx', '5'),
                ]),
                h.path([
                  h.Class('pb-letter-flap'),
                  h.Attribute(
                    'd',
                    `M${n(-width / 2 + 3)},${n(-height / 2 + 2)} L0,${n(-height / 2 + 9)} L${n(width / 2 - 3)},${n(-height / 2 + 2)}`,
                  ),
                ]),
                h.text(
                  [
                    h.Class('pb-letter-text'),
                    h.Attribute('x', n(-width / 2 + 10)),
                    h.Attribute('y', n(-height / 2 + 24)),
                  ],
                  [h.tspan([h.Class('k')], [ui.envelope.from]), ` ${fromText}`],
                ),
                h.text(
                  [
                    h.Class('pb-letter-text b'),
                    h.Attribute('x', n(-width / 2 + 10)),
                    h.Attribute('y', n(-height / 2 + 37)),
                  ],
                  [h.tspan([h.Class('k')], [ui.envelope.to]), ` ${toText}`],
                ),
                ...(isLayered
                  ? [
                      h.g(
                        [
                          h.Class('pb-letter-tag'),
                          h.Transform(
                            `translate(${n(width / 2 - 8)},${n(-height / 2 - 8)})`,
                          ),
                        ],
                        [
                          h.rect([
                            h.Attribute('x', '-40'),
                            h.Attribute('width', '44'),
                            h.Attribute('height', '15'),
                            h.Attribute('rx', '7.5'),
                          ]),
                          h.text(
                            [
                              h.Attribute('x', '-18'),
                              h.Attribute('y', '11'),
                              h.TextAnchor('middle'),
                            ],
                            [
                              tunneled
                                ? '🔒 VPN'
                                : sealed
                                  ? '🔒 TLS'
                                  : protocol.toUpperCase(),
                            ],
                          ),
                        ],
                      ),
                    ]
                  : []),
              ],
            ),
          ],
        ),
      ]
    },
  })
}

/** Кому адресован конверт, который не ушёл: у отправки на адрес (урок 2)
    — то, что ввёл ученик, у ping и traceroute на IP-адрес — его владелец
    (урок 8), а не последний, кто слышал поиск MAC. */
const lastAddressee = (
  picture: Picture,
  play: Picture['timeline']['plays'][number],
): DeviceId => {
  const intent = play.trace.intent
  if (intent._tag === 'Send' && intent.to.trim() !== '') {
    return intent.to.trim()
  }
  return pipe(
    intent._tag === 'Ping' || intent._tag === 'Traceroute'
      ? ownerOfIp(picture)(intent.host)
      : Option.none(),
    Option.getOrElse(() =>
      Option.match(Array.last(play.trace.hops), {
        onNone: () => play.trace.outcome.at,
        onSome: hop => hop.to,
      }),
    ),
  )
}

// BOARD

const modeChip = <ParentMessage>(
  draw: Draw<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, picture } = draw
  const ui = picture.context.ui.packetBoard
  return picture.context.mode === 'Pick'
    ? [h.div([h.Class('pb-mode quiz')], [ui.modeQuiz])]
    : picture.context.mode === 'Edit'
      ? [h.div([h.Class('pb-mode edit')], [ui.modeTask])]
      : []
}

const svgView = <ParentMessage>(draw: Draw<ParentMessage>): Html => {
  const { h, picture, send } = draw
  const { layout } = picture
  const viewBox = layout.viewBox
  const cloud = layout.maybeCloud
  const isFog =
    Array.some(picture.context.stage, item => item._tag === 'Fog') &&
    picture.isOpen('board.fog')
  return h.svg(
    [
      h.Class('pb-svg'),
      h.DataAttribute('board', 'packet'),
      h.DataAttribute('narrow', layout.isNarrow ? 'true' : 'false'),
      h.ViewBox(`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`),
      h.Attribute('preserveAspectRatio', 'xMidYMid meet'),
      h.AriaLabel(picture.context.ui.network.boardLabel),
      h.Role('group'),
      ...(Option.isSome(picture.model.maybeGrab)
        ? [h.OnPointerUp(() => Option.some(send(Message.ReleasedPointer())))]
        : []),
    ],
    [
      h.g(
        [h.Class('pb-layer-zones')],
        [
          ...Array.map(layout.zones, zone => zoneView(draw, zone)),
          ...planView(draw),
          ...Option.match(cloud, {
            onNone: () => [],
            onSome: found => [cloudView(draw, found)],
          }),
        ],
      ),
      ...(isFog
        ? [
            h.rect([
              h.Class('pb-fog'),
              h.Attribute('x', `${viewBox.x}`),
              h.Attribute('y', `${viewBox.y}`),
              h.Attribute('width', `${viewBox.w}`),
              h.Attribute('height', `${viewBox.h}`),
            ]),
          ]
        : []),
      h.g(
        [h.Class('pb-layer-links')],
        [
          ...Array.map(layout.links, link => linkView(draw, link)),
          ...ghostLinkViews(draw),
          ...tunnelViews(draw),
          ...Option.match(cloud, {
            onNone: () => [],
            onSome: found => innerView(draw, found),
          }),
        ],
      ),
      h.g(
        [h.Class('pb-layer-nodes')],
        [
          ...Array.map(layout.nodes, node => nodeView(draw, node)),
          ...stickerView(draw),
          ...draftViews(draw),
          ...placeViews(draw),
          ...scanViews(draw),
        ],
      ),
      h.g(
        [h.Class('pb-layer-over')],
        [
          ...Array.flatMap(picture.marks, (mark, index) =>
            haloView(
              draw,
              mark.target,
              mark.tone,
              mark.isPulsing,
              `halo-${index}-${mark.target}`,
            ),
          ),
          ...Array.flatMap(picture.notes, (note, index) =>
            noteView(
              draw,
              note.target,
              note.text,
              note.tone,
              `note-${index}-${note.target}`,
              note.isBelow === true,
            ),
          ),
        ],
      ),
      h.g([h.Class('pb-layer-letter')], letterView(draw)),
      h.g([h.Class('pb-layer-pop')], stickerPopView(draw)),
    ],
  )
}

export const view = <ParentMessage>(
  slot: Slot<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const picture = pictureOf(slot.context, slot.model)
  const draw: Draw<ParentMessage> = {
    picture,
    slot,
    h,
    send: slot.toParentMessage,
  }
  const viewBox = picture.layout.viewBox
  return h.div(
    [
      h.Class(`packet-board${picture.layout.isNarrow ? ' narrow' : ''}`),
      h.DataAttribute('mode', slot.context.mode),
    ],
    [
      h.div(
        [
          h.Class('pb-stage board-surface'),
          h.Style({ '--pb-ratio': `${viewBox.w} / ${viewBox.h}` }),
          ...(canMove(picture)
            ? [
                h.OnMount(
                  Mount.mapMessage(DevicePointer(), slot.toParentMessage),
                ),
              ]
            : []),
        ],
        [
          svgView(draw),
          ...modeChip(draw),
          ...stageOverlays(picture, slot.toParentMessage, h),
          ...boardPanels(picture, slot.toParentMessage, h),
        ],
      ),
      ...quizTray(picture, slot.toParentMessage, h),
    ],
  )
}

export { pictureOf }
