# План A: чистая TEA, SVG-доска и детерминированный симулятор

> Курс System Design на Effect-TS + Foldkit (`foldkit@0.169.0`, `effect@4.0.0`). API сверены с `dist/**/*.d.ts`; спорные места помечены «(сверить)».

## 1. Суть подхода

Всё, что видит ученик, — это функция от одного `Model`:

- **граф системы** — Schema-тип;
- **доска** — SVG, построенный через `h`, без сторонних графовых библиотек и без `Mount`;
- **симулятор** — чистая функция `step(graph, state, scenario, dt) → state` в слое `domain/` без импортов Foldkit, её тикает `Subscription.animationFrameEntry`;
- **урок** — типизированный TS-модуль данных;
- **проверка задачи** — чистые предикаты над графом и над результатом headless-прогона симулятора.

Почему это лучший вариант для продукта:

1. **Честная и воспроизводимая проверка.** Логический шаг фиксирован. Поэтому вердикт «БД < 200 RPS» не зависит от FPS, фоновой вкладки или CPU. Любую жалобу «не засчитало» можно воспроизвести по тройке `graph + scenario + seed`.
2. **Контент тестируется в CI.** Эталонное решение каждой задачи обязано проходить чекер, стартовая доска — не проходить. Правка формулы кеша не сломает 13 уроков незаметно.
3. **Один источник правды.** Если подключить графовую библиотеку через `Mount`, появятся два состояния (библиотеки и `Model`), а их синхронизация — главный источник багов. У нас позиции, выделение, жест и undo живут в `Model`. Отсюда time-travel в DevTools, live reload с сохранением состояния, deep link на шаг урока и Story-тесты любого сценария.
4. **Масштаб позволяет.** Учебная доска — это не больше 40 узлов и 80 рёбер. SVG с keyed-диффингом Snabbdom с этим справляется.
5. **Меньше швов с бета-фреймворком.** Около 70% логики — чистый TS и Schema, а ломающие изменения Foldkit задевают только тонкие слои `app/`, `board/` и `lesson/`.

## 2. Учебная программа

У каждого компонента в каталоге есть ёмкость (RPS), задержка, условная цена в час и правила соединений. Цена не даёт решить задачу «50 серверами». Палитра показывает только компоненты, открытые к текущему уроку.

| # | Урок | Открывается | Задача на доске | Проверка |
|---|------|-------------|-----------------|----------|
| 0 | Как устроена доска | Клиент, Сервер | Соединить клиента с сервером, запустить трафик | Структура |
| 1 | Один сервер: RPS, задержка, ёмкость | Размер сервера | Выдержать 300 RPS как можно дешевле | Симуляция + бюджет |
| 2 | Состояние и БД | БД | Вынести данные в БД, сервер сделать stateless | Структура |
| 3 | Горизонтальное масштабирование | Балансировщик | Балансировщик перед 3 серверами: 900 RPS, ошибок < 1% | Структура + симуляция |
| 4 | Кеширование (cache-aside) | Кеш | Нагрузка на БД < 200 RPS при 1000 RPS | Симуляция |
| 5 | Статика и CDN | CDN, объектное хранилище | Разгрузить серверы, когда статика — 70% трафика | Симуляция |
| 6 | Репликация БД | Реплика чтения | Чтения на реплики, записи на primary, p95 < 150 мс | Структура + симуляция |
| 7 | Кластеры и отказы | Кластер (реплики, health check, автоскейлинг) | Пережить отказ сервера на 15-й секунде, доступность ≥ 99% | Симуляция со сбоем |
| 8 | Асинхронность | Очередь, Воркер | Пик 3×: 0 ошибок, бэклог разобран за ≤ 30 с | Симуляция |
| 9 | Защита от перегрузки | API Gateway / rate limiter | Бот шлёт 5000 RPS, легитимные пользователи не страдают | Симуляция |
| 10 | Шардирование | Роутер шардов | 6000 записей/с: три шарда, горячий ключ | Симуляция |
| 11 | Регионы и CAP | Регион, GeoDNS | Отказ региона, выбор sync или async репликации | Симуляция + выбор |
| 12 | Итоговый проект: сокращатель ссылок | Все | SLO: p95 < 200 мс, доступность ≥ 99.9%, стоимость ≤ бюджета | Только SLO |

