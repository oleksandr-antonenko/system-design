import { Array, Option, Result, Schema, pipe } from 'effect'
import { modifyFields } from 'foldkit/struct'

import { type GoalResult, ScenarioMessage, goalResult } from './codes'

// Доступ для ИИ-ассистента (урок 10 «Access token»): чат с ассистентом и
// настройки токенов CRM. Ассистенту дают свой токен — только чтение, один
// раздел, короткий срок, — хранят его в менеджере паролей и передают
// ссылкой на запись, а после работы отзывают. Пароль администратора или
// токен, вставленные в чат, — ошибки: их удаляют из чата, а пароль меняют.
// Строк паролей и токенов в документе нет: чат хранит только что вставлено.

// MODEL

export const Access = Schema.Literals(['read', 'write', 'admin'])
export type Access = typeof Access.Type

export const Token = Schema.Struct({
  id: Schema.String,
  access: Access,
  sections: Schema.Array(Schema.String),
  /** Срок в днях; 0 — бессрочный. */
  days: Schema.Number,
  isSaved: Schema.Boolean,
  isRevoked: Schema.Boolean,
})
export type Token = typeof Token.Type

/** Что ученик отправил ассистенту. */
export const Sent = Schema.Literals(['password', 'token', 'reference'])
export type Sent = typeof Sent.Type

export const ChatLine = Schema.Struct({
  what: Sent,
  isDeleted: Schema.Boolean,
})
export type ChatLine = typeof ChatLine.Type

export const Assistant = Schema.Struct({
  owner: Schema.String,
  /** Подписи урока: ассистент (`<bot>:<что>` — его реплики) и CRM. */
  bot: Schema.String,
  crm: Schema.String,
  url: Schema.String,
  /** Разделы CRM (подписи `section:<id>`) и тот, что нужен для работы. */
  sections: Schema.Array(Schema.String),
  need: Schema.String,
  /** Самый долгий срок токена для этой работы, дней. */
  days: Schema.Number,
  /** Ссылка на запись в менеджере паролей, `op://…`. */
  reference: Schema.String,
  tokens: Schema.Array(Token),
  chat: Schema.Array(ChatLine),
  /** Токен, с которым ассистент сделал работу. */
  maybeGiven: Schema.Option(Schema.String),
  isPasswordChanged: Schema.Boolean,
})
export type Assistant = typeof Assistant.Type

export type AssistantSetup = Omit<
  Assistant,
  'tokens' | 'chat' | 'maybeGiven' | 'isPasswordChanged'
>

// QUERIES

export const findToken = (
  assistant: Assistant,
  id: string,
): Option.Option<Token> =>
  Array.findFirst(assistant.tokens, token => token.id === id)

/** Последний неотозванный токен, по желанию — только сохранённый. */
export const latestActive = (
  assistant: Assistant,
  mustBeSaved: boolean,
): Option.Option<Token> =>
  Array.findLast(
    assistant.tokens,
    token => !token.isRevoked && (!mustBeSaved || token.isSaved),
  )

/** Токен даёт ровно то, что нужно: чтение, один раздел, короткий срок. */
export const isScoped = (assistant: Assistant, token: Token): boolean =>
  token.access === 'read' &&
  token.sections.length === 1 &&
  Array.contains(token.sections, assistant.need) &&
  token.days > 0 &&
  token.days <= assistant.days

const isSecret = (line: ChatLine): boolean =>
  !line.isDeleted && line.what !== 'reference'

export const secretsInChat = (assistant: Assistant): number =>
  Array.filter(assistant.chat, isSecret).length

export const wasPasswordPasted = (assistant: Assistant): boolean =>
  Array.some(assistant.chat, line => line.what === 'password')

// CHANGES

type Changed = Result.Result<Assistant, ScenarioMessage>

export const createToken = (
  assistant: Assistant,
  fields: Readonly<{
    access: Access
    sections: ReadonlyArray<string>
    days: number
  }>,
): Changed =>
  Array.isReadonlyArrayEmpty(fields.sections)
    ? Result.fail(ScenarioMessage.NoSections())
    : Result.succeed(
        modifyFields(assistant, {
          tokens: tokens => [
            ...tokens,
            {
              id: `t${tokens.length + 1}`,
              access: fields.access,
              sections: Array.filter(assistant.sections, section =>
                Array.contains(fields.sections, section),
              ),
              days: fields.days,
              isSaved: false,
              isRevoked: false,
            },
          ],
        }),
      )

