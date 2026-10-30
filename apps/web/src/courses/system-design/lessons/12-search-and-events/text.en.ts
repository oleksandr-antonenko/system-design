import type { SimResult } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('en', Math.round(value))
const indexIn = (sim: SimResult) => sim.nodes['search']?.incoming ?? 0
const analyticsIn = (sim: SimResult) => sim.nodes['worker-1']?.incoming ?? 0

export default {
  title: 'Search and events',
  summary:
    'An event bus delivers every change to the search index and to analytics: publish/subscribe, subscriber lag and eventual consistency.',
  steps: {
    catalog: {
      title: 'The catalog',
      body: `A marketplace with a million products. On this board every request is a change to the catalog: sellers update prices, stock and descriptions, about 150 changes per second. Sellers, the [[users|Users]] block here, reach two servers, [[app1|app1]] and [[app2|app2]], and every change is saved in the [[db|database]]. As in lesson 7, the load balancer is left off the board to save room.

The database is the **source of truth**: whenever anything disagrees with it, the database is right.`,
    },
    'stale-index': {
      title: 'Search is a day behind',
      body: `Buyers look for products by words: “red cotton dress”. A database is bad at that. A query like LIKE '%red dress%' reads the whole table, a million rows, and still cannot cope with typos, word forms or ranking by relevance. So search is served by a separate **search index** (Elasticsearch or OpenSearch, for example), built for exactly this kind of query.

The [[search|search index]] is already here, but it is rebuilt from a copy of the database once a night. During the day no changes reach it: its label shows 0 rps. A seller raised a price at 10 a.m., and search keeps showing the old one until tomorrow. A buyer clicks “from €19” and finds €29 on the product page.

The analysts want the same changes too: price history, which products are selling out, which sellers are active. Every change has to reach several places at once.`,
    },
    'publish-subscribe': {
      title: 'Publish and subscribe',
      body: `How does a change get to the search index and to analytics? There are three ways.

**The server writes everywhere itself.** After saving to the database, it also updates the search index and sends the change to analytics. The seller waits for all three. If the search index is down, the save either fails or the search index silently misses the change. And every new consumer means changing and redeploying the server.

**A queue, as in lesson 7.** The server leaves a message, and the consumers take it from the queue. But a queue gives each message to **one** worker and splits the work between them. If the search index and analytics took from one queue, each would get half: of 150 changes per second, 75 each. Half the prices in search would stay old, and the reports would count half the changes.

**An event bus.** The server **publishes** one event, “product 42 changed”, and the event bus hands a full **copy** to every **subscriber**. Each one reads at its own pace, and a new subscriber does not touch the server's code. This is the **publish/subscribe** pattern (pub/sub); Kafka, for example, works this way.`,
    },
    'connect-bus': {
      title: 'Task: an event bus',
      body: `The event bus and the worker are in the palette to the left of the board. Both servers have to publish their changes to the event bus. The [[search|search index]] subscribes to the event bus, and analytics needs a new subscriber: a worker that adds the changes up into reports.

Note that analytics needs nothing from the servers: subscribing to the event bus is enough. The next team will do the same.`,
    },
    'lagging-subscriber': {
      title: 'A subscriber falls behind',
      body: `A large seller imports their catalog: for twenty minutes, **300 changes per second**. The event bus hands every subscriber a copy of all 300.

The [[search|search index]] takes them all: it can handle about ${n(1500)}. The analytics [[worker-1|worker]] does only 200 per second, so the event bus keeps the other 100 per second for it. That is the subscriber's **lag**, and the event bus shows it as queue growth. Over twenty minutes analytics falls ${n(120000)} events behind. Nothing is lost: the event bus stores events (Kafka keeps them for days), and the worker reads them later from where it stopped. After the import, at 150 changes per second, it has 50 per second to spare and catches up in about 40 minutes. For reports, a 40-minute delay is acceptable.

Notice that the event bus does not wait for its slowest subscriber: sellers save changes as usual, and the search index stays fresh. A second analytics worker subscribed to the event bus would not help: it would get its own full copy and count every change twice. To split one subscriber's stream across several workers, Kafka has **consumer groups**: inside a group events are divided as in a queue, and each group gets its own copy.`,
    },
    'index-down': {
      title: 'The search index goes down',
      body: `The import is over, and load is back to 150 rps. Now the [[search|search index]] is stopped for a version upgrade, and changes no longer reach it. (Buyers' searches are served by a standby copy for now; it is not on the board.)

If the server wrote to the search index itself, every seller's save would now fail, or the change would be lost to the search index. With an event bus, sellers notice nothing: there are no errors. The event bus keeps all 150 events per second for the search index, while the analytics [[worker-1|worker]] gets its own copy as usual.

All this time the search index and the database disagree: search shows old prices. Even on a normal day the search index is updated a moment after the database, within milliseconds or seconds. This is called **eventual consistency**: the copies will agree, but not at the same instant. That is why the product page and the checkout take the price from the database, the source of truth, while search is allowed to lag a little.`,
    },
    summary: {
      title: 'Summary',
      body: `The search index is back. It reads the events it missed from the event bus, starting where it stopped, and catches up with the database: in the end every copy agrees.

The servers publish one event per change, and the [[events-1|event bus]] hands a copy to every subscriber: the [[search|search index]] and the analytics [[worker-1|worker]]. The difference from lesson 7 is a single word. A **queue** divides jobs between workers, so each job is done once. An **event bus** copies every event to each subscriber, so every consumer sees every change. Subscribers live independently: when one falls behind or goes down, the others and the sellers are not affected.

Writes go to the database, while search reads from a separate model built from events. Separating the model you write from the models you read is called **CQRS** (Command Query Responsibility Segregation). Its price is eventual consistency: the read models lag slightly behind the source of truth.`,
    },
  },
  annotations: {
    sourceOfTruth: sim => `${n(sim.databaseLoad)} changes/s · source of truth`,
    staleIndex: sim => `${n(indexIn(sim))} rps · rebuilt nightly`,
    wantsEveryChange: () => 'needs every change',
    indexKeepsUp: sim => `${n(indexIn(sim))} of ${n(1500)} rps · up to date`,
    analyticsLag: sim => {
      const lag = sim.load - analyticsIn(sim)
      return lag >= 1
        ? `${n(analyticsIn(sim))} of ${n(sim.load)}/s · lag +${n(lag)}/s`
        : `${n(analyticsIn(sim))}/s · keeps up`
    },
    indexDown: () => 'stopped for an upgrade',
    busKeeps: sim =>
      sim.backlog >= 1
        ? `keeps +${n(sim.backlog)}/s for later`
        : 'nobody is waiting',
    caughtUp: sim => `${n(indexIn(sim))} rps · caught up`,
    busCopies: sim => `${n(sim.load)}/s · a copy for each subscriber`,
  },
  tasks: {
    'connect-bus': {
      prompt:
        'Make every change reach the search index and analytics through an event bus.',
      goals: {
        'bus-exists': 'There is an event bus on the board',
        'servers-publish': 'Both servers publish to the event bus',
        'index-subscribed': 'The search index is subscribed to the event bus',
        'analytics-subscribed':
          'An analytics worker is subscribed to the event bus',
        'keeps-up': 'At 150 rps no subscriber falls behind',
      },
      hints: [
        'The server should announce a change once, and every consumer should get its own copy.',
        'Place an event bus to the right of the servers and connect app1 and app2 to it. Then draw connections from the event bus to the search index and to a new worker.',
        'A dashed outline appeared on the board. Place the event bus and the worker there and draw the marked connections.',
      ],
      solvedNote:
        'Every change reaches the event bus once, and the search index and analytics each get a full copy.',
    },
  },
} satisfies LessonTexts<typeof lesson>
