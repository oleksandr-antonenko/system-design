## 1. Профиль

- [x] 1.1 `domain/traffic.ts`: `TrafficProfile`, `TrafficKnob`, `defaultTraffic` (равен прежним константам), `TrafficPatch`, `readShareOf`, `invalidKnob`, `changedKnobs`. Проверка: `domain/traffic.test.ts` («the default profile»).
- [x] 1.2 `BoardDoc.traffic`, `BoardOp.SetTraffic` с наложением ручек и отказом `InvalidTraffic`; `reset()` возвращает умолчания; DSL `setTraffic`; строка журнала. Проверка: `domain/traffic.test.ts` («setTraffic»).

## 2. Симулятор

- [x] 2.1 Сервер: запись, отложенная запись через живую очередь или шину (+2 мс) или синхронно без них, чтение — остаток; `jobsPerRequest` сообщений в каждую очередь и шину. Проверка: `domain/traffic.test.ts` («deferred writes», «jobs and rows»).
- [x] 2.2 Кеш и CDN берут доли из профиля, worker пишет `writesPerJob` записей на задачу. Проверка: `domain/traffic.test.ts` («reads, writes and the cache», «jobs and rows»).
- [x] 2.3 `SimResult.traffic`; `simulationRules` сохраняет прежние поля и получает `deferredMs`. Проверка: снимки уроков 1–13 без изменений (`courses/system-design/simulation.test.ts`).

## 3. Приборы и разбор

- [x] 3.1 Строка профиля в приборах: только изменённые ручки, на uk, ru, en, lt; отдельный стиль ячейки. Проверка: `lesson/hud.test.ts`, `domain/traffic.test.ts` («review and instruments»); скриншоты 1440 и 390 px в `.shots/`.
- [x] 3.2 `13-url-shortener/review.ts` берёт долю статики CDN из `doc.traffic`. Проверка: `domain/traffic.test.ts` («the review of lesson 13 reads the CDN share from the board»).
- [x] 3.3 Текст отказа `InvalidTraffic` на четырёх языках. Проверка: `i18n/i18n.test.ts`.

## 4. Документы и проверка

- [x] 4.1 `CONTRIBUTING.md`: `setTraffic`, ручки и умолчания. Проверка: `grep -n "setTraffic" CONTRIBUTING.md`.
- [x] 4.2 `pnpm check` зелёный, `npx oxfmt --check` на изменённых файлах, `openspec validate add-flow-traffic-profile` проходит.
