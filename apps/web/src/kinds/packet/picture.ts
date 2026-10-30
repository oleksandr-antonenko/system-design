import { Array, Option, Order, Record, Result, pipe } from 'effect'

import type { Locale } from '../../i18n/locale'
import type { UiStrings } from '../../i18n/ui'
import { pairOf, pickParts } from '../../lesson/quiz'
import { type NetOp, applyAll } from '../../net/doc'
import {
  type Device,
  type DeviceId,
  type DeviceKind,
  type NetState,
  deviceKindName,
  kindOf,
} from '../../net/model'
import {
  type Hop,
  type RouteMatch,
  type StackLevel,
  TableChange,
  type Trace,
} from '../../net/packet'
import { renderNetMessage } from '../../net/text'
import { addressOf, associationOf } from '../../net/topology'
import { settle } from '../../net/trace'
import { type World, sendIntent } from '../../net/world'
import type { BoardContext, BoardQuiz, Tone } from '../contract'
import type { PacketTypes } from '../types'
import { AUTO_PLAY, type Model } from './board'
import type { DeviceTable, PacketStage, Preview, Room } from './dsl'
import {
  type Layout,
  type NodeText,
  type Point,
  isInnerNet,
  layoutBoard,
  visibleIdOf,
} from './layout'
import {
  type Leg,
  type Moment,
  type Timeline,
  arrivalOf,
  legsDone,
  momentAt,
  timelineOf,
  walkPositions,
} from './timeline'

// Картина доски на один кадр (design D2 add-network-board): раскладка,
// трасса, где конверт, что подсвечено. Чистая функция контекста и Model;
// вид только рисует её.

type Context = BoardContext<PacketTypes>

export type Mark = Readonly<{ target: string; tone: Tone; isPulsing: boolean }>

export type Note = Readonly<{
  target: string
  text: string
  tone: Tone
  /** Подпись под фигурой: над ней стоит конверт. */
  isBelow?: boolean
}>

/** Состояние квиза на доске: что выбрано, что верно, что пропущено. */
export type QuizMarks = Readonly<{
  quiz: BoardQuiz
  isAnswered: boolean
  picked: ReadonlyArray<string>
  answer: ReadonlyArray<string>
}>

export type Picture = Readonly<{
  context: Context
  model: Model
  layout: Layout
  timeline: Timeline
  /** Трасса после ответа на квиз: её доска проигрывает сама. */
  revealed: Timeline
  moment: Moment
  /** Проигрыватель стоит или идёт: «Пуск» показывает трассу. */
  playhead: number
  hasStarted: boolean
  isDone: boolean
  /** Хоп, на котором сейчас конверт (для панели конверта и таблиц). */
  maybeLeg: Option.Option<Readonly<{ leg: Leg; index: number }>>
  /** Связи, по которым конверт уже прошёл. */
  litLinks: ReadonlyArray<string>
  marks: ReadonlyArray<Mark>
  notes: ReadonlyArray<Note>
  state: NetState
  /** Строки таблиц, изменившиеся на текущем хопе. */
  changes: ReadonlyArray<TableChange>
  /** Строка маршрутов, по которой устройство у конверта отдаёт его дальше
      (у конверта в пути — то, откуда он вылетел): её подсвечивает карточка. */
  maybeRoute: Option.Option<RouteMatch>
  maybeCard: Option.Option<DeviceId>
  cardTables: ReadonlyArray<DeviceTable>
  maybeOpenLevel: Option.Option<StackLevel>
  quiz: Option.Option<QuizMarks>
  hidden: ReadonlyArray<string>
  isOpen: (feature: string) => boolean
  isNew: (feature: string) => boolean
  name: (id: string) => string
  note: (id: string) => string
  reason: (trace: Trace) => string
  previews: ReadonlyArray<Preview>
}>

// TEXT

const kindOfId = (context: Context, id: string): Option.Option<DeviceKind> =>
  Option.map(
    Array.findFirst(context.doc.doc.devices, device => device.id === id),
    kindOf,
  )

/** Подпись устройства: из урока, иначе английское имя вида. */
const deviceName = (context: Context, id: string): string =>
  Option.match(context.label(id), {
    onSome: label => label.name,
    onNone: () =>
      Option.match(kindOfId(context, id), {
        onNone: () => id,
        onSome: kind => deviceKindName[kind],
      }),
  })

