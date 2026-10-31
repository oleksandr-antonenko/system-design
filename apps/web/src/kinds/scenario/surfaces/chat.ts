import { Array, Match, Option, Schema, String, pipe } from 'effect'
import { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'

import type { UiStrings } from '../../../i18n/ui'
import type {
  SurfaceContext,
  SurfaceDefinition,
  SurfaceOutMessage,
} from '../../contract'
import { SurfaceMessage, SurfaceState } from '../../state'
import type { ScenarioTypes } from '../../types'
import {
  type Chat,
  type Contact,
  type Thread,
  findThread,
  sentIn,
} from '../chat'
import { ScenarioOp } from '../doc'
import { classes, ghostOps, nameOf, noteOf, produceOps } from './parts'

// Мессенджер `chat:<владелец>` (уроки 6 и 11): список чатов и справочник
// компании слева, открытый чат справа. Ответы — готовые кнопки урока, а не
// поле ввода. Отправленные ответы, звонки и пересылки — в документе; здесь
// только открытый чат, вкладка и лист звонка.

type Context = SurfaceContext<ScenarioTypes>

// MODEL

export const Tab = Schema.Literals(['chats', 'directory'])
export type Tab = typeof Tab.Type

export const Sheet = defineTaggedUnion({
  Closed: {},
  /** Звонок: кому (подпись), что скажут (подпись), номер и был ли это
      номер из сообщения. */
  Call: {
    who: Schema.String,
    words: Schema.String,
    number: Schema.String,
    isTheirNumber: Schema.Boolean,
  },
})
export type Sheet = typeof Sheet.Type

export const Model = Schema.Struct({
  maybeOpen: Schema.Option(Schema.String),
  tab: Tab,
  sheet: Sheet,
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  maybeOpen: Option.none(),
  tab: 'chats',
  sheet: Sheet.Closed(),
}

// MESSAGE

export const Message = defineMessageUnion({
  ClickedThread: { thread: Schema.String },
  ClickedTab: { tab: Tab },
  ClickedReply: { reply: Schema.String },
  ClickedCallThread: {},
  ClickedCallContact: { contact: Schema.String },
  ClickedForward: {},
  ClickedCloseSheet: {},
})
export type Message = typeof Message.Type

export type OutMessage = SurfaceOutMessage<ScenarioOp>

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

// UPDATE

const produce = (
  context: Context,
  model: Model,
  ops: ReadonlyArray<ScenarioOp>,
): UpdateReturn => produceOps<Model, Message>(context, model, ops)

/** Открытый чат: выбранный учеником, иначе первый. */
export const openThread = (chat: Chat, model: Model): Option.Option<Thread> =>
  pipe(
    model.maybeOpen,
    Option.flatMap(id => findThread(chat, id)),
    Option.orElse(() => Array.head(chat.threads)),
  )

const withOpen = (
  context: Context,
  model: Model,
  next: (thread: Thread) => UpdateReturn,
): UpdateReturn =>
  Option.match(
    Option.flatMap(context.doc.maybeChat, chat => openThread(chat, model)),
    { onNone: () => ({ model }), onSome: next },
  )

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedThread: ({ thread }) => ({
        model: modifyFields(model, {
          maybeOpen: () => Option.some(thread),
          sheet: () => Sheet.Closed(),
        }),
      }),
      ClickedTab: ({ tab }) => ({
        model: modifyFields(model, {
          tab: () => tab,
          sheet: () => Sheet.Closed(),
        }),
      }),
      ClickedReply: ({ reply }) =>
        withOpen(context, model, thread =>
          produce(context, model, [
            ScenarioOp.SendReply({ thread: thread.id, reply }),
          ]),
        ),
      ClickedCallThread: () =>
        withOpen(context, model, thread =>
          produce(
            context,
            modifyFields(model, {
              sheet: () =>
                Sheet.Call({
                  who: `chat:${thread.id}`,
                  words: `chat:${thread.id}:call`,
                  number: thread.number,
                  isTheirNumber: !thread.isKnown,
                }),
            }),
            [ScenarioOp.CallThread({ thread: thread.id })],
          ),
        ),
      ClickedCallContact: ({ contact }) =>
        Option.match(
          Option.flatMap(context.doc.maybeChat, chat =>
            Array.findFirst(chat.contacts, known => known.id === contact),
          ),
          {
            onNone: () => ({ model }),
            onSome: found =>
              produce(
                context,
                modifyFields(model, {
                  sheet: () =>
                    Sheet.Call({
                      who: `contact:${found.id}`,
                      words: `call:${found.id}`,
                      number: found.number,
                      isTheirNumber: false,
                    }),
                }),
                [ScenarioOp.CallContact({ contact })],
              ),
          },
        ),
      ClickedForward: () =>
        withOpen(context, model, thread =>
          produce(context, model, [
            ScenarioOp.ForwardThread({ thread: thread.id }),
          ]),
        ),
      ClickedCloseSheet: () => ({
        model: modifyFields(model, { sheet: () => Sheet.Closed() }),
      }),
    })

