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

No `.env` is needed.

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
  networks/                “Networking for vibe coders”, same layout
```

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

Blocks: `client`, `cdn`, `limiter`, `lb`, `server`, `cache`, `queue`, `events`, `worker`, `db`, `replica`, `search`. Their capacities, prices, allowed connections and behaviour in the flow (servers send 20 % writes to databases and 80 % reads to caches or databases and replicas; a queue splits jobs between workers, an event bus copies them to every subscriber; and so on) are fixed in [openspec/specs/traffic-simulation](openspec/specs/traffic-simulation/spec.md) and `apps/web/src/domain/catalog.ts`.

Operations: `addNode(id, kind, x, y, { locked?, capacity?, region? })`, `connect`, `disconnect`, `setLoad`, `failNode`, `recoverNode`, `failRegion`, `recoverRegion`. Stage: `highlight(target, tone)` and `annotate(target, key, tone)`, where the target is a block id or `{ kind: 'lb' }` and the tone is `ink`, `info`, `ok`, `warn` or `bad` (or a function of the simulation). Goals: `HasKind`, `FansOut`, `OnlyThrough`, and the ones checked by running the simulation — `MaxErrorRate`, `MaxP95`, `MaxUtilization`, `MaxBacklog`, `SurvivesFailure`, `SurvivesRegionFailure` — plus `MaxCost`. A student cannot move past a task until it is solved. Lessons 1–13 in `apps/web/src/courses/system-design/lessons/` are working examples of every block and goal.

`text.en.ts` holds every text of the lesson. Its type is derived from `lesson.ts`, so a missing step, annotation, goal or hint is a type error:

```ts
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Load balancer',
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

**Settings panels (networking course).** A task that is solved in settings names its panel in `surfaces`, next to the board: `surfaces: ['board', 'router']`. Panels: `router` (tabs Wi-Fi, Devices, Addresses, Ports, Routes), `dns-panel` (domain records), `server:<device>` (Site, Certificate, Firewall), `vpn:<device>`, `mesh` and `compose:<device>`. A tab appears only once the course has unlocked its feature (`router.wifi`, `server.cert`, …), and the lesson that unlocks it marks it “new”. “Save” writes the same operations you put into the task's `solution`, so write the solution with the builders from `net/build.ts`, for example `configureWifi('router', wifi('Home', 'secret12', { band: 'dual' }))`; after the third hint the panel frames the fields your solution changes, without their values. A new panel is a `PanelDefinition` in `apps/web/src/kinds/packet/surfaces/panel/`: tabs, fields, `read` from the document and `save` into operations.

**The networking board.** A step's `stage` only shows; it never changes the network (use `send(intent)` in `ops` for that). Elements from `apps/web/src/kinds/packet/dsl.ts`: `play(intent)` (the envelope goes hop by hop when the student presses Run; `{ show: 'all' }` shows every packet instead of only the request and the reply), `pauseAt(device)`, `openEnvelope(level)`, `showTable(device, table)` (`arp`, `mac`, `routes`, `leases`, `nat`, `dns`, `contacts`, `records`, `ports`, `rules`), `expand('internet')` (the cloud opens onto its networks or transit routers), `printout(device, command)`, `scan(from, target, ports)`, `preview(ops)` (a dashed draft whose elements are `draft:<n>`), `runAll(rows)`, `fog(visible)`, `walk(device, points)`, `room(id, x, y, w, h)` (a room on the floor plan, captioned by `labels['zone:<id>']`), `builder(from, url)` (the envelope builder), plus `highlight` and `annotate`. Board targets: a device id, `link:<id>`, `env:<level>`, `zone:<router>` or `zone:internet`, `sticker`, `wall:<n>`, `rule:<device>:<n>` (0 is “everything else”) and `draft:<n>`. Everything is drawn only once the course has unlocked it (`board.addresses`, `board.envelopeLayers`, `transport.step`, …), and a content test checks that a lesson uses only what is open by then — stage elements, quiz kinds, links and terminal commands in its texts and hints.

