# System Design — an interactive course

Learn system design by building it. Each lesson explains the theory step by step while a live board next to it shows the system: requests flow, servers fill up, things break. Then you solve tasks by hand on that board — add load balancers, caches, queues and clusters until the system holds.

- Languages: Ukrainian, Russian, English, Lithuanian.
- Live site: <https://fundamentals.oleksandr-antonenko.com>.
- Built with [Foldkit](https://foldkit.dev) and [Effect](https://effect.website).

> **UA.** Інтерактивний курс із System Design: теорія крок за кроком, жива схема поруч і задачі, які розв’язуються руками на дошці. Уроки можна пропонувати через pull request — дивіться [CONTRIBUTING.md](CONTRIBUTING.md).
>
> **RU.** Интерактивный курс по System Design: теория по шагам, живая схема рядом и задачи, которые решаются руками на доске. Уроки можно предлагать через pull request — см. [CONTRIBUTING.md](CONTRIBUTING.md).

## Status

Early work. The app shell, the four languages and the course map are in place; the board, the simulator and the first full lessons are next. See [docs/roadmap.md](docs/roadmap.md) and the [lesson mockup](docs/mockups/lesson-load-balancer.html) for where this is going.

## Quick start

Requirements: Node.js 24+ and pnpm 10.

```sh
git clone https://github.com/oleksandr-antonenko/system-design.git
cd system-design
pnpm install
pnpm dev
```

Open <http://localhost:5173>. No `.env` and no external services are needed.

The app is a static single-page site. `pnpm build` writes it to `apps/web/dist`; any static host can serve that folder, as long as it answers unknown paths with `index.html` so that links to lessons open directly. The build also writes a page with its own title, description, canonical and language links, Open Graph tags and a `<noscript>` summary for every catalogue, course and lesson address (`<path>/index.html`), plus `sitemap.xml` and `robots.txt`; set `SITE_URL` (for example `SITE_URL=https://example.org pnpm build`) so their links point at your site. A host that serves `<path>/index.html` for `<path>` gives search engines and link previews the right page.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Web app on :5173, reloading on change |
| `pnpm check` | Type check, lint and tests |
| `pnpm test` | Tests only |
| `pnpm build` | Production build into `apps/web/dist` |
| `pnpm preview` | Serve the production build locally on :4173 |

## Project layout

```
apps/web      Foldkit app: routes, views, i18n, courses and lesson modules
docs/         Architecture plans, roadmap, mockups
openspec/     Specs and planned changes (OpenSpec)
patches/      pnpm patches for dependencies
```

## Contributing

Lessons are self-contained folders, so a new lesson never touches shared code. Read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Code: [MIT](LICENSE). Lesson texts and course content: [CC BY-SA 4.0](LICENSE-CONTENT.md).
