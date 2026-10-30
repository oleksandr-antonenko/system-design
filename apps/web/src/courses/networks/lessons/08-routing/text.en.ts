import type { LessonTexts } from '../../../../lesson/dsl'
import {
  PRINTER_IP,
  isHomeAddress,
  type default as lesson,
  networkPrefixOf,
} from './lesson'

export default {
  title: 'Routing and the gateway',
  summary:
    'Everything not addressed to your home a device hands to the gateway, and routers pass the envelope on by their tables. traceroute shows that way. Bring the internet back to a laptop with a wrong gateway.',
  labels: {
    phone: { name: 'Phone', note: 'in your hand' },
    laptop: { name: 'Laptop', note: 'on the desk' },
    printer: { name: 'Printer', note: 'on a cable to the router' },
    router: { name: 'Router', note: 'the post office of your home' },
    isp: { name: 'ISP router', note: 'way online' },
    core: { name: 'Core router', note: 'crossroads' },
    hosting: { name: 'Hosting router', note: 'site’s network' },
    dns: { name: 'DNS server', note: 'your provider’s directory' },
    shop: { name: 'Shop website', note: 'somewhere far away' },
  },
  steps: {
    gateway: {
      title: 'Your home and everything else',
      body: `The laptop sends an envelope. First it looks at the “to” IP address. If the address starts with 192.168.1., the addressee is a neighbour at home, for example the [[printer|printer]]. Then the laptop writes the printer’s MAC address on the outer envelope, and the router simply passes the envelope on within the home. If the address is anything else, the laptop writes the MAC address of the [[router|router]] itself on the outer envelope: “for the gateway”.

The **gateway** is the post office through which everything “not for our home” leaves. At home the gateway is your router, 192.168.1.1. You have already seen it in the phone’s network details: the “Router” field is the gateway. Every device at home must know this address, otherwise its envelopes will not get beyond the home.`,
    },
    'route-tables': {
      title: 'Each post office only knows the next step',
      body: `The router has received an envelope for the [[shop|shop’s site]], 198.51.100.10. It does not know the whole way. It has a routing table: “where to — whom to hand it to”. It has only two lines: addresses 192.168.1. — straight into the home (connected), everything else (default) — the [[isp|ISP router]]. The table is in the card of the [[router|router]].

Routers in the internet have more lines, but the rule is the same: find the line for the “to” address and hand the envelope to the next one. Like at a parcel sorting office: “north — into this bag, south — into that one, everything else — to the main post office”. Nobody knows the whole way, each one knows the next step.

Press “Run”: at every stop the table of the router holding the envelope is open, and the line it will send the envelope by is highlighted.`,
    },
    traceroute: {
      title: 'The whole way with one command',
      body: `Every envelope carries a counter: how many more post offices it may pass. Each router lowers it by one. When the counter reaches zero, the router throws the envelope away and sends the sender a short reply: “your envelope ran out here”. This way lost envelopes do not circle the network forever.

**traceroute** (it traces the route) makes use of this. It sends an envelope with the counter at 1 — the first post office answers. Then with the counter at 2 — the second one answers, and so on up to the site itself. As if you sent couriers with a different number of steps each, and each one called from where the steps ran out. Every line of the output is one post office: the hop number, the name, the IP address and three time measurements in ms. The laptop’s terminal now has this command.`,
      more: {
        title: 'More: subnet mask, TTL and silent routers',
        body: `How does the laptop decide that an address is “its own”? By the subnet mask. In the output of ip a it comes after the address: 192.168.1.42/24. /24 means “the first three numbers are the network number”: everything that starts with 192.168.1. is home. In the settings the same mask looks like 255.255.255.0.

The counter in the envelope is called TTL (time to live). The laptop sets 64, and each router subtracts one. Stars are not always a break: some routers do not answer traceroute but let the envelopes through. If lines appear again after the stars, the way is intact.

On Windows the command is called \`tracert\`. And a routing table can have more than two lines, for example “10.0.0.0/8 — via the office router”. Such a line is called a static route; you will meet it in the lesson about VPN.`,
      },
    },
    'where-it-breaks': {
      title: 'Question: where is the break',
      body: 'The shop’s site has stopped opening. The laptop has run traceroute, the output is on the board. Three post offices answered, then only stars: “no answer”. Press the last post office the envelopes still reach.',
    },
    'fix-gateway': {
      title: 'Task: bring the internet back to the laptop',
      body: `Someone once typed the laptop’s network settings in by hand, and since then sites do not open on it. Yet the printer prints. So envelopes travel within the home, but not beyond it.

Investigate in the laptop’s terminal and fix the settings in its network details: they open the same way as on the phone. The shop’s site lives at the IP address 198.51.100.10, you can see it in its card.`,
    },
    summary: {
      title: 'Summary',
      body: `The laptop’s envelope leaves the home again and reaches the shop’s site post office by post office.

- Everything not addressed to your home a device hands to the **gateway**. At home the gateway is the router, 192.168.1.1. It is written in the settings of every device, in the “Router” field.
- Routers pass the envelope on by their routing tables: each one only knows the next step.
- **traceroute** shows the post offices in order. The break is right after the last line where someone answered. If there is no answer already in the first line, the problem is in your home, often it is the gateway.

Next, lesson 9: why nobody outside can knock on your home’s door, and how to let a friend into your game anyway.`,
    },
  },
  annotations: {
    gatewayTag: () => 'gateway 192.168.1.1',
  },
  quizzes: {
    'where-it-breaks': {
      question:
        'Where does the way break? Press the last post office the envelopes still reach.',
      wrong: {
        router:
          'Your home router answered in the first line, and after it the envelopes went through two more post offices.',
        isp: 'The ISP router answered in the second line. The envelopes went past it and reached the next one.',
        hosting:
          'This is the first post office that stayed silent: line 4 is stars. We are looking for the last one that answered: the break is right behind it.',
        shop: 'The envelopes did not reach the site: the address 198.51.100.10 is not in the output.',
      },
      explain:
        'The last to answer was the core router, core.isp.example. So the envelopes reach it and get lost after it: the break is on the stretch between it and the hosting router. Your home and your router have nothing to do with it.',
    },
  },
  tasks: {
    'fix-gateway': {
      prompt:
        'Bring the internet back to the laptop: fix its network settings.',
      goals: {
        out: 'The laptop’s envelopes leave the home: ping 198.51.100.10 goes through',
        site: 'The shop’s site opens on the laptop',
        printer: 'The printer still answers',
      },
      hints: [
        'The printer works, but the internet does not. So everything inside the home is fine, and the envelopes “not for our home” do not reach the gateway. Whom does the laptop hand them to?',
        'Run `ping 192.168.1.1` — the router answers. Now `traceroute 198.51.100.10` — the very first line is the laptop itself with !H (“cannot reach”): no post office answered. Compare the “Router” field in the laptop’s network details with the IP address of your router.',
        'In the network details the field you need to fix is outlined. Type the IP address of your router from the board there and press “Save”.',
      ],
      solvedNote:
        'The laptop’s gateway is 192.168.1.1 again: envelopes “not for our home” leave through the router, and the site opens. The “Automatic” mode works too: then the router tells the device the gateway address itself.',
    },
  },
  feedback: {
    GatewayOutsideSubnet: ({ gateway }) =>
      `The gateway must be in your home, 192.168.1.something. The laptop cannot reach ${gateway} on its own: the router carries envelopes there.`,
    GatewayIsSelf: () =>
      'The laptop hands envelopes to itself. The gateway is the router, not the laptop.',
    GatewayNotARouter: ({ gateway }) =>
      gateway === PRINTER_IP
        ? 'The printer got the envelope for 198.51.100.10 and threw it away: it does not pass other devices’ envelopes on. Only a router can be the gateway.'
        : `The device at ${gateway} is not a router: it does not pass other devices’ envelopes on. Only a router can be the gateway.`,
    GatewayUnreachable: ({ gateway }) =>
      isHomeAddress(gateway)
        ? `The gateway ${gateway} does not answer: there is no such device at home. DNS has nothing to do with it: the envelopes do not leave the home at all.`
        : `The laptop has ended up in another network: ${networkPrefixOf(gateway)}… The printer and the router live in 192.168.1.…`,
    NoGateway: () =>
      'The laptop has no gateway: it does not know whom to hand envelopes “not for our home” to.',
  },
  askAi: {
    lead: 'When sites do not open but everything at home works, collect three outputs and ask like this:',
    template: `Sites do not open, but the printer at home prints.
System: macOS (or Windows, Linux).

IP address and gateway — the output of ip route (on Windows ipconfig):
<paste the output>

Does the router answer — the output of ping -c 3 <gateway address>:
<paste the output>

The way to the site — the output of traceroute <site> (on Windows tracert <site>):
<paste the output>

On which stretch does the way break, and what should I check?`,
  },
} satisfies LessonTexts<typeof lesson>
