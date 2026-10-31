import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Phishing. The bait email',
  summary:
    'The name in an email is a costume; the address tells the truth. Find the baits in the inbox without pressing anything in them.',
  preview: {
    alt: 'Illustration of phishing: a fishing hook catches an envelope on a desk, while the inbox on the laptop has one suspicious email highlighted in red.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Oleg' },
    striped: { name: 'Stripes' },
    victor: { name: 'Victor' },
    'victor-mask': { name: '“Victor”' },
    'bait-letter': { name: 'Email' },
    'letter:act': {
      name: 'Accounts · Romashka',
      note: 'October reconciliation: please sign by 6 pm',
    },
    'letter:act:body': {
      name: `Hi Marina,

Attached is the October reconciliation statement with Lastochka. Please sign it today: we close the month tomorrow.`,
    },
    'letter:act:button': { name: 'Open the statement in Documents' },
    'letter:act:sign': {
      name: 'Olga Petrenko, Chief Accountant\nRomashka Ltd · ext. 214',
    },
    'mail:ceo': {
      name: 'Victor Andreevich',
      note: 'Invoice for the Vilnius stand: pay today',
    },
    'mail:ceo:body': {
      name: `Hello Marina,

The Vilnius trade fair organisers have sent new bank details; the old invoice is no longer valid. Please pay today before 5 pm, or they will give our stand to someone else.

I’m in negotiations, don’t call, just do it. The invoice is attached.

V.`,
    },
    'mail:ceo:link': { name: 'Invoice_stand_Vilnius.pdf' },
    'mail:ceo:why': {
      name: 'The domain romashka-group.example is not yours. And it is the full spear-phishing kit: new bank details, urgent, “don’t call”. A request like this is checked by calling the number from the company directory.',
    },
    'mail:hr': {
      name: 'HR · Romashka',
      note: 'Poll: where do we go this summer?',
    },
    'mail:hr:body': {
      name: 'Colleagues, we are choosing a place for the summer trip: a lake, the mountains or the sea. Please vote by Friday.',
    },
    'mail:hr:link': { name: 'Open the poll' },
    'mail:hr:why': {
      name: 'The address is @romashka.example and the link goes to hr.romashka.example: your domain is on the right. It asks for nothing and doesn’t rush you.',
    },
    'mail:oleg': { name: 'Oleg Kovalchuk', note: 'Photos from the party' },
    'mail:oleg:body': {
      name: 'Hi Marina! I put the photos in the shared folder. You’re the one in the heart-shaped glasses :)',
    },
    'mail:oleg:link': { name: 'Folder “Party”' },
    'mail:oleg:why': {
      name: 'Your own address, and the link goes to the work storage at drive.romashka.example.',
    },
    'mail:parcel': {
      name: 'Delivery service',
      note: 'Parcel on hold: pay €1.99',
    },
    'mail:parcel:body': {
      name: 'Your parcel is waiting at our warehouse. Pay the €1.99 delivery fee within 24 hours, or it will be returned to the sender.',
    },
    'mail:parcel:link': { name: 'Pay €1.99' },
    'mail:parcel:why': {
      name: 'A mass bait: you aren’t expecting a parcel, payment goes through a link, and there is a 24-hour deadline. A card typed in there gets charged far more than €1.99.',
    },
    'mail:ira': {
      name: 'Ira · IT',
      note: 'Mail is down on Saturday from 10 to 12',
    },
    'mail:ira:body': {
      name: `Colleagues, on Saturday we are updating the mail server. Mail will be unavailable from 10:00 to 12:00.

There is nothing you need to do. Questions go to the work chat.

Ira`,
    },
    'mail:ira:why': {
      name: 'Your own address, no links, no requests. Real IT warns you; it doesn’t ask for your password.',
    },
    'mail:it': { name: 'IT Department', note: 'Your password expires today' },
    'mail:it:body': {
      name: `Hello,

Your password expires today at 6 pm. To keep access to your mailbox, please confirm your current password.

Regards, IT Department`,
    },
    'mail:it:link': { name: 'Keep my current password' },
    'mail:it:why': {
      name: 'rornashka instead of romashka: “r” and “n” side by side look like “m”. And IT never asks you to confirm your password through a link.',
    },
  },
  steps: {
    prize: {
      title: 'A check: is it your lucky day?',
      body: `Let’s start with a check. It’s lunchtime, you are scrolling through the news, and a prize window pops up in your browser.

Do what you would do in real life. You get one try.`,
    },
    bait: {
      title: 'An email with a hook',
      body: `In the morning Oleg gets an email: “Your password expires today. Confirm it or your mailbox will be closed.” A logo, a button, a signature from “IT Department”. Oleg is in a hurry and clicks.

The hook is almost always one of two: fear of losing something, or the urge not to miss a gift. The iPhone Duo window at the start of the lesson was the second kind.`,
    },
    'fake-door': {
      title: 'A cardboard door',
      body: `The button leads to a page that looks like the work mail sign-in, but it is a stage set: a password typed there goes to the fraudster.

An email bait like this is called **phishing**, as in fishing: cast thousands of emails and wait for a bite.`,
    },
    costume: {
      title: 'The name is a costume',
      body: `“IT Department”, “Bank”, “Victor Andreevich” in the From line are a costume. The sender writes that name, and anyone can put it on. The **address** tells the truth: the part after the @.

Press the sender’s name and your mail shows the address. Colleagues’ addresses end exactly in @romashka.example. Oleg’s email came from [[addr|@rornashka.example]]: “r” and “n” instead of “m”, impossible to tell apart at a glance.

The same goes for links: before you press, hover over the button and read the address at the bottom of the window.`,
      more: {
        title: 'More: how to read a link address',
        body: `**Read the domain from the right.** In romashka.example.login-check.example the owner is login-check.example; “romashka” is just a word at the start. But hr.romashka.example is yours: romashka.example is on the right.

**“Reply” may go somewhere else.** A fraudster can put their own reply-to address, different from the one in the From line. Check that one too.

**A QR code in an email** is the same link, only you can’t see it until you scan it. Don’t scan QR codes from emails “about your password” or “about a payment”.

**Found a bait?** Press “Report phishing” or forward the email to IT. Don’t just delete it: it didn’t come to you alone.`,
      },
    },
    research: {
      title: 'An email just for you',
      body: `A mass bait goes out to thousands. **Spear phishing** is written just for you.

The fraudster reads the company website, social media and news in advance: they know the director’s name, who pays the invoices and which trade fair you are going to.`,
    },
    mask: {
      title: 'The director’s mask',
      body: `Such an email calls you by name, mentions a real project and arrives “from the director” on a Friday evening: urgent, secret, “don’t call, I’m in a meeting”.

The address may differ by one word, and sometimes the email comes from a real but hacked partner mailbox.`,
    },
    call: {
      title: 'Checking through another channel',
      body: `That is why requests for money, passwords and access are checked through another channel: a call to the number from the directory, not from the email, or a message in the work chat.

Marina did exactly that, and the mask fell off.`,
    },
    clue: {
      title: 'Question: find the giveaway',
      body: '“Accounts” writes to Marina. Everything looks as usual: a logo, a subject with a deadline, the chief accountant’s signature. One place in the email gives the fake away for certain. Press it on the email.',
    },
    inbox: {
      title: 'Task: sort the inbox',
      body: `This is Marina’s mail for Monday: six emails. Three are baits, three are genuine.

Open each email and mark it “Phishing” or “Genuine”. To see the sender’s address, press their name; to see where a link goes, hover over it. Don’t press anything in the baits.`,
    },
    summary: {
      title: 'Summary',
      body: `Oleg took the bait, and Marina saw through it, both with “Accounts” and with the “director”.

- **Phishing** is an email bait: it rushes you, scares you and leads to a fake page.
- The sender’s name is a costume. Check the address after the @ and the link address before you click.
- **Spear phishing** knows your name and your projects. Check requests for money, passwords and access through another channel.`,
    },
  },
  annotations: {
    'bait.alt': () =>
      'Stripes sits on a giant monitor as if on a pier and lowers a fishing line into the office. On the hook is a shiny envelope with a red exclamation mark and an alarm clock. Oleg, mug in hand, reaches for it; Marina raises an eyebrow.',
    'bait.narration': () => 'Monday, 9:12. A new email.',
    'bait.letter': () =>
      '“Your password expires today! Confirm it or your mailbox will be closed.”',
    'bait.oleg': () => 'On it, clicking!',
    'bait.marina': () => 'Hang on…',
    'fakedoor.alt': () =>
      'A cardboard set painted as the mail sign-in door, propped up with sticks. Oleg slips a golden key, his password, through the gap. Behind the cardboard Stripes catches the key with a net.',
    'fakedoor.narration': () => 'A minute later.',
    'fakedoor.oleg': () => 'Weird, the page just reloaded.',
    'fakedoor.striped': () => 'Key received. Thank you!',
    'costume.alt': () =>
      'Stripes in a cheap “IT support” outfit: headset, polo shirt with a gear, badge. Stripes peek out of the sleeves, the edge of a mask shows. Marina studies the signature on his envelope through a big magnifying glass, and stripes show in the lens.',
    'costume.narration': () => 'The name is a costume.',
    'costume.striped': () => 'Hello, this is the IT Department!',
    'costume.zoom': () =>
      'From: IT Department\nit-support@ro**rn**ashka.example\nnot “m” but “r” and “n”',
    'research.alt': () =>
      'Night. Stripes at a corkboard with photos of Marina and director Victor, a page of the company website, a party snapshot and a trip flyer, all linked with red string. He takes notes.',
    'research.narration': () => 'Evening. Stripes does his homework.',
    'research.striped': () =>
      'The director is Victor. Marina pays the invoices. On Friday they have a trade fair in Vilnius…',
    'mask.alt': () =>
      'Marina at her desk looks at an email. On the monitor, Stripes holds a cardboard mask with Victor’s face and taps his watch, pointing at an invoice with a money bag. In a mug in the corner, the real Victor relaxes on a beach.',
    'mask.narration': () => 'Friday, 4:40 pm.',
    'mask.victor': () =>
      'Marina, pay for the stand urgently before 5 pm, new bank details. I’m in a meeting, don’t call.',
    'mask.marina': () => 'He always calls himself. And why “don’t call”?',
    'call.alt': () =>
      'On the left Marina calls from her desk phone. On the right the real Victor answers on the beach and raises a hand in surprise. The cardboard mask lies on the floor, and Stripes tiptoes away.',
    'call.narration': () =>
      'Marina calls Victor at the number from the directory.',
    'call.marina': () =>
      'Victor Andreevich, did you ask me to pay for the stand?',
    'call.victor': () =>
      'What stand? I’m on holiday! Forward that email to Ira.',
    'summary.bait': () => 'A bait rushes and scares you',
    'summary.costume': () => 'The name is a costume; the address is the truth',
    'summary.mask': () => 'A personal email knows all about you',
    'summary.call': () => 'Check by calling your own number',
  },
  quizzes: {
    prize: {
      question: 'What will you do with this window?',
      options: { skip: '“Skip”', login: '“Sign in”' },
      tags: {
        skip: 'It was phishing · well done, you didn’t fall for it',
        login: 'It was phishing · you fell for it, but we kept no password',
      },
      wrong: {
        login:
          'You fell for it: the page only pretended to be an account sign-in. We did not store or send your password anywhere: the fields were wiped at once. But in real life, change your password right away after something like this.',
      },
      explain: `This was phishing: a shiny gift, a timer and a familiar sign-in window. A password typed there would have gone to the fraudster.

What gave the fake away: the address bar says **gooogle-prizes.example**, someone else’s site with three “o”s in the name; a prize for nothing; a timer so you don’t stop to think. The padlock in the address bar proves nothing: fraudsters’ sites have one too.`,
    },
    clue: {
      question: 'What in this email gives the fake away for certain?',
      options: {
        name: 'the sender’s name',
        addr: 'the sender’s address',
        subj: 'the subject with a deadline',
        btn: 'the button',
        sign: 'the signature',
      },
      tags: {
        name: 'A name and a logo can be copied in a minute: that’s the costume.',
        addr: 'romashka-docs.example is someone else’s domain; anyone could have bought it.',
        subj: 'A deadline proves nothing on its own: real accountants hurry you too.',
        btn: 'You check a button by hovering, but it looks the same in any email.',
        sign: 'The chief accountant’s name and phone are easy to copy from the company website.',
      },
      wrong: {
        name: 'A name and a logo can be copied in a minute: that’s the costume.',
        subj: 'A deadline proves nothing on its own: real accountants hurry you too.',
        btn: 'You check a button by hovering, but it looks the same in any email.',
        sign: 'The chief accountant’s name and phone are easy to copy from the company website.',
      },
      explain:
        'The sender draws everything you see in an email: the name, the logo, the subject, the button, the signature. Only the domain, the part of the address after the @, can’t be faked. Here it is **romashka-docs.example**, not romashka.example.',
    },
  },
  tasks: {
    inbox: {
      prompt: 'Sort the six emails: find the three baits.',
      goals: {
        phish: 'Every bait is marked “Phishing”',
        real: 'Every genuine email is marked “Genuine”',
      },
      hints: [
        'Start with the address: press the sender’s name. Colleagues’ addresses end exactly in @romashka.example; compare letter by letter.',
        'Hover over a button or link: its address appears at the bottom of the window. hr.romashka.example and drive.romashka.example are yours; read the domain from the right. Anything that rushes you and asks for a password, money or “don’t call” is suspicious.',
        'The baits are “Your password expires today”, “Parcel on hold” and “Invoice for the Vilnius stand”. The other three are genuine. The email and button to press are outlined with a dashed line.',
      ],
      solvedNote:
        'Done: three baits caught, the genuine emails left alone. In real life you also forward each bait to IT: it didn’t come to you alone.',
    },
  },
} satisfies LessonTexts<typeof lesson>
