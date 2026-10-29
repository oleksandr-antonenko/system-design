# План B: «Урок как сценарий» — Board Ops DSL + контент-пайплайн

Стек: `foldkit@0.169.0` (бета), `effect@4.0.0`, `@effect/platform-browser@4.0.0`, Vite, Tailwind. API Foldkit сверены с `.d.ts` пакета; непроверенное помечено «(сверить)».

## 1. Суть подхода

Курс — это **повествование**: 13 уроков × ~15 шагов × задачи. Узкое место — не точность симулятора и не богатство редактора, а **производство и согласованность контента**. Поэтому центр системы — сценарий.

Урок — таймлайн **битов**: фрагмент теории + список операций над доской (+ необязательная пауза-задача). Главное решение: **авторские демонстрации и действия ученика выражены одним языком** — Schema-union `BoardOp`. Доска всегда равна `fold(applyOp, начальное, ops)`. Бесплатно получаем:

- **перемотку** теории и deep-link на любой шаг (свёртка префикса);
- **undo/redo** ученика (лог ops + пересвёртка от снимка начала задачи);
- **реплей** решения и «Показать решение» (проигрывание эталонных ops);
- **сериализацию** прогресса — `Schema.encode` массива ops;
- **проверку** — сопоставление графа с паттернами/инвариантами;
- **верификацию контента на сборке**: эталон проходит чекер, стартовое состояние — нет;
- **авторский рекордер**: UI доски эмитит те же ops — автор собирает сцену мышью и копирует YAML.

Состояние доски — три слоя с разной семантикой времени:

| Слой | Что | Время жизни |
|---|---|---|
| `graph` | узлы, рёбра, группы | накапливается через биты; undo ученика |
| `env` | нагрузка, отказы узлов | накапливается через биты |
| `stage` | подсветка, аннотации, камера, «полёты» запросов | только текущий бит |

Локальность `stage` делает перемотку корректной по построению: подсветки не надо «отменять».

## 2. Учебная программа

Палитра раскрывается монотонно; новый компонент помечен «новое».

| № | Урок | Новые компоненты | Задача на доске |
|---|---|---|---|
| 1 | Один сервер: запрос и ответ | Клиент, Сервер | Соединить клиента с сервером; увидеть ошибки при 600 rps |
| 2 | Отделяем базу данных | База данных | Вынести БД из монолита |
| 3 | Балансировщик, горизонтальное масштабирование | Балансировщик | LB перед тремя серверами (§6) |
| 4 | Кеширование | Кеш | Нагрузка на БД < 300 rps при 2000 rps, 90% чтений |
| 5 | CDN и статика | CDN, Объектное хранилище | Увести статику через CDN |
| 6 | Репликация БД | Реплика БД | Чтения на реплики, записи на primary; 5× рост чтений |
| 7 | Очереди | Очередь, Воркер | Вынести обработку видео из пути запроса; p99 < 200 мс |
| 8 | Шардирование | Шард-роутер | Разнести данные; найти «горячий» шард |
| 9 | API Gateway, rate limiting | API-шлюз, Лимитер | Пережить 10× всплеск ботов |
| 10 | Отказоустойчивость, SPOF | Зона доступности, `replicas` | Пережить отказ **любого** узла |
| 11 | Мульти-регион, CAP | Регион, Geo-DNS | Два региона, ближайший маршрут, репликация |
| 12 | Поиск и события | Поисковый индекс, Лог событий | БД → лог → индекс (CQRS) |
| 13 | Итог: сокращатель ссылок | вся палитра | 10k rps, p99 < 100 мс, отказ узла |

С урока 10 «кластер» — узел `app-server` со свойством `replicas` (степпер на узле), раньше серверы — отдельные узлы: нагляднее.

## 3. UX урока

