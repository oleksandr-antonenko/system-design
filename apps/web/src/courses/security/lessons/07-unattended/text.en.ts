import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Screen lock. The unattended office',
  summary:
    'An open laptop and a found USB stick are open doors. When you leave, lock the screen, put away passwords and printouts, and hand found sticks to IT.',
  preview: {
    alt: 'Illustration: an empty chair at a desk, the laptop on screen lock with a green lock icon, and a stranger’s USB stick lying untouched at the edge.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Oleg' },
    striped: { name: 'Stripes' },
    'desk-app': { name: "Marina's desk" },
    'group:desk': {
      name: 'Before lunch',
      note: 'In a minute Marina goes to lunch. Decide what to do with each thing on the desk.',
    },
    'item:laptop': {
      name: 'Laptop',
      note: 'The screen is open: mail, CRM and chat in plain view.',
    },
    'item:sticker': {
      name: 'Sticky note on the monitor',
      note: 'The CRM password, handwritten.',
    },
    'item:printout': {
      name: 'Printout in the printer',
      note: "The department's payroll. It has been in the tray since morning.",
    },
    'item:usb': {
      name: 'USB stick with a heart',
      note: 'Found this morning in the car park. Nobody knows whose.',
    },
    'action:lock': { name: 'Lock the screen' },
    'action:leave': { name: "Leave it — I won't be long" },
    'action:vault': { name: 'Password to the vault, note to the shredder' },
    'action:flip': { name: 'Turn it face down' },
    'action:take': { name: 'Take it and put it in a drawer' },
    'action:later': { name: "Leave it, I'll get it later" },
    'action:to-it': { name: 'Give it to Ira in IT' },
    'action:plug': { name: 'Plug it in to see whose it is' },
    'res:laptop:lock': {
      name: 'The screen went dark and asks for the password. Everything open stays in place and waits for you.',
    },
    'res:laptop:leave': {
      name: 'Stop: while you are away, anyone passing reads your mail and writes emails in your name. Press “Lock the screen”.',
    },
    'res:sticker:vault': {
      name: 'The password now lives in the password manager, not on the monitor.',
    },
    'res:sticker:flip': {
      name: 'A note turned face down is turned back in a second. The password belongs in the vault.',
    },
    'res:printout:take': {
      name: "The payroll is in the drawer. Nobody reads other people's salaries at the printer any more.",
    },
    'res:printout:later': {
      name: "Everyone who walks by sees the printer tray. Other people's data does not wait for “later”.",
    },
    'res:usb:to-it': {
      name: 'Ira will check the stick on a separate computer that is not connected to the work network.',
    },
    'res:usb:plug': {
      name: 'Stop: the stick can start a program by itself or pretend to be a keyboard and type commands. In real life, right now: pull it out and tell Ira at once.',
    },
  },
  steps: {
    'open-door': {
      title: 'An open laptop is an open door',
      body: `Oleg went for a coffee and left his [[laptop|laptop]] open. A minute later a “colleague” is already sitting at it.

Whoever sits at an open laptop is you as far as every system is concerned. They read your mail and write emails in your name, open the CRM and the chats. They need no password: you are already signed in.

A minute is enough. And in a shared office dozens of people pass a desk every day: couriers, guests, cleaners.`,
    },
    'two-minutes': {
      title: 'Question: two minutes',
      body: 'Marina steps away to the printer for two minutes. What should she do with her laptop?',
    },
    lock: {
      title: 'Locking the screen',
      body: `**Screen lock** means the screen goes dark and asks for your password. Everything that was open stays in place: you come back, type the password and carry on where you left off.

One key press before you stand up:

- **Windows:** Win + L.
- **Mac:** Control + Command + Q.

A safety net is the automatic lock after a couple of idle minutes. But do not rely on it alone: those minutes are exactly the “colleague's” time.`,
      more: {
        title: 'More: not only the screen',
        body: `**A clear desk.** A password on a sticky note and a printout in the printer tray can be read at a glance. Keep passwords in a password manager and collect printouts with other people's data right away.

**Your phone.** A phone needs a screen lock with a code or fingerprint too. An unlocked phone left on the desk is the same open door: it holds mail, messengers and 2FA codes.

**Your badge.** Do not leave your badge on the desk or lend it “for a minute”.`,
      },
    },
    usb: {
      title: 'A bait USB stick',
      body: `Oleg found a [[usb|USB stick]] with a heart in the car park. His first thought is to plug it in and see whose it is.

That is exactly what the scammer is waiting for. A planted stick can start a program by itself as soon as it is plugged in, or pretend to be a keyboard and type commands in a second. It may hold a file with a tempting name — “Salaries 2025”.

The rule is simple: **found USB sticks are never plugged in**, not even to find the owner. They go to IT.`,
    },
    lunch: {
      title: 'Task: off to lunch',
      body: `Marina is about to go to lunch. On her desk: an open laptop, a sticky note with a password on the monitor, a printout in the printer and a USB stick found in the car park this morning.

Decide what to do with each thing. A tip from real life: the laptop is locked last, just before you stand up.`,
    },
    summary: {
      title: 'Summary',
      body: `Marina's desk can now be left for an hour.

- Whenever you leave, even for a minute, **lock the screen**: Win + L on Windows, Control + Command + Q on a Mac.
- Passwords go in the password manager, not on sticky notes; printouts with other people's data are collected at once.
- **Found USB sticks are never plugged in**; they go to IT.`,
    },
  },
  annotations: {
    'coffee.alt': () =>
      "Oleg walks off to the coffee machine with his mug. Stripes, in a grey cardigan with stripes showing underneath, is already sitting at Oleg's open laptop and typing.",
    'coffee.narration': () => 'Oleg only stepped away for a minute.',
    'coffee.striped': () =>
      "The mail is open… Let's write to accounting in Oleg's name!",
    'desk.alt': () =>
      'An empty desk: an open laptop with a sticky note on the monitor, a printer with a sheet in its tray, a USB stick by the keyboard, a mug and a plant.',
    'desk.narration': () => "Marina's desk before lunch.",
    'lock.alt': () =>
      'Marina, bag on her shoulder, presses two keys on her laptop. The dark screen shows a big padlock symbol.',
    'lock.narration': () => 'Two keys, and the door is shut.',
    'lock.marina': () =>
      'Win + L, and off I go. Everything open will wait for me.',
    'usb.alt': () =>
      'Oleg picks up a USB stick with a heart sticker in the car park. Stripes peeks out from behind a car with a fishing rod whose line runs to the stick.',
    'usb.narration': () => 'Morning, the office car park.',
    'usb.oleg': () => "Ooh, a USB stick! I'll plug it in and see whose it is.",
    'summary.coffee': () => 'An open laptop is an open door',
    'summary.desk': () => 'Check your desk before you leave',
    'summary.lock': () => 'Win + L or Control + Command + Q',
    'summary.usb': () => 'A found stick goes to IT',
  },
  quizzes: {
    'two-minutes': {
      question:
        'Marina steps away to the printer for two minutes. What should she do with her laptop?',
      options: {
        turn: 'Turn the laptop so the screen faces the wall.',
        ask: 'Ask a colleague to keep an eye on it.',
        lock: 'Lock the screen: it goes dark and asks for the password.',
      },
      wrong: {
        turn: 'A screen turned to the wall is turned back in a second, and the laptop stays open to anyone who walks up.',
        ask: 'The colleague may get distracted or step away too, and the “colleague” in stripes needs only a minute. The laptop is still open.',
      },
      explain:
        'Even two minutes are enough to send an email in your name. A locked screen asks for the password, and everything open stays in place. It takes one key press — more about it in the next step.',
    },
  },
  tasks: {
    lunch: {
      prompt:
        'Before lunch, sort out the desk: the password, the printout, the found USB stick and the laptop.',
      goals: {
        clean: 'No password note and no printout left on the desk',
        usb: 'The found USB stick is with IT, not in the computer',
        locked: 'The laptop screen is locked',
      },
      hints: [
        'Each thing has two buttons. Choose the one that leaves nothing to read and nothing to plug in at the desk.',
        'A note turned face down and “later” do not help. A found stick is not plugged in even to find the owner. The laptop is locked last.',
        'Sticky note — “Password to the vault, note to the shredder”, printout — “Take it and put it in a drawer”, USB stick — “Give it to Ira in IT”, laptop — “Lock the screen”. The right button is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: the password is in the vault, the payroll in the drawer, the stick with Ira, and the screen asks for a password. Off to lunch with peace of mind.',
    },
  },
} satisfies LessonTexts<typeof lesson>
