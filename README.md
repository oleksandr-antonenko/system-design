# System Design — an interactive course

Learn system design by building it. Each lesson explains the theory step by step while a live board next to it shows the system: requests flow, servers fill up, things break. Then you solve tasks by hand on that board — add load balancers, caches, queues and clusters until the system holds.

- Languages: Ukrainian, Russian, English, Lithuanian.
- Live site: <https://system-design.oleksandr-antonenko.com> (deployment is being set up).
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

Open <http://localhost:5173>. No `.env` and no external services are needed for local development.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Web app on :5173 (with `/api` proxied) and the server on :3620, both reloading on change |
| `pnpm check` | Type check, lint and tests for all packages |
| `pnpm test` | Tests only |
| `pnpm build` | Production build of the web app, then the server |
| `pnpm start` | Serve the production build (`PORT`, `HOST`, `WEB_DIST`, `APP_VERSION`) |

## Project layout

```
apps/web      Foldkit app: routes, views, i18n, lesson modules
apps/server   Effect HTTP server: serves the web build and /api
docs/         Architecture plans, roadmap, mockup
openspec/     Specs and planned changes (OpenSpec)
```

## Contributing

Lessons are self-contained folders, so a new lesson never touches shared code. Read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Code: [MIT](LICENSE). Lesson texts and course content: [CC BY-SA 4.0](LICENSE-CONTENT.md).
