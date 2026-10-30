import { Array, Option, Order, pipe } from 'effect'

import type { Medium } from '../../net/model'
import {
  type Hop,
  type Intent,
  type Layer,
  type Outcome,
  type Trace,
  sameMessage,
  sourceOf,
} from '../../net/packet'
import { type World, foldWorld, sendIntent } from '../../net/world'
import type { PacketStage, Play, PlayShow, Walk } from './dsl'
import {
  type InnerNet,
  type Layout,
  type Point,
  centreOf,
  isInnerNet,
  shapeOf,
  visibleIdOf,
} from './layout'

// Проигрывание трассы (план 3.1, design D3 add-network-board): трассы
// элементов `play` сцены превращаются в перелёты между фигурами доски. Хоп
// идёт дискретно: перелёт, пауза у устройства, следующий перелёт. Хопы
// внутри свёрнутого облака сливаются, в раскрытом облаке урока 1 конверт
// идёт через картинку сетей. Время — только у проигрывателя: модель хранит
// миллисекунды, а позиции считаются здесь.

// TIMING

export const LEAD_MS = 320
export const FLY_MS = 720
export const DWELL_MS = 520
export const SLOT_MS = FLY_MS + DWELL_MS
export const WALK_SEGMENT_MS = 1400

// PROTOCOL

/** Протокол конверта: цвет рамки с урока 7 (легенда). */
export type Protocol =
  | 'arp'
  | 'dhcp'
  | 'dns'
  | 'icmp'
  | 'tcp'
  | 'tls'
  | 'http'
  | 'data'
  | 'tunnel'

export const protocolOf = (envelope: ReadonlyArray<Layer>): Protocol => {
  const has = (tag: Layer['_tag']) =>
    Array.some(envelope, layer => layer._tag === tag)
  return has('Arp')
    ? 'arp'
    : has('Dhcp')
      ? 'dhcp'
      : has('Dns')
        ? 'dns'
        : has('Http')
          ? 'http'
          : has('Tls')
            ? 'tls'
            : has('Payload')
              ? 'data'
              : has('Icmp')
                ? 'icmp'
                : has('Tunnel')
                  ? 'tunnel'
                  : 'tcp'
}

const isConversation = (
  protocol: Protocol,
  isDnsShown: boolean,
  isTlsShown: boolean,
): boolean =>
  protocol === 'http' ||
  protocol === 'data' ||
  protocol === 'icmp' ||
  (protocol === 'dns' && isDnsShown) ||
  (protocol === 'tls' && isTlsShown)

const isRefusal = (hop: Hop): boolean =>
  Array.some(
    hop.envelope,
    layer => layer._tag === 'Tcp' && layer.flags === 'RST',
  )

/** Выдача адреса в показе `letters` (урок 2): из четырёх пакетов DHCP —
    вопрос «какой у меня номер?» всем в доме и ответ с номером. */
const dhcpLetters = (
  trace: Trace,
  packets: ReadonlyArray<number>,
  protocolOfPacket: (packet: number) => Protocol,
): ReadonlyArray<number> => {
  if (trace.intent._tag !== 'DhcpJoin') {
    return []
  }
  const dhcp = Array.filter(
    packets,
    packet => protocolOfPacket(packet) === 'dhcp',
  )
  return Array.dedupe([...Array.take(dhcp, 1), ...Array.takeRight(dhcp, 1)])
}

/** Какие пакеты трассы показывать. `letters`: только разговор — запрос и
    ответ (и вопрос справочной, если она уже открыта); у выдачи адреса —
    вопрос и ответ DHCP; без них — всё, кроме поиска MAC и DHCP.
    `handshake`: разговор и договорённость о шифре перед ним (TLS hello). */
