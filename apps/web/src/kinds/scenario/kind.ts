import { Array, Option } from 'effect'

import type { UiStrings } from '../../i18n/ui'
import type { BoardKind, OutcomeRow } from '../contract'
import { BoardMessage, BoardState, KindMessage, KindOp } from '../state'
import type { ScenarioTypes } from '../types'
import * as ScenarioBoard from './board'
import {
  Mistake,
  ScenarioMessage,
  applyOp,
  checkGoal,
  describeOp,
  emptyScenarioDoc,
  newMistakes,
  resolveTarget,
} from './doc'
import type { Caption } from './dsl'
import { assistantSurface } from './surfaces/assistant'
import { authSurface } from './surfaces/auth'
import { chatSurface } from './surfaces/chat'
import { crmSurface } from './surfaces/crm'
import { keepassSurface } from './surfaces/keepass'
import { mailSurface } from './surfaces/mail'
import { phoneSurface } from './surfaces/phone'
import {
  deskSurface,
  downloadsSurface,
  extensionsSurface,
} from './surfaces/tray'
import { vaultSurface } from './surfaces/vault'
import { instruments, view } from './view'

// Вид доски «сценарий» (design D1 add-security-course): кадры мультика с
// подписями и привычные экраны — телефон, почта, страница-двойник. Урок
// идёт слайдами: шаг — кадр и его текст.

const mistakeText = (ui: UiStrings, mistake: Mistake): string =>
  Mistake.match(mistake, {
    GaveAwayPassword: ({ ssid }) => ui.scenario.gaveAwayPassword(ssid),
    OpenedMailWithoutVpn: () => ui.scenario.openedMailWithoutVpn,
    FollowedBait: () => ui.scenario.followedBait,
    PasswordInChat: () => ui.scenario.passwordInChat,
    AllowedStranger: () => ui.scenario.allowedStranger,
    Complied: () => ui.scenario.complied,
    CalledTheirNumber: () => ui.scenario.calledTheirNumber,
    PastedPassword: () => ui.scenario.pastedPassword,
    PastedToken: () => ui.scenario.pastedToken,
    DeletedBait: () => ui.scenario.deletedBait,
    WeakPhrase: () => ui.scenario.weakPhrase,
    Risky: ({ risk }) => ui.scenario.risky(risk),
  })

const outcome = (
  before: ScenarioTypes['Doc'],
  after: ScenarioTypes['Doc'],
  ui: UiStrings,
): ReadonlyArray<OutcomeRow> =>
  Array.match(newMistakes(before, after), {
    onEmpty: () => [
      {
        _tag: 'Plain',
        label: ui.scenario.mistakesLabel,
        value: ui.scenario.noMistakes,
      },
    ],
    onNonEmpty: mistakes =>
      Array.map(mistakes, mistake => ({
        _tag: 'Plain',
        label: ui.scenario.mistakesLabel,
        value: mistakeText(ui, mistake),
      })),
  })

const renderMessage = (
  ui: UiStrings,
  message: ScenarioMessage,
  name: (id: string) => string,
): string =>
  ScenarioMessage.match(message, {
    NoPhone: () => ui.scenario.noPhone,
    NoInbox: () => ui.scenario.noInbox,
    NetworkUnknown: ({ ssid }) => ui.scenario.networkUnknown(ssid),
    NetworkLocked: ({ ssid }) => ui.scenario.networkLocked(ssid),
    NotJoined: () => ui.scenario.notJoined,
    Offline: () => ui.scenario.offline,
    VpnOff: () => ui.scenario.vpnOff,
    MailUnknown: () => ui.scenario.mailUnknown,
    NotOnNetwork: ({ ssid }) => ui.scenario.notOnNetwork(ssid),
    MailNotSent: () => ui.scenario.mailNotSent,
    PhishLeft: ({ count }) => ui.scenario.phishLeft(count),
    RealMisflagged: ({ count }) => ui.scenario.realMisflagged(count),
    NoVault: () => ui.scenario.noVault,
    EntryUnknown: () => ui.scenario.entryUnknown,
    EntryOnSticker: ({ entry }) =>
      ui.scenario.entryOnSticker(name(`entry:${entry}`)),
    StickersLeft: ({ count }) => ui.scenario.stickersLeft(count),
    PasswordReused: ({ count }) => ui.scenario.passwordReused(count),
    NotShared: ({ entry }) => ui.scenario.notShared(name(`entry:${entry}`)),
    NotRegenerated: ({ entry }) =>
      ui.scenario.notRegenerated(name(`entry:${entry}`)),
    NoAuth: () => ui.scenario.noAuth,
    NotScanned: () => ui.scenario.notScanned,
    WrongCode: () => ui.scenario.wrongCode,
    TwoFactorOff: () => ui.scenario.twoFactorOff,
    CodesNotSaved: () => ui.scenario.codesNotSaved,
    NoSignIn: () => ui.scenario.noSignIn,
    SignInPending: () => ui.scenario.signInPending,
    NotReported: () => ui.scenario.notReported,
    NoChat: () => ui.scenario.noChat,
    ThreadUnknown: () => ui.scenario.threadUnknown,
    ReplyUnknown: () => ui.scenario.replyUnknown,
    ContactUnknown: () => ui.scenario.contactUnknown,
    NotReplied: ({ thread }) => ui.scenario.notReplied(name(`chat:${thread}`)),
    NotCalled: ({ contact }) =>
      ui.scenario.notCalled(name(`contact:${contact}`)),
    NotForwarded: ({ thread }) =>
      ui.scenario.notForwarded(name(`chat:${thread}`)),
    NoAssistant: () => ui.scenario.noAssistant,
    NoSections: () => ui.scenario.noSections,
    TokenUnknown: () => ui.scenario.tokenUnknown,
    TokenRevoked: () => ui.scenario.tokenRevoked,
    TokenNotSaved: () => ui.scenario.tokenNotSaved,
    LineUnknown: () => ui.scenario.lineUnknown,
    NoAccessGiven: () => ui.scenario.noAccessGiven,
    AccessTooBroad: () => ui.scenario.accessTooBroad,
    AccessActive: () => ui.scenario.accessActive,
    SecretInChat: () => ui.scenario.secretInChat,
    PasswordNotChanged: () => ui.scenario.passwordNotChanged,
    MailNotForwarded: ({ mail }) =>
      ui.scenario.mailNotForwarded(name(`mail:${mail}`)),
    NotSignedOut: () => ui.scenario.notSignedOut,
    NoKeepass: () => ui.scenario.noKeepass,
    NoBase: () => ui.scenario.noBase,
    PhraseMissing: () => ui.scenario.phraseMissing,
    PhraseUnknown: () => ui.scenario.phraseUnknown,
    PhraseWeak: () => ui.scenario.phraseWeak,
    PlaceUnknown: () => ui.scenario.placeUnknown,
    KeepassEntryUnknown: () => ui.scenario.entryUnknown,
    EntriesLeft: ({ count }) => ui.scenario.entriesLeft(count),
    NoBackup: () => ui.scenario.noBackup,
    BackupSameDevice: () => ui.scenario.backupSameDevice,
    BackupStale: () => ui.scenario.backupStale,
    NoTray: () => ui.scenario.noTray,
    ItemUnknown: () => ui.scenario.itemUnknown,
    ActionUnknown: () => ui.scenario.actionUnknown,
    ItemsLeft: ({ count }) => ui.scenario.itemsLeft(count),
  })