## 3. UX урока

**Раскладка (≥ 1024px).** Слева панель теории (≈ 38%): текст шага, «Назад»/«Далее», точки шагов. Справа доска (≈ 62%): палитра сверху, HUD снизу (спарклайны, ▶/⏸, скорость, ползунок нагрузки), инспектор выделенного узла выезжает справа. На узком экране доска уходит под текст и в MVP работает только на просмотр.

**Синхронизация.** Каждый шаг несёт `BoardDirective`: сцену или патч, подсветку, камеру и режим симуляции. Доска на шаге N — свёртка директив 0..N (`boardAt`), поэтому «Назад» и deep link `?step=3` дают одну и ту же картинку. При наведении на ссылку `[[lb|балансировщик]]` подсвечивается узел, и наоборот.

**Задача.** Шаг `task` переводит доску в режим редактирования. В панели теории появляется карточка: цель, ограничения и живой чек-лист структурных критериев (✓/✗), который пересчитывается при каждом изменении графа. Метрика-цель рисуется в HUD линией: «БД: 340 / цель < 200». Подсказки идут в три уровня: намёк → концепция → действие. «Показать решение» появляется после трёх неудачных проверок, и задача засчитывается «с подсказкой».

**Обратная связь.** «Проверить» мгновенно прогоняет сценарий headless: 60 логических секунд — это 1200 шагов по 50 мс, миллисекунды CPU. Затем результат проигрывается вживую. Проваленный критерий даёт сообщение на русском и `focus` — узлы, которые обводятся красным и получают выноску. Успех даёт зелёную обводку, сравнение «до и после», активную кнопку «Далее» и сохранение прогресса.

## 4. Архитектура на Foldkit

```ts
export const Page = defineTaggedUnion({            // foldkit/schema
  Catalog: {}, Lesson: { lesson: LessonPlayer.Model },
  Sandbox: { board: Board.Model, sim: SimModel }, NotFound: { path: Schema.String },
})
export const Model = Schema.Struct({ route: AppRoute, progress: Progress, page: Page })
```

**Submodels.** Их два, всё остальное — view-функции.

- **`Board`** — граф, `mode` (`ReadOnly | Editing{palette}`), `viewport`, `selection`, `gesture`, `history`, `highlights`, `nextSeq`. Наружу отдаёт OutMessage `ChangedGraph`. Входящие изменения принимает через setter-ы `Submodel.Reflect` (`Board.reflectScene`, `reflectHighlights`): мир → доска, без эха. Переиспользуется в песочнице.
- **`LessonPlayer`** — `lessonId`, `stepIndex`, `board`, `sim`, `task: Option<TaskState>`. Встраивается через `Update.foldChild({ update, read, write, toParentMessage })`. Board внутри него встроен так же. В `foldOutMessage` на `ChangedGraph` пересчитывается чек-лист и перекомпилируется граф для симулятора.

**Messages.** У `LessonPlayer`: `ClickedNextStep`, `TickedFrame`, `ChangedSpeed`, `ClickedCheck`, `ClickedHint`, `GotBoardMessage`. У `Board`: `PressedPaletteItem`, `PressedNode`, `PressedPort`, `MovedPointer`, `ReleasedPointer{overNodeId}`, `PressedUndo`.

**Commands** нужны только для эффектов: `SaveProgress` (`Command.define` с записью в localStorage) и `FocusNode`. Прогресс загружается при старте: `Runtime.run(app, { flags: loadProgress })` через `FlagsSchemaConfig`. При ошибке декодирования возвращается пустой прогресс.

**Subscriptions:**