const shownPackets = (
  trace: Trace,
  show: PlayShow,
  isDnsShown: boolean,
): ReadonlyArray<number> => {
  const packets = Array.dedupe(Array.map(trace.hops, hop => hop.packet))
  const protocolOfPacket = (packet: number): Protocol =>
    Option.match(
      Array.findFirst(trace.hops, hop => hop.packet === packet),
      { onNone: () => 'tcp', onSome: hop => protocolOf(hop.envelope) },
    )
  if (show === 'all') {
    return packets
  }
  const talk = Array.filter(packets, packet =>
    isConversation(protocolOfPacket(packet), isDnsShown, show === 'handshake'),
  )
  const refusals = Array.filter(packets, packet =>
    Array.some(trace.hops, hop => hop.packet === packet && isRefusal(hop)),
  )
  const dhcp = dhcpLetters(trace, packets, protocolOfPacket)
  if (Array.isReadonlyArrayEmpty(talk) && Array.isReadonlyArrayNonEmpty(dhcp)) {
    return dhcp
  }
  return Array.isReadonlyArrayNonEmpty(talk)
    ? Array.filter(
        packets,
        packet =>
          Array.contains(talk, packet) || Array.contains(refusals, packet),
      )
    : Array.filter(packets, packet => {
        const protocol = protocolOfPacket(packet)
        return (
          protocol !== 'arp' &&
          protocol !== 'dhcp' &&
          (protocol !== 'dns' || isDnsShown)
        )
      })
}

// LEGS

/** Один перелёт конверта между фигурами доски. */
export type Leg = Readonly<{
  from: string
  to: string
  /** Хоп трассы; у перелётов внутри картинки сетей — хоп входа в облако. */
  hop: Hop
  play: number
  packet: number
  isReply: boolean
  protocol: Protocol
  medium: Medium | 'inner'
  /** Связь, которая загорается после перелёта. */
  link: string
  /** Номер хопа в своём конверте и сколько их всего (счётчик урока 4). */
  index: number
  count: number
}>

export type PlayResult = Readonly<{
  play: Play
  trace: Trace
  /** Где пакет погиб и почему: фигура доски и код. */
  maybeDrop: Option.Option<Readonly<{ at: string; outcome: Outcome }>>
}>

export type Timeline = Readonly<{
  legs: ReadonlyArray<Leg>
  plays: ReadonlyArray<PlayResult>
  walks: ReadonlyArray<Walk>
  /** Сколько миллисекунд идут проходы `walk` до первого конверта. */
  walkMs: number
  /** Где проигрыватель останавливается сам (`pauseAt`), по возрастанию. */
  pauses: ReadonlyArray<number>
  totalMs: number
}>

export const isPlay = (item: PacketStage): item is Play => item._tag === 'Play'

const isWalk = (item: PacketStage): item is Walk => item._tag === 'Walk'

const endpointsOf = (
  trace: Trace,
  packet: number,
): Readonly<{ from: string; to: string }> => {
  const hops = Array.filter(trace.hops, hop => hop.packet === packet)
  return {
    from: Option.match(Array.head(hops), {
      onNone: () => '',
      onSome: hop => hop.from,
    }),
    to: Option.match(Array.last(hops), {
      onNone: () => '',
      onSome: hop => hop.to,
    }),
  }
}

/** Кто отправил и кому адресован конверт хопа: первый и последний хоп его
    пакета в трассе. */
export const letterOf = (
  trace: Trace,
  hop: Hop,
): Readonly<{ from: string; to: string }> => endpointsOf(trace, hop.packet)

const mediumOf = (world: World, link: string): Medium =>
  Option.match(
    Array.findFirst(world.doc.links, candidate => candidate.id === link),
    { onNone: () => 'cable', onSome: found => found.medium },
  )

/** Путь через картинку сетей раскрытого облака: сети по ходу движения, без
    той, что дальше всех от прямой «вход — выход». */
const innerPath = (
  layout: Layout,
  entry: Point,
  exit: Point,
): ReadonlyArray<string> =>
  Option.match(layout.maybeCloud, {
    onNone: () => [],
    onSome: cloud => {
      const dx = exit.x - entry.x
      const dy = exit.y - entry.y
      const length = Math.max(Math.hypot(dx, dy), 1)
      const along = (point: Point) =>
        ((point.x - entry.x) * dx + (point.y - entry.y) * dy) / length
      const across = (point: Point) =>
        Math.abs(((point.x - entry.x) * dy - (point.y - entry.y) * dx) / length)
      const farthest = Array.reduce(cloud.inner, 0, (most, net) =>
        Math.max(most, across(net)),
      )
      return pipe(
        cloud.inner,
        Array.filter(net => across(net) < farthest),
        Array.sort(Order.mapInput(Order.Number, (net: InnerNet) => along(net))),
        Array.map(net => net.id),
      )
    },
  })

