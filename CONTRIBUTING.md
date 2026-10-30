# Contributing

Thanks for helping! The most valuable contributions are lessons and translations.

> **UA.** Найцінніше — нові уроки та переклади. Урок — це окрема папка; писати можна однією мовою, решту мов додадуть окремими PR.
>
> **RU.** Самое ценное — новые уроки и переводы. Урок — отдельная папка; писать можно на одном языке, остальные языки добавят отдельными PR.

## Run it locally

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm check      # what CI runs: types, lint, tests
```

No `.env` and no external services are needed: the app is a static single-page site.

## How courses and lessons are organized

The site hosts several courses. Each course is a folder in `apps/web/src/courses/`, and each of its lessons is a folder in the course's `lessons/` named `NN-slug`, where `NN` is its position in the course:

```
apps/web/src/courses/
  system-design/
    course.ts              id, place in the catalogue, board kind, modules, languages
    course.en.ts           course title, tagline and module titles in English
    course.uk.ts           … one file per language the course is written in
    lessons/
      03-load-balancer/
        meta.ts            place in the course, availability, languages
        lesson.ts          the script: steps, board operations, tasks
        text.en.ts         every text of the lesson in English
        text.uk.ts         … one file per language the lesson is written in
        preview.md         the subject of the lesson's picture (its generation prompt)
        preview.webp       the picture, 1200 × 630; preview-600.webp, 600 × 315
  networks/                “Networking for vibe coders”, same layout
```

Each lesson loads as its own file when it is opened: the course map knows only `meta.ts`, the `title`, `summary` and `preview.alt` of each `text.<locale>.ts` and, in `lesson.ts`, the `palette` of each task and the lesson's `introduces`, which the build reads straight from the source. Write those as plain literals (`title: 'Load balancer'`, `palette: ['lb', 'server']`); the build names the file if one is not.

**Every lesson has a picture.** It sits above the lesson title, on the course map and in link previews. Its alt text is `preview: { alt }` in each `text.<locale>.ts`: 100–160 characters that describe the picture through the lesson's subject and name the lesson's English term, following the language rules below. The style, the shared prompt and the export sizes are in [docs/plans/lesson-previews.md](docs/plans/lesson-previews.md); if you cannot generate the picture, write `preview.md` and the alt texts and say so in the pull request.

A lesson lives at `/<locale>/<course>/lessons/<slug>`, for example `/en/system-design/lessons/load-balancer?step=2`. A lesson listed as available without a `lesson.ts` shows a placeholder page; a lesson with `available: false` is shown as “coming soon” on the course map.

`course.ts` (you only need it for a new course):

```ts
import { defineCourse } from '../model'

export default defineCourse({
  id: 'system-design', // must match the folder name
  order: 1, // place in the catalogue
  board: 'flow', // 'flow' (System Design) or 'packet' (networking)
  modules: ['foundations', 'scaling', 'distributed'],
  features: [], // UI features its lessons may unlock, see below
  locales: ['uk', 'ru', 'en', 'lt'],
  // palette: 'all-known', // optional: students already know every block, see below
})
```

`course.en.ts`:

```ts
import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'System Design',
  tagline: 'Load balancers, caches, queues and regions: build a system that holds the load',
  modules: { foundations: 'Foundations', scaling: 'Scaling', distributed: 'Reliability and distribution' },
} satisfies CourseText<typeof course>
```

`meta.ts` of a lesson names its course, so a module or feature that the course does not have is a type error:

```ts
import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'load-balancer',
  module: 'foundations', // one of the course's modules
  order: 3,
  available: true,
  locales: ['en'], // the languages this lesson is written in
  unlocks: [], // optional: UI features this lesson opens (see below)
})
```

**The interface grows with the student.** A lesson shows only what it and earlier lessons of the course have opened. List what your lesson opens in `unlocks`, using the course's feature set (for the networking course: `apps/web/src/courses/networks/features.ts`, e.g. `'terminal.ping'`, `'router.wifi'`, `'browser.addressBar'`). Each feature is opened by exactly one lesson. System Design lessons open nothing.

**The palette follows the course.** By default (`palette: 'progressive'`) a block in the palette gets a “new” badge in the first lesson whose task offers it, and blocks that first appear in later lessons are listed under “Later in the course (lesson N)”. That suits a course that starts from scratch. A course whose students already know every block, such as an advanced course that follows an introductory one, sets `palette: 'all-known'` in `defineCourse`: then no block is “new” and nothing is listed as later. A lesson that brings a block the students have not met names it in `introduces`, and in an `all-known` course only such blocks get the badge in that lesson and are listed as later before it; in a `progressive` course `introduces` marks a block new even before a task offers it:

```ts
export default defineLesson(flow, {
  slug: 'full-text-search',
  introduces: ['search'], // optional: blocks this lesson brings
  steps: [ … ],
})
```

`lesson.ts` is a script for the board kind of its course: `flow` for System Design, `packet` for the networking course (`defineCourse({ board })`). Each step lists the operations that change the board, then what to highlight. The board at step N is all operations of steps 0..N applied in order, so the text and the board never drift apart. The kind comes first in `defineLesson`, and the operations come from that kind's DSL (`apps/web/src/kinds/flow/dsl.ts`, `apps/web/src/kinds/packet/dsl.ts`):

```ts
import { Goal } from '../../../../domain/goals'
import { addNode, annotate, connect, disconnect, flow, highlight, setLoad } from '../../../../kinds/flow/dsl'
import { defineLesson } from '../../../../lesson/dsl'

