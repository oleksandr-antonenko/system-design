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

// Второй балансировщик и реплику ставит ученик: доска называет их `lb-2` и
// `replica-1`, как и эталон, поэтому шаги после задачи ссылаются на эти id.
// Нагрузка 600 rps: трёх серверов хватает и без одного из них (N+1), так что
// единые точки отказа здесь только балансировщик и база.
export default defineLesson({
  slug: 'fault-tolerance',
  steps: [
    {
      id: 'count-spares',
      ops: [
        addNode('users', 'client', 100, 280),
        addNode('lb-1', 'lb', 300, 210),
        addNode('app1', 'server', 520, 280),
        addNode('app2', 'server', 520, 130),
        addNode('app3', 'server', 520, 430),
        addNode('db', 'db', 790, 210),
        connect('users', 'lb-1'),
        connect('lb-1', 'app1'),
        connect('lb-1', 'app2'),
        connect('lb-1', 'app3'),
        connect('app1', 'db'),
        connect('app2', 'db'),
        connect('app3', 'db'),
        setLoad(600),
      ],
      stage: [
        highlight('lb-1', 'warn'),
        highlight('db', 'warn'),
        annotate('lb-1', 'single', 'warn'),
        annotate('db', 'single', 'warn'),
        annotate('app2', 'nPlusOne', 'ok'),
      ],
    },
    {
      id: 'balancer-down',
      ops: [failNode('lb-1')],
      stage: [
        highlight('lb-1', 'bad'),
        annotate('lb-1', 'outage', 'bad'),
        annotate('app2', 'idle', 'warn'),
      ],
    },
    {
      id: 'database-down',
      ops: [recoverNode('lb-1'), failNode('db')],
      stage: [
        highlight('db', 'bad'),
        annotate('db', 'outage', 'bad'),
        annotate('app2', 'nowhereToWrite', 'warn'),
      ],
    },
    {
      id: 'add-spares',
      ops: [recoverNode('db')],
      stage: [],
      task: {
        id: 'add-spares',
        palette: ['lb', 'replica'],
        goals: [
          {
            id: 'two-balancers',
            goal: Goal.FansOut({ from: 'client', to: 'lb', min: 2 }),
          },
          { id: 'replica-exists', goal: Goal.HasKind({ kind: 'replica' }) },
          {
            id: 'survives-failure',
            goal: Goal.SurvivesFailure({
              kinds: ['lb', 'server', 'db'],
              maxErrorRate: 0.01,
              load: 600,
            }),
          },
        ],
        solution: [
          addNode('lb-2', 'lb', 300, 350, { locked: false }),
          connect('lb-2', 'app1'),
          connect('lb-2', 'app2'),
          connect('lb-2', 'app3'),
          connect('users', 'lb-2'),
          addNode('replica-1', 'replica', 790, 350, { locked: false }),
          connect('app1', 'replica-1'),
          connect('app2', 'replica-1'),
          connect('app3', 'replica-1'),
        ],
      },
    },
    {
      id: 'balancer-failover',
      ops: [failNode('lb-1')],
      stage: [
        highlight('lb-1', 'bad'),
        highlight('lb-2', 'ok'),
        annotate('lb-2', 'takesAll', sim =>
          sim.errorRate > 0.01 ? 'bad' : 'ok',
        ),
      ],
    },
    {
      id: 'database-failover',
      ops: [recoverNode('lb-1'), failNode('db')],
      stage: [
        highlight('db', 'bad'),
        highlight({ kind: 'replica' }, 'ok'),
        annotate({ kind: 'replica' }, 'promoted', sim =>
          sim.errorRate > 0.01 ? 'bad' : 'ok',
        ),
      ],
    },
    {
      id: 'summary',
      ops: [recoverNode('db')],
      stage: [annotate('lb-1', 'pair', 'ok'), annotate('db', 'copies', 'ok')],
    },
  ],
})
