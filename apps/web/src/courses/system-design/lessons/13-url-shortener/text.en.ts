import { Option } from 'effect'

import type { SimResult } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'
import { budget, reviewOf, serverCapacity } from './review'

const n = (value: number) => formatNumber('en', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} ms` })
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const usd = (value: number) => `$${value.toFixed(2)}`

export default {
  title: 'URL shortener. Final project',
  summary:
    'Design a whole system from scratch: requirements, estimates, API, then a design that holds the peak, survives failures and fits the budget.',
  steps: {
    requirements: {
      title: 'Requirements',
      body: `The final project: design a **URL shortener** like bit.ly from scratch. A user sends a long link and gets a short one, such as sho.rt/aZ3kP9x. Whoever opens the short link is redirected to the original.

Start by agreeing on what the system must do. **Functional requirements:** create a short link for a long one and redirect from the short link to the long one; nice to have, a custom alias and an expiry date. **Non-functional requirements** are the numbers we will check on the board:

**Load:** up to 2,000 rps at peak, mostly redirects. **Speed:** p95 no more than 150 ms, so a redirect feels instant. **Reliability:** the failure of any one load balancer, server or database costs no more than 1% of requests. **Budget:** no more than $4 an hour for the whole system.

For now the board holds only [[users|users]] and an empty [[db|database]]. Nobody answers, and errors are at 100%.`,
    },
    estimates: {
      title: 'Estimates',
      body: `Before drawing, estimate the numbers on the back of an envelope. In this course a server's requests are 80% reads and 20% writes, so at peak that is 1,600 redirects and 400 new links per second. For a shortener this is cautious: real services see dozens of clicks per link, so our write estimate is an upper bound. Clicks are also very uneven: a link in a viral post gets a million clicks an hour, while most links are hardly ever opened.

**Storage.** On average traffic is about a quarter of the peak: some 100 new links per second, 8.6 million a day, about 3 billion a year. A record (code, long URL, owner, dates, index) takes about 500 bytes, so the [[db|database]] grows by 1.6 TB a year. One database will carry the requests for a long time, but within a few years the data itself will need sharding (lesson 9).

**Code length.** Codes use 62 characters: a–z, A–Z and 0–9. Six characters give 62⁶ ≈ 57 billion codes, about 18 years at our rate; seven give 3.5 trillion. We take seven.

**Generating codes.** A hash of the long URL gives the same code for the same URL, but collisions have to be checked. A random code with a uniqueness check on insert is simple, and collisions are rare while the space is nearly empty. A counter written in base 62 never collides, but its codes are guessable, and a single counter is a bottleneck, so servers take ranges of a thousand numbers at a time.`,
    },
    api: {
      title: 'API and data model',
      body: `The API needs two calls.

**POST /api/links** with the long URL in the body, plus an optional alias and expiry date, creates a link and answers 201 with the code and the full short URL.

**GET /{code}** answers with a redirect: status 301 or 302 and the long URL in the Location header. An unknown code gets 404, an expired one 410. Browsers and CDNs remember a 301 (moved permanently): less load, but you lose click counts and can no longer change the target. With a 302 (found) every click comes back to you. Shorteners usually choose 302, or 301 with a short cache lifetime.

The data fits one table, **links**: code (the primary key), long_url, owner_id, created_at, expires_at. Every lookup goes by code, which is a key-value access pattern: a relational [[db|database]] with a primary key will do, and so will a key-value store.`,
    },
    design: {
      title: 'Task: the design',
      body: `Your turn. The palette holds every block from the course: CDN, load balancer, server, cache and read replica. The [[db|database]] is already on the board, and one is enough for our writes.

