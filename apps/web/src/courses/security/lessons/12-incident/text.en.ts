import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Incident. If you have already clicked',
  summary:
    'The danger is not the slip but the silence. The first 15 minutes: tell IT, change the password, sign out everywhere and keep the email for IT.',
  preview: {
    alt: 'Illustration of an incident: after a suspicious email on the screen, a person seen from behind calmly presses a big green report button.',
  },
  labels: {
    oleg: { name: 'Oleg' },
    marina: { name: 'Marina' },
    ira: { name: 'Ira' },
    striped: { name: 'Stripes' },
    'chat:ira': { name: 'Ira · IT', note: 'IT administrator' },
    'chat:ira:body': {
      name: 'Colleagues, a reminder: strange emails, calls and messages come straight to me. Better safe than sorry.',
    },
    'reply:ira:report': {
      name: 'Ira, I pressed the button in the “Your password expires” email and typed my email password there. What do I do?',
      note: 'Thanks for telling me right away! Here’s the plan: 1) change your email password in the password manager; 2) in your mail, press “Details” at the bottom and sign out on all other devices; 3) forward me that email and don’t delete it. I’ll take care of the rest.',
    },
    'chat:marina': { name: 'Marina', note: 'office manager' },
    'chat:marina:body': {
      name: 'Oleg, did you get “Your password expires” too? Don’t click it, it’s a bait!',
    },
    'vault-app': { name: '1Password' },
    'vault-personal': { name: 'Personal' },
    'vault-marketing': { name: 'Marketing' },
    'entry:mail': { name: 'Work email' },
    'entry:crm': { name: 'Company CRM' },
    'entry:social': { name: 'Company social media' },
    'mail:it': { name: 'IT Department', note: 'Your password expires today' },
    'mail:it:body': {
      name: `Hello,

Your password expires today at 6 pm. To keep access to your mailbox, please confirm your current password.

Regards, IT Department`,
    },
    'mail:it:link': { name: 'Keep my current password' },
    'mail:ira': {
      name: 'Ira · IT',
      note: 'Mail is down on Saturday from 10 to 12',
    },
    'mail:ira:body': {
      name: `Colleagues, on Saturday we are updating the mail server. Mail will be unavailable from 10:00 to 12:00.

There is nothing you need to do. Questions go to the work chat.

Ira`,
    },
    'session:laptop': {
      name: 'Oleg’s laptop · browser',
      note: 'Vilnius · now',
    },
    'session:phone': { name: 'Oleg’s phone', note: 'Vilnius · 8:55 am' },
    'session:stranger': {
      name: 'Windows · browser',
      note: 'Unknown city · 9:14 am',
    },
  },
  steps: {
    blush: {
      title: 'Oops',
      body: `In the morning Oleg pressed the button in the “Your password expires” email and typed his password at the cardboard door. Now he realises it was the bait from the phishing lesson.

Anyone can slip up, even a careful and experienced person. Such an event is an **incident**: something has happened, and a stranger may have got access. The harm comes not from the mistake but from keeping quiet about it.`,
    },
    'tell-it': {
      title: 'Tell IT right away',
      body: `First of all, tell IT. Right away, even if it’s awkward and even if “nothing seems to have happened”.

Ira doesn’t scold: she’s glad she heard first. She has a few minutes before the fraudster uses the password, and every minute counts.`,
    },
    'close-door': {
      title: 'The first 15 minutes',
      body: `Then Ira and Oleg shut the door before Stripes gets in:

- **tell IT**: already done;
- **change the password** in the password manager: the old key stops fitting;
- **sign out on all devices**: whoever already got in with the old password is thrown out;
- **don’t delete the email**, forward it to IT: it shows who else got it, and the address gets blocked.`,
      more: {
        title: 'More: what else counts as an incident',
        body: `**Not just a password.** An incident is also an attachment opened from a suspicious email, a lost phone or laptop, a file sent to the wrong person, and a strange program that does things on its own.

**What IT will ask.** When it happened, what exactly you typed or opened, on which device, and what the email or message was. Don’t delete anything: it all helps.

**Why nobody is punished.** A company that scolds people for mistakes hears about incidents last, when it’s too late. That is why a good IT team thanks you for every report, even a false alarm.

**If the account has 2FA**, the password alone is not enough for the fraudster: one more reason to turn it on everywhere.`,
      },
    },
    'bait-after': {
      title: 'Question: what to do with the email',
      body: 'The bait email is still sitting in Oleg’s inbox. What should he do with it now?',
    },
    'first-15': {
      title: 'Task: the first 15 minutes',
      body: `On the right are Oleg’s screens from earlier lessons: the messenger, the password manager and the mail.

Write to Ira about what happened and work through her list: change the email password, sign out on all other devices and forward the bait to IT without deleting it.`,
    },
    summary: {
      title: 'Summary',
      body: `Oleg slipped up but didn’t keep quiet, and Stripes stayed outside the door.

- An **incident** is no reason to hide: the danger is not the slip but the silence.
- The first 15 minutes: tell IT, change the password, sign out on all devices.
- A bait isn’t deleted but forwarded to IT: it helps find the others.`,
    },
  },
  annotations: {
    'blush.alt': () =>
      'Oleg at his desk blushes to the ears and covers his face with his hand; on the screen is that same cardboard sign-in door.',
    'blush.narration': () => 'Oleg realises what happened.',
    'blush.oleg': () => 'That was a bait… Maybe nobody will notice?',
    'toIra.alt': () =>
      'Oleg, mug in hand, walks up to Ira’s desk; Ira in her headset turns to him and smiles.',
    'toIra.narration': () => 'A minute later. Ira’s desk.',
    'toIra.oleg': () =>
      'Ira, I think I typed my password on a page from an email…',
    'toIra.ira': () =>
      'Good thing you came straight away! We’ll lock everything down now, there’s time.',
    'door.alt': () =>
      'Ira slams a door with a new lock right in Stripes’s face; Stripes holds the old key, which no longer fits.',
    'door.narration': () => 'Fifteen minutes later.',
    'door.striped': () => 'Hey! The old key doesn’t fit any more!',
    'bin.alt': () =>
      'Oleg holds the bait email over a wastebasket and hesitates; next to him is a tray with an IT pictogram.',
    'bin.narration': () => 'And what about the email itself?',
    'summary.blush': () => 'Anyone can slip up',
    'summary.toIra': () => 'Tell IT right away',
    'summary.door': () => 'A new password and sign-out everywhere',
    'summary.bin': () => 'The bait goes to IT, not the bin',
  },
  quizzes: {
    'bait-after': {
      question:
        'What should you do with a bait email once you have clicked its button?',
      options: {
        delete: 'Delete it so you don’t click it again by accident.',
        forward: 'Forward it to IT and don’t delete it.',
        reply: 'Reply to the sender that you’ve seen through them.',
      },
      wrong: {
        delete:
          'A deleted email won’t help IT: IT uses it to find who else got it and to block the sender’s address. Forward it first; IT will tell you when to delete it.',
        reply:
          'A reply only confirms to the fraudster that the address is live and you read your emails. Don’t write back to fraudsters.',
      },
      explain:
        'The email is evidence. From it IT learns the address and the link, finds the same email at colleagues and blocks the sender. That is why it is forwarded to IT and not deleted until IT says so.',
    },
  },
  tasks: {
    'first-15': {
      prompt:
        'Don’t keep quiet: tell IT and shut the door before the fraudster gets in.',
      goals: {
        told: 'Ira knows what happened',
        password: 'The email password is replaced',
        sessions: 'Signed out on all other devices',
        evidence: 'The bait is forwarded to IT',
      },
      hints: [
        'Start with the messenger: write to Ira about what happened. She’ll reply with what to do next.',
        'The password is changed in the password manager: the “Work email” item → “Replace with a generated one”. Other sessions are at the bottom of the mail, under “Details”. Don’t delete the bait.',
        'Messenger: reply to Ira. Vault: “Work email” → “Replace with a generated one”. Mail: “Details” at the bottom → “Sign out on all other devices”, then the “Your password expires today” email → “Forward to IT”. The place to press is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: Ira knows, the mailbox has a new password, the stranger’s session is closed, and IT has the email. Stripes is left with an old key that fits nothing.',
    },
  },
} satisfies LessonTexts<typeof lesson>
