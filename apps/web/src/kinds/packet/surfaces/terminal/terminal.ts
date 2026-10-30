import { Array, Effect, Option, Schema } from 'effect'
import { Command, Dom, type Update } from 'foldkit'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'

import { run } from '../../../../net/build'
import { NetMessage } from '../../../../net/message'
import { runCommand } from '../../../../net/terminal'
import { type SurfaceContext, SurfaceOutMessage } from '../../../contract'
import type { PacketTypes } from '../../../types'
import type { PacketOp } from '../../doc'
import { momentsOf } from '../history'
import { terminalFeatures } from '../unlocks'
import { Message } from './message'
import {
  INTERRUPT,
  isInterrupt,
  isRunning,
  sessionOf,
  transcriptOf,
} from './transcript'

// Терминал устройства (`terminal:<устройство>`, план 3.2): тонкий вид над
// `runCommand` модели. Выполненная команда — операция `run(device, line)` в
// журнале задачи; вывод считается по истории, поэтому здесь только строка
// ввода, её история (↑/↓) и ответ на строку, которая не выполнилась.

// MODEL

/** Ответ терминала на строку, которая не стала операцией: команды нет, она
    откроется позже, написана не так или терминал занят программой. */
export const Notice = defineTaggedUnion({
  Hint: { line: Schema.String, message: NetMessage },
  Busy: { line: Schema.String },
})
export type Notice = typeof Notice.Type

export const Model = Schema.Struct({
  draft: Schema.String,
  /** Набранные строки, от старых к новым. */
  typed: Schema.Array(Schema.String),
  /** Какую строку из набранных показывает ↑/↓. */
  maybeRecall: Schema.Option(Schema.Number),
  maybeNotice: Schema.Option(Notice),
  /** `clear`: сколько записей вывода скрыто сверху. */
  hidden: Schema.Number,
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  draft: '',
  typed: [],
  maybeRecall: Option.none(),
  maybeNotice: Option.none(),
  hidden: 0,
}

export type OutMessage = SurfaceOutMessage<PacketOp>

// COMMAND

export const inputId = (device: string): string => `terminal-input-${device}`

export const FocusInput = Command.define('FocusInput', {
  args: { device: Schema.String },
  messages: [Message.CompletedFocusInput],
  execute: ({ device }) =>
    Dom.focus(`#${inputId(device)}`).pipe(
      Effect.as(Message.CompletedFocusInput()),
      Effect.catch(() => Effect.succeed(Message.CompletedFocusInput())),
    ),
})

// UPDATE

type Context = SurfaceContext<PacketTypes>

export type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage
>

const remember = (model: Model, line: string): Model =>
  modifyFields(model, {
    draft: () => '',
    maybeRecall: () => Option.none(),
    typed: typed =>
      line.trim() === '' || Array.last(typed).pipe(Option.contains(line))
        ? typed
        : [...typed, line],
  })

const produce = (model: Model, op: PacketOp): UpdateReturn => ({
  model: modifyFields(model, { maybeNotice: () => Option.none() }),
  outMessage: SurfaceOutMessage.ProducedOps([op]),
})

const notice = (model: Model, value: Notice): UpdateReturn => ({
  model: modifyFields(model, { maybeNotice: () => Option.some(value) }),
})

/** Строка ввода: Ctrl+C, команда — операция; иначе ответ терминала. */
const submit = (context: Context, model: Model, line: string): UpdateReturn => {
  const trimmed = line.trim()
  const world = context.doc
  const available = terminalFeatures(context.unlocked)
  const entries = transcriptOf(
    momentsOf(context.history),
    context.target,
    available,
    sessionOf(world, context.target),
  )
  const running = isRunning(entries)
  if (isInterrupt(trimmed)) {
    return running ? produce(model, run(context.target, INTERRUPT)) : { model }
  }
  if (trimmed === '') {
    return { model }
  }
  if (running) {
    return notice(model, Notice.Busy({ line: trimmed }))
  }
  if (trimmed === 'clear') {
    return {
      model: modifyFields(model, {
        hidden: () => entries.length,
        maybeNotice: () => Option.none(),
      }),
    }
  }
  const result = runCommand(
    world.doc,
    world.state,
    context.target,
    trimmed,
    available,
  )
  return Array.isReadonlyArrayEmpty(result.lines) &&
    Array.isReadonlyArrayEmpty(result.ops)
    ? Option.match(result.maybeHint, {
        onNone: () => ({ model }),
        onSome: message =>
          notice(model, Notice.Hint({ line: trimmed, message })),
      })
    : produce(model, run(context.target, trimmed))
}

const recall = (
  model: Model,
  direction: 'Older' | 'Newer',
): Readonly<{ draft: string; maybeRecall: Option.Option<number> }> => {
  const last = model.typed.length - 1
  const index = Option.match(model.maybeRecall, {
    onNone: () => (direction === 'Older' ? last : model.typed.length),
    onSome: current => (direction === 'Older' ? current - 1 : current + 1),
  })
  return index > last
    ? { draft: '', maybeRecall: Option.none() }
    : Option.match(Array.get(model.typed, Math.max(index, 0)), {
        onNone: () => ({ draft: model.draft, maybeRecall: model.maybeRecall }),
        onSome: line => ({
          draft: line,
          maybeRecall: Option.some(Math.max(index, 0)),
        }),
      })
}

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn => {
    const isEditable = context.mode === 'Edit'
    return Message.match<UpdateReturn>(message, {
      UpdatedDraft: ({ value }) => ({
        model: modifyFields(model, { draft: () => value }),
      }),
      SubmittedLine: () =>
        isEditable
          ? submit(context, remember(model, model.draft), model.draft)
          : { model },
      PressedInterrupt: () =>
        isEditable
          ? submit(context, modifyFields(model, { draft: () => '' }), INTERRUPT)
          : { model },
      PressedRecall: ({ direction }) => {
        const recalled = recall(model, direction)
        return {
          model: modifyFields(model, {
            draft: () => recalled.draft,
            maybeRecall: () => recalled.maybeRecall,
          }),
        }
      },
      ClickedSuggestion: ({ command }) =>
        isEditable
          ? {
              model: modifyFields(model, {
                draft: () => command,
                maybeRecall: () => Option.none(),
              }),
              commands: [FocusInput({ device: context.target })],
            }
          : { model },
      CompletedFocusInput: () => ({ model }),
    })
  }