// GHOST

const ghostKey =
  (chat: Chat, model: Model) =>
  (op: ScenarioOp): Option.Option<string> => {
    const isOpen = (thread: string) =>
      model.tab === 'chats' &&
      Option.exists(openThread(chat, model), open => open.id === thread)
    const inChats = (key: string) =>
      Option.some(model.tab === 'chats' ? key : 'tab:chats')
    return Match.value(op).pipe(
      Match.tag('SendReply', ({ thread, reply }) =>
        isOpen(thread)
          ? Option.some(`reply:${reply}`)
          : inChats(`thread:${thread}`),
      ),
      Match.tag('CallContact', ({ contact }) =>
        Option.some(
          model.tab === 'directory' ? `call:${contact}` : 'tab:directory',
        ),
      ),
      Match.tag('ForwardThread', ({ thread }) =>
        isOpen(thread) ? Option.some('forward') : inChats(`thread:${thread}`),
      ),
      Match.orElse(() => Option.none()),
    )
  }

/** Призрак — только у следующего хода эталона: он может быть и на другом
    экране задачи. */
const ghostOf = (
  context: Context,
  chat: Chat,
  model: Model,
): Option.Option<string> =>
  pipe(
    Array.head(ghostOps(context.maybeGhost, context.journal)),
    Option.flatMap(ghostKey(chat, model)),
  )

// VIEW

