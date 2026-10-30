# План C: симуляция-центричная песочница, задачи как SLO-челленджи

> Стек: Foldkit 0.169 (бета) + Effect 4.0. Сниппеты сверены с `.d.ts` пакета; неподтверждённое помечено «(сверить)».

## 1. Суть подхода

Центр продукта — **живая модель системы**. Каждый узел доски — станция массового обслуживания с параметрами (ёмкость, латентность, очередь, hit-rate, $/ч), по рёбрам идут симулированные запросы. Один discrete-event движок играет три роли:

1. **Иллюстрация теории.** Автор пишет не анимацию, а *эксперимент* (граф + сценарий нагрузки + хаос), и ученик видит, как p99 взлетает «клюшкой» после 80 % загрузки.
2. **Песочница.** Любую схему можно нагрузить и сломать.
3. **Проверка.** Задача — SLO: «10k RPS, p99 < 200 мс, ошибки < 0,1 %, ≤ $12/ч». Решение засчитано, если прогон сценария укладывается в SLO.

Почему это лучший вариант:

- **В System Design ответ — поведение, а не форма схемы.** Кеш, реплики или оба сразу — все решения валидны, если держат SLO и бюджет. Структурному чекеру пришлось бы перечислять их вручную.
- **Контент масштабируется дёшево:** новый урок = граф + сценарий + SLO, без своей анимации и своего чекера.
- **Обратная связь количественная:** не «неверно», а «p99 412 мс > 200 мс на 31-й секунде, узкое место — `db-main` (загрузка 0,98)».
- **Цикл «предскажи → посмотри → объясни»** встроен естественно.

## 2. Учебная программа (13 уроков)

| # | Урок | Разблокируется | Эксперимент | Челлендж |
|---|---|---|---|---|
| 0 | Один сервер | Клиенты, Сервер S/M/L | «Клюшка» латентности, закон Литтла | Размер инстанса под 800 RPS, p99 < 200 мс, < $2/ч |
| 1 | Горизонтальное масштабирование | Балансировщик (RR/least-conn, health checks) | Падение сервера без health checks → 33 % ошибок | 3k RPS, p99 < 150 мс, пережить kill сервера |
| 2 | Stateful-слой | БД | Растим app-слой — p99 стоит: упёрлись в БД | «Найди узкое место» + размер БД |
| 3 | Кеширование | Кеш (cache-aside, TTL, размер) | Холодный кеш, thundering herd | Загрузка БД < 60 % при 5k RPS, stale < 2 % |
| 4 | Репликация чтения | Реплика (lag), маршрут read/write | «Не вижу свой пост» | 8k RPS при 80/20, stale < 1 % |
| 5 | CDN и география | CDN, Object Storage, регионы | Статика из одного региона для Азии | p99 статики < 100 мс везде |
| 6 | Асинхронность | Очередь, Воркеры | Пик ×10 тяжёлых задач | Пик 30 с без ошибок, backlog ≤ 2 мин |
| 7 | Устойчивость | Timeout, retries+jitter, circuit breaker, Rate Limiter | Retry storm, metastable failure | Goodput ≥ 70 % при деградации зависимости |
| 8 | Шардирование | Шард-роутер, шарды | Ключ по времени → горячий шард | 20k WPS: ключ и число шардов |
| 9 | Автоскейлинг и деньги | Группа автоскейлинга | Суточный профиль: переплата | SLO + минимум $/сутки |
| 10 | Отказоустойчивость | Зоны AZ, failover БД | Падение AZ | Availability ≥ 99,5 %, RTO < 30 с |
| 11 | Мульти-регион, CAP | Регион, межрегиональная репликация CP/AP | Сетевой раздел | Режим под требования двух продуктов |
| 12 | Финальный проект | всё | — | «Сокращатель ссылок»: пик + падение AZ + холодный кеш, цена против эталона |

Палитра растёт монотонно: компонент урока N доступен в песочнице после его прохождения.

## 3. UX урока

**Раскладка (desktop-first).**

