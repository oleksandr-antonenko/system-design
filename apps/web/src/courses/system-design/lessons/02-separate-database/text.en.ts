import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('en', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`

export default {
  title: 'Separate database. Data on its own machine',
  summary:
    'Why stateless servers scale more easily and where the data should live.',
  preview: {
    alt: 'Diagram: a stateless server keeps no data of its own and sends every read and write over one link to a separate database on its own machine.',
  },
  steps: {
    'all-in-one': {
      title: 'Everything on one server',
      body: `The online shop from the previous lesson runs on a single [[app1|server]]. [[users|Users]] sign in, fill their carts and place orders. Right now 300 rps arrive, and the server can handle 400.

All the shop’s data is kept on the server itself: accounts and orders sit in files on its disk, carts and sessions live in its memory. That is simple and fast, as long as there is one server and it works.`,
    },
    'server-fails': {
      title: 'The server goes down',
      body: `At night the [[app1|server]]’s disk fails. Every request ends in an error: the red dots are every user of the shop, and the Errors instrument shows 100%.

The data went down with the server. While it is being repaired, nobody can see any orders, and if the disk cannot be recovered, they are gone for good. Even a routine restart for an update wipes the carts and sessions held in memory.`,
    },
    'second-server': {
      title: 'A second server won’t help',
      body: `The server is repaired, and this time the data survived. To stop depending on one machine, you would like a second server, [[app2|app2]]. But it is empty: all orders and accounts sit on the disk of [[app1|app1]].

Suppose some users go to app2. Anna placed an order through app1, and her next request lands on app2. To app2 she is a stranger: the cart is empty, she has to sign in again, and her order is missing from the history. Copying every write between servers is hard, and the copies soon drift apart.

The data a server remembers between requests is called **state**. A server that holds state (stateful) cannot simply be swapped for another one or joined by a second copy.`,
    },
    'move-data': {
      title: 'Task: a separate database',
      body: `The way out is to move the state off the server into a separate store, a **database**. It becomes the one place where the data lives. On every request the server reads from and writes to the database and keeps nothing to itself. Such a server is called **stateless**.

The database is already in the palette to the left of the board.`,
    },
    'replace-server': {
      title: 'Servers become replaceable',
      body: `Another failure: [[app1|app1]] is down. But this time it took no orders with it, because the data lives in the [[db2|database]]. We connected [[app2|app2]] to the same database and pointed the [[users|users]] at it. Anna signs in and sees her order.

Stateless servers are interchangeable: any of them can handle any request, because everything it needs comes from the database. You can restart, update and add them without losing data. How to spread requests across several servers at once is the topic of lesson 3.`,
    },
    summary: {
      title: 'Summary',
      body: ({ sim }) =>
        `The state lives in the [[db2|database]], and the servers keep none of it. So you can replace a server or add another one, and the data does not suffer. [[app1|app1]] has been repaired and is now a ready spare: nothing needs to be copied onto it.

The solution has a price: every request from every server goes to the database. The Database load instrument shows ${n(sim.databaseLoad)} rps, exactly what [[app2|app2]] handles. One database copes with about **1,500 rps**, and once there are many servers it becomes the next bottleneck. In lesson 4 a **cache** will take load off it, and in lesson 6 **read replicas** will.`,
    },
  },
  annotations: {
    app1Data: sim => `${n(sim.nodes['app1']?.incoming ?? 0)} rps · data inside`,
    outage: sim => `errors ${percent(sim.errorRate)} · data unavailable`,
    app1Orders: sim =>
      `${n(sim.nodes['app1']?.incoming ?? 0)} rps · all orders here`,
    app2Empty: sim =>
      `${n(sim.nodes['app2']?.incoming ?? 0)} rps · no orders at all`,
    app2Serves: sim =>
      `${n(sim.nodes['app2']?.incoming ?? 0)} rps · orders intact`,
    spare: sim => `${n(sim.nodes['app1']?.incoming ?? 0)} rps · spare`,
    databaseLoad: sim => `${n(sim.databaseLoad)} of ${n(1500)} rps`,
  },
  tasks: {
    'move-data': {
      prompt:
        'Make the shop’s data live in a separate database instead of on the server.',
      goals: {
        'db-exists': 'There is a database on the board',
        'server-uses-db': 'The server is connected to the database',
        'holds-load': 'Handles 300 rps with less than 1% errors',
      },
      hints: [
        'The data needs a home outside the server, one the server turns to on every request.',
        'Place a database to the right of app1 and draw a connection from the server to the database. Once a database is on the board, a server without a link to it cannot answer a single request.',
        'A dashed outline appeared on the board. Place the database there and draw the marked connection from app1 to the database.',
      ],
      solvedNote:
        'The server reads and writes its data in the database and keeps nothing to itself.',
    },
  },
} satisfies LessonTexts<typeof lesson>