```
┌──────────── Шапка: урок 3/13 · таймлайн битов ●●●◆○○○ ────────────┐
│ ТЕОРИЯ (40%)              │ ПАЛИТРА │ ДОСКА (SVG + canvas)       │
│ ▸ прошлые биты (приглуш.) │ Клиент  │   [LB]──▶[app1]  ◉ ◉ ◉    │
│ ▶ ТЕКУЩИЙ БИТ             │ Сервер  │         ╲▶[app2]           │
│ ◆ карточка задачи         │ LB ⋆нов │ HUD: 1000 rps · ошибки 0%  │
│ ◀ Назад  ▶ Далее  ⏯ Авто  │         │ [↶][↷][Сброс][Трафик ▶]    │
└──────────────────────────────────────────────────────────────────┘
```

**Синхронизация.** Будущие биты скрыты. «Далее» (→/Пробел) применяет ops следующего бита; внутри бита `wait: click | 600` делит ops на шаги. Клик по прошлому биту перематывает доску; URL — `/lesson/load-balancer/7`. Термины `:node[…]{ref=lb}` подсвечивают узел при наведении и обратно. Камера плавно следует `focus`.

**Задача.** Бит-задача ставит таймлайн на паузу (◆). В теории — карточка: формулировка, чек-лист критериев (`visible: false` скрывает спойлеры), «Проверить», «Подсказка», «Сбросить». Доска переходит в режим правки: палитра показывает разрешённые виды, авторские `locked`-узлы — с замком.

**Подсказки** — три уровня: наводка `hint[0]`; явная `hint[1]` + подсветка узлов проваленной цели; «призрак» — полупрозрачный следующий шаг из диффа граф ученика ↔ эталон. После трёх попыток — «Показать решение»: откат и анимированное проигрывание эталонных ops.

**Обратная связь.** Неудача: текст первой проваленной цели, красная пульсация её `highlight`; для метрической цели автоматически пускается трафик — ученик *видит* перегруженную БД. Успех: зелёная волна, «было → стало» («БД: 1800 → 180 rps»), переход дальше.

## 4. Архитектура на Foldkit

```ts
const Page = defineTaggedUnion({                       // foldkit/schema
  Home: {}, CourseMap: { map: CourseMap.Model },
  Lesson: { player: LessonPlayer.Model }, NotFound: {},
})
export const Model = Schema.Struct({ route: AppRoute, progress: Progress, page: Page })
```

**Submodels:**
- `LessonPlayer` — `{ lesson: CompiledLesson, cursor: { beat, step }, mode, board, sim, session: Option<EditSession> }`. Скомпилированный урок лежит в Model — time-travel DevTools видит всё.
- `Board` — `{ doc, camera, selection, interaction: Idle | DraggingNode | Connecting | Panning | PlacingFromPalette }`. Board **не меняет граф сам**: действие ученика уходит OutMessage `ProposedOp{op}`; родитель через `Update.foldChild({ update, read, write, toParentMessage, foldOutMessage })` проверяет правила задачи (разрешённые виды, `locked`), применяет op, пишет в лог и возвращает доску через `Board.reflectDoc` (паттерн `Submodel.Reflect`).
- `Sim` — частицы, часы, кеш steady-state. `EditSession` — `{ base, log, redo, attempts, hintLevel, lastResult }`. `CourseMap` — навигатор.

**Messages:** `ClickedNextBeat`, `ClickedBeatInOutline{index}`, `HoveredTermRef{ref}`, `ClickedCheckSolution`, `ClickedHint`, `ClickedUndo`/`ClickedRedo`, `ClickedShowSolution`, `GotBoardMessage{message}`, `TickedSimFrame{deltaMs}`, `SucceededLoadLesson{lesson}`, `ChangedUrl`, `RequestedUrl`.

**Commands:** `LoadLesson{slug}` — динамический `import()` JSON + повторный decode Schema (сверить имя функции в Effect 4); `SaveProgress` — `Command.define(…, { interrupt: true, … })` со `Effect.sleep` внутри: новый вызов прерывает старый, это дебаунс; `ScrollTheoryToBeat` через `Render.afterCommit`.

