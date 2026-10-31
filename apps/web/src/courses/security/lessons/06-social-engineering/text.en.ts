import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Social engineering. A call “from IT”',
  summary:
    'Fraudsters fool people, not computers: pause and check through another channel. A “director” writes from a new number and asks you to pay an invoice urgently.',
  preview: {
    alt: 'Diagram of social engineering: an urgent message from an unknown number is not obeyed but checked through another channel with the real contact.',
  },
  labels: {
    marina: { name: 'Marina' },
    striped: { name: 'Stripes' },
    victor: { name: 'Victor' },
    'victor-mask': { name: '“Victor”' },
    'chat:new-victor': {
      name: 'Victor Andreevich',
      note: '+370 600 41 977 · new number',
    },
    'chat:new-victor:body': {
      name: `Hello Marina. This is my new number, my old phone broke.

We urgently need to pay the invoice for our stand at the Vilnius trade fair: €4,800, new bank details, I’ll send them next. It has to be paid by 3 pm, or they’ll give the stand away.

I’m in negotiations, no need to call. Just text me when it’s paid.`,
    },
    'chat:new-victor:call': {
      name: '“Marina, I asked you not to call! I’m in a meeting. Please just pay it, I’ll explain everything later.” The voice sounds like his, but faking a voice is not hard these days.',
    },
    'chat:new-victor:forwarded': {
      name: 'Thanks for forwarding this! It’s a fraudster: I’m blocking the number and will warn everyone in the general chat.',
    },
    'reply:new-victor:pay': {
      name: 'OK, I’ll pay it now.',
      note: 'Great! Send me a photo of the payment confirmation once it’s done.',
    },
    'reply:new-victor:pause': {
      name: 'Victor Andreevich, I’ll call you back at the number from the directory, and then I’ll pay.',
      note: 'No need to call, I’m in a meeting! It’s urgent!',
    },
    'chat:ira': { name: 'Ira · IT', note: 'IT administrator' },
    'chat:ira:body': {
      name: 'Colleagues, a reminder: strange emails, calls and messages come straight to me. Better safe than sorry.',
    },
    'chat:oleg': { name: 'Oleg', note: 'sales department' },
    'chat:oleg:body': { name: 'Marina, coffee at three?' },
    'contact:victor': { name: 'Victor Andreevich', note: 'director' },
    'contact:ira': { name: 'Ira', note: 'IT administrator' },
    'call:victor': {
      name: '“Marina? What invoice? I didn’t write anything, my number hasn’t changed. Forward it to Ira.”',
    },
    'call:ira': {
      name: '“Yes, hello! Something suspicious? Forward it to me and we’ll sort it out.”',
    },
  },
  steps: {
    'fake-ira': {
      title: 'A call “from IT”',
      body: `Fooling a person is easier than hacking a computer. **Social engineering** is when a fraudster doesn’t break through your defences but talks you into opening them yourself: installing a program, sharing a code, paying an invoice.

The levers are almost always the same: **urgent**, **the boss** and **help me**.`,
    },
    door: {
      title: 'Hold the door',
      body: `The same trick works without a phone: someone with [[boxes|boxes]] asks you to hold the door, a “new hire” forgot their pass. You want to help: that’s how we were brought up.

Saying no politely is fine: “Let me call the person you’re here to see.”`,
    },
    which: {
      title: 'Question: spot the social engineering',
      body: 'Marina got three requests in one day. One of them is social engineering. Which one?',
    },
    'new-account': {
      title: 'The “director” has a new number',
      body: `Friday afternoon. “Victor” writes in the messenger from a new number: the photo looks real, the name looks real.

A photo is easy to copy: it’s on the company website. And “new number”, “urgent” and “don’t call” are the same set of levers.`,
    },
    'second-channel': {
      title: 'A pause and a second channel',
      body: `The rule: **a pause and a check through a second channel** (out-of-band verification). Don’t agree in the same chat, and don’t call the number from the message: the same person will answer there.

Call a number you know yourself, from the directory, or ask in person. Forward anything suspicious to IT: you are not the only one who got that message.`,
      more: {
        title: 'More: voice, video and a code word',
        body: `**Voices and video get faked.** A few minutes of recording are enough for a program to speak in the director’s voice and show his face on a video call. So you check the channel, not the voice: a call to the number from the directory.

**A code word for payments.** Many companies agree on this: an urgent payment requested “from above” is confirmed with a code word or by a second person. Ask your manager whether you have such a rule.

**Turnstiles and passes.** Letting a stranger in “just for a minute” is the same as giving them a key. If someone is waiting for a colleague, call the colleague.`,
      },
    },
    messenger: {
      title: 'Task: a message from the “director”',
      body: `Your turn. “Victor Andreevich” messages Marina from a new number and pushes her to pay.

Reply politely without paying, check the request by calling the number from the directory, and forward the chat to Ira in IT.`,
    },
    summary: {
      title: 'Summary',
      body: `Stripes called “from IT”, asked Marina to hold the door and wrote “from the director”. Each time Marina took a pause.

- **Social engineering** pulls three levers: urgent, the boss, help me.
- **A pause and a second channel:** check the request by calling the number from the directory, not the one in the message.
- Saying no politely is fine. Forward anything suspicious to IT.`,
    },
  },
  annotations: {
    'fakeIra.alt': () =>
      'Stripes in a purple wig and a headset pretends to be Ira from IT and calls Marina; stripes stick out from under his hoodie. Marina, holding the receiver, has her doubts.',
    'fakeIra.narration': () => 'Morning. “Ira from IT” is calling.',
    'fakeIra.striped': () =>
      'Marina, it’s Ira. You have a virus! Install a remote access program and I’ll clean everything up.',
    'fakeIra.marina': () =>
      'That doesn’t sound like her… And Ira always writes in the work chat.',
    'door.alt': () =>
      'Stripes in a courier uniform with a pile of boxes stands at an office door with a card reader. Marina walks up with her pass in hand.',
    'door.narration': () => 'The office entrance. Someone with boxes.',
    'door.striped': () => 'Could you hold the door, please? My hands are full!',
    'requests.alt': () =>
      'Marina at her desk; above her are three thought bubbles: a phone call, a chat message and a team meeting.',
    'requests.narration': () => 'Three requests in one day.',
    'newAccount.alt': () =>
      'Stripes peeks out of Marina’s phone screen holding a cardboard mask of Victor on a stick; next to it is an avatar with Victor’s real photo.',
    'newAccount.narration': () =>
      'Friday, 2:10 pm. A message from a new number.',
    'newAccount.victor': () =>
      'Marina, this is my new number. Please pay the invoice urgently. I’m in a meeting, don’t call.',
    'check.alt': () =>
      'On the left Marina calls from her desk phone, the company directory open beside her. On the right the real Victor, in a meeting, answers in surprise.',
    'check.narration': () =>
      'Marina calls Victor at the number from the directory.',
    'check.marina': () =>
      'Victor Andreevich, did you ask me to pay an invoice?',
    'check.victor': () =>
      'What invoice? I didn’t write anything. Forward it to Ira!',
    'summary.fakeIra': () => '“Ira” asks you to install a program',
    'summary.door': () => 'Saying no politely is fine',
    'summary.newAccount': () => 'A new number, urgent, “don’t call”',
    'summary.check': () => 'Check with the number from the directory',
  },
  quizzes: {
    which: {
      question: 'Which of the three requests is social engineering?',
      options: {
        'bank-call':
          '“The bank’s security service” calls and asks you to read out the code from an SMS to “cancel a suspicious transfer”.',
        'ira-chat':
          'Ira writes in the work chat: “On Saturday we’re updating the mail, there’s nothing you need to do.”',
        'victor-meeting':
          'At the team meeting, Victor asks for a sales report by Friday.',
      },
      wrong: {
        'ira-chat':
          'Ira asks for nothing: no code, no money, no rush. And she writes in the work chat you know.',
        'victor-meeting':
          'An ordinary work request made in person at a meeting: nothing secret and no rush.',
      },
      explain:
        'The call “from the bank” pulls every lever at once: urgency (“the transfer is already going through”), authority (“the security service”) and help (“let me cancel it for you”). A bank never asks for the code from an SMS. Hang up and call back on the number on your card.',
    },
  },
  tasks: {
    messenger: {
      prompt:
        'Don’t pay an invoice because of a message: take a pause, check the request through a second channel and tell IT.',
      goals: {
        pause: '“Victor” got a polite reply and no payment',
        verified:
          'The request is checked by calling the number from the directory',
        forwarded: 'The chat is forwarded to Ira in IT',
      },
      hints: [
        'Start with the reply: choose the one that takes a pause instead of agreeing. Saying no politely is fine.',
        'The number from the message is no good for a check: the same person will answer. Open the “Directory” tab: it has a number you know yourself.',
        'In the “Victor Andreevich” chat, reply “…I’ll call you back at the number from the directory…”, call Victor Andreevich in the “Directory” tab, go back to the chat and press “Forward to IT”. The place to press is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: the money is safe, the real Victor never wrote anything, and Ira blocked the number and warned everyone else.',
    },
  },
} satisfies LessonTexts<typeof lesson>
