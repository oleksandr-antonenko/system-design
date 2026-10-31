import { Array, Option, Record, Result, Schema, pipe } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'

import * as AssistantScreen from './assistant'
import { Access, Assistant } from './assistant'
import * as AuthScreen from './auth'
import { Auth } from './auth'
import * as ChatScreen from './chat'
import { Chat } from './chat'
import { type GoalResult, Mistake, ScenarioMessage, goalResult } from './codes'
import * as KeepassScreen from './keepass'
import { Keepass } from './keepass'
import * as TrayScreen from './tray'
import { Tray } from './tray'
import * as VaultScreen from './vault'
import { Vault } from './vault'

export { Mistake, ScenarioMessage } from './codes'
export type { GoalResult } from './codes'

// Документ вида «сценарий» (design D2 add-security-course): что на сцене
// шага — кадр мультика, галерея кадров, учебная страница-двойник или
// письмо — и состояние экранов задачи: телефон (сеть, страница входа, VPN,
// письмо) и почтовый ящик (пометки, нажатые ссылки). Ошибки ученика — тоже
// часть документа: они записываются, но задачу не держат (design D3).

// SCENE

export const FrameArt = Schema.Struct({ id: Schema.String, art: Schema.String })
export type FrameArt = typeof FrameArt.Type

export const Scene = defineTaggedUnion({
  /** Справа только экраны задачи (почта на всю ширину). */
  Blank: {},
  /** Кадр мультика: `art` — адрес картинки, `spots` — герои и предметы на
      нём, на которые ссылаются реплики, подписи и текст шага. */
  Frame: {
    id: Schema.String,
    art: Schema.String,
    spots: Schema.Array(Schema.String),
  },
  /** Миниатюры кадров в итоге урока. */
  Gallery: { frames: Schema.Array(FrameArt) },
  /** Учебная страница-двойник с призом и входом (design D8). */
  Trap: { url: Schema.String, brand: Schema.String },
  /** Одно письмо для квиза «найдите улику»; тексты — `letter:<id>…` урока. */
  Letter: {
    id: Schema.String,
    address: Schema.String,
    to: Schema.String,
    time: Schema.String,
  },
})
export type Scene = typeof Scene.Type

/** Места страницы-двойника и письма: кандидаты квиза `PickHotspot`. */
export const trapSpots: ReadonlyArray<string> = ['skip', 'login', 'url']
export const letterSpots: ReadonlyArray<string> = [
  'name',
  'addr',
  'subj',
  'btn',
  'sign',
]

// PHONE

/** `consent` — страница входа просит только согласие с правилами;
    `login` — просит пароль от рабочей почты: так выглядит сеть-двойник. */
export const Portal = Schema.Literals(['none', 'consent', 'login'])
export type Portal = typeof Portal.Type

export const Network = Schema.Struct({
  ssid: Schema.String,
  isLocked: Schema.Boolean,
  /** Полоски сигнала, 1–3. */
  signal: Schema.Number,
  portal: Portal,
  portalUrl: Schema.String,
})
export type Network = typeof Network.Type

export const PhoneSetup = Schema.Struct({
  /** Чей телефон: подпись урока и цель поверхности `phone:<owner>`. */
  owner: Schema.String,
  /** Рабочая почта владельца: её просит страница сети-двойника. */
  account: Schema.String,
  networks: Schema.Array(Network),
  /** Подпись урока с названием VPN-профиля. */
  vpn: Schema.String,
  /** Письмо в «Почте»: подпись урока `draft` (тема и текст) и
      `<draft>:file` (вложение). */
  draft: Schema.String,
  to: Schema.String,
})
export type PhoneSetup = typeof PhoneSetup.Type

export const Phone = Schema.Struct({
  ...PhoneSetup.fields,
  maybeJoined: Schema.Option(Schema.String),
  isPortalPassed: Schema.Boolean,
  isVpnOn: Schema.Boolean,
  isSent: Schema.Boolean,
})
export type Phone = typeof Phone.Type

// INBOX

export const Verdict = Schema.Literals(['phish', 'real'])
export type Verdict = typeof Verdict.Type

/** Ссылка или вложение письма: как выглядит и что откроется по нажатию. */
export const MailLink = Schema.Struct({
  url: Schema.String,
  look: Schema.Literals(['button', 'text', 'file']),
  page: Schema.Literals(['own', 'login', 'payment', 'file']),
})
export type MailLink = typeof MailLink.Type

export const Mail = Schema.Struct({
  id: Schema.String,
  address: Schema.String,
  time: Schema.String,
  isPhish: Schema.Boolean,
  maybeLink: Schema.Option(MailLink),
})
export type Mail = typeof Mail.Type

/** Что делают с письмами: помечают (урок 6) или пересылают в IT и
    удаляют (урок 12). */
export const InboxActions = Schema.Literals(['mark', 'report'])
export type InboxActions = typeof InboxActions.Type

/** Где открыта почта: подпись урока `session:<id>` — устройство, место и
    время. Первый сеанс — это устройство. */
export const Session = Schema.Struct({
  id: Schema.String,
  isOwn: Schema.Boolean,
})
export type Session = typeof Session.Type

export const InboxSetup = Schema.Struct({
  owner: Schema.String,
  account: Schema.String,
  /** Домен компании: «свой» адрес ссылки заканчивается на него. */
  domain: Schema.String,
  mails: Schema.Array(Mail),
  actions: InboxActions,
  sessions: Schema.Array(Session),
})
export type InboxSetup = typeof InboxSetup.Type