**Subscriptions:** `Subscription.animationFrameEntry({ isActive: isSimRunning, toMessage: deltaMs => TickedSimFrame({ deltaMs }) })` (delta ≤ 32 мс); таймер для `wait: 600`; глобальные хоткеи ←/→, Ctrl+Z.

**Routing:** `defineRouteUnion({ Home, Course, Lesson: { slug, beat: optional }, NotFound })` + `literal`, `schemaSegment`, `int`, `oneOf`, `mapTo`. Смена бита — replace URL без засорения истории (сверить в `foldkit/navigation`).

**Прогресс:** `{ version: 1, lessons: Record<LessonId, { status, lastBeat, tasks: Record<TaskId, { solved, attempts, hintsUsed, solution: BoardOp[] }> }> }` в `localStorage`. Загрузка через Flags: `Runtime.run(app, { flags: loadProgress })`, `loadProgress: Effect<Progress>` с fallback. Миграции — версионированный Schema-union.

```
content/course.yaml, content/lessons/03-load-balancer.lesson.md
src/main.ts entry.ts route.ts
src/domain/   graph.ts boardOp.ts applyOp.ts nodeCatalog.ts   ← чистый TS+Effect
src/script/   lesson.ts timeline.ts (seek, keyframes)
src/check/    goal.ts match.ts evaluate.ts checkers/
src/sim/      steadyState.ts particles.ts prng.ts
src/board/    model.ts update.ts pointer.ts(Mount) view/{nodes,edges,overlay,palette}.ts
src/lesson/   LessonPlayer   src/course/ CourseMap   src/progress/
tools/content/ parse.ts desugar.ts validate.ts verify.ts vite-plugin.ts cli.ts
test/         unit/ stories/ scenes/ content/
```

`domain`, `check`, `sim` не зависят от Foldkit — их переиспользует компилятор контента.

## 5. Доска

**Рендер.** Узлы и рёбра — SVG через `h` (`svg`, `g`, `path`, `rect`, `text`, `marker`, `defs`): нативный hit-testing, `Role`/`AriaLabel`, фокус, локаторы в Scene. Статика обёрнута в `createLazy`, тики её не трогают. **Частицы — отдельный `Canvas.view`** поверх (`pointer-events: none`): один элемент вместо сотен vnode. Pan/zoom — `ViewBox` из `camera`.

**Указатель через `Mount.defineStream`.** По `.d.ts` `OnPointerMove` даёт лишь `screenX/Y`, `OnWheel` — без delta: для drag в координатах доски и зума мало. Корень раскладки урока получает `h.OnMount(BoardPointer())`; Mount слушает `pointer*`/`wheel`, переводит координаты через `getScreenCTM().inverse()`, ищет цель `closest('[data-node-id]')`, делает `setPointerCapture` и эмитит `PressedBoard`, `MovedPointer`, `ReleasedPointer`, `WheeledBoard`. Один Mount покрывает палитру и доску — перенос без HTML5 DnD.

**Взаимодействия:** палитра — drag **или** клик (узел в центр вида — доступный путь); перемещение — превью в `interaction`, в лог один `MoveNode` при отпускании; соединение — «ручка» на узле → линия-превью → `Connect` (запрещены лишь петли и дубли, остальное судит чекер); клавиатура — Tab по узлам, `C` соединить, Delete, стрелки, Esc; Shift+клик и «Сгруппировать» → `GroupNodes`. Undo: последний op уходит в `redo`, `doc = applyAll(base, log)` — пересвёртка вместо инверсных ops: графы < 60 узлов, корректность по построению.

