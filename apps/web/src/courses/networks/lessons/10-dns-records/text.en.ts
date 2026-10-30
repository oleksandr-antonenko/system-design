import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'DNS records. Your own domain for a site',
  summary:
    'A domain is pointed at a server with DNS records, and directories keep the old answer until its TTL runs out. Point your own domain at your own server.',
  labels: {
    phone: { name: 'Phone', note: 'in your hand' },
    laptop: { name: 'Laptop', note: 'on the desk' },
    router: { name: 'Router', note: 'your home post office' },
    internet: { name: 'Internet', note: 'many networks' },
    dns: { name: 'DNS server', note: 'your provider’s directory' },
    ns: {
      name: 'DNS provider',
      note: 'ns1.dns.example: keeps the DNS records',
    },
    vps: { name: 'VPS', note: 'your server for myapp.example' },
    parking: {
      name: 'Parking page',
      note: '“The domain myapp.example is registered”',
    },
    'friend-router': {
      name: 'Friend’s router',
      note: 'the post office of your friend’s home',
    },
    friend: { name: 'Friend’s laptop', note: 'your friend’s' },
    cf: { name: 'DNS server', note: 'your friend’s directory' },
    'zone:friend-router': { name: 'Friend’s home' },
  },
  steps: {
    'own-domain': {
      title: 'Your own domain',
      body: `You have launched an app on a [[vps|rented server]] with the address 198.51.100.20 (such a server is called a VPS) and bought a name for it, the domain myapp.example. Press “Run”: the name opens not your server but a [[parking|parking page]], “The domain is registered”.

The directories from lesson 3 (DNS server) learn the address from the [[ns|DNS provider]], the company that keeps the card of myapp.example. Each line on it is a **DNS record**: a name, a type and a value. Like the lines on a contact card: a number, a second number, a note. A DNS record of type A is an address. Right now the A of myapp.example leads to the parking page.`,
    },
    ttl: {
      title: 'The directory remembers the answer',
      body: `You have sent the link to your [[friend|friend]]. Press “Run”: their laptop asks its own directory, [[cf|1.1.1.1]]. The directory doesn’t know the answer, asks the DNS provider and remembers the answer together with a best-before time. This time is called **TTL** (time to live), and it is set in the DNS record itself: the parking page’s is 3600 seconds, that is, an hour.

Until the time runs out, the directory answers from memory (DNS cache) and doesn’t ask the DNS provider: that is faster. Like milk in the fridge: until it’s past its best-before date, nobody goes out for fresh milk. On the card of your friend’s directory there is a timer next to the answer: 60 minutes left.`,
      more: {
        title: 'More: how the directory finds the DNS provider',
        body: `On the board the directory knows straight away whom to ask. In reality it goes along a chain: first the root DNS servers (root servers: “.example is handled by these”), then the servers of the .example zone (“myapp.example is handled by ns1.dns.example”), and only then the DNS provider. It also remembers each answer for its TTL.

In the DNS world a directory is called a resolver, and its memory is the DNS cache. The DNS provider’s answer is marked “authoritative” (the aa flag in the dig output). nslookup honestly labels an answer from a directory’s memory: “Non-authoritative answer”.

Other common DNS records: AAAA is an IPv6 address, MX is where to deliver mail for myapp.example. Many services ask for a TXT to check that the domain is yours: hosting providers, mail services, search engines. A short output without details comes from dig +short myapp.example.`,
      },
    },
    'point-domain': {
      title: 'Task: point the domain at your server',
      body: `Open the DNS provider’s panel and point the domain at [[vps|your server]], 198.51.100.20. In panels the domain itself is marked with the @ sign.

You need DNS records of three types. An A at @ is the server’s address. A CNAME at www means “the same as myapp.example”: then www.myapp.example always leads to the same place, and when you move, the address is changed in one place. A TXT at @ with the text myapp-verify=4f9c2a: your server’s panel asks for it to make sure the domain is yours.

Then check the name in the laptop’s terminal: dig myapp.example or nslookup myapp.example. Both commands ask the directory and print its answer.`,
    },
    'friend-sees-old': {
      title: 'Question: why your friend sees the old site',
      body: 'Half an hour has passed. You have saved everything, and your dig shows 198.51.100.20. But your [[friend|friend]] writes: “I still get the parking page”. They even restarted their laptop. Where is the old address stuck? Press that device.',
    },
    summary: {
      title: 'Summary',
      body: `Another half an hour has passed: the old answer is past its best-before time, and the card of your friend’s directory marks it “expired”. Press “Run”: your friend’s directory asks the DNS provider again, and your friend reaches [[vps|your server]].

- A domain is pointed at a server with **DNS records** at the DNS provider: A is an address, CNAME is “the same as another name”, TXT is a note for checks.
- Directories remember an answer until its **TTL** runs out. If someone still sees the old address after a change, it isn’t an error, it’s waiting.
- Planning a move? A day before, lower the TTL to 300 seconds, that is, 5 minutes. To check a DNS record without anyone’s memory, ask the DNS provider itself: dig @ns1.dns.example myapp.example.

Next, lesson 11: the site opens by its name, but the browser says “Not secure”. We’ll see how HTTPS differs from a postcard and why a site needs a passport.`,
    },
  },
  annotations: {
    parked: () => '“The domain myapp.example is registered”',
  },
  quizzes: {
    'stale-where': {
      question:
        'Your friend still sees the parking page, although they restarted their laptop. Where is the old address stuck?',
      wrong: {
        friend:
          'Your friend restarted the laptop, so it has no memory of its own right now. It honestly asks the directory 1.1.1.1.',
        dns: 'This is your provider’s directory. It asked the DNS provider after the change and knows the new address. But your friend doesn’t use it.',
        ns: 'The DNS provider already has the new DNS record: you saved it, and your dig confirmed it.',
        vps: 'The server knows nothing about names. It waits for envelopes to its address, and your friend’s envelopes simply don’t reach it.',
      },
      tags: {
        friend: 'memory is empty',
        cf: 'remembers the parking page',
        dns: 'your friend doesn’t ask it',
        ns: 'already the new address',
        vps: 'envelopes don’t arrive',
      },
      explain:
        'The old address is stuck in the memory of the directory 1.1.1.1. Half an hour ago it asked the DNS provider and remembered the answer for an hour: the parking page’s TTL is 3600 seconds. Until that time runs out, it answers from memory. In half an hour the timer reaches zero, and your friend will see your server.',
    },
  },
  tasks: {
    'point-domain': {
      prompt:
        'Point myapp.example at your server and check the name in the terminal.',
      goals: {
        'a-record': 'myapp.example leads to your server 198.51.100.20',
        'www-cname': 'www.myapp.example is an alias of myapp.example (CNAME)',
        txt: 'There is a TXT to verify the domain',
        checked:
          'You checked the name with dig or nslookup and saw the new address',
      },
      hints: [
        'The domain’s address is kept at the DNS provider. Open the panel: what address is in the A line for @, that is, for the domain itself?',
        'In the A line at @, change the Value to 198.51.100.20. Add a CNAME line: Name www, Value myapp.example. Add a TXT line: Name @, Value myapp-verify=4f9c2a. Save and type dig myapp.example in the terminal. If it shows the old address, that is the directory’s memory: ask the DNS provider directly, dig @ns1.dns.example myapp.example.',
        'The right places in the panel are outlined with dashes: the value of the A and the new lines. The terminal suggests the command.',
      ],
      solvedNote:
        'myapp.example leads to your server, www.myapp.example leads to the same place, and the TXT confirms the domain is yours. The dig command showed the new address.',
    },
  },
  feedback: {
    SeveralAddresses: ({ name, ips }) =>
      `${name} has several addresses: ${ips.join(' and ')}. Directories will hand them out in turn, and some visitors will end up on the parking page. Delete the old A line.`,
    GoalResolvesElsewhere: ({ name, have, want }) =>
      `${name} leads to ${have}, but your server is ${want}.`,
    GoalNoRecord: ({ rtype }) =>
      rtype === 'CNAME'
        ? 'www has no CNAME yet. Make www an alias: a CNAME with the value myapp.example. Then the server’s address is written in one place, and nobody forgets to change it when you move.'
        : 'There is no TXT at @ yet: add a TXT line with the value myapp-verify=4f9c2a.',
    GoalRecordValue: ({ rtype, want }) =>
      rtype === 'TXT'
        ? `The TXT text doesn’t match: it must be ${want}.`
        : `The CNAME at www must point to ${want}.`,
    GoalCommandNotRun: () =>
      'Check the name in the laptop’s terminal: dig myapp.example or nslookup myapp.example. The ping command also finds out the address, but it doesn’t show where it came from or for how long.',
    GoalCommandSawOther: ({ saw }) =>
      saw.length === 0
        ? 'The command found no address for myapp.example. Check the A line at @ and ask again.'
        : `The command showed ${saw.join(', ')} from the memory of your provider’s directory: you asked before the change. Ask the DNS provider directly: dig @ns1.dns.example myapp.example.`,
  },
  askAi: {
    lead: 'If a domain “leads to the wrong place”, attach the DNS records and two dig outputs: through your own directory and from the DNS provider directly. They show whether it is an error or waiting for the TTL.',
    template: `I pointed the domain myapp.example at the server 198.51.100.20,
but some people still get the old site.

DNS records in the DNS provider’s panel (Type, Name, Value, TTL, one per line):
<…>

Output of dig myapp.example:
<paste the output>

Output of dig @<your DNS provider’s DNS server> myapp.example:
<paste the output>

I changed the DNS record at <time>. Is it an error in the DNS records or waiting for the TTL?
How much longer should I wait?`,
  },
} satisfies LessonTexts<typeof lesson>