/** Подсказка к устройству: «Router — роутер, маршрутизатор: …». */
const deviceHint = (context: Context, id: string): string =>
  Option.match(kindOfId(context, id), {
    onNone: () => '',
    onSome: kind =>
      `${deviceKindName[kind]} — ${context.ui.packetBoard.kindHint[kind]}`,
  })

const isUnlocked = (context: Context, feature: string): boolean =>
  Array.contains(context.unlocked, feature)

/** Адрес устройства виден с урока 2; адреса транзитных роутеров — с урока 8
    вместе с таблицами маршрутов: в уроке 4 у цепочки только имена. */
export const isAddressOpen = (
  context: Readonly<{ doc: World; unlocked: ReadonlyArray<string> }>,
  id: DeviceId,
): boolean =>
  Array.contains(context.unlocked, 'board.addresses') &&
  (Array.contains(context.unlocked, 'board.routes') ||
    !Array.some(
      context.doc.doc.devices,
      device => device.id === id && device._tag === 'Transit',
    ))

const nodeText =
  (context: Context, state: NetState, hidden: ReadonlyArray<string>) =>
  (id: DeviceId): NodeText => {
    const title = deviceName(context, id)
    const note = Option.match(context.label(id), {
      onNone: () => '',
      onSome: label => label.note ?? '',
    })
    const isAddressShown =
      isAddressOpen(context, id) &&
      !Array.contains(hidden, 'addresses') &&
      !Array.contains(hidden, id)
    const isOffline =
      !Array.contains(hidden, 'links') &&
      Array.some(
        context.doc.doc.links,
        link =>
          (link.a === id || link.b === id) &&
          link.medium === 'radio' &&
          Option.exists(
            associationOf(context.doc.doc, link),
            association => association._tag === 'NotAssociated',
          ),
      ) &&
      Array.some(
        context.doc.doc.devices,
        device => device.id === id && device._tag === 'Host',
      )
    const sub = isOffline
      ? context.ui.packetBoard.link.noWifi
      : isAddressShown
        ? Option.getOrElse(addressOf(context.doc.doc, state, id), () =>
            Array.some(
              context.doc.doc.devices,
              device =>
                device.id === id &&
                (device._tag === 'Host' || device._tag === 'Router'),
            )
              ? context.ui.packetBoard.card.noAddress
              : note,
          )
        : Array.contains(hidden, id)
          ? context.ui.packetBoard.quiz.hiddenUntilAnswer
          : note
    return { title, sub, hint: deviceHint(context, id) }
  }

// STATE ON THE WAY

/** Таблицы сети во время проигрывания: состояние до трассы плюс изменения
    хопов, которые уже случились. */
const applyChange = (state: NetState, change: TableChange): NetState =>
  TableChange.match(change, {
    MacLearned: ({ device, mac, link }) => ({
      ...state,
      macTables: [
        ...Array.filter(
          state.macTables,
          entry => !(entry.device === device && entry.mac === mac),
        ),
        { device, mac, link },
      ],
    }),
    ArpLearned: ({ device, ip, mac }) => ({
      ...state,
      arp: [
        ...Array.filter(
          state.arp,
          entry => !(entry.device === device && entry.ip === ip),
        ),
        { device, ip, mac },
      ],
    }),
    LeaseGranted: ({ router, mac, ip }) => ({
      ...state,
      leases: [
        ...Array.filter(
          state.leases,
          lease => !(lease.router === router && lease.mac === mac),
        ),
        { router, mac, ip },
      ],
    }),
    NatAdded: entry => ({
      ...state,
      nat: [
        ...state.nat,
        {
          router: entry.router,
          kind: entry.kind,
          proto: entry.proto,
          inside: entry.inside,
          insidePort: entry.insidePort,
          outside: entry.outside,
          outsidePort: entry.outsidePort,
          remote: entry.remote,
          remotePort: entry.remotePort,
        },
      ],
    }),
    DnsCached: ({ device, name, rtype, value, expiresAt }) => ({
      ...state,
      dnsCache: [
        ...Array.filter(
          state.dnsCache,
          entry =>
            !(
              entry.device === device &&
              entry.name === name &&
              entry.rtype === rtype
            ),
        ),
        { device, name, rtype, value, expiresAt },
      ],
    }),
    VpnSessionLearned: () => state,
    RelayOpened: () => state,
  })

