import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Password attacks. How passwords get guessed',
  summary:
    'Passwords are guessed by a program: from lists of leaked passwords, familiar patterns and data from social media. Sort Oleg’s passwords: which fall at once and which hold.',
  preview: {
    alt: 'Illustration: password attacks — a short password on a note by the monitor; on the desk, a green card with a long phrase: a cup, skis, a plant.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Oleg' },
    striped: { name: 'Stripes' },
    'check-app': { name: 'Password check' },
    'group:oleg': {
      name: 'Oleg’s passwords',
      note: 'Oleg asked Marina to check his passwords. For each one, decide how quickly a program will guess it.',
    },
    'item:qwerty': {
      name: 'Qwerty123!',
      note: 'A coupon site. “It has a capital, digits and a symbol — the site said it’s strong.”',
    },
    'item:romashka': {
      name: 'Romashka2024!',
      note: 'The CRM of Romashka, Oleg’s company. The company name, a year and “!” at the end.',
    },
    'item:barsik': {
      name: 'Barsik2015',
      note: 'Online banking. Barsik is Oleg’s cat: his photos have been on social media since 2015, with a “Happy birthday, Barsik!” post every year.',
    },
    'item:leaked': {
      name: 'Gr@nd!Tour#88',
      note: 'The lunch delivery site. Looks complex, but Oleg uses it on many sites, and the delivery site was hacked last year.',
    },
    'item:phrase': {
      name: 'coffee-skis-windowsill',
      note: 'Work email. Three random words, used nowhere else.',
    },
    'item:generated': {
      name: 'v7#Lq9TmZ!x2pR4w',
      note: 'Work messenger. The password manager made it up and keeps it, for this site only.',
    },
    'action:fast': { name: 'Falls at once' },
    'action:personal': { name: 'Guessed from social media' },
    'action:holds': { name: 'Holds' },
    'res:qwerty:fast': {
      name: 'Right: keys in a row on the keyboard, digits in order and “!”. A password like this is near the top of every list.',
    },
    'res:qwerty:personal': {
      name: 'There is nothing personal here, and no need to look on social media: “qwerty” is keys in a row, and it is in every list.',
    },
    'res:qwerty:holds': {
      name: 'The site praises the symbols, but they don’t stop the program: “Qwerty123!” is near the top of every list.',
    },
    'res:romashka:fast': {
      name: 'Right: word, year and “!” is the most common pattern. The program adds the company name to its list first.',
    },
    'res:romashka:personal': {
      name: 'Almost: everyone does know the company name. But the program tries “word + year + !” without any social media — in the first minutes.',
    },
    'res:romashka:holds': {
      name: 'A capital, digits and a symbol don’t save it: “word + year + !” is a pattern the program tries among the very first.',
    },
    'res:barsik:fast': {
      name: 'This one may not be in the common lists. It gets guessed another way: the cat’s name and the year are on Oleg’s social media.',
    },
    'res:barsik:personal': {
      name: 'Right: the cat’s name and the year come from Oleg’s public photos. His social media page hands them to the program.',
    },
    'res:barsik:holds': {
      name: 'It doesn’t hold: Oleg showed the cat’s name and the year on social media himself, and the program adds such words to its list.',
    },
    'res:leaked:fast': {
      name: 'Right: the password is already in a leaked database. However complex it looks, it is tried first — and on all of Oleg’s other sites.',
    },
    'res:leaked:personal': {
      name: 'Social media has nothing to do with it: the password leaked from the delivery site. It is already in the database and is tried first.',
    },
    'res:leaked:holds': {
      name: 'Symbols don’t save a password that has already leaked: it sits in the database as it is and is tried on all of Oleg’s sites.',
    },
    'res:phrase:fast': {
      name: 'Not so: three random words are in no list, and the length makes guessing take very long. This password holds.',
    },
    'res:phrase:personal': {
      name: 'Oleg’s social media says nothing about coffee, skis and windowsills: the words are random, not about him. This password holds.',
    },
    'res:phrase:holds': {
      name: 'Right: a long phrase of random words, for one site only. It is in no list, and it is easy to remember.',
    },
    'res:generated:fast': {
      name: 'Not so: random characters from a password manager are in no list, and only this site has them. This password holds.',
    },
    'res:generated:personal': {
      name: 'There is nothing about Oleg in this password: a program made it up at random. This password holds.',
    },
    'res:generated:holds': {
      name: 'Right: long, random and for this site only. No need to remember it — that is the password manager’s job.',
    },
  },
  steps: {
    'by-machine': {
      title: 'Nobody guesses passwords by hand',
      body: `In films, a hacker sits at a screen and wonders: “Maybe the dog’s name?” In real life nobody guesses passwords by hand. A [[machine|program]] does it: it tries them one after another, tirelessly, with no days off. Stripes just drinks his coffee.

Trying every combination of letters in a row takes long. So the program starts with a [[keys|list]] of the passwords people choose most often: 123456, qwerty, password. This is called a **dictionary attack**.`,
    },
    patterns: {
      title: 'Habits everyone knows',
      body: `A site asks for a capital letter, a digit and a symbol — and almost everyone does the same: a word with a capital, digits at the end, “!” to finish. They swap “o” for “0” and “a” for “@”. They add a year.

The program knows these habits. From one word it makes many variants by itself: with a capital, with a year, with “!”, with a zero instead of “o”. So “P@ssw0rd!” only looks clever: the program tries a variant like that among the first.

Symbols on their own don’t save a password. Length and randomness do — more on them below.`,
      more: {
        title: 'More: why the “capital, digit, symbol” rule is being dropped',
        body: `The US standards institute NIST, in its password guidelines (SP 800-63B, revision 4, July 2025), forbids sites to demand a mix of character types or to force password changes on a schedule. Such rules make passwords not stronger but more predictable: people add “1!” and change “2024” to “2025”.

Instead, NIST requires sites to accept long passwords and to check every new password against a list of common, dictionary and leaked ones. A password should be changed when it has leaked, not every quarter.`,
      },
    },
    leaks: {
      title: 'Databases of stolen passwords',
      body: `Websites get hacked all the time. Stolen databases of emails and passwords are sold and posted online, and later merged into huge [[drawer|collections]]. Have I Been Pwned, a service that collects such leaks, counts more than 17 billion accounts (as of October 2026).

For a guessing program this is the best dictionary: real passwords of real people. A password that looks complex but has leaked once is already weak: it sits in the list as it is.

And if the leak has your email together with the password, there is nothing to guess at all. The program tries that pair on your email, at the bank, in the CRM. This is **credential stuffing**: stolen sign-in details tried on other sites.`,
    },
    stuffing: {
      title: 'Question: what is at risk',
      body: 'The lunch delivery site was hacked and its password database was posted online. Oleg used the same password there as for his work email. His CRM password is different. What is at risk now?',
    },
    personal: {
      title: 'What the internet knows about you',
      body: `When the target is a particular person, the program adds to its list what is easy to learn about them: first and last name, date of birth, the names of their children and cat, their favourite team, the company name.

We post almost all of it on [[feed|social media]] ourselves: a cake with candles, a cat on the sofa, “Happy birthday, Barsik!”. That is why marina1987, Barsik2015 and Romashka2024! fall quickly, even if they are in no leak.

Birthdays, the names of family and pets, a car number plate don’t make passwords. They stopped being secret when they reached the feed.`,
    },
    phrase: {
      title: 'What holds: a long phrase',
      body: `A password holds when it is in no list and takes long to guess. Length and randomness help, not symbols.

The UK National Cyber Security Centre (NCSC) recommends **three random words**: “coffee-skis-windowsill” is 22 characters, no dictionary has this phrase, and it is easy to remember. The words must be random: not a line from a song and not “i-love-my-mum”.

And every site gets its own password. Even a strong phrase that leaks from one site opens every other site where it is reused.`,
      more: {
        title: 'More: how long',
        body: `The leading organisations differ on the numbers, but all of them say: the longer, the better.

- **Google:** at least 12 characters, and a different password for each important account.
- **NIST** (guidelines SP 800-63B, 2025): sites must require at least 15 characters when the password is the only sign-in factor, and allow up to 64.
- **CISA** (the US cybersecurity agency): at least 16 characters, a different one for each account, kept in a password manager.

Three or four random words easily reach that length.`,
      },
    },
    check: {
      title: 'What to do today',
      body: `Nobody can remember twenty different long passwords. A **password manager** remembers them — that is the next lesson.

- **Check your email** at haveibeenpwned.com: the service shows which leaks it was in. If it was, change the password on that site and everywhere it was reused.
- **Email, bank and work accounts** get their own long passwords first: everything else is recovered through your email.
- **Turn on 2FA**, a second lock: then a stolen password alone is not enough. More in lesson 5.
- A site offers a **passkey**, a sign-in without a password, with your fingerprint or phone unlock code? Say yes: there is nothing to guess.`,
      more: {
        title: 'More: how to check a password without showing it',
        body: `**Your email** is fine to enter on haveibeenpwned.com: the service looks it up in leaked databases and shows which sites lost it.

**A password** is checked by Have I Been Pwned cleverly: your browser or password manager turns it into a long scrambled fingerprint (a hash) and sends only its first 5 characters. The service returns every similar fingerprint from the leaks, and your own device looks for the match. The password itself goes nowhere. Leak checks in many password managers work the same way.

**A passkey** is a replacement for passwords promoted by the FIDO Alliance, Google and Microsoft. It is kept on your phone or computer; it can’t be guessed and can’t be typed into a fake site. The NCSC recommends choosing a passkey wherever one is offered.`,
      },
    },
    audit: {
      title: 'Task: Oleg’s passwords',
      body: `Oleg watched the lesson and got worried. He wrote down his passwords and asked Marina to check them.

For each password, decide how it will be guessed: **falls at once** (it is in the lists, follows a pattern or has leaked), **guessed from social media** (made of personal details) or **holds**.`,
    },
    summary: {
      title: 'Summary',
      body: `Oleg knows which passwords to change first.

- Passwords are guessed by a **program**: first the common, leaked and patterned ones, then your details from social media.
- A leaked password is weak however complex it looks, and it opens every site where it is reused (**credential stuffing**).
- What holds is a **long phrase of random words**, a different one for each site. A password manager will remember them all — that is the next lesson.`,
    },
  },
  annotations: {
    'machine.alt': () =>
      'Stripes lounges in a chair with a coffee. Next to him a noisy machine: a heap of identical keys pours into a funnel, and a mechanical arm pushes them one by one into the lock of a door with an envelope.',
    'machine.narration': () =>
      'Stripes doesn’t guess — a machine works for him.',
    'machine.striped': () =>
      'Guess by myself? Why bother. Let the machine go through the list.',
    'patterns.alt': () =>
      'The same guessing machine pushing keys into a lock. Over the heap of keys, a magnifier with password patterns: Password1! and P@ssw0rd.',
    'patterns.narration': () =>
      'The heap of keys is full of familiar patterns.',
    'patterns.zoom': () =>
      'Patterns the machine tries first\nPassword**1!** · P**@**ssw**0**rd\na capital and “1!”, @ and 0 for letters',
    'archive.alt': () =>
      'An endless archive: shelves of drawers full of keys and tags. Stripes on a ladder pulls out a drawer and holds up a golden key; below, a broken box from the lunch delivery site.',
    'archive.narration': () => 'An archive of stolen keys.',
    'archive.striped': () =>
      'Billions of real passwords. I’ll start with these — people love repeating themselves.',
    'stuffing.alt': () =>
      'The same archive: Stripes on the ladder with a golden key from a drawer; below, the broken box of the lunch delivery site.',
    'stuffing.narration': () => 'The lunch delivery site was hacked.',
    'profile.alt': () =>
      'Stripes holds up a huge phone showing Oleg’s feed: a cake with candles, a ginger cat on a sofa, Oleg with a mug and the cat — and takes notes. In the distance Oleg posts another cat photo.',
    'profile.narration': () => 'Oleg’s feed is open to everyone.',
    'profile.striped': () => 'A cat called Barsik, since 2015… Noted.',
    'phrase.alt': () =>
      'Marina holds up a long key made of three charms: a coffee cup, skis and a window with a flower. The guessing machine next to her has jammed and is smoking; Stripes scratches his head.',
    'phrase.narration': () => 'The machine doesn’t know a key like this.',
    'phrase.compare': () =>
      'How three passwords get guessed\nholds: three random words|coffee-skis-windowsill\nat once: word + year + “!”|Romashka**2024!**\nfrom social media: name + birth year|marina**1987**',
    'check.alt': () =>
      'Marina at her laptop: on the screen, an envelope under a magnifier and a green tick. Next to it a phone with a shield and a safe icon. Oleg with his mug looks over her shoulder.',
    'check.narration': () => 'Five minutes worth spending today.',
    'check.marina': () =>
      'My email was in the delivery site leak. I’ve already changed that password.',
    'summary.machine': () => 'A program guesses, not a person',
    'summary.archive': () => 'A leaked password is already on the list',
    'summary.profile': () => 'Birthdays and cats are no secret',
    'summary.phrase': () => 'A long phrase, one per site',
    'summary.check': () => 'Check your email, turn on 2FA',
  },
  quizzes: {
    stuffing: {
      question:
        'The lunch delivery site was hacked. Oleg used the same password there as for his work email; his CRM password is different. What is at risk?',
      options: {
        'delivery-only':
          'Only the delivery site: it was hacked, not the email.',
        'mail-too':
          'The delivery site and the work email: the “email + password” pair will be tried there too.',
        nothing: 'Nothing: Oleg’s password is complex, with digits and “!”.',
      },
      wrong: {
        'delivery-only':
          'Nobody hacks the email — they just sign in: the “email + password” pair from the leak fits it too. That is exactly how credential stuffing works.',
        nothing:
          'Complexity doesn’t matter here: the password isn’t guessed, it already sits in the leaked database as it is. The program simply tries it on other sites.',
      },
      explain:
        'The program tries an “email + password” pair from a leak on email, banks, social media — everywhere. That is credential stuffing. Oleg’s work email is at risk because the password is the same. Only a different password saves the CRM.',
    },
  },
  tasks: {
    audit: {
      prompt:
        'Sort Oleg’s six passwords: which fall at once, which are guessed from social media and which hold.',
      goals: {
        lists: 'Passwords from lists, patterns or leaks are found',
        personal: 'The password made of personal details is found',
        strong: 'Strong passwords are marked as holding',
      },
      hints: [
        'Ask yourself about each password: is it in a list of common ones or in a leak? Does it follow the “word + year + !” pattern? Is it about Oleg? If every answer is “no”, it holds.',
        'Symbols don’t make a password strong. Falling at once: keys in a row, “word + year + !” and any leaked password. Guessed from social media: the cat’s name with a year. Holding: three random words and a password from a password manager.',
        'Qwerty123!, Romashka2024! and Gr@nd!Tour#88 — “Falls at once”, Barsik2015 — “Guessed from social media”, coffee-skis-windowsill and v7#Lq9TmZ!x2pR4w — “Holds”. The right button is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: Oleg changes three passwords today and the bank one next. His email and messenger hold. And so as not to memorise twenty new passwords, he needs a password manager — that is the next lesson.',
    },
  },
} satisfies LessonTexts<typeof lesson>
