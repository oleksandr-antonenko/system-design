import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Practice. A day at the office',
  summary:
    'Everything together: six short situations of one working day on the course screens — Wi-Fi, a café, an email, a message “from IT”, an extension and access for AI.',
  preview: {
    alt: 'Illustration for practice: an ordinary office day seen from behind a worker, with green ticks by the locked laptop, the router and an envelope.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Oleg' },
    ira: { name: 'Ira' },
    victor: { name: 'Viktor' },
    guest: { name: 'Client' },
    striped: { name: 'Stripes' },
    'vpn-profile': { name: 'Romashka' },
    offer: {
      name: 'Commercial offer',
      note: 'Good afternoon! Here is the offer we discussed this morning. Marina',
    },
    'offer:file': { name: 'Offer_Lastochka.pdf' },
    'net:Rozmarin-Guest': {
      name: 'Rozmarin café Wi-Fi',
      note: 'Free internet for guests. By pressing “Accept” you agree to the terms.',
    },
    'net:Rozmarin-Free-WiFi': {
      name: 'Free WiFi · sign in',
      note: 'To get free internet, sign in with your work email.',
    },
    'net:Galaxy S24': {
      name: 'Phone hotspot',
      note: "This is someone's phone sharing its internet. Only its owner knows the password.",
    },
    'mail:pay': {
      name: 'Accounting',
      note: 'Confirm your salary details by 16:00',
    },
    'mail:pay:body': {
      name: `Dear colleagues,

We are moving salaries to a new bank. Please confirm your details by 16:00 today, or your November payment will be delayed.

Accounting`,
    },
    'mail:pay:link': { name: 'Confirm details' },
    'mail:pay:why': {
      name: 'The domain romashka-pay.example is not yours, however similar. Urgency, salary, a sign-in button — a classic bait. The real accounting team writes from @romashka.example.',
    },
    'mail:olga': {
      name: 'Olga Petrenko',
      note: 'Taxi receipts by Friday',
    },
    'mail:olga:body': {
      name: 'Hi Marina! Please bring the taxi receipts from the trade fair by Friday — we are closing the report. Olga, accounting',
    },
    'mail:olga:why': {
      name: 'An @romashka.example address, no links, no urgent requests: just a reminder.',
    },
    'mail:hr': { name: 'HR · Romashka', note: "Next year's holiday schedule" },
    'mail:hr:body': {
      name: 'Colleagues, please enter your preferred holiday dates in the form by the end of the month.',
    },
    'mail:hr:link': { name: 'Holiday form' },
    'mail:hr:why': {
      name: 'Your own address, a link to hr.romashka.example — your domain is on the right.',
    },
    'chat:fake-ira': {
      name: 'Ira IT',
      note: '+370 611 20 450 · new number',
    },
    'chat:fake-ira:body': {
      name: `Hi Marina! It's Ira, writing from my personal phone, the work one is dead.

We have a security update, you urgently need to install a remote access program so I can set everything up. I'll send the link next, it takes a minute.`,
    },
    'chat:fake-ira:call': {
      name: "“Marina, I'm in a meeting, no time to talk! Just install it before it starts.” The voice is unfamiliar, and the call drops at once.",
    },
    'chat:fake-ira:forwarded': {
      name: "Thanks! That wasn't me: I'm blocking the number and will warn everyone in the team chat.",
    },
    'reply:fake-ira:install': {
      name: "OK, send the link, I'll install it.",
      note: 'Great! Here is the link: remote-help.example/setup',
    },
    'reply:fake-ira:check': {
      name: "Ira, I'll call you back on your work number from the directory and install it then.",
      note: "No need to call, I'm in a meeting! It's urgent!",
    },
    'chat:oleg': { name: 'Oleg', note: 'sales' },
    'chat:oleg:body': { name: 'Marina, coming to lunch?' },
    'contact:ira': { name: 'Ira', note: 'IT administrator' },
    'call:ira': {
      name: "“Marina? No, I didn't write anything, my number is the same. Don't install anything, forward me that chat.”",
    },
    'extensions-app': { name: 'Browser extensions' },
    'group:store': {
      name: 'Install',
      note: 'Oleg recommends: “Get it, spreadsheets fly with it!”',
    },
    'group:installed': {
      name: 'Installed extensions',
      note: 'While you are here, look at what is already installed.',
    },
    'item:sheets': {
      name: 'Super Sheets Helper',
      note: 'Unknown developer · 900,000 users',
    },
    'item:coupons': {
      name: 'Coupons & Deals 24/7',
      note: 'Installed for a single purchase a year ago',
    },
    'detail:all-sites': {
      name: 'Read and change all your data on all websites',
    },
    'detail:clipboard': { name: 'Read what you copy' },
    'action:install': { name: 'Install' },
    'action:cancel': { name: 'Cancel' },
    'action:keep': { name: 'Keep' },
    'action:remove': { name: 'Remove' },
    'res:sheets:install': {
      name: 'Stop: the spreadsheet helper now sees your mail, CRM and everything you copy. In real life, right now: remove it and tell IT.',
    },
    'res:sheets:cancel': {
      name: 'Right: spreadsheets do not need access to every site and to the clipboard.',
    },
    'res:coupons:remove': {
      name: 'Removed. For a year the extension saw every page for the sake of one discount.',
    },
    assistant: { name: 'AI assistant' },
    crm: { name: 'Romashka CRM' },
    'assistant:intro': {
      name: 'Hi! I will put together a list of clients who need a contract reminder. I need access to the CRM: send me the administrator login and password — that is quickest.',
    },
    'assistant:say-password': {
      name: 'Login: admin\nPassword: ••••••••••••',
    },
    'assistant:say-token': {
      name: 'Here is the token: crm_tok_••••••••••••7c21',
    },
    'assistant:say-reference': {
      name: 'The token is in 1Password: op://Work/crm-agent/token. Run it through op run.',
    },
    'assistant:password': {
      name: 'I see the administrator password. Do not send passwords in the chat: they stay in the history. Better create a separate read-only token in the CRM and delete this message.',
    },
    'assistant:token': {
      name: 'Got the token, working. A tip for next time: a token is a secret too, it is safer to give a link to the 1Password entry.',
    },
    'assistant:reference': {
      name: 'Running through op run: the token goes into an environment variable and never reaches the chat.',
    },
    'assistant:done': {
      name: 'Done: I found 17 clients whose contracts end in December and put them in a spreadsheet. I no longer need access — the token can be revoked.',
    },
    'section:sales': { name: 'Sales' },
    'section:clients': { name: 'Clients' },
    'section:invoices': { name: 'Invoices' },
    'section:staff': { name: 'Staff' },
  },
  steps: {
    morning: {
      title: 'An ordinary working day',
      body: `This is a practice lesson. There are no new words: ahead is one working day of Marina's and six short situations, each from an earlier lesson of the course.

Solve them on familiar screens: the phone, mail, the messenger, the browser and the AI chat. If something slipped your mind, the hints will remind you.`,
    },
    guest: {
      title: '9:30. A guest asks for Wi-Fi',
      body: 'In the morning a client arrives for a meeting and asks for internet: her phone barely has a signal. What do you give her?',
    },
    lunch: {
      title: '13:00. Lunch at a café',
      body: `Marina is having lunch at a café, and a client expects an offer by two. On the table there is a [[sign|card]] with the café network's name; you can press it. At the next table sits a “barista” with a phone.

Join the café network from the card, turn on the VPN and only then send the email. Remember lesson 1: the lookalike has a stronger signal and asks for your work email.`,
    },
    accounting: {
      title: '14:10. An email from “accounting”',
      body: `After lunch there are three new emails, one of them about salaries and “by 16:00”.

Mark the bait and the real emails without pressing anything in the bait. As in lesson 6: look at the address after @ and the address of the link.`,
    },
    'it-call': {
      title: '15:00. “Ira” from a new number',
      body: `“Ira from IT” writes in the messenger from an unknown number and asks you to urgently install a remote access program.

As in lesson 6: reply with a polite pause, check with the number from the directory and forward the chat to the real Ira.`,
    },
    extension: {
      title: '16:00. A new extension',
      body: `Oleg recommends an extension for spreadsheets. Before installing, the browser shows its permissions.

As in lesson 9: decline the extension that wants every site, and while you are at it, remove an extra one that is already installed.`,
    },
    assistant: {
      title: '17:00. The assistant needs access',
      body: `The AI assistant is putting together a list of clients due to renew their contracts and asks for the CRM administrator password.

As in lesson 10: no passwords in the chat. Create a token with read-only access to the “Clients” section for 7 days, save it in 1Password, give the assistant a link to the entry and revoke it when the work is done.`,
    },
    summary: {
      title: 'Course summary',
      body: `Evening. Marina locks her screen, Ira gives a thumbs-up, and Stripes walks away empty-handed.

- **Network and passwords:** guests get the guest network, the café gets a VPN; the vault remembers different passwords, important sign-ins get 2FA.
- **People and email:** the name is a costume, the address tells the truth; a strange request is checked through another channel.
- **Programs, browser, AI:** only the files and extensions you need; the assistant gets its own limited token.
- **If you already clicked**, tell IT at once. The real danger is not the mistake but the silence.

You have finished the course. Thank you for staying to the end!`,
    },
  },
  annotations: {
    'morning.alt': () =>
      'Morning in a bright office: Marina arrives with a bag and a coffee, Oleg waves from his desk with his mug, Ira adjusts her headset, Viktor walks by with a folder.',
    'morning.narration': () => 'Monday morning.',
    'morning.marina': () => "Well, an ordinary day. Let's see what it brings.",
    'guest.alt': () =>
      'At the reception desk a client in a peach jacket holds up her phone; Marina reaches for a card on a stand with a Wi-Fi symbol. Behind her, a mint dome over the office and a separate peach one over the guest chairs.',
    'guest.narration': () => 'Reception, 9:30.',
    'guest.guest': () =>
      "May I use your Wi-Fi? My phone isn't getting any signal.",
    'cafe.alt': () =>
      'Marina at a café table with a salad and her phone, a card with a Wi-Fi symbol on the table. At the next table Stripes in a barista apron glances at her, phone in hand.',
    'cafe.narration': () => 'Rozmarin café, 13:00.',
    'cafe.sign': () =>
      'Rozmarin café Wi-Fi\nno password\nThe café never asks for your email login or password.',
    'summary.morning': () => 'An ordinary day begins',
    'summary.guest': () => 'Guests get the guest network',
    'summary.cafe': () => 'At the café: the network on the card and a VPN',
    'summary.evening': () => 'The screen is locked, a calm day is over',
  },
  quizzes: {
    'guest-wifi': {
      question: 'A client at a meeting asks for Wi-Fi. What do you give her?',
      options: {
        office: "The office network password: she won't be long.",
        phone: 'Share the internet from your work laptop.',
        guest: 'The guest network card.',
      },
      wrong: {
        office:
          'The office network password is the key to a shared room with the printer, folders and cameras. And it works until it is changed, even from the car park.',
        phone:
          "Sharing from your work laptop lets a stranger's device into your machine and through it into the work network. Guests have their own network.",
      },
      explain:
        'The guest network gives internet and nothing more: the office printers, folders and computers stay behind glass. So the card with its name can go to any guest.',
    },
  },
  tasks: {
    lunch: {
      prompt:
        'Join the café network from the card, turn on the VPN and send the offer to the client.',
      goals: {
        'cafe-network': "The phone is on the café's network from the card",
        vpn: 'The VPN is on',
        sent: 'The offer is sent through the VPN',
      },
      hints: [
        'The network name is on the card on the table. The lookalike has a similar name and a stronger signal.',
        'The real café network only asks you to accept the terms. The VPN goes on before you open your mail.',
        'Choose “Rozmarin-Guest”, press “Accept”, turn on the VPN, then open “Mail” and send the email. The right place is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: the offer went through the closed VPN tunnel, and the “barista” at the next table saw nothing.',
    },
    accounting: {
      prompt:
        'Mark the bait and the real emails without pressing anything in the bait.',
      goals: {
        phish: 'The bait is marked “Phishing”',
        real: 'The real emails are marked “Genuine”',
      },
      hints: [
        "Click the sender's name to see the address, and hover over the link to see where it goes.",
        'The right end of the address should be romashka.example. romashka-pay.example has another owner.',
        'The “Accounting” email about salaries — “Phishing”; the emails from Olga and HR — “Genuine”. The right button is outlined with a dashed line.',
      ],
      solvedNote:
        "Done: the bait from romashka-pay.example is marked, and the colleagues' real emails stay where they are.",
    },
    'it-call': {
      prompt:
        'Do not install the program: reply with a pause, check with the directory and forward the chat to IT.',
      goals: {
        pause: '“Ira” got a reply with a pause and a check',
        verified: 'Ira was called on the number from the directory',
        forwarded: 'The chat is forwarded to the real Ira',
      },
      hints: [
        'A new number, an urgent request, “no need to call” — a familiar set of levers.',
        'Call not the number from the message but the one in the directory. Then forward the chat to IT.',
        "Send the reply “Ira, I'll call you back on your work number…”, call Ira from the directory and press “Forward to IT”. The right place is outlined with a dashed line.",
      ],
      solvedNote:
        'Done: no program installed, and the real Ira knows and will warn the others.',
    },
    extension: {
      prompt:
        'Decline the extension that wants every site and remove the extra one among those installed.',
      goals: {
        declined: 'The spreadsheet helper with every site is not installed',
        cleaned: 'The old coupon extension is removed',
      },
      hints: [
        'Read the red permission lines.',
        'Spreadsheets do not need every site and what you copy. The coupons were installed for one purchase.',
        'Super Sheets Helper — “Cancel”, “Coupons & Deals 24/7” — “Remove”. The right button is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: the browser did not get a new spy and got rid of an old one.',
    },
    assistant: {
      prompt:
        'Give the assistant access without a password in the chat and revoke it after the work.',
      goals: {
        scoped: 'The assistant works with a read-only token for one section',
        revoked: 'The token is revoked after the work',
        clean: 'No passwords or tokens in the chat',
      },
      hints: [
        'The administrator password is not sent in the chat. The assistant gets access in the CRM settings.',
        'Token: read-only, the “Clients” section, 7 days. Save it in 1Password and give the assistant a link to the entry.',
        'In the CRM: “Read only”, a tick only at “Clients”, “7 days” → “Create token” → “Save to the password manager”. In the assistant chat — “Give a link to the password manager item”. When the list is ready, in the CRM — “Revoke”. The right place is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: the assistant built the list through a link to the token, the administrator password stayed in the vault, and the pass has already expired.',
    },
  },
} satisfies LessonTexts<typeof lesson>