```ts
Subscription.make<Model, Message>()(entry => ({
  simFrame: Subscription.animationFrameEntry({
    isActive: model => model.sim.status === 'Running',
    toMessage: deltaTime => Message.TickedFrame({ deltaMs: deltaTime }),
  }),
  pointer: entry({ isGesturing: Schema.Boolean }, {
    modelToDependencies: model => ({ isGesturing: model.board.gesture._tag !== 'Idle' }),
    dependenciesToStream: ({ isGesturing }) =>
      Stream.when(documentPointerStream, Effect.sync(() => isGesturing)),
  }),
}))
```

`documentPointerStream` построен на `Dom.streamFromEventFilterMap` для `pointermove` и `pointerup` на `document`. Дело в том, что `h.OnPointerMove` отдаёт только `screenX/Y` и теряет указатель за пределами SVG. Перевод в координаты доски (`getBoundingClientRect`) и поиск узла под курсором (`elementFromPoint` → `[data-node-id]`) делаются в маппере, так что в `update` попадают только числа и id. Горячие клавиши (`Mod+Z`, `Delete`, `Escape`, `C` для соединения) задаются через `Dom.streamFromKeyBindings`.

**Routing** через `defineRouteUnion`: `Home /`, `Lesson /lesson/:slug?step=N` (`Route.query`, сверить), `Sandbox`, `NotFound`. Смена шага делает `pushUrl`. **DevTools:** `excludeFromHistory: ['TickedFrame']`.

```
src/
  main.ts entry.ts
  app/      model, message, update, view, route, subscriptions, progress
  domain/   # без foldkit
    graph/    schema, ops, query, validate
    catalog/  components (виды, ёмкость, цена, правила соединений, иконки)
    sim/      compile, step, flows, metrics, scenario, rng, run
    check/    criterion, predicates, evaluate
    content/  schema, dsl, markup, boardAt
  board/    model, message, update, gesture, history, viewport, subscriptions, view/
  lesson/   model, message, update, subscriptions, view/ (theory, task-card, hud)
  pages/    catalog/ sandbox/
  content/  lessons/00-intro.ts … 12-capstone.ts, course.ts, glossary.ts
```

## 5. Доска

**Рендер.** Один `<svg id="board">`. Pan и zoom задаются через `ViewBox` из `viewport{x, y, zoom}`. Слои:

1. `defs`: сетка и `marker`-стрелка;
2. рёбра: `path` с `MarkerEnd`, толщина пропорциональна потоку;
3. пакеты: `circle`;
4. узлы: `g` с `rect`, иконкой, подписью и кольцом загрузки;
5. оверлеи: подсветка и выноски.

Узлы рендерятся через `h.keyed` и `createKeyedLazy(node.id)`, панель теории — через `createLazy`. На кадре меняются только пакеты и кольца. SVG выбран вместо `Canvas.view`, потому что даёт:

- бесплатный hit-testing;
- доступность: `Role('button')`, `AriaLabel('Сервер app2, загрузка 85%')`, `Tabindex(0)`;
- локаторы для Scene-тестов.

**Взаимодействия.** Это автомат `Gesture = Idle | Placing{kind} | Dragging{id, from, origin} | Connecting{from, cursor} | Panning`.

- **Палитра.** Клик или Enter добавляет узел в центр видимой области, перетаскивание ведёт за курсором «призрак».
- **Перемещение.** Позиция считается как `origin + (pointer − from) / zoom`, привязка к сетке 20px. Весь жест — одна запись в истории.
- **Соединение.** Тянем от порта узла, видна «резинка». Ребро создаётся, если `catalog.canConnect(a, b)`, иначе показывается тост «Клиент не обращается к БД напрямую». Для клавиатуры: выделить → `C` → цель.
- **Выделение и удаление.** Выделение кликом, с Shift — несколько узлов. Инспектор показывает параметры, открытые уроком. `Delete` удаляет узел вместе с рёбрами. Узлы с `locked` (например, «Пользователи») неудаляемы.
- **Pan и zoom.** Pan — перетаскиванием фона. Zoom — кнопками ± или «вписать». `Ctrl+wheel` слушается подпиской `streamFromEventFilterMapPreventDefault`, потому что у `h.OnWheel` нет delta (сверить passive). Диапазон 0.5–2.
- **Undo и redo.** Хранятся снимки `{ past, future }: Graph[]`, максимум 100. Графы малы и иммутабельны.