export const Inbox = Schema.Struct({
  ...InboxSetup.fields,
  marks: Schema.Record(Schema.String, Verdict),
  followed: Schema.Array(Schema.String),
  forwarded: Schema.Array(Schema.String),
  deleted: Schema.Array(Schema.String),
  isSignedOut: Schema.Boolean,
})
export type Inbox = typeof Inbox.Type

// DOC

export const ScenarioDoc = Schema.Struct({
  scene: Scene,
  maybePhone: Schema.Option(Phone),
  maybeInbox: Schema.Option(Inbox),
  maybeVault: Schema.Option(Vault),
  maybeAuth: Schema.Option(Auth),
  maybeChat: Schema.Option(Chat),
  maybeAssistant: Schema.Option(Assistant),
  maybeKeepass: Schema.Option(Keepass),
  maybeTray: Schema.Option(Tray),
  mistakes: Schema.Array(Mistake),
})
export type ScenarioDoc = typeof ScenarioDoc.Type

export const emptyScenarioDoc: ScenarioDoc = {
  scene: Scene.Blank(),
  maybePhone: Option.none(),
  maybeInbox: Option.none(),
  maybeVault: Option.none(),
  maybeAuth: Option.none(),
  maybeChat: Option.none(),
  maybeAssistant: Option.none(),
  maybeKeepass: Option.none(),
  maybeTray: Option.none(),
  mistakes: [],
}

// OPERATIONS

export const ScenarioOp = defineTaggedUnion({
  ShowScene: { scene: Scene },
  SetUpPhone: { phone: PhoneSetup },
  SetUpInbox: { inbox: InboxSetup },
  JoinNetwork: { ssid: Schema.String },
  PassPortal: {},
  GiveAwayPassword: {},
  LeaveNetwork: {},
  SetVpn: { isOn: Schema.Boolean },
  OpenMailWithoutVpn: {},
  SendMail: {},
  MarkMail: { mail: Schema.String, verdict: Verdict },
  FollowLink: { mail: Schema.String },
  SetUpVault: { vault: Vault },
  SaveEntry: { entry: Schema.String },
  GeneratePassword: { entry: Schema.String },
  ShareEntry: { entry: Schema.String },
  SendPassword: { entry: Schema.String },
  SetUpAuth: { auth: Auth },
  ScanQr: {},
  ConfirmCode: { code: Schema.String },
  SaveBackupCodes: {},
  AllowSignIn: {},
  DeclineSignIn: {},
  ReportSignIn: {},
  SetUpChat: { chat: Chat },
  SendReply: { thread: Schema.String, reply: Schema.String },
  CallThread: { thread: Schema.String },
  CallContact: { contact: Schema.String },
  ForwardThread: { thread: Schema.String },
  SetUpAssistant: { assistant: Assistant },
  CreateToken: {
    access: Access,
    sections: Schema.Array(Schema.String),
    days: Schema.Number,
  },
  SaveToken: { token: Schema.String },
  RevokeToken: { token: Schema.String },
  PastePassword: {},
  PasteToken: { token: Schema.String },
  GiveReference: { token: Schema.String },
  DeleteChatLine: { index: Schema.Number },
  ChangeAdminPassword: {},
  ForwardMail: { mail: Schema.String },
  DeleteMail: { mail: Schema.String },
  SignOutEverywhere: {},
  SetUpKeepass: { keepass: Keepass },
  CreateBase: {},
  SetPhrase: { phrase: Schema.String },
  AddKeepassEntry: { entry: Schema.String },
  CopyBase: { place: Schema.String },
  SetUpTray: { tray: Tray },
  ChooseAction: { item: Schema.String, action: Schema.String },
})
export type ScenarioOp = typeof ScenarioOp.Type

export const sameOp = Schema.toEquivalence(ScenarioOp)

// QUERIES

export const joinedNetwork = (phone: Phone): Option.Option<Network> =>
  Option.flatMap(phone.maybeJoined, ssid =>
    Array.findFirst(phone.networks, network => network.ssid === ssid),
  )

/** В сети и страница входа пройдена: интернет есть. */
export const isOnline = (phone: Phone): boolean =>
  Option.isSome(phone.maybeJoined) && phone.isPortalPassed

/** Страница входа сети ждёт ученика. */
export const pendingPortal = (phone: Phone): Option.Option<Network> =>
  pipe(
    joinedNetwork(phone),
    Option.filter(
      network => network.portal !== 'none' && !phone.isPortalPassed,
    ),
  )

export const findMail = (inbox: Inbox, id: string): Option.Option<Mail> =>
  Array.findFirst(inbox.mails, mail => mail.id === id)

export const verdictOf = (mail: Mail): Verdict =>
  mail.isPhish ? 'phish' : 'real'

/** Где ученик в задаче на телефоне: от этого зависят реплики на кадре. */
export type PhoneProgress =
  | 'start'
  | 'twin'
  | 'leaked'
  | 'online'
  | 'vpn'
  | 'sent'

export const phoneProgress = (doc: ScenarioDoc): PhoneProgress =>
  Option.match(doc.maybePhone, {
    onNone: () => 'start',
    onSome: (phone): PhoneProgress =>
      phone.isSent
        ? 'sent'
        : isOnline(phone) && phone.isVpnOn
          ? 'vpn'
          : isOnline(phone)
            ? 'online'
            : Option.exists(
                  pendingPortal(phone),
                  network => network.portal === 'login',
                )
              ? 'twin'
              : Array.some(
                    doc.mistakes,
                    mistake => mistake._tag === 'GaveAwayPassword',
                  )
                ? 'leaked'
                : 'start',
  })

