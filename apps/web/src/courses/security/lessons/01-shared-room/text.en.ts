import { byProgress } from '../../../../kinds/scenario/dsl'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Wi-Fi. A shared room',
  summary:
    'Whoever is on your network is in your room. Guests get the guest network; on someone else’s network, VPN comes first.',
  preview: {
    alt: 'Illustration: an office Wi-Fi router on a shelf with a separate guest network card beside it, and a work laptop on the desk under an emerald shield.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Oleg' },
    courier: { name: 'Courier' },
    striped: { name: 'Stripes' },
    guest: { name: 'Guest' },
    client: { name: 'Client' },
    'vpn-profile': { name: 'Romashka' },
    contract: {
      name: 'Supply contract',
      note: 'Good afternoon! Here is the contract; I’d appreciate your signature by Friday. Marina',
    },
    'contract:file': { name: 'Contract_Lastochka.pdf' },
    'net:AIRPORT-FREE': {
      name: 'Airport Wi-Fi',
      note: 'Free internet for 2 hours. By pressing “Accept” you agree to the network’s terms of use.',
    },
    'net:AIRPORT-FREE-WiFi': {
      name: 'Free WiFi · sign in',
      note: 'To get free internet, sign in with your work email.',
    },
    'net:Lounge-Business': {
      name: 'Business lounge',
      note: 'This is the business lounge network. Its password is given at the lounge desk.',
    },
    'net:Galaxy A52': {
      name: 'Phone hotspot',
      note: 'This is someone’s phone sharing its internet. Only its owner knows the password.',
    },
  },
  steps: {
    office: {
      title: 'Wi-Fi is a shared room',
      body: `Office Wi-Fi is like a shared room. Everyone in it can see everyone else: colleagues’ laptops, the [[printer|printer]], [[nas|shared folders]], [[cam|cameras]]. Many of these devices trust anyone “inside” and never ask for a password.

Done reading? Press “Next”: the next frame opens together with its own text.`,
    },
    courier: {
      title: 'The courier asks for the password',
      body: `The Wi-Fi password is the key to this room. The courier “only needs to send a delivery note”, and saying no feels awkward: what’s the harm?

But once you say the password, the courier has a key too.`,
    },
    parking: {
      title: 'A week later',
      body: 'The Wi-Fi signal reaches the car park, and the password works until someone changes it. That usually takes months. The courier left long ago, but still has the key to the room.',
    },
    'guest-network': {
      title: 'Guests get the guest network',
      body: `That is why guests get a separate room: the **guest network**. It has internet, but no printer, no folders and no staff laptops in sight: there is a wall between the [[guest-net|guest]] and the [[office-net|office]] network.

The guest password is no loss: it changes often and is printed on a card with a QR code. Couriers, clients, contractors, a friend for an hour: guest network. Only staff know the office password, and IT changes it when someone leaves the company.`,
    },
    'client-wifi': {
      title: 'Question: the client needs Wi-Fi',
      body: 'A client has come to a meeting and wants to show a presentation from her laptop. Oleg knows the office network password, guest cards lie on the reception desk, and an open “Free_WiFi” shows in the list of networks. What should she get?',
    },
    cafe: {
      title: 'A café: a room full of strangers',
      body: `In a café, a hotel or an airport it is the other way round: now you are the guest in someone else’s room. Strangers share the network with you, and the network’s owner sees where your envelopes go.

Worse, a network called “Café” may have been switched on by the person at the next table: anyone can name a network anything.`,
    },
    vpn: {
      title: 'VPN is a closed pipe',
      body: `A **VPN** is a closed pipe from your laptop to the office. Your envelopes travel inside it, and the neighbour and the network owner see only the pipe.

The rule: on someone else’s network, VPN first, then work email, CRM and shared folders.`,
      more: {
        title: 'More: doesn’t the padlock in the browser protect me?',
        body: `**The padlock in the address bar** (HTTPS) encrypts what is on the page: the neighbour in the café can’t read your email. But the network owner still sees which sites you visit, can slip in a fake sign-in page, and some programs on your laptop talk to the internet without encryption. VPN covers all of that at once, and office systems often open only through it.

**A lookalike network.** Whoever runs a network names it. A neighbour can switch on “Café Morning” or “AIRPORT-FREE-WiFi” on a phone, and your laptop may join it by itself if it was once on a network with a similar name. So pick the network from the sign and turn off “join automatically” for networks that aren’t yours.

**VPN won’t connect?** Share the internet from your phone: that is a room of your own.`,
      },
    },
    airport: {
      title: 'Task: the airport',
      body: `Boarding is in 20 minutes, and the client needs the contract from your work email. The phone sees several networks.

Join the airport network (its name is on the [[sign|sign]] by the pillar; you can press the sign), turn on VPN, and only then open your mail.`,
    },
    summary: {
      title: 'Summary',
      body: `You have been through the whole story: the office, the courier, the guest network, the café and the airport.

- **Wi-Fi is a shared room:** whoever is on the network can see the printer, folders and laptops.
- The office network password is for staff only. Guests, couriers and clients get the **guest network**.
- On someone else’s network: the network from the sign, then **VPN**, then work.`,
    },
  },
  annotations: {
    'office.alt': () =>
      'A cutaway office under a big mint Wi-Fi dome: Marina’s and Oleg’s laptops, a printer, a shared storage box and a camera linked by dotted lines.',
    'office.narration': () =>
      'The Romashka office. Every device sits under one Wi-Fi dome.',
    'office.oleg': () => 'Handy: I print from my phone without getting up.',
    'office.printer': () => 'printer',
    'office.nas': () => 'shared folders',
    'office.cam': () => 'camera',
    'courier.alt': () =>
      'Stripes dressed as a courier: red cap, vest, stripes peeking out of the sleeves. He holds a phone out across the desk. Marina hesitates; there is a yellow sticky note on her monitor.',
    'courier.narration': () => 'Morning. A courier at the reception desk.',
    'courier.courier': () =>
      'Could I have the Wi-Fi password? I just need to send a delivery note.',
    'courier.marina': () => 'Well… what’s the harm?',
    'parking.alt': () =>
      'Evening. The Wi-Fi dome reaches past the office walls into the car park. Stripes sits in a car by the entrance with a laptop and fishes a folder and a printed page out of the office with a rod.',
    'parking.narration': () => 'A week later. The car park by the office.',
    'parking.striped': () =>
      'Nobody changed the password. What’s in the shared folders today?',
    'guest.alt': () =>
      'Two domes: a big mint one over the desks and a small peach one over the sofa by reception. A glass wall with a lock stands between them. Marina hands a guest a card with a QR code.',
    'guest.narration': () => 'The same office, now with a guest network.',
    'guest.officeNet': () => 'office network',
    'guest.guestNet': () => 'guest network',
    'guest.marina': () =>
      'Here is the guest Wi-Fi: point your camera at the code.',
    'guest.guest': () => 'It works, thanks!',
    'meeting.alt': () =>
      'A meeting room. A client in a turquoise coat holds up a phone with a Wi-Fi icon. Oleg, with a notebook and a mug, thinks about what to say.',
    'meeting.narration': () =>
      'The meeting room. The client brought a presentation.',
    'meeting.client': () =>
      'May I connect to your Wi-Fi? I’d like to show my presentation.',
    'cafe.alt': () =>
      'A café under one grey Wi-Fi dome. Transparent envelopes fly from Marina’s laptop to the router on the counter. At the next table, Stripes in an apron with a pocket router studies them through a magnifying glass.',
    'cafe.narration': () => 'Lunch in a café. One network for every customer.',
    'cafe.striped': () => 'Well, well. Email, CRM, shared folders…',
    'vpn.alt': () =>
      'The same café. A thick blue riveted pipe runs from Marina’s laptop through the wall to the distant office. Stripes holds his magnifying glass to the pipe, sees nothing and scratches his head.',
    'vpn.narration': () => 'The same café. Marina has turned on VPN.',
    'vpn.striped': () => 'Some kind of pipe. I can’t see a thing!',
    'vpn.marina': () => 'Now I can open my mail.',
    'airport.alt': () =>
      'An airport waiting area. Marina with her phone, icons of several Wi-Fi networks around her. A blue sign by a pillar. Opposite, Stripes in a sun hat and dark glasses with a pocket router on his suitcase.',
    'airport.narration': () => 'The airport. Boarding in 20 minutes.',
    'airport.sign': () =>
      'Airport Wi-Fi\nno password\nThe airport never asks for the login and password of your email or social media.',
    'airport.marina': doc =>
      byProgress(doc, {
        start: 'Can I send the client the contract in time?',
        twin: 'Odd: the airport network wants my email password?',
        leaked: 'Oops. That wasn’t the right network.',
        online: 'Same network as on the sign. Now VPN.',
        vpn: 'VPN is on. Now the mail.',
        sent: 'The contract is out. Time to board!',
      }),
    'airport.striped': doc =>
      byProgress(doc, {
        start: 'My Wi-Fi has the best signal around.',
        twin: 'Welcome to “free” Wi-Fi!',
        leaked: 'Your email password? Thank you!',
        online: 'Ugh, not my network…',
        vpn: 'That pipe again.',
        sent: 'That pipe again.',
      }),
    'summary.parking': () => 'The password works from the car park too',
    'summary.guest': () => 'Guests get the guest network',
    'summary.cafe': () => 'In a café you’re in someone else’s room',
    'summary.vpn': () => 'VPN is a closed pipe',
  },
  quizzes: {
    'client-wifi': {
      question: 'The client needs Wi-Fi. What should she get?',
      options: {
        'office-password':
          'The office network password: she is a client, not a courier off the street.',
        'guest-card': 'The guest network card with the QR code.',
        'open-network':
          'Point her to the open “Free_WiFi” in the list: no password needed.',
      },
      wrong: {
        'office-password':
          'A client is a guest too. With the office password her laptop ends up in the same room as your folders and printer, and the password leaves with her.',
        'open-network':
          'Nobody knows whose network that is. Anyone nearby can switch on an open network with any name, and its owner sees everything that passes through it.',
      },
      explain:
        'The guest network gives the client internet and nothing else: office devices can’t be seen from it, and the password on the card is no loss.',
    },
  },
  tasks: {
    airport: {
      prompt:
        'Send the contract from your work email without exposing yourself on a stranger’s network.',
      goals: {
        'on-sign-network': 'The phone is on the network from the sign',
        'vpn-on': 'VPN is on',
        sent: 'The contract was sent through VPN',
      },
      hints: [
        'Compare the network names with the sign by the pillar: press it on the frame. Every letter and hyphen matters.',
        'The airport network is open, without a padlock. The network with the strongest signal isn’t necessarily the real one: the lookalike sits right next to you, which is why it gets better reception.',
        'Join AIRPORT-FREE and accept the terms, turn on VPN on the home screen, then open Mail and send the contract. The place to press is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: the real airport network, VPN to the office, the contract with the client.',
    },
  },
} satisfies LessonTexts<typeof lesson>