```ts
export const NodeParams = defineTaggedUnion({
  Client: { rps: Schema.Number, readShare: Schema.Number, staticShare: Schema.Number },
  Server: { tier: Schema.Literals(['S', 'M', 'L']) },
  LoadBalancer: { algorithm: Schema.Literals(['RoundRobin', 'LeastConnections']) },
  Cache: { sizeMb: Schema.Number, ttlSec: Schema.Number },
  Database: { role: Schema.Literals(['Primary', 'Replica']), tier: Schema.Literals(['S', 'M', 'L']) },
  Queue: {}, Worker: { count: Schema.Number },
  Cluster: { min: Schema.Number, max: Schema.Number, autoscale: Schema.Boolean },
  // Cdn, ObjectStorage, Gateway{limitRps}, ShardRouter{shards, hotKeyShare}, Region{name}
})
export const Node = Schema.Struct({ id: NodeId, label: Schema.String,
  pos: Vec2, params: NodeParams, locked: Schema.Boolean })   // вид узла = params._tag
export const Edge = Schema.Struct({ id: EdgeId, from: NodeId, to: NodeId })
export const Graph = Schema.Struct({ nodes: Schema.Array(Node), edges: Schema.Array(Edge) })
```

Id генерируются детерминированно из `nextSeq` (`srv-4`), без UUID, поэтому тесты стабильны. Валидатор запрещает циклы (кроме `Queue → Worker`), висячие рёбра и недопустимые пары.

## 6. Формат контента

Урок — это TS-модуль на DSL из `domain/content/dsl.ts`. Типы проверяются компилятором, данные — тестом через `LessonSchema`. Текст пишется в теге `md`, мини-разметке без зависимостей: `**жирный**`, `` `код` ``, ссылки на узлы `[[id|текст]]`, термины глоссария `{{cache-aside}}`. Виды шагов: `narrate`, `observe`, `task`, в фазе 3 ещё `choice`.

```ts
// src/content/lessons/03-load-balancer.ts
const base = scene({
  nodes: [client('users', [60, 200], { rps: 300 }), server('app1', [300, 200]), database('db', [540, 200])],
  edges: [['users', 'app1'], ['app1', 'db']],
})

export default lesson({
  id: 'load-balancer', title: 'Горизонтальное масштабирование',
  unlocks: ['LoadBalancer'], palette: ['Server', 'LoadBalancer', 'Database'],
  steps: [
    narrate({ board: base, sim: { load: constant(300), autoplay: true },
      text: md`[[app1|Сервер]] размера S держит ~400 RPS. Сейчас приходит 300 — всё зелёное.` }),
    observe({ sim: { load: ramp(300, 900, 5) }, highlight: ['app1'],
      text: md`Нагрузка выросла до 900 RPS. Кольцо покраснело, красные точки — потерянные запросы.` }),
    narrate({ patch: [addNode(server('app2', [300, 80])), addNode(server('app3', [300, 320]))],
      text: md`Сервер побольше — **вертикальное** масштабирование: есть потолок и единая точка отказа. Другой путь — **горизонтальное**: несколько одинаковых серверов.` }),
    narrate({ highlight: ['users'],
      text: md`Но [[users|клиенты]] знают один адрес. Нужен {{load-balancer}}: он раздаёт запросы серверам.` }),
    task({
      id: 'lb-three-servers', start: 'current',
      text: md`Поставьте балансировщик перед тремя серверами: 900 RPS, ошибок меньше 1%.`,
      scenario: { load: constant(900), seconds: 40, measureFrom: 10 },
      checker: lbThreeServersChecker,
      hints: [
        md`Клиенты должны обращаться не к серверу, а к одному «входу» в систему.`,
        md`Балансировщик принимает трафик клиентов и раздаёт серверам. Серверам по-прежнему нужна БД.`,
        md`Соедините «Пользователи → LB», LB → app1..app3, каждый сервер → db; удалите «Пользователи → app1».`,
      ],
      solution: solve(base, [/* эталонные операции */]),
    }),
    narrate({ board: 'solution', sim: { load: constant(900), autoplay: true },
      text: md`Нагрузка разделилась на три части по ~300 RPS.` }),
  ],
})
```

