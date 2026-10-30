## 1. Названия и объяснения

- [x] 1.1 `componentName` в `domain/catalog.ts`; `kindName` убран из `UiStrings` и словарей uk, ru, en, lt. Проверка: `tsc --noEmit --pretty false`.
- [x] 1.2 `kindHint` в четырёх словарях: родной термин и объяснение для каждого вида блока. Проверка: `i18n/i18n.test.ts` («system element names»).
- [x] 1.3 Доска: подпись блока «Users», `aria-label` и `aria-description` блока, подсказка пунктов палитры и «Позже в курсе»; `targetName` вида `flow`. Проверка: `scene.test.ts` («the board names elements in English and explains them in the page language»).
- [x] 1.4 Доменные сообщения (и сообщение о растущих queues), призрак, `hud.database`, `hud.backlog`, `task.resultServers` называют элементы по-английски. Проверка: `domain/blocks.test.ts`, `i18n/i18n.test.ts`.

## 2. Тексты курса

- [x] 2.1 Слоган курса на uk, ru, lt; названия модулей проверены. Проверка: `courses/courses.test.ts`.
- [x] 2.2 Урок 1 объясняет соглашение; Users и Server вводятся по правилу. Проверка: `courses/content.test.ts`.
- [x] 2.3 Уроки 2–6 на uk, ru, lt по правилу (Database, Load balancer, Cache, CDN, Read replica и словарь инструментов), без английских названий сразу после родных числительных; en выверен на единые названия. Проверка: `courses/content.test.ts`, `scene.test.ts`.

## 3. Документация

- [x] 3.1 Правило в `AGENTS.md` и раздел «Languages» в `CONTRIBUTING.md`.
- [x] 3.2 `pnpm check` зелёный.
