## Context

Мотивация — в proposal.md, поведение — в спецификациях. Отправная точка — работающий макет `docs/mockups/lesson-load-balancer.html` на чистом JS. В нём уже проверены:

- операции над доской и доска на шаге как свёртка;
- модель потоков;
- цели задачи;
- жесты на доске;
- частицы.

Здесь та же логика переносится на Foldkit (Effect 4.1) с соблюдением `apps/web/FOLDKIT.md`: Model только из Schema, Message — факты, эффекты — Commands, без `for`, `let`-итераций и `switch`.

## Goals / Non-Goals

**Goals:**

- Доменное ядро — чистый TS + Effect без рантайма Foldkit (допускаются только Schema-помощники `foldkit/schema`), полностью покрытое unit-тестами.
- Урок описывается данными: автор пишет `lesson.ts` и тексты, а не код плеера.
- Плавные 60 кадров в секунду на обычном ноутбуке при 15 узлах и 150 частицах.

**Non-Goals:**

- Сохранение прогресса между визитами — только после входа (`add-learning-progress`).
- Кеш, очереди, CDN, реплики и шарды в симуляторе — с уроками, которым они нужны. Каталог компонентов расширяемый.
- Свободный зум и панорамирование доски. Схема вписывается в область целиком: учебных схем до 20 блоков хватает.
- Дискретно-событийная симуляция (план C). Модель потоков спрятана за функцией `simulate` и может быть заменена позже.

## Decisions

### D1. Слои и каталоги

```
apps/web/src/domain/         без Foldkit
  catalog.ts   ComponentKind, ёмкость, цена, ранг, правила связей
  board.ts     Node, Edge, BoardDoc (Schema), BoardOp, applyOp, foldOps
  simulate.ts  simulate(doc, load) → SimResult; latency, cost
  goals.ts     Goal (Schema-union), evaluateGoals(doc, goals) → GoalResult[]
  geometry.ts  размеры блоков, кривые связей, точка на кривой
apps/web/src/board/          Submodel доски (Foldkit)
  model.ts message.ts update.ts pointer.ts(Mount) view.ts particles.ts
apps/web/src/lesson/         плеер урока
  model.ts message.ts update.ts view/{theory,task,hud,journal}.ts markup.ts
apps/web/src/lessons/NN-slug/lesson.ts + text.<locale>.ts
```

### D2. `BoardOp` и свёртка

`BoardOp = defineTaggedUnion({ AddNode, RemoveNode, MoveNode, Connect, Disconnect, SetLoad, FailNode, RecoverNode })`. `applyOp(doc, op): Result<BoardDoc, BoardRefusal>`, где `BoardRefusal` — доменное сообщение (D7). `foldOps` применяет список и пропускает отклонённые операции: авторские операции заранее проверяются тестами контента.

Доска на шаге N = `foldOps(empty, ops шагов 0..N, а на шаге задачи плюс log ученика)`. Model хранит только номер шага, лог и redo, но не саму доску. Доску view и update вычисляют свёрткой: графы маленькие, а свёртка дешевле синхронизации двух источников.

### D3. Подсветки и подписи шага — данные урока, а не Model

Стадийные элементы (`Highlight{target, tone}`, `Annotate{target, key, tone}`) лежат в `lesson.ts`. Текст подписи берётся из текстов урока по `key` и может быть функцией от результата симуляции. Поэтому стадия не попадает в Model и не нуждается в сериализации, а «Назад» показывает подсветки нужного шага по построению.

### D4. Симулятор

`simulate(doc, load)` — чистая функция модели потоков из макета:

- блоки обходятся по рангу: пользователи → балансировщик → сервер → база;
- нагрузка распределяется по связям;
- p95 считается взвешенно по обработанным запросам: `18 + 26/(1−min(ρ,0.98))` для сервера, `4 + 9/(1−min(ρ,0.98))` для базы, +6 мс через балансировщик.

Цифры условные и подобраны под урок. Это отражено в интерфейсе: «модель, цифры условные».

Анимационное состояние живёт в Model плеера: `clock`, плавно меняющаяся `shownLoad`, сглаженные значения для блоков, рёбер и приборов, кольцевые буферы спарклайнов. Его двигает `Subscription.animationFrameEntry` → `TickedFrame{deltaMs}`, где `deltaMs` ограничен 64 мс. На паузе и при reduced motion сглаживание мгновенное, а `clock` стоит. `TickedFrame` исключён из истории DevTools.

### D5. Рендер доски: SVG и Canvas

- Блоки, связи, подписи, подсветки и призрак рисует SVG через `h` (`viewBox 0 0 900 560`, `preserveAspectRatio="xMidYMid meet"`). Блоки — `createKeyedLazy` по id и данным блока, чтобы кадры анимации не пересобирали неизменные блоки.
- Частицы рисует `Canvas.view` с внутренним размером 1800×1120 (2× для чётких точек) и CSS `object-fit: contain`. Холст вписывается в тот же прямоугольник, что и SVG с `meet`, поэтому координаты частиц — те же единицы доски ×2, без измерения DOM.
- Полоски загрузки и подписи потоков на рёбрах обновляются через тот же SVG по сглаженным значениям.

