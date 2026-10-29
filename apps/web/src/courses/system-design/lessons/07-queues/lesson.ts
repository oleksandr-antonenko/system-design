import { BoardOp } from '../../../../domain/board'
import { Goal } from '../../../../domain/goals'
import {
  type NodeOptions,
  addNode,
  annotate,
  connect,
  failNode,
  flow,
  highlight,
  recoverNode,
  setLoad,
} from '../../../../kinds/flow/dsl'
import { defineLesson } from '../../../../lesson/dsl'

// Сначала серверы сами шлют письмо и собирают PDF прямо в запросе. Такой
// запрос держит сервер дольше, и сервер успевает около 150 rps вместо 400:
// это своя ёмкость блока. Операции «сменить ёмкость» нет, поэтому шаг
// `background` удаляет медленные серверы и ставит обычные с теми же id,
// местом и связями: на доске меняется только загрузка.
//
// Очередь и обработчики ставит ученик. Доска даёт им id queue-1 и
// worker-1…3, эталон использует те же id, чтобы шаги после задачи
// (отказ worker-2, ссылки в текстах) работали и на доске ученика.

const SLOW_CAPACITY = 150

const removeNode = (id: string): BoardOp => BoardOp.RemoveNode({ id })

const servers = (options: NodeOptions): ReadonlyArray<BoardOp> => [
  addNode('app1', 'server', 320, 160, options),
  addNode('app2', 'server', 320, 320, options),
  connect('users', 'app1'),
  connect('users', 'app2'),
  connect('app1', 'db'),
  connect('app2', 'db'),
]

export default defineLesson(flow, {
  slug: 'queues',
  steps: [
    {
      id: 'in-request',
      ops: [
        addNode('users', 'client', 100, 240),
        addNode('db', 'db', 790, 120),
        ...servers({ locked: false, capacity: SLOW_CAPACITY }),
        setLoad(240),
      ],
      stage: [
        highlight('app2', 'warn'),
        annotate('app1', 'slowServer', 'warn'),
      ],
    },
    {
      id: 'sale',
      ops: [setLoad(500)],
      stage: [
        highlight('app1', 'bad'),
        highlight('app2', 'bad'),
        annotate('app1', 'saleOverload', 'bad'),
      ],
    },
    {
      id: 'background',
      ops: [removeNode('app1'), removeNode('app2'), ...servers({})],
      stage: [highlight('app2', 'ok'), annotate('app1', 'lightServer', 'ok')],
    },
    {
      id: 'add-queue',
      ops: [],
      stage: [],
      task: {
        id: 'add-queue',
        palette: ['queue', 'worker'],
        goals: [
          { id: 'queue-exists', goal: Goal.HasKind({ kind: 'queue' }) },
          {
            id: 'servers-enqueue',
            goal: Goal.OnlyThrough({
              from: 'server',
              to: 'worker',
              via: 'queue',
            }),
          },
          {
            id: 'queue-has-workers',
            goal: Goal.FansOut({ from: 'queue', to: 'worker', min: 1 }),
          },
          {
            id: 'no-backlog',
            goal: Goal.MaxBacklog({ max: 0, load: 500 }),
          },
          {
            id: 'site-answers',
            goal: Goal.MaxErrorRate({ max: 0.01, load: 500 }),
          },
        ],
        solution: [
          addNode('queue-1', 'queue', 550, 400, { locked: false }),
          connect('app1', 'queue-1'),
          connect('app2', 'queue-1'),
          addNode('worker-1', 'worker', 790, 300, { locked: false }),
          addNode('worker-2', 'worker', 790, 400, { locked: false }),
          addNode('worker-3', 'worker', 790, 500, { locked: false }),
          connect('queue-1', 'worker-1'),
          connect('queue-1', 'worker-2'),
          connect('queue-1', 'worker-3'),
        ],
      },
    },
    {
      id: 'burst',
      ops: [setLoad(700)],
      stage: [
        annotate('app1', 'burstServer', sim =>
          sim.errorRate < 0.01 ? 'ok' : 'bad',
        ),
        annotate({ kind: 'queue' }, 'burstQueue', sim =>
          sim.backlog >= 1 ? 'warn' : 'ok',
        ),
      ],
    },
    {
      id: 'worker-crash',
      ops: [setLoad(500), failNode('worker-2')],
      stage: [
        highlight('worker-2', 'bad'),
        annotate('worker-2', 'crashed', 'bad'),
        annotate({ kind: 'queue' }, 'redelivered', sim =>
          sim.backlog >= 1 ? 'warn' : 'ok',
        ),
      ],
    },
    {
      id: 'summary',
      ops: [recoverNode('worker-2')],
      stage: [annotate({ kind: 'queue' }, 'steady', 'ok')],
    },
  ],
})