// APPLY

type Applied = Result.Result<ScenarioDoc, ScenarioMessage>

const withPhone = (
  doc: ScenarioDoc,
  change: (phone: Phone) => Result.Result<Phone, ScenarioMessage>,
): Applied =>
  Option.match(doc.maybePhone, {
    onNone: () => Result.fail(ScenarioMessage.NoPhone()),
    onSome: phone =>
      Result.map(change(phone), next =>
        modifyFields(doc, { maybePhone: () => Option.some(next) }),
      ),
  })

const withInbox = (
  doc: ScenarioDoc,
  mail: string,
  change: (inbox: Inbox, found: Mail) => Inbox,
): Applied =>
  Option.match(doc.maybeInbox, {
    onNone: () => Result.fail(ScenarioMessage.NoInbox()),
    onSome: inbox =>
      Option.match(findMail(inbox, mail), {
        onNone: () => Result.fail(ScenarioMessage.MailUnknown({ mail })),
        onSome: found =>
          Result.succeed(
            modifyFields(doc, {
              maybeInbox: () => Option.some(change(inbox, found)),
            }),
          ),
      }),
  })

/** Сеансы, которые остаются после «выйти на всех других устройствах». */
export const openSessions = (inbox: Inbox): ReadonlyArray<Session> =>
  inbox.isSignedOut ? Array.take(inbox.sessions, 1) : inbox.sessions

const sameMistake = Schema.toEquivalence(Mistake)

/** Ошибка записывается один раз, сколько бы раз её ни повторили. */
const remember = (doc: ScenarioDoc, mistake: Mistake): ScenarioDoc =>
  Array.some(doc.mistakes, known => sameMistake(known, mistake))
    ? doc
    : modifyFields(doc, { mistakes: mistakes => [...mistakes, mistake] })

const offline = (phone: Phone): Phone =>
  modifyFields(phone, {
    maybeJoined: () => Option.none(),
    isPortalPassed: () => false,
    isVpnOn: () => false,
  })

const joinNetwork = (phone: Phone, ssid: string) =>
  Option.match(
    Array.findFirst(phone.networks, network => network.ssid === ssid),
    {
      onNone: () =>
        Result.fail<ScenarioMessage>(ScenarioMessage.NetworkUnknown({ ssid })),
      onSome: network =>
        network.isLocked
          ? Result.fail<ScenarioMessage>(
              ScenarioMessage.NetworkLocked({ ssid }),
            )
          : Result.succeed(
              modifyFields(phone, {
                maybeJoined: () => Option.some(ssid),
                isPortalPassed: () => network.portal === 'none',
                isVpnOn: () => false,
              }),
            ),
    },
  )

const passPortal = (phone: Phone) =>
  Option.exists(pendingPortal(phone), network => network.portal === 'consent')
    ? Result.succeed(modifyFields(phone, { isPortalPassed: () => true }))
    : Result.fail<ScenarioMessage>(ScenarioMessage.NotJoined())

const giveAwayPassword = (doc: ScenarioDoc): Applied =>
  Option.match(doc.maybePhone, {
    onNone: () => Result.fail(ScenarioMessage.NoPhone()),
    onSome: phone =>
      Option.match(
        Option.filter(
          pendingPortal(phone),
          network => network.portal === 'login',
        ),
        {
          onNone: () => Result.fail(ScenarioMessage.NotJoined()),
          onSome: network =>
            Result.succeed(
              remember(
                modifyFields(doc, {
                  maybePhone: () => Option.some(offline(phone)),
                }),
                Mistake.GaveAwayPassword({ ssid: network.ssid }),
              ),
            ),
        },
      ),
  })

const needsOnline = (
  phone: Phone,
  next: () => Result.Result<Phone, ScenarioMessage>,
) =>
  isOnline(phone)
    ? next()
    : Result.fail<ScenarioMessage>(ScenarioMessage.Offline())

const openMailWithoutVpn = (doc: ScenarioDoc): Applied =>
  Option.match(doc.maybePhone, {
    onNone: () => Result.fail(ScenarioMessage.NoPhone()),
    onSome: phone =>
      isOnline(phone)
        ? Result.succeed(
            phone.isVpnOn ? doc : remember(doc, Mistake.OpenedMailWithoutVpn()),
          )
        : Result.fail(ScenarioMessage.Offline()),
  })

const withVault = (
  doc: ScenarioDoc,
  change: (vault: Vault) => Result.Result<Vault, ScenarioMessage>,
): Applied =>
  Option.match(doc.maybeVault, {
    onNone: () => Result.fail(ScenarioMessage.NoVault()),
    onSome: vault =>
      Result.map(change(vault), next =>
        modifyFields(doc, { maybeVault: () => Option.some(next) }),
      ),
  })

/** Пароль ушёл сообщением: ошибка, запись в сейфе не меняется. */
const sendPassword = (doc: ScenarioDoc, entry: string): Applied =>
  Result.map(
    withVault(doc, vault =>
      Option.isSome(VaultScreen.findEntry(vault, entry))
        ? Result.succeed(vault)
        : Result.fail(ScenarioMessage.EntryUnknown({ entry })),
    ),
    next => remember(next, Mistake.PasswordInChat({ entry })),
  )

