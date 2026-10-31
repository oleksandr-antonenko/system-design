import { Array, Match, Option, Schema, pipe } from 'effect'
import { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import type { UiStrings } from '../../../i18n/ui'
import type {
  SurfaceContext,
  SurfaceDefinition,
  SurfaceOutMessage,
} from '../../contract'
import { SurfaceMessage, SurfaceState } from '../../state'
import type { ScenarioTypes } from '../../types'
import { type Assistant, type ChatLine, latestActive } from '../assistant'
import { ScenarioOp } from '../doc'
import { classes, ghostOps, nameOf, produceOps } from './parts'

// Чат с ИИ-ассистентом `assistant:<владелец>` (урок 10): ассистент просит
// доступ к CRM, ученик выбирает, что отправить: пароль администратора,
// токен текстом или ссылку на запись в менеджере паролей. Тексты сообщений
// — подписи урока; строк паролей и токенов нет нигде, только маски.

type Context = SurfaceContext<ScenarioTypes>

// MODEL

export const Notice = Schema.Literals(['none', 'needsToken', 'needsSaved'])
export type Notice = typeof Notice.Type

export const Model = Schema.Struct({ notice: Notice })
export type Model = typeof Model.Type

export const initialModel: Model = { notice: 'none' }

// MESSAGE

export const Message = defineMessageUnion({
  ClickedPastePassword: {},
  ClickedPasteToken: {},
  ClickedGiveReference: {},
  ClickedDelete: { index: Schema.Number },
})
export type Message = typeof Message.Type

export type OutMessage = SurfaceOutMessage<ScenarioOp>

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

// UPDATE

const produce = (
  context: Context,
  model: Model,
  ops: ReadonlyArray<ScenarioOp>,
): UpdateReturn =>
  produceOps<Model, Message>(
    context,
    modifyFields(model, { notice: (): Notice => 'none' }),
    ops,
  )

const withToken = (
  context: Context,
  model: Model,
  mustBeSaved: boolean,
  op: (token: string) => ScenarioOp,
): UpdateReturn =>
  Option.match(
    Option.flatMap(context.doc.maybeAssistant, assistant =>
      latestActive(assistant, mustBeSaved),
    ),
    {
      onNone: () => ({
        model: modifyFields(model, {
          notice: (): Notice =>
            mustBeSaved &&
            Option.isSome(
              Option.flatMap(context.doc.maybeAssistant, assistant =>
                latestActive(assistant, false),
              ),
            )
              ? 'needsSaved'
              : 'needsToken',
        }),
      }),
      onSome: token => produce(context, model, [op(token.id)]),
    },
  )

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedPastePassword: () =>
        produce(context, model, [ScenarioOp.PastePassword()]),
      ClickedPasteToken: () =>
        withToken(context, model, false, token =>
          ScenarioOp.PasteToken({ token }),
        ),
      ClickedGiveReference: () =>
        withToken(context, model, true, token =>
          ScenarioOp.GiveReference({ token }),
        ),
      ClickedDelete: ({ index }) =>
        produce(context, model, [ScenarioOp.DeleteChatLine({ index })]),
    })

// GHOST

const ghostKey = (op: ScenarioOp): Option.Option<string> =>
  Match.value(op).pipe(
    Match.tag('GiveReference', () => Option.some('reference')),
    Match.tag('DeleteChatLine', ({ index }) => Option.some(`delete:${index}`)),
    Match.orElse(() => Option.none()),
  )

const ghostOf = (context: Context): Option.Option<string> =>
  pipe(
    Array.head(ghostOps(context.maybeGhost, context.journal)),
    Option.flatMap(ghostKey),
  )

// VIEW

type Parts<ParentMessage> = Readonly<{
  model: Model
  assistant: Assistant
  context: Context
  ui: UiStrings
  maybeGhost: Option.Option<string>
  send: (message: Message) => ParentMessage
  h: HtmlBuilder<ParentMessage>
}>

const isGhost = <ParentMessage>(
  parts: Parts<ParentMessage>,
  key: string,
): boolean => Option.exists(parts.maybeGhost, ghost => ghost === key)

const name = <ParentMessage>(parts: Parts<ParentMessage>, id: string) =>
  nameOf(parts.context.label, id)

const isEditable = <ParentMessage>(parts: Parts<ParentMessage>): boolean =>
  parts.context.mode === 'Edit'

const botBubble = <ParentMessage>(
  parts: Parts<ParentMessage>,
  key: string,
): Html =>
  parts.h.div(
    [parts.h.Class('scenario-ai-line bot')],
    [
      parts.h.span(
        [parts.h.Class('scenario-ai-mark'), parts.h.AriaHidden(true)],
        ['✦'],
      ),
      parts.h.p([], [name(parts, `${parts.assistant.bot}:${key}`)]),
    ],
  )

