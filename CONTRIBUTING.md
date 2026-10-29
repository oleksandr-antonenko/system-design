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

## How a lesson is organized

Every lesson is a folder in `apps/web/src/lessons/` named `NN-slug`, where `NN` is its position in the course:

```
apps/web/src/lessons/03-load-balancer/
  meta.ts        place in the course, availability, languages
  text.en.ts     title and summary in English
  text.uk.ts     … one file per language the lesson is written in
```

`meta.ts`:

```ts
import { defineLessonMeta } from '../model'

export default defineLessonMeta({
  slug: 'load-balancer',
  module: 'foundations', // foundations | scaling | distributed
  order: 3,
  available: true,
  locales: ['en'], // the languages this lesson is written in
})
```

`text.en.ts`:

```ts
import type { LessonText } from '../model'

export default {
  title: 'Load balancer',
  summary: 'Horizontal scaling: several servers behind one entry point.',
} satisfies LessonText
```

The folder is picked up automatically; you do not edit any shared file. The lesson format will grow (theory steps, board operations, tasks) as the roadmap progresses — follow [docs/roadmap.md](docs/roadmap.md) and the open changes in `openspec/changes/`.

### Languages

- The course runs in Ukrainian (`uk`), Russian (`ru`), English (`en`) and Lithuanian (`lt`).
- A lesson may be written in one language. List it in `locales`; every listed language must be complete.
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