**Замер 2026-10-29 (задача 2.1):** стенд с 15 блоками в SVG, 10 кривыми и 150 частицами на `Canvas.view`, 600 кадров в Chromium. update — медиана 0 мс; view — медиана 0,2 мс, p95 0,4 мс; интервал кадров — медиана 16,7 мс, максимум 20,8 мс, длинных кадров (> 25 мс) нет. Частицы на холсте 1800×1120 с `object-fit: contain` точно совпали с кривыми SVG. Запасной путь не нужен. Изначальный порог был такой: первая задача реализации — замер. Если кадр урока с 15 блоками и 150 частицами дольше 8 мс в Chrome на M-классе, текстовая панель выносится в `createLazy`, а частоту подписей на рёбрах снижаем до 10 Гц. Это решение принимается до остального UI.

### D6. Указатель — один `Mount.defineStream` на обёртке доски

`h.OnMount(BoardPointer())` на контейнере палитры и доски слушает `pointerdown/move/up/cancel`. Он переводит координаты в единицы доски (`svg.getScreenCTM().inverse()`) и определяет цель по `closest('[data-node]' | '[data-port]' | '[data-edge]' | '[data-delete]' | '[data-palette]')`. Наружу уходят Messages `PressedBoard{target, point}`, `MovedPointer{point}`, `ReleasedPointer{target, point}`, `CancelledPointer`.

Перетаскивание из палитры, которое закончилось на доске, гасит следующий за ним `click` в фазе захвата. Тогда добавление кликом и клавиатурой (`OnClick` на кнопке палитры) не срабатывает дважды.

Логика жестов — автомат `Gesture = Idle | DraggingNode | Connecting | PlacingFromPalette` в Model доски, полностью покрытый Story-тестами.

Доска не меняет граф сама. Действие ученика уходит OutMessage `ProposedOp{op}`, плеер проверяет его через `applyOp` и пишет в лог. Отказ превращается в тост с доменным сообщением.

### D7. Доменные сообщения

`DomainMessage` пополняется кодами:

- отказы доски: `ConnectSelf`, `ConnectDuplicate`, `ConnectIntoClients`, `ConnectClientsToDatabase`, `ConnectServerToServer`, `ConnectBalancerToDatabase`, `ConnectWrongDirection`, `NodeIsPartOfTask`;

Сообщения о невыполненных целях тоже встроенные, общие для всех уроков: `GoalMissingKind`, `GoalTooFewTargets`, `GoalDirectPath`, `GoalNotConnected`, `GoalTooManyErrors`. Названия видов блоков в нужных падежах лежат в словарях. Автор урока пишет только названия целей для чек-листа и подсказки.

### D8. Формат урока (TS DSL)

```ts
export default defineLesson({
  slug: 'load-balancer',
  steps: [
    step('one-server', {
      ops: [addNode('users', 'client', 100, 280, { locked: true }), …, setLoad(300)],
      stage: [annotate('app1', 'app1Load', 'ink')],
    }),
    …
    task('place-lb', {
      palette: ['lb', 'server'],
      goals: [hasKind('lb'), fansOut('lb', 'server', 3), onlyThrough('client', 'server', 'lb'), maxErrorRate(0.01, 900)],
      solution: [addNode('lb-1', 'lb', 300, 280), connect('lb-1', 'app1'), …],
      ghost: { kind: 'lb', x: 300, y: 280 },
    }),
  ],
})
```

Тексты: `text.<locale>.ts satisfies LessonTexts<typeof lesson>`. Тип выводится из id шагов, ключей подписей, id целей и числа подсказок. Проза — строки с мини-разметкой: `**жирный**` и `[[app1|сервер]]` для ссылки на блок. Текст шага может быть функцией от контекста (результат симуляции шага), например «каждый получает 450 rps». Парсер разметки — маленькая чистая функция с тестами, без HTML-инъекций: выводит только текстовые узлы и `strong`/`span`.

### D9. Маршрут и Model плеера

`AppRoute.Lesson` получает `step: Option<number>` (query `step`). Корневой Model хранит `Option<LessonPlayer.Model>`: создаётся при входе в урок, сбрасывается при уходе.

Состояние решённой задачи на время визита хранится в корневом Model в `solvedTasks: Record<slug, TaskOutcome>`, поэтому возврат к уроку его не теряет. Смена шага делает `replaceUrl` с новым `?step`.

### D10. Тесты контента

Для каждого урока с `lesson.ts`:

- все авторские операции применяются без отказов;
- старт задачи не проходит цели, а эталон проходит все, включая скрытую;
- все `[[id|…]]` и цели подсветок существуют на доске своего шага;
- тексты полны для объявленных языков: типы плюс тест на непустые строки.

## Risks / Trade-offs

- [60 кадров через Elm-цикл] → Замер первой задачей (D5); ленивые узлы; приборы и подписи можно реже. Запасной путь — вынести частицы в Mount с собственным `requestAnimationFrame`, сохранив Model как источник потоков.
- [Мост указателя через DOM (`getScreenCTM`, `closest`) не покрывается Scene-тестами] → Логика жестов покрыта Story-тестами на синтетических Messages; сам Mount проверяется ручным прогоном и e2e позже.
- [Условные цифры симулятора учат неточным величинам] → Подпись «модель, цифры условные». Задачи проверяют относительное поведение (ошибки ниже порога), а не точные миллисекунды.
- [Переводы шагов урока на uk и lt пишет не носитель] → Вычитка перед публикацией уроков.
