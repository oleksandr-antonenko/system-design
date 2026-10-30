import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'How a phone gets online',
  summary:
    'Devices at home talk through the router, and the internet is many networks joined together. Connect a phone to the home Wi-Fi.',
  labels: {
    phone: { name: 'Phone', note: 'in your hand' },
    laptop: { name: 'Laptop', note: 'on the desk' },
    router: { name: 'Wi-Fi router', note: 'your home post office' },
    internet: { name: 'Internet', note: 'the whole world' },
    shop: { name: 'Shop website', note: 'somewhere far away' },
  },
  steps: {
    'at-home': {
      title: 'What you have at home',
      body: `This is your flat. In it are a [[phone|phone]], a [[laptop|laptop]] and a little box with antennas — the [[router|Wi-Fi router]]. The wavy lines are Wi-Fi: a radio link, no wires.

Everything the devices send to each other — photos, messages, web pages — travels in envelopes. Each envelope says who it is from and who it is for.

Devices do not hand envelopes to each other directly: even a photo from the laptop to the phone goes through the router. The **router** is your home post office: it takes envelopes from every device and delivers them.

Press “Run” under the board.`,
    },
    'to-the-site': {
      title: 'An envelope to the website',
      body: `Let’s open the shop website on the phone. The phone puts a request into an envelope: “please send the page”. The envelope has only two fields: from and to.

The website does not live in your home, so the router does not deliver the envelope itself — it passes it on to the [[internet|internet]]. From there the envelope reaches the [[shop|shop website]], and the page comes back in a reply envelope the same way.`,
      more: {
        title: 'More: what an envelope really is',
        body: `The envelopes on the board are a simplification. In networking they are called **packets**. A packet is a small piece of data that says who it is from and who it is for.

The shop page does not fit into one packet: the website sends it in hundreds of packets, and the phone puts them back in order. Packets of the same page may even take different routes.

A real packet carries numbers instead of names — addresses; they are the topic of lesson 2. And the fact that a packet hides several more envelopes inside is what lesson 7, “Under the hood”, takes apart.`,
      },
    },
    'many-networks': {
      title: 'The internet is many networks',
      body: `Inside the cloud there is no single giant computer but thousands of networks like your home one, only bigger: the networks of the companies you pay for internet access, city networks, the shop’s network. Each is connected to its neighbours.

The **internet** is many networks connected to each other. An envelope is passed from network to network until it reaches the recipient, like a parcel going from one post office to the next. Press “Run”.`,
    },
    'way-out': {
      title: 'Question: the way out of the home',
      body: 'The phone sends an envelope to the shop website. Through which device does the envelope leave the home for the internet? Press it on the board.',
    },
    'join-wifi': {
      title: 'Task: connect the phone',
      body: `You have a new phone. It does not know the home Wi-Fi yet: there is no wavy line to the router, and envelopes from the phone go nowhere.

Connect it in the Wi-Fi settings on the phone screen. The name of your network and the password are written on the [[sticker|sticker]] on the router.`,
    },
    summary: {
      title: 'Summary',
      body: `You followed the whole path of the envelope: phone → router → internet → shop website and back.

- Devices at home talk through the **router**, your home post office.
- The **internet** is many networks connected to each other. The router is the door from your home to the internet.
- To get a phone online, you connect it to the router’s Wi-Fi: your own network and the password from the sticker.

Next, lesson 2: everyone has an address. Today the envelopes carried names, but a router does not read names. We will see which addresses real envelopes carry and who hands them out.`,
    },
  },
  annotations: {},
  quizzes: {
    'way-out': {
      question:
        'Through which device does the envelope leave the home for the internet?',
      wrong: {
        laptop:
          'The laptop is the phone’s neighbour at home. It sends its own envelopes through the router; other devices’ envelopes do not pass through it.',
        shop: 'The shop website is the recipient. The phone cannot reach it directly: first the envelope has to leave the home.',
      },
      tags: {
        laptop: 'does not carry other envelopes',
        router: 'the way out to the internet',
        shop: 'this is the recipient',
      },
      explain:
        'The router is your home’s door to the internet: every envelope leaves through it and comes back through it.',
    },
  },
  tasks: {
    'join-wifi': {
      prompt:
        'Connect the new phone to the home Wi-Fi. The network name and the password are on the router sticker.',
      goals: {
        wifi: 'The phone is on your router’s Wi-Fi',
        opens: 'The shop website opens on the phone',
      },
      hints: [
        'Where is the home Wi-Fi password usually written? Look at the router itself: press the sticker on the board.',
        'The sticker shows the network name. Find exactly the same name in the list: the neighbour’s network looks similar, but the digits differ.',
        'Press “Router-7C21”, type the password from the sticker and press “Join”. In the list this network has a dashed outline, and the sticker on the board blinks.',
      ],
      solvedNote:
        'The phone is on the home Wi-Fi: the wavy line to the router has appeared. Press “Run” — the envelope will reach the website and come back with the page.',
    },
  },
  feedback: {
    NoWifiProfile:
      'The phone does not know the home network yet: pick it in the Wi-Fi settings and type the password from the sticker.',
    WrongPassword:
      'The password did not fit. Check it against the sticker: every digit matters.',
    WrongSsid: ({ ssid }) =>
      ssid === 'Кафе Утро'
        ? 'This is the café’s open network: no password is needed, and any passer-by can join it. Envelopes would go through the café’s router, not yours. At home, pick your own network from the sticker.'
        : 'Is this really your network? Check the name against the sticker.',
  },
} satisfies LessonTexts<typeof lesson>
