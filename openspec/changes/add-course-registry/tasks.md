## 1. Курсы как модули

- [x] 1.1 `src/courses/model.ts`: `defineCourse`, `CourseText`, `defineLessonMeta(course, meta)` с проверкой `module` и `unlocks` типами; `src/courses/unlocks.ts` — чистые `unlockedThrough`, `unlockedIn`, `isUnlockedThrough`. Проверка: `unlocks.test.ts`.
- [x] 1.2 `src/courses/assemble.ts`: `assembleCatalog` со всеми проверками D2 и выбором текста курса и урока с запасным языком. Проверка: тесты на каждую проблему в `courses/courses.test.ts` (`assembleCatalog`).
- [x] 1.3 `git mv` 13 уроков в `src/courses/system-design/lessons/`, `course.ts` и `course.<язык>.ts` System Design (название, слоган, модули на uk, ru, en, lt), правка относительных импортов. Проверка: `tsc --noEmit --pretty false` без ошибок, тесты контента зелёные для 13 уроков.
- [x] 1.4 `src/courses/registry.ts` по `import.meta.glob` курсов и уроков: `courses`, `findCourse`, `findLesson`, `findDefinition`, `courseLessons`, `isUnlocked`, `unlockedFeatures`, `newFeatures`; палитра D8 считается по `courseLessons(course)`. Проверка: `courses.test.ts` (реестр без проблем, палитра в пределах курса).

## 2. Курс «Сети для вайбкодеров»

- [x] 2.1 `src/courses/networks/course.ts`, `features.ts` (`UiFeature` по таблице 3.4), `course.<язык>.ts` с названием, слоганом и модулями на uk, ru, en, lt. Проверка: `tsc` и тест реестра.
- [x] 2.2 16 заглушек `lessons/NN-slug/` (meta с `available: false` и `unlocks` по таблице 3.4, названия и описания на uk, ru, en, lt). Проверка: тест «16 уроков по программе, каждый элемент открывает ровно один урок, `ping` открыт с урока 4».

## 3. Маршруты, шапка, страницы

- [x] 3.1 Маршруты `Home`, `Course`, `Lesson` с курсом, разбор `LegacyLesson`; `homeUrl`, `courseUrl`, `lessonUrl`. Проверка: `route.test.ts` (разбор и печать по языкам, старые адреса).
- [x] 3.2 Плеер знает курс (`Player.Model.course`, `Player.init(course, …)`), сессии по `lessonKey(course, slug)`, перенаправление старых адресов командой `RedirectToCourse` со шагом. Проверка: `story.test.ts`, `lesson/player.test.ts`.
- [x] 3.3 Каталог `/:язык/`, карта курса `/:язык/:курс/`, шапка с логотипом и переключателем курса, «не найдено» для неизвестного курса, заголовок вкладки; строки сайта в четырёх словарях, `courseTitle`, `courseTagline`, `moduleTitle`, `documentTitle` удалены. Проверка: `scene.test.ts`, тест словарей.
- [x] 3.4 Тест сервера на прямую ссылку нового вида. Проверка: `pnpm test` в `apps/server`.

## 4. Документация и проверка

- [x] 4.1 `AGENTS.md`, `apps/web/AGENTS.md`, `CONTRIBUTING.md`, `openspec/config.yaml`: путь урока `courses/<курс>/lessons/NN-slug/`, модуль курса, `defineLessonMeta(course, …)`, `unlocks`. Проверка: `grep -rn "src/lessons" AGENTS.md CONTRIBUTING.md apps/web/AGENTS.md openspec/config.yaml` пуст.
- [x] 4.2 `pnpm check` зелёный; `openspec validate add-course-registry` проходит.
- [x] 4.3 Продакшен-сборка в браузере (`pnpm build && PORT=3700 pnpm start`), на 390 и 1440 px:
  - каталог на четырёх языках;
  - карты обоих курсов, у сетей 16 уроков «скоро»;
  - `/ru/lessons/caching?step=2` открывает `/ru/system-design/lessons/caching?step=2` на шаге 2;
  - урок System Design играет, задача решается через «Показать решение»;
  - в консоли нет ошибок.
