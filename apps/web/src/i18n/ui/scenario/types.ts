/** Тексты вида доски «сценарий» (курс безопасности): хром экранов телефона,
    почты и страницы-двойника, коды сообщений и ошибки ученика. Содержимое
    урока (реплики, письма, имена) — в текстах урока, здесь только интерфейс. */
export type ScenarioStrings = Readonly<{
  // CARDS
  taskHeading: string
  taskHowTo: string
  pickHowTo: string
  solveFirst: string

  // FRAME
  frameLabel: string
  galleryLabel: string
  openSign: string
  closeSign: string
  signHead: string

  // OUTCOME
  mistakesLabel: string
  noMistakes: string
  gaveAwayPassword: (ssid: string) => string
  openedMailWithoutVpn: string
  followedBait: string
  passwordInChat: string
  allowedStranger: string
  complied: string
  calledTheirNumber: string
  pastedPassword: string
  pastedToken: string
  deletedBait: string

  // MESSAGES
  noPhone: string
  noInbox: string
  networkUnknown: (ssid: string) => string
  networkLocked: (ssid: string) => string
  notJoined: string
  offline: string
  vpnOff: string
  mailUnknown: string
  notOnNetwork: (ssid: string) => string
  mailNotSent: string
  phishLeft: (count: number) => string
  realMisflagged: (count: number) => string
  noVault: string
  entryUnknown: string
  entryOnSticker: (name: string) => string
  stickersLeft: (count: number) => string
  passwordReused: (count: number) => string
  notShared: (name: string) => string
  notRegenerated: (name: string) => string
  noAuth: string
  notScanned: string
  wrongCode: string
  twoFactorOff: string
  codesNotSaved: string
  noSignIn: string
  signInPending: string
  notReported: string
  noChat: string
  threadUnknown: string
  replyUnknown: string
  contactUnknown: string
  notReplied: (name: string) => string
  notCalled: (name: string) => string
  notForwarded: (name: string) => string
  noAssistant: string
  noSections: string
  tokenUnknown: string
  tokenRevoked: string
  tokenNotSaved: string
  lineUnknown: string
  noAccessGiven: string
  accessTooBroad: string
  accessActive: string
  secretInChat: string
  passwordNotChanged: string
  mailNotForwarded: (name: string) => string
  notSignedOut: string
  weakPhrase: string
  noKeepass: string
  noBase: string
  phraseMissing: string
  phraseUnknown: string
  phraseWeak: string
  placeUnknown: string
  entriesLeft: (count: number) => string
  noBackup: string
  backupSameDevice: string
  backupStale: string
  /** Опасное действие при разборе предметов: `plug`, `run`, `grant`,
      `unlocked`. */
  risky: (risk: string) => string
  noTray: string
  itemUnknown: string
  actionUnknown: string
  itemsLeft: (count: number) => string

  // PHONE
  phone: Readonly<{
    title: string
    settings: string
    apps: string
    mailApp: string
    vpnRow: (profile: string) => string
    vpnOn: string
    vpnOffStatus: string
    vpnNeedsInternet: string
    vpnBadge: string
    homeNoteVpn: string
    homeNote: string
    sentNote: string
    wifiNote: string
    accept: string
    portalConsentNote: string
    portalEmail: string
    portalPassword: string
    leave: string
    signIn: string
    understood: string
    lockedTitle: (ssid: string) => string
    lockedHint: string
    leakedTitle: string
    leakedBody: string
    leakedNext: string
    needsNetworkTitle: string
    needsNetworkBody: string
    needsVpnTitle: string
    needsVpnBody: string
    openWithoutVpn: string
    turnOnVpn: string
    mailTitle: string
    mailWithoutVpn: string
    mailThroughVpn: string
    mailSent: string
    to: (address: string) => string
    send: string
    sentButton: string
  }>

  // MAIL
  mail: Readonly<{
    tab: (owner: string) => string
    label: string
    inbox: string
    sorted: (done: number, total: number) => string
    choose: string
    chooseHint: string
    to: (address: string) => string
    showAddress: (name: string) => string
    markPhish: string
    markReal: string
    flaggedPhish: string
    keptReal: string
    misflagged: string
    rightPhish: string
    rightReal: string
    wasPhish: string
    wasReal: string
    misflaggedReal: string
    linkTo: string
    backToMail: string
    pageLogin: (host: string) => string
    pagePayment: (host: string) => string
    pageFile: string
    pageOwn: (host: string, domain: string) => string
    loginTitle: string
    paymentTitle: string
    forward: string
    delete: string
    forwardedMark: string
    forwardedNote: string
    deletedBaitNote: string
    inTrash: string
    trash: string
    lastActivity: (where: string) => string
    details: string
    sessionsTitle: string
    thisDevice: string
    ownDevice: string
    strangeDevice: string
    signOut: string
    signedOut: string
  }>

  // VAULT
  vault: Readonly<{
    tab: (owner: string) => string
    label: string
    stickers: string
    stickersNote: string
    stickerLogin: (login: string) => string
    stickerPassword: (password: string) => string
    saveSticker: string
    sharedBadge: string
    access: (names: string) => string
    empty: string
    choose: string
    site: string
    login: string
    password: string
    reusedBadge: string
    reusedWith: (names: string) => string
    generatedNote: string
    ownNote: string
    generate: string
    generatedButton: string
    share: string
    inShared: (vault: string) => string
    shareTitle: (name: string) => string
    moveToShared: (vault: string) => string
    moveNote: (names: string) => string
    sendInChat: (person: string) => string
    sendNote: string
    cancel: string
    sentTitle: string
    sentBody: string
    sentNext: string
  }>

  // KEEPASS
  keepass: Readonly<{
    tab: (owner: string) => string
    label: string
    noBase: string
    noBaseNote: (place: string) => string
    create: string
    phraseTitle: (file: string) => string
    phraseNote: string
    weakTitle: string
    where: (place: string) => string
    noCloud: string
    copiesTitle: string
    noCopies: string
    copyCount: (inCopy: number, inBase: number) => string
    fresh: string
    stale: string
    sameDevice: string
    saveCopy: string
    copyTitle: (file: string) => string
    entriesTitle: (count: number) => string
    emptyBase: string
    waiting: string
    add: string
  }>

  // TRAY
  tray: Readonly<{
    tab: (look: 'desk' | 'downloads' | 'extensions', owner: string) => string
    showExtensions: string
    extensionsShown: string
    extensionsHidden: string
    fileType: (ext: string) => string
  }>

  // AUTH
  auth: Readonly<{
    tab: (owner: string) => string
    label: string
    security: string
    twoFactorTitle: string
    offNote: string
    enable: string
    scanStep: string
    codeStep: string
    codeLabel: string
    confirm: string
    wrongCode: string
    notScannedYet: string
    onNote: string
    backupTitle: string
    backupNote: string
    saveCodes: string
    codesSaved: string
    qrLabel: string
    app: string
    noAccounts: string
    scan: string
    needsQr: string
    codeNote: string
    requestTitle: string
    deny: string
    approve: string
    allowedTitle: string
    allowedBody: string
    allowedNext: string
    notMe: string
    declinedTitle: string
    declinedBody: (site: string) => string
    report: string
    reported: string
  }>

  // CHAT
  chat: Readonly<{
    tab: (owner: string) => string
    label: string
    chats: string
    directory: string
    directoryNote: string
    unknownBadge: string
    choose: string
    call: string
    callNumber: (number: string) => string
    forward: string
    forwardTo: (name: string) => string
    forwarded: (name: string) => string
    youForwarded: (name: string) => string
    itThanks: string
    replyHint: string
    callTitle: (name: string) => string
    noAnswer: string
    hangUp: string
    theirNumberTitle: string
    theirNumberBody: string
    theirNumberNext: string
    compliedTitle: string
    compliedBody: string
    compliedNext: string
  }>

  // ASSISTANT
  assistant: Readonly<{
    tab: (owner: string) => string
    label: string
    deleted: string
    delete: string
    deleteLabel: string
    passwordWarning: string
    tokenWarning: string
    pastePassword: string
    pasteToken: string
    giveReference: string
    composer: string
    needsToken: string
    needsSaved: string
  }>

  // CRM
  crm: Readonly<{
    tab: (owner: string) => string
    label: string
    settings: string
    adminTitle: string
    adminOld: string
    adminChanged: string
    changePassword: string
    tokensTitle: string
    tokensNote: string
    access: string
    accessRead: string
    accessWrite: string
    accessAdmin: string
    sections: string
    term: string
    days: (days: number) => string
    create: string
    noSections: string
    tokenTitle: (number: number) => string
    active: string
    revoked: string
    save: string
    saved: (reference: string) => string
    revoke: string
    tooBroad: string
  }>

  // TRAP
  trap: Readonly<{
    label: string
    prize: string
    visitor: string
    burnsIn: string
    signIn: string
    useAccount: (brand: string) => string
    email: string
    password: string
    emailMissing: string
    passwordMissing: string
    skip: string
    login: string
    fine: string
  }>

  // LETTER
  letter: Readonly<{
    label: string
    to: (address: string) => string
  }>
}>
