import { Array, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import {
  Mistake,
  type ScenarioDoc,
  ScenarioGoal,
  ScenarioMessage,
  type ScenarioOp,
  applyOp,
  checkGoal,
  emptyScenarioDoc,
  newMistakes,
  openSessions,
  phoneProgress,
  resolveTarget,
} from './doc'
import {
  allowSignIn,
  callContact,
  callThread,
  changeAdminPassword,
  confirmCode,
  contact,
  createToken,
  declineSignIn,
  deleteChatLine,
  deleteMail,
  entry,
  followLink,
  forwardMail,
  forwardThread,
  frame,
  generatePassword,
  giveAwayPassword,
  giveReference,
  joinNetwork,
  mail,
  markMail,
  network,
  openMailWithoutVpn,
  passPortal,
  pastePassword,
  pasteToken,
  reply,
  reportSignIn,
  revokeToken,
  saveBackupCodes,
  saveEntry,
  saveToken,
  scanQr,
  sendMail,
  sendPassword,
  sendReply,
  session,
  setUpAssistant,
  setUpAuth,
  setUpChat,
  setUpInbox,
  setUpPhone,
  setUpVault,
  setVpn,
  shareEntry,
  signOutEverywhere,
  thread,
} from './dsl'

// Документ вида «сценарий»: экраны задачи проверяются по состоянию, а
// ошибки ученика записываются, но не держат задачу (design D2, D3).

const fold = (ops: ReadonlyArray<ScenarioOp>, start = emptyScenarioDoc) =>
  Array.reduce(ops, start, (doc, op) =>
    Result.getOrElse(applyOp(doc, op), () => doc),
  )

const refusal = (doc: ScenarioDoc, op: ScenarioOp) =>
  Result.match(applyOp(doc, op), {
    onSuccess: () => Option.none(),
    onFailure: Option.some,
  })

const phone = setUpPhone({
  owner: 'marina',
  account: 'marina@romashka.example',
  networks: [
    network({ ssid: 'TWIN', signal: 3, portal: 'login' }),
    network({ ssid: 'REAL', signal: 2, portal: 'consent' }),
    network({ ssid: 'LOCKED', signal: 1, isLocked: true }),
  ],
  vpn: 'vpn-profile',
  draft: 'contract',
  to: 'client@lastochka.example',
})

const inbox = setUpInbox({
  owner: 'marina',
  account: 'marina@romashka.example',
  domain: 'romashka.example',
  mails: [
    mail({
      id: 'bait',
      address: 'it@rornashka.example',
      time: '09:12',
      isPhish: true,
      link: {
        url: 'https://rornashka.example/login',
        look: 'button',
        page: 'login',
      },
    }),
    mail({
      id: 'own',
      address: 'hr@romashka.example',
      time: '10:00',
      isPhish: false,
      link: { url: 'https://hr.romashka.example/', look: 'text', page: 'own' },
    }),
  ],
})

const met = (doc: ScenarioDoc, goal: ScenarioGoal) => checkGoal(doc, goal).met

describe('phone', () => {
  test('the real network needs its sign-in page before the internet works', () => {
    const joined = fold([phone, joinNetwork('REAL')])
    expect(met(joined, ScenarioGoal.Online({ ssid: 'REAL' }))).toBe(false)
    expect(refusal(joined, setVpn(true))).toEqual(
      Option.some(ScenarioMessage.Offline()),
    )
    const online = fold([passPortal()], joined)
    expect(met(online, ScenarioGoal.Online({ ssid: 'REAL' }))).toBe(true)
    expect(phoneProgress(online)).toBe('online')
  })

  test('a locked network is refused, not joined', () => {
    expect(refusal(fold([phone]), joinNetwork('LOCKED'))).toEqual(
      Option.some(ScenarioMessage.NetworkLocked({ ssid: 'LOCKED' })),
    )
  })

  test('the password on the lookalike page is a slip: recorded once, phone offline, task goes on', () => {
    const twin = fold([phone, joinNetwork('TWIN')])
    expect(phoneProgress(twin)).toBe('twin')
    expect(refusal(twin, passPortal())).toEqual(
      Option.some(ScenarioMessage.NotJoined()),
    )
    const leaked = fold([giveAwayPassword()], twin)
    expect(leaked.mistakes).toEqual([
      Mistake.GaveAwayPassword({ ssid: 'TWIN' }),
    ])
    expect(Option.flatMap(leaked.maybePhone, p => p.maybeJoined)).toEqual(
      Option.none(),
    )
    expect(phoneProgress(leaked)).toBe('leaked')
    const again = fold([joinNetwork('TWIN'), giveAwayPassword()], leaked)
    expect(again.mistakes).toHaveLength(1)
    const solved = fold(
      [joinNetwork('REAL'), passPortal(), setVpn(true), sendMail()],
      again,
    )
    expect(met(solved, ScenarioGoal.MailSent())).toBe(true)
    expect(newMistakes(fold([phone]), solved)).toEqual([
      Mistake.GaveAwayPassword({ ssid: 'TWIN' }),
    ])
  })

  test('mail goes out only through VPN; opening it without VPN is a slip', () => {
    const online = fold([phone, joinNetwork('REAL'), passPortal()])
    expect(refusal(online, sendMail())).toEqual(
      Option.some(ScenarioMessage.VpnOff()),
    )
    const careless = fold([openMailWithoutVpn()], online)
    expect(careless.mistakes).toEqual([Mistake.OpenedMailWithoutVpn()])
    const sent = fold([setVpn(true), sendMail()], careless)
    expect(met(sent, ScenarioGoal.VpnOn())).toBe(true)
    expect(met(sent, ScenarioGoal.MailSent())).toBe(true)
    expect(phoneProgress(sent)).toBe('sent')
  })

  test('opening mail with VPN on is not a slip', () => {
    const careful = fold([
      phone,
      joinNetwork('REAL'),
      passPortal(),
      setVpn(true),
      openMailWithoutVpn(),
    ])
    expect(careful.mistakes).toEqual([])
  })

  test('labels of the phone are targets on the board', () => {
    const doc = fold([phone])
    expect(resolveTarget(doc, 'net:REAL')).toEqual(Option.some('net:REAL'))
    expect(resolveTarget(doc, 'contract:file')).toEqual(
      Option.some('contract:file'),
    )
    expect(resolveTarget(doc, 'net:NOPE')).toEqual(Option.none())
  })
})

describe('inbox', () => {
  test('both goals need every email marked right; a mark can be changed', () => {
    const start = fold([inbox])
    expect(checkGoal(start, ScenarioGoal.PhishFlagged()).maybeFailure).toEqual(
      Option.some(ScenarioMessage.PhishLeft({ count: 1 })),
    )
    const wrong = fold(
      [markMail('bait', 'real'), markMail('own', 'phish')],
      start,
    )
    expect(met(wrong, ScenarioGoal.PhishFlagged())).toBe(false)
    expect(checkGoal(wrong, ScenarioGoal.RealKept()).maybeFailure).toEqual(
      Option.some(ScenarioMessage.RealMisflagged({ count: 1 })),
    )
    const right = fold(
      [markMail('bait', 'phish'), markMail('own', 'real')],
      wrong,
    )
    expect(met(right, ScenarioGoal.PhishFlagged())).toBe(true)
    expect(met(right, ScenarioGoal.RealKept())).toBe(true)
  })

  test('a link in a bait is a slip, a link in a genuine email is not', () => {
    const doc = fold([
      inbox,
      followLink('own'),
      followLink('bait'),
      followLink('bait'),
    ])
    expect(doc.mistakes).toEqual([Mistake.FollowedBait({ mail: 'bait' })])
  })

  test('an unknown email is refused', () => {
    expect(refusal(fold([inbox]), markMail('nope', 'phish'))).toEqual(
      Option.some(ScenarioMessage.MailUnknown({ mail: 'nope' })),
    )
  })
})

const vault = setUpVault({
  owner: 'marina',
  app: 'vault-app',
  personal: 'vault-personal',
  shared: 'vault-team',
  members: ['oleg'],
  asker: 'oleg',
  entries: [
    entry({ id: 'crm', url: 'crm.example', login: 'm', password: 'same' }),
    entry({ id: 'lunch', url: 'lunch.example', login: 'm', password: 'same' }),
    entry({
      id: 'mail',
      url: 'mail.example',
      login: 'm',
      password: 'own',
      place: 'personal',
    }),
  ],
})

describe('vault', () => {
  test('stickers move into the vault; a password on a sticker cannot be replaced or shared', () => {
    const start = fold([vault])
    expect(checkGoal(start, ScenarioGoal.AllSaved()).maybeFailure).toEqual(
      Option.some(ScenarioMessage.StickersLeft({ count: 2 })),
    )
    expect(refusal(start, generatePassword('crm'))).toEqual(
      Option.some(ScenarioMessage.EntryOnSticker({ entry: 'crm' })),
    )
    expect(refusal(start, shareEntry('crm'))).toEqual(
      Option.some(ScenarioMessage.EntryOnSticker({ entry: 'crm' })),
    )
    const saved = fold([saveEntry('crm'), saveEntry('lunch')], start)
    expect(met(saved, ScenarioGoal.AllSaved())).toBe(true)
  })

  test('a reused password counts until one of its copies is generated', () => {
    const saved = fold([vault, saveEntry('crm'), saveEntry('lunch')])
    expect(checkGoal(saved, ScenarioGoal.NoReuse()).maybeFailure).toEqual(
      Option.some(ScenarioMessage.PasswordReused({ count: 2 })),
    )
    const fixed = fold([generatePassword('crm')], saved)
    expect(met(fixed, ScenarioGoal.NoReuse())).toBe(true)
    expect(met(fixed, ScenarioGoal.Regenerated({ entry: 'crm' }))).toBe(true)
    expect(met(fixed, ScenarioGoal.Regenerated({ entry: 'mail' }))).toBe(false)
  })

  test('sharing moves the entry into the shared vault; a password sent in a chat is a slip', () => {
    const start = fold([vault])
    const sent = fold([sendPassword('mail'), sendPassword('mail')], start)
    expect(sent.mistakes).toEqual([Mistake.PasswordInChat({ entry: 'mail' })])
    expect(met(sent, ScenarioGoal.InShared({ entry: 'mail' }))).toBe(false)
    const shared = fold([shareEntry('mail')], sent)
    expect(met(shared, ScenarioGoal.InShared({ entry: 'mail' }))).toBe(true)
    expect(refusal(start, sendPassword('nope'))).toEqual(
      Option.some(ScenarioMessage.EntryUnknown({ entry: 'nope' })),
    )
  })

  test('vault goals without a vault fail with their own code', () => {
    expect(
      checkGoal(emptyScenarioDoc, ScenarioGoal.AllSaved()).maybeFailure,
    ).toEqual(Option.some(ScenarioMessage.NoVault()))
  })

  test('entries, vaults and the request are targets on the board', () => {
    const doc = fold([vault])
    expect(resolveTarget(doc, 'entry:crm')).toEqual(Option.some('entry:crm'))
    expect(resolveTarget(doc, 'vault-team')).toEqual(Option.some('vault-team'))
    expect(resolveTarget(doc, 'vault:request')).toEqual(
      Option.some('vault:request'),
    )
  })
})

const auth = setUpAuth({
  owner: 'marina',
  site: 'site-crm',
  url: 'crm.example/security',
  account: 'marina@romashka.example',
  code: '381640',
  request: 'request',
})

describe('two-factor', () => {
  test('the code is accepted only after the QR scan and only when it matches', () => {
    const start = fold([auth])
    expect(refusal(start, confirmCode('381640'))).toEqual(
      Option.some(ScenarioMessage.NotScanned()),
    )
    const scanned = fold([scanQr()], start)
    expect(refusal(scanned, confirmCode('111111'))).toEqual(
      Option.some(ScenarioMessage.WrongCode()),
    )
    const on = fold([confirmCode('381 640')], scanned)
    expect(met(on, ScenarioGoal.TwoFactorOn())).toBe(true)
    expect(met(on, ScenarioGoal.CodesSaved())).toBe(false)
  })

  test('the stranger’s request arrives once the backup codes are saved', () => {
    const on = fold([auth, scanQr(), confirmCode('381640')])
    expect(refusal(on, declineSignIn())).toEqual(
      Option.some(ScenarioMessage.NoSignIn()),
    )
    expect(refusal(fold([auth]), saveBackupCodes())).toEqual(
      Option.some(ScenarioMessage.TwoFactorOff()),
    )
    const saved = fold([saveBackupCodes()], on)
    expect(met(saved, ScenarioGoal.CodesSaved())).toBe(true)
    expect(
      checkGoal(saved, ScenarioGoal.StrangerStopped()).maybeFailure,
    ).toEqual(Option.some(ScenarioMessage.SignInPending()))
    const declined = fold([declineSignIn()], saved)
    expect(
      checkGoal(declined, ScenarioGoal.StrangerStopped()).maybeFailure,
    ).toEqual(Option.some(ScenarioMessage.NotReported()))
    const reported = fold([reportSignIn()], declined)
    expect(met(reported, ScenarioGoal.StrangerStopped())).toBe(true)
    expect(reported.mistakes).toEqual([])
  })

  test('“Yes” to the stranger is a slip; the sign-in can still be ended and reported', () => {
    const allowed = fold([
      auth,
      scanQr(),
      confirmCode('381640'),
      saveBackupCodes(),
      allowSignIn(),
    ])
    expect(allowed.mistakes).toEqual([Mistake.AllowedStranger()])
    const stopped = fold([declineSignIn(), reportSignIn()], allowed)
    expect(met(stopped, ScenarioGoal.StrangerStopped())).toBe(true)
  })
})

const chat = setUpChat({
  owner: 'marina',
  it: 'ira',
  threads: [
    thread({
      id: 'boss',
      number: '+1',
      isKnown: false,
      replies: [reply('pay', 'comply'), reply('pause', 'safe')],
    }),
    thread({ id: 'ira', number: '+2' }),
  ],
  contacts: [contact('victor', '+3')],
})

describe('messenger', () => {
  test('a pause, a call from the directory and a forward meet the goals', () => {
    const start = fold([chat])
    expect(
      checkGoal(start, ScenarioGoal.Called({ contact: 'victor' })).maybeFailure,
    ).toEqual(Option.some(ScenarioMessage.NotCalled({ contact: 'victor' })))
    const done = fold(
      [
        sendReply('boss', 'pause'),
        callContact('victor'),
        forwardThread('boss'),
      ],
      start,
    )
    expect(
      met(done, ScenarioGoal.Replied({ thread: 'boss', reply: 'pause' })),
    ).toBe(true)
    expect(met(done, ScenarioGoal.Called({ contact: 'victor' }))).toBe(true)
    expect(met(done, ScenarioGoal.Forwarded({ thread: 'boss' }))).toBe(true)
    expect(done.mistakes).toEqual([])
  })

  test('agreeing without a check and calling the number from the message are slips', () => {
    const doc = fold([
      chat,
      sendReply('boss', 'pay'),
      sendReply('boss', 'pay'),
      callThread('boss'),
      callThread('ira'),
    ])
    expect(doc.mistakes).toEqual([
      Mistake.Complied({ thread: 'boss' }),
      Mistake.CalledTheirNumber({ thread: 'boss' }),
    ])
    expect(
      met(doc, ScenarioGoal.Replied({ thread: 'boss', reply: 'pause' })),
    ).toBe(false)
  })

  test('unknown chats, replies and contacts are refused', () => {
    const start = fold([chat])
    expect(refusal(start, sendReply('nope', 'pause'))).toEqual(
      Option.some(ScenarioMessage.ThreadUnknown({ thread: 'nope' })),
    )
    expect(refusal(start, sendReply('boss', 'nope'))).toEqual(
      Option.some(ScenarioMessage.ReplyUnknown({ reply: 'nope' })),
    )
    expect(refusal(start, callContact('nope'))).toEqual(
      Option.some(ScenarioMessage.ContactUnknown({ contact: 'nope' })),
    )
  })
})

const assistant = setUpAssistant({
  owner: 'marina',
  bot: 'assistant',
  crm: 'crm',
  url: 'crm.example/settings',
  sections: ['sales', 'clients'],
  need: 'sales',
  days: 7,
  reference: 'op://Work/crm-agent/token',
})

const narrow = createToken({ access: 'read', sections: ['sales'], days: 7 })

describe('assistant and CRM tokens', () => {
  test('a narrow token given by reference and revoked after the work meets every goal', () => {
    const start = fold([assistant])
    expect(checkGoal(start, ScenarioGoal.ChatClean()).maybeFailure).toEqual(
      Option.some(ScenarioMessage.NoAccessGiven()),
    )
    expect(refusal(fold([narrow], start), giveReference('t1'))).toEqual(
      Option.some(ScenarioMessage.TokenNotSaved({ token: 't1' })),
    )
    const given = fold([narrow, saveToken('t1'), giveReference('t1')], start)
    expect(met(given, ScenarioGoal.ScopedAccess())).toBe(true)
    expect(met(given, ScenarioGoal.ChatClean())).toBe(true)
    expect(checkGoal(given, ScenarioGoal.AccessRevoked()).maybeFailure).toEqual(
      Option.some(ScenarioMessage.AccessActive()),
    )
    const revoked = fold([revokeToken('t1')], given)
    expect(met(revoked, ScenarioGoal.AccessRevoked())).toBe(true)
    expect(revoked.mistakes).toEqual([])
    expect(refusal(revoked, giveReference('t1'))).toEqual(
      Option.some(ScenarioMessage.TokenRevoked({ token: 't1' })),
    )
  })

  test('a broad token is not scoped access', () => {
    const doc = fold([
      assistant,
      createToken({ access: 'admin', sections: ['sales', 'clients'], days: 0 }),
      saveToken('t1'),
      giveReference('t1'),
    ])
    expect(checkGoal(doc, ScenarioGoal.ScopedAccess()).maybeFailure).toEqual(
      Option.some(ScenarioMessage.AccessTooBroad()),
    )
  })

  test('a pasted password stays a problem until it is deleted and changed', () => {
    const pasted = fold([
      assistant,
      pastePassword(),
      narrow,
      saveToken('t1'),
      giveReference('t1'),
    ])
    expect(pasted.mistakes).toEqual([Mistake.PastedPassword()])
    expect(checkGoal(pasted, ScenarioGoal.ChatClean()).maybeFailure).toEqual(
      Option.some(ScenarioMessage.SecretInChat()),
    )
    const deleted = fold([deleteChatLine(0)], pasted)
    expect(checkGoal(deleted, ScenarioGoal.ChatClean()).maybeFailure).toEqual(
      Option.some(ScenarioMessage.PasswordNotChanged()),
    )
    expect(
      met(fold([changeAdminPassword()], deleted), ScenarioGoal.ChatClean()),
    ).toBe(true)
  })

  test('a token pasted as text gives access but is a slip', () => {
    const doc = fold([assistant, narrow, pasteToken('t1')])
    expect(doc.mistakes).toEqual([Mistake.PastedToken()])
    expect(met(doc, ScenarioGoal.ScopedAccess())).toBe(true)
    expect(met(doc, ScenarioGoal.ChatClean())).toBe(false)
  })
})

const reportInbox = setUpInbox({
  owner: 'oleg',
  account: 'oleg@romashka.example',
  domain: 'romashka.example',
  actions: 'report',
  sessions: [session('laptop', true), session('stranger', false)],
  mails: [
    mail({
      id: 'bait',
      address: 'it@rornashka.example',
      time: '09:12',
      isPhish: true,
    }),
    mail({
      id: 'own',
      address: 'ira@romashka.example',
      time: '08:40',
      isPhish: false,
    }),
  ],
})

describe('inbox after a click', () => {
  test('forwarding the bait and signing out everywhere meet the goals', () => {
    const start = fold([reportInbox])
    expect(
      checkGoal(start, ScenarioGoal.MailForwarded({ mail: 'bait' }))
        .maybeFailure,
    ).toEqual(Option.some(ScenarioMessage.MailNotForwarded({ mail: 'bait' })))
    expect(checkGoal(start, ScenarioGoal.SignedOut()).maybeFailure).toEqual(
      Option.some(ScenarioMessage.NotSignedOut()),
    )
    const done = fold([forwardMail('bait'), signOutEverywhere()], start)
    expect(met(done, ScenarioGoal.MailForwarded({ mail: 'bait' }))).toBe(true)
    expect(met(done, ScenarioGoal.SignedOut())).toBe(true)
    expect(
      Option.map(done.maybeInbox, inbox =>
        Array.map(openSessions(inbox), found => found.id),
      ),
    ).toEqual(Option.some(['laptop']))
  })

  test('deleting the bait is a slip, deleting a genuine email is not; the bait can still be forwarded', () => {
    const doc = fold([
      reportInbox,
      deleteMail('own'),
      deleteMail('bait'),
      deleteMail('bait'),
      forwardMail('bait'),
    ])
    expect(doc.mistakes).toEqual([Mistake.DeletedBait({ mail: 'bait' })])
    expect(met(doc, ScenarioGoal.MailForwarded({ mail: 'bait' }))).toBe(true)
  })

  test('sessions are targets on the board', () => {
    expect(resolveTarget(fold([reportInbox]), 'session:stranger')).toEqual(
      Option.some('session:stranger'),
    )
  })
})

describe('scene', () => {
  test('spots of the frame are targets; a new frame replaces them', () => {
    const office = fold([frame('office', '/office.webp', ['printer', 'oleg'])])
    expect(resolveTarget(office, 'printer')).toEqual(Option.some('printer'))
    const cafe = fold([frame('cafe', '/cafe.webp', ['marina'])], office)
    expect(resolveTarget(cafe, 'printer')).toEqual(Option.none())
  })
})