- Слева — теория, ~38 % ширины. Справа — доска.
- Под доской — лента метрик: спарклайны p50/p99, error rate, RPS, $/ч.
- Под лентой — таймлайн сценария с отметками событий («t=30 с: kill srv-2») и скоростью ×0,5…×8.
- Инспектор выделенного узла выезжает справа.

**Синхронизация.** Урок состоит из *шагов*; у каждого есть текст и *директива доски* (заменить граф, подсветить узлы, запустить эксперимент, открыть палитру). В режиме чтения доска — чистая функция `(lesson, beatIndex)`, поэтому «Назад» детерминирован. Ссылки `{node:lb}` в тексте подсвечивают узел при наведении. *Cue-реплики* привязаны к sim-времени: на t=12 с подсвечивается фраза «смотрите: p99 растёт быстрее загрузки», и пульсирует нужный узел.

**Задача.** Шаг `Challenge` переводит доску в режим редактирования. Появляется карточка SLO с живыми индикаторами и две кнопки:

- **«Пробный прогон»** — визуальный, с паузой и вбросом хаоса.
- **«Проверить»** — headless: все сценарии × 3 сида в воркерах, с прогресс-баром.

**Обратная связь.**

- *Структурная ошибка* — мгновенно, без симуляции: «Клиент обращается к `srv-1` напрямую, минуя балансировщик»; подсветка узла.
- *Провал SLO*:
  - график метрики с красной зоной и маркером времени;
  - узел-виновник пульсирует;
  - кнопка «Повторить момент» проигрывает фрагмент live.
- *Подсказки* в три уровня: диагностическая («загрузка узлов на 31-й секунде») → ссылка на шаг теории → ghost-компонент на доске.
- *Успех*: таблица «SLO / результат» и сравнение цены с эталоном.

При `prefers-reduced-motion` частицы заменяются числовыми подписями RPS на рёбрах. Доска полностью управляется с клавиатуры.

## 4. Архитектура на Foldkit

```ts
const Model = Schema.Struct({
  route: AppRoute,
  progress: Progress,             // пройденное, черновики, лучшие решения
  page: Page,                     // Catalog | Lesson | Sandbox | NotFound
  simWorker: SimWorkerStatus,     // Idle | Ready | Failed
})
// Lesson = { lessonId, beatIndex, mode, board: Board.Model, sim: Sim.Model, challenge: Challenge.Model }
```

**Submodels** с конвертом `Got*Message` и OutMessage:

- `board` — редактирование графа; OutMessage `GraphCommitted`.
- `sim` — статус Idle/Running/Paused/Verifying, скорость, последний кадр, кольцевой буфер метрик, токены.
- `challenge` — SLO, вердикт, атрибуция, уровень подсказки.
- `lessonPlayer` — шаги, директивы, cue.

**Ключевые Messages:** `ClickedNextBeat`, `ClickedRunExperiment`, `ClickedVerify`, `GotSimFrame`, `GotVerifyResult`, `TickedAnimationFrame`, `ChangedSimSpeed`, `ClickedInjectChaos`, `AcquiredSimWorker`, `FailedSimWorker`.

**Commands** (`Command.define`):

- `PostSimCommand` — Load/Start/Pause/Inject в live-воркер.
- `RunVerification` — с `interrupt: true`: пул эфемерных воркеров через `Effect.forEach(runs, runInWorker, { concurrency: 'unbounded' })` в `Effect.scoped`.
- `SaveProgress`, `SaveDraft` — localStorage, дебаунс с interrupt-ключом.
- `LoadLesson` — динамический `import()` модуля урока.

**Live-воркер — это ManagedResource**, он живёт, пока открыт урок или песочница:

```ts
const SimWorker = ManagedResource.tag<SimWorkerHandle>()('SimWorker')
const managedResources = ManagedResource.make<Model, Message>()(entry => ({
  simWorker: entry(Schema.Option(Schema.Struct({})), {            // (сверить)
    resource: SimWorker,
    modelToMaybeRequirements: m => needsSimulator(m) ? Option.some({}) : Option.none(),
    acquire: () => spawnSimWorker,                                // Effect<Handle, unknown, Scope>
    release: w => Effect.sync(() => w.terminate()),
    onAcquired: () => AcquiredSimWorker(),
    onReleased: () => ReleasedSimWorker(),
    onAcquireError: e => FailedSimWorker({ reason: String(e) }),
  }),
}))
```

