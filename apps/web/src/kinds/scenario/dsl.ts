import { Option } from 'effect'

import type { Access, AssistantSetup } from './assistant'
import type { AuthSetup } from './auth'
import type { ChatReply, Contact, ReplyTone, Thread } from './chat'
import {
  type FrameArt,
  type InboxActions,
  type Mail,
  type MailLink,
  type Network,
  type PhoneProgress,
  type PhoneSetup,
  type ScenarioDoc,
  ScenarioGoal,
  ScenarioOp,
  Scene,
  type Session,
  type Verdict,
  phoneProgress,
} from './doc'
import type { Keepass, KeepassSetup } from './keepass'
import type { Detail, ItemRisk, Look, TrayItem } from './tray'
import type { EntryPlace, Vault, VaultEntry } from './vault'

export { scenario } from './kind'

// Язык уроков вида «сценарий» (design D4 add-security-course). Операции
// ставят сцену шага и экраны задачи; сцена шага — только подписи поверх
// кадра: всё текстовое приходит из `text.<язык>.ts`, на картинке текста нет.

// SURFACES

/** Где ученик решает задачу: доска (кадр) и экраны вида. */
export type ScenarioSurface =
  | 'board'
  | `phone:${string}`
  | `mail:${string}`
  | `vault:${string}`
  | `auth:${string}`
  | `chat:${string}`
  | `assistant:${string}`
  | `crm:${string}`
  | `keepass:${string}`
  | `desk:${string}`
  | `downloads:${string}`
  | `extensions:${string}`

// STAGE

export type Tail = 'bl' | 'br' | 'tl' | 'tr'

/** Место подписи на кадре 4:3: левый верхний угол в процентах кадра и
    наибольшая ширина в процентах. */
export type At = Readonly<{ x: number; y: number; w?: number }>

/** Подпись у нижнего края кадра: отступ снизу в процентах. Так она не
    уходит за край на узком экране, где шрифт крупнее кадра. */
export type FromBottom = Readonly<{ x: number; bottom: number; w?: number }>

/** Откуда отсчитан `y` подписи. */
export type Edge = 'top' | 'bottom'

export type Caption =
  | Readonly<{ _tag: 'Alt' }>
  | Readonly<{ _tag: 'Narration'; x: number; y: number; from: Edge }>
  | Readonly<{
      _tag: 'Bubble'
      who: string
      x: number
      y: number
      w: number
      tail: Tail
      tone: 'say' | 'think' | 'bad'
    }>
  | Readonly<{ _tag: 'Tag'; spot: string; x: number; y: number; color: string }>
  | Readonly<{ _tag: 'Sign'; ssid: string; x: number; y: number }>
  | Readonly<{
      _tag: 'Zoom'
      spot: string
      x: number
      y: number
      from: Edge
      w: number
      tail: Tail
    }>
  | Readonly<{
      _tag: 'Compare'
      spot: string
      x: number
      y: number
      from: Edge
      w: number
    }>
  | Readonly<{ _tag: 'Thumb'; frame: string }>
  | Readonly<{ _tag: 'Sketch' }>

/** Подпись на кадре: текст — `annotations[key]` урока. */
export type ScenarioAnnotate<Key extends string = string> = Readonly<{
  _tag: 'Annotate'
  key: Key
  caption: Caption
}>

export type ScenarioStage = ScenarioAnnotate

const annotate = <const Key extends string>(
  key: Key,
  caption: Caption,
): ScenarioAnnotate<Key> => ({ _tag: 'Annotate', key, caption })

/** Альт-текст картинки кадра: обязателен у каждого кадра. */
export const alt = <const Key extends string>(key: Key) =>
  annotate(key, { _tag: 'Alt' })

const placeOf = (
  at: Readonly<{ x: number; y: number }> | FromBottom,
): Readonly<{ x: number; y: number; from: Edge }> =>
  'bottom' in at
    ? { x: at.x, y: at.bottom, from: 'bottom' }
    : { x: at.x, y: at.y, from: 'top' }

/** Плашка рассказчика; по умолчанию — в левом верхнем углу. */
export const narration = <const Key extends string>(
  key: Key,
  at: Readonly<{ x: number; y: number }> | FromBottom = { x: 2.5, y: 3 },
) => annotate(key, { _tag: 'Narration', ...placeOf(at) })

/** Реплика героя `who` (он есть на кадре). `think` — мысль, `bad` —
    реплика мошенника с красной рамкой. */
export const bubble = <const Key extends string>(
  key: Key,
  who: string,
  at: At & Readonly<{ tail: Tail; tone?: 'say' | 'think' | 'bad' }>,
) =>
  annotate(key, {
    _tag: 'Bubble',
    who,
    x: at.x,
    y: at.y,
    w: at.w ?? 30,
    tail: at.tail,
    tone: at.tone ?? 'say',
  })