type RawLeg = Omit<Leg, 'index' | 'count'>

/** Перелёты одного пакета: хопы на видимых фигурах, без хопов внутри
    свёрнутого облака; в облаке-картинке — через сети. */
const packetLegs = (
  layout: Layout,
  world: World,
  trace: Trace,
  play: number,
  packet: number,
  isReply: boolean,
): ReadonlyArray<RawLeg> => {
  const visible = pipe(
    trace.hops,
    Array.filter(hop => hop.packet === packet),
    Array.map(hop =>
      Option.map(
        Option.all([
          visibleIdOf(layout, hop.from),
          visibleIdOf(layout, hop.to),
        ]),
        ([from, to]) => ({ from, to, hop }),
      ),
    ),
    Array.getSomes,
    Array.filter(leg => leg.from !== leg.to),
  )
  const cloudId = Option.match(layout.maybeCloud, {
    onNone: () => '',
    onSome: cloud =>
      Array.isReadonlyArrayNonEmpty(cloud.inner) ? cloud.id : '',
  })
  const make = (
    from: string,
    to: string,
    hop: Hop,
    medium: RawLeg['medium'],
  ): RawLeg => ({
    from,
    to,
    hop,
    play,
    packet,
    isReply,
    protocol: protocolOf(hop.envelope),
    medium,
    link: medium === 'inner' ? `${from}|${to}` : hop.link,
  })
  const centre = (id: string): Point =>
    Option.match(shapeOf(layout, id), {
      onNone: () => ({ x: 0, y: 0 }),
      onSome: centreOf,
    })
  return Array.flatMap(visible, (leg, index) => {
    if (cloudId === '' || (leg.to !== cloudId && leg.from !== cloudId)) {
      return [make(leg.from, leg.to, leg.hop, mediumOf(world, leg.hop.link))]
    }
    if (leg.from === cloudId) {
      const previous = Array.get(visible, index - 1)
      return Option.exists(previous, before => before.to === cloudId)
        ? []
        : [make(leg.from, leg.to, leg.hop, mediumOf(world, leg.hop.link))]
    }
    const next = Array.get(visible, index + 1)
    const exit = Option.filter(next, after => after.from === cloudId)
    const path = innerPath(
      layout,
      centre(leg.from),
      Option.match(exit, {
        onNone: () => centre(cloudId),
        onSome: after => centre(after.to),
      }),
    )
    const stops = [
      leg.from,
      ...path,
      ...Option.match(exit, { onNone: () => [], onSome: after => [after.to] }),
    ]
    return Array.map(
      Array.zip(Array.dropRight(stops, 1), Array.drop(stops, 1)),
      ([from, to], position) =>
        position === 0
          ? make(from, to, leg.hop, mediumOf(world, leg.hop.link))
          : Option.match(exit, {
              onSome: after =>
                to === after.to
                  ? make(from, to, after.hop, mediumOf(world, after.hop.link))
                  : make(from, to, leg.hop, 'inner'),
              onNone: () => make(from, to, leg.hop, 'inner'),
            }),
    )
  })
}

/** Где на доске погиб пакет: на хопе с причиной отказа, а если он не ушёл
    с устройства — у отправителя. */
const dropOf = (
  layout: Layout,
  trace: Trace,
): Option.Option<Readonly<{ at: string; outcome: Outcome }>> =>
  trace.outcome._tag === 'Delivered'
    ? Option.none()
    : Option.map(
        pipe(
          Array.findLast(trace.hops, hop =>
            sameMessage(
              hop.note,
              trace.outcome._tag === 'Delivered'
                ? hop.note
                : trace.outcome.reason,
            ),
          ),
          Option.flatMap(hop => visibleIdOf(layout, hop.to)),
          Option.orElse(() => visibleIdOf(layout, trace.outcome.at)),
          Option.orElse(() => visibleIdOf(layout, sourceOf(trace.intent))),
          Option.getOrElse(() => sourceOf(trace.intent)),
          Option.some,
        ),
        at => ({ at, outcome: trace.outcome }),
      )

const withCounts = (legs: ReadonlyArray<RawLeg>): ReadonlyArray<Leg> =>
  Array.map(legs, (leg, position) => {
    const same = Array.filter(
      legs,
      other => other.play === leg.play && other.packet === leg.packet,
    )
    const before = Array.filter(
      Array.take(legs, position),
      other => other.play === leg.play && other.packet === leg.packet,
    )
    return { ...leg, index: before.length + 1, count: same.length }
  })

