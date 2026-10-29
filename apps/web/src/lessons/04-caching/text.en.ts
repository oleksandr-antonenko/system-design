import { Option } from 'effect'

import { type SimResult, simulationRules } from '../../domain/simulate'
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
const { writeShare, cacheHitShare, cacheHitMs } = simulationRules
// Запись не кешируется: вся она идёт в базу, остальное в базе — чтения мимо кеша.
const writes = (sim: SimResult) =>
  Math.min(sim.databaseLoad, sim.load * writeShare)
const missedReads = (sim: SimResult) => sim.databaseLoad - writes(sim)

export default {
  title: 'Caching',
  summary: 'Cache-aside, hit rate and TTL: taking load off the database.',
  steps: {
    'five-servers': {
      title: 'Five servers, one database',
      body: `The online shop from lesson 3 has grown. [[users|Users]] come through the [[lb|load balancer]] to five servers, from [[app1|app1]] to [[app5|app5]], and all of them work with one [[db|database]]. Right now 1,200 rps arrive.

Each server gets 240 rps, 60% of its capacity. The database has it harder: every request from every server ends up there, so it receives all 1,200 rps out of the 1,500 it can handle. That is 80%, the busiest block on the board.`,
    },
    'db-overload': {
      title: 'The database chokes',
      body: `A holiday sale begins and load rises to **1,600 rps**. The servers cope: [[app3|each of them]] gets 320 rps, 80% of its capacity. But the [[db|database]] receives all 1,600 rps and handles only 1,500. The other 100 are lost: the red dots on the connections into the database, about 6% errors. The requests that do get through wait in a queue, and p95 has jumped past half a second.

A sixth server would not help. It would make life easier for the servers, but the database would still get the same 1,600 rps. The bottleneck now sits behind the servers.`,
    },
    'reads-and-writes': {
      title: 'Reads and writes',
      body: `Look at what the servers ask the database for. Most requests only **read**: open a product, show the catalog, check the stock. Only a few **write**: place an order, leave a review. In this course ${percent(1 - writeShare)} of requests are reads and ${percent(writeShare)} are writes, so 1,280 of the 1,600 rps are reads.

And reads repeat themselves. The home page and the hundred most popular products are opened by thousands of people, and every time the database looks up the same rows again. If you remember the answer to a popular query, you don’t have to ask the database twice.

That memory is called a **cache**: a store that keeps data in RAM, such as Redis or Memcached. A read from the cache takes ${cacheHitMs} ms. The share of reads the cache answers by itself is the **hit rate**; in this course it is ${percent(cacheHitShare)}. The other reads are **misses**, and they go on to the database.`,
    },
    'place-cache': {
      title: 'Task: a cache',
      body: `Put a cache between the servers and the [[db|database]]. The servers send their reads to the cache: it answers hits by itself and passes misses on to the database.

Keep every server’s own connection to the database: writes go only there. The cache holds copies, while the originals live in the database. The cache is already in the palette.`,
    },
    'stale-data': {
      title: 'Stale data',
      body: ({ sim }) =>
        `The [[db|database]] can breathe again: it now gets ${n(sim.databaseLoad)} rps instead of 1,600. Of those, ${n(writes(sim))} are writes. A cache does nothing for them: every write still goes to the database. The other ${n(missedReads(sim))} are reads that missed the cache. p95 has fallen to ${p95(sim)}.

How does data get into the cache? Usually the server takes care of it: it asks the cache first, and on a miss reads from the database and puts the answer into the cache. This is called **cache-aside**. On the board the [[cache-1|cache]] goes to the database by itself (read-through), but for the database it makes no difference.

The price of a cache is **stale data**. A product’s price has changed in the database, but the cache still hands out the old one. One defense is a **TTL** (time to live): each key lives in the cache for, say, 60 seconds and then expires, and the next read fetches a fresh value. The other is **invalidation**: when the server writes, it deletes the key from the cache right away. A TTL is simple but leaves a window of stale data; invalidation is precise but easy to forget in one of the places that write. They are usually combined.`,
    },
    'cache-down': {
      title: 'When the cache goes down',
      body: ({ sim }) =>
        `The [[cache-1|cache]] has gone down. ${
          sim.errorRate > 0.01
            ? `The servers send their reads straight to the [[db|database]] again. It gets ${n(sim.databaseLoad)} rps, and ${percent(sim.errorRate)} of requests are lost, just as before the cache.`
            : `On your board another cache has taken over the reads, so the [[db|database]] holds on with ${n(sim.databaseLoad)} rps. With a single cache it would be back to 1,600 rps and errors.`
        }

The cache holds nothing but copies, yet the system can no longer live without it. Even a restart hurts: the cache comes back empty, or **cold**, and for a while every read is a miss. That is why a cache runs on several nodes and is warmed up before it gets traffic, and why you should always know how much load the database would get without it.`,
    },
    summary: {
      title: 'Summary',
      body: ({ sim }) =>
        `The cache is back. It takes repeated reads off the database: with a hit rate of ${percent(cacheHitShare)}, only ${percent(1 - cacheHitShare)} of reads reach it. The database load has fallen from 1,600 to ${n(sim.databaseLoad)} rps, and the cache costs $0.15 an hour.

Cache what is read often and changes rarely. Give keys a TTL and delete them from the cache when the data changes. Remember that writes still go to the database, and that without the cache it is overloaded again.

Now the busiest blocks are the [[app3|servers]], at 80%. Much of their work is not shop logic at all: images, scripts and styles that are the same for every visitor. In lesson 5 a **CDN** takes them over.`,
    },
  },
  annotations: {
    dbLoad: sim => `${n(incoming(sim, 'db'))} of ${n(1500)} rps`,
    dbOverload: sim =>
      `load ${percent(utilization(sim, 'db'))} · errors ${percent(sim.errorRate)}`,
    serverCalm: sim => `${n(incoming(sim, 'app3'))} of 400 rps · coping`,
    readsWrites: sim =>
      `reads ${n(incoming(sim, 'db') * (1 - writeShare))} · writes ${n(incoming(sim, 'db') * writeShare)}`,
    cacheHits: sim =>
      `hits ${n(incoming(sim, 'cache-1') * cacheHitShare)} of ${n(incoming(sim, 'cache-1'))} rps`,
    dbAfter: sim =>
      `writes ${n(writes(sim))} + misses ${n(missedReads(sim))} rps`,
    serversNext: sim =>
      `${n(incoming(sim, 'app3'))} of 400 rps · ${percent(utilization(sim, 'app3'))}`,
  },
  tasks: {
    'place-cache': {
      prompt:
        'Take the reads off the database: put a cache between the servers and the database.',
      goals: {
        'cache-exists': 'There is a cache on the board',
        'servers-use-cache': 'The servers are connected to the cache',
        'cache-backed-by-db': 'The cache is connected to the database',
        'db-relieved': 'The database is at most 60% busy at 1,600 rps',
        'holds-load': 'Handles 1,600 rps with less than 1% errors',
      },
      hints: [
        'Most database queries are repeated reads. Their answers can be kept closer, in fast memory.',
        'Place a cache between the servers and the database. Connect every server to it, and connect the cache to the database for the misses. Do not delete the servers’ connections to the database: writes go through them.',
        'A dashed outline appeared on the board. Place the cache there and draw the marked connections: from each of the five servers to the cache and from the cache to the database.',
      ],
      solvedNote:
        'The cache now answers four reads out of five, and the database has room to spare.',
    },
  },
} satisfies LessonTexts<typeof lesson>
