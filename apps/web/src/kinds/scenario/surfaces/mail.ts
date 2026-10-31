import { Array, Match, Option, Record, Schema, String, pipe } from 'effect'
import { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import type { UiStrings } from '../../../i18n/ui'
import {
  type SurfaceContext,
  type SurfaceDefinition,
  SurfaceOutMessage,
} from '../../contract'
import { SurfaceMessage, SurfaceState } from '../../state'
import type { ScenarioTypes } from '../../types'
import {
  type Inbox,
  type Mail,
  type MailLink,
  ScenarioOp,
  type Verdict,
  findMail,
  openSessions,
  verdictOf,
} from '../doc'
import { classes, ghostOps, nameOf } from './parts'

// Почта `mail:<владелец>` (design D6 add-security-course): входящие и
// открытое письмо. Имя отправителя — костюм: адрес видно по нажатию на имя;
// адрес ссылки — в строке внизу окна при наведении и фокусе. В уроке 6
// письма помечают («Это фишинг» / «Настоящее»), в уроке 12 — пересылают в
// IT или удаляют в корзину, а внизу окна видны сеансы почты и «выйти на
// всех других устройствах». Пометки, пересылки, корзина, сеансы и нажатые
// ссылки — в документе; здесь только что открыто и на что наведено.

type Context = SurfaceContext<ScenarioTypes>

// MODEL

export const Model = Schema.Struct({
  maybeOpen: Schema.Option(Schema.String),
  opened: Schema.Array(Schema.String),
  revealed: Schema.Array(Schema.String),
  maybeHover: Schema.Option(Schema.String),
  /** Письмо, чья ссылка открыта поверх него. */
  maybePage: Schema.Option(Schema.String),
  isSessionsOpen: Schema.Boolean,
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  maybeOpen: Option.none(),
  opened: [],
  revealed: [],
  maybeHover: Option.none(),
  maybePage: Option.none(),
  isSessionsOpen: false,
}

// MESSAGE

export const Message = defineMessageUnion({
  ClickedMail: { mail: Schema.String },
  ClickedSender: { mail: Schema.String },
  HoveredLink: { url: Schema.String },
  LeftLink: {},
  ClickedLink: { mail: Schema.String },
  ClickedClosePage: {},
  ClickedMark: { verdict: Schema.Literals(['phish', 'real']) },
  ClickedForward: {},
  ClickedDelete: {},
  ClickedSessions: {},
  ClickedSignOut: {},
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
  context.mode === 'Edit'
    ? { model, outMessage: SurfaceOutMessage.ProducedOps(ops) }
    : { model }

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedMail: ({ mail }) => ({
        model: modifyFields(model, {
          maybeOpen: () => Option.some(mail),
          opened: opened => Array.dedupe([...opened, mail]),
          maybeHover: () => Option.none(),
          maybePage: () => Option.none(),
        }),
      }),
      ClickedSender: ({ mail }) => ({
        model: modifyFields(model, {
          revealed: revealed =>
            Array.contains(revealed, mail)
              ? Array.filter(revealed, id => id !== mail)
              : [...revealed, mail],
        }),
      }),
      HoveredLink: ({ url }) => ({
        model: modifyFields(model, { maybeHover: () => Option.some(url) }),
      }),
      LeftLink: () => ({
        model: modifyFields(model, { maybeHover: () => Option.none() }),
      }),
      ClickedLink: ({ mail }) =>
        produce(
          context,
          modifyFields(model, { maybePage: () => Option.some(mail) }),
          [ScenarioOp.FollowLink({ mail })],
        ),
      ClickedClosePage: () => ({
        model: modifyFields(model, { maybePage: () => Option.none() }),
      }),
      ClickedMark: ({ verdict }) =>
        Option.match(model.maybeOpen, {
          onNone: () => ({ model }),
          onSome: mail =>
            produce(context, model, [ScenarioOp.MarkMail({ mail, verdict })]),
        }),
      ClickedForward: () =>
        Option.match(model.maybeOpen, {
          onNone: () => ({ model }),
          onSome: mail =>
            produce(context, model, [ScenarioOp.ForwardMail({ mail })]),
        }),
      ClickedDelete: () =>
        Option.match(model.maybeOpen, {
          onNone: () => ({ model }),
          onSome: mail =>
            produce(context, model, [ScenarioOp.DeleteMail({ mail })]),
        }),
      ClickedSessions: () => ({
        model: modifyFields(model, {
          isSessionsOpen: isOpen => !isOpen,
        }),
      }),
      ClickedSignOut: () =>
        produce(context, model, [ScenarioOp.SignOutEverywhere()]),
    })

// VIEW

type Parts<ParentMessage> = Readonly<{
  model: Model
  inbox: Inbox
  context: Context
  ui: UiStrings
  maybeGhost: Option.Option<ScenarioOp>
  send: (message: Message) => ParentMessage
  h: HtmlBuilder<ParentMessage>
}>

const text = <ParentMessage>(parts: Parts<ParentMessage>, id: string): string =>
  nameOf(parts.context.label, id)

const note = <ParentMessage>(parts: Parts<ParentMessage>, id: string): string =>
  Option.match(parts.context.label(id), {
    onNone: () => '',
    onSome: found => found.note ?? '',
  })

const paragraphs = (body: string): ReadonlyArray<string> =>
  Array.filter(Array.map(body.split(/\n\s*\n/), String.trim), String.isNonEmpty)

const markOf = (inbox: Inbox, mail: Mail): Option.Option<Verdict> =>
  Record.get(inbox.marks, mail.id)

const AVATAR_COLORS: ReadonlyArray<string> = [
  '#3E5BA9',
  '#B0569A',
  '#D0782F',
  '#C2453A',
  '#6A4FC4',
  '#2F8F7A',
]

const avatarColor = (inbox: Inbox, mail: Mail): string =>
  Option.getOrElse(
    pipe(
      Array.findFirstIndex(inbox.mails, candidate => candidate.id === mail.id),
      Option.flatMap(index => Array.get(AVATAR_COLORS, index % 6)),
    ),
    () => '#5A6774',
  )

/** Обвести кнопку пересылки или сеансов для следующего хода эталона. */
const ghostKey = <ParentMessage>(
  parts: Parts<ParentMessage>,
): Option.Option<string> =>
  Option.flatMap(parts.maybeGhost, op =>
    Match.value(op).pipe(
      Match.tag('ForwardMail', ({ mail }) =>
        Option.some(
          Option.exists(parts.model.maybeOpen, open => open === mail)
            ? 'forward'
            : `row:${mail}`,
        ),
      ),
      Match.tag('SignOutEverywhere', () =>
        Option.some(parts.model.isSessionsOpen ? 'sign-out' : 'sessions'),
      ),
      Match.orElse(() => Option.none<string>()),
    ),
  )

const isGhostKey = <ParentMessage>(
  parts: Parts<ParentMessage>,
  key: string,
): boolean => Option.exists(ghostKey(parts), ghost => ghost === key)

const isReporting = <ParentMessage>(parts: Parts<ParentMessage>): boolean =>
  parts.inbox.actions === 'report' && isUnlocked(parts, 'mail.report')

const ghostTarget = <ParentMessage>(
  parts: Parts<ParentMessage>,
): Option.Option<Readonly<{ mail: string; verdict: Verdict }>> =>
  Option.flatMap(parts.maybeGhost, op =>
    op._tag === 'MarkMail'
      ? Option.some({ mail: op.mail, verdict: op.verdict })
      : Option.none(),
  )

const isUnlocked = <ParentMessage>(
  parts: Parts<ParentMessage>,
  feature: string,
): boolean => Array.contains(parts.context.unlocked, feature)

const markLabel = <ParentMessage>(
  parts: Parts<ParentMessage>,
  mail: Mail,
): ReadonlyArray<Html> => {
  const { h, ui, inbox } = parts
  if (isReporting(parts)) {
    return Array.contains(inbox.forwarded, mail.id)
      ? [
          h.span(
            [h.Class('scenario-mark real')],
            [ui.scenario.mail.forwardedMark],
          ),
        ]
      : []
  }
  return Option.match(markOf(inbox, mail), {
    onNone: () => [],
    onSome: verdict => [
      verdict !== verdictOf(mail)
        ? h.span(
            [h.Class('scenario-mark wrong')],
            [ui.scenario.mail.misflagged],
          )
        : verdict === 'phish'
          ? h.span(
              [h.Class('scenario-mark phish')],
              [ui.scenario.mail.flaggedPhish],
            )
          : h.span(
              [h.Class('scenario-mark real')],
              [ui.scenario.mail.keptReal],
            ),
    ],
  })
}

const inboxRow = <ParentMessage>(
  parts: Parts<ParentMessage>,
  mail: Mail,
): Html => {
  const { h, model, send } = parts
  const isOpen = Option.exists(model.maybeOpen, open => open === mail.id)
  const isGhost =
    (!isOpen &&
      Option.exists(ghostTarget(parts), wanted => wanted.mail === mail.id)) ||
    isGhostKey(parts, `row:${mail.id}`)
  const body = paragraphs(text(parts, `mail:${mail.id}:body`))
  const preview = pipe(
    Array.findFirst(body, paragraph => paragraph.length > 24),
    Option.orElse(() => Array.head(body)),
    Option.getOrElse(() => ''),
  )
  return h.keyed('li')(
    mail.id,
    [],
    [
      h.button(
        [
          h.Type('button'),
          h.Class(
            classes(
              'scenario-message',
              isOpen && 'open',
              !Array.contains(model.opened, mail.id) && 'unread',
              isGhost && 'ghost',
            ),
          ),
          h.AriaPressed(isOpen ? 'true' : 'false'),
          h.OnClick(send(Message.ClickedMail({ mail: mail.id }))),
        ],
        [
          h.span(
            [h.Class('scenario-message-from')],
            [text(parts, `mail:${mail.id}`)],
          ),
          h.span([h.Class('scenario-message-time')], [mail.time]),
          h.span(
            [h.Class('scenario-message-subject')],
            [note(parts, `mail:${mail.id}`)],
          ),
          h.span([h.Class('scenario-message-preview')], [preview]),
          ...markLabel(parts, mail),
        ],
      ),
    ],
  )
}

const linkView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  mail: Mail,
  link: MailLink,
): Html => {
  const { h, send } = parts
  const label = text(parts, `mail:${mail.id}:link`)
  return h.button(
    [
      h.Type('button'),
      h.Class(`scenario-link look-${link.look}`),
      h.OnMouseEnter(send(Message.HoveredLink({ url: link.url }))),
      h.OnMouseLeave(send(Message.LeftLink())),
      h.OnFocus(send(Message.HoveredLink({ url: link.url }))),
      h.OnBlur(send(Message.LeftLink())),
      h.OnClick(send(Message.ClickedLink({ mail: mail.id }))),
    ],
    link.look === 'file'
      ? [h.span([h.Class('scenario-pdf'), h.AriaHidden(true)], ['PDF']), label]
      : [label],
  )
}

const hostOf = (url: string): string =>
  pipe(
    url.replace(/^[a-z]+:\/\//, ''),
    String.split('/'),
    Array.get(0),
    Option.getOrElse(() => url),
  )

const pageView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  mail: Mail,
  link: MailLink,
): Html => {
  const { h, ui, inbox, send } = parts
  const host = hostOf(link.url)
  const body =
    link.page === 'own'
      ? [
          h.h4([], [text(parts, `mail:${mail.id}:link`)]),
          h.p(
            [h.Class('scenario-own-site')],
            [ui.scenario.mail.pageOwn(host, inbox.domain)],
          ),
        ]
      : [
          h.h4(
            [],
            [
              link.page === 'login'
                ? ui.scenario.mail.loginTitle
                : link.page === 'payment'
                  ? ui.scenario.mail.paymentTitle
                  : text(parts, `mail:${mail.id}:link`),
            ],
          ),
          ...(link.page === 'file'
            ? []
            : [
                h.div(
                  [h.Class('scenario-fake-form'), h.AriaHidden(true)],
                  [h.span([]), h.span([]), h.span([h.Class('go')])],
                ),
              ]),
          h.p(
            [h.Class('scenario-cardboard'), h.Role('alert')],
            [
              link.page === 'login'
                ? ui.scenario.mail.pageLogin(host)
                : link.page === 'payment'
                  ? ui.scenario.mail.pagePayment(host)
                  : ui.scenario.mail.pageFile,
            ],
          ),
        ]
  return h.div(
    [h.Class('scenario-page'), h.Role('dialog'), h.AriaLabel(link.url)],
    [
      h.div(
        [h.Class('scenario-page-bar')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('screen-button'),
              h.OnClick(send(Message.ClickedClosePage())),
            ],
            [`← ${ui.scenario.mail.backToMail}`],
          ),
          h.span([h.Class('scenario-page-url')], [link.url]),
        ],
      ),
      h.div([h.Class('scenario-page-body')], body),
    ],
  )
}

