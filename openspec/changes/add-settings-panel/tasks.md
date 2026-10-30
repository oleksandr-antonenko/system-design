## 1. Компонент панели

- [x] 1.1 Схема панели (`kinds/packet/surfaces/panel/schema.ts`): `PanelDefinition`, вкладки, виды полей, значения `Values`, проблемы `FieldProblem`, `gather`; проверки ввода (`fields.ts`). Проверка: `tsc --noEmit --pretty false`.
- [x] 1.2 Подмодуль `panel.ts`: черновик с `base`, «Сохранить» (проверка, пробное применение, `ProducedOps`), «Отменить», «Показать» пароль, строки списков, вкладки по unlocks, метка «новое», призрак по разнице с эталоном, вид только для чтения вне задачи. Проверка: `panel.story.test.ts`, `list.scene.test.ts`.
- [x] 1.3 Поверхность в виде `packet`: вариант `PanelSurface` в `kinds/state.ts`, `panelSurfaces` в `kind.ts`, id поверхностей в `PacketSurface`. Проверка: тест контента «task surfaces exist and are open by this lesson».
- [x] 1.4 Тексты панелей `i18n/ui/panel/*` на uk, ru, en, lt, раздел `panel` словаря. Проверка: `tsc` (пропуск ключа не компилируется).
- [x] 1.5 Стили `panel.css`: нейтральный вид, пунктир призрака, узкий экран (вкладки строкой, поля во всю ширину, строки карточками). Проверка: браузер, 1440 и 390 px.

## 2. Модуль 1: роутер и урок 5

- [x] 2.1 Панель `router`: вкладки «Wi-Fi» (канал подбирается к диапазону) и «Устройства». Проверка: `panel.story.test.ts`.
- [x] 2.2 Урок 5 «Почему Wi-Fi плохо ловит»: `lesson.ts`, тексты на четырёх языках, `available: true`. Проверка: `courses/content.test.ts`, `05-wifi-range/lesson.test.ts` (проверки сценария), `player.scene.test.ts` (панель в плеере: сохранение, отказ, отмена, призрак, решение).
- [x] 2.3 Тесты курсов допускают открытые уроки сетей. Проверка: `courses/courses.test.ts`, `lesson/course.test.ts`, `scene.test.ts`.

## 3. Модуль 2: интернет

- [x] 3.1 Роутер: «Адреса» (пул, закреплённые адреса по устройствам) и «Порты» (проброс). Проверка: `tabs.story.test.ts`.
- [x] 3.2 Панель `dns-panel`: записи A/AAAA/CNAME/MX/TXT с TTL, операции по изменённым группам. Проверка: `tabs.story.test.ts`.
- [x] 3.3 Панель `server:<id>`: «Сайт» и «Сертификат»; элементы `server.site`, `server.cert` в уроке 11. Проверка: `tabs.story.test.ts`, `courses/courses.test.ts`.

## 4. Модуль 3: сеть разработчика

- [x] 4.1 Сервер: «Файрвол»; `server.firewall` вместо `router.firewall` в уроке 12. Проверка: `tabs.story.test.ts`, `courses/courses.test.ts`.
- [x] 4.2 Роутер: «Маршруты». Проверка: `tabs.story.test.ts`.
- [x] 4.3 Панель `vpn:<id>`: подключение, весь трафик или рабочие сети, список сетей. Проверка: `tabs.story.test.ts`.
- [x] 4.4 Панель `compose:<id>`: переменные и порты сервисов, пояснение «файл расходится с запущенным»; `compose.file` в уроке 14. Проверка: `tabs.story.test.ts`.
- [x] 4.5 Панель `mesh`: свои устройства, вход и выход, имя; `mesh.members` в уроке 16. Проверка: `tabs.story.test.ts`.
- [x] 4.6 `CONTRIBUTING.md`: как задача объявляет панель и пишет эталон. Проверка: чтение раздела.

## 5. Проверка

- [x] 5.1 `pnpm check` зелёный (тихие режимы); `openspec validate add-settings-panel --strict` проходит.
- [x] 5.2 Продакшен-сборка в браузере (`PORT=3703 pnpm start`), урок 5 на ru и en, 1440 и 390 px: квиз, задача руками и через «Показать решение», в консоли нет ошибок.
