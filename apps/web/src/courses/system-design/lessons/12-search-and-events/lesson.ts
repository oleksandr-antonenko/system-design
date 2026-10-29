import { Goal } from '../../../../domain/goals'
import {
  addNode,
  annotate,
  connect,
  defineLesson,
  failNode,
  highlight,
  recoverNode,
  setLoad,
} from '../../../../lesson/dsl'

// Поисковый индекс стоит на доске с самого начала: он есть, но получает
// изменения только ночной перестройкой, и это видно (0 rps). Шину и
// обработчик аналитики ставит ученик: доска даёт им id events-1 и worker-1,
// эталон использует те же id, чтобы шаги после задачи работали и на доске
// ученика. Индекс в палитру не входит: второй индекс рядом с готовым только
// запутал бы шаги об отставании и отказе индекса.

export default defineLesson({
  slug: 'search-and-events',
  steps: [
    {
      id: 'catalog',
      ops: [
        addNode('users', 'client', 100, 240),
        addNode('app1', 'server', 320, 160),
        addNode('app2', 'server', 320, 320),
        addNode('db', 'db', 790, 120),
        connect('users', 'app1'),
        connect('users', 'app2'),
        connect('app1', 'db'),
        connect('app2', 'db'),
        setLoad(150),
      ],
      stage: [annotate('db', 'sourceOfTruth', 'ink')],
    },
    {
      id: 'stale-index',
      ops: [addNode('search', 'search', 790, 300)],
      stage: [
        highlight('search', 'bad'),
        annotate('search', 'staleIndex', 'bad'),
      ],
    },
    {
      id: 'publish-subscribe',
      ops: [],
      stage: [
        highlight('app1', 'info'),
        highlight('app2', 'info'),
        annotate('search', 'wantsEveryChange', 'warn'),
      ],
    },
    {
      id: 'connect-bus',
      ops: [],
      stage: [],
      task: {
        id: 'connect-bus',
        palette: ['events', 'worker'],
        goals: [
          { id: 'bus-exists', goal: Goal.HasKind({ kind: 'events' }) },
          {
            id: 'servers-publish',
            goal: Goal.OnlyThrough({
              from: 'server',
              to: 'search',
              via: 'events',
            }),
          },
          {
            id: 'index-subscribed',
            goal: Goal.FansOut({ from: 'events', to: 'search', min: 1 }),
          },
          {
            id: 'analytics-subscribed',
            goal: Goal.FansOut({ from: 'events', to: 'worker', min: 1 }),
          },
          {
            id: 'keeps-up',
            goal: Goal.MaxBacklog({ max: 0, load: 150 }),
          },
        ],
        solution: [
          addNode('events-1', 'events', 550, 400, { locked: false }),
          connect('app1', 'events-1'),
          connect('app2', 'events-1'),
          connect('events-1', 'search'),
          addNode('worker-1', 'worker', 790, 460, { locked: false }),
          connect('events-1', 'worker-1'),
        ],
      },
    },
    {
      id: 'lagging-subscriber',
      ops: [setLoad(300)],
      stage: [
        annotate('search', 'indexKeepsUp', 'ok'),
        annotate('worker-1', 'analyticsLag', sim =>
          (sim.nodes['worker-1']?.utilization ?? 0) >= 1 ? 'warn' : 'ok',
        ),
      ],
    },
    {
      id: 'index-down',
      ops: [setLoad(150), failNode('search')],
      stage: [
        highlight('search', 'bad'),
        annotate('search', 'indexDown', 'bad'),
        annotate({ kind: 'events' }, 'busKeeps', sim =>
          sim.backlog >= 1 ? 'warn' : 'ok',
        ),
      ],
    },
    {
      id: 'summary',
      ops: [recoverNode('search')],
      stage: [
        annotate('search', 'caughtUp', 'ok'),
        annotate({ kind: 'events' }, 'busCopies', 'ok'),
      ],
    },
  ],
})
