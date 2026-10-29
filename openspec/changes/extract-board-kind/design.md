## Context

Мотивация — в proposal.md. Сейчас (после `add-course-registry`) курс объявляет `board: 'flow' | 'packet'`, но плеер знает только доску System Design: Model хранит `Board.Model` и `Anim`, журнал задачи — массив `BoardOp`, проверка зовёт `domain/goals`, вид рисует приборы потоков. Модель пакетов (`src/net/`) готова как чистые функции, её параллельно расширяет `extend-packet-model` (там появятся `NetOp.Send`, мир `{ doc, state }`, `runCommand`, `browse`, тексты `NetMessage`); это изменение `src/net/` не трогает. Сценарии уроков сетей лежат в `docs/plans/networks-lessons/` и задают, что ещё нужно от платформы (подписи сущностей, свои тексты ошибок, ссылки не на устройства).

Ограничения Foldkit: Model — только Schema; Message — union с `Got*Message` для подмодулей; без `as`, `any`, `switch`, `for`.

## Goals / Non-Goals

**Goals:**

- Плеер, DSL, журнал, подсказки и тесты контента не знают, какой вид доски у урока.
- System Design ведёт себя ровно как раньше; все прежние тесты проходят (меняются только способы добраться до Model).
- Следующий исполнитель реализует доску сетей, не трогая плеер: только `kinds/packet/` и варианты union.
- Механизм поверхностей задачи готов и проверен одной поверхностью.

**Non-Goals:**

- Доска сетей (устройства, связи, конверт, транспорт, жесты) — `add-network-board`.
- Терминал, браузер, полноценный экран Wi-Fi — `add-terminal-and-browser`; панель роутера — `add-settings-panel`.
- Квизы — `add-quiz-steps` (следующее изменение строится на этом контракте).
- Тексты `NetMessage` — `extend-packet-model`; до него вид `packet` показывает код.

## Decisions

### D1. Контракт `BoardKind<T>` с набором типов `T`

`src/kinds/contract.ts`. Типы вида собраны в `KindTypes`: `Id`, `Doc`, `Op`, `Goal`, `Run`, `Stage`, `Palette`, `Message`, `Prose`, `Annotation`, `Surface`, `BoardModel`, `BoardMessage`. Наборы `FlowTypes` и `PacketTypes` — в `kinds/types.ts`, там же `KindTypesById` (вид по id курса).

| Часть контракта | Что делает |
|---|---|
| `empty`, `apply(doc, op) → Result<Doc, Message>`, `run(doc)` | документ, операция с отказом-кодом, расчёт (симуляция или «включённая» сеть) |
| `checkGoal(doc, run, goal) → GoalCheck`, `isHiddenGoal`, `solvedGoalText`, `outcome(before, after, ui)` | проверка цели с фокусом на доске, скрытые цели, итог «было → стало» |
| `proseContext`, `annotationInput` | что получают функции-тексты шага и подписи |
| `resolveTarget(doc, target)` | цель ссылки `[[id|…]]`, подсветки, подписи, кандидата квиза |
| `stage.targets`, `stage.annotationKey`, `stage.describe`, `describeOp`, `renderMessage` | сцена, журнал, тексты кодов |
| `op`, `message` | линзы в union хранения (D2) |
| `board` | подмодуль доски: `init`, `update`, `pressDelete`, `interrupt`, `frame`, `view`, `instruments`, линзы `state` и `message` |
| `surfaces` | поверхности задачи (D5) |

Набросок из плана (4.5) расширен тем, что нужно виду и тестам: подмодуль доски, приборы, поверхности, линзы хранения. `describeOp` возвращает строку, а не `DomainMessage`: журнал показывает операции как код, без перевода (как и раньше).

Альтернатива — отдельный плеер на вид. Отклонена: дублирование навигации, задач, журнала и тестов.

### D2. Model плеера: union по виду

Model — Schema, поэтому значения, тип которых зависит от вида, лежат в union по виду (`kinds/state.ts`):

| Union | Варианты | Где в Model |
|---|---|---|
| `BoardState` | `FlowBoard { model }`, `PacketBoard { model }` | `board` |
| `BoardMessage` | `GotFlowBoardMessage`, `GotPacketBoardMessage` | `Message.GotBoardMessage` |
| `KindOp` | `FlowOp { op }`, `PacketOp { op }` | журнал и redo задачи |
| `KindMessage` | `FlowMessage`, `PacketMessage` | тост отказа, `CheckState.Failed.failure` |
| `SurfaceState`, `SurfaceMessage` | по поверхности | `surfaces`, `Message.GotSurfaceMessage` |

Вид достаёт свои значения линзами (`wrap`/`unwrap`), поэтому плееру не нужны приведения типов. Обе операции оборачиваются одинаково: у `BoardOp` и `NetOp` совпадают теги (`Connect`), плоский union невозможен.

`CheckState.Solved` хранит только `withHint`: «было → стало» считается при показе из доски старта задачи и текущей доски — они не меняются после решения. Прежний `Solved { before, after }` хранил то же самое.

Альтернатива — Model, параметризованный видом, и union сессий в корне. Отклонена: вид протекает в корневую Model и маршруты.

### D3. Урок объявляет вид; тексты по-прежнему проверяются типами

`defineLesson(kind, { slug, steps, labels? })` возвращает урок с `board: kind.id`, `kind` и литеральными типами шагов. `LessonTexts<typeof lesson>` берёт типы вида по `KindTypesById[lesson.board]`: функции-тексты шага получают `{ sim, doc }` у `flow` и `{ doc, run }` у `packet`, подписи — `SimResult` или `{ doc, run }`. Разделы:

- `steps`, `annotations`, `tasks` — как раньше;
- `labels` — обязателен, если `lesson.ts` перечисляет `labels: [...]`: `{ name, note? }` на сущность;
- `feedback` — необязательный: `{ [код]: string | (message) => string }` по кодам `Message` вида.

Реестр видит тексты без проверки ключей (`LooseLessonTexts` с функциями от `unknown`): `import.meta.glob` и так их не проверяет. Плеер зовёт функции текста с данными вида урока; тест контента проверяет, что урок использует вид своего курса.

Вывод типов: у `BoardKind<T>` есть фантомное поле `types?: T` — по индексированным типам `T['Doc']` TypeScript вид не выводит.

### D4. Код с уроком неизвестного вида

Реестр отдаёт `AnyLesson` (union уроков видов). Общий код — функции `<T extends KindTypes>(lesson: LessonDefinition<T>) => …`. Вход в них — `withLesson(lesson, run)`: сужение по `lesson.board` и вызов `run` с уроком своего вида. Плеер (`update`, `advanceFrame`, `view`), `main.ts` (`initLesson`, `goToLessonStep`), реестр (палитры курса) и тест контента входят так.

### D5. Поверхности задачи

- Задача: `surfaces?: ReadonlyArray<T['Surface']>`, по умолчанию доска. Id поверхности — `тип[:устройство]`: `wifi:phone`, `terminal:laptop`, `router`.
- Вид перечисляет `SurfaceDefinition` с `type`, `feature` (префикс `UiFeature`), `init(target)`, `update(context)`, `tabLabel`, `view`. Model и Message поверхности хранятся в `SurfaceState`/`SurfaceMessage`; определение само сворачивает свой подмодуль (`Update.foldChild` с линзой по union), плеер видит только union.
- `update` отдаёт `ProducedOps(ops)`. Плеер применяет ходы вместе: первый отказ отменяет все и показывает тост, иначе ходы дописываются в журнал задачи. Тот же путь у ходов с доски (`ProposedOps`). Поэтому отмена, повтор, сброс, «Проверить» и «Показать решение» работают без изменений.
- `SurfaceContext`: документ, расчёт, режим (`Edit` только у открытой задачи), устройство, подписи, открытые элементы курса и `maybeGhost` — эталон задачи после третьей подсказки (поверхность обводит нужное поле, не подставляя значения).
- Хост в плеере: состояния поверхностей всех задач урока создаются при входе в урок; вкладки (`role=tab`) и панель видны только в шаге задачи и только для поверхностей, открытых курсом (`isSurfaceOpen(unlocked, feature)`). Раскладка: под доской и приборами; на телефоне вкладки во всю ширину.
- Проверочная поверхность `wifi:<устройство>`: сети точек доступа на доске, пароль, «Подключиться» → `JoinWifi`. Полный экран телефона — `add-terminal-and-browser`.

### D6. Вид `packet` до доски сетей

- `PacketOp = Edit { op: NetOp } | Send { intent }`; документ `{ net, state, traces }`: `Edit` правит сеть, `Send` считает трассу и оставляет состояние сети и трассу (её проиграет доска). `run` — `settle`: хосты на DHCP получили адреса; цели модели пакетов проверяются на нём.
- Сцена: `highlight`, `annotate`, `play(intent)` (трасса показывается, состояние не меняется), `pauseAt(device)`, `openEnvelope(level)`, `showTable(device, table)`.
- Цели: устройство, `link:<id>`, `env:<уровень>`; `zone:<id>` появится с планом квартиры.
- Доска — заготовка: список устройств с подписями из `labels`, выбор устройства в режиме `Pick`, трасса сцены по кадрам, кнопка «Пуск», если курс открыл `transport.run`.
- Когда влито `extend-packet-model`: `PacketOp` сводится к `NetOp` (там есть `Send`, `RunCommand`, `Wait`), `applyPacketOp` — к `applyWorld`, `renderMessage` — к `renderNetMessage`.

### D7. Тесты

- Story-тесты плеера System Design и Scene-тесты корня — прежние сценарии; меняется только доступ к Model (журнал через `opsOf`, доска через линзу).
- Тест контента — через контракт для каждого урока любого вида: вид курса, операции без отказов, задача не решена на старте и решается эталоном, цели сцены и ссылок на доске, подписи `labels` существуют, поверхности задачи есть у вида и открыты курсом, тексты не пустые.
- Вид `packet`: `kinds/packet/kind.test.ts` (свёртка, `send`, цели, цели ссылок, журнал), `story.test.ts` (поверхность пишет в журнал, отмена, «Показать решение», вкладки), `scene.test.ts` (вкладка Wi-Fi в шаге задачи, подключение отмечает цель).
- `lesson/texts.test.ts`: полнота текстов проверяется типами для обоих видов.

## Risks / Trade-offs

- [Фантомное поле `types?` в контракте] → Единственный способ вывести `T` из вида без приведений; поле описано и не используется во время работы.
- [Union хранения растут с каждым видом и поверхностью] → Это и есть требование «Model только из Schema»; линзы держат знание о union внутри вида.
- [Итог «было → стало» считается при каждом показе] → Две симуляции на шаге решённой задачи; дешевле, чем кадр анимации.
- [Заготовка доски сетей видна в сборке] → Уроки сетей недоступны (`available: false`), без `lesson.ts`.

## Migration Plan

Хранимых данных нет (прогресс гостя не сохраняется). Откат — вернуть плеер и уроки к прежнему DSL одним коммитом.