После задачи повествование продолжается от эталона (`board: 'solution'`), а не от раскладки ученика.

## 7. Проверка задач

Критерий — это `{ label, kind: 'structural' | 'behavioral', check(ctx) → Pass | Fail{message, focus} }`, где `ctx = { graph, run }`. Структурные критерии считаются вживую. Поведенческие вызывают `run()` — мемоизированный чистый `runScenario(graph, scenario)`.

**«Поставь балансировщик перед тремя серверами»:**

```ts
export const lbThreeServersChecker = criteria(
  structural('Клиенты ходят только через балансировщик', g => {
    const direct = outgoing(g, 'users').filter(n => !isKind('LoadBalancer')(n))
    return direct.length === 0 || fail('Клиенты обращаются к серверу напрямую', ids(direct))
  }),
  structural('Три сервера за балансировщиком', g => {
    const [fed, idle] = partition(nodesOf(g, 'Server'), s => incoming(g, s.id).some(isKind('LoadBalancer')))
    return fed.length >= 3 || fail(`За балансировщиком ${fed.length} из 3 серверов`, ids(idle))
  }),
  // + «каждый сервер достаёт до БД» через reaches(g, s.id, 'db')
  behavioral('900 RPS, ошибок < 1%', r => r.global.errorRate < 0.01
    || fail(`Ошибок ${pct(r.global.errorRate)}, перегружены: ${r.overloaded().join(', ')}`, r.overloaded())),
)
```

**«Добавь кеш, чтобы нагрузка на БД была ниже 200 RPS».** Сценарий: 1000 RPS, 90% чтений, 60 с, замер с 30-й секунды, чтобы кеш прогрелся. Записи (100 RPS) всегда идут в БД, значит нужен hit ratio ≥ 89%. На дефолтном размере кеша его не получить, и это намеренная ловушка: ученику придётся открыть инспектор.

```ts
criteria(
  structural('Серверы читают через кеш', g => {
    const miss = nodesOf(g, 'Server').filter(s => !outgoing(g, s.id).some(isKind('Cache')))
    return miss.length === 0 || fail('Эти серверы не обращаются к кешу', ids(miss))
  }),
  behavioral('Нагрузка на БД < 200 RPS', r => {
    const db = r.node('db').rpsIn.meanFrom(30), hit = r.kind('Cache').hitRatio.meanFrom(30)
    return db < 200 || fail(`БД получает ${fmt(db)} RPS, hit ratio ${pct(hit)}. Записи всегда идут ` +
      `в БД, поэтому нужен hit ratio ≥ 89% — проверьте размер кеша.`, ['db'])
  }),
)
```

## 8. Симуляция и визуализация

**Модель потоков, а не отдельных запросов.** `compile(graph)` строит топологический порядок и смежность; результат мемоизирован через `WeakMap` по ссылке на иммутабельный граф. На каждом шаге (`dt = 50 мс`) интенсивности λ распространяются по классам запросов `read`, `write`, `static` и `job`:

