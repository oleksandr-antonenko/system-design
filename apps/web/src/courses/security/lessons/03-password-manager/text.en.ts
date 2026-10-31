import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Password manager. One password, one door',
  summary:
    'The vault remembers all the different passwords; you remember one. Move the passwords from sticky notes into a password manager, replace the reused one and share access through a shared vault.',
  preview: {
    alt: 'Illustration: a hand peels a sticky note with a password off a monitor, while the screen shows a password manager with a vault and a key for every account.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Oleg' },
    striped: { name: 'Stripes' },
    'vault-app': { name: '1Password' },
    'vault-personal': { name: 'Personal' },
    'vault-marketing': { name: 'Marketing' },
    'vault:request': {
      name: 'Marina, drop the social media password in the chat, pls! Need to put a post up.',
    },
    'entry:crm': { name: 'Company CRM' },
    'entry:lunch': { name: 'Lunch delivery' },
    'entry:social': { name: 'Company social media' },
  },
  steps: {
    'one-key': {
      title: 'One key for every door',
      body: `Oleg has one password for everything: email, CRM, the lunch delivery site, the bank. Handy, like a ring of identical keys where any key opens any [[doors|door]].

But a stranger with just one of those keys can open every door too.`,
    },
    leak: {
      title: 'A key from a leak',
      body: `Websites get hacked all the time, and the password databases are sold afterwards. When the password leaks from the lunch delivery site, it is tried at once on your email, the CRM and the bank. No guessing needed: the fraudster simply uses your own password.

Hence the rule of this lesson: **one password, one door**. Every site gets its own password.`,
    },
    vault: {
      title: 'A vault for passwords',
      body: `Remembering twenty different passwords is impossible, and you don’t have to. That’s what a **password manager** is for: a program that works as a vault for your passwords. It makes up a long random password for each site, keeps it and fills it in for you when you sign in.

You remember one password: the one to the vault itself. It is called the **master password**: nobody knows it, not even IT, and it isn’t written down anywhere.`,
      more: {
        title: 'More: what makes a good master password',
        body: `**Length beats complexity.** A phrase of 4–5 random words, such as “zebra tram kefir lighthouse”, is stronger than “P@ssw0rd!” and easier to remember. Don’t use a line from a song or your cat’s name.

**Leaks.** The password manager warns you itself if a site’s password turns up in a leak or is reused. Those passwords are changed first.

**If you forget the master password.** Nobody can open the vault, not even the developers. When you create the vault, the program gives you a recovery sheet (Emergency Kit): print it and keep it at home, not on your desk. In a work account, the company administrator can restore access.`,
      },
    },
    app: {
      title: 'What it looks like: 1Password',
      body: `There isn’t just one password manager; there are many. One of the most popular is **1Password**, and your company may well use it. There is also KeePass, which is free; it comes later in the course.

For you, 1Password is an app on your computer and phone plus [[screen|an icon in the browser]] (an extension). Open a sign-in page, and the icon offers your login and password: one click and you’re in. Nothing to remember, nothing to type.`,
    },
    'no-autofill': {
      title: 'Question: why the vault is silent',
      body: 'Oleg followed a link from an email: “Confirm your CRM sign-in”. The sign-in page looks real, but for the first time 1Password offers nothing. What happened?',
    },
    lookalike: {
      title: 'The lookalike: spot the difference',
      body: `The item in the vault says **crm.romashka.example**, but the email took Oleg to **crm-romashka.example**. The difference is one dot, replaced by a dash.

That dot matters. crm.romashka.example is a section of the company’s site, like a street in the town of Romashka. crm-romashka.example is a completely different site: anyone can buy a name like that. It’s another town with a similar name.

Eyes miss a swap like this, especially in a hurry. It can be sneakier still: in “rornashka” the letters r and n side by side look like an “m”, and a Cyrillic “о” can take the place of the Latin one and look exactly the same on screen.

A password manager compares the address letter by letter, so it notices what you can’t see. If the vault is silent, don’t type the password by hand: check the address.`,
      more: {
        title: 'More: how to read an address',
        body: `**Read from right to left.** Dots split an address into parts. The last two matter most: romashka.example. That’s the owner, the “town”. It is bought as a whole, and nobody else can get into it.

**Everything to the left is the owner’s sections.** crm.romashka.example, hr.romashka.example and mail.romashka.example are streets of one town, and only the company itself can create them.

**A word on the left proves nothing.** In romashka.example.login-check.example the owner is login-check.example, and “romashka” is just a word at the start. And in crm-romashka.example the dash doesn’t split anything: it’s one name, bought by someone else.`,
      },
    },
    stickers: {
      title: 'Task: sticky notes on the monitor',
      body: `Marina is tidying up. There are three sticky notes with passwords on her monitor, and two of them have the same password. And Oleg is asking in the chat for the company’s social media password.

Move the passwords from the sticky notes into the vault, replace the reused one with a generated one, and give Oleg access to the social media account through the shared vault “Marketing”.`,
    },
    summary: {
      title: 'Summary',
      body: `Oleg learned why one key for everything is dangerous, and Marina sorted out the sticky notes.

- **One password, one door:** when one site’s password leaks, it gets tried everywhere.
- A **password manager** remembers long, different passwords; you remember one **master password**.
- The vault is silent on a sign-in page? Check the address. Access goes through a shared vault, not a message.`,
    },
  },
  annotations: {
    'keys.alt': () =>
      'Oleg holds a ring of identical keys in front of four doors: email, CRM, lunch delivery, bank.',
    'keys.narration': () => 'Oleg and his keyring.',
    'keys.oleg': () =>
      'One password for everything. At least I won’t forget it!',
    'keys.doors': () => 'email · CRM · delivery · bank',
    'leak.alt': () =>
      'Stripes, holding a key from the hacked lunch delivery site, opens the email door, and behind it the CRM door.',
    'leak.narration': () =>
      'A month later. The lunch delivery site was hacked.',
    'leak.striped': () =>
      'A leaked password. Let’s try it on the email… and the CRM!',
    'vault.alt': () =>
      'Marina at an open safe: inside, different keys hang on hooks, one for each door. In her hand is a single small key to the safe.',
    'vault.narration': () => 'Marina keeps a separate key for every door.',
    'vault.marina': () =>
      'I remember one password: the vault’s. It remembers the rest.',
    'twin.alt': () =>
      'Oleg in front of a sign-in page that looks like the CRM. The vault in the corner of the screen stays shut and offers no key.',
    'twin.narration': () => 'Oleg opened a link from an email.',
    'twin.oleg': () =>
      'Odd: the vault is silent and doesn’t fill in the password.',
    'app.alt': () =>
      'Marina by the open safe with its keys; next to her, a monitor showing a sign-in page.',
    'app.narration': () => 'The vault lives in the computer.',
    'app.marina': () => 'I open the CRM, and 1Password fills in the password.',
    'app.screen': () => '1Password in the browser',
    'lookalike.alt': () =>
      'Oleg in front of a sign-in page that looks like the CRM; the vault in the corner of the screen is shut. Over the frame, an address comparison: the real crm.romashka.example and the lookalikes crm-romashka.example and crm.rornashka.example.',
    'lookalike.narration': () => 'The saved address and the lookalike.',
    'lookalike.compare': () =>
      'Compare letter by letter\nreal, from the item|crm**.**ro**m**ashka.example\nlookalike: a dash, not a dot|crm**-**romashka.example\nlookalike: “rn”, not “m”|crm.ro**rn**ashka.example',
    'summary.keys': () => 'One key for everything is risky',
    'summary.leak': () => 'A leak opens every door',
    'summary.vault': () => 'The vault remembers; you know the master password',
    'summary.twin': () => 'Vault silent? Check the address',
  },
  quizzes: {
    'no-autofill': {
      question:
        'The page looks like the usual CRM sign-in, but 1Password doesn’t offer the password. Why?',
      options: {
        'wrong-address':
          'The page address isn’t the one saved in the item: it’s a lookalike.',
        'vault-broken':
          'The vault is broken; it’s easier to type the password by hand.',
        'new-design':
          'The CRM has a new design, and the vault didn’t recognise it.',
      },
      wrong: {
        'vault-broken':
          'The vault isn’t broken: it compared the page address with the one in the item, and they didn’t match. Typing the password by hand is exactly what the fraudster is waiting for.',
        'new-design':
          'The vault doesn’t care about design: it looks only at the address. On the real site with a new design, the password would be filled in as usual.',
      },
      explain:
        'A password manager fills in the password only on the site whose address is saved in the item. The lookalike’s address is different, even if only by one character, so the vault stays silent, even when the page is copied pixel for pixel. How exactly the addresses differ is on the next step.',
    },
  },
  tasks: {
    stickers: {
      prompt:
        'Clear the passwords off the sticky notes, get rid of the reused one and give Oleg access to the social media account without sending him the password.',
      goals: {
        saved: 'No sticky notes with passwords left on the monitor',
        unique: 'No password is reused',
        shared: 'Company social media is in the shared vault “Marketing”',
      },
      hints: [
        'Start with the sticky notes: each has a “Move into the vault” button. The vault marks an item whose password repeats with the word “reused”.',
        'The “Replace with a generated one” button in an open item removes the reuse. The social media password isn’t sent in a message: the item is moved to the shared vault that Oleg already has.',
        'Move the three sticky notes, press “Replace with a generated one” in the “Company CRM” item, then in the “Company social media” item press “Share…” and “Move to the shared vault ‘Marketing’”. The place to press is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: the sticky notes are in the shredder, the CRM has its own long password, and Oleg sees the social media account in the shared vault. If he leaves the department, access is closed with one click.',
    },
  },
} satisfies LessonTexts<typeof lesson>
