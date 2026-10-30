## 1. Блок

- [x] 1.1 `domain/catalog.ts`: вид `storage`, подпись «Object storage», ранг 7, 50 000 rps, 0,05 $/ч; связи `client`, `cdn`, `worker` → `storage`. Проверка: `domain/storage.test.ts` («the Object storage block»), `domain/blocks.test.ts` (все пары связей с пояснениями).
- [x] 1.2 Id `storage-N`, места палитры, иконка-ведро. Проверка: `domain/storage.test.ts` («gets readable names and a free spot from the palette»); скриншоты 1440 и 390 px в `.shots/`.
- [x] 1.3 `kindHint` на uk, ru, en, lt по правилу английских названий. Проверка: `i18n/i18n.test.ts` («system element names»), `domain/storage.test.ts`.

## 2. Поток

- [x] 2.1 `handleStorage`: поток как у базы, план задержки для запросов пользователей (путь + `storageMs` 40 мс). Проверка: `domain/storage.test.ts` («Object storage in the flow»: прямая загрузка, регионы, промахи CDN, перегрузка).
- [x] 2.2 Worker кладёт по объекту на задачу в свои хранилища. Проверка: `domain/storage.test.ts` («a worker stores one object per job»).
- [x] 2.3 Хранилище на пути задержки для подсветки медленного p95; цели `Carries` и `MaxUtilization` работают с ним. Проверка: `domain/storage.test.ts`.

## 3. Документы и проверка

- [x] 3.1 `CONTRIBUTING.md`: блок `storage`, его связи, загрузки отдельной группой с `setShare`. Проверка: `grep -n "Object storage" CONTRIBUTING.md`.
- [x] 3.2 Снимки уроков 1–13 без изменений; `pnpm check` зелёный; `npx oxfmt --check` на изменённых файлах; `openspec validate add-object-storage` проходит.