const changeToken = (
  assistant: Assistant,
  id: string,
  change: (token: Token) => Result.Result<Token, ScenarioMessage>,
): Changed =>
  Option.match(findToken(assistant, id), {
    onNone: () => Result.fail(ScenarioMessage.TokenUnknown({ token: id })),
    onSome: found =>
      Result.map(change(found), next =>
        modifyFields(assistant, {
          tokens: tokens =>
            Array.map(tokens, token => (token.id === id ? next : token)),
        }),
      ),
  })

const active = (
  token: Token,
  next: () => Token,
): Result.Result<Token, ScenarioMessage> =>
  token.isRevoked
    ? Result.fail(ScenarioMessage.TokenRevoked({ token: token.id }))
    : Result.succeed(next())

export const saveToken = (assistant: Assistant, id: string): Changed =>
  changeToken(assistant, id, token =>
    active(token, () => modifyFields(token, { isSaved: () => true })),
  )

export const revokeToken = (assistant: Assistant, id: string): Changed =>
  changeToken(assistant, id, token =>
    Result.succeed(modifyFields(token, { isRevoked: () => true })),
  )

const say = (assistant: Assistant, what: Sent): Assistant =>
  modifyFields(assistant, {
    chat: chat => [...chat, { what, isDeleted: false }],
  })

export const pastePassword = (assistant: Assistant): Changed =>
  Result.succeed(say(assistant, 'password'))

/** Токен ушёл в чат текстом или ссылкой на запись: ассистент работает. */
export const giveToken = (
  assistant: Assistant,
  id: string,
  how: 'token' | 'reference',
): Changed =>
  Option.match(findToken(assistant, id), {
    onNone: () => Result.fail(ScenarioMessage.TokenUnknown({ token: id })),
    onSome: token =>
      token.isRevoked
        ? Result.fail(ScenarioMessage.TokenRevoked({ token: id }))
        : how === 'reference' && !token.isSaved
          ? Result.fail(ScenarioMessage.TokenNotSaved({ token: id }))
          : Result.succeed(
              modifyFields(say(assistant, how), {
                maybeGiven: () => Option.some(id),
              }),
            ),
  })

export const deleteLine = (assistant: Assistant, index: number): Changed =>
  pipe(
    Array.get(assistant.chat, index),
    Option.match({
      onNone: () => Result.fail(ScenarioMessage.LineUnknown()),
      onSome: () =>
        Result.succeed(
          modifyFields(assistant, {
            chat: chat =>
              Array.map(chat, (line, at) =>
                at === index
                  ? modifyFields(line, { isDeleted: () => true })
                  : line,
              ),
          }),
        ),
    }),
  )

export const changeAdminPassword = (assistant: Assistant): Changed =>
  Result.succeed(modifyFields(assistant, { isPasswordChanged: () => true }))

// GOALS

const given = (assistant: Assistant): Option.Option<Token> =>
  Option.flatMap(assistant.maybeGiven, id => findToken(assistant, id))

export const scopedAccess = (assistant: Assistant): GoalResult =>
  Option.match(given(assistant), {
    onNone: () => goalResult(false, ScenarioMessage.NoAccessGiven()),
    onSome: token =>
      goalResult(isScoped(assistant, token), ScenarioMessage.AccessTooBroad()),
  })

export const accessRevoked = (assistant: Assistant): GoalResult =>
  Option.match(given(assistant), {
    onNone: () => goalResult(false, ScenarioMessage.NoAccessGiven()),
    onSome: token =>
      goalResult(token.isRevoked, ScenarioMessage.AccessActive()),
  })

/** Доступ выдан, а в чате не осталось секретов; побывавший там пароль
    сменён. Пока доступа нет, цель не выполнена: пустой чат — не заслуга. */
export const chatClean = (assistant: Assistant): GoalResult =>
  Option.isNone(assistant.maybeGiven)
    ? goalResult(false, ScenarioMessage.NoAccessGiven())
    : secretsInChat(assistant) > 0
      ? goalResult(false, ScenarioMessage.SecretInChat())
      : goalResult(
          !wasPasswordPasted(assistant) || assistant.isPasswordChanged,
          ScenarioMessage.PasswordNotChanged(),
        )

// TARGETS

export const assistantTargets = (
  assistant: Assistant,
): ReadonlyArray<string> => [
  assistant.owner,
  assistant.bot,
  assistant.crm,
  `${assistant.bot}:intro`,
  `${assistant.bot}:say-password`,
  `${assistant.bot}:say-token`,
  `${assistant.bot}:say-reference`,
  `${assistant.bot}:password`,
  `${assistant.bot}:token`,
  `${assistant.bot}:reference`,
  `${assistant.bot}:done`,
  ...Array.map(assistant.sections, section => `section:${section}`),
]