const withAuth = (
  doc: ScenarioDoc,
  change: (auth: Auth) => Result.Result<Auth, ScenarioMessage>,
): Applied =>
  Option.match(doc.maybeAuth, {
    onNone: () => Result.fail(ScenarioMessage.NoAuth()),
    onSome: auth =>
      Result.map(change(auth), next =>
        modifyFields(doc, { maybeAuth: () => Option.some(next) }),
      ),
  })

/** «Да» на чужой запрос входа: ошибка, вход можно тут же завершить. */
const allowSignIn = (doc: ScenarioDoc): Applied =>
  Result.map(withAuth(doc, AuthScreen.allowSignIn), next =>
    remember(next, Mistake.AllowedStranger()),
  )

const withChat = <A>(
  doc: ScenarioDoc,
  change: (chat: Chat) => Result.Result<A, ScenarioMessage>,
  write: (doc: ScenarioDoc, changed: A) => ScenarioDoc,
): Applied =>
  Option.match(doc.maybeChat, {
    onNone: () => Result.fail(ScenarioMessage.NoChat()),
    onSome: chat => Result.map(change(chat), changed => write(doc, changed)),
  })

const putChat = (doc: ScenarioDoc, chat: Chat): ScenarioDoc =>
  modifyFields(doc, { maybeChat: () => Option.some(chat) })

/** Ответ, который соглашается без проверки, — ошибка. */
const sendReply = (doc: ScenarioDoc, thread: string, reply: string): Applied =>
  withChat(
    doc,
    chat => ChatScreen.sendReply(chat, thread, reply),
    (before, { chat, tone }) =>
      tone === 'comply'
        ? remember(putChat(before, chat), Mistake.Complied({ thread }))
        : putChat(before, chat),
  )

/** Звонок на незнакомый номер из сообщения — не проверка, а ошибка. */
const callThread = (doc: ScenarioDoc, thread: string): Applied =>
  withChat(
    doc,
    chat => ChatScreen.callThread(chat, thread),
    (before, { isKnown }) =>
      isKnown
        ? before
        : remember(before, Mistake.CalledTheirNumber({ thread })),
  )

const withAssistant = (
  doc: ScenarioDoc,
  change: (assistant: Assistant) => Result.Result<Assistant, ScenarioMessage>,
  maybeMistake: Option.Option<Mistake> = Option.none(),
): Applied =>
  Option.match(doc.maybeAssistant, {
    onNone: () => Result.fail(ScenarioMessage.NoAssistant()),
    onSome: assistant =>
      Result.map(change(assistant), next => {
        const changed = modifyFields(doc, {
          maybeAssistant: () => Option.some(next),
        })
        return Option.match(maybeMistake, {
          onNone: () => changed,
          onSome: mistake => remember(changed, mistake),
        })
      }),
  })

/** Приманку не удаляют, а пересылают: удаление — ошибка, письмо лежит в
    корзине, и переслать его можно оттуда. */
const deleteMail = (doc: ScenarioDoc, mail: string): Applied =>
  Result.map(
    withInbox(doc, mail, inbox =>
      modifyFields(inbox, {
        deleted: deleted => Array.dedupe([...deleted, mail]),
      }),
    ),
    next =>
      Option.exists(
        Option.flatMap(next.maybeInbox, inbox => findMail(inbox, mail)),
        found => found.isPhish,
      )
        ? remember(next, Mistake.DeletedBait({ mail }))
        : next,
  )

const signOutEverywhere = (doc: ScenarioDoc): Applied =>
  Option.match(doc.maybeInbox, {
    onNone: () => Result.fail(ScenarioMessage.NoInbox()),
    onSome: inbox =>
      Result.succeed(
        modifyFields(doc, {
          maybeInbox: () =>
            Option.some(modifyFields(inbox, { isSignedOut: () => true })),
        }),
      ),
  })

const withKeepass = (
  doc: ScenarioDoc,
  change: (keepass: Keepass) => Result.Result<Keepass, ScenarioMessage>,
): Applied =>
  Option.match(doc.maybeKeepass, {
    onNone: () => Result.fail(ScenarioMessage.NoKeepass()),
    onSome: keepass =>
      Result.map(change(keepass), next =>
        modifyFields(doc, { maybeKeepass: () => Option.some(next) }),
      ),
  })

/** Слабая мастер-фраза — ошибка: её угадают, а сменить фразу можно. */
const setPhrase = (doc: ScenarioDoc, phrase: string): Applied =>
  Result.map(
    withKeepass(doc, keepass => KeepassScreen.setPhrase(keepass, phrase)),
    next =>
      Option.exists(
        Option.flatMap(next.maybeKeepass, keepass =>
          KeepassScreen.findPhrase(keepass, phrase),
        ),
        found => !found.isStrong,
      )
        ? remember(next, Mistake.WeakPhrase({ phrase }))
        : next,
  )

/** Выбор действия; опасное записывается ошибкой. */
const chooseAction = (
  doc: ScenarioDoc,
  item: string,
  action: string,
): Applied =>
  Option.match(doc.maybeTray, {
    onNone: () => Result.fail(ScenarioMessage.NoTray()),
    onSome: tray =>
      Result.map(TrayScreen.choose(tray, item, action), next => {
        const changed = modifyFields(doc, {
          maybeTray: () => Option.some(next),
        })
        return Option.match(
          Option.flatMap(
            TrayScreen.findItem(next, item),
            TrayScreen.chosenRisk,
          ),
          {
            onNone: () => changed,
            onSome: risk => remember(changed, Mistake.Risky({ item, risk })),
          },
        )
      }),
  })

