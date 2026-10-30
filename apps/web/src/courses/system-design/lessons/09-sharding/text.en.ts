import { catalog } from '../../../../domain/catalog'
import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('en', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const capacity = catalog.db.capacity
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0
const edge = (sim: SimResult, from: string, to: string) =>
  sim.edges[`${from}>${to}`] ?? 0
const writesInto = (sim: SimResult, id: string) =>
  ['group1', 'group2', 'group3', 'group4'].reduce(
    (sum, group) => sum + edge(sim, group, id),
    0,
  )
const missesInto = (sim: SimResult, id: string) => edge(sim, 'cache-1', id)

export default {
  title: 'Sharding. Splitting the data',
  summary:
    'Splitting data across several databases: the shard key, hot shards, cross-shard queries and resharding.',
  steps: {
    'one-primary': {
      title: 'A marketplace on one database',
      body: ({ sim }) =>
        `The shop has become a marketplace with thousands of sellers, and load is now measured in thousands of rps. To fit the board, each server block in this lesson stands for a **group of six servers** behind its own load balancer: [[group1|group1]] to [[group4|group4]], 2,400 rps per group. [[users|Users]] are spread across the groups by DNS.

Reads go through the [[cache-1|cache]] from lesson 4: it answers ${percent(simulationRules.cacheHitShare)} of them itself, and only the misses reach the [[db|database]]. Writes cannot be cached: an order, a payment or a stock update has to be saved in the database.

The note above the database shows both streams. At ${n(sim.load)} rps it receives ${n(writesInto(sim, 'db'))} writes and only ${n(missesInto(sim, 'db'))} misses per second: writes are already the larger part.`,
    },
    'sale-day': {
      title: 'Sale day',
      body: ({ sim }) =>
        `A big sale begins, and load doubles to **${n(sim.load)} rps**. The server groups are only at ${percent(utilization(sim, 'group1'))}, and the cache barely notices. But the [[db|database]] receives ${n(incoming(sim, 'db'))} rps: ${n(writesInto(sim, 'db'))} writes and ${n(missesInto(sim, 'db'))} misses, far more than its ${n(capacity)}. Every second ${n(sim.nodes['db']?.dropped ?? 0)} requests are lost, and errors reach ${percent(sim.errorRate)}.

Both streams have doubled along with the load. And if the sale goes well, next year’s will be even bigger.`,
    },
    'replicas-wont-help': {
      title: 'Why read replicas won’t help',
      body: ({ sim }) =>
        `In lesson 6, read replicas rescued the database. Here they could take over only the cache misses. Writes still go to the primary, and every replica has to repeat them as well. Even with any number of replicas, the [[db|primary]] would be left with ${n(writesInto(sim, 'db'))} writes per second, ${percent(writesInto(sim, 'db') / capacity)} of its capacity, and no headroom for the next sale.

A bigger database buys a little time, but its ceiling is near, and the most powerful machines cost a fortune. One database simply cannot accept this many writes. So the data itself has to be **split**.`,
    },
    'split-data': {
      title: 'Task: shards',
      body: `**Sharding** splits the data across several independent databases called **shards**. Each shard stores only its part of the data, say half of the users with all their orders, carts and reviews, and receives the reads and writes for that part only.

Which shard holds a record is decided by the **shard key**, for example the user id. The server groups and the cache use the key to work out where each request should go, so each of them needs a connection to every shard. On the board, a block connected to several databases splits its writes or misses evenly between them, as if the key divided the users evenly.

The palette has a database: it will become the second shard.`,
    },
    'shard-key': {
      title: 'Choosing the shard key',
      body: `Now each user lives on one shard. The server takes a hash of the user id and the remainder of dividing it by two: one half of the users goes to [[db|db]], the other to [[db2|db2]]. All of a user’s data sits on one shard, so My orders or a checkout touches a single database.

A bad key creates a **hot shard**: one shard gets far more than its share and overloads while the others sit idle. Sharding by country puts most users on the shard of the largest country. Sharding by order date sends every new order to the newest shard. Even a good key can have a hot spot: a single record that everyone wants at once, such as the stock counter of a product that went viral.

The board splits the load evenly, as with a well-chosen key. In practice the key is chosen so that load spreads evenly and most queries need only one shard.`,
    },
    resharding: {
      title: 'Cross-shard queries and resharding',
      body: ({ sim }) =>
        `Some queries do not fit the key. A seller wants every order for their products, but those orders belong to buyers on every shard. Such a query has to ask **all shards** and merge the answers (scatter-gather), and it is only as fast as the slowest shard. Joins across shards are gone, and a transaction that touches two shards, such as moving money between two users, needs special protocols. Queries like these are usually served by a separate copy of the data organised by a different key, for example a search index.

A year later, load is ${n(sim.load)} rps. ${
          utilization(sim, 'db') > 0.8
            ? `The shards are at ${percent(utilization(sim, 'db'))} again, and a third one is needed.`
            : `Your shards still have headroom (${percent(utilization(sim, 'db'))}), but growth will catch up with them too.`
        } This is where **resharding** hurts. With the rule “hash modulo 2”, switching to “modulo 3” moves about two thirds of all records to another shard: terabytes have to be copied without stopping the shop.

So resharding is planned in advance. The data is split into many small **logical shards** (say, 256) spread over a few databases, and a new database takes over some of them whole. **Consistent hashing** solves the same problem: adding a shard moves only a small share of the keys.`,
    },
    summary: {
      title: 'Summary',
      body: `Sharding is the way to **scale writes**: each shard takes its share, and capacity grows with the number of shards.

The price is complexity: routing by key, hot shards, cross-shard queries without joins or transactions, painful resharding. So sharding comes last: first a cache, read replicas and a bigger database, and shards only when writes or the volume of data no longer fit on one machine.

One more thing: each shard is the **only copy** of its users’ data. If [[db2|db2]] fails, half of the users lose access to their orders, while the other half carry on as if nothing happened. In practice every shard gets its own replicas, as in lesson 6. How to survive the failure of any block is the topic of lesson 10.`,
    },
  },
  annotations: {
    writesAndMisses: sim =>
      `writes ${n(writesInto(sim, 'db'))} + misses ${n(missesInto(sim, 'db'))} rps`,
    dbOverload: sim =>
      `${n(incoming(sim, 'db'))} of ${n(capacity)} rps · errors ${percent(sim.errorRate)}`,
    writesAlone: sim =>
      `writes alone: ${n(writesInto(sim, 'db'))} rps · ${percent(writesInto(sim, 'db') / capacity)}`,
    shardOne: sim => `hash(user_id) % 2 = 0 · ${n(incoming(sim, 'db'))} rps`,
    shardTwo: sim => `hash(user_id) % 2 = 1 · ${n(incoming(sim, 'db2'))} rps`,
    shardOneGrowth: sim =>
      `${n(incoming(sim, 'db'))} of ${n(capacity)} rps · ${percent(utilization(sim, 'db'))}`,
    shardTwoGrowth: sim =>
      `${n(incoming(sim, 'db2'))} of ${n(capacity)} rps · ${percent(utilization(sim, 'db2'))}`,
    onlyCopyOne: sim => `${n(incoming(sim, 'db'))} rps · the only copy`,
    onlyCopyTwo: sim => `${n(incoming(sim, 'db2'))} rps · the only copy`,
  },
  tasks: {
    'split-data': {
      prompt:
        'Split the data across shards so that every database keeps headroom at 6,400 rps.',
      goals: {
        'servers-use-shards': 'Server groups write to two shards',
        'cache-uses-shards': 'The cache reads misses from two shards',
        'shard-headroom': 'Each shard is at most 80% loaded at 6,400 rps',
        'holds-load': 'Handles 6,400 rps with less than 1% errors',
      },
      hints: [
        'No single database can take all the writes. Their stream has to be split between several databases.',
        'Place a second database next to the first one and connect every server group and the cache to it. Keep the old connections: each shard holds its own part of the data.',
        'A dashed outline appeared on the board. Place the database there and draw the marked connections from all four groups and from the cache.',
      ],
      solvedNote:
        'Each shard takes half of the writes and half of the cache misses, and both stay below 80%.',
    },
  },
} satisfies LessonTexts<typeof lesson>
