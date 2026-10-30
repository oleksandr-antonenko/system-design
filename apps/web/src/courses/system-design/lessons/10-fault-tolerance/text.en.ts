import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('en', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const dollars = (value: number) => `$${value.toFixed(2)}`

export default {
  title: 'Failover. Surviving a failure',
  summary:
    'Single points of failure: a second load balancer, a read replica that takes over the database, health checks, failover, and availability versus durability.',
  steps: {
    'count-spares': {
      title: 'Count the spares',
      body: `The shop again: [[users|users]] go through the [[lb-1|load balancer]] to three servers, and the servers keep the data in the [[db|database]]. Load is 600 rps and everything is green.

In lesson 3 the servers got the **N+1** rule: there are three of them, and two are enough for this load. If any one of them fails, the other two take over its share. Now look at the other blocks. There is one load balancer and one database, and neither has a spare.`,
    },
    'balancer-down': {
      title: 'The load balancer fails',
      body: `A load balancer is a server too, just with different software. A bad config pushed at night, a kernel update, a dead network card, and [[lb-1|lb-1]] stops answering.

All three servers are healthy, yet they sit idle: users know a single address, and nothing answers there. Errors are at 100%. Health checks do not help either: the block that runs them is the one that is down.`,
    },
    'database-down': {
      title: 'The database fails',
      body: `The load balancer is back. Now the [[db|database]] fails: its disk fills up, the machine reboots after an update, or a whole rack in the data center loses power.

The servers keep receiving requests but have nowhere to read from or write to, because they keep no data themselves (lesson 2). Every request ends with an error, and errors are at 100% again. Three servers and a load balancer are useless without their only database.

There is something worse than downtime. If the disk itself dies and there is no copy, the shop's orders are gone for good. Losing access for an hour and losing data forever are two different troubles, and we will come back to that.`,
    },
    'add-spares': {
      title: 'Task: spares',
      body: `A block whose failure takes down the whole system is a **single point of failure**. The cure is **redundancy**: a second copy of every such block and a way to switch over to it.

For the entrance, that means a second load balancer the users also know about. For the data, it means a **read replica**: a copy of the database that receives every write from the primary. You know it from lesson 6, where it took reads. If the primary fails, the replica is **promoted**: it starts accepting writes, and the servers switch over to it. For that, the servers must be connected to both the [[db|database]] and the read replica.

The load balancer and the read replica are in the palette.`,
    },
    'balancer-failover': {
      title: 'The load balancer fails again',
      body: ({ sim }) =>
        `Let us replay the night of the bad config: [[lb-1|lb-1]] is down again. This time users go to [[lb-2|lb-2]], and it carries all ${n(sim.load)} rps alone, with ${percent(sim.errorRate)} errors. A load balancer handles up to 5,000 rps, so one is enough even at peak. That is N+1 for the entrance.

How do users know where to go? Through a **health check**. Every few seconds the DNS service asks each load balancer “are you alive?”, and after several missed answers in a row it stops handing out that address. Several, not one, so that a single lost packet does not trigger a switch. That is why the switch is never instant: until the checks fail and DNS caches expire, some requests still go to the dead address, for anything from seconds to a minute. The board shows the system after the switch.`,
    },
    'database-failover': {
      title: 'Replica promotion',
      body: ({ sim }) =>
        `Now the [[db|database]] fails. The servers can no longer write to it and turn to the [[replica-1|read replica]]: it is promoted and takes all the traffic, writes and reads alike. Errors are at ${percent(sim.errorRate)}. Switching over to a spare like this is called **failover**.

Database failover is slower than a load balancer's. First you must make sure the primary is really dead and not just slow, otherwise you end up with two primaries, each accepting its own writes. Then the replica is promoted and the servers reconnect. That usually takes tens of seconds, and the **failover time** comes straight out of the time the system is available.

There is a catch with the data too. The replica usually receives writes with a slight delay (asynchronous replication). Orders the primary confirmed in its last second but had not yet passed on are lost. The site works, but a few orders are gone: the system stayed **available**, but its **durability** suffered.`,
    },
    summary: {
      title: 'Summary',
      body: ({ sim }) =>
        `The old primary has been repaired. In real life it comes back as a replica of the new primary; on our board it simply takes its old place.

Now every block has a spare: two load balancers, N+1 servers, a database and a read replica. The price is on the Cost instrument: ${dollars(sim.costPerHour)} an hour instead of $2.30. Redundancy always costs money, so it goes first where a single failure takes everything down.

**Availability** is the share of time the system answers. It is counted in “nines”: 99.9% allows almost 9 hours of downtime a year, 99.99% only 53 minutes. **Durability** is the promise that confirmed data is never lost. A read replica improves availability, but it just as faithfully copies an accidental deletion. Durability calls for **backups** and, for the most valuable data, synchronous replication.

Our spares still sit in one data center. In practice they are spread across **availability zones**: separate buildings with their own power and network. What to do when a whole region goes down is the topic of lesson 11.`,
    },
  },
  annotations: {
    single: () => 'one of a kind · no spare',
    nPlusOne: sim => `if one fails: ${n(sim.load / 2)} rps each`,
    outage: sim => `down · errors ${percent(sim.errorRate)}`,
    idle: sim =>
      `${n(sim.nodes['app2']?.incoming ?? 0)} rps · healthy but idle`,
    nowhereToWrite: sim =>
      `${n(sim.nodes['app2']?.incoming ?? 0)} rps · nowhere to write`,
    takesAll: sim =>
      `all ${n(sim.load)} rps · errors ${percent(sim.errorRate)}`,
    promoted: sim => `primary now · errors ${percent(sim.errorRate)}`,
    pair: () => 'one of two · either copes alone',
    copies: () => 'primary · the read replica can take over',
  },
  tasks: {
    'add-spares': {
      prompt:
        'Remove the single points of failure: the shop must survive the failure of any load balancer, server or database.',
      goals: {
        'two-balancers': 'Users are connected to two load balancers',
        'replica-exists': 'There is a read replica on the board',
        'survives-failure':
          'At 600 rps, survives the failure of any load balancer, server or database with at most 1% errors',
      },
      hints: [
        'Ask of every block: what happens if it fails? The servers already have a spare, but the load balancer and the database do not.',
        'Add a second load balancer, connect it to all three servers and connect the users to it as well. Then add a read replica and connect every server to it, keeping their connections to the database.',
        'Dashed outlines appeared on the board. Place the load balancer and the read replica there and draw the marked connections.',
      ],
      solvedNote:
        'Any single block can fail now: users switch to the other load balancer, and the read replica takes over from the database.',
    },
  },
} satisfies LessonTexts<typeof lesson>
