## 1. Правила симулятора

- [x] 1.1 Одна повышенная реплика (D1). Проверка: `domain/blocks.test.ts` («exactly one replica takes the writes»).
- [x] 1.2 `errorRate` без 429, `rejectedRate`, цель `MaxRejectedRate`, `GoalTooManyRejected` на uk, ru, en, lt (D2). Проверка: `domain/blocks.test.ts` («its 429s are not»), `i18n/i18n.test.ts`.
- [x] 1.3 Чтение в своём регионе (D3). Проверка: `domain/blocks.test.ts` («reads from the stores of its own region»).
- [x] 1.4 Очередь — равные partitions, `eventsPerRequest` (D4). Проверка: `domain/blocks.test.ts` («equal partition», «failed worker»), `domain/traffic.test.ts` («jobs per request feed the queue»).

## 2. Уроки 1–13

- [x] 2.1 Урок 6: одна новая primary в тексте и подпись follower; репликация не нарисована.
- [x] 2.2 Урок 8: 429 отдельно от ошибок, цели `lb-in-path` и `no-failures`, текст `backpressure`.
- [x] 2.3 Урок 11: чтение рядом, связь US-серверов с database в теле задачи, кто повышает реплику.
- [x] 2.4 Урок 13: четыре server в эталоне и подсказке, 302 с Cache-Control, упрощение CDN в разборе.
- [x] 2.5 Уроки 5, 7, 9, 12: строки «На доске упрощено».
- [x] 2.6 Снимок симулятора обновлён намеренно, сдвиги перечислены в `design.md`.

## 3. Документы и проверка

- [x] 3.1 `CONTRIBUTING.md`: правила маршрутизации, `eventsPerRequest`, `MaxRejectedRate`.
- [x] 3.2 `pnpm check`, `npx oxfmt --check` на изменённых файлах, `pnpm build`, `openspec validate fix-simulator-routing`.