/** Подпись предмета на кадре; `[[spot|…]]` в тексте шага её подсвечивает. */
export const tag = <const Key extends string>(
  key: Key,
  spot: string,
  at: Readonly<{ x: number; y: number; color?: string }>,
) =>
  annotate(key, {
    _tag: 'Tag',
    spot,
    x: at.x,
    y: at.y,
    color: at.color ?? '#2FA37A',
  })

/** Табличка с именем сети: строки текста — `annotations[key]` через
    перевод строки (заголовок, подпись, пояснение для открытой таблички). */
export const sign = <const Key extends string>(
  key: Key,
  ssid: string,
  at: Readonly<{ x: number; y: number }>,
) => annotate(key, { _tag: 'Sign', ssid, x: at.x, y: at.y })

/** Лупа: строки через перевод строки, `**…**` — красная пометка. */
export const zoom = <const Key extends string>(
  key: Key,
  spot: string,
  at: (At | FromBottom) & Readonly<{ tail: Tail }>,
) =>
  annotate(key, {
    _tag: 'Zoom',
    spot,
    ...placeOf(at),
    w: at.w ?? 40,
    tail: at.tail,
  })

/** Сравнение адресов строками друг под другом. Строка `подпись|адрес` —
    адрес; первая такая строка — настоящий адрес, остальные — двойники.
    `**…**` в адресе — отличающиеся буквы. Строка без `|` — заголовок
    карточки. */
export const compare = <const Key extends string>(
  key: Key,
  spot: string,
  at: At | FromBottom,
) =>
  annotate(key, {
    _tag: 'Compare',
    spot,
    ...placeOf(at),
    w: at.w ?? 46,
  })

/** Короткое описание сцены поверх кадра-заглушки, пока картинки нет
    (`frames.md` урока). С настоящей картинкой подпись убирают. */
export const sketch = <const Key extends string>(key: Key) =>
  annotate(key, { _tag: 'Sketch' })

/** Подпись миниатюры кадра `frame` в галерее итога. */
export const thumb = <const Key extends string>(key: Key, frame: string) =>
  annotate(key, { _tag: 'Thumb', frame })

// SCENE

/** Кадр мультика: `art` — импорт картинки из `art/` урока. */
export const frame = (
  id: string,
  art: string,
  spots: ReadonlyArray<string>,
): ScenarioOp =>
  ScenarioOp.ShowScene({ scene: Scene.Frame({ id, art, spots }) })

export const gallery = (frames: ReadonlyArray<FrameArt>): ScenarioOp =>
  ScenarioOp.ShowScene({ scene: Scene.Gallery({ frames }) })

export const blank = (): ScenarioOp =>
  ScenarioOp.ShowScene({ scene: Scene.Blank() })

/** Учебная страница-двойник с призом и входом. */
export const trapPage = (url: string, brand: string): ScenarioOp =>
  ScenarioOp.ShowScene({ scene: Scene.Trap({ url, brand }) })

/** Одно письмо для квиза «найдите улику». */
export const letter = (
  fields: Readonly<{ id: string; address: string; to: string; time: string }>,
): ScenarioOp => ScenarioOp.ShowScene({ scene: Scene.Letter(fields) })

// SCREENS

type NetworkFields = Readonly<{
  ssid: string
  signal: number
  isLocked?: boolean
  portal?: Network['portal']
  portalUrl?: string
}>

export const network = (fields: NetworkFields): Network => ({
  ssid: fields.ssid,
  signal: fields.signal,
  isLocked: fields.isLocked ?? false,
  portal: fields.portal ?? 'none',
  portalUrl: fields.portalUrl ?? '',
})

export const setUpPhone = (phone: PhoneSetup): ScenarioOp =>
  ScenarioOp.SetUpPhone({ phone })

type MailFields = Readonly<{
  id: string
  address: string
  time: string
  isPhish: boolean
  link?: MailLink
}>

export const mail = (fields: MailFields): Mail => ({
  id: fields.id,
  address: fields.address,
  time: fields.time,
  isPhish: fields.isPhish,
  maybeLink: Option.fromNullishOr(fields.link),
})

/** Где открыта почта; первый сеанс — это устройство. */
export const session = (id: string, isOwn: boolean): Session => ({ id, isOwn })

/** Почтовый ящик: по умолчанию письма помечают (`mark`); `report` —
    пересылают в IT и удаляют. */
export const setUpInbox = (
  inbox: Readonly<{
    owner: string
    account: string
    domain: string
    mails: ReadonlyArray<Mail>
    actions?: InboxActions
    sessions?: ReadonlyArray<Session>
  }>,
): ScenarioOp =>
  ScenarioOp.SetUpInbox({
    inbox: {
      owner: inbox.owner,
      account: inbox.account,
      domain: inbox.domain,
      mails: inbox.mails,
      actions: inbox.actions ?? 'mark',
      sessions: inbox.sessions ?? [],
    },
  })