export type TimelineInput = Readonly<{
  world: World
  stage: ReadonlyArray<PacketStage>
  layout: Layout
  unlocked: ReadonlyArray<string>
}>

/** Показ по умолчанию: с урока 7 (легенда цветов) — все пакеты. */
export const defaultShow = (unlocked: ReadonlyArray<string>): PlayShow =>
  Array.contains(unlocked, 'board.legend') ? 'all' : 'letters'

export const traceOfPlay = (world: World, intent: Intent): Trace =>
  sendIntent(world, intent)[0]

/** Мир, на котором считается трасса `play`: после его операций `after`. */
const worldOfPlay = (world: World, play: Play): World =>
  play.after === undefined ? world : foldWorld(world, play.after)

export const timelineOf = (input: TimelineInput): Timeline => {
  const isDnsShown = Array.contains(input.unlocked, 'board.dnsServer')
  const plays = Array.map(
    Array.filter(input.stage, isPlay),
    (play): PlayResult => {
      const trace = traceOfPlay(worldOfPlay(input.world, play), play.intent)
      return { play, trace, maybeDrop: dropOf(input.layout, trace) }
    },
  )
  const legs = withCounts(
    Array.flatMap(plays, ({ play, trace }, playIndex) => {
      const source = sourceOf(trace.intent)
      return Array.flatMap(
        shownPackets(
          trace,
          play.show ?? defaultShow(input.unlocked),
          isDnsShown,
        ),
        packet =>
          packetLegs(
            input.layout,
            worldOfPlay(input.world, play),
            trace,
            playIndex,
            packet,
            endpointsOf(trace, packet).from !== source,
          ),
      )
    }),
  )
  const walks = Array.filter(input.stage, isWalk)
  const walkMs = Array.reduce(walks, 0, (longest, walk) =>
    Math.max(longest, Math.max(walk.points.length - 1, 0) * WALK_SEGMENT_MS),
  )
  const stuck = Array.some(plays, ({ maybeDrop }) => Option.isSome(maybeDrop))
  const legsMs = Array.isReadonlyArrayEmpty(legs)
    ? Array.isReadonlyArrayNonEmpty(plays)
      ? LEAD_MS + SLOT_MS
      : 0
    : LEAD_MS + legs.length * SLOT_MS + (stuck ? DWELL_MS : 0)
  const pauseDevices = Array.getSomes(
    Array.map(input.stage, item =>
      item._tag === 'PauseAt' ? Option.some(item.device) : Option.none(),
    ),
  )
  const cloudId = Option.match(input.layout.maybeCloud, {
    onNone: () => '',
    onSome: cloud => cloud.id,
  })
  const arrivesAt = (leg: Leg, id: string): boolean =>
    leg.to === id ||
    (id === cloudId && isInnerNet(leg.to) && !isInnerNet(leg.from))
  const pauses = Array.getSomes(
    Array.map(legs, (leg, index) =>
      Array.some(pauseDevices, device =>
        Option.exists(visibleIdOf(input.layout, device), id =>
          arrivesAt(leg, id),
        ),
      )
        ? Option.some(walkMs + LEAD_MS + index * SLOT_MS + FLY_MS)
        : Option.none(),
    ),
  )
  return {
    legs,
    plays,
    walks,
    walkMs,
    pauses,
    totalMs: walkMs + legsMs,
  }
}

// POSITION

/** Что происходит в момент `playhead`. */
export type Moment =
  | Readonly<{ _tag: 'Idle' }>
  | Readonly<{ _tag: 'Walking'; progress: number }>
  | Readonly<{ _tag: 'Waiting'; leg: Leg }>
  | Readonly<{ _tag: 'Flying'; leg: Leg; legIndex: number; progress: number }>
  | Readonly<{ _tag: 'Resting'; leg: Leg; legIndex: number }>
  | Readonly<{ _tag: 'Stuck'; at: string; progress: number }>
  | Readonly<{ _tag: 'Done' }>

const ease = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

