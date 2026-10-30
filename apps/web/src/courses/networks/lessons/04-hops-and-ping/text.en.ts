import type { LessonTexts } from '../../../../lesson/dsl'
import { echoMs, type default as lesson } from './lesson'

const ONLY_PING =
  'In this lesson the terminal has one command — ping. Type an address or a name after it, for example: ping 192.168.1.1'

export default {
  title: 'An envelope passes through several post offices',
  summary:
    'The way to a site is a chain of routers, and ping checks the connection. Find the stretch where the connection is lost.',
  labels: {
    phone: { name: 'Phone', note: 'in your hand' },
    laptop: { name: 'Laptop', note: 'on the desk' },
    printer: { name: 'Printer', note: 'on a cable to the router' },
    router: { name: 'Router', note: 'the post office of your home' },
    isp: {
      name: 'ISP router',
      note: 'way online',
    },
    core: {
      name: 'Core router',
      note: 'crossroads',
    },
    hosting: {
      name: 'Hosting router',
      note: 'site’s network',
    },
    dns: { name: 'DNS server', note: 'your provider’s directory' },
    shop: { name: 'Shop website', note: 'somewhere far away' },
  },
  steps: {
    chain: {
      title: 'Post office after post office',
      body: `In lesson 1 the internet was a cloud. Let’s open it. Inside are routers: post offices just like yours, only bigger. The first is the [[isp|ISP router]] (the router of your provider, the company you pay for the internet). Next come the [[core|core router]] (your provider’s hub) and the [[hosting|hosting router]] (the router of the network where the shop’s site lives).

No router knows the whole way to the site. Each one only knows which neighbour to hand the envelope to so that it gets closer to the addressee. One such handover, from a device to its neighbour, is called a **hop** (a “jump” of the envelope from one device to the next one). Press “Step” under the board: each press moves the envelope one hop.`,
    },
    ping: {
      title: 'Ping: “Hello, can you hear me?”',
      body: `How do you check that an envelope reaches the addressee? That is what **ping** is for (a connection check). It sends a short envelope “Are you there?” and waits for the reply “Here!”. Like on a bad phone line: “Hello, can you hear me?” — “I can!”

Ping is run in the terminal — a window where commands are typed as text. A sample output is next to the board. Each line means “the reply came back”, and time is how long the envelope took there and back, in ms (milliseconds). If there is no reply, ping prints Request timeout: the envelope got lost somewhere.

Press “Run”: the laptop will ask the site “Are you there?”.`,
      more: {
        title: 'More: what time means and why a site may stay silent',
        body: `time is how many ms the envelope took there and back. Your router at home answers in a few ms, a site in another city in tens, one across the ocean in hundreds. If time grows and jumps around, the connection is overloaded.

Sometimes a site opens but does not answer ping. This is not a fault: some servers stay silent on ping on purpose. So silence in reply to ping is not a verdict yet: check the site itself in the browser too.

A real ping on macOS and Linux does not stop on its own: it keeps sending envelopes until you press Ctrl+C. Here it sends three and stops, like ping on Windows (which sends four).

The traceroute command shows all the post offices on the way at once. We will look at it in lesson 8.`,
      },
    },
    'next-hop': {
      title: 'Question: where next',
      body: 'An envelope from the laptop to the shop’s site has reached the [[isp|ISP router]] and stopped. Who will the ISP router hand it to next? Drag the envelope onto the next device or press that device.',
    },
    'find-break': {
      title: 'Task: where the connection is lost',
      body: `Yesterday the shop’s site opened on the laptop, but today it does not. The Wi-Fi is there. Find the stretch where the envelope gets lost, and fix the connection.

The laptop’s terminal has opened under the board. So far it has one command — ping. Check one by one: does your [[router|router]] answer (its IP address is 192.168.1.1), and does the site shop.example answer? Where the replies stop, there is the break.`,
    },
    summary: {
      title: 'Summary',
      body: `Press “Run” or “Step”: ping to the site and back, one hop per press.

- The way to a site is a chain of routers. Each one hands the envelope to the neighbour closer to the addressee. One such handover is a **hop**.
- **Ping** sends an envelope “Are you there?” and waits for the reply. The reply came — the connection to the addressee works.
- Check from the nearest stretch: first the router, then the site. Where the replies stop, there is the break.

Next, lesson 5: why the Wi-Fi is weak. In the kitchen the phone loses the network — we will see what walls and the two bands have to do with it.`,
    },
  },
  annotations: {
    echoTime: ({ doc }) => `there and back · ${echoMs(doc)} ms`,
  },
  quizzes: {
    'next-hop': {
      question:
        'The envelope is waiting at the ISP router. Who will the ISP router hand it to next?',
      wrong: {
        router:
          'The envelope has just come from there. It does not go back: every hop brings it closer to the addressee.',
        hosting:
          'The hosting router is closer to the site, but there is no direct cable to it from the ISP router. The envelope only goes to a neighbour, one hop at a time.',
        dns: 'The directory answers questions about names. This envelope is addressed to the shop’s site, so nobody will take it to the directory.',
      },
      tags: {
        router: 'does not go back',
        core: 'the next hop',
        hosting: 'not the provider’s neighbour',
        dns: 'not on the way',
      },
      explain:
        'The ISP router hands the envelope to its neighbour — the core router, through which the road to the site runs. Each router only knows the next step, and the whole way is made of such steps.',
    },
  },
  tasks: {
    'find-break': {
      prompt: 'Find where the connection is lost and fix it.',
      goals: {
        'site-opens': 'The shop’s site opens on the laptop',
        'ping-site': 'Ping to shop.example goes through',
      },
      hints: [
        'Check from the nearest stretch. Type ping 192.168.1.1: does your router answer?',
        'The router answers, but the site does not. So everything at home is fine, and the break is between the router and the internet. Look on the board at what connects the router and the ISP router.',
        'The provider’s cable has fallen out of the router. Plug it back in: press the unplugged cable. Then type ping shop.example again.',
      ],
      solvedNote:
        'The router answered, but the site did not — so the break was right behind the router. The provider’s cable is back in place, and ping to the site goes through again.',
    },
  },
  feedback: {
    GoalNotPerformed: () =>
      'The cable is in place. Check the connection: type ping shop.example once more.',
    UnknownCommand: () => ONLY_PING,
    CommandUsage: () => ONLY_PING,
    CommandLocked: ({ command }) =>
      command === 'traceroute'
        ? 'In this lesson the terminal has one command — ping. traceroute comes in lesson 8.'
        : ONLY_PING,
  },
  askAi: {
    lead: 'Before you ask an AI, check the connection with ping and attach the output:',
    template:
      'The site shop.example does not open, the Wi-Fi works. ping 192.168.1.1 (router) answers, time=6 ms. ping shop.example: Request timeout, 100% packet loss. Where should I look for the break?',
    note: 'Two ping outputs show the AI at once: everything at home is fine, the connection is lost behind the router.',
  },
} satisfies LessonTexts<typeof lesson>
