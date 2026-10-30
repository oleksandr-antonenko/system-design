# Agent notes

Interactive System Design course: theory on the left, a live board on the right, hands-on tasks solved on the board. Public repository; lessons are contributed as modules via pull requests.

Read before writing code:

- [`apps/web/FOLDKIT.md`](apps/web/FOLDKIT.md) — Foldkit architecture and conventions (owned by Foldkit, replaced on upgrade).
- [`docs/roadmap.md`](docs/roadmap.md) — the order of OpenSpec changes and decisions already made.
- [`openspec/config.yaml`](openspec/config.yaml) — project context for planning; changes live in `openspec/changes/`.

## Workspace

| Path | What |
|---|---|
| `apps/web` | Foldkit SPA on Effect (Vite, Tailwind v4). Entry `src/entry.ts`, app `src/main.ts` + `src/view.ts`, routes `src/route.ts` |
| `apps/web/src/i18n` | Locales, plural rules, number formatting, typed UI dictionaries, domain message texts |
| `apps/web/src/courses` | One folder per course (`<course-id>/course.ts`, `course.<locale>.ts`, `lessons/NN-slug/`), auto-registered by `registry.ts` |
| `apps/web/src/kinds` | Board kinds behind the `BoardKind` contract (`contract.ts`): `flow` (System Design) and `packet` (networks); `state.ts` holds the Schema unions the player stores |
| `apps/server` | Node + Effect HTTP server: serves the web build and `/api` |
| `patches/` | pnpm patches for dependencies (see below) |
| `docs/` | Plans, roadmap, the lesson mockup |

## Rules

- **Effect 4.1.0 everywhere**, forced through `pnpm-workspace.yaml` overrides although Foldkit 0.169 declares 4.0.0. `@foldkit/vite-plugin` is patched (`patches/`) because 4.1 moved `Crypto` out of the `effect` root. Drop the patch once Foldkit ships a plugin for 4.1. Keep exactly one copy of `effect` in the tree (`pnpm why effect`).
- **Four languages: `uk`, `ru`, `en`, `lt`.** Every UI string is added to all four dictionaries at once; a missing key fails `tsc`. Domain logic returns message codes with parameters (`DomainMessage`), never finished text; the view renders them with the current dictionary.
- **System elements are named in English in every language** (System Design). Board, palette and feedback labels come from `componentName` in `apps/web/src/domain/catalog.ts` and are never translated; each locale explains them natively in `kindHint` (palette tooltip, block description). Lesson texts introduce an element once as bold English name + native term + explanation, then use only the English name; tool vocabulary (health check, TTL, failover, …) follows the same rule. Full authoring rules: `CONTRIBUTING.md`, “Languages”.
- **Courses and lessons are modules.** A course is a folder `apps/web/src/courses/<course-id>/` with `course.ts` (`defineCourse({ id, order, board, modules, features, locales })`) and `course.<locale>.ts` (title, tagline, module titles). A lesson is a folder `courses/<course-id>/lessons/NN-slug/` with `meta.ts` (`defineLessonMeta(course, { slug, module, order, available, locales, unlocks })`) and `text.<locale>.ts`; no edits to shared files. A course or lesson declares its languages and must be complete in each; missing languages fall back to English with a visible notice. Lessons are found by course + slug (`findLesson(course, slug)`), never by slug alone.
- **Routes:** `/:locale/` catalogue, `/:locale/:course/` course map, `/:locale/:course/lessons/:slug?step=N` lesson (`homeUrl`, `courseUrl`, `lessonUrl` in `route.ts`). Old `/:locale/lessons/:slug` links redirect to the `system-design` course.
- **Board kinds.** The player, lesson DSL, journal, hints, task surfaces and content tests work only through `BoardKind` (`apps/web/src/kinds/contract.ts`). A lesson is `defineLesson(kind, { slug, steps })`; a new kind is a new `kinds/<kind>/` folder plus a variant in each union of `kinds/state.ts` and a line in `kinds/types.ts`.
- **The UI grows with the student.** A lesson lists the UI features it opens in `meta.unlocks`, taken from its course's `features` (for `networks`: `UiFeature` in `courses/networks/features.ts`). Code asks `isUnlocked(course, lessonOrder, feature)` / `unlockedFeatures` / `newFeatures` from `courses/registry.ts`, never compares lesson numbers.
- **Zero-config local run.** `pnpm install && pnpm dev` must work without `.env` or external services. Secrets are required only with `NODE_ENV=production`.
- **No infrastructure details in the repo**: no server addresses, ssh ports, user names or credentials. The server is described only as "the owner's home server".
- **Quiet test output**: `vitest run --silent --reporter=dot`, `tsc --noEmit --pretty false`, `oxlint --quiet`.

## Commands

```sh
pnpm dev      # web on :5173 (proxies /api) + server on :3620
pnpm check    # typecheck + lint + tests for all packages
pnpm build    # web, then server
pnpm start    # serve the build from apps/server (PORT, HOST, WEB_DIST, APP_VERSION)
```