**Subscriptions:**

- `simFrames` — `dependenciesToStream` делает `yield* SimWorker.get` и превращает `onmessage` в `Stream.callback`.
- `frame` — `Subscription.animationFrameEntry({ isActive: isAnimating, toMessage: dt => TickedAnimationFrame({ dt: Math.min(dt, 32) }) })`.
- `keys` — Delete, Ctrl+Z, Space.
- Колесо и ResizeObserver — через `Mount.defineStream`: `h.OnWheel` принимает готовый Message без `deltaY`.

`TickedAnimationFrame` и `GotSimFrame` попадают в `devTools.excludeFromHistory`, иначе time-travel утонет.

**Routing:** `/`, `/lessons/:lessonId?step=N`, `/sandbox?g=<base64url-граф>`, на `Route.literal/string/query`.

**Прогресс:** localStorage, версионированная `ProgressV1` с Schema-декодом и миграциями.

```
src/
  app/        model update view route subscriptions resources
  pages/      catalog/ lesson/ sandbox/
  board/      graph.ts update.ts history.ts geometry.ts rules.ts view/{svgLayer,particleLayer,palette,inspector}.ts
  sim/        ← чистый TS, без foldkit
    kernel/{eventQueue,rng,engine,mathDet}.ts  components/*.ts  metrics/{histogram,windows,cost}.ts
    scenario.ts chaos.ts protocol.ts worker.entry.ts
  grading/    guards.ts slo.ts attribution.ts verdict.ts
  content/    catalog.ts (компоненты, цены, правила рёбер) dsl.ts lessons/NN-*/lesson.ts
```

## 5. Доска

**Рендер — два слоя в одном контейнере.**

1. **SVG через `h`** — структура: узлы, рёбра с `marker`, порты, выделение, нагрев, бейджи очереди. Узлов ≤ 50 и рёбер ≤ 100 — для vdom тривиально. Тела узлов мемоизируются `createKeyedLazy` по `nodeId`; нагрев квантуется в 10 корзин, чтобы кеш попадал.
2. **Частицы — `Canvas.view` поверх SVG** с `pointer-events: none`. `shapes` — чистая функция `(tokens, renderSimTime, edgeGeometry)`. 400 кругов за кадр рисуются меньше чем за 1 мс.

Почему так:

- **SVG для частиц:** 400 элементов × 60 fps дают патчи атрибутов и пересчёт стилей — проседания на слабых ноутбуках.
- **`Mount` сторонней библиотеки** (React Flow, Pixi): граф раскололся бы между библиотекой и Model, а с ним пропали бы undo, time-travel и Scene-тесты.

Запасной путь заложен в интерфейс `ParticleRenderer`: если rAF через update+view дороже ~6 мс, частицы переезжают на `Mount` + `OffscreenCanvas`, переданный в воркер. Тогда Model получает только метрики на 5 Гц.

**Взаимодействия:**

- **Палитра.** Drag на доску или «выбрать + клик». Закрытые компоненты отмечены замком: «откроется в уроке N».
- **Перетаскивание узла.** На `OnPointerDown` (есть `clientX/Y`) сохраняется `Dragging{nodeId, startScreen, startPos}`. На `OnPointerMove` (только `screenX/Y`) позиция = `startPos + Δ/zoom`, со снапом 16 px. В историю попадает только отпускание.
- **Рёбра.** Тянутся из порта. Правила берутся из `catalog.ts` (`Clients → LB|Server|CDN`, `Queue → Worker`), недопустимые цели затемняются.
- **Выделение.** Клик, Shift, рамка. Инспектор: размер с ценой, реплики, TTL, алгоритм LB, политики ребра.
- **Удаление** — Delete. Узлы урока `locked` неудаляемы.
- **Pan/zoom.** Pan перетаскиванием фона, zoom колесом, кнопка «вписать».
- **Undo/redo.** Стек снимков `Graph`, 100 шагов. Любая правка сбрасывает вердикт.

