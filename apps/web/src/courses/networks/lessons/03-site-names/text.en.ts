import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'A site’s name and its address',
  summary:
    'DNS turns a site’s name into an address, like the contacts on your phone. Fix a site that “won’t open”.',
  labels: {
    phone: { name: 'Phone', note: 'in your hand' },
    laptop: { name: 'Laptop', note: 'on the desk' },
    router: {
      name: 'Wi-Fi router',
      note: 'the post office of your home: hands out addresses and tells where the directory is',
    },
    internet: { name: 'Internet', note: 'many networks' },
    dns: {
      name: 'DNS server',
      note: 'your provider’s directory: tells the address for a site’s name',
    },
    shop: { name: 'Shop website', note: 'somewhere far away' },
  },
  steps: {
    names: {
      title: 'A name and a number',
      body: `In the browser you type shop.example, not 198.51.100.10. Names are handy for people. But the network needs a number: the “to” field on the envelope must hold an address. Press “Run” and look at the envelope to the [[shop|shop website]].

Your phone works the same way. You call “Mum” rather than dialling a number: the phone finds the number in its contacts by itself. For websites, such “contacts” are called **DNS**: by a site’s name, DNS finds its address.`,
    },
    'ask-first': {
      title: 'First, a question to the directory',
      body: `Where did the phone get the site’s number? Before the envelope to the site there was one more, and we haven’t shown it yet. The phone is opening shop.example for the first time, and its contacts are empty. So the first envelope goes to the [[dns|directory]] — the **DNS server**. Inside is a question: “What is the address of shop.example?”

The directory answers: “198.51.100.10”. The phone writes the answer into its [[phone|contacts]] (this is the DNS cache) and only then writes to the [[shop|site]]. Next time it won’t need to ask: the number is already saved. Press “Run”.`,
      more: {
        title: 'More: why the second time is faster',
        body: `The phone remembers the directory’s answers for a while, so the second time the site opens a little faster: there is no need to ask. But it doesn’t remember forever. Every answer has an expiry time, and after it the phone will ask again. If a site has moved to a new address, the old answer can still get in the way for a while.

You can ask the directory without a browser too: the command nslookup shop.example in the terminal. The terminal appears in lesson 4, and nslookup in lesson 10. There we will also see how to point your own site name (domain) at your server.

The directory doesn’t know everything by itself either. If it has no answer, it asks other directories along a chain. That is lesson 10 too.`,
      },
    },
    'who-first': {
      title: 'Question: who gets the first envelope',
      body: 'The phone is opening the shop website for the first time, and its contacts are empty. Who will it send the very first envelope to? Press the device on the board.',
    },
    'no-dns': {
      title: 'Task: the site can’t be found',
      body: `Wi-Fi works, but the shop website won’t open. The browser on the phone’s screen says “This site can’t be reached” and the code ERR_NAME_NOT_RESOLVED. That is the browser’s way of saying: “I couldn’t find out the address for the name”.

Find out whom the phone asks for addresses. Open the phone’s Wi-Fi settings and press “i” next to your network: the network details will open. Look at the DNS line.`,
    },
    summary: {
      title: 'Summary',
      body: `You have seen a name turn into an address.

- Names are handy for people; networks need addresses. **DNS** turns a site’s name into an address, the way the contacts on your phone turn “Mum” into a number.
- If the address isn’t in the contacts (the DNS cache), the phone asks the directory — the DNS server — and remembers the answer.
- The router tells the phone the directory’s address. If the phone has no one to ask, the browser says ERR_NAME_NOT_RESOLVED.

Next, lesson 4: an envelope passes through several post offices. We will find out how many post offices (routers) stand between you and the site and how to find the place where the connection was lost.`,
    },
  },
  annotations: {
    siteName: () => 'shop.example',
    notAsked: () => 'not asked: the address is already in the contacts',
  },
  quizzes: {
    'who-first': {
      question:
        'Who will the phone send the very first envelope to when it opens the shop website for the first time?',
      wrong: {
        router:
          'The envelope will pass through the router: it is the post office of your home. But the “to” field of the first envelope holds the directory.',
        shop: 'The phone doesn’t know the shop’s address yet: there is nothing to write in the “to” field. First it has to ask the directory.',
      },
      tags: {
        router: 'passes it on, not the addressee',
        dns: 'the first addressee',
        shop: 'address not known yet',
      },
      explain:
        'First the name turns into an address: the phone asks the directory, the DNS server. And only with the address in hand does it write to the site.',
    },
  },
  tasks: {
    'no-dns': {
      prompt: 'Make the shop website open on the phone.',
      goals: {
        'knows-dns': 'The phone knows whom to ask for addresses',
        resolves: 'The name shop.example turns into an address',
        opens: 'The shop website opened on the phone',
      },
      hints: [
        'ERR_NAME_NOT_RESOLVED means the phone couldn’t find out the address for the name. Whom does it ask for addresses? Look at the DNS line in the network details.',
        'The DNS line is empty, and next to it is “Manual”: the phone has no one to ask. Let the router tell it the directory’s address — just as it gives the phone its number.',
        'Press “Configure DNS”, choose “Automatic” and reload the page in the browser.',
      ],
      solvedNote:
        'The phone knows whom to ask for addresses again: the router tells it the directory’s address. The name turned into an address, and the page opened.',
    },
  },
  feedback: {
    NoDnsServer:
      'The phone has no one to ask for the address: the DNS line is empty.',
    InvalidIp:
      'The DNS line takes the directory’s address — four numbers, not a site name.',
    PortClosed: ({ device }) =>
      device === 'router'
        ? 'Simplified: this training router doesn’t answer questions about names itself; it only tells the phone the directory’s address. Many real routers can forward such questions. Choose “Automatic”.'
        : device === 'shop'
          ? 'This address belongs to the shop website, not the directory: it doesn’t answer questions about names. The simplest fix is to choose “Automatic”.'
          : 'No one at this address answers questions about names. The simplest fix is to choose “Automatic”.',
  },
  askAi: {
    lead: 'If a site “can’t be found”, attach the error code and the network details:',
    template:
      'My phone has Wi-Fi, but shop.example won’t open: the browser says ERR_NAME_NOT_RESOLVED. Network details: IP address 192.168.1.100, Router 192.168.1.1, DNS empty, set to manual. Other sites don’t open either. What should I check?',
    note: 'The error code tells the AI right away that it is not the Wi-Fi that broke, but turning the name into an address.',
  },
} satisfies LessonTexts<typeof lesson>
