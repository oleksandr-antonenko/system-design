# Agent Development Notes

This is a Foldkit app. Read [`FOLDKIT.md`](./FOLDKIT.md) before writing any code in this project. It covers the architecture, the APIs, and the conventions the project is built on.

Foldkit owns `FOLDKIT.md` and replaces it whole on upgrade. This file is yours. Anything you want an agent to know about this project goes below, where an upgrade won't touch it.

`FOLDKIT.md` reads the line below to decide whether it has already offered to vendor the Foldkit source. Leave it in place.

subtree_prompted: false

## Project Notes

Project-wide rules (languages, lessons as modules, Effect 4.1 override, no infrastructure details) live in the root [`AGENTS.md`](../../AGENTS.md).

- Locale is part of every route (`/{uk|ru|en|lt}/...`); `localeOf(route)` is the only source of the current language.
- UI text comes from `uiFor(locale)` (`src/i18n/ui`); never inline user-facing strings in views.
- Courses (`src/courses/<id>/course.ts`) and their lesson folders (`src/courses/<id>/lessons/NN-slug/`) are discovered with `import.meta.glob`; `assembleCatalog` validates them and the registry test fails on any problem.
- The course of a page comes from the route (`courseOf(route)`); lesson sessions in the Model are keyed by `lessonKey(course, slug)`.
- Everything that depends on the board kind goes through `BoardKind` (`src/kinds/contract.ts`); the player (`src/lesson/player.ts`, `view.ts`) is generic over `KindTypes`. Code that holds a lesson of unknown kind (`AnyLesson` from the registry) enters the generic code with `withLesson(lesson, <T extends KindTypes>(definition) => …)`.
- Kind-specific values in the player Model live in the Schema unions of `src/kinds/state.ts` (`KindOp`, `KindMessage`, `BoardState`, `SurfaceState`), reached through each kind's lenses (`kind.op`, `kind.message`, `kind.board.state`).
