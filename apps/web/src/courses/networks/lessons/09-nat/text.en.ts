import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'NAT and port forwarding',
  summary:
    'The whole home goes online under one router address — that is NAT. Let a friend into the game on your computer with port forwarding.',
  labels: {
    phone: { name: 'Phone', note: 'in your hand' },
    laptop: { name: 'Laptop', note: 'on the desk' },
    printer: { name: 'Printer', note: 'in the next room' },
    pc: { name: 'PC', note: 'gaming computer: the game and a database' },
    router: { name: 'Router', note: 'the post office of your home' },
    internet: { name: 'Internet', note: 'many networks' },
    dns: { name: 'DNS server', note: 'your provider’s directory' },
    shop: { name: 'Shop website', note: 'shop.example' },
    'friend-router': {
      name: 'Friend’s router',
      note: 'the post office of his home',
    },
    friend: { name: 'Friend’s PC', note: 'your friend plays on it' },
    'zone:friend-router': { name: 'Friend’s home' },
  },
  steps: {
    'home-only': {
      title: 'Home addresses are for home only',
      body: `On the right of the board is your friend’s home. Look at the IP address of his [[friend|computer]]: 192.168.1.100. Your [[phone|phone]] has exactly the same one. That is not a mistake: every home router hands out 192.168.… addresses, and they repeat in millions of homes. That is why they only work inside their own home.

Press “Run”: your friend sends an envelope to 192.168.1.42, your laptop’s address. The envelope does not even leave his home: to his computer this is the address of a neighbour in his own home, and there is no such neighbour there. From outside, your home is seen at one address — the outside address of your [[router|router]], 203.0.113.7.`,
    },
    nat: {
      title: 'The router puts on its own return address',
      body: `Then how does the laptop open websites? Press “Run”. The envelope goes to the [[shop|shop website]] with the laptop’s return address, 192.168.1.42. On the way out the [[router|router]] crosses it out and writes its own: 203.0.113.7. It also changes the flat number to a free one and writes it down in a table: “this flat is the laptop”. The website answers to the router’s address, and the router uses the table to take the answer to the laptop. The envelope will stop at the router and in the internet: compare the return address before and after.

This is **NAT** (Network Address Translation): the post office puts its own return address on the envelope and keeps a log of who sent what. That log is the NAT table, open in the router’s card. Remember lesson 3? Past the router, the phone’s envelope already showed 203.0.113.7, not its home address. Now you know why.`,
    },
    'no-way-in': {
      title: 'No way in without an invitation',
      body: `Your [[pc|gaming computer]] runs a Minecraft server — a program your friends connect to so you can play together. It waits for envelopes in flat 25565. Your friend knocks on your home’s address: 203.0.113.7, port 25565. Press “Run”. The [[router|router]] looks for a row in the NAT table, and there is none: nobody at home was expecting this envelope. The router silently throws the envelope away, and your friend’s game says “Connection timed out”.

This is protection: without an invitation nobody outside can reach your devices. To let your friend in, you set up **port forwarding** on the router — a rule “everything that arrives at my port 25565 goes to the gaming computer, port 25565”. Like a sign at the post office: “parcels marked 25565 go to the gaming computer”.`,
      more: {
        title: 'More: CGNAT, a party and extra doors',
        body: `Sometimes the provider adds its own NAT too: one outside address for many homes. This is called CGNAT. Then the outside address in the router panel starts with 100.64–100.127, and “what is my IP” sites show a completely different one. Port forwarding on your router will not help then: your friend’s envelope gets stuck at the provider. The way out is a tunnel or a mesh VPN (lessons 13 and 14), or a separate “public” address from the provider.

The router hands out addresses from a range, usually .100 to .199. If you shrink it to ten addresses, the eleventh guest at a party gets no address and stays without Wi-Fi. Reserved addresses are usually taken outside this range, like .50 in the task.

Every port forwarding rule is an open door: robots scan addresses around the clock and knock on well-known flats. Do not forward a database, remote desktop or SSH “just for now”. UPnP lets games open doors by themselves: handy, but then it is not only the game that opens doors.`,
      },
    },
    'what-site-sees': {
      title: 'Question: which address the website sees',
      body: 'The laptop opens the [[shop|shop website]]. Which return address will the website see on the envelope? Pick one.',
    },
    'let-friend-in': {
      title: 'Task: let your friend into the game',
      body: `Open the Minecraft server on your [[pc|gaming computer]] to your friend, and only that: the computer also runs your project’s database in flat 5432, and it must not be visible from outside.

First reserve the address 192.168.1.50 for the computer. The router hands out addresses, and after a restart it may give the computer another one — then port forwarding leads nowhere. The “Router” panel is open under the board: you reserve the address on the “Addresses” tab and set up port forwarding on the “Ports” tab.`,
    },
    summary: {
      title: 'Summary',
      body: `Your friend is in the game, and the database is not visible from outside. Press “Run”: your friend connects again, and the router follows the port forwarding rule and hands his envelope to the gaming computer.

- 192.168.… addresses only work inside the home: every home has its own.
- On the way out the router puts on its own return address — that is **NAT**. That is why websites see the router’s address, not the laptop’s.
- Nobody gets into the home from outside without an invitation. **Port forwarding** is an invitation for one device and only to the port it needs. That device’s address is reserved.
- Every port forwarding rule is an open door. Open only what you need and delete the rule when you no longer need it.

Next, lesson 10: how to point your own domain at your server and why your friend still sees the old site for an hour.`,
    },
  },
  annotations: {
    sameAsFriend: () => 'the same number as your friend’s',
    sameAsPhone: () => 'the same number as your phone’s',
    outside: () => 'outside: 203.0.113.7',
    timedOut: () => 'Connection timed out',
    gameServer: () => 'Minecraft server waits in 25565',
    friendPlays: () => 'your friend is in the game',
  },
  quizzes: {
    'what-site-sees': {
      question:
        'The laptop opens the shop website. Which return address will the website see on the envelope?',
      options: {
        '192.168.1.42': '192.168.1.42',
        '192.168.1.1': '192.168.1.1',
        '203.0.113.7': '203.0.113.7',
        '198.51.100.10': '198.51.100.10',
      },
      wrong: {
        '192.168.1.42':
          'That is the laptop’s address inside the home. On the way out the router replaced it with its own: home addresses are not carried across the internet.',
        '192.168.1.1':
          'That is the router’s address on the home side, for your devices. Towards the internet the router uses another address.',
        '198.51.100.10':
          'That is the website’s own address. It is in the “to” field, not in “from”.',
      },
      explain:
        'The website sees 203.0.113.7, the router’s outside address. All devices at home go online under this one address. That is why “what is my IP” sites show the router’s address, not the laptop’s.',
    },
  },
  tasks: {
    'let-friend-in': {
      prompt: 'Open the Minecraft server to your friend, and only that.',
      goals: {
        'pc-address': 'The gaming computer has the fixed address 192.168.1.50',
        'friend-in':
          'Your friend connects to the game: 203.0.113.7, port 25565',
        'only-game':
          'Only port 25565 is open from outside: the database and the rest are not visible',
      },
      hints: [
        'Your friend knocks on your router’s address, 203.0.113.7, port 25565. The router does not know yet whom at home to give such an envelope to, so it throws it away.',
        'First, on the “Addresses” tab, reserve 192.168.1.50 for the gaming computer: under “Reserved addresses” press “+ Add”, choose “PC” and type the address. Then add a rule on the “Ports” tab: “Protocol” TCP, “Outside port” 25565, “IP address at home” 192.168.1.50, “Inside port” 25565.',
        'The places you need are framed with a dashed line in the panel: the “Reserved addresses” list on the “Addresses” tab and the “Port forwarding” list on the “Ports” tab. Type the values yourself.',
      ],
      solvedNote:
        'Your friend is in the game, and the database is not visible from outside. The computer’s address is reserved: after a restart port forwarding still leads to it.',
    },
  },
  feedback: {
    GoalWrongAddress: ({ have, want }) =>
      `The gaming computer has ${have} now: the router lent it this address for a while. After a restart it may change, and port forwarding will lead nowhere. Reserve ${want} for the computer on the “Addresses” tab.`,
    NatNoMapping: ({ port }) =>
      `The router found no rule for TCP ${port} and silently threw your friend’s envelope away. The game connects over TCP to port ${port}: check “Protocol” and “Outside port” in the rule.`,
    ArpNoReply: ({ device, ip }) =>
      device === 'router'
        ? `Port forwarding leads to ${ip}, but nobody at home answers to that address. Reserve it for the gaming computer on the “Addresses” tab.`
        : `Nobody answered to the address ${ip}.`,
    PortClosed: ({ device, port }) =>
      device === 'laptop'
        ? `The envelope reached the laptop, but there is no Minecraft server on the laptop: port ${port} is closed. Port forwarding must lead to the gaming computer.`
        : `The envelope arrived, but nobody lives in flat ${port}. Port forwarding must lead to the gaming computer, flat 25565.`,
    GoalExtraOpenPort: ({ port }) =>
      port === 5432
        ? 'Port 5432 is visible from outside — that is your project’s database. Delete this rule.'
        : `Port ${port} is open from outside. The game needs only 25565.`,
    ReservationTaken: ({ ip }) =>
      `The address ${ip} is already reserved for another device. Take a free one, for example 192.168.1.50.`,
    ReservationOutsideSubnet: ({ ip }) =>
      `The address ${ip} is not from your home: you need 192.168.1.something.`,
    ForwardOutsideLan: ({ ip }) =>
      `Port forwarding leads to ${ip}, but it needs an address from your home: 192.168.1.something.`,
  },
  askAi: {
    lead: 'If port forwarding does not work, an AI helps faster when it sees the addresses and the whole rule:',
    template: `I want a friend to connect to a game on my computer (port 25565/TCP), but he gets Connection timed out.

The router’s outside address (from the router panel, “Status” or “WAN”): <…>
The address a “what is my IP” site shows: <…>
My computer’s IP address at home — output of ip a (on Windows, ipconfig):
<paste the output>

Port forwarding rule: protocol …, outside port …, IP address …, inside port …
The computer’s address is reserved on the router: yes / no.

What should I check next? If the router’s outside address and “my IP” differ, suggest a way without port forwarding.`,
    note: 'From the outside address and “my IP” the AI sees right away whether there is CGNAT, and from the rule — a typo in the port or the address.',
  },
} satisfies LessonTexts<typeof lesson>
