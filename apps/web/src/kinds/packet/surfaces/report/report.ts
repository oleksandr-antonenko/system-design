import { Array, Effect, Option, Schema } from 'effect'
import { Command, Dom, type Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { report } from '../../../../net/build'
import { type Goal, checkGoal, isSymptomGone } from '../../../../net/goals'
import { NetMessage } from '../../../../net/message'
import { type DeviceId, Evidence, Fault } from '../../../../net/model'
import { Intent } from '../../../../net/packet'
import { lastReport } from '../../../../net/report'
import { type TerminalLine, runCommand } from '../../../../net/terminal'
import { type SurfaceContext, SurfaceOutMessage } from '../../../contract'
import type { PacketTypes } from '../../../types'
import type { PacketOp } from '../../doc'
import { momentsOf, sameOp } from '../history'
import { sinceReset } from '../terminal/transcript'
import { terminalFeatures } from '../unlocks'
import { Message } from './message'

// Отчёт для ИИ-ассистента (урок 15, поверхность `report`): строки вывода
// команд как доказательство и где поломка. «Отправить» пишет в журнал
// задачи операцию `report`, ответ ассистента считает цель `Reported`, а
// «Применить» добавляет в журнал её исправление. Выбор строк и диагноза —
// черновик карточки, сеть он не меняет.

// MODEL

export const MAX_EVIDENCE = 2

export const Model = Schema.Struct({
  evidence: Schema.Array(Evidence),
  maybeFault: Schema.Option(Fault),
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  evidence: [],
  maybeFault: Option.none(),
}

export type OutMessage = SurfaceOutMessage<PacketOp>

type Context = SurfaceContext<PacketTypes>

export type ReportGoal = Extract<Goal, Readonly<{ _tag: 'Reported' }>>

/** Цель отчёта в задаче шага. */
export const reportGoalOf = (
  goals: ReadonlyArray<Goal>,
): Option.Option<ReportGoal> =>
  Array.findFirst(goals, (goal): goal is ReportGoal => goal._tag === 'Reported')

export const isSameLine = (left: Evidence, right: Evidence): boolean =>
  left.text === right.text && left.tag === right.tag

// TRANSCRIPT

/** Выполненная команда и её вывод: из них ученик выбирает доказательство. */
export type RanCommand = Readonly<{
  device: DeviceId
  line: string
  lines: ReadonlyArray<TerminalLine>
}>

/** Команды этой сети (после последнего `Reset`) на всех устройствах, по
    порядку: вывод каждой считается на мире до неё, как в терминале. */
export const commandsOf = (context: Context): ReadonlyArray<RanCommand> =>
  Array.flatMap(sinceReset(momentsOf(context.history)), moment =>
    moment.op._tag === 'RunCommand'
      ? [
          {
            device: moment.op.device,
            line: moment.op.line,
            lines: runCommand(
              moment.before.doc,
              moment.before.state,
              moment.op.device,
              moment.op.line,
              terminalFeatures(context.unlocked),
            ).lines,
          },
        ]
      : [],
  )

// REPLY

/** Ответ ассистента на последний отправленный отчёт. */
export type Reply = Readonly<{
  message: NetMessage
  /** Отчёт точный, а симптом ещё на месте: можно применить исправление. */
  canApply: boolean
  /** Исправление ассистента уже в журнале после отчёта. */
  isApplied: boolean
}>

/** Исправление ассистента применено после последнего отчёта. */
const isFixApplied = (context: Context, goal: ReportGoal): boolean =>
  Option.match(Array.head(goal.fix), {
    onNone: () => false,
    onSome: first =>
      Option.match(
        Array.findLastIndex(context.journal, op => op._tag === 'Report'),
        {
          onNone: () => false,
          onSome: index =>
            Array.some(Array.drop(context.journal, index + 1), op =>
              sameOp(op, first),
            ),
        },
      ),
  })

export const replyOf = (context: Context): Option.Option<Reply> =>
  Option.flatMap(reportGoalOf(context.goals), goal =>
    Option.map(lastReport(context.doc.state.reports), last => {
      const world = context.doc
      const check = checkGoal(world.doc, context.run.settled, goal)
      const isGone = isSymptomGone(world.doc, world.state, goal.symptom)
      const isApplied = isGone && isFixApplied(context, goal)
      return check.met
        ? {
            message:
              isGone && !isApplied
                ? NetMessage.ReportConfirmed({ fault: last.fault })
                : NetMessage.ReportAccepted({ fault: last.fault }),
            canApply: !isGone,
            isApplied,
          }
        : {
            message: Option.getOrElse(check.maybeFailure, () =>
              NetMessage.ReportAccepted({ fault: last.fault }),
            ),
            canApply: false,
            isApplied: false,
          }
    }),
  )

/** Как открывался адрес симптома, когда сеть сломалась: открытие из шага,
    до ходов ученика. */
export const symptomWorld = (context: Context, goal: ReportGoal) =>
  Option.match(
    Array.findFirst(
      sinceReset(momentsOf(context.history)),
      moment =>
        moment.op._tag === 'Send' &&
        Schema.toEquivalence(Intent)(moment.op.intent, goal.symptom),
    ),
    {
      onNone: () => context.doc,
      onSome: moment => moment.before,
    },
  )

// COMMAND

export const REPLY_ID = 'report-reply'

/** Ответ ассистента появляется под формой: показать его, даже если
    карточка прокручена к началу. */
export const ScrollToReply = Command.define('ScrollToReply', {
  messages: [Message.CompletedScrollToReply],
  execute: Dom.scrollIntoViewIfNotVisible(`#${REPLY_ID}`).pipe(
    Effect.as(Message.CompletedScrollToReply()),
    Effect.catch(() => Effect.succeed(Message.CompletedScrollToReply())),
  ),
})

// UPDATE

export type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage
>

const toggled = (
  evidence: ReadonlyArray<Evidence>,
  line: Evidence,
): ReadonlyArray<Evidence> =>
  Array.some(evidence, picked => isSameLine(picked, line))
    ? Array.filter(evidence, picked => !isSameLine(picked, line))
    : Array.takeRight([...evidence, line], MAX_EVIDENCE)

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn => {
    const isEditable = context.mode === 'Edit'
    return Message.match<UpdateReturn>(message, {
      ToggledLine: ({ text, tag }) => ({
        model: isEditable
          ? modifyFields(model, {
              evidence: evidence => toggled(evidence, { text, tag }),
            })
          : model,
      }),
      SelectedFault: ({ fault }) => ({
        model: isEditable
          ? modifyFields(model, { maybeFault: () => Option.some(fault) })
          : model,
      }),
      ClickedSend: () =>
        Option.match(model.maybeFault, {
          onNone: () => ({ model }),
          onSome: fault =>
            isEditable && Array.isReadonlyArrayNonEmpty(model.evidence)
              ? {
                  model,
                  commands: [ScrollToReply()],
                  outMessage: SurfaceOutMessage.ProducedOps([
                    report(
                      fault,
                      Array.map(
                        model.evidence,
                        (line): readonly [string, string] => [
                          line.text,
                          line.tag,
                        ],
                      ),
                    ),
                  ]),
                }
              : { model },
        }),
      ClickedApply: () =>
        Option.match(
          Option.filter(
            replyOf(context),
            reply => isEditable && reply.canApply,
          ),
          {
            onNone: () => ({ model }),
            onSome: () =>
              Option.match(reportGoalOf(context.goals), {
                onNone: () => ({ model }),
                onSome: goal => ({
                  model,
                  outMessage: SurfaceOutMessage.ProducedOps(goal.fix),
                }),
              }),
          },
        ),
      CompletedScrollToReply: () => ({ model }),
    })
  }
