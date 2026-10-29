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

`lesson.ts` is a script. Each step lists the operations that change the board, then what to highlight. The board at step N is all operations of steps 0..N applied in order, so the text and the board never drift apart:

```ts
import { Goal } from '../../../../domain/goals'
import { addNode, annotate, connect, defineLesson, disconnect, highlight, setLoad } from '../../../../lesson/dsl'

export default defineLesson({
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

Markup in step texts: `**bold**`, `[[blockId|words]]` (highlights the block on hover), a blank line starts a paragraph. A step body may also be a function `({ sim, doc }) => string` when the text quotes live numbers.

`pnpm check` runs the content tests on every lesson: all operations apply, a task is unsolved at its start and its solution meets every goal, every `[[id|…]]` and highlight points at a block that exists on that step, and no text is empty. It also checks every course: the folder matches the id, each declared language has its `course.<locale>.ts`, a lesson's module and `unlocks` belong to its course, and no feature is unlocked twice. Folders are picked up automatically; you do not edit any shared file.

### Languages

- The courses run in Ukrainian (`uk`), Russian (`ru`), English (`en`) and Lithuanian (`lt`).
- A lesson (or a course) may be written in one language. List it in `locales`; every listed language must be complete.
- Where a lesson has no translation, the site shows it in English (or the first listed language) with a notice. Translations are welcome as separate pull requests: add `text.<locale>.ts` and the locale to `meta.ts`.
- Interface strings live in `apps/web/src/i18n/ui/{uk,ru,en,lt}.ts`. A new string must be added to all four files — the type checker enforces it.

## Pull requests

- `pnpm check` passes.
- One lesson or one topic per pull request.
- New dependencies, `postinstall` scripts and anything under `deploy/` or `.github/` get extra scrutiny: the default branch is deployed automatically.
- Do not commit secrets, server addresses or personal data.
- Code follows the Foldkit conventions in [apps/web/FOLDKIT.md](apps/web/FOLDKIT.md) and the project notes in [AGENTS.md](AGENTS.md).

Pull requests from first-time contributors need a maintainer's approval before CI runs.

## License of contributions

By contributing you agree that code is released under [MIT](LICENSE) and lesson texts and other course content under [CC BY-SA 4.0](LICENSE-CONTENT.md).