```ts
export const Node = Schema.Struct({ id: NodeId, kind: NodeKind, pos: Point,
  props: NodeProps, locked: Schema.Boolean })
export const Graph = Schema.Struct({ nodes: Schema.Record(NodeId, Node),  // сверить v4
  edges: Schema.Record(EdgeId, Edge), groups: Schema.Record(GroupId, Group) })

export const BoardOp = defineTaggedUnion({
  AddNode: { id: NodeId, kind: NodeKind, pos: Point }, RemoveNode: { id: NodeId },
  MoveNode: { id: NodeId, pos: Point }, SetProps: { id: NodeId, patch: NodePropsPatch },
  Connect: { id: EdgeId, from: NodeId, to: NodeId }, Disconnect: { id: EdgeId },
  GroupNodes: { id: GroupId, kind: GroupKind, members: Schema.Array(NodeId) },
  SetLoad: { rps: Schema.Number, rampMs: Schema.Number },          // env
  FailNode: { id: NodeId }, RecoverNode: { id: NodeId },           // env
  Highlight: { targets: Schema.Array(Target), tone: Tone },        // stage
  Annotate: { target: Target, text: Schema.String },
  Focus: { targets: Schema.Array(Target) }, Flow: { path: Schema.Array(NodeId) },
})
export const applyOp = (doc: BoardDoc, op: BoardOp): Result.Result<BoardDoc, OpError> => …
```

`applyOp` — тотальная чистая функция с типизированными ошибками (`UnknownNode`, `DuplicateId`, `LockedNode`): компилятор показывает их автору, рантайм — отклоняет ход ученика.

## 6. Формат контента

**Выбор: Markdown + `remark-directive` + YAML-блоки ops/goals.** TS-DSL отвергнут: русская проза в шаблонных строках плохо читается и ревьюится и закрывает дорогу методистам-непрограммистам. Типобезопасность возвращаем иначе: YAML декодируется **теми же Effect Schema**, что и рантайм.

**Пайплайн** (`tools/content`): parse → **desugar** (`connect: [a, b]` → `Connect` с id; `at: { right-of: lb }` → координаты сетки; `wait` → границы шагов) → **validate** (decode, ссылки, палитра задачи ⊆ разблокированной, `:node[]{ref}` существует) → **verify** (свёртка всех битов; эталон проходит; старт и контрпримеры — нет) → JSON + keyframes (снимок на начало бита для O(1) перемотки). Vite-плагин делает `.lesson.md` модулем, ошибки — в оверлей с `файл:строка`; live reload Foldkit сохраняет Model, автор остаётся на том же бите. Тот же код — CLI `content:check` в CI.

````markdown
---
id: load-balancer
title: Балансировщик нагрузки и горизонтальное масштабирование
requires: [separate-database]
unlocks: [load-balancer]
initialBoard: { from: separate-database }   # client → app1 → db
---

