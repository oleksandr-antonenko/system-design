import { Option } from 'effect'

import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('en', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} ms` })
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const dropped = (sim: SimResult, id: string) => sim.nodes[id]?.dropped ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0
const { writeShare, cacheHitShare, cacheHitMs } = simulationRules
// Запись не кешируется: вся она идёт в базу, остальное в базе — чтения мимо кеша.
const writes = (sim: SimResult) =>
  Math.min(sim.databaseLoad, sim.load * writeShare)
const missedReads = (sim: SimResult) => sim.databaseLoad - writes(sim)
// Чтение в кеш: в cache-aside по связям сервер → кеш идёт ещё и заполнение.
const cacheReads = (sim: SimResult) => sim.load * (1 - writeShare)

const LOAD = 1600
const quizWrites = LOAD * writeShare
const quizReads = LOAD - quizWrites
const quizMisses = quizReads * (1 - cacheHitShare)

export default {
  title: 'Cache. Fast answers from memory',
  summary:
    'Cache-aside and read-through, hit rate and TTL: taking load off the database.',
  preview: {
    alt: 'Diagram: a cache next to the server answers most reads straight from memory, and only cache misses travel on to the lightly loaded database.',
  },
  steps: {
    'five-servers': {
      title: 'Five servers, one database',
      body: `The online shop from lesson 3 has grown. [[users|Users]] come through the [[lb|load balancer]] to five servers, from [[app1|app1]] to [[app5|app5]], and all of them work with one [[db|database]]. Right now 1,200 rps arrive.

