import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('en', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0
const served = (sim: SimResult) =>
  ['app1', 'app2', 'app3', 'app4', 'app5'].reduce(
    (sum, id) => sum + (sim.nodes[id]?.served ?? 0),
    0,
  )
const writes = (sim: SimResult) => served(sim) * simulationRules.writeShare
const reads = (sim: SimResult) => served(sim) - writes(sim)

export default {
  title: 'Read replicas. Database copies for reads',
  summary:
    'Read replicas, replication lag, failover and why every write still goes to the primary.',
  steps: {
    'one-database': {
      title: 'Five servers, one database',
      body: ({ sim }) =>
        `The online shop has grown. [[users|Users]] come through the [[lb|load balancer]] to five servers, from [[app1|app1]] to [[app5|app5]], and all of them read and write data in a single [[db|database]].

Servers are stateless (lesson 2), so adding more is easy (lesson 3). The database is different: there is only one, and it handles about **1,500 rps**. Right now ${n(incoming(sim, 'db'))} rps arrive, so it is already at ${percent(utilization(sim, 'db'))}.

Most of these requests are **reads**: My orders, My account, recommendations, delivery status. Only about one request in five changes data (an order, a cart, a payment), and that is a **write**. The cache from lesson 4 helps when many people read the same thing, such as a popular product page. Here every user reads their own data, the same entry is rarely requested twice, and a cache would get few hits. So there is no cache on the board.`,
    },
    'evening-peak': {
      title: 'Evening peak',
      body: ({ sim }) =>
        `In the evening load grows to **${n(sim.load)} rps**. The servers cope: each one is at ${percent(utilization(sim, 'app1'))}. But every request ends up in the same [[db|database]], ${n(sim.nodes['db']?.dropped ?? 0)} more per second than it can take. Those requests are lost: users get an error, and the Errors instrument shows ${percent(sim.errorRate)}.

Another server won’t help, because it would send its requests to the same database. A bigger database helps for a while, but it has a ceiling too, and the price grows faster than the power, just like with servers in lesson 1.`,
    },
    'reads-and-writes': {
      title: 'Reads can be copied',
      body: ({ sim }) =>
        `Look at what the [[db|database]] is busy with: ${n(reads(sim))} of its ${n(incoming(sim, 'db'))} rps are reads, and only ${n(writes(sim))} are writes. If something else took over the reads, the database would have plenty of room.

A read does not change data, so any exact **copy** of the database can answer it. Keeping such copies is called **replication**. The main database is the **primary** (or leader). It accepts every write and records each change in the **replication log**. **Replicas** (followers) receive this log, apply the same changes in the same order and serve reads.

Writes go **only to the primary**. If two copies accepted writes independently, they could make conflicting changes: for example, both could sell the last item in stock.`,
    },
    'add-replicas': {
      title: 'Task: read replicas',
      body: `A **read replica** is now in the palette. A server connected to the database and to replicas sends writes only to the database and splits reads evenly between the database and its replicas.

A replica is a server too, and it can fail. If your only replica fails, all of its reads fall back on the primary, and the primary overloads again. Remember the **N+1** rule from lesson 3.`,
    },
    'replication-lag': {
      title: 'Replication lag',
      body: `The [[db|primary]] now takes every write plus its share of the reads, while [[replica-1|replica-1]] serves only reads.

Copying is not instant. The primary confirms a write right away and sends it to the replicas a moment later. This is **asynchronous replication**, and the delay is called **replication lag**. It is usually a few milliseconds, but under load or after a network hiccup it can grow to seconds.

Anna places an order, and the write goes to the primary. Her next request, My orders, lands on a replica that has not received the change yet, and the order is missing. Anna decides it was lost and orders again. Reads from a replica are **eventually consistent**: the replica catches up, just not immediately.

The usual fix is **read-your-own-writes**: for a few seconds after a user writes something, read that user’s data from the primary. Critical pages such as the cart and payment can always read from the primary. Another option is **synchronous replication**, where the primary waits until a replica confirms the write. There is no lag then, but every write gets slower, and one slow replica holds up all writes.`,
    },
    failover: {
      title: 'The primary fails',
      body: ({ sim }) =>
        `At the peak, the [[db|primary]]’s disk fails. Without replicas this would be lesson 2 all over again: the data is unavailable and every request fails.

But the replicas hold a complete copy. The system notices that the primary is not responding and **promotes** a replica: it becomes the new primary and accepts writes, the other replicas follow it, and the servers switch over. This is called **failover**. ${
          sim.errorRate > 0.01
            ? `Not every server could switch, though: errors are at ${percent(sim.errorRate)}. A server that is not connected to any replica has nowhere to write and loses its requests.`
            : `Errors are at ${percent(sim.errorRate)}: the replicas carry all ${n(sim.load)} rps.`
        }

Failover has a price. With asynchronous replication, the last writes that had not reached the replica before the failure are lost. And two nodes must never both decide that they are the primary, a situation called **split brain**. To prevent it, the new primary is chosen by a vote of several nodes.`,
    },
    summary: {
      title: 'Summary',
      body: ({ sim }) =>
        `The old primary has been repaired. On the board it is the primary again; in practice it usually rejoins as a replica of the new primary.

Replicas **scale reads**: each one takes a share of the reads, and you can add more. They are also a **hot standby**: when the primary fails, a replica takes its place within seconds instead of the hours a restore from backup would take. The price is replication lag, which the application has to account for, and the replicas themselves at $0.60 an hour each.

Replicas do not help with **writes**. All ${n(writes(sim))} writes per second still go to the [[db|primary]], and every replica repeats each of them to keep its copy current (the board counts only the reads a replica serves). When writes alone outgrow one database, the data has to be split across several. That is **sharding**, the topic of lesson 9.`,
    },
  },
  annotations: {
    dbLoad: sim =>
      `${n(incoming(sim, 'db'))} of ${n(1500)} rps · ${percent(utilization(sim, 'db'))}`,
    dbOverload: sim =>
      `${n(incoming(sim, 'db'))} of ${n(1500)} rps · errors ${percent(sim.errorRate)}`,
    readsAndWrites: sim =>
      `reads ${n(reads(sim))} · writes ${n(writes(sim))} rps`,
    primaryWrites: sim =>
      `writes ${n(writes(sim))} rps + reads · ${percent(utilization(sim, 'db'))}`,
    replicaBehind: sim =>
      `reads ${n(incoming(sim, 'replica-1'))} rps · slightly behind`,
    primaryDown: sim => `primary down · errors ${percent(sim.errorRate)}`,
    promoted: sim => `new primary · ${n(incoming(sim, 'replica-1'))} rps`,
    writesStayHere: sim => `all ${n(writes(sim))} writes/s · only here`,
  },
  tasks: {
    'add-replicas': {
      prompt:
        'Spread the reads so that the database keeps headroom at 1,600 rps, even if one replica fails.',
      goals: {
        'replica-exists': 'There is a read replica on the board',
        'servers-read-replicas': 'Servers are connected to a replica',
        'primary-headroom': 'The database is at most 80% loaded at 1,600 rps',
        'holds-load': 'Handles 1,600 rps with less than 1% errors',
        'spare-replica': 'Survives the failure of any one replica',
      },
      hints: [
        'The database is swamped with reads, and any copy of the data can answer a read.',
        'Place two read replicas to the right of the servers and connect every server to both. Keep the server → database connections: writes go only through them.',
        'A dashed outline appeared on the board. Place the replicas there and draw the marked connections from every server.',
      ],
      solvedNote:
        'Writes go to the primary, reads are split three ways, and losing a replica no longer overloads the database.',
    },
  },
} satisfies LessonTexts<typeof lesson>
