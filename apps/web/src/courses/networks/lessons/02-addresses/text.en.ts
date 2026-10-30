import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Everyone has an address',
  summary:
    'Every device on the network has its own address — an IP address — and the router hands it out. Find the laptop’s address and connect a printer.',
  labels: {
    phone: { name: 'Phone', note: 'in your hand' },
    laptop: { name: 'Laptop', note: 'on the desk' },
    router: {
      name: 'Router',
      note: 'your home post office: hands out addresses',
    },
    internet: { name: 'Internet', note: 'many networks' },
    shop: { name: 'Shop website', note: 'somewhere far away' },
    printer: { name: 'Printer', note: 'cable only, no Wi-Fi' },
  },
  steps: {
    'house-numbers': {
      title: 'A number on the envelope',
      body: `In lesson 1 the envelopes carried names: “from: phone”, “to: shop website”. But the router does not read names. A postman needs a house number, and a network needs a device number. That number is called an **IP address**.

Now each device has its address written under it. The [[phone|phone]] has 192.168.1.100, the [[laptop|laptop]] has 192.168.1.42, and the [[router|router]] itself has 192.168.1.1. An address is four numbers separated by dots. The [[shop|shop website]] has one too: 198.51.100.10. Press “Run”: the phone will send a photo to the laptop.`,
    },
    'router-gives': {
      title: 'The router hands out addresses',
      body: `Where did the phone get its address? The router gave it. When a device connects to Wi-Fi, it asks the whole house: “What will my number be?” The router finds a free number and answers: “Yours is 192.168.1.100.”

The router remembers which numbers are taken, so addresses never repeat within one house. Press “Run”: the phone will connect to Wi-Fi again and get an address.`,
      more: {
        title: 'More: why the neighbours have the same addresses',
        body: `Addresses like 192.168.… are home addresses. The same numbers are used in thousands of other flats: your neighbour may have their own 192.168.1.100 too. They do not get in each other’s way, because a home address only works inside its own house. How a house goes online with such addresses is the topic of lesson 9.

An address can change. The router hands out a number for a while and usually gives a familiar device the same one: it keeps 192.168.1.42 for the laptop. But if the router is restarted, the number may change. How to tie an address to a device for good is also shown in lesson 9.

Handing out addresses in networks is called **DHCP**. How it works step by step is the topic of lesson 7, “Under the hood”.`,
      },
    },
    'who-gave': {
      title: 'Question: who gave the address',
      body: 'The phone connected to Wi-Fi and got the address 192.168.1.100. Who gave it that address? Press the device on the board.',
    },
    'photo-and-printer': {
      title: 'Task: a photo and a printer',
      body: `First, send a photo from the phone to the laptop. For that you need the laptop’s address: press the [[laptop|laptop]] on the board, and its card opens. Then press the [[phone|phone]] and, in its card, under “Send a photo”, type that address.

Then connect the new [[printer|printer]]. It has no Wi-Fi, only a cable: run a cable from the printer to the router. The router will give the printer an address, and you will be able to print a document from the laptop.`,
    },
    summary: {
      title: 'Summary',
      body: `Now the envelopes carry addresses, not names. Press “Run”: the laptop will send the document to the printer once more.

- An **IP address** is a device’s number on the network, like a house number on an envelope. It is written as four numbers separated by dots: 192.168.1.42.
- The router hands out an address when a device connects and makes sure numbers never repeat.
- To send something to a device, you need its address. It is written in the device’s card.

Next, lesson 3: a website’s name and its address. You type shop.example in the browser, not 198.51.100.10. We will find out who turns a name into an address.`,
    },
  },
  annotations: {
    photoArrived: () => 'photo arrived',
    gotAddress: () => 'address from the router',
    printing: () => 'printing',
  },
  quizzes: {
    'who-gave': {
      question: 'Who gave the phone the address 192.168.1.100?',
      wrong: {
        laptop:
          'The laptop lives in the house just like the phone. It got its own address from the router and does not hand out numbers.',
        internet:
          'The internet knows nothing about your house. Home numbers are handed out by the router, and they only work inside the house.',
      },
      tags: {
        laptop: 'does not hand out numbers',
        router: 'gave the address',
        internet: 'knows nothing about your house',
      },
      explain:
        'The router is your home post office. It hands out numbers to everyone who connects and makes sure they never repeat.',
    },
  },
  tasks: {
    'photo-and-printer': {
      prompt: 'Send a photo to the laptop and connect the printer.',
      goals: {
        photo: 'The photo reached the laptop',
        'printer-address': 'The printer has an address',
        printed: 'The document is printed',
      },
      hints: [
        'A device’s address is written in its card. Press the laptop on the board and find the line with the address.',
        'Photo: in the phone’s card, under “Send a photo”, type the laptop’s address — all four numbers — and press “Send”. Printer: run a cable from the printer to the router, and the printer will get an address by itself. Its new address will appear in the printer’s card.',
        'The board shows a dashed cable from the printer to the router. In the phone’s and the laptop’s cards, the fields for the address are outlined.',
      ],
      solvedNote:
        'Every device in the house has its own address. The router gave the printer a free number, and the laptop found the printer by that number.',
    },
  },
  feedback: {
    GoalNotPerformed: ({ from }) =>
      from === 'phone'
        ? 'The photo has not reached the laptop yet. Check the address against the laptop’s card: you need all four numbers.'
        : 'The document has not reached the printer yet. The printer’s address is in the printer’s card.',
    NoLink:
      'The printer is not on the network yet: it has no address. First run a cable from the printer to the router.',
    NoDhcpServer:
      'The printer gets its address from your home router. Connect the printer to the router.',
    PortBusy: ({ device }) =>
      device === 'printer'
        ? 'The printer has one socket, and it is already taken. Press the old cable to unplug it, then connect the printer to the router.'
        : device === 'laptop' || device === 'phone'
          ? 'The laptop and the phone do not hand out addresses or pass on other people’s envelopes. Connect the printer to the router.'
          : 'The printer gets its address from your home router. Connect the printer to the router.',
  },
  askAi: {
    lead: 'When something does not work on your home network, start your question with the addresses. For example:',
    template:
      'The printer is connected to the router by cable; its address is 192.168.1.101. The laptop is on Wi-Fi with 192.168.1.42, and the router is 192.168.1.1. Printing from the laptop does not get through. What should I check?',
    note: 'From the addresses, the AI will see whether the devices are in the same house and who gave them their numbers.',
  },
} satisfies LessonTexts<typeof lesson>
