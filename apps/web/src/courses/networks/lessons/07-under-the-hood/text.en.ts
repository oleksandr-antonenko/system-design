import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Under the hood: an envelope in an envelope',
  summary:
    'The envelope from lesson 1 is really several nested envelopes: layers and MAC addresses. Take the envelope’s journey apart layer by layer.',
  labels: {
    phone: { name: 'Phone', note: 'in your hand' },
    laptop: { name: 'Laptop', note: 'where you build your site' },
    printer: { name: 'Printer', note: 'on a cable from the router' },
    router: { name: 'Wi-Fi router', note: 'the post office of your home' },
    internet: {
      name: 'Internet',
      note: 'behind the cloud, the chain of routers from lesson 4',
    },
    dns: { name: 'DNS server', note: 'your provider’s directory' },
    shop: { name: 'Shop website', note: 'somewhere far away' },
  },
  steps: {
    'open-envelope': {
      title: 'Let’s open the envelope',
      body: `For six lessons an envelope has flown across the board — in networking it is called a packet. First it carried names, then IP addresses and ports. In fact it is several envelopes, one inside another, like a nesting doll; in networking this is called encapsulation. Press “Run”: the envelope will stop at the [[router|router]]. Then click the envelope itself — it will open.

Each nested envelope has its own job. Such an envelope is called a **layer**. There are four: the link, the address, the port and the application.`,
    },
    'four-layers': {
      title: 'Four nested envelopes',
      body: `Let’s take the nesting doll apart from the inside. Press “Run”: the envelope will stop at the router again and open.

- [[env:application|HTTP]] — the application, the request itself: “send me the page”. The browser writes it.
- [[env:transport|TCP]] — the port, the flat number: 443, the website’s program on the server. That is lesson 6.
- [[env:internet|IP]] — the address: from the phone to the website. That is lesson 2.
- [[env:link|Frame]] (the outer envelope for one stretch of the way) — the link. It carries everything else only to the neighbouring device: from the phone to the router, over [[link:phone-router|Wi-Fi]].

Each layer does its own job and does not look into other envelopes. The router, for example, reads only the IP: it does not look at the request.`,
    },
    mac: {
      title: 'MAC address: the outer envelope changes',
      body: `The frame carries not IP but other addresses — **MAC addresses**. A MAC address is the factory number of the network card, like the serial number on a box. The router hands out the IP address, and it may change, but the MAC address stays with the device. Now you can see it in every device’s card.

A frame travels only to the neighbour. Press “Run”, and at the pause press “Step”: the envelope will move from the [[router|router]] into the [[internet|internet]]. The router takes off the old frame and puts on a new one: now it is Ethernet, the frame for the [[link:router-internet|cable]], and it carries new MAC addresses — from the router to the next neighbour. Like a parcel between warehouses: the address on the box stays the same, but a new waybill is stuck on for every stretch.

You will notice that the sender’s IP address and port changed too: the router signed the envelope with the address of the whole home. Why — in lesson 9. The “Step back” button takes the envelope one hop back, and “×¼” slows the flight down.`,
      more: {
        title:
          'More: the switch, finding a MAC address, handing out addresses and seven layers',
        body: `**Switch.** At the back of the router there are several sockets for cables — that is a built-in switch. It looks only at the frame: it remembers which MAC address is behind which socket and passes the envelope to the right socket. While it does not know, it passes it to all of them.

**How a MAC address is found.** The phone knows that the router’s IP address is 192.168.1.1, but the frame needs its MAC address. The phone asks the whole home: “Who has 192.168.1.1? Tell me your MAC address.” Only the router answers, and the phone remembers the answer. This is called ARP. On the laptop, the command arp -a shows what it remembers — it is now in the terminal. And the router shows everyone it knows in the “Devices” tab of its panel: name, IP address and MAC address.

**Handing out addresses step by step.** In lesson 2 the router gave the phone an IP address with two envelopes. In fact there are four: the phone asks everyone “who hands out addresses?”, the router offers an address, the phone asks for it, and the router confirms and also tells it the DNS server’s address. This is called DHCP.

**Seven layers or four.** Textbooks often draw seven layers (the OSI model). Our four are the TCP/IP model, and they map onto the seven like this:

- HTTP — the application layer (in OSI these are layers 7, 6 and 5);
- TCP — the transport layer (4);
- IP — the network layer (3);
- frame — the data link layer (2), and the wires and radio themselves — the physical layer (1).`,
      },
    },
    'which-layer': {
      title: 'Question: whose number is it',
      body: `The field 443 is highlighted in the envelope. Which layer does it belong to? Pick an answer under the envelope.`,
    },
    pack: {
      title: 'Task: pack the envelope',
      body: `The phone wants to open the [[shop|shop website]]. Pack an envelope for it: put the four layers one inside another in the right order, from the outermost to the innermost.

When you are done, press “Send”, and the envelope will fly across the board. If the order is wrong, even the first device on the way will not be able to read it.`,
    },
    summary: {
      title: 'Summary',
      body: `Press “Run”: the [[laptop|laptop]] opens the shop website for the first time, and the board shows the whole journey of the page, with all its envelopes. The colours are explained in the legend.

- An envelope is **layers** nested in one another: frame, IP, TCP, HTTP. Each has its own job.
- The outer frame travels to the neighbour and carries the **MAC addresses**. It is replaced at every hop.
- The recipient’s IP address, the port and the request reach the website unchanged.
- Look for a fault in order, from the outside in: is there Wi-Fi or a cable? Is there an IP address? Is the port open? Does the program answer?

Module 1 is done: you know how a home network works. Next is module 2, “The internet”: the gateway and traceroute, how a home goes online under one address, your own domain and HTTPS.`,
    },
  },
  annotations: {},
  quizzes: {
    'which-layer': {
      question: 'Field 443 — which layer is it from?',
      options: {
        'env:link': 'Frame · Wi-Fi or Ethernet',
        'env:internet': 'IP · the address',
        'env:transport': 'TCP or UDP · the port',
        'env:application': 'HTTP · the application',
      },
      wrong: {
        'env:link':
          'The frame holds only MAC addresses: from whom and to whom to pass it to the neighbouring device. There are no flat numbers there.',
        'env:internet':
          'IP holds the IP address: which device. And 443 is a flat in it, the website’s program.',
        'env:application':
          'HTTP is the request itself: “send me the page”. Which flat to take it to is told by the port in TCP.',
      },
      explain:
        '443 is a port, a flat number: the website’s program on the server. Ports live in TCP or UDP. Your dev server from lesson 6 lived in flat 5173 — in the same layer.',
    },
  },
  tasks: {
    pack: {
      prompt: 'Pack an envelope that will reach the shop website.',
      goals: {
        'router-reads':
          'The router read the IP address and passed the envelope on',
        'shop-gets': 'The shop website got the request and answered',
      },
      hints: [
        'Start from the outside. Which envelope is needed to pass everything to the neighbour, the router, over Wi-Fi?',
        'Outside is the frame (Wi-Fi / Ethernet), under it is IP: the router reads only these two to send the envelope on. Deeper is TCP with the port, and in the very middle is the request.',
        'The order from the outside in: Wi-Fi / Ethernet, IP, TCP, HTTP.',
      ],
      solvedNote:
        'The frame outside, IP inside it, TCP with the port deeper, the request in the middle. Every device on the way opens exactly as many layers as it needs.',
    },
  },
  feedback: {
    GoalNotPerformed: ({ at }) =>
      at === 'shop'
        ? 'The shop website got the envelope but could not tell which program to give it to: the flat number is hidden deeper than the request. TCP with the port goes before HTTP.'
        : 'The envelope has not reached the internet yet. Press “Send” and look on the board where it stopped and why.',
  },
  askAi: {
    lead: 'Describe a fault in order, from the outer layer to the inner one:',
    template:
      'My phone does not open my dev server. Wi-Fi: the phone is on the Router-7C21 network. IP address: the phone has 192.168.1.100, the laptop 192.168.1.42, ping from the laptop to the phone works. Port: at http://192.168.1.42:5173 the phone gets ERR_CONNECTION_REFUSED. Application: npm run dev prints only Local: http://localhost:5173/. What is wrong?',
    note: 'This way the AI sees which layers are already checked and where to look next.',
  },
} satisfies LessonTexts<typeof lesson>