```ts
const Node = Schema.Struct({
  id: NodeId, kind: ComponentKind, label: Schema.String, pos: Point,
  zone: Schema.optional(ZoneId), params: ComponentParams, locked: Schema.Boolean })  // params: union по kind
const EdgePolicy = Schema.Struct({ timeoutMs: Schema.Number, retries: Schema.Number,
  backoff: Schema.Literals(['None', 'ExpJitter']), breaker: Schema.Boolean,
  route: Schema.Literals(['All', 'Read', 'Write']) })
const Graph = Schema.Struct({ nodes: Schema.Record(NodeId, Node),   // (сверить Record в Effect 4)
  edges: Schema.Record(EdgeId, Edge), zones: Schema.Array(Zone) })
```

## 6. Формат контента

Уроки пишутся на **TypeScript DSL**, а не в Markdown: шаги ссылаются на id узлов, сценарии и SLO, и типы ловят битые ссылки. Проза — шаблонные строки с разметкой `**…**`, `{node:id}`, `{metric:p99}`, `{term:…}`. Типы шагов: `Explain`, `Experiment` (`predict`, `cues`), `Challenge`.

**Пример: урок «Балансировщик нагрузки».**

```ts
export default defineLesson({
  id: 'load-balancer', order: 1, title: 'Горизонтальное масштабирование', unlocks: ['LoadBalancer'],
  beats: [
    Explain({
      text: `Сервер {node:srv-1} размера L держит ~1200 RPS. XL дороже в 2,4 раза, а ёмкости даёт лишь ×1,7.`,
      board: setGraph(G.chain(clients('users', { rps: 1000 }), server('srv-1', 'L'))),
    }),
    Experiment({
      text: `Поднимем нагрузку до 2000 RPS. **Предскажите**, что будет с p99.`,
      predict: { options: ['≈ как сейчас', 'вдвое выше', 'растёт без предела'], correct: 2 },
      scenario: scenario({ duration: 40, seed: 7, traffic: [ramp(1000, 2000, 0, 20), hold(2000, 20, 40)] }),
      cues: [{ at: 14, text: 'Загрузка {node:srv-1} > 0,9 — смотрите на {metric:p99}', pulse: ['srv-1'] },
             { at: 22, text: 'Очередь растёт линейно, таймауты становятся ошибками.' }],
    }),
    Explain({
      text: `Три сервера за {node:lb}, распределение по кругу (round-robin).`,
      board: setGraph(G.fanOut(clients('users', { rps: 2000 }), lb('lb'), servers(['srv-1','srv-2','srv-3'], 'M'))),
    }),
    Experiment({
      text: `Что будет, если {node:srv-2} упадёт, а {term:health-check} выключены?`,
      scenario: scenario({ duration: 40, seed: 7, traffic: [hold(2000, 0, 40)], chaos: [kill('srv-2', 15)] }),
      cues: [{ at: 16, text: 'Треть запросов уходит в мёртвый узел: ошибки ≈ 33 %.', pulse: ['srv-2', 'lb'] }],
    }),
    Challenge({
      goal: `Выдержите 3000 RPS и падение одного сервера. Бюджет $6/ч.`,
      start: G.chain(clients('users', { rps: 3000, locked: true }), server('srv-1', 'M')),
      scenarios: [scenario({ id: 'steady', duration: 60, traffic: [hold(3000, 0, 60)] }),
                  scenario({ id: 'node-loss', duration: 60, traffic: [hold(3000, 0, 60)], chaos: [killRandom('Server', 30)] })],
      guards: LB_GUARDS,                                     // раздел 7
      slo: [S.p99Below(150), S.errorRateBelow(0.005, { window: [35, 60] }), S.costBelow(6)],
      hints: ['Какой узел краснеет первым и на какой секунде?',
              { beat: 3, text: 'Вспомните эксперимент с падением srv-2.' },
              { ghost: lb('lb-hint', { healthChecks: true }) }],
      reference: G.fanOut(clients('users'), lb('lb', { healthChecks: true }), servers(['a','b','c','d'], 'M')),
      antiSolutions: [{ graph: 'start', fails: 'p99' },
        { graph: G.fanOut(clients('users'), lb('lb'), servers(['a','b','c'], 'M')), fails: 'errorRate', in: 'node-loss' }],
    }),
  ],
})
```