const followLink = (doc: ScenarioDoc, mail: string): Applied =>
  Result.map(
    withInbox(doc, mail, inbox =>
      modifyFields(inbox, {
        followed: followed => Array.dedupe([...followed, mail]),
      }),
    ),
    next =>
      Option.exists(
        Option.flatMap(next.maybeInbox, inbox => findMail(inbox, mail)),
        found => found.isPhish && Option.isSome(found.maybeLink),
      )
        ? remember(next, Mistake.FollowedBait({ mail }))
        : next,
  )

export const applyOp = (doc: ScenarioDoc, op: ScenarioOp): Applied =>
  ScenarioOp.match(op, {
    ShowScene: ({ scene }) =>
      Result.succeed(modifyFields(doc, { scene: () => scene })),
    SetUpPhone: ({ phone }) =>
      Result.succeed(
        modifyFields(doc, {
          maybePhone: () =>
            Option.some({
              ...phone,
              maybeJoined: Option.none(),
              isPortalPassed: false,
              isVpnOn: false,
              isSent: false,
            }),
        }),
      ),
    SetUpInbox: ({ inbox }) =>
      Result.succeed(
        modifyFields(doc, {
          maybeInbox: () =>
            Option.some({
              ...inbox,
              marks: {},
              followed: [],
              forwarded: [],
              deleted: [],
              isSignedOut: false,
            }),
        }),
      ),
    JoinNetwork: ({ ssid }) =>
      withPhone(doc, phone => joinNetwork(phone, ssid)),
    PassPortal: () => withPhone(doc, passPortal),
    GiveAwayPassword: () => giveAwayPassword(doc),
    LeaveNetwork: () => withPhone(doc, phone => Result.succeed(offline(phone))),
    SetVpn: ({ isOn }) =>
      withPhone(doc, phone =>
        isOn
          ? needsOnline(phone, () =>
              Result.succeed(modifyFields(phone, { isVpnOn: () => true })),
            )
          : Result.succeed(modifyFields(phone, { isVpnOn: () => false })),
      ),
    OpenMailWithoutVpn: () => openMailWithoutVpn(doc),
    SendMail: () =>
      withPhone(doc, phone =>
        needsOnline(phone, () =>
          phone.isVpnOn
            ? Result.succeed(modifyFields(phone, { isSent: () => true }))
            : Result.fail(ScenarioMessage.VpnOff()),
        ),
      ),
    MarkMail: ({ mail, verdict }) =>
      withInbox(doc, mail, inbox =>
        modifyFields(inbox, {
          marks: marks => Record.set(marks, mail, verdict),
        }),
      ),
    FollowLink: ({ mail }) => followLink(doc, mail),
    SetUpVault: ({ vault }) =>
      Result.succeed(
        modifyFields(doc, { maybeVault: () => Option.some(vault) }),
      ),
    SaveEntry: ({ entry }) =>
      withVault(doc, vault => VaultScreen.saveEntry(vault, entry)),
    GeneratePassword: ({ entry }) =>
      withVault(doc, vault => VaultScreen.generatePassword(vault, entry)),
    ShareEntry: ({ entry }) =>
      withVault(doc, vault => VaultScreen.shareEntry(vault, entry)),
    SendPassword: ({ entry }) => sendPassword(doc, entry),
    SetUpAuth: ({ auth }) =>
      Result.succeed(modifyFields(doc, { maybeAuth: () => Option.some(auth) })),
    ScanQr: () => withAuth(doc, AuthScreen.scanQr),
    ConfirmCode: ({ code }) =>
      withAuth(doc, auth => AuthScreen.confirmCode(auth, code)),
    SaveBackupCodes: () => withAuth(doc, AuthScreen.saveBackupCodes),
    AllowSignIn: () => allowSignIn(doc),
    DeclineSignIn: () => withAuth(doc, AuthScreen.declineSignIn),
    ReportSignIn: () => withAuth(doc, AuthScreen.reportSignIn),
    SetUpChat: ({ chat }) => Result.succeed(putChat(doc, chat)),
    SendReply: ({ thread, reply }) => sendReply(doc, thread, reply),
    CallThread: ({ thread }) => callThread(doc, thread),
    CallContact: ({ contact }) =>
      withChat(doc, chat => ChatScreen.callContact(chat, contact), putChat),
    ForwardThread: ({ thread }) =>
      withChat(doc, chat => ChatScreen.forwardThread(chat, thread), putChat),
    SetUpAssistant: ({ assistant }) =>
      Result.succeed(
        modifyFields(doc, { maybeAssistant: () => Option.some(assistant) }),
      ),
    CreateToken: fields =>
      withAssistant(doc, assistant =>
        AssistantScreen.createToken(assistant, fields),
      ),
    SaveToken: ({ token }) =>
      withAssistant(doc, assistant =>
        AssistantScreen.saveToken(assistant, token),
      ),
    RevokeToken: ({ token }) =>
      withAssistant(doc, assistant =>
        AssistantScreen.revokeToken(assistant, token),
      ),
    PastePassword: () =>
      withAssistant(
        doc,
        AssistantScreen.pastePassword,
        Option.some(Mistake.PastedPassword()),
      ),
    PasteToken: ({ token }) =>
      withAssistant(
        doc,
        assistant => AssistantScreen.giveToken(assistant, token, 'token'),
        Option.some(Mistake.PastedToken()),
      ),
    GiveReference: ({ token }) =>
      withAssistant(doc, assistant =>
        AssistantScreen.giveToken(assistant, token, 'reference'),
      ),
    DeleteChatLine: ({ index }) =>
      withAssistant(doc, assistant =>
        AssistantScreen.deleteLine(assistant, index),
      ),
    ChangeAdminPassword: () =>
      withAssistant(doc, AssistantScreen.changeAdminPassword),
    ForwardMail: ({ mail }) =>
      withInbox(doc, mail, inbox =>
        modifyFields(inbox, {
          forwarded: forwarded => Array.dedupe([...forwarded, mail]),
        }),
      ),
    DeleteMail: ({ mail }) => deleteMail(doc, mail),
    SignOutEverywhere: () => signOutEverywhere(doc),
    SetUpKeepass: ({ keepass }) =>
      Result.succeed(
        modifyFields(doc, { maybeKeepass: () => Option.some(keepass) }),
      ),
    CreateBase: () => withKeepass(doc, KeepassScreen.createBase),
    SetPhrase: ({ phrase }) => setPhrase(doc, phrase),
    AddKeepassEntry: ({ entry }) =>
      withKeepass(doc, keepass => KeepassScreen.addEntry(keepass, entry)),
    CopyBase: ({ place }) =>
      withKeepass(doc, keepass => KeepassScreen.copyBase(keepass, place)),
    SetUpTray: ({ tray }) =>
      Result.succeed(modifyFields(doc, { maybeTray: () => Option.some(tray) })),
    ChooseAction: ({ item, action }) => chooseAction(doc, item, action),
  })