- **балансировщик** делит λ поровну или по свободной ёмкости; упавшие узлы исключает после задержки health check;
- **кеш** отвечает на долю `hit` и пропускает дальше промахи; `hit` стремится к `h∞(sizeMb / workingSet, ttl)` с постоянной времени, поэтому виден «холодный кеш». **CDN** работает так же для `static`;
- **очередь** считает бэклог: `backlog' = backlog + (λin − drain)·dt`;
- **узел с ёмкостью μ** обрабатывает `min(λ, μ)`, остальное — ошибки. Задержка `base / (1 − ρ)` с потолком; p95 считается по путям, взвешенным потоками;
- **кластер** меняет число реплик через автоскейлер с задержкой; события сценария `fail` и `recover` переключают статус узлов.

Состояние между шагами: часы, прогрев кешей, бэклоги, реплики, статусы, кольцевые буферы метрик по 120 точек и сид PRNG для шума нагрузки.

```ts
TickedFrame: ({ deltaMs }) => {
  const budget = model.sim.accMs + Math.min(deltaMs, 100) * model.sim.speed
  const n = Math.floor(budget / SIM_DT)
  const state = iterate(n, s => Sim.step(compile(model.board.graph), s, scenario, SIM_DT))(model.sim.state)
  return { model: modifyFields(model, { sim: sim => ({ ...sim, state, accMs: budget - n * SIM_DT }) }) }
}
```

При скорости 4× за кадр выполняется больше шагов, но это те же шаги, поэтому состояние на секунде T не зависит от FPS. Граф можно править прямо во время симуляции: кеш, добавленный на ходу, снижает нагрузку на БД у ученика на глазах.

**Что движется на доске.** Пакеты — чистая функция от `(flows, clock)`, в Model они не хранятся. Число точек на ребре — `clamp(log2 λ · k)`, позиция i-й точки — `frac(clock · v + i / count)`, цвет зависит от класса. Сброшенные запросы — красные точки, которые «осыпаются» у перегруженного узла. Всего на экране не больше 150 точек. Кроме того:

- толщина ребра пропорциональна потоку;
- кольцо загрузки меняет цвет: зелёный → жёлтый → красный;
- бейджи показывают hit ratio и бэклог;
- в HUD спарклайны (`polyline`): пропускная способность, ошибки, p95, нагрузка на БД, цена в час и линия цели задачи.

## 9. Тестирование

- **Домен (vitest).**
  - Операции графа и валидатор.
  - Инварианты `step`: сохранение потока (вход = выход + ошибки + буфер), бэклог ≥ 0.
  - **Детерминизм**: два прогона дают равные состояния.
  - **Независимость от FPS**: 1× и 4× дают одно и то же состояние на 30-й секунде.
- **Story.**
  - Board: drag с привязкой к сетке; запрещённое ребро не создаётся; undo после удаления; `Story.expectOutMessage(ChangedGraph…)`.
  - LessonPlayer: «Далее» применяет директиву; проверка стартовой доски даёт findings с `focus`; три провала открывают решение; успех создаёт `SaveProgress` (`Story.Command.expectHas` / `resolve`); серия `TickedFrame` меняет метрики.
- **Scene:** клик по палитре даёт узел, найденный через `Scene.role('button', { name })` (сверить); выноска ошибки после «Проверить»; drag через `Scene.pointerDown` + `Scene.Subscription.emit(MovedPointer…)`.
- **Валидация контента (`content.test.ts`) — главный набор тестов.** Для каждого урока проверяется:
  - декодирование `LessonSchema`;
  - все `[[id]]` и `highlight` существуют в `boardAt(step)`;
  - палитра задачи ⊆ открытых компонентов;
  - **эталон проходит чекер, стартовая доска — нет**;
  - подсказок ≥ 2, термины есть в глоссарии;
  - типографика.

  Golden-снапшоты метрик эталонов показывают в диффе, как изменения симулятора влияют на контент.
- **CI:** `tsc --noEmit --pretty false`, `oxlint`, `vitest run --silent --reporter=dot`.

## 10. MVP и дорожная карта

