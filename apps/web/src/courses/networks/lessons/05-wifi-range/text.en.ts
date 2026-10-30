import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Wi-Fi. Why the signal is weak',
  summary:
    'Range, walls and two bands: 2.4 and 5 GHz. Set up the Wi-Fi so it reaches the kitchen.',
  labels: {
    router: { name: 'Router', note: 'stands in the living room' },
    phone: { name: 'Phone', note: 'in your hand' },
    laptop: { name: 'Laptop', note: 'on the desk in the living room' },
    printer: { name: 'Printer', note: 'on a cable, no Wi-Fi needed' },
    bulb: {
      name: 'Smart bulb',
      note: 'a smart bulb in the kitchen: it only understands 2.4 GHz',
    },
    'zone:room': { name: 'Living room' },
    'zone:hall': { name: 'Hall' },
    'zone:kitchen': { name: 'Kitchen' },
  },
  steps: {
    'floor-plan': {
      title: 'Seen from above',
      body: `Let’s look at the flat from above, like a floor plan. The [[router|router]] stands in the living room. The circle around it shows how far the Wi-Fi reaches: inside the circle there is a connection, beyond its edge there is none.

Wi-Fi is radio. The farther from the router, the quieter its “voice”. Like talking: in the same room you hear well, from the other end of the flat badly. Press “Run”: the [[phone|phone]] will walk from the living room to the [[zone:kitchen|kitchen]].`,
    },
    walls: {
      title: 'Walls muffle the signal',
      body: `The signal gets weaker not only with distance but also behind walls. It passes through one wall, but quieter. Through two or three walls, brick, a mirrored wardrobe or an aquarium it may not get through at all. That is why the circle on the plan is not round: behind walls it shrinks.

There are two walls between the router and the kitchen. Look how few bars the [[phone|phone]] has in the kitchen.`,
    },
    'two-bands': {
      title: 'Two bands',
      body: `Home Wi-Fi has two bands: **2.4 GHz** and **5 GHz**. The router speaks on both at once, like a radio station on two wavelengths.

5 GHz is faster: films and big files load faster. But it goes through walls worse and reaches less far. 2.4 GHz is slower, but it reaches farther. Remember how you hear the bass of the neighbour’s speaker through the wall, but not the high notes? Wi-Fi is similar: 2.4 GHz is the bass.

Usually the router turns on both bands, and the phone picks by itself: close by it takes 5 GHz, farther away 2.4 GHz. Press “Run”.`,
      more: {
        title:
          'More: neighbours, channels, the password and where to put the router',
        body: `Why is the Wi-Fi slower in the evening? The 2.4 GHz band is split into channels, like a radio into stations. If the neighbour’s router speaks on the same or a nearby channel, they get in each other’s way, like two conversations in one room. Channels 1, 6 and 11 do not overlap, so routers usually pick one of them. 5 GHz has more channels, and neighbours get in the way less often.

The Wi-Fi password works through WPA2 security or the newer WPA3. If all your devices support WPA3, choose it. And the password 12345678 from this course is guessed in seconds: for a real network, make up a long one.

A guest network is a separate network with another password. Guests get the internet but do not see your printer and laptop.

Where to put the router: higher up and closer to the middle of the flat, not in a cupboard and not behind a mirror. If the flat is big, people add a second access point or a system of several routers (mesh).`,
      },
    },
    'who-drops': {
      title: 'Question: who is left without a network',
      body: 'Someone turned on only 5 GHz in the router: “it’s faster”. The phone is lying in the kitchen. Which device will not be able to join the Wi-Fi? Click it on the board.',
    },
    'kitchen-wifi': {
      title: 'Task: Wi-Fi in the kitchen',
      body: `Now let’s fix it. In the kitchen the phone has no network. A smart [[bulb|light bulb]] was bought for the kitchen too. It was already set up in its app: it knows the network name and the password. But it says “Network not found”: such bulbs only understand 2.4 GHz.

Under the board the router panel has opened — its settings. So far it has one tab, “Wi-Fi”. Set up the network so that both the phone and the bulb get a signal in the kitchen. The network must keep its password.`,
    },
    summary: {
      title: 'Summary',
      body: `- Wi-Fi is radio. The signal gets weaker with distance and behind every wall.
- The router has two bands. **5 GHz** is faster but reaches less far. **2.4 GHz** is slower, but it reaches farther and goes through walls.
- Turn on both: devices will pick by themselves. And some smart devices only understand 2.4 GHz.

Next, lesson 6, “Ports and localhost. Flats in one building”. We will start our own site on the laptop and open it from the phone.`,
    },
  },
  annotations: {
    behindWalls: () => 'two walls to the router',
    onBand24: () => '2.4 GHz in the kitchen',
    bulbOn: () => 'shining',
  },
  quizzes: {
    'who-drops': {
      question:
        'Only 5 GHz is on in the router. Which device will not be able to join the Wi-Fi?',
      explain:
        'The phone is in the kitchen, behind two walls. 5 GHz does not reach it, and 2.4 GHz is off. That is why both bands are turned on: devices close by take the fast 5 GHz, and distant ones take 2.4 GHz.',
      wrong: {
        laptop:
          'The laptop is in the living room, close to the router: 5 GHz reaches it. It will connect, and the connection will be fast.',
        printer:
          'The printer is connected by a cable. It does not need Wi-Fi, and the bands do not concern it.',
      },
      tags: {
        laptop: 'close, 5 GHz reaches',
        printer: 'on a cable',
        phone: '5 GHz does not reach',
      },
    },
  },
  tasks: {
    'kitchen-wifi': {
      prompt: 'Make the phone and the bulb get a signal in the kitchen.',
      goals: {
        phone: 'The phone in the kitchen is on the Wi-Fi',
        bulb: 'The bulb is on the Wi-Fi',
        password: 'The network still has a password',
      },
      hints: [
        'Look at the rings: which band reaches the kitchen? And which one does the bulb understand?',
        'Only 2.4 GHz reaches the kitchen, and the bulb only understands that one. Turn on 2.4 GHz, but do not turn off 5 GHz: let the laptop next to the router stay fast.',
        'In the “Wi-Fi” tab choose “2.4 and 5 GHz” and press “Save”. Do not change the SSID or the password.',
      ],
      solvedNote:
        '2.4 GHz now reaches the kitchen: the phone and the bulb are online. The laptop in the living room stayed on the fast 5 GHz.',
    },
  },
  feedback: {
    OutOfRange: '5 GHz does not reach the kitchen.',
    BandUnsupported: 'The bulb only understands 2.4 GHz, and it is off.',
    GoalWifiTooWeak:
      'The network is open to everyone. Bring back “With password”.',
    WrongSsid:
      'The phone, the laptop and the bulb remember the network “Router-7C21”. A network with a new name is a stranger to them: you would have to connect everyone again. Bring the name back.',
    WrongPassword:
      'All devices remember the password 12345678, with a new one they will not connect. Bring the old password back — or you would have to type the new one on every device.',
    WifiPasswordTooShort: 'A Wi-Fi password is at least 8 characters long.',
  },
  askAi: {
    lead: 'Ask about bad Wi-Fi with details: where the router is, where the device is, what is between them and which bands are on.',
    template:
      'The router is in the living room, the phone is in the kitchen, there are two walls between them. In the kitchen the Wi-Fi drops. Only 5 GHz is on in the router settings. A smart bulb says “Network not found”. What should I change?',
    note: 'Without the distance, the walls and the band, an AI can only guess.',
  },
} satisfies LessonTexts<typeof lesson>