// GOALS

export const ScenarioGoal = defineTaggedUnion({
  /** Телефон в этой сети, и её страница входа пройдена. */
  Online: { ssid: Schema.String },
  VpnOn: {},
  MailSent: {},
  /** Каждая приманка помечена «Это фишинг». */
  PhishFlagged: {},
  /** Каждое настоящее письмо помечено «Настоящее». */
  RealKept: {},
  /** На мониторе не осталось стикеров с паролями. */
  AllSaved: {},
  /** Ни один пароль в сейфе и на стикерах не повторяется. */
  NoReuse: {},
  /** Запись лежит в общем сейфе. */
  InShared: { entry: Schema.String },
  /** Пароль записи заменён сгенерированным. */
  Regenerated: { entry: Schema.String },
  /** 2FA включена: QR-код отсканирован, код подтверждён. */
  TwoFactorOn: {},
  /** Резервные коды сохранены в менеджере паролей. */
  CodesSaved: {},
  /** Чужой запрос входа отклонён, и IT в курсе. */
  StrangerStopped: {},
  /** В чат ушёл этот ответ. */
  Replied: { thread: Schema.String, reply: Schema.String },
  /** Звонок по номеру из справочника. */
  Called: { contact: Schema.String },
  /** Чат переслан в IT. */
  Forwarded: { thread: Schema.String },
  /** Ассистент работает по токену с узкими правами. */
  ScopedAccess: {},
  /** Токен ассистента отозван. */
  AccessRevoked: {},
  /** В чате с ассистентом нет секретов; побывавший там пароль сменён. */
  ChatClean: {},
  /** Письмо переслано в IT. */
  MailForwarded: { mail: Schema.String },
  /** В почте завершены все сеансы, кроме этого устройства. */
  SignedOut: {},
  /** База KeePass создана с надёжной мастер-фразой. */
  StrongPhrase: {},
  /** Все записи урока перенесены в базу KeePass. */
  EntriesAdded: {},
  /** На другом устройстве лежит копия базы со всеми записями. */
  FreshBackup: {},
  /** У каждого из этих предметов выбрано верное действие. */
  Sorted: { items: Schema.Array(Schema.String) },
})
export type ScenarioGoal = typeof ScenarioGoal.Type

const withAuthGoal = (
  doc: ScenarioDoc,
  check: (auth: Auth) => GoalResult,
): GoalResult =>
  Option.match(doc.maybeAuth, {
    onNone: () => goalResult(false, ScenarioMessage.NoAuth()),
    onSome: check,
  })

const withAssistantGoal = (
  doc: ScenarioDoc,
  check: (assistant: Assistant) => GoalResult,
): GoalResult =>
  Option.match(doc.maybeAssistant, {
    onNone: () => goalResult(false, ScenarioMessage.NoAssistant()),
    onSome: check,
  })

const withChatGoal = (
  doc: ScenarioDoc,
  check: (chat: Chat) => GoalResult,
): GoalResult =>
  Option.match(doc.maybeChat, {
    onNone: () => goalResult(false, ScenarioMessage.NoChat()),
    onSome: check,
  })

const withVaultGoal = (
  doc: ScenarioDoc,
  check: (vault: Vault) => GoalResult,
): GoalResult =>
  Option.match(doc.maybeVault, {
    onNone: () => goalResult(false, ScenarioMessage.NoVault()),
    onSome: check,
  })

const withKeepassGoal = (
  doc: ScenarioDoc,
  check: (keepass: Keepass) => GoalResult,
): GoalResult =>
  Option.match(doc.maybeKeepass, {
    onNone: () => goalResult(false, ScenarioMessage.NoKeepass()),
    onSome: check,
  })

const inboxCount = (
  doc: ScenarioDoc,
  isPhish: boolean,
  isWrong: (mark: Option.Option<Verdict>) => boolean,
): number =>
  Option.match(doc.maybeInbox, {
    onNone: () => 0,
    onSome: inbox =>
      Array.filter(
        inbox.mails,
        mail =>
          mail.isPhish === isPhish && isWrong(Record.get(inbox.marks, mail.id)),
      ).length,
  })

