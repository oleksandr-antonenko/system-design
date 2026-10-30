import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('en', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`

export default {
  title: 'Load balancer. Sharing the load',
  summary:
    'Horizontal scaling: several servers behind one entry point, health checks and the N+1 rule.',
  steps: {
    'one-server': {
      title: 'One server',
      body: `An online shop starts simple. [[users|Users]] send requests to a single [[app1|application server]], which reads and writes data in the [[db|database]].

A size M server handles about **400 requests per second**, or rps. Right now 300 arrive. The load bar under the server is green, and every dot reaches its destination.`,
    },
    overload: {
      title: 'Sale day',
      body: `A sale begins and load jumps to **900 rps**. The [[app1|server]] manages its 400 requests and drops the rest. The red dots are users who got a 503 error.

Response time degrades well before load reaches 100%. Past 80% requests start waiting in a queue, and p95 (the time within which 95% of requests are answered) grows faster than load.`,
    },
    'scale-out': {
      title: 'Up or out',
      body: `You could buy a bigger server. That is **vertical scaling**. It is simple, but it has a ceiling, the price grows faster than the power, and the server stays a single point of failure.

The other way is **horizontal scaling**: run several identical servers. We added [[app2|app2]] and [[app3|app3]]. They are connected to the database but sit idle, because users only know the address of [[app1|app1]].`,
    },
    'place-lb': {
      title: 'Task: a load balancer',
      body: 'You need an intermediary with a single address that accepts every request and hands it to a server. That is a **load balancer**, and it is already in the palette to the left of the board.',
    },
    'server-down': {
      title: 'When a server fails',
      body: ({ sim, doc }) => {
        const alive = doc.nodes.filter(
          node =>
            node.kind === 'server' &&
            !doc.failed.includes(node.id) &&
            (sim.nodes[node.id]?.incoming ?? 0) > 0,
        )
        const share = alive.length > 0 ? sim.load / alive.length : 0
        return `The load balancer hands out requests **in turn** (round-robin): the first request goes to one server, the second to the next, and so on.

Now [[app2|app2]] is down. Every few seconds the load balancer polls the servers. That is a **health check**: a server that does not answer is taken out of rotation. The remaining servers take over its share, and each now gets ${n(share)} rps. ${share > 400 ? 'That is more than their 400 rps, so some requests are lost again.' : 'They cope, because you have a spare server.'}

Hence the **N+1** rule: you need enough servers to handle peak load even with one of them gone.`
      },
    },
    summary: {
      title: 'Summary',
      body: `Stateless servers plus a load balancer give you horizontal scaling. To handle more load, add another server behind the load balancer.

But every server talks to the same [[db|database]], and it becomes the next bottleneck. In lesson 4 we put a **cache** in front of it.`,
    },
  },
  annotations: {
    app1Load: sim => `${n(sim.nodes['app1']?.incoming ?? 0)} of 400 rps`,
    app1Overload: sim =>
      `load ${percent(sim.nodes['app1']?.utilization ?? 0)} · errors ${percent(sim.errorRate)}`,
    idle: () => '0 rps · idle',
    excluded: () => 'app2 not responding → removed',
    survivorLoad: sim =>
      `${n(sim.nodes['app1']?.incoming ?? 0)} rps · ${percent(sim.nodes['app1']?.utilization ?? 0)}`,
    databaseLoad: sim => `${n(sim.databaseLoad)} rps from all servers`,
  },
  tasks: {
    'place-lb': {
      prompt: 'Make every user request get spread across the three servers.',
      goals: {
        'lb-exists': 'There is a load balancer on the board',
        'lb-fans-out': 'The load balancer leads to three servers',
        'only-through-lb': 'Users go only through the load balancer',
        'holds-load': 'Handles 900 rps with less than 1% errors',
      },
      hints: [
        'Users should reach a single “entry point” into the system, not a server.',
        'Put a load balancer between the users and the servers. The old “Users → app1” connection has to go.',
        'A dashed outline appeared on the board. Place the load balancer there and draw the marked connections. The connection marked in red has to be deleted.',
      ],
      solvedNote:
        'Every request goes through the load balancer and no server is overloaded.',
    },
  },
} satisfies LessonTexts<typeof lesson>