const feedbackView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  mail: Mail,
): ReadonlyArray<Html> => {
  const { h, ui, inbox } = parts
  return Option.match(markOf(inbox, mail), {
    onNone: () => [],
    onSome: verdict => {
      const isRight = verdict === verdictOf(mail)
      const head = isRight
        ? mail.isPhish
          ? ui.scenario.mail.rightPhish
          : ui.scenario.mail.rightReal
        : mail.isPhish
          ? ui.scenario.mail.wasPhish
          : ui.scenario.mail.wasReal
      return [
        h.div(
          [
            h.Class(`scenario-feedback ${isRight ? 'ok' : 'fail'}`),
            h.Role('status'),
          ],
          [
            h.strong([], [head]),
            text(parts, `mail:${mail.id}:why`),
            ...(!isRight && !mail.isPhish
              ? [` ${ui.scenario.mail.misflaggedReal}`]
              : []),
          ],
        ),
      ]
    },
  })
}

const reportView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  mail: Mail,
): Html => {
  const { h, ui, inbox, send, context } = parts
  const isEditable = context.mode === 'Edit'
  const isForwarded = Array.contains(inbox.forwarded, mail.id)
  const isDeleted = Array.contains(inbox.deleted, mail.id)
  const action = (
    label: string,
    message: Message,
    style: string,
    ghost: string,
  ) =>
    h.button(
      [
        h.Type('button'),
        h.Class(
          classes(
            'scenario-verdict',
            style,
            isGhostKey(parts, ghost) && 'ghost',
          ),
        ),
        ...(isEditable ? [h.OnClick(send(message))] : [h.Disabled(true)]),
      ],
      [label],
    )
  return h.div(
    [h.Class('scenario-report')],
    [
      h.div(
        [h.Class('scenario-verdicts')],
        [
          ...(isForwarded
            ? []
            : [
                action(
                  ui.scenario.mail.forward,
                  Message.ClickedForward(),
                  'real',
                  'forward',
                ),
              ]),
          ...(isDeleted
            ? []
            : [
                action(
                  ui.scenario.mail.delete,
                  Message.ClickedDelete(),
                  'phish',
                  'delete',
                ),
              ]),
        ],
      ),
      ...(isForwarded
        ? [
            h.p(
              [h.Class('scenario-feedback ok'), h.Role('status')],
              [ui.scenario.mail.forwardedNote],
            ),
          ]
        : []),
      ...(isDeleted && mail.isPhish
        ? [
            h.p(
              [h.Class('scenario-feedback fail'), h.Role('alert')],
              [ui.scenario.mail.deletedBaitNote],
            ),
          ]
        : isDeleted
          ? [h.p([h.Class('scenario-vault-note')], [ui.scenario.mail.inTrash])]
          : []),
    ],
  )
}

