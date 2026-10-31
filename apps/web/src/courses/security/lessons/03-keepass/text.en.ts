import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'KeePass. A vault file of your own',
  summary:
    'A password vault you keep yourself as one file. Nobody can recover it, so you need a strong master phrase and a fresh copy in another place.',
  preview: {
    alt: 'Illustration: a laptop screen shows a single KeePass vault file as a small safe, with a backup drive and one key lying next to it on the desk.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Oleg' },
    ira: { name: 'Ira' },
    'keepass-app': { name: 'KeePass' },
    'phrase:birthday': {
      name: 'Marina1990',
      note: 'Anyone who has seen your social media profile knows your name and birth year. Passwords like this are tried first.',
    },
    'phrase:old': {
      name: 'Romashka2024',
      note: 'This password already hung on a sticky note and was used on the delivery site that got hacked. It is in a leak.',
    },
    'phrase:words': { name: 'zebra tram kefir lighthouse' },
    'place:laptop': { name: 'Laptop → Documents' },
    'place:desktop': {
      name: 'Laptop → Desktop',
      note: 'Another folder, but the same laptop.',
    },
    'place:usb': {
      name: 'USB stick in the cupboard',
      note: 'A separate device, kept under lock.',
    },
    'place:cloud': {
      name: 'Personal cloud folder',
      note: 'The file is encrypted; the cloud only keeps a copy of it.',
    },
    'kp:bank': { name: 'Personal bank', note: 'bank.example · marina.k' },
    'kp:router': { name: 'Home Wi-Fi', note: 'router · admin' },
  },
  steps: {
    'own-file': {
      title: 'A vault you keep yourself',
      body: `In lesson 2 the passwords lived in 1Password: a vault program that remembers long, different passwords while you remember one master password. Its vault lives in the cloud, on the developer's servers.

**KeePass** is a vault program for passwords too, and it is free. The difference is where the vault lives: in KeePass the whole vault is one encrypted file on your computer. That file is called the **database file**.

There is no cloud and nobody else is connected to the file. But there is also nobody to back you up.`,
    },
    nobody: {
      title: 'Question: who opens the vault',
      body: 'Oleg started using KeePass, and a month later he forgot his master password. The database file is still on his laptop. Who can help him open it?',
    },
    phrase: {
      title: 'A master phrase of four words',
      body: `Since the master password cannot be recovered, it has to be one you remember and others cannot guess. The best kind is a **master phrase**: four or five random words in a row.

Compare on the right. A name with a birth year and an old work password are cracked in minutes: social media and leaks know them. Four random words are longer and still easy to remember — just picture them.

Write the phrase on paper and keep it at home, not on your desk. That is not a sticky note on the monitor but a spare key in a safe place.`,
      more: {
        title: 'More: KeePass or 1Password',
        body: `**1Password** is handier at work: the vault is in the cloud, departments share vaults, and the company administrator can restore an employee's access. If your company has it, keep work passwords there.

**KeePass** suits personal passwords and places that do not trust the cloud. There are versions for every system, for example KeePassXC for computers and KeePassDX for Android. They all open the same database file.

**Syncing.** You can put the file into a cloud folder: it is encrypted, and without the master phrase the cloud only sees a pile of bytes. That way the database is on both your phone and your laptop. But a cloud folder is not a backup: if the file gets damaged, the damaged file spreads everywhere.

**The phrase in this lesson** is only an example. Do not take it: make up your own.`,
      },
    },
    backup: {
      title: 'A backup in another place',
      body: `If the laptop breaks, gets stolen or the file is deleted by accident, all the passwords go with it. That is why the database file needs a **backup**: one more copy of the file on another device.

A copy in the next folder of the same laptop will not help: if the laptop breaks, both are gone. You need a separate device: a [[usb|USB stick]] in the [[cupboard|cupboard]] or your own cloud folder.

And the backup gets updated: added new passwords to the database — save the copy again, or they will not be in it.`,
    },
    'own-vault': {
      title: 'Task: a vault of your own',
      body: `Marina wants to keep personal passwords apart from work ones. Right now the passwords for her bank and home Wi-Fi are on a slip of paper under the keyboard.

Create a KeePass database with a strong master phrase, move the passwords from the paper into it and save a fresh copy on another device.`,
    },
    summary: {
      title: 'Summary',
      body: `Marina's vault is now in her own hands, and it has a spare copy.

- **KeePass** is a password vault you keep yourself as one **database file**. There is no cloud, and nobody can restore access.
- Make the master password a **phrase of four or five random words** and keep its written copy at home.
- The **backup** lives on another device and is updated after every change.`,
    },
  },
  annotations: {
    'box.alt': () =>
      'Marina at her desk lifts a small metal safe with a dial lock out of her laptop, as if holding a file in her hands.',
    'box.narration': () => "Marina's vault is a file on her laptop.",
    'box.marina': () =>
      'The whole vault is one file. And I keep it, not the cloud.',
    'forgot.alt': () =>
      'Oleg clutches his head in front of a small safe on his desk; next to him Ira spreads her hands. Above the safe is an empty dashed cloud outline.',
    'forgot.narration': () => 'A month later.',
    'forgot.oleg': () => 'What was that password again?..',
    'phrase.alt': () =>
      'Marina pins four picture cards to a board: a zebra, a tram, a bottle of kefir, a lighthouse. Over the frame, a comparison of master phrases.',
    'phrase.narration': () => 'A phrase you can picture sticks by itself.',
    'phrase.compare': () =>
      'Which phrase gets cracked\nstrong: 4 random words|zebra tram kefir lighthouse\nname and birth year|**Marina1990**\nold password from a leak|**Romashka2024**',
    'copies.alt': () =>
      'Marina holds a USB stick; next to her is an open cupboard with the same small safe on a shelf. A dashed line links it to the safe on the laptop screen.',
    'copies.narration': () => 'The second copy is in the cupboard.',
    'copies.marina': () =>
      'If the laptop breaks, I open the copy from the stick with the same phrase.',
    'summary.box': () => 'The vault is one file you keep',
    'summary.forgot': () => 'Forget the phrase — nobody opens it',
    'summary.phrase': () => 'A master phrase of random words',
    'summary.copies': () => 'A fresh copy on another device',
  },
  quizzes: {
    nobody: {
      question:
        'Oleg forgot his KeePass master password. Who can open his vault?',
      options: {
        ira: 'Ira from IT resets the password.',
        support: 'The KeePass developers restore access.',
        nobody:
          'Nobody: without the master password the file cannot be opened.',
      },
      wrong: {
        ira: "Ira has no key to Oleg's file: KeePass keeps the passwords nowhere but in the file itself, and the file is encrypted with Oleg's master password.",
        support:
          'KeePass has no server and no accounts: there is nothing for the developers to restore. The file is encrypted, and its only key is the master password.',
      },
      explain:
        'The database file is encrypted with the master password, and nobody holds a copy of it. So nobody can reset the password: not IT, not the developers. That is the strength of KeePass and its danger. Hence the two rules of this lesson: a phrase you will surely remember, and a spare copy of the file.',
    },
  },
  tasks: {
    'own-vault': {
      prompt:
        'Create a database with a strong master phrase, move the passwords from the paper into it and save a fresh copy on another device.',
      goals: {
        phrase: 'The database is created with a strong master phrase',
        entries: 'The passwords from the paper are in the database',
        backup: 'A fresh copy lies on another device',
      },
      hints: [
        'Start with “Create a new database”. Of the three phrases, the strong one cannot be found on social media or in leaks.',
        'Once the database is open, add both entries from the paper and only then save a copy: a copy made earlier will lack the new passwords. The desktop is the same laptop.',
        'Create the database, choose “zebra tram kefir lighthouse”, press “Add to database” on both entries, then “Save a copy…” and “USB stick in the cupboard”. The right place is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: the paper is in the shredder, the vault opens with a phrase Marina remembers, and a fresh copy waits on the stick in the cupboard.',
    },
  },
} satisfies LessonTexts<typeof lesson>
