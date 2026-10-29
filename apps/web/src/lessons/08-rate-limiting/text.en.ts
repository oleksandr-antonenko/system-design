import { Option } from 'effect'

import type { SimResult } from '../../domain/simulate'
import { formatNumber } from '../../i18n/format'
import type { LessonTexts } from '../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('en', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} ms` })
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0

export default {
  title: 'Overload protection',
  summary:
    'A rate limiter in front of the load balancer: a fast 429 instead of overload, per-client limits, backpressure and retries without a storm.',
  steps: {
    'normal-day': {
      title: 'An ordinary day',
      body: `Back to the shop with three servers behind a load balancer. To keep the board simple, the cache, CDN and replicas from earlier lessons are left out.

[[users|Users]] reach the [[lb-1|load balancer]], and it spreads requests across [[app1|app1]], [[app2|app2]] and [[app3|app3]]. Each server handles 400 rps, so together they can take **1,200 rps**.

On an ordinary day 600 rps arrive. The servers are half busy, p95 is under 100 ms, and there are no errors.`,
    },
    spike: {
      title: 'A spike',
      body: `At 10 a.m. a sale starts. The link went out in a newsletter, and bots that snap up discounted goods have woken up too. Within a minute load jumps to **2,000 rps**, far more than the 1,200 the servers can take.

The load balancer does its job honestly and splits everything evenly: each server gets 667 rps, 167% of its capacity. All of them are overloaded at once. 40% of requests end with a 503 error, and the rest wait: p95 is close to a second and a half. Nobody is served well, neither the bots nor the buyers.`,
    },
    cascade: {
      title: 'A chain reaction',
      body: `Overload rarely stays at a steady 40%. A server at 167% runs out of memory and threads, its health checks time out, and the load balancer takes it out of rotation. Now [[app2|app2]] is gone, and its share falls on [[app1|app1]] and [[app3|app3]]: 1,000 rps each, two and a half times their capacity. They are next in line. This is a **cascading failure**: the failure of one block overloads the others.

Users make it worse. A page that takes a second and a half to load gets refreshed, and a mobile app retries after a timeout on its own. Every retry is a new request on top of the spike. Even after the rush dies down, the system may not recover by itself: restarted servers fall over again under the pile of retries.

The way out sounds odd: it is better to turn away some requests on purpose than to try to serve everyone and end up serving nobody.`,
    },
    'place-limiter': {
      title: 'Task: a rate limiter',
      body: `[[app2|app2]] has been restarted, but the spike goes on: 2,000 rps.

A **rate limiter** stands at the entrance and counts requests. It lets through no more than its limit and answers the rest right away with **429 Too Many Requests**. Such a refusal costs almost nothing: no server, no database, an answer within a millisecond. Dropping excess load on purpose is called **load shedding**.

Our limiter lets through 1,000 rps. That is less than the 1,200 the servers can take, so they keep some headroom and stay fast. It is already in the palette: place it between the users and the [[lb-1|load balancer]].`,
    },
    bots: {
      title: 'Who gets turned away',
      body: ({ sim }) =>
        `More bots join in, and load reaches **3,000 rps**. Compare this with the spike before the limiter: the servers still get ${n(incoming(sim, 'app2'))} rps each and are ${percent(utilization(sim, 'app2'))} busy, and p95 is still ${p95(sim)}. The extra traffic only added refusals: the Rejected instrument shows ${n(sim.rejected)} rps. Behind a limiter, the system behaves the same however large the spike. The limiter's own bar is full: of ${n(sim.load)} rps it lets through exactly its limit of ${n(1000)}. That is not a breakdown: turning away the excess is its job.

But one limit for everyone is a blunt tool. The limiter does not care whom it turns away, so a bot hitting the shop a thousand times a second takes the place of real buyers. That is why real limiters count requests **per client**: per IP address, account or API key. Each client gets its own budget, say 10 requests per second with short bursts of up to 20 (the **token bucket** algorithm). A buyer never notices the limit, while a bot gets a 429 for everything above its 10.

Our board has a single overall limit, and it protects the servers. A per-client limit protects fairness as well.`,
    },
    backpressure: {
      title: '429, 503 and retries',
      body: `A refusal should tell the client what to do next, and the status code matters. **429 Too Many Requests** means: you in particular are sending too much, slow down. **503 Service Unavailable** means: the server itself is overloaded or down, and it is not your fault. Both usually come with a **Retry-After** header saying how many seconds to wait before trying again.

A well-behaved client does not retry right away. After each refusal it waits longer (1 s, 2 s, 4 s and so on, an **exponential backoff**) and adds a random spread, **jitter**, so that thousands of clients do not come back in the same second. This is **backpressure**: the “slow down” signal travels back to whoever creates the load, and the sender listens.

On the board, the bots have run into their per-client limits and the buyers' apps are backing off. Load at the entrance has dropped to 1,500 rps, and the limiter turns away only 500. Without backoff, every refusal would come back as a new request, and the spike would only grow.`,
    },
    summary: {
      title: 'Summary',
      body: `The sale is over and load is back to 600 rps. The [[limiter-1|rate limiter]] lets everything through: on an ordinary day you cannot see it. It costs $0.05 an hour.

Compare it with the alternative, buying servers for the peak. To take 2,000 rps with headroom you would need seven servers instead of three, $2.80 an hour instead of $1.20, idle the rest of the time. And they would not save you anyway: the [[db|database]] takes 1,500 rps, and at 2,000 it starts losing requests itself. A limit protects not only the servers but every block behind them.

In practice the limiter lives in the **API gateway** or in the load balancer itself, and it works alongside autoscaling: autoscaling adds servers when load grows steadily, while the limiter takes the hit of sudden spikes and greedy clients. In lesson 9 we look at load that is not a spike but steady growth in writes that one database can no longer handle.`,
    },
  },
  annotations: {
    headroom: sim => `${n(sim.load)} rps · servers take ${n(1200)}`,
    overloaded: sim =>
      `${n(incoming(sim, 'app2'))} rps · ${percent(utilization(sim, 'app2'))} · errors ${percent(sim.errorRate)}`,
    crashed: sim => `crashed · errors ${percent(sim.errorRate)}`,
    survivor: sim =>
      `${n(incoming(sim, 'app1'))} rps · ${percent(utilization(sim, 'app1'))}`,
    rejecting: sim =>
      `lets in ${n(sim.load - sim.rejected)} · turns away ${n(sim.rejected)} rps`,
    steady: sim =>
      `${n(incoming(sim, 'app2'))} rps · ${percent(utilization(sim, 'app2'))} · p95 ${p95(sim)}`,
    backingOff: sim => `${n(sim.load)} rps · backing off`,
    limiterCost: sim => `turns away ${n(sim.rejected)} rps · $0.05/h`,
    databaseLimit: sim => `${n(sim.databaseLoad)} of ${n(1500)} rps`,
  },
  tasks: {
    'place-limiter': {
      prompt:
        'Protect the servers from the spike: let users in through a rate limiter so that the requests it admits are answered quickly.',
      goals: {
        'limiter-exists': 'There is a rate limiter on the board',
        'only-through-limiter':
          'Users reach the load balancer only through the limiter',
        'fast-answers': 'At 2,000 rps, p95 is at most 250 ms',
        'servers-headroom': 'At 2,000 rps, servers are at most 90% busy',
      },
      hints: [
        'The servers cannot take 2,000 rps. Something in front of them has to decide how many requests get in.',
        'Put the rate limiter between the users and the load balancer: Users → Rate limiter → Load balancer. Delete the direct “Users → Load balancer” connection, or half the traffic will bypass the limiter.',
        'A dashed outline appeared on the board. Place the rate limiter there and draw the marked connections. The connection marked in red has to be deleted.',
      ],
      solvedNote:
        'The limiter lets 1,000 rps through to the servers and turns the rest away at the entrance with a fast 429.',
    },
  },
} satisfies LessonTexts<typeof lesson>