The requirements have become the goals under the board. The budget is counted live; the rest is checked by simulation when you press Check. Do the sums before you draw: how many servers do 2,000 rps need, and what do they cost?`,
    },
    review: {
      title: 'Review',
      body: ({ sim, doc }) => {
        const review = reviewOf(sim, doc)
        const entry =
          review.edge > 0
            ? `The CDN answers ${n(review.edge)} rps at the edge in 12 ms, and only ${n(review.serverLoad)} rps reach your servers.`
            : `Every request reaches your servers: ${n(review.serverLoad)} rps.`
        const failover = Option.match(review.perServerAfterFailure, {
          onNone: () => '',
          onSome: share =>
            `If one of your ${n(review.servers)} servers fails, each of the others gets ${n(share)} of ${n(serverCapacity)} rps.${
              share / serverCapacity > 0.8
                ? ' No errors, but at that load requests queue up and p95 soars. One more server costs $0.40 an hour and would keep the failover fast too.'
                : ' That leaves headroom, so even the failover stays fast.'
            } `,
        })
        const entrance =
          review.balancers > 1
            ? `With ${n(review.balancers)} load balancers, the entrance has a spare too. `
            : review.balancers === 0
              ? 'There is no load balancer: the CDN spreads requests across the servers itself and skips dead ones. '
              : ''
        const data =
          review.replicas > 0
            ? 'If the [[db|database]] fails, the read replica is promoted and takes the writes; with asynchronous replication the last few writes may be lost (lesson 11).'
            : ''
        const cache =
          review.caches > 0
            ? `The cache answers 80% of reads, so the [[db|database]] sees only ${n(incoming(sim, 'db'))} rps.`
            : `A cache for $0.15 would answer 80% of reads and take most of the ${n(incoming(sim, 'db'))} rps off the [[db|database]]: cheap room to grow.`
        const busiest = Option.match(review.busiest, {
          onNone: () => '',
          onSome: ({ id, utilization }) =>
            ` The busiest block is [[${id}|${id}]] at ${percent(utilization)}: when traffic grows, it hits its ceiling first.`,
        })
        return `Let's go through the requirements with the numbers from your board.

**Load.** At 2,000 rps errors are at ${percent(sim.errorRate)}. ${entry}

**Speed.** p95 is ${p95(sim)} against a target of 150 ms. The slowest requests are the ones that pass through a server: its latency grows with its load, so the target is met by keeping servers well below their limit.

**Failures.** ${failover}${entrance}${data}

**Budget.** ${usd(sim.costPerHour)} an hour out of ${usd(budget)}. ${cache}${busiest}`
      },
    },
    next: {
      title: 'What comes next',
      body: `The system works, but a real shortener soon gets new wishes.

**Analytics.** Owners want clicks by day, country and source. Do not write to the database on every redirect, or reads turn into writes. A server publishes a click event to an event bus (lesson 12), and workers update the counters in the background. Clicks the CDN answered never reach the servers, so they are counted from the CDN logs.

**Custom domains.** A company wants go.brand.com instead of sho.rt. That takes a table of domains and their owners, a TLS certificate for every domain, issued automatically, and lookups by the pair of domain and code.

**Abuse protection.** A short link hides where it leads, which attracts spam and phishing. Limit link creation per account and per IP with a rate limiter (lesson 8), check new URLs against blocklists, and be ready to block a link quickly, purging it from the CDN too.

That is the end of the course. You started with one server and finished with a system designed from requirements. The method works for any system: estimate the numbers, find the bottleneck, add a block and check what it costs.`,
    },
  },
  annotations: {
    noAnswer: sim => `${n(incoming(sim, 'users'))} rps · nobody answers`,
    storage: () => '≈1.6 TB a year',
    schema: () => 'links: code → long URL',
    userView: sim => `p95 ${p95(sim)} · errors ${percent(sim.errorRate)}`,
    dbLoad: sim => `${n(incoming(sim, 'db'))} of ${n(1500)} rps`,
  },
  tasks: {
    design: {
      prompt:
        'Design a URL shortener: 2,000 rps, p95 within 150 ms, survives any single failure, $4 an hour.',
      goals: {
        'holds-load': 'Handles 2,000 rps with less than 1% errors',
        fast: 'p95 is at most 150 ms at 2,000 rps',
        survives:
          'Survives the failure of any one load balancer, server or database with at most 1% errors',
        budget: 'Costs at most $4 an hour',
      },
      hints: [
        'Do the sums first. If every request reached the servers, 2,000 rps would need five servers plus a spare. That is $2.40, and with the database, a read replica and two load balancers you are already over budget. Most of the traffic has to be answered before it reaches the servers.',
        'Put a CDN at the entrance: it answers popular redirects at the edge, 60% of requests, so only 800 rps reach the servers. Behind it: two load balancers, three servers (two carry the load, the third is the spare) and a read replica. Link every server to both the database and the read replica, so the read replica can take over the writes.',
        'A dashed outline appeared on the board. Place the blocks there and draw the marked connections.',
      ],
      solvedNote:
        'The design meets every requirement: it holds the peak, answers fast, survives any single failure and fits the budget.',
    },
  },
} satisfies LessonTexts<typeof lesson>
