import { Option, Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

// Коды вида «сценарий»: отказы операций, невыполненные цели и ошибки
// ученика. Тексты — `ui.scenario`. Свой модуль, потому что их строят и
// документ (`doc.ts`), и экраны, которые он собирает (`vault.ts`, …).

// MESSAGES

/** Коды отказов операций и невыполненных целей. */
export const ScenarioMessage = defineTaggedUnion({
  NoPhone: {},
  NoInbox: {},
  NetworkUnknown: { ssid: Schema.String },
  NetworkLocked: { ssid: Schema.String },
  NotJoined: {},
  Offline: {},
  VpnOff: {},
  MailUnknown: { mail: Schema.String },
  NotOnNetwork: { ssid: Schema.String },
  MailNotSent: {},
  PhishLeft: { count: Schema.Number },
  RealMisflagged: { count: Schema.Number },
  NoVault: {},
  EntryUnknown: { entry: Schema.String },
  EntryOnSticker: { entry: Schema.String },
  StickersLeft: { count: Schema.Number },
  PasswordReused: { count: Schema.Number },
  NotShared: { entry: Schema.String },
  NotRegenerated: { entry: Schema.String },
  NoAuth: {},
  NotScanned: {},
  WrongCode: {},
  TwoFactorOff: {},
  CodesNotSaved: {},
  NoSignIn: {},
  SignInPending: {},
  NotReported: {},
  NoChat: {},
  ThreadUnknown: { thread: Schema.String },
  ReplyUnknown: { reply: Schema.String },
  ContactUnknown: { contact: Schema.String },
  NotReplied: { thread: Schema.String },
  NotCalled: { contact: Schema.String },
  NotForwarded: { thread: Schema.String },
  NoAssistant: {},
  NoSections: {},
  TokenUnknown: { token: Schema.String },
  TokenRevoked: { token: Schema.String },
  TokenNotSaved: { token: Schema.String },
  LineUnknown: {},
  NoAccessGiven: {},
  AccessTooBroad: {},
  AccessActive: {},
  SecretInChat: {},
  PasswordNotChanged: {},
  MailNotForwarded: { mail: Schema.String },
  NotSignedOut: {},
  NoKeepass: {},
  NoBase: {},
  PhraseMissing: {},
  PhraseUnknown: { phrase: Schema.String },
  PhraseWeak: {},
  PlaceUnknown: { place: Schema.String },
  KeepassEntryUnknown: { entry: Schema.String },
  EntriesLeft: { count: Schema.Number },
  NoBackup: {},
  BackupSameDevice: {},
  BackupStale: {},
  NoTray: {},
  ItemUnknown: { item: Schema.String },
  ActionUnknown: { action: Schema.String },
  ItemsLeft: { count: Schema.Number },
})
export type ScenarioMessage = typeof ScenarioMessage.Type

// MISTAKES

/** Ошибки ученика: документ их записывает, но задачу они не держат. */
export const Mistake = defineTaggedUnion({
  GaveAwayPassword: { ssid: Schema.String },
  OpenedMailWithoutVpn: {},
  FollowedBait: { mail: Schema.String },
  PasswordInChat: { entry: Schema.String },
  AllowedStranger: {},
  Complied: { thread: Schema.String },
  CalledTheirNumber: { thread: Schema.String },
  PastedPassword: {},
  PastedToken: {},
  DeletedBait: { mail: Schema.String },
  WeakPhrase: { phrase: Schema.String },
  /** Опасное действие при разборе предметов (`tray.ts`): вид риска —
      `plug`, `run`, `grant` или `unlocked`. */
  Risky: { item: Schema.String, risk: Schema.String },
})
export type Mistake = typeof Mistake.Type

// GOALS

export type GoalResult = Readonly<{
  met: boolean
  maybeFailure: Option.Option<ScenarioMessage>
}>

export const goalResult = (
  met: boolean,
  failure: ScenarioMessage,
): GoalResult => ({
  met,
  maybeFailure: met ? Option.none() : Option.some(failure),
})
