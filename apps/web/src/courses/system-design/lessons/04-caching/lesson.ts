import { Goal } from '../../../../domain/goals'
import {
  addNode,
  annotate,
  connect,
  failNode,
  flow,
  highlight,
  recoverNode,
  setCacheMode,
  setLoad,
} from '../../../../kinds/flow/dsl'
import { defineLesson } from '../../../../lesson/dsl'

// Кеш ставит ученик, а доска называет первый добавленный кеш `cache-1`.
// Эталон использует тот же id, чтобы вторая задача, отказ кеша и ссылки в
// текстах работали и на доске ученика, и после «Показать решение».
//
// Числа: пять серверов по 400 rps, база на 1500 rps. При 1600 rps серверы
// загружены на 80 % и справляются, а база получает все 1600 и теряет 100.
// С кешем база получает запись (20 %) и промахи (20 % чтения): 320 + 256,
// в обоих паттернах. Различается, кто читает базу при промахе: в cache-aside
// сервер (связь сервер → база несёт запись и промахи), в read-through сам
// кеш (связь кеш → база). Первая задача — cache-aside; вторая переключает
// доску в read-through, и пока у кеша нет связи с базой, промахи теряются.
//
// Раскладка оставляет место подписям связей: кеш над базой и левее её, база
// у правого края.

const CACHE_X = 640
const CACHE_Y = 150

export default defineLesson(flow, {
  slug: 'caching',
  steps: [
    {
      id: 'five-servers',
      ops: [
        addNode('users', 'client', 90, 280),
        addNode('lb', 'lb', 250, 280),
        addNode('app1', 'server', 420, 80),
        addNode('app2', 'server', 420, 180),
        addNode('app3', 'server', 420, 280),
        addNode('app4', 'server', 420, 380),
        addNode('app5', 'server', 420, 480),
        addNode('db', 'db', 800, 400),
        connect('users', 'lb'),
        connect('lb', 'app1'),
        connect('lb', 'app2'),
        connect('lb', 'app3'),
        connect('lb', 'app4'),
        connect('lb', 'app5'),
        connect('app1', 'db'),
        connect('app2', 'db'),
        connect('app3', 'db'),
        connect('app4', 'db'),
        connect('app5', 'db'),
        setLoad(1200),
      ],
      stage: [
        annotate('db', 'dbLoad', sim =>
          (sim.nodes['db']?.utilization ?? 0) >= 0.8 ? 'warn' : 'ink',
        ),
      ],
    },
    {
      id: 'db-overload',
      ops: [setLoad(1600)],
      stage: [
        highlight('db', 'bad'),
        annotate('db', 'dbOverload', 'bad'),
        annotate('app3', 'serverCalm', 'ok'),
      ],
    },
    {
      id: 'reads-and-writes',
      ops: [],
      stage: [highlight('db', 'warn'), annotate('db', 'readsWrites', 'warn')],
      // Предсказать до задачи, сколько дойдёт до базы: запись (20 %) плюс
      // промахи кеша (20 % чтений). Итог задачи покажет то же число.
      quiz: {
        id: 'db-after-cache',
        kind: 'Choice',
        candidates: ['unchanged', 'all-reads', 'writes-and-misses', 'misses'],
        answer: 'writes-and-misses',
      },
    },
    {
      id: 'two-patterns',
      ops: [],
      stage: [highlight('db', 'warn'), highlight('app3', 'info')],
    },
    {
      id: 'cache-aside',
      ops: [setCacheMode('cache-aside')],
      stage: [],
      task: {
        id: 'cache-aside',
        palette: ['cache'],
        goals: [
          { id: 'cache-exists', goal: Goal.HasKind({ kind: 'cache' }) },
          {
            id: 'servers-use-cache',
            goal: Goal.FansOut({ from: 'server', to: 'cache', min: 1 }),
          },
          {
            id: 'no-cache-db',
            goal: Goal.NoLink({ from: 'cache', to: 'db' }),
          },
          {
            id: 'db-relieved',
            goal: Goal.MaxUtilization({ kind: 'db', max: 0.45, load: 1600 }),
          },
          {
            id: 'holds-load',
            goal: Goal.MaxErrorRate({ max: 0.01, load: 1600 }),
          },
        ],
        solution: [
          addNode('cache-1', 'cache', CACHE_X, CACHE_Y, { locked: false }),
          connect('app1', 'cache-1'),
          connect('app2', 'cache-1'),
          connect('app3', 'cache-1'),
          connect('app4', 'cache-1'),
          connect('app5', 'cache-1'),
        ],
      },
    },
    {
      id: 'aside-result',
      ops: [],
      stage: [
        annotate('cache-1', 'cacheHits', 'ok'),
        annotate('db', 'dbAfter', 'info'),
      ],
    },
    {
      id: 'read-through',
      ops: [setCacheMode('read-through')],
      stage: [
        highlight('cache-1', 'bad'),
        annotate('cache-1', 'missesLost', sim =>
          (sim.nodes['cache-1']?.dropped ?? 0) >= 1 ? 'bad' : 'ok',
        ),
      ],
      task: {
        id: 'read-through',
        palette: ['cache'],
        goals: [
          {
            id: 'cache-reads-db',
            goal: Goal.FansOut({ from: 'cache', to: 'db', min: 1 }),
          },
          {
            id: 'db-relieved',
            goal: Goal.MaxUtilization({ kind: 'db', max: 0.45, load: 1600 }),
          },
          {
            id: 'holds-load',
            goal: Goal.MaxErrorRate({ max: 0.01, load: 1600 }),
          },
        ],
        solution: [connect('cache-1', 'db')],
      },
    },
    {
      id: 'compare',
      ops: [],
      stage: [
        annotate('cache-1', 'cacheHits', 'ok'),
        annotate('db', 'dbAfter', 'info'),
      ],
      // Оба паттерна дают базе одинаковую нагрузку; различаются они тем, кто
      // знает дорогу к базе. Это и проверяет вопрос об упавшем кеше.
      quiz: {
        id: 'cache-down-pattern',
        kind: 'Choice',
        candidates: ['cache-aside', 'read-through', 'both', 'neither'],
        answer: 'cache-aside',
      },
    },
    {
      id: 'stale-data',
      ops: [],
      stage: [highlight('cache-1', 'warn')],
    },
    {
      id: 'cache-down',
      ops: [failNode('cache-1')],
      stage: [
        highlight('cache-1', 'bad'),
        annotate('db', 'dbOverload', sim =>
          sim.errorRate > 0.01 ? 'bad' : 'warn',
        ),
      ],
    },
    {
      id: 'summary',
      ops: [recoverNode('cache-1')],
      stage: [
        highlight('cache-1', 'ok'),
        annotate('db', 'dbAfter', 'ok'),
        annotate('app3', 'serversNext', 'warn'),
      ],
    },
  ],
})
