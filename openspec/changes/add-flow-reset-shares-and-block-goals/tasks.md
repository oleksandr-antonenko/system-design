## 1. Снимки до изменения

- [x] 1.1 `courses/system-design/simulation.test.ts`: метрики каждого шага, доски задачи до и после эталона, итоги целей, метрики при нагрузках целей, числа в текстах на uk, ru, en, lt; снимок записан отдельным коммитом до правок движка. Проверка: `vitest run --silent --reporter=dot apps/web/src/courses/system-design/simulation.test.ts`.

## 2. Сброс доски

- [x] 2.1 `BoardOp.Reset` → `emptyBoard`; DSL `reset()`; строка журнала `Reset`; призрак пропускает операцию. Проверка: `domain/shares.test.ts` («reset»).
- [x] 2.2 Шаг с `reset()` начинается с эталона, возврат на шаг задачи показывает схему ученика. Проверка: `lesson/player.test.ts` («a step that starts from a shared reference»).

## 3. Доли групп

- [x] 3.1 `BoardDoc.shares`, `shareOf`, `BoardOp.SetShare` с отказами `ShareNotForUsers` и `InvalidShare`; удаление блока убирает вес. Проверка: `domain/shares.test.ts` («load shares of user groups»).
- [x] 3.2 `simulate`: группа получает `load × share / Σshares`; цели с нагрузкой масштабируют группы. Проверка: `domain/shares.test.ts`, снимки уроков 1–13 без изменений.

## 4. Цели по блокам

- [x] 4.1 `nodes` у `MaxUtilization` и `MaxBacklog`. Проверка: `domain/goals.test.ts` («block-specific goals»).
- [x] 4.2 Цель `Carries` и сообщение `GoalNotCarrying`. Проверка: `domain/goals.test.ts` («carries»).
- [x] 4.3 Тексты трёх новых сообщений на uk, ru, en, lt. Проверка: `i18n/i18n.test.ts` («every domain message»).

## 5. Документы и проверка

- [x] 5.1 `CONTRIBUTING.md`: `setShare`, `reset`, `Carries`, `nodes`. Проверка: `grep -n "setShare\|reset()\|Carries" CONTRIBUTING.md`.
- [x] 5.2 `pnpm check` зелёный, `npx oxfmt --check` на изменённых файлах, `openspec validate add-flow-reset-shares-and-block-goals` проходит.
