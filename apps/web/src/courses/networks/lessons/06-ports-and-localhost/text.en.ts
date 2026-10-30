import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Ports and localhost. Flats in one building',
  summary:
    'One computer runs many programs, and each has its own number — a port. Open your dev server from your phone.',
  labels: {
    phone: { name: 'Phone', note: 'in your hand' },
    laptop: { name: 'Laptop', note: 'where you build your site' },
    printer: { name: 'Printer', note: 'on a cable to the router' },
    router: { name: 'Router', note: 'the post office of your home' },
    internet: { name: 'Internet', note: 'many networks' },
    dns: { name: 'DNS server', note: 'your provider’s directory' },
    shop: { name: 'Shop website', note: 'somewhere far away' },
  },
  steps: {
    apartments: {
      title: 'Flats in a building',
      body: `An address is a building number. But a building has many flats, and the postman also needs the flat number. A computer is the same: many programs run on it, and each needs its own envelopes. The program’s number is called a **port** — the flat number.

On the [[shop|shop server]] the website lives in flat 443. So the phone’s envelope now carries two numbers joined by a colon: the address and the port — 198.51.100.10:443. Press “Run”.`,
    },
    'dev-server': {
      title: 'Your own site on the laptop',
      body: `You and an AI are building your own website. To see how it looks, you run npm run dev in the [[laptop|laptop]]’s terminal. It starts a dev server — a program that shows your site while you are building it. It takes flat 5173 and tells you where to open it: http://localhost:5173.

**localhost** is a name that means “myself” on any device. It is like writing “to me” on an envelope: such an envelope never leaves. On the laptop, localhost:5173 is flat 5173 of the laptop itself. Press “Run”: the laptop’s browser will open the site.`,
    },
    'what-phone-sees': {
      title: 'Question: what will the phone show',
      body: `The dev server runs on the laptop and says: Local: http://localhost:5173/. You type the same address into the [[phone|phone]]’s browser. What will the phone show? Pick a screen.`,
    },
    door: {
      title: 'The door opens only from inside',
      body: `So the phone needs the laptop’s real address — 192.168.1.42, from lesson 2. But even at 192.168.1.42:5173 the phone is refused. Press “Run”.

By default a dev server opens its door only from inside: only the [[laptop|laptop]] itself may come in. This is for safety: while you build the site, your Wi-Fi neighbours have no reason to see it. To let the phone in, you start the server with the --host flag — “open the door to everyone on the home network”.`,
      more: {
        title: 'More: 127.0.0.1, 0.0.0.0 and well-known numbers',
        body: `localhost has an address — 127.0.0.1. You can see it in the output of ip a, on the lo0 line: it is a “loop” inside the device, and an envelope on it goes nowhere.

When a server listens on 127.0.0.1, it is open only from inside. The --host flag makes it listen on 0.0.0.0 — “on all of the laptop’s addresses”, including 192.168.1.42. It is still invisible from the internet: home addresses only work inside the home (lesson 9).

Well-known flat numbers: 80 — websites without encryption (http), 443 — websites with encryption (https), 22 — remote login (ssh), 5432 — the PostgreSQL database. Dev servers like 3000, 5173 and 8080.

Envelopes come in two kinds. TCP is an envelope with a delivery receipt: the recipient confirms that everything arrived. UDP is a postcard with no receipt: sent and not waited for. Websites use TCP; questions to the directory usually go over UDP.

If the phone still cannot open the site although the server runs with --host, the laptop’s firewall may be holding the door. That is lesson 12.

The /24 after the address in the ip a output is the size of the home network. That is lesson 8.`,
      },
    },
    'phone-dev': {
      title: 'Task: the site on the phone',
      body: `Show your site on the phone. Right now the dev server is open only to the laptop itself, and the phone is refused.

In the laptop’s terminal, restart the server so that it opens the door to the home network. The server runs in the terminal and holds it; you stop it with Ctrl+C. Then type the laptop’s address with the flat number into the phone’s browser.`,
    },
    summary: {
      title: 'Summary',
      body: `Your site opened on the phone. Press “Run”: the phone will open it again.

- A **port** is a flat number: the address leads to a device, the port to a program on it. They are written with a colon: 192.168.1.42:5173.
- **localhost** always means “myself”. On the phone, localhost leads to the phone, not to the laptop.
- By default a dev server lets in only the laptop itself. With --host it opens the door to the home network, and the phone comes in through the laptop’s address.

Next, lesson 7, “TCP/IP. An envelope in an envelope”. The envelope that has flown across the board for six lessons is really several envelopes, one inside another. We will see what each one is for.`,
    },
  },
  annotations: {
    door443: () => 'flat 443: the website',
    devOpened: () => 'the site opened on the laptop',
    phoneEmpty: () => 'nobody in 5173 on the phone',
    onlyInside: () => '5173 is open only from inside',
    devOnPhone: () => 'your site on the phone',
  },
  quizzes: {
    'phone-localhost': {
      question:
        'You type http://localhost:5173 on the phone. What will it show?',
      options: {
        page: 'Your site opened',
        refused: 'Connection refused',
        'not-found': 'Site not found',
        offline: 'No internet',
      },
      wrong: {
        page: 'The site lives on the laptop, but on the phone localhost means the phone itself. The phone knocks on its own flat 5173 — and nobody is there.',
        'not-found':
          'The phone knows the name localhost without any directory: it always means “myself”. It found the address — it is itself. The error will be a different one.',
        offline:
          'The phone has Wi-Fi, and the internet has nothing to do with it: the envelope does not even leave the phone.',
      },
      explain:
        'localhost always means “myself”. On the phone it is the phone itself, and nobody lives in its flat 5173. The phone knocks — the door is shut. That is ERR_CONNECTION_REFUSED: “the connection was refused”.',
    },
  },
  tasks: {
    'phone-dev': {
      prompt: 'Open your dev server from the phone.',
      goals: {
        listens: 'The server is open to the home network',
        'phone-opens': 'The site opened on the phone',
      },
      hints: [
        'At localhost the phone knocks on its own door. It needs the laptop’s address. And the server needs permission to let in guests from the home network.',
        'Stop the server: Ctrl+C. Start it again with the flag: npm run dev -- --host. The two dashes in the middle matter: that way the flag goes to the server, not to npm.',
        'In the Network line the server writes the address for the phone itself: http://192.168.1.42:5173. Type it into the phone’s browser.',
      ],
      solvedNote:
        'The site from the laptop opened on the phone. That is the main promise of the course: now you know why localhost does not work from the phone and what to do about it.',
    },
  },
  feedback: {
    GoalListeningOnWrongAddress: () =>
      'The server is still open only to the laptop itself: the Network line says “use --host”. Restart it with the two dashes: npm run dev -- --host. Without them npm keeps the flag and the server never gets it.',
    GoalNotListening: () =>
      'The dev server is not running. In the laptop’s terminal, start npm run dev -- --host.',
    GoalNotPerformed: () =>
      'The site has not opened on the phone yet. Type the laptop’s address with the flat number into the phone’s browser: 192.168.1.42:5173.',
    PortClosed: ({ device, port }) =>
      device === 'phone'
        ? 'This address leads into the phone itself: localhost and 192.168.1.100 are the phone. Nobody lives in its flat 5173. You need the laptop’s address — it is in the Network line or in the ip a output.'
        : port === 80
          ? 'Without a flat number the browser knocks on flat 80 — nobody is there. Add the port: :5173.'
          : `Nobody lives in flat ${port}. The dev server is in flat 5173.`,
    ListensOnlyOnLoopback: () =>
      'The address is right, but the server’s door is still open only to the laptop itself. Restart the server with --host.',
    TlsNotConfigured: () =>
      'The dev server works without encryption: the address starts with http://, not https://.',
  },
  askAi: {
    lead: 'When a site does not open from another device, attach the server output, the addresses and the error code:',
    template:
      'I run npm run dev on my laptop. Output: Local: http://localhost:5173/, Network: use --host to expose. The laptop’s address is 192.168.1.42 (from ip a). On my phone on the same Wi-Fi I open http://192.168.1.42:5173 — ERR_CONNECTION_REFUSED. What should I change?',
    note: 'From the Network line and the error code the AI will see right away that the server is open only to the laptop itself.',
  },
} satisfies LessonTexts<typeof lesson>