const lineView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  line: ChatLine,
  index: number,
): ReadonlyArray<Html> => {
  const { h, ui, assistant, send } = parts
  const isSecret = line.what !== 'reference'
  const userBubble = line.isDeleted
    ? h.p([h.Class('scenario-ai-deleted')], [ui.scenario.assistant.deleted])
    : h.div(
        [h.Class('scenario-ai-line user')],
        [
          h.p(
            [h.Class(classes(isSecret && 'is-secret'))],
            [name(parts, `${assistant.bot}:say-${line.what}`)],
          ),
          ...(isSecret
            ? [
                h.button(
                  [
                    h.Type('button'),
                    h.Class(
                      classes(
                        'scenario-ai-delete',
                        isGhost(parts, `delete:${index}`) && 'ghost',
                      ),
                    ),
                    h.AriaLabel(ui.scenario.assistant.deleteLabel),
                    ...(isEditable(parts)
                      ? [h.OnClick(send(Message.ClickedDelete({ index })))]
                      : [h.Disabled(true)]),
                  ],
                  [ui.scenario.assistant.delete],
                ),
              ]
            : []),
        ],
      )
  const warning =
    isSecret && !line.isDeleted
      ? [
          h.p(
            [h.Class('scenario-banner bad'), h.Role('alert')],
            [
              line.what === 'password'
                ? ui.scenario.assistant.passwordWarning
                : ui.scenario.assistant.tokenWarning,
            ],
          ),
        ]
      : []
  return [
    userBubble,
    ...warning,
    botBubble(parts, line.what),
    ...(line.what === 'password' ? [] : [botBubble(parts, 'done')]),
  ]
}

const chip = <ParentMessage>(
  parts: Parts<ParentMessage>,
  label: string,
  message: Message,
  style: string,
  ghost: string,
): Html => {
  const { h, send } = parts
  return h.button(
    [
      h.Type('button'),
      h.Class(
        classes('scenario-ai-chip', style, isGhost(parts, ghost) && 'ghost'),
      ),
      ...(isEditable(parts) ? [h.OnClick(send(message))] : [h.Disabled(true)]),
    ],
    [label],
  )
}

export const view = <ParentMessage>(
  model: Model,
  context: Context,
  ui: UiStrings,
  send: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  Option.match(context.doc.maybeAssistant, {
    onNone: () => h.empty,
    onSome: assistant => {
      const parts: Parts<ParentMessage> = {
        model,
        assistant,
        context,
        ui,
        maybeGhost: ghostOf(context),
        send,
        h,
      }
      const notice =
        model.notice === 'none'
          ? []
          : [
              h.p(
                [h.Class('scenario-ai-notice'), h.Role('status')],
                [
                  model.notice === 'needsToken'
                    ? ui.scenario.assistant.needsToken
                    : ui.scenario.assistant.needsSaved,
                ],
              ),
            ]
      return h.section(
        [
          h.Class('scenario-window scenario-ai'),
          h.AriaLabel(ui.scenario.assistant.label),
        ],
        [
          h.div(
            [h.Class('scenario-mailbar')],
            [
              h.span([h.Class('device-dots'), h.AriaHidden(true)]),
              h.span([h.Class('scenario-app-mark'), h.AriaHidden(true)], ['✦']),
              h.strong([], [name(parts, assistant.bot)]),
              h.span(
                [h.Class('scenario-account')],
                [name(parts, assistant.owner)],
              ),
            ],
          ),
          h.div(
            [h.Class('scenario-ai-messages'), h.AriaLive('polite')],
            [
              botBubble(parts, 'intro'),
              ...Array.flatMap(assistant.chat, (line, index) =>
                lineView(parts, line, index),
              ),
            ],
          ),
          h.div(
            [h.Class('scenario-ai-composer')],
            [
              h.div(
                [h.Class('scenario-ai-input'), h.AriaHidden(true)],
                [ui.scenario.assistant.composer],
              ),
              h.div(
                [h.Class('scenario-ai-chips')],
                [
                  chip(
                    parts,
                    ui.scenario.assistant.pastePassword,
                    Message.ClickedPastePassword(),
                    'risky',
                    'password',
                  ),
                  chip(
                    parts,
                    ui.scenario.assistant.pasteToken,
                    Message.ClickedPasteToken(),
                    'risky',
                    'token',
                  ),
                  chip(
                    parts,
                    ui.scenario.assistant.giveReference,
                    Message.ClickedGiveReference(),
                    'safe',
                    'reference',
                  ),
                ],
              ),
              ...notice,
            ],
          ),
        ],
      )
    },
  })

// SURFACE

const read = (state: SurfaceState): Option.Option<Model> =>
  state._tag === 'ScenarioAssistantSurface'
    ? Option.some(state.model)
    : Option.none()

const toSurfaceMessage = (message: Message): SurfaceMessage =>
  SurfaceMessage.GotScenarioAssistantMessage({ message })

export const assistantSurface: SurfaceDefinition<ScenarioTypes> = {
  type: 'assistant',
  feature: 'assistant',
  init: () => SurfaceState.ScenarioAssistantSurface({ model: initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotScenarioAssistantMessage'
      ? Update.foldChild({
          update: update(context),
          read,
          write: (_state: SurfaceState, nextAssistant: Model): SurfaceState =>
            SurfaceState.ScenarioAssistantSurface({ model: nextAssistant }),
          toParentMessage: toSurfaceMessage,
          toParentOutMessage: (outMessage: OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: (context, ui) =>
    ui.scenario.assistant.tab(nameOf(context.label, context.target)),
  view: (slot, h) =>
    Option.match(read(slot.state), {
      onNone: () => h.empty,
      onSome: model =>
        view(
          model,
          slot.context,
          slot.ui,
          message => slot.toParentMessage(toSurfaceMessage(message)),
          h,
        ),
    }),
}