const stateOnTheWay = (
  base: NetState,
  timeline: Timeline,
  maybeLeg: Option.Option<Readonly<{ leg: Leg; index: number }>>,
  isDone: boolean,
): NetState => {
  if (isDone) {
    return Array.reduce(timeline.plays, base, (state, play) =>
      Array.reduce(play.trace.hops, state, (current, hop) =>
        Array.reduce(hop.changes, current, applyChange),
      ),
    )
  }
  return Option.match(maybeLeg, {
    onNone: () => base,
    onSome: ({ leg }) =>
      Array.reduce(timeline.plays, base, (state, play, playIndex) =>
        playIndex > leg.play
          ? state
          : Array.reduce(
              Array.filter(
                play.trace.hops,
                hop =>
                  playIndex < leg.play || hop.arrivedAt <= leg.hop.arrivedAt,
              ),
              state,
              (current, hop) => Array.reduce(hop.changes, current, applyChange),
            ),
      ),
  })
}

// QUIZ

const quizMarks = (context: Context): Option.Option<QuizMarks> =>
  Option.map(context.maybeQuiz, quiz => ({
    quiz,
    isAnswered: Option.isSome(quiz.maybeAnswer),
    picked: Option.match(quiz.maybePicked, {
      onNone: () => [],
      onSome: pickParts,
    }),
    answer: Option.match(quiz.maybeAnswer, {
      onNone: () => [],
      onSome: pickParts,
    }),
  }))

const quizTone = (
  marks: QuizMarks,
  id: string,
): Option.Option<Readonly<{ tone: Tone; isPulsing: boolean }>> => {
  if (!marks.isAnswered) {
    return Array.contains(marks.quiz.candidates, id) &&
      marks.quiz.kind !== 'PickLayer' &&
      marks.quiz.kind !== 'PickRule' &&
      marks.quiz.slots.length === 0
      ? Option.some({ tone: 'info', isPulsing: true })
      : Option.none()
  }
  const isPicked = Array.contains(marks.picked, id)
  const isAnswer = Array.contains(marks.answer, id)
  return isAnswer
    ? Option.some({
        tone: isPicked || !marks.quiz.multiple ? 'ok' : 'warn',
        isPulsing: false,
      })
    : isPicked
      ? Option.some({ tone: 'bad', isPulsing: false })
      : Option.none()
}

/** Ответ `Match`: место → чип. */
export const pairsOf = (
  parts: ReadonlyArray<string>,
): Readonly<Record<string, string>> =>
  Object.fromEntries(Array.map(parts, pairOf))

// STAGE

const stageItems = <Tag extends PacketStage['_tag']>(
  stage: ReadonlyArray<PacketStage>,
  tag: Tag,
): ReadonlyArray<Extract<PacketStage, Readonly<{ _tag: Tag }>>> =>
  Array.filter(
    stage,
    (item): item is Extract<PacketStage, Readonly<{ _tag: Tag }>> =>
      item._tag === tag,
  )

const fogVisible = (
  world: World,
  stage: ReadonlyArray<PacketStage>,
): Option.Option<ReadonlyArray<DeviceId>> =>
  Option.map(Array.head(stageItems(stage, 'Fog')), fog => {
    const seen = Array.flatMap(world.state.commandLog, record => [
      record.device,
      ...record.saw,
      ...Option.toArray(record.maybeTarget),
    ])
    const settled = settle(world.doc, world.state)
    const touched = Array.filter(
      world.doc.devices,
      device =>
        Array.contains(seen, device.id) ||
        Option.exists(addressOf(world.doc, settled, device.id), ip =>
          Array.contains(seen, ip),
        ),
    )
    return Array.dedupe([
      ...fog.visible,
      ...Array.map(touched, device => device.id),
    ])
  })

/** Высота строки черновика под устройством. */
export const DRAFT_ROW = 22

/** Устройство, под которым черновик рисует строку операции; у нового
    устройства и кабеля строки нет — их видно на доске. */
export const draftDevice = (op: NetOp): string =>
  op._tag === 'AddDevice' || op._tag === 'Connect'
    ? ''
    : 'device' in op && typeof op.device === 'string'
      ? op.device
      : 'router' in op && typeof op.router === 'string'
        ? op.router
        : ''

