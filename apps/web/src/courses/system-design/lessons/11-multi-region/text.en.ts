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
const usd = (value: number) => `$${value.toFixed(2)}`
const crossing = simulationRules.regionCrossingMs

export default {
  title: 'Regions and CAP',
  summary:
    'A second region for distant users and for the loss of a data center, asynchronous replication and the choice between consistency and availability.',
  steps: {
    'one-region': {
      title: 'Users across the ocean',
      body: ({ sim }) =>
        `The service has grown: [[users-eu|users]] in Europe are now joined by just as many [[users-us|users in America]]. The whole system still runs in one data center in Europe. On the board that is the **region** Europe: its blocks sit in a labeled zone.

Light in optical fiber crosses the Atlantic and back in about ${crossing} ms. Every American request pays that before a server even starts working. p95 is now ${p95(sim)}: the slowest requests all come from America, and ${crossing} ms of each is just the road.

A page is not a single request: the connection, encryption, the page itself and its data take several round trips one after another, so the user feels the distance several times over.`,
    },
    'region-down': {
      title: 'A whole region goes down',
      body: `Data centers fail as a whole too: a power outage, a cut cable, a bad configuration pushed to every machine at once. Cloud providers report such incidents every year, and a region can stay down for hours.

Now all of Europe is down: the [[lb-1|load balancer]], both servers and the [[db|database]]. A spare server does not help when it stands in the same building. Errors are at 100%, and Americans are hit as well: the whole service lived in one region.`,
    },
    'second-region': {
      title: 'A second region',
      body: `The way out is to run the service in two regions. Users get the address of the nearest live region from **DNS** with health checks: Americans go to the USA, Europeans to Europe, and if a region stops answering, DNS sends everyone to the other one.

Servers are easy to add in the USA: they keep no state. Data is harder. We have set up a [[replica-1|read replica]] of the database there. The [[db|database]] in Europe stays the **leader**: it accepts every write and streams the changes to the replica. There has to be one place that decides the order of writes, so writes from America will still cross the ocean. On the board, a server linked to the database and the read replica sends writes only to the leader and splits reads evenly between the two.

Replication is **asynchronous**: the leader confirms a write to the user first and passes it to the replica a moment later. The replica lags behind, usually by milliseconds, sometimes by seconds.`,
    },
    'build-us': {
      title: 'Task: the US region',
      body: `Build a copy of the system in the USA: a load balancer and servers that work with the read replica. Drop the blocks inside the USA zone: a block gets its region from the zone you release it in.

Then tell the users about the new entrance. Americans will pick it because it is closer. Europeans need it as a way out for the day Europe goes down.`,
    },
    failover: {
      title: 'Europe goes down again',
      body: ({ sim }) =>
        `Europe is down again. This time DNS has sent [[users-eu|Europeans]] to the USA. They are served, but each of their requests now pays the ${crossing} ms crossing: p95 is ${p95(sim)}, errors are at ${percent(sim.errorRate)}.

All the database work has moved to the [[replica-1|read replica]]. The US servers found the leader dead and the replica was **promoted**: it now accepts writes as well as reads. On the board this is instant. In real life it takes seconds or minutes: something has to notice the failure, and someone has to decide that Europe is really gone.

Not everything survived. Replication was asynchronous, so the last writes before the outage had been confirmed to users but never reached America. They are lost, or at best stuck in Europe until it comes back. How much data you may lose in a failure is called the **RPO** (recovery point objective). With asynchronous replication it is above zero.`,
    },
    cap: {
      title: 'CAP: consistency or availability',
      body: `Europe is back, and on the board its [[db|database]] is the leader again at once. In reality this is the hardest moment: the old leader knows nothing about the writes America accepted during the outage, and America never got Europe's last writes. Someone has to decide which copy is right before writes resume.

A **network partition** is worse still: the link between the regions breaks, but both keep running. The **CAP theorem** says that during a partition a system with copies of its data cannot be both **consistent** (every read sees the latest write) and **available** (every request gets an answer). You have to choose.

**Consistency:** America refuses writes until the link is back. Americans see errors, but the copies never diverge. Banks and exchanges choose this. **Availability:** both regions keep accepting writes, and the copies are reconciled afterwards: the latest write wins, or domain rules merge them. Two carts can be merged; two withdrawals from one account cannot. Social networks and shops choose this.

That is why automatic promotion is dangerous. If America mistakes a partition for an outage, both regions become leaders: **split brain**. Real systems promote a replica only after a majority vote of observers, often placed in a third region.`,
    },
    summary: {
      title: 'Summary',
      body: ({ sim }) =>
        `A second region gave you two things: distant users are served close to home, and the service survives the loss of a whole region. p95 went down to ${p95(sim)}. The slowest requests now are American writes that travel to the [[db|leader]], plus the reads the US servers send to it.

The price: the system costs ${usd(sim.costPerHour)} an hour instead of $1.90, writes still cross the ocean, and every copy of the data brings a choice between consistency and availability. To make writes local too, you need a leader in every region with conflict resolution, or you split the data by geography: European accounts live in Europe, American ones in the USA. That is sharding (lesson 9) applied to geography.

In lesson 12 one stream of events will feed search and analytics.`,
    },
  },
  annotations: {
    nearTrip: sim => `${n(incoming(sim, 'users-eu'))} rps · close by`,
    farTrip: sim =>
      `${n(incoming(sim, 'users-us'))} rps · +${crossing} ms across the ocean`,
    noAnswer: sim => `no answer · errors ${percent(sim.errorRate)}`,
    leader: sim => `leader · ${n(incoming(sim, 'db'))} rps`,
    replicaIdle: sim => `copy of db · ${n(incoming(sim, 'replica-1'))} rps`,
    promoted: sim => `promoted · ${n(incoming(sim, 'replica-1'))} rps`,
    detour: sim => `→ USA · +${crossing} ms · errors ${percent(sim.errorRate)}`,
    oldLeader: () => 'back · missed the US writes',
    lag: sim => `${n(incoming(sim, 'replica-1'))} rps · lags behind`,
    writesHere: () => 'leader · every write comes here',
  },
  tasks: {
    'build-us': {
      prompt:
        'Build a copy of the system in the USA: Americans should be served at home, and the service should survive the loss of Europe.',
      goals: {
        'two-entrances': 'Users are linked to two load balancers',
        'reads-replica': 'A server is linked to the read replica',
        'holds-load': 'Handles 500 rps with less than 1% errors',
        fast: 'p95 is at most 160 ms at 500 rps',
        'survives-eu':
          'Survives the loss of Europe at 500 rps with at most 1% errors',
      },
      hints: [
        'Americans need everything close by: an entrance, servers and data. The data is already there: the read replica in the USA zone.',
        'In the USA zone, place a load balancer and two servers: when Europe is down, they take all 500 rps. Link the load balancer to both servers, and each server to the database (writes) and to the read replica. Then link both groups of users to the new load balancer.',
        'A dashed outline appeared in the USA zone. Place the blocks there and draw the marked connections.',
      ],
      solvedNote:
        'Americans are served at home. When Europe goes down, the US half takes everyone and the read replica takes the writes.',
    },
  },
} satisfies LessonTexts<typeof lesson>
