## 1. Поток по видам и подписи

- [x] 1.1 `FlowKind`, `Send.kind`, `SimResult.edgeKinds`; `edges` прежним кодом. Проверка: `domain/flows.test.ts` («the flow of each edge by kind»), снимки уроков 1–13 без изменений (`courses/system-design/simulation.test.ts`).
- [x] 1.2 Подписи связей: кандидаты от полного к короткому, без наложения на блоки, видны в задаче без жеста. Проверка: `domain/flows.test.ts` («edge labels»), `board/scene.test.ts` («caches and labelled flows»).
- [x] 1.3 Цвета частиц по видам, `--flow-*` в `styles.css`, легенда видимых видов; названия видов на uk, ru, en, lt. Проверка: `board/board.test.ts` («particles»); скриншоты уроков 3, 4, 5, 7 при 1440 и 390 px в `.shots/`.

## 2. Режимы кеша

- [x] 2.1 `CacheMode`, `BoardDoc.cacheMode`, `SetCacheMode`, DSL `setCacheMode`, строка журнала; `reset()` возвращает read-through. Проверка: `domain/cacheModes.test.ts` («the cache mode of the board»).
- [x] 2.2 Cache-aside в симуляторе: промахи и заполнение от сервера, кеш ничего не шлёт, задержка промаха. Проверка: `domain/cacheModes.test.ts` («cache-aside»).
- [x] 2.3 Отказ `ConnectCacheAside`, пунктир пустующей связи, цель `NoLink` и `GoalUnwantedLink` на четырёх языках. Проверка: `domain/cacheModes.test.ts`, `i18n/i18n.test.ts`.
- [x] 2.4 Тег режима на блоке «Cache» с подсказкой на языке страницы. Проверка: `board/scene.test.ts` («the cache block shows its mode»).

## 3. Документы и проверка

- [x] 3.1 `CONTRIBUTING.md`: `setCacheMode`, `NoLink`. Проверка: `grep -n "setCacheMode" CONTRIBUTING.md`.
- [x] 3.2 `pnpm check` зелёный, `npx oxfmt --check` на изменённых файлах, `openspec validate add-flow-labels-and-cache-modes` проходит.

## 4. Перенос конца связи

- [x] 4.1 `BoardOp.Reconnect` (те же правила, что у `Connect`, место в списке сохраняется, `UnknownEdge`), строка журнала. Проверка: `board/reconnect.story.test.ts` («the Reconnect operation»).
- [x] 4.2 Ручки на концах выделенной связи, жест `Reconnecting`, подсветка подходящих блоков, мышь и касание. Проверка: `board/reconnect.story.test.ts` («dragging an end of a connection»), скриншоты в `.shots/`.
- [x] 4.3 Клавиатура: связь — кнопка, Enter на ручке включает `ChoosingEnd`, Enter на блоке переносит, Escape отменяет. Проверка: `board/scene.test.ts` («reconnecting a connection»).
- [x] 4.4 Одна отмена возвращает перенос. Проверка: `lesson/player.test.ts` («moving the end of a connection is one entry»).
