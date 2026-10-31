import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: '2FA. The second lock',
  summary:
    'A stolen password is not enough when the second key is in your pocket. Turn on 2FA with a QR code, save the backup codes and reject a stranger’s sign-in request.',
  preview: {
    alt: 'Illustration of 2FA: a hand holds a phone with a sign-in code and a green confirm button, while the laptop behind waits for this second step.',
  },
  labels: {
    marina: { name: 'Marina' },
    striped: { name: 'Stripes' },
    'site-crm': { name: 'Romashka CRM' },
    request: { name: 'Windows · browser', note: 'Unknown city · 2:47 am' },
  },
  steps: {
    'second-lock': {
      title: 'The second lock',
      body: `Passwords get stolen: leaks, baits, someone peeking over your shoulder. That is why important doors get a second lock.

**Two-factor authentication** (2FA): besides the password, signing in needs a **one-time code**, six digits from an app on your phone. The code changes every 30 seconds and works only once.`,
    },
    stolen: {
      title: 'The key fits, but the door won’t open',
      body: `Stripes got hold of Marina’s CRM password, but the [[door|door]] didn’t open: the second lock is waiting for a code, and the phone is in Marina’s pocket.

With 2FA, a stolen password is not enough. That is why it gets turned on wherever it is available: email, CRM, bank, the company’s social media.`,
    },
    'code-call': {
      title: 'Question: a call “from IT”',
      body: 'Since the password didn’t do the trick, the fraudster calls. They say they are from IT or the bank and ask you to “read out the code for a check”. What do you do?',
    },
    night: {
      title: 'A request in the middle of the night',
      body: `It can happen like this too: your phone asks “Is this you signing in?”, and you weren’t signing in anywhere. That means someone already has your password.

Press “No” — the door stays shut — and tell IT: the password needs changing. Don’t press “Yes” just to make the requests stop: that is exactly what the fraudster is counting on.`,
      more: {
        title: 'More: SMS, keys and passkeys',
        body: `**SMS is weaker than an app.** A phone number can be reissued to someone else’s SIM card, and malware can read SMS messages. If a site offers an authenticator app, choose it.

**Security keys and passkeys.** Even more reliable is a physical key (a small USB device) or a passkey on your phone and laptop. They check the site address themselves, so they won’t work on a lookalike site.

**Password and code in one place.** A password manager can store 2FA codes too, which is handy. But for the most important accounts (email, bank, password manager) keep the second key separate: in the app on your phone.`,
      },
    },
    enable: {
      title: 'Task: turn on 2FA',
      body: `Marina is turning on 2FA for Romashka CRM. On the right are the CRM security page and her phone with an authenticator app.

Turn on 2FA with the QR code, save the backup codes to the password manager and deal with the sign-in request that will arrive on the phone.`,
    },
    summary: {
      title: 'Summary',
      body: `Stripes had the password, but he still couldn’t get in.

- **2FA** is a second lock: besides the password, you need a **one-time code** from your phone.
- Never read the code out to anyone: not to “IT”, not to the “bank”. Whoever asks for the code is the one signing in.
- “Is this you signing in?”, but you weren’t? Press “No” and tell IT.`,
    },
  },
  annotations: {
    'locks.alt': () =>
      'A door with two locks: an ordinary one for a key and a second one that opens with a code from Marina’s phone.',
    'locks.narration': () => 'The door to the CRM. Now it has two locks.',
    'locks.marina': () =>
      'The key is my password. But only a code from my phone opens the second lock.',
    'stolen.alt': () =>
      'Night. Stripes has put the stolen key into the first lock, but the second lock, with a little screen for the code, won’t budge.',
    'stolen.narration': () => 'At night. Stripes has a password from a leak.',
    'stolen.striped': () => 'The key fits… so what’s this other lock?',
    'call.alt': () =>
      'Stripes in a headset and an “IT” T-shirt is calling Marina. She holds the receiver and looks at her phone with the code.',
    'call.narration': () => 'In the morning, “IT” calls Marina.',
    'call.striped': () =>
      'Hello, this is IT. We’re checking your security. Please read out the code from the SMS.',
    'call.marina': () => 'But the code is what you need to sign in…',
    'night.alt': () =>
      'Night, a bedroom. Marina’s phone glows on the bedside table: “Is this you signing in?” requests pop up one after another. Marina sleepily reaches out to press “No”.',
    'night.narration': () => 'Two in the morning. Marina’s phone is buzzing.',
    'night.marina': () => '“Is this you signing in?” No, I’m asleep!',
    'summary.locks': () => 'The second lock is a code from your phone',
    'summary.stolen': () => 'A stolen password is not enough',
    'summary.call': () => 'Never read the code out to anyone',
    'summary.night': () => 'Not you signing in? “No”, then IT',
  },
  quizzes: {
    'code-call': {
      question:
        'IT calls and asks you to read out the code from an SMS. What do you do?',
      options: {
        dictate: 'I’ll read it out: it’s our own IT, they know best.',
        'call-back':
          'I won’t give the code: I’ll hang up and call IT back at the number from the directory.',
        half: 'I’ll read out only the first three digits to check who’s calling.',
      },
      wrong: {
        dictate:
          'The code is the second key to your door; reading it out means opening the door yourself. Real IT never needs your code: they have their own tools.',
        half: 'Half the code is still a clue, and it doesn’t check the caller: they’ll just say everything matches. The real check is a call to a number you know yourself.',
      },
      explain:
        'The code from an SMS or an app is for you alone, when you sign in. Whoever asks you to read it out is the one trying to sign in. Hang up and call IT back yourself at the number from the directory.',
    },
  },
  tasks: {
    enable: {
      prompt:
        'Turn on 2FA for the CRM, save the backup codes and keep the stranger out.',
      goals: {
        on: '2FA is on for the CRM',
        codes: 'Backup codes are in the password manager',
        stranger: 'The stranger’s sign-in is declined, IT knows',
      },
      hints: [
        'Start on the site: “Turn on 2FA” shows a QR code. Then press “Scan QR code” on the phone.',
        'The app shows six digits: enter them on the site. Backup codes are for when the phone gets lost: they are kept in the password manager. An “Is this you signing in?” request in the middle of the night isn’t yours.',
        '“Turn on 2FA” → “Scan QR code” on the phone → code 381 640 and “Confirm” on the site → “Save to the password manager” → “No, it’s not me” on the phone → “Tell IT”. The place to press is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: the CRM has two locks, the backup codes are in the vault, and Stripes is left outside the door. IT is already changing the password together with Marina.',
    },
  },
} satisfies LessonTexts<typeof lesson>