/** Сколько места нужно под устройствами для строк черновика. */
const draftRoom = (
  previews: ReadonlyArray<Preview>,
): Readonly<Record<string, number>> => {
  const none: Readonly<Record<string, number>> = {}
  return Array.reduce(
    Array.flatMap(previews, preview => preview.ops),
    none,
    (room, op) => {
      const device = draftDevice(op)
      return device === ''
        ? room
        : { ...room, [device]: (room[device] ?? 0) + DRAFT_ROW }
    },
  )
}

/** Доска шага с черновиком сцены поверх: новые устройства черновика тоже
    стоят на доске (пунктиром). */
const withPreview = (world: World, previews: ReadonlyArray<Preview>): World =>
  Array.isReadonlyArrayEmpty(previews)
    ? world
    : {
        doc: Array.reduce(previews, world.doc, (doc, preview) =>
          Array.reduce(preview.ops, doc, (current, op) =>
            op._tag === 'AddDevice' || op._tag === 'Connect'
              ? Result.getOrElse(applyAll(current, [op]), () => current)
              : current,
          ),
        ),
        state: world.state,
      }

// PICTURE

const playheadOf = (
  model: Model,
  timeline: Timeline,
  context: Context,
): Readonly<{ playhead: number; hasStarted: boolean }> => {
  const isWaitingForPick =
    context.mode === 'Pick' &&
    !model.hasStarted &&
    Option.exists(
      context.maybeQuiz,
      quiz =>
        quiz.kind === 'NextHop' ||
        quiz.kind === 'PickLayer' ||
        quiz.kind === 'PickRule',
    )
  return isWaitingForPick
    ? {
        playhead: Option.getOrElse(Array.head(timeline.pauses), () =>
          timeline.legs.length > 0
            ? arrivalOf(timeline, timeline.legs.length - 1)
            : 0,
        ),
        hasStarted: true,
      }
    : {
        playhead: model.playhead,
        hasStarted:
          model.hasStarted &&
          (model.playedTotal === timeline.totalMs ||
            model.playedTotal === AUTO_PLAY),
      }
}

