import { Option } from 'effect'

import type { SimResult } from '../../domain/simulate'
import { formatNumber } from '../../i18n/format'
import type { LessonTexts } from '../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('en', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} ms` })
const utilization = (sim: SimResult) => sim.nodes['app1']?.utilization ?? 0

export default {
  title: 'A single server',
  summary:
    'Requests and responses, RPS, latency, the capacity limit of one server and a single point of failure.',
  steps: {
    'no-answer': {
      title: 'Requests with no answer',
      body: `Next to this text is the **board** with a diagram of the system. The diagram is live: requests travel along the connections between blocks, and the instruments under the board measure what is going on. For now the board follows the text; in tasks it becomes yours.

Right now there is one **block** on it: [[users|users]]. These are the people who open your website. Every click in the browser sends a **request** over the internet, and the person waits for a **response**. The number of requests per second is called **load** and is measured in rps. Right now 100 rps arrive.

Nobody is there to answer, so every request is lost. The red dots under the block are lost requests, and the Errors instrument shows 100%.`,
    },
    'place-server': {
      title: 'Task: a server',
      body: `Requests will be answered by a **server**: a computer that runs your application's code. It accepts a request, does the work (finds a product, saves an order) and sends back a response.

Drag a server from the palette onto the board. Then connect the blocks: drag from the circle on the right edge of the [[users|Users]] block and release over the server. The arrow shows where requests go; the response travels back along the same connection.

When the diagram is ready, press Check. If you get stuck, the hints will help.`,
    },
    'reading-the-board': {
      title: 'Reading the board',
      body: ({ sim, doc }) => {
        const busy = doc.nodes.filter(
          node =>
            node.kind === 'server' && (sim.nodes[node.id]?.incoming ?? 0) > 0,
        )
        return `The site is growing: load is up to 200 rps. The green dots on the connection are requests the server has handled. The denser the flow, the more dots.

Under the [[app1|server]]'s name there are two numbers: how many requests reach it and what share of its **capacity** it uses. In this course a server handles about 400 rps, so 200 rps is 50%. The load bar at the bottom of the block shows the same share.

The instruments under the board describe the whole system. Load is how many requests arrive, Errors is the share of them that got lost. **p95** is the time within which 95% of requests get a response. An average hides slow responses, while p95 shows what almost every user sees. Cost is what an hour of all the blocks costs; a server is $0.40 an hour.${
          busy.length > 1
            ? `

Several of your servers receive traffic, so they share the load. The rest of the lesson is about a single server, so your numbers will look better than the ones in the text. How to spread requests across several servers is the topic of lesson 3.`
            : ''
        }`
      },
    },
    'near-limit': {
      title: 'Close to the limit',
      body: `Load has grown to 360 rps. No errors yet: the [[app1|server]] is 90% busy and keeps up. But look at p95: compared with the previous step it has grown several times over, although load has not even doubled. The dots on the connection have turned amber: the block is close to its limit.

Requests arrive unevenly. While the server is busy with one, the next one waits in a **queue**. At 50% load a queue rarely forms; at 90% almost every request waits behind another. That is why latency grows long before 100%, and servers are run with **headroom**: at peak, load usually stays below 70–80%.`,
    },
    overload: {
      title: 'Overload',
      body: `An ad campaign starts and load jumps to **600 rps**. The [[app1|server]] handles its 400 requests per second and drops the other 200: those users get a 503 (Service Unavailable) error. The red dots on the connection and under the server are lost requests, a third of the total.

The lucky ones wait more than a second for a response, because the queue is full. For a user that is almost as bad as an error.`,
    },
    'single-point': {
      title: 'Single point of failure',
      body: `The campaign is over and load is back to 200 rps. But a server can fail without any overload: a disk breaks, a new release has a bug, a reboot after an update. Now the [[app1|server]] is down, and the site answers nobody: errors are at 100%.

A block whose failure takes down the whole system is called a **single point of failure**. A lone server is exactly that: there is no spare.`,
    },
    summary: {
      title: 'Summary',
      body: `The server is back. You have built the simplest system there is: users send requests and a server answers them. Almost every project starts this way, and for a long time it is enough.

It has two limits. The first is a **capacity ceiling**: about 400 rps, and latency degrades even earlier. You could buy a bigger server, but it has a ceiling too, and the price grows faster than the power. The second is a **single point of failure**: when the server goes down, the whole site goes down.

Both problems go away with several servers instead of one. But right now the [[app1|server]] keeps the data (users, orders) on itself, and copies on several servers would drift apart. So in lesson 2 we move the data to a separate **database**, and in lesson 3 we put several servers behind a load balancer.`,
    },
  },
  annotations: {
    noAnswer: sim => `no answer · errors ${percent(sim.errorRate)}`,
    responseTime: sim => `p95 response ${p95(sim)}`,
    nearLimit: sim => `load ${percent(utilization(sim))} · p95 ${p95(sim)}`,
    overload: sim =>
      `load ${percent(utilization(sim))} · errors ${percent(sim.errorRate)}`,
    down: sim => `site down · errors ${percent(sim.errorRate)}`,
    ceiling: () => '400 rps ceiling · no spare',
  },
  tasks: {
    'place-server': {
      prompt: 'Put a server on the board and connect the users to it.',
      goals: {
        'server-exists': 'There is a server on the board',
        'users-connected': 'Users are connected to the server',
        answers: 'Answers 100 rps with less than 1% errors',
      },
      hints: [
        'User requests have to arrive somewhere. You need a block that answers them.',
        'Drag “Server” from the palette onto the board, then draw a connection from the circle on the right edge of the Users block to the server.',
        'A dashed outline appeared on the board. Place the server there and draw the marked connection from the users to the server.',
      ],
      solvedNote:
        'The server answers every user request, and the errors are gone.',
    },
  },
} satisfies LessonTexts<typeof lesson>