- **Фаза 0 — спайк на 2–3 дня, код выбрасывается.** 40 узлов, 150 пакетов, rAF и полный ре-рендер. Замеряем через Slow Warnings Foldkit. Если кадр дольше 8 мс, слой пакетов уходит в `Canvas.view` поверх SVG, архитектура не меняется.
- **Фаза 1 — MVP.**
  - Уроки 0–4.
  - Доска: палитра, перемещение, соединение, удаление, undo, zoom кнопками.
  - Симулятор, пакеты, HUD.
  - Чекеры, подсказки, решение.
  - Каталог, роутинг, прогресс в localStorage.
  - Только десктоп, тесты контента в CI.
- **Фаза 2.** Уроки 5–8, инспектор, события сбоев, песочница, Ctrl+wheel, множественное выделение.
- **Фаза 3.** Уроки 9–12, бюджеты, шаги `choice`, итоговый проект на SLO, «поделиться решением» (граф в URL hash).
- **Фаза 4.** Авторский маршрут `/author/:lesson` (ползунок шагов, «скопировать доску как `scene(...)`»), touch, аудит доступности.

## 11. Риски и компромиссы

1. **Бета Foldkit.** Минорные версии ломают API. Фиксируем точную версию, домен держим без Foldkit, обновляемся отдельным change.
2. **Модель потоков приблизительна.** M/M/1 учит правильной *интуиции*, а не точным числам; хвосты p99 грубые. Единицы условные, нужно ревью эксперта, задач на точный p99 нет. Это осознанная цена тезиса: детерминизм и проверяемость важнее реализма. Дискретно-событийная симуляция реалистичнее, но шумная, и проверять её пришлось бы статистикой.
3. **`view` на каждом кадре.** TEA пересчитывает view 60 раз в секунду. Lazy-обёртки помогают, но риск реален, поэтому спайк идёт первым, а у пакетов есть запасной выход в Canvas.
4. **Свой графовый редактор.** Порты, хит-зоны, touch, мультивыделение — всё своё. Нет автолейаута, мини-карты и обхода узлов рёбрами: рёбра прямые, позиции задаёт автор. Требование «свободная доска как Excalidraw» потребует переделки.
5. **Нечистый шов указателя.** Чтения DOM в мапперах подписок не покрыты Scene, нужен e2e smoke.
6. **Контент в TS неудобен методистам.** Если авторы будут не разработчиками, понадобится загрузчик YAML или MDX, а это против минимализма.
7. **Предикаты могут отвергнуть креативное верное решение.** Структурные критерии — только для конкретного приёма урока, итоговый проект проверяется только по SLO и бюджету.

## 12. Разбиение на OpenSpec changes

Порядок реализации; справа — capability-спеки, которые change создаёт или меняет.

1. `bootstrap-foldkit-app` → **app-shell**
2. `add-system-graph-model` → **system-graph**, **component-catalog**
3. `add-board-rendering` (SVG, viewport, подсветка) → **board-rendering**
4. `add-board-editing` (палитра, жесты, соединение, undo) → **board-editing**
5. `add-load-simulator` (`compile`/`step`, сценарии, метрики) → **load-simulation**
6. `add-simulation-visualization` (rAF, пакеты, HUD) → **simulation-visualization**
7. `add-lesson-player` (`LessonSchema`, DSL, `boardAt`, синхронизация) → **lesson-content**, **lesson-player**
8. `add-task-checking` (критерии, подсказки, решение) → **task-checking**
9. `add-progress-and-catalog` (Flags, localStorage, разблокировка) → **learning-progress**, **course-catalog**
10. `add-content-validation` → **content-validation**
11. `add-lessons-foundations` (0–4) → **curriculum**
12. `add-lessons-scaling` (5–8, инспектор, сбои) → меняет **curriculum**, **component-catalog**, **load-simulation**, **board-editing**
13. `add-sandbox-mode` → **sandbox**
14. `add-lessons-distributed` (9–12, бюджеты, `choice`) → меняет **curriculum**, **load-simulation**, **task-checking**, **lesson-content**
15. `add-solution-sharing` → **solution-sharing**
