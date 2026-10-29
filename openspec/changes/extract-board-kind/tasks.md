## 1. Контракт и хранение

- [x] 1.1 `src/kinds/contract.ts`: `KindTypes`, `BoardKind<T>` (документ, расчёт, цели, итог, тексты, цели ссылок, сцена, журнал, линзы, подмодуль доски, поверхности), `BoardOutMessage`, `SurfaceDefinition`, `SurfaceOutMessage`, `BoardContext`, `SurfaceContext`. Проверка: `tsc --noEmit --pretty false` без ошибок.
- [x] 1.2 `src/kinds/state.ts` (`KindOp`, `KindMessage`, `BoardState`, `BoardMessage`, `SurfaceState`, `SurfaceMessage`), `kinds/board.ts`, `kinds/surface.ts`, `kinds/types.ts` (`FlowTypes`, `PacketTypes`, `KindTypesById`). Проверка: `oxlint --quiet` без замечаний о Got-сообщениях.

## 2. Урок и плеер через контракт

- [x] 2.1 `lesson/dsl.ts`: `defineLesson(kind, { slug, steps, labels? })`, `AnyLesson`, `withLesson`, общие свёртки, `LessonTexts` по виду урока с `labels` и `feedback`, `LooseLessonTexts`/`TextsOf`. Проверка: `lesson/texts.test.ts` (пропущенная цель, подпись или аннотация не компилируются).
- [x] 2.2 `lesson/player.ts`: Model с `BoardState`, журнал `KindOp`, `CheckState.Failed` с `KindMessage`, `Solved { withHint }`; ходы доски и поверхностей одним путём; хост поверхностей (`surfaces`, `maybeSurfaceTab`, `GotSurfaceMessage`, `ClickedSurfaceTab`); `initLesson`, `goToLessonStep` для `main.ts`. Проверка: `lesson/player.test.ts` — прежние сценарии зелёные.
- [x] 2.3 `lesson/view.ts`: теория, карточка задачи, журнал, кнопки плеера через вид; вкладки и панель поверхностей; итог «было → стало» из `kind.outcome`; свои тексты ошибок урока. Проверка: `scene.test.ts` корня зелёный.
- [x] 2.4 Разметка: id ссылки может содержать `:` и `.`. Проверка: `kinds/packet/kind.test.ts` (`referencedIds` со ссылками `link:` и `env:`).
- [x] 2.5 Палитра «Позже в курсе» по палитрам уроков курса любого вида (`lesson/course.ts`, `courseLessons`). Проверка: `lesson/course.test.ts`.

## 3. Вид `flow`

- [x] 3.1 `kinds/flow/`: DSL (операции, `highlight`, `annotate`), подмодуль доски (редактор + анимация, пауза и скорость), вид доски и приборов, `flow`. Проверка: `board/*.test.ts`, `lesson/hud.test.ts`, `lesson/ghost.test.ts`.
- [x] 3.2 Тринадцать `lesson.ts` System Design на `defineLesson(flow, …)`. Проверка: `courses/content.test.ts` для 13 уроков.

## 4. Вид `packet` и поверхность

- [x] 4.1 `kinds/packet/doc.ts`, `dsl.ts`, `board.ts` (заготовка), `kind.ts`: свёртка `Edit`/`Send`, цели модели пакетов, цели ссылок, сцена `play`/`pauseAt`/`openEnvelope`/`showTable`. Проверка: `kinds/packet/kind.test.ts`.
- [x] 4.2 Поверхность `wifi:<устройство>` (`kinds/packet/wifi.ts`), строки вкладок, доски сетей и Wi-Fi на uk, ru, en, lt, стили. Проверка: `kinds/packet/story.test.ts`, `kinds/packet/scene.test.ts`, тест словарей.

## 5. Тесты контента, документы, проверка

- [x] 5.1 `courses/content.test.ts` через контракт: вид курса, операции, цели, сцена, ссылки, подписи, поверхности, тексты. Проверка: `vitest run --silent --reporter=dot`.
- [x] 5.2 `AGENTS.md`, `apps/web/AGENTS.md`, `CONTRIBUTING.md`: вид доски, `defineLesson(flow, …)`, ссылки с `:`, `labels`, `feedback`. Проверка: `grep -n "lesson/dsl'" CONTRIBUTING.md` показывает только `defineLesson` и `LessonTexts`.
- [x] 5.3 `pnpm check` зелёный; `openspec validate extract-board-kind` проходит.
- [x] 5.4 Продакшен-сборка в браузере (`pnpm build && PORT=3700 pnpm start`), 1440 и 390 px, ru и en: два-три урока System Design, задачи решаются через «Показать решение», приборы, пауза, журнал работают как раньше; в консоли нет ошибок.
