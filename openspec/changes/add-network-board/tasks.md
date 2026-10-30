## 1. Доска

- [x] 1.1 Подмодуль доски: Model действий ученика, `message.ts`, проигрыватель с остановкой из вида, `replay` хода ученика. Проверка: `kinds/packet/board.story.test.ts`.
- [x] 1.2 Раскладка: устройства, подписи, зоны, план квартиры, облако (картинка сетей и транзит), связи, кольца и полоски, узкий экран. Проверка: `kinds/packet/timeline.test.ts` (layout).
- [x] 1.3 Трасса: конверты разговора и все пакеты, слияние хопов в облаке, сети облака урока 1, потери, паузы, проходы `walk`. Проверка: `kinds/packet/timeline.test.ts`.
- [x] 1.4 Вид: конверт (имена, адреса, слои, цвет), подсветки и подписи, наклейка крупно, метки «новое», карточка с таблицами, панель слоёв, распечатка, сканер, черновик, прогон, туман, легенда. Проверка: `kinds/packet/phone-online.scene.test.ts`, браузер.
- [x] 1.5 Транспорт по урокам и инструменты: «Пуск / Ещё раз / Дальше», «Шаг», счётчик, назад, к началу, ×¼, легенда, «Кабель», перетаскивание и стрелки. Проверка: `board.story.test.ts`, браузер.
- [x] 1.6 Цели доски и что нужно открыть для элемента сцены и цели (`targets.ts`); подсказка задачи сетей. Проверка: `courses/content.test.ts`, `courses/networks/unlocks.test.ts`.

## 2. Квизы

- [x] 2.1 `PickRule`, `Match`, `multiple`, `slots`, `allOf`, `matchOf`, `isValidPick`, `isCorrectPick`; плеер и карточка вопроса. Проверка: `lesson/quiz.test.ts`, `courses/content.test.ts`.
- [x] 2.2 Режимы на доске: `PickDevice`, `NextHop`, `PickLinks`, `PickLayer`, `SpotFault`, `PickRule`, `PlaceChips`, `Match`; `hideUntilAnswered`. Проверка: `kinds/packet/quiz.scene.test.ts`.

## 3. Курс и уроки

- [x] 3.1 Элементы `quiz.pickRule`, `board.portScan`, `quiz.match`, `board.draft`, `quiz.spotFault`, `board.finalRun` в уроках 12, 15, 16; тест открытия. Проверка: `courses/courses.test.ts`, `courses/networks/unlocks.test.ts`.
- [x] 3.2 Урок 1 на uk, ru, en, lt, `available: true`. Проверка: тест контента, `phone-online.scene.test.ts`, `phone-online.story.test.ts`.
- [x] 3.3 Урок 5: комнаты, проход телефона, подсветка стен. Проверка: тест контента, браузер.
- [x] 3.4 `CONTRIBUTING.md`: сцена и квизы доски сетей.

## 4. Проверка

- [x] 4.1 `pnpm check` зелёный; `openspec validate add-network-board` проходит.
- [x] 4.2 Продакшен-сборка в браузере: урок 1 на ru и en, 1440 и 390 px, светлая и тёмная темы; вопрос (неверный и верный ответ), задача руками и через «Показать решение»; уроки System Design работают; в консоли нет ошибок.