type Parts<ParentMessage> = Readonly<{
  model: Model
  chat: Chat
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

const note = <ParentMessage>(parts: Parts<ParentMessage>, id: string) =>
  noteOf(parts.context.label, id)

/** Подпись урока, иначе общий текст экрана. */
const nameOr = <ParentMessage>(
  parts: Parts<ParentMessage>,
  id: string,
  fallback: string,
) =>
  Option.match(parts.context.label(id), {
    onNone: () => fallback,
    onSome: found => found.name,
  })

const paragraphs = (text: string): ReadonlyArray<string> =>
  Array.filter(Array.map(text.split(/\n\s*\n/), String.trim), String.isNonEmpty)

const isEditable = <ParentMessage>(parts: Parts<ParentMessage>): boolean =>
  parts.context.mode === 'Edit'

const actionButton = <ParentMessage>(
  parts: Parts<ParentMessage>,
  label: string,
  message: Message,
  style: string,
  ghost: string,
  ariaLabel: string = label,
): Html => {
  const { h, send } = parts
  return h.button(
    [
      h.Type('button'),
      h.Class(
        classes('screen-button', style, isGhost(parts, ghost) && 'ghost'),
      ),
      h.AriaLabel(ariaLabel),
      ...(isEditable(parts) ? [h.OnClick(send(message))] : [h.Disabled(true)]),
    ],
    [label],
  )
}

const avatar = <ParentMessage>(
  parts: Parts<ParentMessage>,
  text: string,
  isKnown: boolean,
): Html =>
  parts.h.span(
    [
      parts.h.Class(classes('scenario-chat-avatar', !isKnown && 'unknown')),
      parts.h.AriaHidden(true),
    ],
    [
      text
        .replace(/[«»"“”„]/g, '')
        .trim()
        .charAt(0)
        .toUpperCase(),
    ],
  )

const threadRow = <ParentMessage>(
  parts: Parts<ParentMessage>,
  thread: Thread,
  isOpen: boolean,
): Html => {
  const { h, ui, send } = parts
  const title = name(parts, `chat:${thread.id}`)
  return h.keyed('li')(
    thread.id,
    [],
    [
      h.button(
        [
          h.Type('button'),
          h.Class(
            classes(
              'scenario-chat-row',
              isOpen && 'open',
              isGhost(parts, `thread:${thread.id}`) && 'ghost',
            ),
          ),
          h.AriaPressed(isOpen ? 'true' : 'false'),
          h.OnClick(send(Message.ClickedThread({ thread: thread.id }))),
        ],
        [
          avatar(parts, title, thread.isKnown),
          h.span([h.Class('scenario-chat-name')], [title]),
          h.span(
            [h.Class('scenario-chat-sub')],
            [note(parts, `chat:${thread.id}`) || thread.number],
          ),
          ...(thread.isKnown
            ? []
            : [
                h.span(
                  [h.Class('scenario-chat-badge')],
                  [ui.scenario.chat.unknownBadge],
                ),
              ]),
        ],
      ),
    ],
  )
}

const contactRow = <ParentMessage>(
  parts: Parts<ParentMessage>,
  contact: Contact,
): Html => {
  const { h, ui } = parts
  const title = name(parts, `contact:${contact.id}`)
  return h.keyed('li')(
    contact.id,
    [h.Class('scenario-contact')],
    [
      avatar(parts, title, true),
      h.span([h.Class('scenario-chat-name')], [title]),
      h.span(
        [h.Class('scenario-chat-sub')],
        [`${note(parts, `contact:${contact.id}`)} · ${contact.number}`],
      ),
      actionButton(
        parts,
        ui.scenario.chat.call,
        Message.ClickedCallContact({ contact: contact.id }),
        '',
        `call:${contact.id}`,
        `${ui.scenario.chat.call} · ${title}`,
      ),
    ],
  )
}

const listView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, model, chat, send } = parts
  const open = openThread(chat, model)
  const hasDirectory =
    Array.isReadonlyArrayNonEmpty(chat.contacts) &&
    Array.contains(parts.context.unlocked, 'chat.directory')
  const tabButton = (tab: Tab, label: string) =>
    h.button(
      [
        h.Type('button'),
        h.Role('tab'),
        h.AriaSelected(model.tab === tab),
        h.Class(
          classes(
            'scenario-chat-tab',
            model.tab === tab && 'active',
            isGhost(parts, `tab:${tab}`) && 'ghost',
          ),
        ),
        h.OnClick(send(Message.ClickedTab({ tab }))),
      ],
      [label],
    )
  return h.div(
    [h.Class('scenario-chat-list')],
    [
      ...(hasDirectory
        ? [
            h.div(
              [h.Class('scenario-chat-tabs'), h.Role('tablist')],
              [
                tabButton('chats', ui.scenario.chat.chats),
                tabButton('directory', ui.scenario.chat.directory),
              ],
            ),
          ]
        : []),
      model.tab === 'directory' && hasDirectory
        ? h.div(
            [],
            [
              h.p(
                [h.Class('scenario-chat-note')],
                [ui.scenario.chat.directoryNote],
              ),
              h.ul(
                [],
                Array.map(chat.contacts, contact => contactRow(parts, contact)),
              ),
            ],
          )
        : h.ul(
            [],
            Array.map(chat.threads, thread =>
              threadRow(
                parts,
                thread,
                Option.exists(open, found => found.id === thread.id),
              ),
            ),
          ),
    ],
  )
}

const bubble = <ParentMessage>(
  parts: Parts<ParentMessage>,
  text: string,
  side: 'in' | 'out' | 'system',
): Html => parts.h.p([parts.h.Class(`scenario-chat-bubble ${side}`)], [text])

const conversation = <ParentMessage>(
  parts: Parts<ParentMessage>,
  thread: Thread,
): ReadonlyArray<Html> => {
  const { ui, chat } = parts
  const incoming = Array.map(
    paragraphs(name(parts, `chat:${thread.id}:body`)),
    text => bubble(parts, text, 'in'),
  )
  const replies = Array.flatMap(sentIn(chat, thread.id), sent => {
    const id = `reply:${thread.id}:${sent.reply}`
    const answer = note(parts, id)
    const isComply = Option.exists(
      Array.findFirst(thread.replies, reply => reply.id === sent.reply),
      reply => reply.tone === 'comply',
    )
    return [
      bubble(parts, name(parts, id), 'out'),
      ...(answer === '' ? [] : [bubble(parts, answer, 'in')]),
      ...(isComply
        ? [
            parts.h.div(
              [parts.h.Class('scenario-banner bad'), parts.h.Role('alert')],
              [
                parts.h.strong([], [ui.scenario.chat.compliedTitle]),
                ` ${ui.scenario.chat.compliedBody} ${ui.scenario.chat.compliedNext}`,
              ],
            ),
          ]
        : []),
    ]
  })
  const itName = name(parts, `chat:${chat.it}`)
  const forwardedHere = Array.contains(chat.forwarded, thread.id)
    ? [bubble(parts, ui.scenario.chat.forwarded(itName), 'system')]
    : []
  const forwardedToIt =
    thread.id === chat.it
      ? Array.flatMap(chat.forwarded, other => [
          bubble(
            parts,
            ui.scenario.chat.youForwarded(name(parts, `chat:${other}`)),
            'system',
          ),
          bubble(
            parts,
            nameOr(parts, `chat:${other}:forwarded`, ui.scenario.chat.itThanks),
            'in',
          ),
        ])
      : []
  return [...incoming, ...replies, ...forwardedHere, ...forwardedToIt]
}

const callSheet = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, model, send } = parts
  return Sheet.match(model.sheet, {
    Closed: () => [],
    Call: call => [
      h.div(
        [
          h.Class(classes('scenario-call', call.isTheirNumber && 'is-alert')),
          h.Role(call.isTheirNumber ? 'alertdialog' : 'dialog'),
          h.AriaLabel(ui.scenario.chat.callTitle(name(parts, call.who))),
        ],
        [
          avatar(parts, name(parts, call.who), !call.isTheirNumber),
          h.strong([], [ui.scenario.chat.callTitle(name(parts, call.who))]),
          h.span([h.Class('scenario-call-number')], [call.number]),
          h.p(
            [h.Class('scenario-call-words')],
            [nameOr(parts, call.words, ui.scenario.chat.noAnswer)],
          ),
          ...(call.isTheirNumber
            ? [
                h.div(
                  [h.Class('scenario-banner bad')],
                  [
                    h.strong([], [ui.scenario.chat.theirNumberTitle]),
                    ` ${ui.scenario.chat.theirNumberBody} ${ui.scenario.chat.theirNumberNext}`,
                  ],
                ),
              ]
            : []),
          h.button(
            [
              h.Type('button'),
              h.Class('screen-button scenario-hang-up'),
              h.OnClick(send(Message.ClickedCloseSheet())),
            ],
            [ui.scenario.chat.hangUp],
          ),
        ],
      ),
    ],
  })
}