export default defineLesson(flow, {
  slug: 'load-balancer',
  steps: [
    {
      id: 'one-server',
      ops: [
        addNode('users', 'client', 100, 280), // id, kind, x, y on a 900 × 560 board
        addNode('app1', 'server', 520, 280),
        connect('users', 'app1'),
        setLoad(300), // requests per second
      ],
      stage: [annotate('app1', 'app1Load', 'ink')], // the text comes from text.<locale>.ts
    },
    {
      id: 'place-lb',
      ops: [],
      stage: [highlight('app1', 'bad')],
      task: {
        id: 'place-lb',
        palette: ['lb', 'server'], // what the student may add
        goals: [
          { id: 'lb-exists', goal: Goal.HasKind({ kind: 'lb' }) },
          { id: 'only-through-lb', goal: Goal.OnlyThrough({ from: 'client', to: 'server', via: 'lb' }) },
          { id: 'holds-load', goal: Goal.MaxErrorRate({ max: 0.01, load: 900 }) }, // checked by simulation
        ],
        // replayed by “Show solution” and drawn as the dashed outline of the third hint;
        // the tests check that it meets every goal
        solution: [
          addNode('lb-1', 'lb', 300, 280, { locked: false }),
          connect('lb-1', 'app1'),
          connect('users', 'lb-1'),
          disconnect('users', 'app1'),
        ],
      },
    },
  ],
})
```

Blocks: `client`, `cdn`, `limiter`, `lb`, `server`, `cache`, `queue`, `events`, `worker`, `db`, `replica`, `search`, `storage`. Their capacities, prices, allowed connections and behaviour in the flow (by default servers send 20 % writes to databases and 80 % reads to caches or databases and replicas, see `setTraffic` below; a queue splits jobs between workers, an event bus copies them to every subscriber; and so on) are fixed in [openspec/specs/traffic-simulation](openspec/specs/traffic-simulation/spec.md) and `apps/web/src/domain/catalog.ts`.

`storage` is **Object storage** (ids `storage-1`, `storage-2`, …): files served by link, at the end of the flow, 50,000 rps, $0.05 an hour. Users connect to it for direct uploads (presigned URL), a CDN for its misses (origin) and a worker for the results of its jobs (one object per job, apart from its database rows). A user request that reaches it answers in 40 ms plus any region crossing on the way, so CDN misses count in p95. Users and a CDN split their requests equally between all their targets, so model uploads as a separate Users group connected only to the storage and size it with `setShare`.

Operations: `addNode(id, kind, x, y, { locked?, capacity?, region? })`, `connect`, `disconnect`, `setLoad`, `failNode`, `recoverNode`, `failRegion`, `recoverRegion`, `setShare(id, share)`, `setTraffic({ … })` and `reset()`. Stage: `highlight(target, tone)` and `annotate(target, key, tone)`, where the target is a block id or `{ kind: 'lb' }` and the tone is `ink`, `info`, `ok`, `warn` or `bad` (or a function of the simulation). Goals: `HasKind`, `FansOut`, `OnlyThrough`, and the ones checked by running the simulation — `MaxErrorRate`, `MaxP95`, `MaxUtilization`, `MaxBacklog`, `Carries`, `SurvivesFailure`, `SurvivesRegionFailure` — plus `MaxCost`. A student cannot move past a task until it is solved. Lessons 1–13 in `apps/web/src/courses/system-design/lessons/` are working examples of every block and goal.

- **Unequal user groups.** Several `client` blocks split the load equally. `setShare('users-us', 3)` gives a group a weight (1 by default): next to `users-eu` with weight 1, the US group sends three quarters of the load. Goals with a `load` scale every group in proportion.
- **Phased lessons.** `reset()` starts a step from an empty board, so a later phase can begin from a shared reference design instead of the student's: `ops: [reset(), ...reference, setLoad(2000), ...twist]`. The reference sets its own load and shares, and the step text says that from here on the board shows the shared design. Going back to the earlier step shows the student's own design again, and the journal lists `Reset` as the first line of the step. The reference's blocks may be unlocked for rework: the third hint still outlines every block of the task's `solution` that the board lacks, because only a block the student places during the task can stand in for a missing one.
- **A realistic traffic mix.** `setTraffic({ … })` changes only the knobs it names; the defaults are the old constants, so a lesson without it behaves as before. `writeShare` (0.2): synchronous writes to databases through the server. `deferredShare` (0): writes the server hands to its queue or event bus and answers 2 ms after its own work; without one it writes them synchronously. Reads are what is left, `1 − writeShare − deferredShare`. `cacheHitShare` (0.8) and `cdnStaticShare` (0.6): what a cache and a CDN answer themselves. `jobsPerRequest` (1): messages per served request into each queue and event bus. `writesPerJob` (1): database rows per worker job, above 1 for fan-out, below 1 for batching. A read-heavy service is `setTraffic({ writeShare: 0.01, cacheHitShare: 0.95 })`; the instruments then show “writes 1% · hit 95%”. Annotations read the profile from `sim.traffic`.
- **Goals about one block.** `MaxUtilization({ kind, max, load, nodes })` and `MaxBacklog({ max, load, nodes })` take an optional list of block ids and then check only those blocks (for `MaxUtilization`, the listed blocks of that kind). `Carries({ node, min, load })` requires at least `min` rps to flow through the block, so a goal on a block cannot be met by placing it and leaving it idle; pair it with the limits on that block.

`text.en.ts` holds every text of the lesson. Its type is derived from `lesson.ts`, so a missing step, annotation, goal or hint is a type error:

```ts
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Load balancer. Sharing the load',
  summary: 'Horizontal scaling: several servers behind one entry point.',
  steps: {
    'one-server': {
      title: 'One server',
      body: `[[users|Users]] send requests to one [[app1|application server]].

A size M server handles about **400 requests per second**.`,
    },
    'place-lb': { title: 'Task: load balancer', body: '…' },
  },
  annotations: {
    app1Load: sim => `${sim.nodes['app1']?.incoming ?? 0} of 400 rps`,
  },
  tasks: {
    'place-lb': {
      prompt: 'Make every user request get spread across the servers.',
      goals: { 'lb-exists': '…', 'only-through-lb': '…', 'holds-load': '…' },
      hints: ['a nudge', 'a stronger hint', 'the third hint, shown with the ghost'],
      solvedNote: 'Every request goes through the load balancer.',
    },
  },
} satisfies LessonTexts<typeof lesson>
```

Markup in step texts: `**bold**`, `[[blockId|words]]` (highlights the block on hover), a blank line starts a paragraph. A link target may contain `:` for things that are not blocks, such as `[[link:router-internet|cable]]` or `[[env:transport|TCP]]` on the networking board; the board kind decides what each target means. A step body may also be a function `({ sim, doc }) => string` when the text quotes live numbers (on the networking board: `({ doc, run }) => string`).

Optional sections of the texts: `labels` gives board entities a caption per language (`{ phone: { name: 'Phone', note: 'in your hand' } }`; a lesson lists them in `labels: ['phone', …]` of `lesson.ts`, and a missing caption is a type error), and `feedback` replaces the text of a message code in this lesson's task (`{ ConnectIntoClients: 'Users only send requests.' }`, or a function of the message).

**Quizzes.** A step may ask a question instead of setting a task. There is one attempt; after it the step shows the correct answer and the explanation and opens Next, even if the answer was wrong:

```ts
{
  id: 'reads-and-writes',
  ops: [],
  stage: [],
  quiz: {
    id: 'db-after-cache',
    kind: 'Choice', // options in the card; 'PickDevice' = click a block or device on the board
    candidates: ['unchanged', 'all-reads', 'writes-and-misses', 'misses'],
    answer: 'writes-and-misses', // or (doc, run) => id, computed from the step's board
  },
}
```

Its texts go to `quizzes` in `text.<locale>.ts`: `question`, `explain`, for `Choice` an `options` text per candidate, and optionally `wrong` (why a candidate is wrong) and `tags` (a short label shown on the board next to a picked block). Other optional parts of a lesson's texts: `more: { title, body }` in a step (a collapsed “More” block for the curious) and `askAi: { lead, template, note? }` (a “How to ask an AI” block with a copy button on the last step). Step text may contain bullet lists: lines starting with `- `.

**Settings panels (networking course).** A task that is solved in settings names its panel in `surfaces`, next to the board: `surfaces: ['board', 'router']`. Panels: `router` (tabs Wi-Fi, Devices, Addresses, Ports, Routes), `dns-panel` (domain records), `server:<device>` (Site, Certificate, Firewall), `vpn:<device>`, `mesh` and `compose:<device>`. A tab appears only once the course has unlocked its feature (`router.wifi`, `server.cert`, …), and the lesson that unlocks it marks it “new”. “Save” writes the same operations you put into the task's `solution`, so write the solution with the builders from `net/build.ts`, for example `configureWifi('router', wifi('Home', 'secret12', { band: 'dual' }))`; after the third hint the panel frames the fields your solution changes, without their values. A new panel is a `PanelDefinition` in `apps/web/src/kinds/packet/surfaces/panel/`: tabs, fields, `read` from the document and `save` into operations. The `report` surface (the AI report card) is answered by the task's `Goal.Reported({ fault, evidence, traps, symptom, fix })`: the student picks output lines of this network's commands and a fault, the goal accepts a line whose tag is in `evidence`, the lesson's `feedback` gives `ReportAccepted` (the fix text) and `ReportTrap` (its own answer to a wrong fault listed in `traps`), and “Apply” adds `fix` to the journal; in the solution, write the report with `report(fault, [[line, tag]])`. A task made of several networks in a row is several steps, each starting with `reset()` in its `ops`.

**The networking board.** A step's `stage` only shows; it never changes the network (use `send(intent)` in `ops` for that). Elements from `apps/web/src/kinds/packet/dsl.ts`: `play(intent)` (the envelope goes hop by hop when the student presses Run; `{ show: 'all' }` shows every packet instead of only the request and the reply, `{ show: 'handshake' }` adds the TLS hello before them), `pauseAt(device)`, `openEnvelope(level)`, `showTable(device, table)` (`arp`, `mac`, `routes`, `leases`, `nat`, `dns`, `contacts`, `records`, `ports`, `rules`; with tables of several devices the card follows the envelope, and a `routes` table lights the line it leaves by), `expand('internet')` (the cloud opens onto its networks or transit routers), `printout(device, command)`, `scan(from, target, ports)`, `preview(ops)` (a dashed draft whose elements are `draft:<n>`), `runAll(rows)`, `fog(visible)` (only these devices and whatever the terminal commands reached are visible), `ladder()` (the check ladder: each command lights its step — IP address, gateway, DNS, port, app; fog and ladder stay on the board while the student's moves play), `walk(device, points)`, `room(id, x, y, w, h)` (a room on the floor plan, captioned by `labels['zone:<id>']`), `builder(from, url)` (the envelope builder), `showCert(device, name)` (the site's certificate under the board with the browser's three checks for `name`), plus `highlight` and `annotate`. Board targets: a device id, `link:<id>`, `env:<level>`, `zone:<router>` or `zone:internet`, `sticker`, `wall:<n>`, `rule:<device>:<n>` (0 is “everything else”) and `draft:<n>`. Everything is drawn only once the course has unlocked it (`board.addresses`, `board.envelopeLayers`, `transport.step`, …), and a content test checks that a lesson uses only what is open by then — stage elements, quiz kinds, links and terminal commands in its texts and hints.

Quiz kinds on the networking board: `PickDevice`, `NextHop` (drag the envelope or press the next device), `PickLinks`, `PickLayer` (the field of the level opened by `openEnvelope` is highlighted), `SpotFault`, `PickRule`, `PlaceChips` and `Match`. For several correct answers set `multiple: true` and `answer: allOf('a', 'b')` (the board adds a Done button); for chips onto places set `slots: ['A', 'B']` and `answer: matchOf({ A: 'dns', B: 'gateway' })`, with the chip texts in `options` and the place texts in `slots` of the quiz texts. `hideUntilAnswered` understands `play`, `links` (Wi-Fi links and cut cables), `bars`, `addresses`, `tables` (the cards opened by `showTable`) and device ids.

**Network terms are written in English (networking course).** Students should meet the words they will see on real routers, in terminals and in documentation, so equipment and tool vocabulary stays English in all four languages; each term is explained once in the student's language, in the lesson that introduces it:

- Device names on the board come from `deviceKindName` in `apps/web/src/net/model.ts` (Router, Switch, Access point, ISP router, DNS server, Server, Container, Relay, VPN gateway, Internet, PC, Phone, Laptop, Printer, Smart bulb) and are not translated. The native name with a short explanation is `packetBoard.kindHint` in `apps/web/src/i18n/ui/packetBoard/`; the board shows it as the device's tooltip and accessible description. A lesson label that just names the kind uses this English name; personal and everyday labels («Сайт магазина», «Ваш телефон», rooms, café names) stay in the student's language.
- Tool vocabulary is English after its first explanation: Wi-Fi, SSID, IP address, MAC address, port, localhost, DHCP, DNS, DNS cache, hop, ping, traceroute, latency, packet, frame, TCP, UDP, HTTP, HTTPS, TLS, certificate, NAT, public / private IP, routing table, default gateway, TTL, firewall, firewall rule, VPN, tunnel, Docker, domain, DNS record, 2.4 GHz / 5 GHz band, and the device names above. The first mention looks like «**Router** (по-русски — роутер, маршрутизатор) — …», «**Router** (українською — роутер, маршрутизатор) — …», «**Router** (lietuviškai – maršrutizatorius) – …»; after that, only the English term. A general idea may stay native with the English word in parentheses once («адрес (address)»); a specific field or table is always English ("IP address", "Routing table").
- Teaching images stay pictures in the prose: the envelope is a packet, the post office is a router on the path, the flat is a port, the phone's contacts are the DNS cache, the directory (справочная) is a DNS server. Name the English term next to the image at its first use («конверт — в сетях его называют packet»). Board labels, tables and fields show the English term; captions are prose and may keep the image.
- Stays in the student's language: interface chrome (Run, Step, Settings, Join, Password, Save), the browser and its error screens (the `ERR_*` codes are never translated), everyday things and personal labels. On device screens the technical fields are English (Wi-Fi, SSID, IP address, Router, DNS, MAC address, Subnet mask); terminal output is English and the hint lines are in the student's language with the English terms.
- Never put native case endings on English words: rephrase so the word stands in the nominative or after a native noun («у устройства «Router»»). Adjectives and verbs agree with the gender of the native word (ru: router is masculine). Mid-sentence, write common nouns in lowercase (router, access point, port); abbreviations stay as they are (IP, DNS, NAT, VPN). Quote a board item by its label («у «Router»»). English texts keep the images (envelope, flat, directory) and only need consistent names.

`pnpm check` runs the content tests on every lesson through its board kind: the lesson uses the board of its course, all operations apply, a task is unsolved at its start and its solution meets every goal, every `[[id|…]]`, highlight and labelled entity points at something on the board, every task surface exists and is unlocked by then, every quiz's answer is one of its candidates and its candidates are on that step's board, and no text is empty. It also checks every course: the folder matches the id, each declared language has its `course.<locale>.ts`, a lesson's module and `unlocks` belong to its course, and no feature is unlocked twice. Folders are picked up automatically; you do not edit any shared file.

### Languages

- The courses run in Ukrainian (`uk`), Russian (`ru`), English (`en`) and Lithuanian (`lt`).
- A lesson (or a course) may be written in one language. List it in `locales`; every listed language must be complete.
- Where a lesson has no translation, the site shows it in English (or the first listed language) with a notice. Translations are welcome as separate pull requests: add `text.<locale>.ts` and the locale to `meta.ts`.
- Interface strings live in `apps/web/src/i18n/ui/{uk,ru,en,lt}.ts`. A new string must be added to all four files — the type checker enforces it.
- **Lesson titles, both courses:** `<English term>. <short plain phrase>`. The lesson's main term comes first, unchanged in every language; the phrase says in plain words what the lesson is about, in the student's language: «IP address. У каждого устройства свой адрес», «IP address. Every device has its own». Two terms are joined natively («Ping и hops», «NAT ir port forwarding»), and the phrase follows the rules below (no case endings on English words, no English plural after a native numeral).
- **System Design: system elements are named in English in every language.** The board, the palette and the feedback show the labels from `componentName` (`apps/web/src/domain/catalog.ts`): Users, Server, Database, Load balancer, Cache, CDN, Read replica, Queue and so on. Students meet the same words in documentation, cloud consoles, monitoring and interviews. Lesson texts follow the same rule:
  - In the lesson that introduces an element, its first mention is the bold English name, the native term and the explanation: «**Load balancer** (по-русски — балансировщик нагрузки) — …». After that, only the English name. An element mentioned before its lesson is explained briefly at that mention.
  - Mid-sentence the name is lowercase (load balancer, database, read replica); abbreviations stay as they are (CDN). Pointing at a board block, quote its label: блок «Load balancer».
  - English words never take native case endings (no «load balancer'а»); rephrase instead. Adjectives and verbs agree with the gender of the native term (ru: database is feminine, cache is masculine).
  - An English plural is fine on its own («добавляет servers»), but never right after a native numeral or quantifier (no «три servers», «кілька server», «trys server»). Count the board blocks and quote the label (ru «три блока «Server»», uk «три блоки «Server»», lt «trys „Server“ blokai»), name the nodes by id («app1, app2 и app3») or restructure the sentence.
  - Instrument and panel labels that name an element use the English name too («Запросы к database», «Queue растёт»).
  - Tool vocabulary is English too: rps, p95, health check, round-robin, TTL, cache hit / miss, replication lag, failover, shard key, retry, idempotency key, SPOF and the like. Explain each in the student's language at first use. General ideas may stay native, with the English term in parentheses at first mention: горизонтальное масштабирование (horizontal scaling).
  - Node links use the node id or the English name: `[[db|database]]`, `[[lb|load balancer]]`. Lesson titles follow the format above («Load balancer. Нагрузка делится поровну», «Read replicas. Копии database для чтения»); summaries stay native and use the English terms.
  - The rule covers everything: goals, hints, `solvedNote`, annotations, quizzes, `more` and `askAi` (students paste those prompts into AI tools).
  - The native explanation shown on the board (palette tooltip, the block's accessible description) is `kindHint` in the interface dictionaries.

## Pull requests

- `pnpm check` passes.
- One lesson or one topic per pull request.
- New dependencies and `postinstall` scripts get extra scrutiny.
- No CI workflows, deploy scripts or hosting notes: deployment is configured outside the repository.
- Do not commit secrets, server addresses or personal data.
- Code follows the Foldkit conventions in [apps/web/FOLDKIT.md](apps/web/FOLDKIT.md) and the project notes in [AGENTS.md](AGENTS.md).

Pull requests from first-time contributors need a maintainer's approval before CI runs.

## License of contributions

By contributing you agree that code is released under [MIT](LICENSE) and lesson texts and other course content under [CC BY-SA 4.0](LICENSE-CONTENT.md).
