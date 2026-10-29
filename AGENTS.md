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
| `apps/web/src/lessons` | One folder per lesson (`NN-slug/`), auto-registered by `registry.ts` |
| `apps/server` | Node + Effect HTTP server: serves the web build and `/api` |
| `patches/` | pnpm patches for dependencies (see below) |
| `docs/` | Plans, roadmap, the lesson mockup |

## Rules

- **Effect 4.1.0 everywhere**, forced through `pnpm-workspace.yaml` overrides although Foldkit 0.169 declares 4.0.0. `@foldkit/vite-plugin` is patched (`patches/`) because 4.1 moved `Crypto` out of the `effect` root. Drop the patch once Foldkit ships a plugin for 4.1. Keep exactly one copy of `effect` in the tree (`pnpm why effect`).
- **Four languages: `uk`, `ru`, `en`, `lt`.** Every UI string is added to all four dictionaries at once; a missing key fails `tsc`. Domain logic returns message codes with parameters (`DomainMessage`), never finished text; the view renders them with the current dictionary.
- **Lessons are modules.** A new lesson is a new folder with `meta.ts` and `text.<locale>.ts`; no edits to shared files. A lesson declares its languages and must be complete in each; missing languages fall back to English with a visible notice.
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