## 7. Проверка задач

Конвейер:

1. **Guards** — чистые функции над `Graph`, мгновенные и на лету. Они защищают от обхода SLO: «выдержать нагрузку», сбросив 90 % трафика лимитером, или пустить клиентов прямо в БД. Каждый возвращает `Pass | Fail{ message, highlight }`.
2. **SLO-прогон.** Сценарии × 3 фиксированных сида в пуле воркеров, по окну стабильного режима (по умолчанию без первых 5 с). Засчитывается, только если прошли все прогоны; вердикт для графа детерминирован. Ранний выход срабатывает, когда бюджет ошибок исчерпан.
3. **Атрибуция.** Берётся момент первого нарушения. Виновник — узел с максимальным `max(utilization, queue/limit)` и наибольшей долей порождённых ошибок.

**Чекер «балансировщик перед тремя серверами»:**

```ts
const LB_GUARDS = [
  G.countAtLeast('Server', 3, 'Нужно минимум три сервера'),
  G.everyPath({ from: 'Clients', to: 'Server', through: 'LoadBalancer' },
    p => `Клиент обращается к ${p.to} напрямую, минуя балансировщик`),
  G.each('Server', G.hasIncomingFrom('LoadBalancer')),
]
```

Guards проверяют форму, SLO — суть. Без health checks форма верна, но `node-loss` проваливает error rate, и ученик учится health checks, а не получает «неверно».

**Чекер «кеш снижает нагрузку на БД ниже X».** Старт: `users → lb → 3×srv → db-main`, где `db-main` заблокирована (стабильный id). Ключи — Zipf s = 1,1, 95 % чтений.

```ts
guards: [G.exists('Cache'), G.each('Server', G.hasOutgoingTo('Cache')),
         G.nodeUnchanged('db-main', ['size'])],           // нельзя просто купить БД побольше
scenarios: [steady(5000, 60), coldStart(5000, 60)],       // coldStart: кеш пуст на t=0
slo: [
  S.below(M.node('db-main').utilization, 0.6, { agg: 'max', window: [15, 60] }),
  S.p99Below(120),
  S.below(M.staleReadRatio, 0.02),                       // слишком длинный TTL
  S.costBelow(9),
],
```

Окно `[15, 60]` в `coldStart` требует прогрева за 15 с: маленький кеш или короткий TTL не пройдут, а длинный TTL провалит `staleReadRatio`. Ученик ищет баланс, а не ставит галочку.

## 8. Симуляция и визуализация

**Компоненты.** Симуляция на уровне запросов. У запроса есть класс (`read/write/static/job`), ключ (Zipf), регион, дедлайн и счётчик ретраев. Узел — `c` слотов, ограниченная FIFO-очередь и логнормальное время обслуживания (среднее и CV зависят от размера и класса).

- **Clients** — Пуассон с профилем RPS(t).
- **LB** — RR / least-conn; health checks с интервалом и порогом, поэтому задержка обнаружения отказа *видна*.
- **Server** — маршрутизирует по рёбрам: read → кеш → при промахе БД или реплика; write → primary или очередь.
- **Cache** — LRU, TTL, версии ключей против версий БД (отсюда stale reads).
- **Replica** — применяет записи с экспоненциальным лагом.
- **Queue/Worker** — pull-модель.
- **ShardRouter** — hash или range.
- **RateLimiter** — token bucket.
- **Рёбра** — сетевая задержка по зонам и регионам + timeout, retries с backoff, circuit breaker.
- **Хаос** — `kill`, `slow(×k)`, `partition`, `dropZone`, `flushCache`, `spike`.

**Алгоритм.**