type EntryFields = Readonly<{
  id: string
  url: string
  login: string
  password: string
  place?: EntryPlace
}>

/** Запись менеджера паролей; по умолчанию — на стикере у монитора. */
export const entry = (fields: EntryFields): VaultEntry => ({
  id: fields.id,
  url: fields.url,
  login: fields.login,
  password: fields.password,
  place: fields.place ?? 'sticker',
  isGenerated: false,
})

export const setUpVault = (
  vault: Readonly<{
    owner: string
    app: string
    personal: string
    shared: string
    members?: ReadonlyArray<string>
    asker?: string
    entries: ReadonlyArray<VaultEntry>
  }>,
): ScenarioOp =>
  ScenarioOp.SetUpVault({
    vault: {
      owner: vault.owner,
      app: vault.app,
      personal: vault.personal,
      shared: vault.shared,
      members: vault.members ?? [],
      maybeAsker: Option.fromNullishOr(vault.asker),
      entries: vault.entries,
    } satisfies Vault,
  })

/** Страница безопасности сайта и телефон с приложением-аутентификатором:
    2FA выключена, чужой запрос входа ждёт её включения. */
export const setUpAuth = (auth: AuthSetup): ScenarioOp =>
  ScenarioOp.SetUpAuth({
    auth: { ...auth, twoFactor: 'off', signIn: 'waiting' },
  })

/** Чат мессенджера: по умолчанию номер известен, готовых ответов нет. */
export const thread = (
  fields: Readonly<{
    id: string
    number: string
    isKnown?: boolean
    replies?: ReadonlyArray<ChatReply>
  }>,
): Thread => ({
  id: fields.id,
  number: fields.number,
  isKnown: fields.isKnown ?? true,
  replies: fields.replies ?? [],
})

/** Готовый ответ; `comply` соглашается на просьбу без проверки. */
export const reply = (id: string, tone: ReplyTone): ChatReply => ({ id, tone })

export const contact = (id: string, number: string): Contact => ({
  id,
  number,
})

export const setUpChat = (
  chat: Readonly<{
    owner: string
    it: string
    threads: ReadonlyArray<Thread>
    contacts?: ReadonlyArray<Contact>
  }>,
): ScenarioOp =>
  ScenarioOp.SetUpChat({
    chat: {
      owner: chat.owner,
      it: chat.it,
      threads: chat.threads,
      contacts: chat.contacts ?? [],
      sent: [],
      called: [],
      forwarded: [],
    },
  })

/** Чат с ИИ-ассистентом и настройки токенов CRM: токенов ещё нет. */
export const setUpAssistant = (assistant: AssistantSetup): ScenarioOp =>
  ScenarioOp.SetUpAssistant({
    assistant: {
      ...assistant,
      tokens: [],
      chat: [],
      maybeGiven: Option.none(),
      isPasswordChanged: false,
    },
  })

/** Сейф-файл KeePass: базы ещё нет, записи ждут переноса. */
export const setUpKeepass = (keepass: KeepassSetup): ScenarioOp =>
  ScenarioOp.SetUpKeepass({
    keepass: {
      ...keepass,
      entries: keepass.entries.map(id => ({ id, isAdded: false })),
      isCreated: false,
      maybePhrase: Option.none(),
      copies: [],
    } satisfies Keepass,
  })

/** Предмет для разбора: на столе, в «Загрузках» или в браузере. Имя и
    пояснение — подпись `item:<id>`, действия — `action:<id>`, итог
    выбора — `res:<id>:<действие>`. `chosen` — уже выбранное действие
    (установленное расширение «оставлено»). */
export const item = (
  fields: Readonly<{
    id: string
    icon: string
    group: string
    actions: ReadonlyArray<string>
    right: string
    risk?: ItemRisk
    file?: Readonly<{ ext: string }>
    details?: ReadonlyArray<Detail>
    chosen?: string
  }>,
): TrayItem => ({
  id: fields.id,
  icon: fields.icon,
  group: fields.group,
  maybeFile: Option.fromNullishOr(fields.file),
  details: fields.details ?? [],
  actions: fields.actions,
  right: fields.right,
  maybeRisk: Option.fromNullishOr(fields.risk),
  maybeChosen: Option.fromNullishOr(fields.chosen),
})

/** Строка разрешений расширения; `wide` — доступ ко всем сайтам. */
export const detail = (id: string, wide = false): Detail => ({
  id,
  isWide: wide,
})

