import type { ScenarioStrings } from './types'

export const scenarioEn: ScenarioStrings = {
  taskHeading: 'Task on the screen',
  taskHowTo:
    'Act on the screen as you would in real life. Goals tick themselves; press “Check” at the end.',
  pickHowTo:
    'Press the right place on the screen. Keyboard: Tab to it, then Enter.',

  solveFirst: 'Solve the task on the screen to continue',

  frameLabel: 'Lesson frame',
  galleryLabel: 'Lesson frames',
  openSign: 'Open the sign',
  closeSign: 'Close the sign',
  signHead: 'Sign',

  mistakesLabel: 'Slips along the way',
  noMistakes: 'none',
  gaveAwayPassword: ssid =>
    `the mail password was typed on the page of the “${ssid}” network: in real life you change it at once and tell IT`,
  openedMailWithoutVpn:
    'work mail was opened on a stranger’s network without VPN',
  followedBait:
    'a link or attachment in a bait was pressed: in real life you tell IT straight away',
  passwordInChat:
    'a password was sent in a chat: in real life the message is deleted and the password changed',
  allowedStranger:
    'a stranger’s sign-in was approved with “Yes”: in real life you tell IT at once and change the password',
  complied:
    'an urgent request was accepted without a check: in real life, if the money is gone, you call the bank and IT at once',
  calledTheirNumber:
    'a check by calling the number from the message: the same person answers there',
  pastedPassword:
    'the admin password was pasted into the assistant chat: it is deleted from the chat and changed',
  pastedToken:
    'the token was sent into the chat as text: the message is deleted and the token revoked after the work',
  deletedBait:
    'the bait was deleted instead of forwarded to IT: IT uses it to find the same email at colleagues',

  noPhone: 'There is no phone at this step.',
  noInbox: 'There is no mailbox at this step.',
  networkUnknown: ssid => `There is no “${ssid}” network nearby.`,
  networkLocked: ssid => `“${ssid}” needs a password, and you don’t have it.`,
  notJoined: 'The phone is not on this network.',
  offline:
    'No internet: first join the Wi-Fi and get through the network’s sign-in page.',
  vpnOff: 'VPN is off.',
  mailUnknown: 'There is no such email.',
  notOnNetwork: ssid =>
    `The phone is not on “${ssid}” or hasn’t passed its sign-in page.`,
  mailNotSent: 'The email hasn’t been sent yet.',
  phishLeft: count => `Baits not marked “Phishing”: ${count}.`,
  realMisflagged: count => `Real emails not marked “Genuine”: ${count}.`,
  noVault: 'There is no password manager at this step.',
  entryUnknown: 'There is no such item.',
  entryOnSticker: name =>
    `“${name}” is still on a sticky note: move it into the vault first.`,
  stickersLeft: count =>
    `Sticky notes with passwords on the monitor: ${count}.`,
  passwordReused: count => `Items sharing a password: ${count}.`,
  notShared: name => `“${name}” is not in the shared vault yet.`,
  notRegenerated: name => `“${name}” still has its old password.`,
  noAuth: 'There is no security page at this step.',
  notScanned: 'Scan the QR code with the app first.',
  wrongCode: 'The code does not match the one in the app.',
  twoFactorOff: '2FA is not on yet.',
  codesNotSaved: 'The backup codes are not saved yet.',
  noSignIn: 'There is no sign-in request now.',
  signInPending: 'The stranger’s sign-in request is not declined yet.',
  notReported: 'The sign-in is declined, but IT does not know yet.',
  noChat: 'There is no messenger at this step.',
  threadUnknown: 'There is no such chat.',
  replyUnknown: 'There is no such reply.',
  contactUnknown: 'There is no such contact in the directory.',
  notReplied: name => `The chat “${name}” has no fitting reply yet.`,
  notCalled: name => `No call from the directory yet: ${name}.`,
  notForwarded: name => `The chat “${name}” is not forwarded to IT yet.`,
  noAssistant: 'There is no assistant at this step.',
  noSections: 'The token has no section.',
  tokenUnknown: 'There is no such token.',
  tokenRevoked: 'This token is already revoked.',
  tokenNotSaved: 'The token is not saved in the password manager yet.',
  lineUnknown: 'There is no such message.',
  noAccessGiven: 'The assistant has no token yet.',
  accessTooBroad:
    'The assistant’s token gives more than needed: read only, one section, a week at most.',
  accessActive: 'The assistant’s token is still valid.',
  secretInChat: 'A password or a token is still in the chat.',
  passwordNotChanged:
    'The admin password was in the chat but has not been changed yet.',
  mailNotForwarded: name =>
    `The email from “${name}” is not forwarded to IT yet.`,
  notSignedOut: 'Other sessions of the mailbox are still open.',
  weakPhrase: 'a master phrase that is easy to guess was chosen',
  noKeepass: 'KeePass is not on the screen.',
  noBase: 'There is no password database yet: create one.',
  phraseMissing: 'The database has no master phrase yet.',
  phraseUnknown: 'That phrase is not in the list.',
  phraseWeak: 'The master phrase is too simple: it will be guessed.',
  placeUnknown: 'A copy cannot go there.',
  entriesLeft: count => `Entries not yet in the database: ${count}.`,
  noBackup: 'There is no backup of the database.',
  backupSameDevice:
    'The copy is on the same laptop: if the laptop breaks, both are gone.',
  backupStale:
    'The copy is older than the database and misses entries. Save the copy again.',
  risky: risk =>
    risk === 'plug'
      ? 'a found USB stick was plugged into the computer'
      : risk === 'run'
        ? 'a file that runs a program was opened'
        : risk === 'grant'
          ? 'an extension was given access to every site'
          : 'the computer was left unlocked',
  noTray: 'There is nothing to sort on the screen.',
  itemUnknown: 'There is no such item.',
  actionUnknown: 'That cannot be done with this item.',
  itemsLeft: count => `Sorted wrongly or not yet: ${count}.`,

  phone: {
    title: 'Phone',
    settings: 'Settings',
    apps: 'Apps',
    mailApp: 'Mail',
    vpnRow: profile => `VPN · ${profile}`,
    vpnOn: 'Connected to the office',
    vpnOffStatus: 'Off',
    vpnNeedsInternet: 'Needs internet',
    vpnBadge: 'VPN',
    homeNoteVpn:
      'VPN is on: everything the phone sends goes through a closed pipe to the office.',
    homeNote: 'On a stranger’s network: network, then VPN, then work.',
    sentNote: 'The email went out through VPN.',
    wifiNote:
      'A padlock means a password. Bars show signal strength, not honesty.',
    accept: 'Accept',
    portalConsentNote:
      'This page only asks you to accept the rules. No email, no passwords.',
    portalEmail: 'Email',
    portalPassword: 'Email password',
    leave: 'Close and disconnect',
    signIn: 'Sign in',
    understood: 'Got it',
    lockedTitle: ssid => `“${ssid}” needs a password`,
    lockedHint:
      'You don’t have the password for this network. Look for the one on the sign.',
    leakedTitle: 'Stop: your password went to the neighbour',
    leakedBody:
      'Real Wi-Fi never needs your email password. This page came from a lookalike network: one with a similar name that someone nearby switched on.',
    leakedNext:
      'In real life: change your email password now and tell IT. Here the phone has left the lookalike — pick the network from the sign.',
    needsNetworkTitle: 'No internet connection',
    needsNetworkBody:
      'First join the Wi-Fi and get through the network’s sign-in page.',
    needsVpnTitle: 'VPN is off',
    needsVpnBody:
      'You are on a stranger’s network. Work mail is opened only through VPN: then only you and the office can see it.',
    openWithoutVpn: 'Open without VPN',
    turnOnVpn: 'Turn on VPN',
    mailTitle: 'Mail',
    mailWithoutVpn:
      'Mail is open without VPN. Go back, turn on VPN and open it again.',
    mailThroughVpn: 'VPN · secure connection to the office',
    mailSent: '✓ Sent through VPN',
    to: address => `To: ${address}`,
    send: 'Send',
    sentButton: 'Sent',
  },

  mail: {
    tab: owner => `Mail · ${owner}`,
    label: 'Mail',
    inbox: 'Inbox',
    sorted: (done, total) => `${done} of ${total} sorted`,
    choose: 'Pick an email from the list.',
    chooseHint: 'Press the sender’s name to see the address.',
    to: address => `To: ${address}`,
    showAddress: name => `${name}: show the sender’s address`,
    markPhish: '⚑ Phishing',
    markReal: '✓ Genuine',
    flaggedPhish: '⚑ phishing',
    keptReal: '✓ genuine',
    misflagged: 'marked wrong',
    rightPhish: 'Right: a bait.',
    rightReal: 'Right: a genuine email.',
    wasPhish: 'This is a bait.',
    wasReal: 'This is a genuine email.',
    misflaggedReal:
      'Flagging a genuine email as phishing is a mistake too: a colleague is waiting for your reply.',
    linkTo: 'The link goes to:',
    backToMail: 'Back to the email',
    pageLogin: host =>
      `This is that cardboard door. The page looks like a mail sign-in, but the address is ${host}. Whatever you type here goes to the fraudster.`,
    pagePayment: host =>
      `A payment form on someone else’s domain, ${host}. Card details from such a page go to the fraudster, and the charge is nothing like the amount in the email.`,
    pageFile:
      'An attachment from a forged email. Inside are the fraudster’s “new bank details”, and sometimes a program pretending to be a document. Such attachments stay closed: forward the email to IT.',
    pageOwn: (host, domain) => `This is your site: ${host} ends in ${domain}.`,
    loginTitle: 'Mail sign-in',
    paymentTitle: 'Payment',
    forward: '↪ Forward to IT',
    delete: '🗑 Delete',
    forwardedMark: '↪ to IT',
    forwardedNote:
      '↪ Forwarded to IT. They will find the same email at colleagues and block the sender.',
    deletedBaitNote:
      'The bait is in the trash. IT needs it: it shows who else got the same email. Open it in “Trash” and forward it to IT.',
    inTrash: 'The email is in the trash.',
    trash: 'Trash',
    lastActivity: where => `Last sign-in to the mailbox: ${where}`,
    details: 'Details',
    sessionsTitle: 'Where your mailbox is open now',
    thisDevice: 'this device',
    ownDevice: 'yours',
    strangeDevice: 'don’t recognise it?',
    signOut: 'Sign out on all other devices',
    signedOut:
      '✓ All other sessions are ended. The old password no longer gets anyone in.',
  },

  vault: {
    tab: owner => `Vault · ${owner}`,
    label: 'Password manager',
    stickers: 'Sticky notes on the monitor.',
    stickersNote:
      'Anyone who walks up to the desk can read them. Move the passwords into the vault and the notes into the shredder.',
    stickerLogin: login => `login: ${login}`,
    stickerPassword: password => `password: ${password}`,
    saveSticker: 'Move into the vault',
    sharedBadge: 'shared',
    access: names => `Access: ${names}`,
    empty: 'Nothing here yet.',
    choose: 'Choose an item in the list.',
    site: 'Website',
    login: 'Login',
    password: 'Password',
    reusedBadge: 'reused',
    reusedWith: names =>
      `Same password as ${names}. If it leaks from one site, it opens the other one too.`,
    generatedNote:
      'A new password generated by the vault: 20 random characters. You don’t need to remember it; the vault fills it in for you.',
    ownNote:
      'A password made up by hand. The vault can replace it with a long random one.',
    generate: 'Replace with a generated one',
    generatedButton: '✓ Password generated',
    share: 'Share…',
    inShared: vault => `In the shared vault “${vault}”`,
    shareTitle: name => `Share “${name}”`,
    moveToShared: vault => `Move to the shared vault “${vault}”`,
    moveNote: names =>
      `Access for: ${names}. Change the password and it changes for everyone; when someone leaves, access is closed with one click.`,
    sendInChat: person => `Copy the password into a chat · ${person}`,
    sendNote: 'The password stays in the chat history.',
    cancel: 'Cancel',
    sentTitle: 'Stop: the password went into a chat',
    sentBody:
      'It now sits in the chat history, on the other person’s phone and in backups, and it won’t disappear from there on its own. Change the password and you’ll have to send it again.',
    sentNext:
      'In real life, now: delete the message and change the password. Here you can go on: share the item through the shared vault.',
  },

  keepass: {
    tab: owner => `KeePass · ${owner}`,
    label: 'KeePass vault file',
    noBase: 'No password database yet',
    noBaseNote: place =>
      `A new database is one encrypted file. It will live here: ${place}. There is no cloud.`,
    create: 'Create a new database',
    phraseTitle: file => `Master phrase for “${file}”`,
    phraseNote:
      'Without it nobody can open the file: not IT, not the KeePass developers. It cannot be recovered. Choose a phrase:',
    weakTitle: 'It will be guessed.',
    where: place => `The database file lives here: ${place}`,
    noCloud:
      'There is no cloud: if this device breaks or gets lost, the database goes with it.',
    copiesTitle: 'Backups',
    noCopies: 'No copies yet.',
    copyCount: (inCopy, inBase) => `entries: ${inCopy} of ${inBase}`,
    fresh: 'up to date',
    stale: 'out of date',
    sameDevice: 'on the same laptop',
    saveCopy: 'Save a copy…',
    copyTitle: file => `Where to save a copy of “${file}”`,
    entriesTitle: count => `Entries in the database: ${count}`,
    emptyBase: 'The database is empty so far.',
    waiting:
      'Passwords on a slip of paper under the keyboard — move them into the database:',
    add: 'Add to database',
  },

  tray: {
    tab: (look, owner) =>
      look === 'desk'
        ? `Desk · ${owner}`
        : look === 'downloads'
          ? `Downloads · ${owner}`
          : `Extensions · ${owner}`,
    showExtensions: 'Show file extensions',
    extensionsShown:
      'The full name is visible: the file type is the letters after the last dot.',
    extensionsHidden: 'The system is hiding the last part of each name now.',
    fileType: ext =>
      ({
        pdf: 'PDF document',
        exe: 'Application',
        msi: 'Program installer',
        zip: 'ZIP archive',
        docx: 'Word document',
        docm: 'Word document with macros',
        xlsx: 'Excel spreadsheet',
        jpg: 'JPEG image',
        png: 'PNG image',
      })[ext] ?? `${ext.toUpperCase()} file`,
  },

  auth: {
    tab: owner => `2FA · ${owner}`,
    label: 'Security page and phone',
    security: 'Security',
    twoFactorTitle: 'Two-factor authentication (2FA)',
    offNote:
      'Off. Turn it on, and besides the password, signing in will need a code from an app on your phone.',
    enable: 'Turn on 2FA',
    scanStep:
      '1. Open the authenticator app on your phone and scan the QR code.',
    codeStep: '2. Enter the 6 digits the app shows.',
    codeLabel: 'Code from the app',
    confirm: 'Confirm',
    wrongCode: 'That code doesn’t fit. Look at the six digits in the app.',
    notScannedYet:
      'Scan the QR code with the phone first: the code will appear in the app.',
    onNote:
      '✓ 2FA is on. Signing in from a new device, the site will ask for a code.',
    backupTitle: 'Backup codes',
    backupNote:
      'If the phone gets lost, you can sign in with one of these codes; each works once. Keep them not on the phone but in the password manager.',
    saveCodes: 'Save to the password manager',
    codesSaved: '✓ Backup codes saved in the password manager.',
    qrLabel: 'QR code for the authenticator app',
    app: 'Authenticator',
    noAccounts: 'No accounts yet.',
    scan: 'Scan QR code',
    needsQr:
      'Nothing for the camera to scan: open the QR code on the site first with “Turn on 2FA”.',
    codeNote: 'The code changes every 30 seconds.',
    requestTitle: 'Is this you signing in?',
    deny: 'No, it’s not me',
    approve: 'Yes, it’s me',
    allowedTitle: 'Stop: you let a stranger in',
    allowedBody:
      'You weren’t signing in anywhere, so someone with your password was, and you opened the second lock for them. That is what the scammer counts on: sending requests until someone presses “Yes”.',
    allowedNext: 'End this sign-in right now.',
    notMe: 'It wasn’t me — end the sign-in',
    declinedTitle: 'Sign-in declined',
    declinedBody: site =>
      `Someone else knows your password for ${site}. Tell IT: the password needs changing.`,
    report: 'Tell IT',
    reported: '✓ IT knows: they will change the password with you.',
  },

  chat: {
    tab: owner => `Messenger · ${owner}`,
    label: 'Messenger',
    chats: 'Chats',
    directory: 'Directory',
    directoryNote:
      'Numbers from the company directory. You can trust them: nobody sent them to you in a message.',
    unknownBadge: 'not in contacts',
    choose: 'Choose a chat.',
    call: 'Call',
    callNumber: number => `Call ${number}`,
    forward: 'Forward to IT',
    forwardTo: name => `Forward the chat: ${name}`,
    forwarded: name => `↪ Forwarded: ${name}`,
    youForwarded: name => `↪ You forwarded the chat “${name}”`,
    itThanks: 'Thanks, I’ll have a look!',
    replyHint: 'Reply:',
    callTitle: name => `Call · ${name}`,
    noAnswer: 'Ringing… Nobody answers.',
    hangUp: 'End call',
    theirNumberTitle: 'Stop: this is not a check.',
    theirNumberBody:
      'The number from the message is answered by whoever sent it, and voices are easy to fake these days.',
    theirNumberNext:
      'You check with a number you know yourself: open the “Directory”.',
    compliedTitle: 'Stop: the request was not checked.',
    compliedBody:
      'Urgent, “the boss”, “don’t call” — all three levers at once. First a check through another channel, then money.',
    compliedNext:
      'In real life, if the money is already gone, call the bank and IT at once: a payment can sometimes still be stopped. Here you can go on.',
  },

  assistant: {
    tab: owner => `Assistant · ${owner}`,
    label: 'Chat with the AI assistant',
    deleted: 'Message deleted',
    delete: 'Delete',
    deleteLabel: 'Delete the message',
    passwordWarning:
      'The admin password is now in the chat history. Delete the message and change the password in the CRM.',
    tokenWarning:
      'The token stays in the chat history as text. Delete the message and revoke the token after the work.',
    pastePassword: 'Paste the admin password',
    pasteToken: 'Paste the token as text',
    giveReference: 'Give a link to the password manager item',
    composer: 'Message the assistant…',
    needsToken: 'There is no token yet: create one on the CRM tab.',
    needsSaved:
      'A link points to a saved token: first “Save to the password manager” in the CRM.',
  },

  crm: {
    tab: owner => `CRM · ${owner}`,
    label: 'CRM settings',
    settings: 'Settings · Access',
    adminTitle: 'Admin password',
    adminOld: 'Last changed: three months ago.',
    adminChanged: '✓ Changed just now. The old password no longer works.',
    changePassword: 'Change password',
    tokensTitle: 'Tokens for assistants and integrations',
    tokensNote:
      'A token is a separate key for a program: its own permissions, sections and term. It is revoked with one click and leaves your password alone.',
    access: 'Permissions',
    accessRead: 'Read only',
    accessWrite: 'Read and write',
    accessAdmin: 'Full access',
    sections: 'Sections',
    term: 'Term',
    days: days => (days === 0 ? 'No expiry' : `${days} days`),
    create: 'Create token',
    noSections: 'Tick at least one section.',
    tokenTitle: number => `Token #${number}`,
    active: 'active',
    revoked: 'revoked',
    save: 'Save to the password manager',
    saved: reference => `✓ In the password manager: ${reference}`,
    revoke: 'Revoke',
    tooBroad:
      'Broader than the assistant needs: reading one section for a week is enough. Revoke this token and create a narrower one.',
  },

  trap: {
    label: 'Practice page: a prize window',
    prize: 'Win an iPhone Duo',
    visitor: 'You are our 1,000,000th visitor! Sign in to claim your prize.',
    burnsIn: 'The prize expires in',
    signIn: 'Sign in',
    useAccount: brand => `Use your ${brand} Account`,
    email: 'Email or phone',
    password: 'Password',
    emailMissing: 'Enter an email or phone number',
    passwordMissing: 'Enter a password',
    skip: 'Skip',
    login: 'Sign in',
    fine: 'By pressing “Sign in” you accept the promotion rules. Prizes are limited.',
  },

  letter: {
    label: 'Email',
    to: address => `To: ${address}`,
  },
}