const sessionsView = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, inbox, model, send, context } = parts
  if (
    Array.isReadonlyArrayEmpty(inbox.sessions) ||
    !isUnlocked(parts, 'mail.sessions')
  ) {
    return []
  }
  const latest = pipe(
    Array.findLast(openSessions(inbox), session => !session.isOwn),
    Option.orElse(() => Array.head(inbox.sessions)),
    Option.map(session => note(parts, `session:${session.id}`)),
    Option.getOrElse(() => ''),
  )
  const bar = h.div(
    [h.Class('scenario-sessions-bar')],
    [
      h.span([], [ui.scenario.mail.lastActivity(latest)]),
      h.button(
        [
          h.Type('button'),
          h.Class(
            classes(
              'scenario-sessions-toggle',
              isGhostKey(parts, 'sessions') && 'ghost',
            ),
          ),
          h.AriaExpanded(model.isSessionsOpen),
          h.OnClick(send(Message.ClickedSessions())),
        ],
        [ui.scenario.mail.details],
      ),
    ],
  )
  const panel = model.isSessionsOpen
    ? [
        h.div(
          [
            h.Class('scenario-sessions'),
            h.Role('region'),
            h.AriaLabel(ui.scenario.mail.sessionsTitle),
          ],
          [
            h.strong([], [ui.scenario.mail.sessionsTitle]),
            h.ul(
              [],
              Array.map(openSessions(inbox), (session, index) =>
                h.keyed('li')(
                  session.id,
                  [
                    h.Class(
                      classes('scenario-session', !session.isOwn && 'stranger'),
                    ),
                  ],
                  [
                    h.span(
                      [h.Class('scenario-session-name')],
                      [text(parts, `session:${session.id}`)],
                    ),
                    h.span(
                      [h.Class('scenario-session-note')],
                      [note(parts, `session:${session.id}`)],
                    ),
                    h.span(
                      [h.Class('scenario-session-tag')],
                      [
                        index === 0
                          ? ui.scenario.mail.thisDevice
                          : session.isOwn
                            ? ui.scenario.mail.ownDevice
                            : ui.scenario.mail.strangeDevice,
                      ],
                    ),
                  ],
                ),
              ),
            ),
            inbox.isSignedOut
              ? h.p(
                  [h.Class('scenario-banner ok'), h.Role('status')],
                  [ui.scenario.mail.signedOut],
                )
              : h.button(
                  [
                    h.Type('button'),
                    h.Class(
                      classes(
                        'screen-button primary',
                        isGhostKey(parts, 'sign-out') && 'ghost',
                      ),
                    ),
                    ...(context.mode === 'Edit'
                      ? [h.OnClick(send(Message.ClickedSignOut()))]
                      : [h.Disabled(true)]),
                  ],
                  [ui.scenario.mail.signOut],
                ),
          ],
        ),
      ]
    : []
  return [...panel, bar]
}