- Бинарная куча событий `(t, seq)`; время — целые микросекунды, `seq` фиксирует порядок при равных `t`.
- `engine.advanceTo(t)` обрабатывает события до момента `t`.
- PRNG xoshiro128** с потоком на каждый узел: `split(seed, hash(nodeId))`. Это **common random numbers**: добавление кеша не меняет поток прибытий, и варианты сравниваются честно.
- Распределения сэмплируются через собственные табличные `ln/exp`: `Math.log` может отличаться в последнем бите между V8 и JSC, а вердикт должен совпадать бит-в-бит.
- Горячий цикл — чистый TS без Effect. Effect работает на границах:
  - Schema графа, сценариев и протокола;
  - цикл воркера — Fiber с пейсингом через `Clock`, чтобы его тестировать на `TestClock`;
  - `Stream` кадров;
  - пул верификации.

**Режимы.**

- *Live*: sim-время сдвигается на `16 мс × speed` за тик, `SimFrame` уходит на 15 Гц.
- *Verify*: без пейсинга.

**Что движется на доске.**

- **Токены — сэмплированные запросы:** каждый k-й, k подбирается так, чтобы в полёте было ≤ 300.
  - Цвет: зелёный — ok, янтарный — медленнее SLO, красный — ошибка; отвергнутые «падают» с узла.
  - Позиция — `lerp` по геометрии ребра между `t0` и `t1` при `renderSimTime`, который интерполируется на rAF от последнего кадра.
- **Узлы:** заливка по загрузке, полоска очереди, пульсация при перегрузке, ✕ на мёртвом узле.
- **Рёбра:** толщина ∝ log(throughput).
- Кадр несёт токены упакованным `Float32Array` (transferable) и агрегаты по узлам.

**Метрики.**

- Латентность — log-гистограмма на окно 1 с (HDR-подобная, точность 2 %). Перцентили за окно SLO считаются *слиянием гистограмм*, а не усреднением перцентилей.
- error rate = (timeouts + rejects + отказы) / arrivals.
- goodput — успешные ответы в пределах дедлайна.
- availability — доля секундных окон с успехом ≥ 99 %.
- cost — Σ цена × время активности узла.

**Производительность.**

- Бюджет ядра — ≥ 1,5 млн событий/с: typed arrays, мономорфный код, пул объектов.
- 10k RPS × 60 с × ~8 событий ≈ 5 млн ≈ 3 с на прогон; 6 прогонов на 3–4 воркерах дают 3–5 с проверки.
- Для уроков 8–12 есть «режим пакетов»: 1 симулируемый запрос = 10 реальных. Хвост в нём аппроксимирован, и UI это явно оговаривает.

## 9. Тестирование

- **Ядро** (vitest, Node):
  - аналитика: M/M/1 и M/M/c против Эрланга C (допуск 5 %), закон Литтла, hit-rate LRU+Zipf против приближения Че;
  - детерминизм: хеш дайджеста метрик стабилен;
  - CRN: несвязанный узел не меняет прибытия;
  - property-тесты: `arrivals = completed + errors + inFlight`.
- **Пейсинг воркера** на `TestClock`: ×2 удваивает sim-время за кадр.
- **Story:**
  - шаги выставляют директивы;
  - `ClickedVerify` порождает `RunVerification`, а `Story.Command.resolve` с провалом даёт вердикт и атрибуцию;
  - правка графа сбрасывает вердикт; undo/redo.
- **Scene:**
  - сервер из палитры → соединение с клавиатуры → «Проверить» → `Scene.Command.resolve` → на экране «p99 412 мс > 200 мс» и кнопка подсказки;
  - `Scene.ManagedResource.acquire` для воркера;
  - `Scene.Subscription.emit(GotSimFrame)` → у узла `data-heat="hot"`.
- **CI контента** (`content:verify`) — главный предохранитель тезиса:
  - эталон проходит SLO с запасом ≥ 15 %;
  - каждое анти-решение падает с ожидаемой причиной;
  - Schema-декод уроков; ссылочная целостность и монотонность разблокировок.
- **Бенчмарк** событий/с и построения shapes: регрессия > 20 % роняет CI.

## 10. MVP и дорожная карта

