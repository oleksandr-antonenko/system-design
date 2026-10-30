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
const { cdnStaticShare, cdnMs } = simulationRules

export default {
  title: 'CDN. Static files close to users',
  summary:
    'Static and dynamic content, edge locations and cache headers: serving images and scripts closer to the user.',
  preview: {
    alt: 'Diagram: a CDN serves static files from edge locations close to each group of users, and only a few requests travel to the distant origin server.',
  },
  steps: {
    'shop-front': {
      title: 'The shop’s entrance',
      body: `Back to the online shop. [[users|Users]] come through the [[lb|load balancer]] to three servers, [[app1|app1]], [[app2|app2]] and [[app3|app3]], and the servers work with the [[db|database]]. To make room at the entrance, this board leaves out the cache from lesson 4.

Right now 900 rps arrive, 300 per server. That is 75% of capacity: not much headroom, but no errors.`,
    },
    'photo-catalog': {
      title: 'A catalog full of photos',
      body: `The shop launches a new catalog: large product photos, a gallery on every page, a fresh design with heavy scripts. Together with an ad campaign, load climbs to **2,400 rps**.

Each [[app2|server]] gets 800 rps, twice its capacity. Half of the requests are lost: the red dots on the connections and 50% on the Errors instrument. The lucky ones wait more than a second for an answer.`,
    },
    'static-files': {
      title: 'What keeps the servers busy',
      body: `Open any page and look at what the browser downloads. One request returns the HTML with the product and its price. Dozens more follow: photos, fonts, scripts, styles. These are **static** files: the same for every visitor, and they rarely change. The page with your cart, your price and the current stock is **dynamic**: it is built anew for every request.

In this course ${percent(cdnStaticShare)} of requests are for static files. So out of 800 rps on [[app2|each server]], 480 do nothing but hand out ready-made files. Most of the servers’ effort goes into working as a file store.

Static files don’t need the application at all. They can be served by a **CDN** (content delivery network): a network of caching servers in hundreds of cities. A CDN stands in front of your system, serves static files from its own copies and passes only the dynamic requests on.`,
    },
    'place-cdn': {
      title: 'Task: a CDN',
      body: 'A CDN goes at the very entrance, in front of the [[lb|load balancer]]. Users talk only to the CDN, and it passes on whatever it cannot answer by itself. The CDN is already in the palette to the left of the board.',
    },
    'edge-locations': {
      title: 'Close to the user',
      body: ({ sim }) =>
        `The [[cdn-1|CDN]] serves ${n(incoming(sim, 'cdn-1') * cdnStaticShare)} rps of static files by itself, and only ${n(incoming(sim, 'lb'))} rps reach the [[lb|load balancer]]. Each [[app2|server]] now gets ${n(incoming(sim, 'app2'))} rps instead of 800, the errors are gone, and p95 has fallen from more than a second to ${p95(sim)}.

A CDN’s servers stand in data centers all over the world. They are called **edge locations**, or points of presence (PoP). A user in Vilnius gets a photo from a server in Vilnius or Warsaw rather than from your data center in Frankfurt or Virginia. Distance costs time: a trip across the ocean and back takes about 100 ms even over fiber, and a page has dozens of files. Here a file from the CDN takes ${cdnMs} ms.

The first visitor in a city does not find the file at the edge yet. The CDN fetches it from your servers, the **origin**, and keeps a copy. Everyone after that gets the copy.`,
    },
    'cache-headers': {
      title: 'Cache headers',
      body: ({ sim }) =>
        `How does a CDN know what it may keep, and for how long? The server tells it in the **Cache-Control** response header. “Cache-Control: max-age=31536000” lets a file be kept for a year; “no-store” forbids keeping the response anywhere.

To change a file that is cached for a year, give it a new name. The build adds a hash of the contents to the file name: app.3f9c2a.js. A new version gets a new name, and nobody asks for the old copy any more. That is simpler and more reliable than asking the CDN to purge a file, although you can do that too.

What must never land in the CDN cache is anything that depends on the user: the cart, the account page, prices with a personal discount, checkout and every request that writes. Such responses are marked private or no-store, and the CDN passes them through to the [[lb|load balancer]]: on this board that is the other ${percent(1 - cdnStaticShare)}, ${n(incoming(sim, 'lb'))} rps. A personal page in a shared cache is worse than a bug. It is a data leak: one user would see another user’s account.`,
    },
    summary: {
      title: 'Summary',
      body: ({ sim }) =>
        `A CDN takes the static files off your system: ${percent(cdnStaticShare)} of requests never reach the servers, and users get files from a nearby city in milliseconds. On the board it costs $0.20 an hour, half the price of one server. Real CDNs charge for traffic, but serving files through them is still far cheaper than from your own servers.

The CDN does not help with dynamic requests. Each of them still reaches the [[db|database]], which now gets ${n(sim.databaseLoad)} of its 1,500 rps. A cache from lesson 4 takes most of the reads off it. When even that is not enough, the next step is **read replicas**: copies of the database that serve reads. That is lesson 6.`,
    },
  },
  annotations: {
    serverLoad: sim => `${n(incoming(sim, 'app2'))} of 400 rps`,
    serverOverload: sim =>
      `${n(incoming(sim, 'app2'))} rps · errors ${percent(sim.errorRate)}`,
    staticShare: sim =>
      `${n(incoming(sim, 'app2') * cdnStaticShare)} of ${n(incoming(sim, 'app2'))} rps are static`,
    cdnServed: sim =>
      `${n(incoming(sim, 'cdn-1') * cdnStaticShare)} rps from the edge · ${cdnMs} ms`,
    serverAfter: sim => `${n(incoming(sim, 'app2'))} of 400 rps`,
    dynamicOnly: sim => `${n(incoming(sim, 'lb'))} rps · dynamic only`,
    dbLoad: sim => `${n(sim.databaseLoad)} of ${n(1500)} rps`,
  },
  tasks: {
    'place-cdn': {
      prompt:
        'Take the static files off the servers: put a CDN in front of the load balancer.',
      goals: {
        'cdn-exists': 'There is a CDN on the board',
        'only-through-cdn':
          'Users reach the load balancer only through the CDN',
        'cdn-to-lb': 'The CDN passes requests on to the load balancer',
        'holds-load': 'Handles 2,400 rps with less than 1% errors',
        fast: 'p95 response within 250 ms at 2,400 rps',
      },
      hints: [
        'More than half of the requests are for files that are the same for everyone. Something at the entrance could hand them out instead of the servers.',
        'Place a CDN between the users and the load balancer. Connect the users to the CDN and the CDN to the load balancer. The old “Users → Load balancer” connection has to go.',
        'A dashed outline appeared on the board. Place the CDN there and draw the marked connections. The connection marked in red has to be deleted.',
      ],
      solvedNote:
        'The CDN hands out the static files by itself, and only dynamic requests reach the servers.',
    },
  },
} satisfies LessonTexts<typeof lesson>