Each server gets 240 rps, 60% of its capacity. The database has it harder: every request from every server ends up there, so it receives all 1,200 rps out of the 1,500 it can handle. That is 80%, the busiest block on the board. The labels on the connections say what flows: each server sends the database both reads and writes.`,
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

That memory is called a **cache**: a store that keeps data in RAM, such as Redis or Memcached. A read from the cache takes ${cacheHitMs} ms. If the cache knows the answer, that is a **cache hit**; if not, a **cache miss**, and the read has to go to the database. The share of reads the cache answers by itself is the **hit rate**; in this course it is ${percent(cacheHitShare)}.`,
    },
    'two-patterns': {
      title: 'Who reads the database on a miss',
      body: `A cache holds copies; the originals live in the [[db|database]]. On a miss someone has to fetch the value from the database and put it into the cache. There are two common answers, and they are drawn differently on the board.

**Cache-aside** (the cache sits to the side): the [[app3|server]] does everything itself. It asks the cache; on a miss it reads the database, answers the user and puts the value into the cache, so the next read is a hit. The cache knows nothing about the database. This is the most common pattern: Redis or Memcached next to the application, and the application code decides what to cache.

**Read-through** (reads go through the cache): the server only ever asks the cache. On a miss the cache reads the database by itself, keeps a copy and answers. That is how caching libraries and caching proxies in front of a database work: the application code is simpler, but the cache has to know how to reach the database.

Who goes to the database on a miss:
- cache-aside: the server. Connections: server → cache carries reads and fills, server → database carries writes and misses;
- read-through: the cache. Connections: server → cache carries reads, cache → database carries misses, server → database carries writes only.

Writes go to the database through the server in both patterns: the cache only speeds up reads.`,
    },
    'cache-aside': {
      title: 'Task: cache-aside',
      body: `Start with cache-aside. Put a cache next to the servers and connect every server to it: reads go there first. Keep every server’s connection to the [[db|database]]: writes and misses travel along it.

The cache itself does not get a connection to the database: the board will not even let you draw one, because in cache-aside the server reads the database. The cache is already in the palette. The tag on the block shows its mode.`,
    },
    'aside-result': {
      title: 'Cache-aside on the board',
      body: ({ sim }) =>
        `The [[db|database]] can breathe again: it now gets ${n(sim.databaseLoad)} rps instead of 1,600. Of those, ${n(writes(sim))} are writes: a cache does nothing for them. The other ${n(missedReads(sim))} are misses that the servers read from the database themselves. p95 has fallen to ${p95(sim)}.

Read the labels. Each server → [[cache-1|cache]] connection carries the reads (${n(cacheReads(sim))} rps across all servers) and, after every miss, a fill: the value the server has just read from the database. Each server → database connection carries writes and misses. Four reads out of five are hits and never reach the database.`,
    },
    'read-through': {
      title: 'Task: read-through',
      body: `Now switch the same board to read-through: from here on the servers only ask the [[cache-1|cache]], and on a miss the cache has to read the database itself. But it has no connection to the database, so its misses have nowhere to go: ${n(quizMisses)} rps are lost, ${percent(quizMisses / LOAD)} errors.

Give the cache its own way to the [[db|database]]. The servers keep their connections to the database: writes still go through them, while the misses move to the new connection.`,
    },
    compare: {
      title: 'Same load, different roles',
      body: ({ sim }) =>
        `The database gets ${n(sim.databaseLoad)} rps again, exactly as with cache-aside: writes plus misses. For the database the two patterns are the same. What differs is who knows the way to it.

In cache-aside the server knows both the cache and the database, and the cache is just a fast store next to it. In read-through the server knows only the cache, and the path to the database belongs to the cache.`,
    },
    'stale-data': {
      title: 'Stale data',
      body: `The price of a cache is **stale data**. A product’s price has changed in the database, but the [[cache-1|cache]] still hands out the old one, in either pattern.

One defense is a **TTL** (time to live): each key lives in the cache for, say, 60 seconds and then expires, and the next read is a miss that fetches a fresh value. The other is **invalidation**: when the server writes, it deletes the key from the cache right away. A TTL is simple but leaves a window of stale data; invalidation is precise but easy to forget in one of the places that write. They are usually combined.`,
    },
    'cache-down': {
      title: 'When the cache goes down',
      body: ({ sim }) =>
        `The [[cache-1|cache]] has gone down. ${
          sim.errorRate > 0.01
            ? `On the board the servers send their reads straight to the [[db|database]]. It gets ${n(sim.databaseLoad)} rps, and ${percent(sim.errorRate)} of requests are lost, just as before the cache.`
            : `On your board another cache has taken over the reads, so the [[db|database]] holds on with ${n(sim.databaseLoad)} rps. With a single cache it would be back to 1,600 rps and errors.`
        }

Falling back to the database is natural for cache-aside: for the server every read simply becomes a miss. With read-through it is extra code, a fallback path that the team has to write and test, or reads fail. Either way the cache holds nothing but copies, yet the system can no longer live without it. Even a restart hurts: the cache comes back empty, or **cold**, and for a while every read is a miss. That is why a cache runs on several nodes and is warmed up before it gets traffic, and why you should always know how much load the database would get without it.`,
    },
    summary: {
      title: 'Summary',
      body: ({ sim }) =>
        `The cache is back. It takes repeated reads off the database: with a hit rate of ${percent(cacheHitShare)}, only ${percent(1 - cacheHitShare)} of reads reach it. The database load has fallen from 1,600 to ${n(sim.databaseLoad)} rps, and the cache costs $0.15 an hour.

- Cache-aside: the server reads the database on a miss and fills the cache. The most common pattern, and it survives a cache outage on its own.
- Read-through: the cache reads the database on a miss. Simpler code in the application, but the cache needs its own connection to the database.

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
      `hits ${n(cacheReads(sim) * cacheHitShare)} of ${n(cacheReads(sim))} reads`,
    dbAfter: sim =>
      `writes ${n(writes(sim))} + misses ${n(missedReads(sim))} rps`,
    missesLost: sim =>
      dropped(sim, 'cache-1') >= 1
        ? `misses lost: ${n(dropped(sim, 'cache-1'))} rps`
        : 'misses reach the database',
    serversNext: sim =>
      `${n(incoming(sim, 'app3'))} of 400 rps · ${percent(utilization(sim, 'app3'))}`,
  },
  quizzes: {
    'db-after-cache': {
      question: `The cache answers ${percent(cacheHitShare)} of reads by itself. Once it is in place, how many requests per second reach the database at ${n(LOAD)} rps?`,
      options: {
        unchanged: `${n(LOAD)} rps, the same as now`,
        'all-reads': `${n(quizReads)} rps`,
        'writes-and-misses': `${n(quizWrites + quizMisses)} rps`,
        misses: `${n(quizMisses)} rps`,
      },
      wrong: {
        unchanged:
          'The cache takes the reads it knows the answer to, so noticeably less reaches the database.',
        'all-reads': `${n(quizReads)} is all the reads. But the cache serves ${percent(cacheHitShare)} of them itself; only the misses go on to the database.`,
        misses: `${n(quizMisses)} is just the misses. Writes go to the database past the cache: another ${n(quizWrites)} rps.`,
      },
      explain: `The database gets every write, ${percent(writeShare)} of ${n(LOAD)}, which is ${n(quizWrites)} rps, plus the cache misses: ${percent(1 - cacheHitShare)} of ${n(quizReads)} reads, which is ${n(quizMisses)} rps. That is ${n(quizWrites + quizMisses)} rps out of the 1,500 it can handle, so the database can breathe. Check it in the tasks.`,
    },
    'cache-down-pattern': {
      question:
        'The cache goes down. In which pattern does the application keep serving reads from the database without any extra code?',
      options: {
        'cache-aside': 'Cache-aside',
        'read-through': 'Read-through',
        both: 'Both: the database is still there',
        neither: 'Neither: reads fail until the cache is back',
      },
      wrong: {
        'read-through':
          'In read-through the server only knows the cache: the path to the database belongs to the cache. Without a separate fallback the reads fail.',
        both: 'The database is there, but in read-through the server has no path to it for reads: that path belongs to the cache.',
        neither:
          'In cache-aside the server reads the database on every miss anyway. With the cache down, every read is simply a miss.',
      },
      explain:
        'In cache-aside the server already reads the database on every miss, so a dead cache just turns every read into a miss: slower, and the database gets the full load, but reads are served. In read-through the server only talks to the cache, so the team has to write a fallback to the database, or reads fail. On this board the servers fall back by themselves, as if that fallback had been written.',
    },
  },
  tasks: {
    'cache-aside': {
      prompt:
        'Take the reads off the database with cache-aside: the servers ask the cache, and on a miss read the database themselves.',
      goals: {
        'cache-exists': 'There is a cache on the board',
        'servers-use-cache': 'The servers are connected to the cache',
        'no-cache-db':
          'The cache has no connection to the database: the servers read it on a miss',
        'db-relieved': 'The database is at most 45% busy at 1,600 rps',
        'holds-load': 'Handles 1,600 rps with less than 1% errors',
      },
      hints: [
        'Most database queries are repeated reads. Their answers can be kept closer, in fast memory, and the servers can ask it first.',
        'Place a cache and connect every one of the five servers to it. Do not delete the servers’ connections to the database: writes and misses go through them. The cache itself stays without a connection to the database.',
        'A dashed outline appeared on the board. Place the cache there and draw the marked connections: from each of the five servers to the cache.',
      ],
      solvedNote:
        'The cache now answers four reads out of five; the servers read the rest from the database and fill the cache.',
    },
    'read-through': {
      prompt:
        'In read-through the cache reads the database on a miss itself: give it a way to the database.',
      goals: {
        'cache-reads-db': 'The cache is connected to the database',
        'db-relieved': 'The database is at most 45% busy at 1,600 rps',
        'holds-load': 'Handles 1,600 rps with less than 1% errors',
      },
      hints: [
        'The misses are now the cache’s job, and the cache has nowhere to send them.',
        'Draw a connection from the cache to the database. The servers’ connections to the database stay: writes go through them.',
        'A dashed line appeared on the board: draw the connection from the cache to the database.',
      ],
      solvedNote:
        'The misses now travel from the cache to the database, and the servers send it only writes.',
    },
  },
} satisfies LessonTexts<typeof lesson>
