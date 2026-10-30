## 1. Контракт и плеер

- [x] 1.1 `SurfaceContext.history`, `journal`, `surfaces`; `SurfaceDefinition.screen`; `SurfaceSlot.renderMessage` с `feedback` урока. Проверка: `tsc --noEmit --pretty false`.
- [x] 1.2 Плеер: контекст поверхности из истории шагов и журнала, одна вкладка на экран устройства (`visibleSurfaces`). Проверка: `surfaces/screen/story.test.ts` («one screen per device»).
- [x] 1.3 Ход со своей сценой: `BoardKind.moveStage`, `BoardHost.replay`, `BoardContext.stageDoc`, `boardStage` в плеере, у `flow` пусто, у заготовки доски `packet` — трасса на документе до хода. Проверка: `06-ports-and-localhost/story.test.ts` (ход в браузере проигрывается, отмена возвращает сцену шага).

## 2. Экран устройства

- [x] 2.1 Подмодуль `screen` (`message.ts`, `screen.ts`, `network.ts`) и поверхности `wifi`/`browser` с общим экраном. Проверка: `surfaces/screen/story.test.ts`.
- [x] 2.2 Настройки: Wi-Fi, лист пароля, объяснения сетей кафе и соседа, неверный пароль как ход, сведения о сети, DNS автоматически и вручную, адрес вручную, «Забыть эту сеть». Проверка: `surfaces/screen/story.test.ts`, `surfaces/scene.test.ts`.
- [x] 2.3 Браузер: страница, адресная строка с `http://`, «Обновить», экраны ошибок с кодом и «Почему», сертификат, форма входа, картинки вариантов `Choice`. Проверка: `surfaces/screen/story.test.ts`, `surfaces/scene.test.ts`.
- [x] 2.4 Призрак экрана (`ghostKeys`) и вид телефона или окна, стили `surfaces.css`. Проверка: `surfaces/screen/story.test.ts`, браузер на 1440 и 390 px.

## 3. Терминал

- [x] 3.1 `transcriptOf` по истории: команды, вход по ssh, обрыв, консоль хостинга. Проверка: `surfaces/terminal/story.test.ts` («terminal on a server»).
- [x] 3.2 Подмодуль терминала: ввод, история ↑/↓, Ctrl+C, занятый терминал, подсказки на языке интерфейса, кнопки-подсказки по unlocks, `clear`, фокус строки. Проверка: `surfaces/terminal/story.test.ts`, `surfaces/scene.test.ts`.
- [x] 3.3 Призрак терминала — следующая команда эталона. Проверка: `surfaces/terminal/story.test.ts`.

## 4. Курс и тексты

- [x] 4.1 Раздел `device` словарей интерфейса на uk, ru, en, lt; старые строки `network.wifi*` убраны. Проверка: `tsc`.
- [x] 4.2 Элементы курса `terminal.ipRoute`, `wifi.addressing`, `browser.form`, `terminal.nc`, `terminal.tunnel` в уроках 8, 11, 12, 14; проверочная поверхность Wi-Fi заменена экраном устройства. Проверка: `courses/courses.test.ts`, `kinds/packet/story.test.ts`, `kinds/packet/scene.test.ts`.

## 5. Урок 6

- [x] 5.1 `lesson.ts`, тексты на uk, ru, en, lt, `available: true`. Проверка: `courses/content.test.ts`, `06-ports-and-localhost/story.test.ts` (проверки сценария).
- [x] 5.2 Урок в плеере: вопрос, задача руками, ловушка `--host`, «Показать решение» (ru и en). Проверка: `06-ports-and-localhost/scene.test.ts`, `surfaces/terminal/story.test.ts`.
- [x] 5.3 Тесты курсов допускают открытые уроки сетей. Проверка: `courses/courses.test.ts`, `scene.test.ts`.

## 6. Проверка

- [x] 6.1 `pnpm check` зелёный; `openspec validate add-terminal-and-browser` проходит.
- [x] 6.2 Продакшен-сборка в браузере (порт 3702), урок 6 на ru и en, 1440 и 390 px: задача руками и через «Показать решение», в консоли нет ошибок.