const threadView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, model, chat } = parts
  return Option.match(openThread(chat, model), {
    onNone: () =>
      h.div(
        [h.Class('scenario-chat-main empty')],
        [h.p([], [ui.scenario.chat.choose])],
      ),
    onSome: thread => {
      const title = name(parts, `chat:${thread.id}`)
      const unsent = Array.filter(
        thread.replies,
        reply =>
          !Array.some(sentIn(chat, thread.id), sent => sent.reply === reply.id),
      )
      return h.div(
        [h.Class('scenario-chat-main')],
        [
          h.div(
            [h.Class('scenario-chat-head')],
            [
              avatar(parts, title, thread.isKnown),
              h.div(
                [h.Class('scenario-chat-who')],
                [
                  h.strong([], [title]),
                  h.span(
                    [h.Class('scenario-chat-sub')],
                    [
                      thread.isKnown
                        ? thread.number
                        : `${thread.number} · ${ui.scenario.chat.unknownBadge}`,
                    ],
                  ),
                ],
              ),
              h.div(
                [h.Class('scenario-chat-actions')],
                [
                  actionButton(
                    parts,
                    `📞 ${ui.scenario.chat.call}`,
                    Message.ClickedCallThread(),
                    '',
                    'call-thread',
                    ui.scenario.chat.callNumber(thread.number),
                  ),
                  ...(thread.id === chat.it
                    ? []
                    : [
                        actionButton(
                          parts,
                          `↪ ${ui.scenario.chat.forward}`,
                          Message.ClickedForward(),
                          '',
                          'forward',
                          ui.scenario.chat.forwardTo(
                            name(parts, `chat:${chat.it}`),
                          ),
                        ),
                      ]),
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('scenario-chat-messages'), h.AriaLive('polite')],
            conversation(parts, thread),
          ),
          ...(Array.isReadonlyArrayNonEmpty(unsent)
            ? [
                h.div(
                  [h.Class('scenario-chat-replies')],
                  [
                    h.span(
                      [h.Class('scenario-chat-note')],
                      [ui.scenario.chat.replyHint],
                    ),
                    ...Array.map(unsent, reply =>
                      h.button(
                        [
                          h.Type('button'),
                          h.Class(
                            classes(
                              'scenario-chat-reply',
                              isGhost(parts, `reply:${reply.id}`) && 'ghost',
                            ),
                          ),
                          ...(isEditable(parts)
                            ? [
                                h.OnClick(
                                  parts.send(
                                    Message.ClickedReply({ reply: reply.id }),
                                  ),
                                ),
                              ]
                            : [h.Disabled(true)]),
                        ],
                        [name(parts, `reply:${thread.id}:${reply.id}`)],
                      ),
                    ),
                  ],
                ),
              ]
            : []),
          ...callSheet(parts),
        ],
      )
    },
  })
}

export const view = <ParentMessage>(
  model: Model,
  context: Context,
  ui: UiStrings,
  send: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  Option.match(context.doc.maybeChat, {
    onNone: () => h.empty,
    onSome: chat => {
      const parts: Parts<ParentMessage> = {
        model,
        chat,
        context,
        ui,
        maybeGhost: ghostOf(context, chat, model),
        send,
        h,
      }
      return h.section(
        [
          h.Class('scenario-window scenario-chat'),
          h.AriaLabel(ui.scenario.chat.label),
        ],
        [
          h.div(
            [h.Class('scenario-mailbar')],
            [
              h.span([h.Class('device-dots'), h.AriaHidden(true)]),
              h.span(
                [h.Class('scenario-app-mark'), h.AriaHidden(true)],
                ['💬'],
              ),
              h.strong([], [ui.scenario.chat.label]),
              h.span([h.Class('scenario-account')], [name(parts, chat.owner)]),
            ],
          ),
          h.div(
            [h.Class('scenario-chat-body')],
            [listView(parts), threadView(parts)],
          ),
        ],
      )
    },
  })

// SURFACE

const read = (state: SurfaceState): Option.Option<Model> =>
  state._tag === 'ScenarioChatSurface'
    ? Option.some(state.model)
    : Option.none()

const toSurfaceMessage = (message: Message): SurfaceMessage =>
  SurfaceMessage.GotScenarioChatMessage({ message })

export const chatSurface: SurfaceDefinition<ScenarioTypes> = {
  type: 'chat',
  feature: 'chat',
  init: () => SurfaceState.ScenarioChatSurface({ model: initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotScenarioChatMessage'
      ? Update.foldChild({
          update: update(context),
          read,
          write: (_state: SurfaceState, nextChat: Model): SurfaceState =>
            SurfaceState.ScenarioChatSurface({ model: nextChat }),
          toParentMessage: toSurfaceMessage,
          toParentOutMessage: (outMessage: OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: (context, ui) =>
    ui.scenario.chat.tab(nameOf(context.label, context.target)),
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
