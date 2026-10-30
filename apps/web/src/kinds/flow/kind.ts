import { Array, Option, Order, pipe } from 'effect'

import {
  type BoardDoc,
  BoardOp,
  applyOp,
  emptyBoard,
  findNode,
} from '../../domain/board'
import { checkGoal, isHiddenGoal } from '../../domain/goals'
import { simulate } from '../../domain/simulate'
import { renderDomainMessage } from '../../i18n/domainMessage'
import type { UiStrings } from '../../i18n/ui'
import type { BoardKind, OutcomeRow } from '../contract'
import { BoardMessage, BoardState, KindMessage, KindOp } from '../state'
import type { FlowTypes } from '../types'
import * as FlowBoard from './board'
import type { FlowStage, Target } from './dsl'
import { instruments, view } from './view'

// Вид доски System Design: схема из блоков, симулятор потоков, цели по
// схеме и по нагрузке.

// OUTCOME

export type Outcome = Readonly<{
  errorRate: number
  p95: Option.Option<number>
  serverUtilization: ReadonlyArray<number>
  costPerHour: number
}>

export const outcomeOf = (doc: BoardDoc): Outcome => {
  const result = simulate(doc, doc.load)
  return {
    errorRate: result.errorRate,
    p95: result.p95,
    serverUtilization: pipe(
      doc.nodes,
      Array.filter(node => node.kind === 'server'),
      Array.sort(
        Order.mapInput(
          Order.String,
          (node: BoardDoc['nodes'][number]) => node.id,
        ),
      ),
      Array.map(node => result.nodes[node.id]?.utilization ?? 0),
    ),
    costPerHour: result.costPerHour,
  }
}

// «Было → стало» красится по направлению: меньше ошибок и быстрее ответ —
// зелёным, хуже — красным. Ограничитель, например, честно добавляет отказов.
const trend = (before: number, after: number): 'better' | 'worse' | 'same' =>
  after < before - 1e-9 ? 'better' : after > before + 1e-9 ? 'worse' : 'same'

const outcomeRows = (
  beforeDoc: BoardDoc,
  afterDoc: BoardDoc,
  ui: UiStrings,
): ReadonlyArray<OutcomeRow> => {
  const before = outcomeOf(beforeDoc)
  const after = outcomeOf(afterDoc)
  const ms = (p95: Option.Option<number>) =>
    Option.match(p95, { onNone: () => '—', onSome: ui.hud.ms })
  return [
    {
      _tag: 'Compared',
      label: ui.task.resultErrors,
      before: ui.hud.percent(before.errorRate),
      after: ui.hud.percent(after.errorRate),
      trend: trend(before.errorRate, after.errorRate),
    },
    {
      _tag: 'Compared',
      label: ui.task.resultP95,
      before: ms(before.p95),
      after: ms(after.p95),
      trend: Option.match(Option.all([before.p95, after.p95]), {
        onNone: () => 'same',
        onSome: ([was, now]) => trend(was, now),
      }),
    },
    {
      _tag: 'Plain',
      label: ui.task.resultServers,
      value: Array.map(after.serverUtilization, ui.hud.percent).join(' / '),
    },
    {
      _tag: 'Plain',
      label: ui.task.resultCost,
      value: `${ui.hud.perHour(before.costPerHour)} → ${ui.hud.perHour(after.costPerHour)}`,
    },
  ]
}

// TARGETS

const KIND_PREFIX = 'kind:'

const targetKey = (target: Target): string =>
  typeof target === 'string' ? target : `${KIND_PREFIX}${target.kind}`

/** Блок по ключу: id блока или `kind:<вид>` — первый блок этого вида. */
const resolveKey = (doc: BoardDoc, key: string): Option.Option<string> =>
  key.startsWith(KIND_PREFIX)
    ? pipe(
        Array.findFirst(
          doc.nodes,
          node => node.kind === key.slice(KIND_PREFIX.length),
        ),
        Option.map(node => node.id),
      )
    : Option.map(findNode(doc, key), node => node.id)