- **Фаза 0 — спайк, 1 неделя, go/no-go.** Ядро с Clients/Server/LB и частицы на Foldkit. Критерии: 60 fps при 300 токенах, ≥ 1 млн событий/с, M/M/c сходится с теорией. Если частицы не тянут — сразу OffscreenCanvas.
- **Фаза 1 — MVP.** Уроки 0–3; Clients, Server, LB, DB, Cache; эксперименты с cue и predict; челленджи (guards + SLO + атрибуция, 2 уровня подсказок); прогресс; базовая песочница.
- **Фаза 2.** Уроки 4–7: реплики, CDN, очереди, политики рёбер, rate limiter, панель хаоса, ghost-подсказки.
- **Фаза 3.** Уроки 8–10: шарды, автоскейлинг, зоны, режим пакетов.
- **Фаза 4.** Уроки 11–12, шаринг решений, доступность.

## 11. Риски и компромиссы

1. **Верность модели.** Игрушечные очереди могут дать ложные интуиции. *Митигация:* калибровка по аналитике, утверждения только об относительном поведении, плашка «что упрощено».
2. **Стоимость авторинга — главная слабость тезиса.** Пороги SLO подбираются итеративно: эталон должен проходить с запасом, типичные ошибки — устойчиво падать. *Митигация:* анти-решения в CI и `content:sweep` (таблица «порог → какие решения проходят»). Всё равно челлендж дороже, чем со структурным чекером.
3. **Не всё выражается нагрузкой.** Дизайн API, модели данных, идемпотентность, оценки «на салфетке», безопасность раскрываются слабо. *Митигация:* predict-вопросы и guards; эти темы в плане C второстепенны.
4. **Время проверки.** 3–5 с и нагрузка на CPU. *Митигация:* ранний выход, пул воркеров, режим пакетов ценой точности хвоста.
5. **Подбор вместо понимания.** Ученик крутит размер наугад. *Митигация:* бюджеты, `nodeUnchanged`, атрибуция, после N попыток — предложение вернуться к теории.
6. **Бета Foldkit и Effect 4.** Breaking changes в минорах; 60 Гц сообщений через update — нетипичная нагрузка. *Митигация:* пин версий; ядро не зависит от Foldkit; `excludeFromHistory`; OffscreenCanvas как запасной путь.
7. **Кросс-браузерный детерминизм.** Свои `ln/exp`, целочисленное время, запас порогов; граничные решения остаются риском.
8. **Доступность и мобильные.** Анимация визуальна, доска на телефоне неудобна. Desktop-first, reduced-motion, текстовые сводки; на мобильных — только теория и просмотр экспериментов.

## 12. Разбиение на OpenSpec changes

1. `spike-simulation-performance` — только `design.md` с замерами (gate), спеков не создаёт.
2. `bootstrap-foldkit-app` → `app-shell`.
3. `add-sim-kernel` → `sim-kernel` (DES, PRNG/CRN, гистограммы, детерминизм).
4. `add-core-sim-components` → `sim-components` (Clients, Server, LB, DB, Cache, базовый хаос).
5. `add-sim-worker-runtime` → `sim-runtime` (протокол, ManagedResource, live/verify, пул).
6. `add-board-editor` → `board-editor`.
7. `add-board-live-visualization` → `board-visualization`.
8. `add-lesson-format-and-player` → `lesson-content-format`, `lesson-player`.
9. `add-challenge-grading` → `challenge-grading` (guards, SLO, вердикт, атрибуция, подсказки).
10. `add-progress-persistence` → `learner-progress`.
11. `add-content-verification` → `content-verification`.
12. `add-lessons-00-03` → `curriculum`.
13. `add-sandbox-mode` → `sandbox`.
14. `add-async-and-replication-components` → изменяет `sim-components`.
15. `add-resilience-policies` → изменяет `sim-components`, создаёт `chaos-injection`.
16. `add-lessons-04-07` → изменяет `curriculum`.
17. `add-sharding-autoscaling-zones` → изменяет `sim-components`, `board-editor`, `sim-kernel`.
18. `add-lessons-08-12` → изменяет `curriculum`.
19. `add-solution-sharing` → `solution-sharing`.