export const checkGoal = (doc: ScenarioDoc, goal: ScenarioGoal): GoalResult =>
  ScenarioGoal.match(goal, {
    Online: ({ ssid }) =>
      goalResult(
        Option.exists(
          doc.maybePhone,
          phone =>
            isOnline(phone) &&
            Option.exists(phone.maybeJoined, joined => joined === ssid),
        ),
        ScenarioMessage.NotOnNetwork({ ssid }),
      ),
    VpnOn: () =>
      goalResult(
        Option.exists(
          doc.maybePhone,
          phone => isOnline(phone) && phone.isVpnOn,
        ),
        ScenarioMessage.VpnOff(),
      ),
    MailSent: () =>
      goalResult(
        Option.exists(doc.maybePhone, phone => phone.isSent),
        ScenarioMessage.MailNotSent(),
      ),
    PhishFlagged: () => {
      const left = inboxCount(
        doc,
        true,
        mark => !Option.exists(mark, verdict => verdict === 'phish'),
      )
      return goalResult(
        Option.isSome(doc.maybeInbox) && left === 0,
        ScenarioMessage.PhishLeft({ count: left }),
      )
    },
    RealKept: () => {
      const wrong = inboxCount(
        doc,
        false,
        mark => !Option.exists(mark, verdict => verdict === 'real'),
      )
      return goalResult(
        Option.isSome(doc.maybeInbox) && wrong === 0,
        ScenarioMessage.RealMisflagged({ count: wrong }),
      )
    },
    AllSaved: () => withVaultGoal(doc, VaultScreen.allSaved),
    NoReuse: () => withVaultGoal(doc, VaultScreen.noReuse),
    InShared: ({ entry }) =>
      withVaultGoal(doc, vault => VaultScreen.inShared(vault, entry)),
    Regenerated: ({ entry }) =>
      withVaultGoal(doc, vault => VaultScreen.regenerated(vault, entry)),
    TwoFactorOn: () => withAuthGoal(doc, AuthScreen.twoFactorOn),
    CodesSaved: () => withAuthGoal(doc, AuthScreen.codesSaved),
    StrangerStopped: () => withAuthGoal(doc, AuthScreen.strangerStopped),
    Replied: ({ thread, reply }) =>
      withChatGoal(doc, chat => ChatScreen.replied(chat, thread, reply)),
    Called: ({ contact }) =>
      withChatGoal(doc, chat => ChatScreen.called(chat, contact)),
    Forwarded: ({ thread }) =>
      withChatGoal(doc, chat => ChatScreen.forwarded(chat, thread)),
    ScopedAccess: () => withAssistantGoal(doc, AssistantScreen.scopedAccess),
    AccessRevoked: () => withAssistantGoal(doc, AssistantScreen.accessRevoked),
    ChatClean: () => withAssistantGoal(doc, AssistantScreen.chatClean),
    MailForwarded: ({ mail }) =>
      goalResult(
        Option.exists(doc.maybeInbox, inbox =>
          Array.contains(inbox.forwarded, mail),
        ),
        ScenarioMessage.MailNotForwarded({ mail }),
      ),
    SignedOut: () =>
      goalResult(
        Option.exists(doc.maybeInbox, inbox => inbox.isSignedOut),
        ScenarioMessage.NotSignedOut(),
      ),
    StrongPhrase: () => withKeepassGoal(doc, KeepassScreen.strongPhrase),
    EntriesAdded: () => withKeepassGoal(doc, KeepassScreen.entriesAdded),
    FreshBackup: () => withKeepassGoal(doc, KeepassScreen.freshBackup),
    Sorted: ({ items }) =>
      Option.match(doc.maybeTray, {
        onNone: () => goalResult(false, ScenarioMessage.NoTray()),
        onSome: tray => TrayScreen.sorted(tray, items),
      }),
  })

/** Ошибки, сделанные после `before`: итог задачи перечисляет их. */
export const newMistakes = (
  before: ScenarioDoc,
  after: ScenarioDoc,
): ReadonlyArray<Mistake> =>
  Array.filter(
    after.mistakes,
    mistake =>
      !Array.some(before.mistakes, known => sameMistake(known, mistake)),
  )

// TARGETS

const phoneTargets = (phone: Phone): ReadonlyArray<string> => [
  phone.owner,
  phone.vpn,
  phone.draft,
  `${phone.draft}:file`,
  ...Array.map(phone.networks, network => `net:${network.ssid}`),
]

const inboxTargets = (inbox: Inbox): ReadonlyArray<string> => [
  inbox.owner,
  ...Array.flatMap(inbox.mails, mail => [
    `mail:${mail.id}`,
    `mail:${mail.id}:body`,
    `mail:${mail.id}:why`,
    ...(Option.isSome(mail.maybeLink) ? [`mail:${mail.id}:link`] : []),
  ]),
  ...Array.map(inbox.sessions, session => `session:${session.id}`),
]

const sceneTargets = (scene: Scene): ReadonlyArray<string> =>
  Scene.match(scene, {
    Blank: () => [],
    Frame: ({ id, spots }) => [id, ...spots],
    Gallery: ({ frames }) => Array.map(frames, frame => frame.id),
    Trap: () => trapSpots,
    Letter: ({ id }) => [
      ...letterSpots,
      `letter:${id}`,
      `letter:${id}:body`,
      `letter:${id}:button`,
      `letter:${id}:sign`,
    ],
  })

