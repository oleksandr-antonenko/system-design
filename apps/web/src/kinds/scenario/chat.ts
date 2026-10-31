import { Array, Option, Result, Schema } from 'effect'
import { modifyFields } from 'foldkit/struct'

import { type GoalResult, ScenarioMessage, goalResult } from './codes'

// Мессенджер (урок 7 «Social engineering», урок 12 «Incident»): чаты с
// готовыми ответами, справочник компании со звонками и пересылка чата в IT.
// Ответ, который соглашается на срочную просьбу без проверки, и звонок на
// номер из сообщения — ошибки: документ их записывает, задача решается
// дальше. Тексты чатов, ответов и звонков — подписи урока.

// MODEL

/** `comply` — ответ соглашается на просьбу без проверки. */
export const ReplyTone = Schema.Literals(['safe', 'comply'])
export type ReplyTone = typeof ReplyTone.Type

export const ChatReply = Schema.Struct({
  /** Подпись урока `reply:<чат>:<id>`: текст ответа и ответ собеседника. */
  id: Schema.String,
  tone: ReplyTone,
})
export type ChatReply = typeof ChatReply.Type

export const Thread = Schema.Struct({
  /** Подписи урока: `chat:<id>` — имя и строка под ним, `chat:<id>:body` —
      входящие сообщения через пустую строку, `chat:<id>:call` — что
      ответят по номеру чата, `chat:<id>:forwarded` — ответ IT на пересылку. */
  id: Schema.String,
  number: Schema.String,
  /** Номер есть в справочнике или контактах. */
  isKnown: Schema.Boolean,
  replies: Schema.Array(ChatReply),
})
export type Thread = typeof Thread.Type

export const Contact = Schema.Struct({
  /** Подписи урока: `contact:<id>` — имя и должность, `call:<id>` — что
      скажут в звонке. */
  id: Schema.String,
  number: Schema.String,
})
export type Contact = typeof Contact.Type

export const SentReply = Schema.Struct({
  thread: Schema.String,
  reply: Schema.String,
})
export type SentReply = typeof SentReply.Type

export const Chat = Schema.Struct({
  owner: Schema.String,
  threads: Schema.Array(Thread),
  contacts: Schema.Array(Contact),
  /** Чат IT: куда пересылают подозрительное. */
  it: Schema.String,
  sent: Schema.Array(SentReply),
  called: Schema.Array(Schema.String),
  forwarded: Schema.Array(Schema.String),
})
export type Chat = typeof Chat.Type

export type ChatSetup = Omit<Chat, 'sent' | 'called' | 'forwarded'>

// QUERIES

export const findThread = (chat: Chat, id: string): Option.Option<Thread> =>
  Array.findFirst(chat.threads, thread => thread.id === id)

export const findReply = (
  thread: Thread,
  id: string,
): Option.Option<ChatReply> =>
  Array.findFirst(thread.replies, reply => reply.id === id)

export const sentIn = (chat: Chat, thread: string): ReadonlyArray<SentReply> =>
  Array.filter(chat.sent, sent => sent.thread === thread)

const isSent = (chat: Chat, thread: string, reply: string): boolean =>
  Array.some(chat.sent, sent => sent.thread === thread && sent.reply === reply)

// CHANGES

type Changed<A> = Result.Result<A, ScenarioMessage>

const withThread = <A>(
  chat: Chat,
  id: string,
  next: (thread: Thread) => Changed<A>,
): Changed<A> =>
  Option.match(findThread(chat, id), {
    onNone: () => Result.fail(ScenarioMessage.ThreadUnknown({ thread: id })),
    onSome: next,
  })

/** Ответ уходит в чат; второй раз тот же ответ не отправляется. */
export const sendReply = (
  chat: Chat,
  thread: string,
  reply: string,
): Changed<Readonly<{ chat: Chat; tone: ReplyTone }>> =>
  withThread(chat, thread, found =>
    Option.match(findReply(found, reply), {
      onNone: () => Result.fail(ScenarioMessage.ReplyUnknown({ reply })),
      onSome: chosen =>
        Result.succeed({
          tone: chosen.tone,
          chat: isSent(chat, thread, reply)
            ? chat
            : modifyFields(chat, {
                sent: sent => [...sent, { thread, reply }],
              }),
        }),
    }),
  )

/** Звонок на номер чата: незнакомый номер — не проверка. */
export const callThread = (
  chat: Chat,
  thread: string,
): Changed<Readonly<{ chat: Chat; isKnown: boolean }>> =>
  withThread(chat, thread, found =>
    Result.succeed({ chat, isKnown: found.isKnown }),
  )

export const callContact = (chat: Chat, contact: string): Changed<Chat> =>
  Array.some(chat.contacts, known => known.id === contact)
    ? Result.succeed(
        modifyFields(chat, {
          called: called => Array.dedupe([...called, contact]),
        }),
      )
    : Result.fail(ScenarioMessage.ContactUnknown({ contact }))

export const forwardThread = (chat: Chat, thread: string): Changed<Chat> =>
  withThread(chat, thread, () =>
    Result.succeed(
      modifyFields(chat, {
        forwarded: forwarded => Array.dedupe([...forwarded, thread]),
      }),
    ),
  )

// GOALS

export const replied = (
  chat: Chat,
  thread: string,
  reply: string,
): GoalResult =>
  goalResult(
    isSent(chat, thread, reply),
    ScenarioMessage.NotReplied({ thread }),
  )

export const called = (chat: Chat, contact: string): GoalResult =>
  goalResult(
    Array.contains(chat.called, contact),
    ScenarioMessage.NotCalled({ contact }),
  )

export const forwarded = (chat: Chat, thread: string): GoalResult =>
  goalResult(
    Array.contains(chat.forwarded, thread),
    ScenarioMessage.NotForwarded({ thread }),
  )

// TARGETS

export const chatTargets = (chat: Chat): ReadonlyArray<string> => [
  chat.owner,
  ...Array.flatMap(chat.threads, thread => [
    `chat:${thread.id}`,
    `chat:${thread.id}:body`,
    `chat:${thread.id}:call`,
    `chat:${thread.id}:forwarded`,
    ...Array.map(thread.replies, reply => `reply:${thread.id}:${reply.id}`),
  ]),
  ...Array.flatMap(chat.contacts, contact => [
    `contact:${contact.id}`,
    `call:${contact.id}`,
  ]),
]
