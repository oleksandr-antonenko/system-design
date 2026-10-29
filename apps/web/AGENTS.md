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