// JOURNAL

const opText = (op: BoardOp): string =>
  BoardOp.match(op, {
    AddNode: ({ id, kind, maybeCapacity, maybeRegion }) =>
      [
        `AddNode ${id} · ${kind}`,
        ...Option.toArray(Option.map(maybeCapacity, rps => `${rps} rps`)),
        ...Option.toArray(maybeRegion),
      ].join(' · '),
    RemoveNode: ({ id }) => `RemoveNode ${id}`,
    MoveNode: ({ id, x, y }) => `MoveNode ${id} → (${x}, ${y})`,
    Connect: ({ from, to }) => `Connect ${from} → ${to}`,
    Disconnect: ({ from, to }) => `Disconnect ${from} → ${to}`,
    SetLoad: ({ rps }) => `SetLoad ${rps} rps`,
    FailNode: ({ id }) => `FailNode ${id}`,
    RecoverNode: ({ id }) => `RecoverNode ${id}`,
    FailRegion: ({ region }) => `FailRegion ${region}`,
    RecoverRegion: ({ region }) => `RecoverRegion ${region}`,
  })

const targetText = (target: Target): string =>
  typeof target === 'string' ? target : target.kind

const stageText = (item: FlowStage): string =>
  item._tag === 'Highlight'
    ? `Highlight ${targetText(item.target)} · ${item.tone}`
    : `Annotate ${targetText(item.target)} · ${item.key}`

// KIND

export const flow: BoardKind<FlowTypes> = {
  id: 'flow',

  empty: emptyBoard,
  apply: applyOp,
  run: doc => simulate(doc, doc.load),

  checkGoal: (doc, _run, goal) => checkGoal(doc, goal),
  isHiddenGoal,
  solvedGoalText: (goal, doc, ui) =>
    goal._tag === 'MaxErrorRate'
      ? Option.some(
          ui.task.metricGoalPassed(doc.load, simulate(doc, doc.load).errorRate),
        )
      : Option.none(),
  outcome: outcomeRows,

  proseContext: (doc, run) => ({ sim: run, doc }),
  annotationInput: (_doc, run) => run,
  resolveTarget: resolveKey,
  stage: {
    targets: item => [targetKey(item.target)],
    annotationKey: item =>
      item._tag === 'Annotate' ? Option.some(item.key) : Option.none(),
    describe: stageText,
  },
  targetName: (doc, target, ui) =>
    Option.match(resolveKey(doc, target), {
      onNone: () => target,
      onSome: id => (id === 'users' ? ui.kindName.client : id),
    }),
  describeOp: opText,
  renderMessage: (_locale, ui, message) =>
    renderDomainMessage(ui.domain, message),

  op: {
    wrap: op => KindOp.FlowOp({ op }),
    unwrap: stored =>
      stored._tag === 'FlowOp' ? Option.some(stored.op) : Option.none(),
  },
  message: {
    wrap: message => KindMessage.FlowMessage({ message }),
    unwrap: stored =>
      stored._tag === 'FlowMessage'
        ? Option.some(stored.message)
        : Option.none(),
  },

  board: {
    init: FlowBoard.initialModel,
    state: {
      wrap: model => BoardState.FlowBoard({ model }),
      unwrap: stored =>
        stored._tag === 'FlowBoard' ? Option.some(stored.model) : Option.none(),
    },
    message: {
      wrap: message => BoardMessage.GotFlowBoardMessage({ message }),
      unwrap: stored =>
        stored._tag === 'GotFlowBoardMessage'
          ? Option.some(stored.message)
          : Option.none(),
    },
    update: FlowBoard.update,
    pressDelete: FlowBoard.pressDelete,
    interrupt: FlowBoard.interrupt,
    frame: FlowBoard.frame,
    view,
    instruments,
  },
  surfaces: [],

  quizzes: ['PickDevice'],
  picture: () => Option.none(),
}