const captionTargets = (caption: Caption): ReadonlyArray<string> =>
  caption._tag === 'Bubble'
    ? [caption.who]
    : caption._tag === 'Tag' ||
        caption._tag === 'Zoom' ||
        caption._tag === 'Compare'
      ? [caption.spot]
      : caption._tag === 'Sign'
        ? ['sign']
        : caption._tag === 'Thumb'
          ? [caption.frame]
          : []

export const scenario: BoardKind<ScenarioTypes> = {
  id: 'scenario',
  presentation: 'slides',

  empty: emptyScenarioDoc,
  apply: applyOp,
  run: doc => doc,

  checkGoal: (doc, _run, goal) => ({
    ...checkGoal(doc, goal),
    focusNodes: [],
    focusEdges: [],
  }),
  isHiddenGoal: () => false,
  solvedGoalText: () => Option.none(),
  outcome,
  taskHeading: ui => ui.scenario.taskHeading,
  taskHowTo: ui => ui.scenario.taskHowTo,
  pickHowTo: ui => ui.scenario.pickHowTo,
  solveFirst: ui => ui.scenario.solveFirst,

  proseContext: doc => doc,
  annotationInput: doc => doc,
  resolveTarget,
  stage: {
    targets: item => captionTargets(item.caption),
    annotationKey: item => Option.some(item.key),
    describe: item => `${item.caption._tag} ${item.key}`,
  },
  targetName: (_doc, target) => target,
  describeOp,
  moveStage: () => [],
  renderMessage: (_locale, ui, message, name) =>
    renderMessage(ui, message, name),

  op: {
    wrap: op => KindOp.ScenarioOp({ op }),
    unwrap: stored =>
      stored._tag === 'ScenarioOp' ? Option.some(stored.op) : Option.none(),
  },
  message: {
    wrap: message => KindMessage.ScenarioMessage({ message }),
    unwrap: stored =>
      stored._tag === 'ScenarioMessage'
        ? Option.some(stored.message)
        : Option.none(),
  },

  board: {
    init: ScenarioBoard.initialModel,
    state: {
      wrap: model => BoardState.ScenarioBoard({ model }),
      unwrap: stored =>
        stored._tag === 'ScenarioBoard'
          ? Option.some(stored.model)
          : Option.none(),
    },
    message: {
      wrap: message => BoardMessage.GotScenarioBoardMessage({ message }),
      unwrap: stored =>
        stored._tag === 'GotScenarioBoardMessage'
          ? Option.some(stored.message)
          : Option.none(),
    },
    update: ScenarioBoard.update,
    pressDelete: ScenarioBoard.pressDelete,
    interrupt: ScenarioBoard.interrupt,
    replay: model => model,
    frame: ScenarioBoard.frame,
    view,
    instruments,
  },
  surfaces: [
    phoneSurface,
    mailSurface,
    vaultSurface,
    authSurface,
    chatSurface,
    assistantSurface,
    crmSurface,
    keepassSurface,
    deskSurface,
    downloadsSurface,
    extensionsSurface,
  ],

  quizzes: ['PickHotspot'],
  picture: () => Option.none(),
}