::: beat{#overload}
Пользователей стало впятеро больше. :node[Сервер]{ref=app1} держит около
**500 rps**, а приходит 1000 — половина запросов падает.
```ops
- focus: [client, app1, db]
- load: { rps: 1000, rampMs: 2000 }
- wait: click
- highlight: { targets: [app1], tone: danger }
- annotate: { target: app1, text: "CPU 100% · ошибки ≈ 50%" }
```
:::

::: beat{#scale-out}
Купить машину мощнее — **вертикальное масштабирование**: есть потолок и цена.
Другой путь — **горизонтальное**: несколько одинаковых серверов. Но клиент знает
один адрес; нужен посредник — **балансировщик нагрузки**.
```ops
- add: { id: app2, kind: app-server, at: { below: app1 } }
- wait: 500
- add: { id: app3, kind: app-server, at: { below: app2 } }
- connect: [app2, db]
- connect: [app3, db]
- annotate: { target: [app2, app3], text: "Простаивают: клиент о них не знает" }
```
:::

::: task{#place-lb title="Поставьте балансировщик" palette=[load-balancer] continue=canonical}
Сделайте так, чтобы **все** запросы клиентов распределялись между тремя серверами.
```goals
- id: lb-exists
  label: На доске есть балансировщик
  exists: { kind: load-balancer, as: lb }
  hint: ["Загляните в палитру.", "Перетащите «Балансировщик» на доску."]
- id: lb-fans-out
  label: Балансировщик знает обо всех серверах
  edges: { from: $lb, to: { kind: app-server }, min: 3 }
  hint: ["Сколько серверов должны получать запросы?", "Соедините LB с app1, app2, app3."]
- id: only-through-lb
  label: Клиенты ходят только через балансировщик
  allPaths: { from: { kind: client }, to: { kind: app-server }, through: $lb }
  hint: ["Есть ли у клиента обходной путь?", "Удалите связь клиент → app1."]
- id: holds-load
  visible: false
  metric: { of: { kind: app-server }, value: errorRate, max: 0.01, under: { rps: 1000 } }
```
```solution
- disconnect: [client, app1]
- add: { id: lb, kind: load-balancer, at: { left-of: app2 } }
- connect: [client, lb]
- connect: [lb, app1]
- connect: [lb, app2]
- connect: [lb, app3]
```
```counterexample{expect=only-through-lb}
- add: { id: lb, kind: load-balancer, at: { left-of: app2 } }
- connect: [client, lb]
- connect: [lb, app1]
- connect: [lb, app2]
- connect: [lb, app3]
```
:::

::: beat{#health-check}
LB раздаёт запросы **по кругу** — по ≈ 333 rps. А если сервер упадёт?
**Health check** исключает его, остальные берут нагрузку на себя.
```ops
- flow: { path: [client, lb, app1] }
- fail: app2
- wait: click
- annotate: { target: lb, text: "app2 не отвечает → исключён" }
- annotate: { target: [app1, app3], text: "500 rps — на пределе" }
```
:::

::: beat{#summary}
**Итог:** серверы без состояния + балансировщик = горизонтальное масштабирование.
Но все три сервера бьют в одну :node[БД]{ref=db} — тема следующего урока.
```ops
- recover: app2
- highlight: { targets: [db], tone: warning }
```
:::
````

`continue=canonical`: после успеха доска «морфингом» перестраивается в эталон, чтобы следующие биты могли ссылаться на `lb`; «Сравнить с моим» показывает решение ученика.

## 7. Проверка задач

Цели — закрытый словарь предикатов (Schema-union `Goal`), а не сравнение с картинкой:
- структурные: `exists{kind, as, count}`, `edges{from, to, min|all}`, `noEdge`, `allPaths{from, to, through}`, `reachable`;
- метрические: `metric{of, value: rps|utilization|errorRate|p99|hitRate, min|max, under}` — через steady-state решатель (§8);
- устойчивость: `survivesFailure{of}` — решатель при отказе каждого узла по очереди;
- запасной выход: `custom: <id>` — TS-чекер из `src/check/checkers/`, id проверяет компилятор.

Роли (`as: lb` → `$lb`) связываются поиском с возвратом по кандидатам нужного `kind` — графы маленькие. `evaluate(goals, doc) → Pass{bindings} | Fail{failures: [{goalId, hint, highlight}]}`; цели проверяются по порядку, показывается первая проваленная. `highlight` вычисляет предикат (для `allPaths` — обходной путь). На каждый op идёт тихая оценка для ✓ в видимом чек-листе.

**Пример 1 — «балансировщик перед тремя серверами»:** цели из §6. `allPaths` перебирает простые пути клиент→сервер (DFS) и падает на первом без `$lb`. Два балансировщика или LB → шлюз → серверы тоже проходят: предикаты описывают свойство, а не форму.

**Пример 2 — «кеш, чтобы нагрузка на БД < 300 rps»:**

```yaml
- id: cache-exists
  exists: { kind: cache, as: cache }
  hint: ["Что может отвечать на чтения вместо БД?", "Добавьте «Кеш»."]
- id: servers-use-cache
  edges: { from: { kind: app-server }, to: $cache, all: true }
  hint: ["Все ли серверы знают о кеше?", "Соедините каждый сервер с кешем."]
- id: db-relieved
  metric: { of: { kind: database }, value: rps, max: 300, under: { rps: 2000, readRatio: 0.9 } }
  hint: ["Сколько запросов доходит до БД?", "В БД идут все записи + промахи: 200 + 1800 × (1 − hit rate)."]
```

`db-relieved` зовёт `steadyState(graph, { rps: 2000, readRatio: 0.9 })`. При `hitRate = 0.9` в БД идёт 200 + 180 = 380 rps → провал. Ученик увеличивает кеш (`SetProps`, hit rate 0,95 → 290 rps) или добавляет реплику: задача — маленькое исследование, а не угадывание единственного ответа.

## 8. Симуляция и визуализация

1. **Steady-state решатель** (`sim/steadyState.ts`) — чистая детерминированная `(graph, env, workload) → NodeMetrics`. Топологический обход; поведение — из каталога видов: клиент эмитит λ; LB делит поровну между здоровыми потомками; сервер обслуживает `min(λ, μ·replicas)`, избыток — ошибки; кеш отвечает на `hitRate` чтений, промахи и записи пропускает; реплики берут чтения, primary — записи; очередь сглаживает до μ воркеров и копит backlog. ρ = λ/μ, задержка узла `base/(1−ρ)` при ρ ≤ 0,99, p99 — эвристика. Решатель обслуживает бейджи, чекеры и компилятор.
2. **Частицы** (`sim/particles.ts`): на `TickedSimFrame` рождаются точки пропорционально rps (лимит ~200), маршрут сэмплируется из долей решателя seeded-PRNG (seed = id бита) — демо воспроизводимы. Зелёный — ответ, оранжевый — промах кеша, красный — ошибка. `Flow` — авторская трассировка одного запроса.

На доске: бейдж rps и полоса загрузки (жёлтая > 70%, красная > 95%), HUD «rps · ошибки · p99», рост бэклога. `load: { rampMs }` плавно меняет λ; пересчёт решателя на тике — O(V+E).

## 9. Тестирование

- **Unit** (vitest): `applyOp`, решатель (контрольные числа §7), матчер, desugar.
- **Свойства** (fast-check; арбитрари из Schema — сверить в v4): `decode(encode(doc)) = doc`; `undo ∘ do = id`; seek через keyframes = свёртка с нуля.
- **Story**: `Story.story(update, Story.given(m), Story.message(msg), Story.model(assert))` — переходы битов, цикл задачи (ops → `ClickedCheckSolution` → Fail с `goalId` → подсказка → Pass), `SaveProgress` в командах, отказ `ProposedOp` для `locked`. Drag-логика — здесь же синтетическими `PressedBoard/MovedPointer`: хуки Mount в Scene не исполняются.
- **Scene**: `Scene.click(Scene.role('button', { name: 'Балансировщик' }))`, `Scene.keydown(…, 'c')`, «Проверить» → `Scene.expect(Scene.text(/только через балансировщик/)).toExist()`. Побочный плюс: у каждого действия обязан быть путь без мыши.
- **Контент (CI)**: decode, ссылки, свёртка всех битов без `OpError`, монотонность палитры, эталон проходит, старт и контрпримеры падают на ожидаемой цели, нет NaN в метриках, golden-снимки графа на конец бита.
- **E2E** (Playwright, 1–2 сценария): реальный drag и зум.

## 10. MVP и фазы

- **Фаза 0 — спайк (1 нед.):** scaffold SPA, SVG-доска с Mount-указателем, 3 вида узлов, `applyOp` + undo; замер 50 узлов + частицы на 60 fps.
- **Фаза 1 — MVP:** BoardOp, плеер с перемоткой и deep-link, компилятор + Vite-плагин + `content:check`, цели `exists/edges/allPaths/metric`, решатель и частицы, подсказки 1–2, прогресс, карта курса, **уроки 1–4**.
- **Фаза 2:** уроки 5–9, «призрак», «Показать решение», реплей решений, песочница, авторский рекордер `/author`.
- **Фаза 3:** уроки 10–13, `survivesFailure`, регионы, `continue=student` (следующие биты идут по доске ученика через привязки `$lb`), SSG теории через `foldkit/experimental/server`.

## 11. Риски и компромиссы

- **«Слайдшоу».** Сценарий ведёт за руку; `continue=canonical` подменяет «мою» доску эталоном. Смягчение: морфинг, «Сравнить с моим», песочница, `continue=student` в фазе 3. Но привязка ролей сложна: ops должны быть устойчивы к чужой раскладке, а компилятор не переберёт все решения учеников.
- **Ложные отказы чекера.** Нестандартная, но верная архитектура может провалить структурную цель. Смягчение: инварианты и метрики вместо формы, тесты альтернативных решений, кнопка «Не согласен» с JSON графа. Полностью риск не снимается.
- **Цена пайплайна до первого урока.** Парсер, desugar, ошибки с позициями, Vite-плагин — недели инфраструктуры; ручные координаты утомительны до появления рекордера (фаза 2).
- **Дрейф прозы и ops.** «Три сервера» в тексте при четырёх в ops компилятор не поймает; помогают лишь `:node[]{ref}` и ревью golden-снимков.
- **Упрощённость модели.** Аналитика может учить неверной интуиции о хвостах задержек; цифры подписаны как «модель».
- **Бета Foldkit + свежий Effect 4.** Точные версии без `^`, тонкий слой `src/platform/`, экспериментальные API — только в фазе 3.
- **60 fps через Elm-цикл.** Каждый тик — Message + update + diff. Смягчение: `createLazy`, canvas, лимит частиц, запасной режим 30 fps.

## 12. Разбиение на OpenSpec

| # | change | capability |
|---|---|---|
| 1 | `bootstrap-foldkit-app` | `app-shell`, `routing` |
| 2 | `add-board-graph-model` | `board-graph` |
| 3 | `add-board-ops-dsl` | `board-ops` (BoardOp, `applyOp`, слои graph/env/stage) |
| 4 | `add-board-canvas` | `board-canvas` (рендер, камера, Mount-указатель, палитра, a11y) |
| 5 | `add-edit-session` | `edit-session` (лог, undo/redo, `locked`) |
| 6 | `add-lesson-script-model` | `lesson-script` (биты, keyframes, seek) |
| 7 | `add-content-pipeline` | `content-pipeline` (парсер, desugar, валидация, Vite, CLI) |
| 8 | `add-lesson-player` | `lesson-player` (синхронизация, транспорт, deep-link) |
| 9 | `add-traffic-simulation` | `traffic-simulation` |
| 10 | `add-flow-visualization` | `flow-visualization` |
| 11 | `add-task-checking` | `task-checking` (Goal, матчер, подсказки, обратная связь) |
| 12 | `add-content-verification` | `content-verification` |
| 13 | `add-progress-persistence` | `progress` |
| 14 | `add-course-navigator` | `course-navigator` (карта, гейтинг, раскрытие палитры) |
| 15 | `add-lessons-foundations` | `curriculum` (1–4) — **граница MVP** |
| 16 | `add-solution-replay-and-ghost-hints` | меняет `task-checking`, `lesson-player` |
| 17 | `add-authoring-recorder` | `authoring-tools` |
| 18 | `add-lessons-scaling` | меняет `curriculum` (5–9) |
| 19 | `add-resilience-goals` | меняет `task-checking`, `board-graph` |
| 20 | `add-lessons-distributed` | меняет `curriculum` (10–13) |
| 21 | `add-student-continuation` | меняет `lesson-script`, `task-checking` |
| 22 | `add-static-prerender` | `prerender` |