export const momentAt = (
  timeline: Timeline,
  playhead: number,
  hasStarted: boolean,
): Moment => {
  if (!hasStarted) {
    return { _tag: 'Idle' }
  }
  if (playhead >= timeline.totalMs) {
    return { _tag: 'Done' }
  }
  if (playhead < timeline.walkMs) {
    return {
      _tag: 'Walking',
      progress: playhead / Math.max(timeline.walkMs, 1),
    }
  }
  const local = playhead - timeline.walkMs
  return Array.match(timeline.legs, {
    onEmpty: (): Moment =>
      Option.match(
        Array.findFirst(timeline.plays, ({ maybeDrop }) =>
          Option.isSome(maybeDrop),
        ),
        {
          onNone: () => ({ _tag: 'Done' }),
          onSome: ({ maybeDrop }) => ({
            _tag: 'Stuck',
            at: Option.match(maybeDrop, {
              onNone: () => '',
              onSome: drop => drop.at,
            }),
            progress: local / (LEAD_MS + SLOT_MS),
          }),
        },
      ),
    onNonEmpty: legs => {
      if (local < LEAD_MS) {
        return { _tag: 'Waiting', leg: legs[0] }
      }
      const slot = Math.floor((local - LEAD_MS) / SLOT_MS)
      const within = local - LEAD_MS - slot * SLOT_MS
      return Option.match(Array.get(legs, slot), {
        onNone: (): Moment => ({ _tag: 'Done' }),
        onSome: (leg): Moment =>
          within < FLY_MS
            ? {
                _tag: 'Flying',
                leg,
                legIndex: slot,
                progress: ease(within / FLY_MS),
              }
            : { _tag: 'Resting', leg, legIndex: slot },
      })
    },
  })
}

/** Перелёты, которые уже закончились к моменту `playhead`. */
export const legsDone = (timeline: Timeline, playhead: number): number =>
  Math.max(
    0,
    Math.min(
      timeline.legs.length,
      Math.floor((playhead - timeline.walkMs - LEAD_MS - FLY_MS) / SLOT_MS + 1),
    ),
  )

/** Конец перелёта `index` (конверт у устройства): точка «Шага». */
export const arrivalOf = (timeline: Timeline, index: number): number =>
  timeline.walkMs + LEAD_MS + index * SLOT_MS + FLY_MS

/** Следующая остановка после `playhead`: пауза сцены или конец. */
export const nextStop = (timeline: Timeline, playhead: number): number =>
  Option.getOrElse(
    Array.findFirst(timeline.pauses, pause => pause > playhead + 1),
    () => timeline.totalMs,
  )

/** Следующий хоп для «Шага»: конверт доходит до следующего устройства. */
export const nextHopStop = (timeline: Timeline, playhead: number): number =>
  Option.getOrElse(
    Array.findFirst(
      Array.makeBy(timeline.legs.length, index => arrivalOf(timeline, index)),
      arrival => arrival > playhead + 1,
    ),
    () => timeline.totalMs,
  )

/** Предыдущий хоп для «Шага назад». */
export const previousHopStop = (timeline: Timeline, playhead: number): number =>
  Option.getOrElse(
    Array.findLast(
      Array.makeBy(timeline.legs.length, index => arrivalOf(timeline, index)),
      arrival => arrival < playhead - 1,
    ),
    () => 0,
  )

/** Где устройство в проходе `walk` в момент `playhead` (координаты документа). */
export const walkPositions = (
  timeline: Timeline,
  playhead: number,
  hasStarted: boolean,
): Readonly<Record<string, Point>> =>
  Object.fromEntries(
    Array.getSomes(
      Array.map(timeline.walks, walk => {
        const segments = Math.max(walk.points.length - 1, 0)
        const progress = hasStarted
          ? Math.min(playhead, timeline.walkMs) / WALK_SEGMENT_MS
          : 0
        const segment = Math.min(
          Math.floor(progress),
          Math.max(segments - 1, 0),
        )
        const within = Math.min(progress - segment, 1)
        return Option.map(
          Option.all([
            Array.get(walk.points, segment),
            Array.get(walk.points, Math.min(segment + 1, segments)),
          ]),
          ([[x1, y1], [x2, y2]]): readonly [string, Point] => [
            walk.device,
            { x: x1 + (x2 - x1) * within, y: y1 + (y2 - y1) * within },
          ],
        )
      }),
    ),
  )

export { isInnerNet }