export const setUpTray = (
  tray: Readonly<{
    owner: string
    look: Look
    app: string
    items: ReadonlyArray<TrayItem>
  }>,
): ScenarioOp => ScenarioOp.SetUpTray({ tray })

// MOVES

export const joinNetwork = (ssid: string): ScenarioOp =>
  ScenarioOp.JoinNetwork({ ssid })
export const passPortal = (): ScenarioOp => ScenarioOp.PassPortal()
export const giveAwayPassword = (): ScenarioOp => ScenarioOp.GiveAwayPassword()
export const leaveNetwork = (): ScenarioOp => ScenarioOp.LeaveNetwork()
export const setVpn = (isOn: boolean): ScenarioOp => ScenarioOp.SetVpn({ isOn })
export const openMailWithoutVpn = (): ScenarioOp =>
  ScenarioOp.OpenMailWithoutVpn()
export const sendMail = (): ScenarioOp => ScenarioOp.SendMail()
export const markMail = (id: string, verdict: Verdict): ScenarioOp =>
  ScenarioOp.MarkMail({ mail: id, verdict })
export const followLink = (id: string): ScenarioOp =>
  ScenarioOp.FollowLink({ mail: id })
export const saveEntry = (id: string): ScenarioOp =>
  ScenarioOp.SaveEntry({ entry: id })
export const generatePassword = (id: string): ScenarioOp =>
  ScenarioOp.GeneratePassword({ entry: id })
export const shareEntry = (id: string): ScenarioOp =>
  ScenarioOp.ShareEntry({ entry: id })
export const sendPassword = (id: string): ScenarioOp =>
  ScenarioOp.SendPassword({ entry: id })
export const scanQr = (): ScenarioOp => ScenarioOp.ScanQr()
export const confirmCode = (code: string): ScenarioOp =>
  ScenarioOp.ConfirmCode({ code })
export const saveBackupCodes = (): ScenarioOp => ScenarioOp.SaveBackupCodes()
export const allowSignIn = (): ScenarioOp => ScenarioOp.AllowSignIn()
export const declineSignIn = (): ScenarioOp => ScenarioOp.DeclineSignIn()
export const reportSignIn = (): ScenarioOp => ScenarioOp.ReportSignIn()
export const sendReply = (threadId: string, replyId: string): ScenarioOp =>
  ScenarioOp.SendReply({ thread: threadId, reply: replyId })
export const callThread = (threadId: string): ScenarioOp =>
  ScenarioOp.CallThread({ thread: threadId })
export const callContact = (contactId: string): ScenarioOp =>
  ScenarioOp.CallContact({ contact: contactId })
export const forwardThread = (threadId: string): ScenarioOp =>
  ScenarioOp.ForwardThread({ thread: threadId })
export const createToken = (
  fields: Readonly<{
    access: Access
    sections: ReadonlyArray<string>
    days: number
  }>,
): ScenarioOp => ScenarioOp.CreateToken(fields)
export const saveToken = (token: string): ScenarioOp =>
  ScenarioOp.SaveToken({ token })
export const revokeToken = (token: string): ScenarioOp =>
  ScenarioOp.RevokeToken({ token })
export const pastePassword = (): ScenarioOp => ScenarioOp.PastePassword()
export const pasteToken = (token: string): ScenarioOp =>
  ScenarioOp.PasteToken({ token })
export const giveReference = (token: string): ScenarioOp =>
  ScenarioOp.GiveReference({ token })
export const deleteChatLine = (index: number): ScenarioOp =>
  ScenarioOp.DeleteChatLine({ index })
export const changeAdminPassword = (): ScenarioOp =>
  ScenarioOp.ChangeAdminPassword()
export const forwardMail = (id: string): ScenarioOp =>
  ScenarioOp.ForwardMail({ mail: id })
export const deleteMail = (id: string): ScenarioOp =>
  ScenarioOp.DeleteMail({ mail: id })
export const signOutEverywhere = (): ScenarioOp =>
  ScenarioOp.SignOutEverywhere()

export const createBase = (): ScenarioOp => ScenarioOp.CreateBase()
export const setPhrase = (phrase: string): ScenarioOp =>
  ScenarioOp.SetPhrase({ phrase })
export const addKeepassEntry = (entry: string): ScenarioOp =>
  ScenarioOp.AddKeepassEntry({ entry })
export const copyBase = (place: string): ScenarioOp =>
  ScenarioOp.CopyBase({ place })

export const chooseAction = (itemId: string, action: string): ScenarioOp =>
  ScenarioOp.ChooseAction({ item: itemId, action })

// GOALS

export { ScenarioGoal as Goal }

// TEXTS

/** Реплика, которая зависит от хода задачи на телефоне. */
export const byProgress = (
  doc: ScenarioDoc,
  lines: Readonly<Record<PhoneProgress, string>>,
): string => lines[phoneProgress(doc)]
