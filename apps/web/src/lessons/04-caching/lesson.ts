import { Goal } from '../../domain/goals'
import {
  addNode,
  annotate,
  connect,
  defineLesson,
  failNode,
  highlight,
  recoverNode,
  setLoad,
} from '../../lesson/dsl'

// Кеш ставит ученик, а доска называет первый добавленный кеш `cache-1`.
// Эталон использует тот же id, чтобы шаги после задачи (отказ кеша, ссылки
// в текстах) работали и на доске ученика, и после «Показать решение».
//
// Числа: пять серверов по 400 rps, база на 1500 rps. При 1600 rps серверы
// загружены на 80 % и справляются, а база получает все 1600 и теряет 100.
// С кешем база получает запись (20 %) и промахи (20 % чтения): 320 + 256.

export default defineLesson({
  slug: 'caching',
  steps: [
    {
      id: 'five-servers',
      ops: [
        addNode('users', 'client', 100, 280),
        addNode('lb', 'lb', 280, 280),
        addNode('app1', 'server', 450, 80),
        addNode('app2', 'server', 450, 180),
        addNode('app3', 'server', 450, 280),
        addNode('app4', 'server', 450, 380),
        addNode('app5', 'server', 450, 480),
        addNode('db', 'db', 790, 280),
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
    },
    {
      id: 'place-cache',
      ops: [],
      stage: [],
      task: {
        id: 'place-cache',
        palette: ['cache'],
        goals: [
          { id: 'cache-exists', goal: Goal.HasKind({ kind: 'cache' }) },
          {
            id: 'servers-use-cache',
            goal: Goal.FansOut({ from: 'server', to: 'cache', min: 1 }),
          },
          {
            id: 'cache-backed-by-db',
            goal: Goal.FansOut({ from: 'cache', to: 'db', min: 1 }),
          },
          {
            id: 'db-relieved',
            goal: Goal.MaxUtilization({ kind: 'db', max: 0.6, load: 1600 }),
          },
          {
            id: 'holds-load',
            goal: Goal.MaxErrorRate({ max: 0.01, load: 1600 }),
          },
        ],
        solution: [
          addNode('cache-1', 'cache', 620, 280, { locked: false }),
          connect('app1', 'cache-1'),
          connect('app2', 'cache-1'),
          connect('app3', 'cache-1'),
          connect('app4', 'cache-1'),
          connect('app5', 'cache-1'),
          connect('cache-1', 'db'),
        ],
      },
    },
    {
      id: 'stale-data',
      ops: [],
      stage: [
        annotate('cache-1', 'cacheHits', 'ok'),
        annotate('db', 'dbAfter', 'info'),
      ],
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