/** Всё, на что можно сослаться на доске шага: места сцены, подписи
    телефона и писем. */
export const targetsOf = (doc: ScenarioDoc): ReadonlyArray<string> => [
  ...sceneTargets(doc.scene),
  ...Option.match(doc.maybePhone, { onNone: () => [], onSome: phoneTargets }),
  ...Option.match(doc.maybeInbox, { onNone: () => [], onSome: inboxTargets }),
  ...Option.match(doc.maybeVault, {
    onNone: () => [],
    onSome: VaultScreen.vaultTargets,
  }),
  ...Option.match(doc.maybeAuth, {
    onNone: () => [],
    onSome: AuthScreen.authTargets,
  }),
  ...Option.match(doc.maybeChat, {
    onNone: () => [],
    onSome: ChatScreen.chatTargets,
  }),
  ...Option.match(doc.maybeAssistant, {
    onNone: () => [],
    onSome: AssistantScreen.assistantTargets,
  }),
  ...Option.match(doc.maybeKeepass, {
    onNone: () => [],
    onSome: KeepassScreen.keepassTargets,
  }),
  ...Option.match(doc.maybeTray, {
    onNone: () => [],
    onSome: TrayScreen.trayTargets,
  }),
]

export const resolveTarget = (
  doc: ScenarioDoc,
  target: string,
): Option.Option<string> =>
  Array.contains(targetsOf(doc), target) ? Option.some(target) : Option.none()

// JOURNAL

export const describeOp = (op: ScenarioOp): string =>
  ScenarioOp.match(op, {
    ShowScene: ({ scene }) =>
      `ShowScene ${scene._tag}${'id' in scene ? ` ${scene.id}` : ''}`,
    SetUpPhone: ({ phone }) => `SetUpPhone ${phone.owner}`,
    SetUpInbox: ({ inbox }) =>
      `SetUpInbox ${inbox.owner} · ${inbox.mails.length}`,
    JoinNetwork: ({ ssid }) => `JoinNetwork ${ssid}`,
    PassPortal: () => 'PassPortal',
    GiveAwayPassword: () => 'GiveAwayPassword',
    LeaveNetwork: () => 'LeaveNetwork',
    SetVpn: ({ isOn }) => `SetVpn ${isOn ? 'on' : 'off'}`,
    OpenMailWithoutVpn: () => 'OpenMailWithoutVpn',
    SendMail: () => 'SendMail',
    MarkMail: ({ mail, verdict }) => `MarkMail ${mail} · ${verdict}`,
    FollowLink: ({ mail }) => `FollowLink ${mail}`,
    SetUpVault: ({ vault }) =>
      `SetUpVault ${vault.owner} · ${vault.entries.length}`,
    SaveEntry: ({ entry }) => `SaveEntry ${entry}`,
    GeneratePassword: ({ entry }) => `GeneratePassword ${entry}`,
    ShareEntry: ({ entry }) => `ShareEntry ${entry}`,
    SendPassword: ({ entry }) => `SendPassword ${entry}`,
    SetUpAuth: ({ auth }) => `SetUpAuth ${auth.owner} · ${auth.site}`,
    ScanQr: () => 'ScanQr',
    ConfirmCode: ({ code }) => `ConfirmCode ${code}`,
    SaveBackupCodes: () => 'SaveBackupCodes',
    AllowSignIn: () => 'AllowSignIn',
    DeclineSignIn: () => 'DeclineSignIn',
    ReportSignIn: () => 'ReportSignIn',
    SetUpChat: ({ chat }) => `SetUpChat ${chat.owner} · ${chat.threads.length}`,
    SendReply: ({ thread, reply }) => `SendReply ${thread} · ${reply}`,
    CallThread: ({ thread }) => `CallThread ${thread}`,
    CallContact: ({ contact }) => `CallContact ${contact}`,
    ForwardThread: ({ thread }) => `ForwardThread ${thread}`,
    SetUpAssistant: ({ assistant }) =>
      `SetUpAssistant ${assistant.owner} · ${assistant.crm}`,
    CreateToken: ({ access, sections, days }) =>
      `CreateToken ${access} · ${sections.join('+')} · ${days}`,
    SaveToken: ({ token }) => `SaveToken ${token}`,
    RevokeToken: ({ token }) => `RevokeToken ${token}`,
    PastePassword: () => 'PastePassword',
    PasteToken: ({ token }) => `PasteToken ${token}`,
    GiveReference: ({ token }) => `GiveReference ${token}`,
    DeleteChatLine: ({ index }) => `DeleteChatLine ${index}`,
    ChangeAdminPassword: () => 'ChangeAdminPassword',
    ForwardMail: ({ mail }) => `ForwardMail ${mail}`,
    DeleteMail: ({ mail }) => `DeleteMail ${mail}`,
    SignOutEverywhere: () => 'SignOutEverywhere',
    SetUpKeepass: ({ keepass }) =>
      `SetUpKeepass ${keepass.owner} · ${keepass.file}`,
    CreateBase: () => 'CreateBase',
    SetPhrase: ({ phrase }) => `SetPhrase ${phrase}`,
    AddKeepassEntry: ({ entry }) => `AddKeepassEntry ${entry}`,
    CopyBase: ({ place }) => `CopyBase ${place}`,
    SetUpTray: ({ tray }) =>
      `SetUpTray ${tray.owner} · ${tray.look} · ${tray.items.length}`,
    ChooseAction: ({ item, action }) => `ChooseAction ${item} · ${action}`,
  })