export const pictureOf = (context: Context, model: Model): Picture => {
  const stage = context.stage
  const hidden =
    context.mode === 'Pick'
      ? Option.match(context.maybeQuiz, {
          onNone: () => [],
          onSome: quiz => quiz.hidden,
        })
      : []
  const previews = isUnlocked(context, 'board.draft')
    ? stageItems(stage, 'Preview')
    : []
  const world = withPreview(context.doc, previews)
  const settled = context.run.settled
  const isExpanded = Option.getOrElse(model.maybeCloudOpen, () =>
    Array.isReadonlyArrayNonEmpty(stageItems(stage, 'Expand')),
  )
  const walks = stageItems(stage, 'Walk')
  const walkMs = Array.reduce(walks, 0, (longest, walk) =>
    Math.max(longest, Math.max(walk.points.length - 1, 0) * 1400),
  )
  const grabbed = Option.match(model.maybeGrab, {
    onNone: () => ({}),
    onSome: grab =>
      grab._tag === 'Device' ? { [grab.id]: { x: grab.x, y: grab.y } } : {},
  })
  const walkTimeline: Timeline = {
    legs: [],
    plays: [],
    walks,
    walkMs,
    pauses: [],
    totalMs: walkMs,
  }
  const moved: Readonly<Record<string, Point>> = {
    ...walkPositions(walkTimeline, model.playhead, model.hasStarted),
    ...grabbed,
  }
  const layout = layoutBoard({
    doc: world.doc,
    unlocked: context.unlocked,
    isNarrow: context.isNarrow,
    isCloudOpen: isExpanded,
    maybeFog: isUnlocked(context, 'board.fog')
      ? fogVisible(world, stage)
      : Option.none(),
    rooms: Array.filter(
      stageItems(stage, 'Room'),
      (room: Room) => room.width > 0,
    ),
    moved,
    text: nodeText(context, settled, hidden),
    below: draftRoom(previews),
  })
  const isPlayHidden = Array.contains(hidden, 'play')
  // NOTE: трассы сцены считаются на `stageDoc` — мире до хода ученика, если
  // сцена — его ход (открытая страница), иначе это тот же документ.
  const stageWorld = withPreview(context.stageDoc, previews)
  const timeline = timelineOf({
    world: stageWorld,
    stage: isPlayHidden ? [] : stage,
    layout,
    unlocked: context.unlocked,
  })
  const revealed = isPlayHidden
    ? timelineOf({
        world: stageWorld,
        stage,
        layout,
        unlocked: context.unlocked,
      })
    : timeline
  const position = playheadOf(model, timeline, context)
  const moment = momentAt(timeline, position.playhead, position.hasStarted)
  const isDone = moment._tag === 'Done'
  const maybeLeg = pipe(
    moment._tag === 'Flying' || moment._tag === 'Resting'
      ? Option.some({ leg: moment.leg, index: moment.legIndex })
      : moment._tag === 'Waiting'
        ? Option.some({ leg: moment.leg, index: 0 })
        : Option.none(),
  )
  const done = position.hasStarted ? legsDone(timeline, position.playhead) : 0
  const litLinks = Array.dedupe(
    Array.map(
      Array.take(timeline.legs, isDone ? timeline.legs.length : done),
      leg => leg.link,
    ),
  )
  const state = stateOnTheWay(
    settled,
    timeline,
    maybeLeg,
    isDone && position.hasStarted,
  )
  const changes = Option.match(maybeLeg, {
    onNone: () => [],
    onSome: ({ leg }) => (moment._tag === 'Resting' ? leg.hop.changes : []),
  })
  const quiz = quizMarks(context)
  const name = (id: string) =>
    isInnerNet(id)
      ? Option.match(context.label('internet'), {
          onNone: () => context.ui.packetBoard.zone.internet,
          onSome: label => label.name,
        })
      : deviceName(context, id)
  const reason = (trace: Trace) =>
    trace.outcome._tag === 'Delivered'
      ? ''
      : renderNetMessage(context.locale, trace.outcome.reason, name)
  const quizHalos: ReadonlyArray<Mark> = Option.match(quiz, {
    onNone: () => [],
    onSome: marks =>
      Array.getSomes(
        Array.map(
          Array.dedupe([...marks.quiz.candidates, ...marks.answer]),
          id =>
            Option.map(quizTone(marks, id), tone => ({
              target: id,
              tone: tone.tone,
              isPulsing: tone.isPulsing && !context.isReducedMotion,
            })),
        ),
      ),
  })
  const stageHalos = Array.map(stageItems(stage, 'Highlight'), item => ({
    target: item.target,
    tone: item.tone,
    isPulsing: false,
  }))
  const focusHalos = Option.match(context.maybeTask, {
    onNone: () => [],
    onSome: task =>
      Array.map(
        [
          ...task.focusNodes,
          ...Array.map(task.focusEdges, edge => `link:${edge}`),
        ],
        target => ({
          target,
          tone: 'bad' as const,
          isPulsing: false,
        }),
      ),
  })
  const selectionHalos = Array.map(model.selection, target => ({
    target,
    tone: 'info' as const,
    isPulsing: false,
  }))
  const stageNotes = Array.map(stageItems(stage, 'Annotate'), item => ({
    target: item.target,
    text: context.annotationText(item.key),
    tone: item.tone,
  }))
  const quizNotes: ReadonlyArray<Note> = Option.match(quiz, {
    onNone: () => [],
    onSome: marks =>
      marks.isAnswered
        ? Array.getSomes(
            Array.map(Array.dedupe([...marks.picked, ...marks.answer]), id =>
              Option.map(Option.fromNullishOr(marks.quiz.tags[id]), text => ({
                target: id,
                text,
                tone: Array.contains(marks.answer, id)
                  ? ('ok' as const)
                  : ('bad' as const),
              })),
            ),
          )
        : [],
  })
  const dropNotes: ReadonlyArray<Note> =
    moment._tag === 'Done' || moment._tag === 'Stuck'
      ? Array.getSomes(
          Array.map(timeline.plays, play =>
            Option.map(play.maybeDrop, (drop): Note => ({
              target: drop.at,
              text: reason(play.trace),
              tone: 'bad',
              isBelow: true,
            })),
          ),
        )
      : []
  const doneNotes: ReadonlyArray<Note> =
    moment._tag === 'Done' &&
    position.hasStarted &&
    Array.every(timeline.plays, play => Option.isNone(play.maybeDrop))
      ? Option.match(Array.last(timeline.legs), {
          onNone: () => [],
          onSome: leg => {
            const ui = context.ui.packetBoard.done
            const isPage = Option.exists(
              Array.get(timeline.plays, leg.play),
              play =>
                play.trace.outcome._tag === 'Delivered' &&
                play.trace.outcome.answer._tag === 'Page',
            )
            return [
              {
                target: leg.to,
                text: leg.isReply
                  ? isPage
                    ? ui.page
                    : ui.reply
                  : ui.delivered,
                tone: 'ok',
              },
            ]
          },
        })
      : []
  // `hideUntilAnswered: ['tables']`: таблицы сцены открываются только после
  // ответа, иначе таймер в карточке подсказывает ответ квиза. Таблицы
  // нескольких устройств: карточка — у того, где сейчас конверт.
  const stageTables = Array.contains(hidden, 'tables')
    ? []
    : stageItems(stage, 'ShowTable')
  const envelopeAt = Option.map(maybeLeg, ({ leg }) =>
    moment._tag === 'Resting' ? leg.hop.to : leg.hop.from,
  )
  const cardFromStage = pipe(
    envelopeAt,
    Option.flatMap(at =>
      Array.findFirst(stageTables, item => item.device === at),
    ),
    Option.orElse(() => Array.head(stageTables)),
    Option.map(item => item.device),
  )
  const maybeCard = Option.orElse(model.maybeCard, () => cardFromStage)
  const maybeRoute = Option.flatMap(maybeLeg, ({ leg }) =>
    moment._tag === 'Resting'
      ? pipe(
          Array.get(timeline.plays, leg.play),
          Option.flatMap(play =>
            Array.findFirst(
              play.trace.hops,
              hop =>
                hop.packet === leg.hop.packet &&
                hop.from === leg.hop.to &&
                hop.sentAt >= leg.hop.arrivedAt,
            ),
          ),
          Option.flatMap(hop => hop.maybeRoute),
        )
      : leg.hop.maybeRoute,
  )
  return {
    context,
    model,
    layout,
    timeline,
    revealed,
    moment,
    playhead: position.playhead,
    hasStarted: position.hasStarted,
    isDone,
    maybeLeg,
    litLinks,
    marks: [...focusHalos, ...stageHalos, ...selectionHalos, ...quizHalos],
    notes: [...stageNotes, ...quizNotes, ...dropNotes, ...doneNotes],
    state,
    changes,
    maybeRoute,
    maybeCard,
    cardTables: Array.map(stageTables, item => item.table),
    maybeOpenLevel: Option.map(
      Array.head(stageItems(stage, 'OpenEnvelope')),
      item => item.level,
    ),
    quiz,
    hidden,
    isOpen: feature => isUnlocked(context, feature),
    isNew: feature => Array.contains(context.newFeatures, feature),
    name,
    note: id =>
      Option.match(context.label(id), {
        onNone: () => '',
        onSome: label => label.note ?? '',
      }),
    reason,
    previews,
  }
}

// HELPERS FOR VIEWS

export const deviceOf = (
  picture: Picture,
  id: DeviceId,
): Option.Option<Device> =>
  Array.findFirst(picture.context.doc.doc.devices, device => device.id === id)

/** Фигура на доске, которой соответствует цель: устройство или облако. */
export const shapeIdOf = (
  picture: Picture,
  target: string,
): Option.Option<string> =>
  target === 'internet' || target === 'zone:internet'
    ? Option.map(picture.layout.maybeCloud, cloud => cloud.id)
    : visibleIdOf(picture.layout, target)

/** Трасса, которую видно на доске после проигрывания (для «было → стало»). */
export const traceAfter = (
  world: World,
  play: PacketStage,
): Option.Option<Trace> =>
  play._tag === 'Play'
    ? Option.some(sendIntent(world, play.intent)[0])
    : Option.none()

export const locale = (picture: Picture): Locale => picture.context.locale

export const strings = (picture: Picture): UiStrings['packetBoard'] =>
  picture.context.ui.packetBoard

export const byNumber = Order.Number

export const recordSize = (record: Readonly<Record<string, string>>): number =>
  Record.size(record)

export type { Hop }