Quiz kinds on the networking board: `PickDevice`, `NextHop` (drag the envelope or press the next device), `PickLinks`, `PickLayer` (the field of the level opened by `openEnvelope` is highlighted), `SpotFault`, `PickRule`, `PlaceChips` and `Match`. For several correct answers set `multiple: true` and `answer: allOf('a', 'b')` (the board adds a Done button); for chips onto places set `slots: ['A', 'B']` and `answer: matchOf({ A: 'dns', B: 'gateway' })`, with the chip texts in `options` and the place texts in `slots` of the quiz texts. `hideUntilAnswered` understands `play`, `links`, `bars`, `addresses` and device ids.

`pnpm check` runs the content tests on every lesson through its board kind: the lesson uses the board of its course, all operations apply, a task is unsolved at its start and its solution meets every goal, every `[[id|…]]`, highlight and labelled entity points at something on the board, every task surface exists and is unlocked by then, every quiz's answer is one of its candidates and its candidates are on that step's board, and no text is empty. It also checks every course: the folder matches the id, each declared language has its `course.<locale>.ts`, a lesson's module and `unlocks` belong to its course, and no feature is unlocked twice. Folders are picked up automatically; you do not edit any shared file.

### Languages

- The courses run in Ukrainian (`uk`), Russian (`ru`), English (`en`) and Lithuanian (`lt`).
- A lesson (or a course) may be written in one language. List it in `locales`; every listed language must be complete.
- Where a lesson has no translation, the site shows it in English (or the first listed language) with a notice. Translations are welcome as separate pull requests: add `text.<locale>.ts` and the locale to `meta.ts`.
- Interface strings live in `apps/web/src/i18n/ui/{uk,ru,en,lt}.ts`. A new string must be added to all four files — the type checker enforces it.
- **System Design: system elements are named in English in every language.** The board, the palette and the feedback show the labels from `componentName` (`apps/web/src/domain/catalog.ts`): Users, Server, Database, Load balancer, Cache, CDN, Read replica, Queue and so on. Students meet the same words in documentation, cloud consoles, monitoring and interviews. Lesson texts follow the same rule:
  - In the lesson that introduces an element, its first mention is the bold English name, the native term and the explanation: «**Load balancer** (по-русски — балансировщик нагрузки) — …». After that, only the English name. An element mentioned before its lesson is explained briefly at that mention.
  - Mid-sentence the name is lowercase (load balancer, database, read replica); abbreviations stay as they are (CDN). Pointing at a board block, quote its label: блок «Load balancer».
  - English words never take native case endings (no «load balancer'а»); rephrase instead. Adjectives and verbs agree with the gender of the native term (ru: database is feminine, cache is masculine).
  - Tool vocabulary is English too: rps, p95, health check, round-robin, TTL, cache hit / miss, replication lag, failover, shard key, retry, idempotency key, SPOF and the like. Explain each in the student's language at first use. General ideas may stay native, with the English term in parentheses at first mention: горизонтальное масштабирование (horizontal scaling).
  - Node links use the node id or the English name: `[[db|database]]`, `[[lb|load balancer]]`. Lesson titles that name an element are English («Load balancer», «Read replicas»); summaries stay native and use the English terms.
  - The rule covers everything: goals, hints, `solvedNote`, annotations, quizzes, `more` and `askAi` (students paste those prompts into AI tools).
  - The native explanation shown on the board (palette tooltip, the block's accessible description) is `kindHint` in the interface dictionaries.

## Pull requests

- `pnpm check` passes.
- One lesson or one topic per pull request.
- New dependencies, `postinstall` scripts and anything under `deploy/` or `.github/` get extra scrutiny: the default branch is deployed automatically.
- Do not commit secrets, server addresses or personal data.
- Code follows the Foldkit conventions in [apps/web/FOLDKIT.md](apps/web/FOLDKIT.md) and the project notes in [AGENTS.md](AGENTS.md).

Pull requests from first-time contributors need a maintainer's approval before CI runs.

## License of contributions

By contributing you agree that code is released under [MIT](LICENSE) and lesson texts and other course content under [CC BY-SA 4.0](LICENSE-CONTENT.md).