const readerView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, model, inbox, send, context } = parts
  return Option.match(
    Option.flatMap(model.maybeOpen, id => findMail(inbox, id)),
    {
      onNone: () =>
        h.div(
          [h.Class('scenario-reader empty')],
          [
            h.span([h.AriaHidden(true), h.Class('scenario-envelope')], ['✉']),
            h.p([], [ui.scenario.mail.choose]),
            h.p([], [ui.scenario.mail.chooseHint]),
          ],
        ),
      onSome: mail => {
        const name = text(parts, `mail:${mail.id}`)
        const isRevealed = Array.contains(model.revealed, mail.id)
        const mark = markOf(inbox, mail)
        const ghost = ghostTarget(parts)
        const isEditable = context.mode === 'Edit'
        const markButton = (verdict: Verdict, label: string) =>
          h.button(
            [
              h.Type('button'),
              h.Class(
                classes(
                  'scenario-verdict',
                  verdict,
                  Option.exists(
                    ghost,
                    wanted =>
                      wanted.mail === mail.id && wanted.verdict === verdict,
                  ) && 'ghost',
                ),
              ),
              h.AriaPressed(
                Option.exists(mark, chosen => chosen === verdict)
                  ? 'true'
                  : 'false',
              ),
              ...(isEditable
                ? [h.OnClick(send(Message.ClickedMark({ verdict })))]
                : [h.Disabled(true)]),
            ],
            [label],
          )
        return h.div(
          [h.Class('scenario-reader')],
          [
            h.h3(
              [h.Class('scenario-subject')],
              [note(parts, `mail:${mail.id}`)],
            ),
            h.div(
              [h.Class('scenario-from')],
              [
                h.span(
                  [
                    h.Class('scenario-avatar'),
                    h.AriaHidden(true),
                    h.Style({ backgroundColor: avatarColor(inbox, mail) }),
                  ],
                  [
                    name
                      .replace(/[«»"]/g, '')
                      .trim()
                      .charAt(0)
                      .toUpperCase(),
                  ],
                ),
                h.div(
                  [h.Class('scenario-who')],
                  [
                    h.button(
                      [
                        h.Type('button'),
                        h.Class('scenario-sender'),
                        h.AriaExpanded(isRevealed),
                        h.AriaLabel(ui.scenario.mail.showAddress(name)),
                        h.OnClick(
                          send(Message.ClickedSender({ mail: mail.id })),
                        ),
                      ],
                      [
                        name,
                        h.span(
                          [h.AriaHidden(true)],
                          [isRevealed ? ' ▴' : ' ▾'],
                        ),
                      ],
                    ),
                    ...(isRevealed
                      ? [h.span([h.Class('scenario-address')], [mail.address])]
                      : []),
                    h.span(
                      [h.Class('scenario-to')],
                      [ui.scenario.mail.to(inbox.account)],
                    ),
                  ],
                ),
                h.span([h.Class('scenario-time')], [mail.time]),
              ],
            ),
            h.div(
              [h.Class('scenario-body')],
              Array.map(
                paragraphs(text(parts, `mail:${mail.id}:body`)),
                paragraph => h.p([], [paragraph]),
              ),
            ),
            ...Option.match(mail.maybeLink, {
              onNone: () => [],
              onSome: link => [linkView(parts, mail, link)],
            }),
            isReporting(parts)
              ? reportView(parts, mail)
              : h.div(
                  [h.Class('scenario-verdicts')],
                  [
                    markButton('phish', ui.scenario.mail.markPhish),
                    markButton('real', ui.scenario.mail.markReal),
                  ],
                ),
            ...(isReporting(parts) ? [] : feedbackView(parts, mail)),
            ...pipe(
              model.maybePage,
              Option.filter(page => page === mail.id),
              Option.flatMap(() => mail.maybeLink),
              Option.match({
                onNone: () => [],
                onSome: link => [pageView(parts, mail, link)],
              }),
            ),
          ],
        )
      },
    },
  )
}

export const view = <ParentMessage>(
  model: Model,
  context: Context,
  ui: UiStrings,
  send: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  Option.match(context.doc.maybeInbox, {
    onNone: () => h.empty,
    onSome: inbox => {
      const parts: Parts<ParentMessage> = {
        model,
        inbox,
        context,
        ui,
        maybeGhost: Array.head(ghostOps(context.maybeGhost, context.journal)),
        send,
        h,
      }
      const done = Record.size(
        Record.filter(inbox.marks, (_verdict, id) =>
          Option.isSome(findMail(inbox, id)),
        ),
      )
      return h.section(
        [h.Class('scenario-mailbox'), h.AriaLabel(ui.scenario.mail.label)],
        [
          h.div(
            [h.Class('scenario-mailbar')],
            [
              h.span([h.Class('device-dots'), h.AriaHidden(true)]),
              h.strong([], [ui.scenario.mail.label]),
              h.span([h.Class('scenario-account')], [inbox.account]),
            ],
          ),
          h.div(
            [h.Class('scenario-mail-main')],
            [
              h.div(
                [h.Class('scenario-inbox')],
                [
                  h.div(
                    [h.Class('scenario-inbox-head')],
                    [
                      h.span([], [ui.scenario.mail.inbox]),
                      ...(isReporting(parts)
                        ? []
                        : [
                            h.span(
                              [],
                              [
                                ui.scenario.mail.sorted(
                                  done,
                                  inbox.mails.length,
                                ),
                              ],
                            ),
                          ]),
                    ],
                  ),
                  h.ul(
                    [],
                    Array.map(
                      Array.filter(
                        inbox.mails,
                        mail => !Array.contains(inbox.deleted, mail.id),
                      ),
                      mail => inboxRow(parts, mail),
                    ),
                  ),
                  ...Array.match(
                    Array.filter(inbox.mails, mail =>
                      Array.contains(inbox.deleted, mail.id),
                    ),
                    {
                      onEmpty: () => [],
                      onNonEmpty: trash => [
                        h.div(
                          [h.Class('scenario-inbox-head')],
                          [h.span([], [ui.scenario.mail.trash])],
                        ),
                        h.ul(
                          [h.Class('scenario-trash')],
                          Array.map(trash, mail => inboxRow(parts, mail)),
                        ),
                      ],
                    },
                  ),
                ],
              ),
              readerView(parts),
            ],
          ),
          ...sessionsView(parts),
          ...(isUnlocked(parts, 'mail.linkPreview')
            ? [
                h.div(
                  [h.Class('scenario-statusbar'), h.AriaLive('polite')],
                  Option.match(model.maybeHover, {
                    onNone: () => [' '],
                    onSome: url => [
                      `${ui.scenario.mail.linkTo} `,
                      h.strong([], [url]),
                    ],
                  }),
                ),
              ]
            : []),
        ],
      )
    },
  })

// SURFACE

const read = (state: SurfaceState): Option.Option<Model> =>
  state._tag === 'ScenarioMailSurface'
    ? Option.some(state.model)
    : Option.none()

const toSurfaceMessage = (message: Message): SurfaceMessage =>
  SurfaceMessage.GotScenarioMailMessage({ message })

export const mailSurface: SurfaceDefinition<ScenarioTypes> = {
  type: 'mail',
  feature: 'mail',
  init: () => SurfaceState.ScenarioMailSurface({ model: initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotScenarioMailMessage'
      ? Update.foldChild({
          update: update(context),
          read,
          write: (_state: SurfaceState, model: Model): SurfaceState =>
            SurfaceState.ScenarioMailSurface({ model }),
          toParentMessage: toSurfaceMessage,
          toParentOutMessage: (outMessage: OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: (context, ui) =>
    ui.scenario.mail.tab(nameOf(context.label, context.target)),
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
