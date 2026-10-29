import { Goal } from '../../../../domain/goals'
import {
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

// Реплики ставит ученик, а доска называет их `replica-1` и `replica-2`.
// Эталон использует те же id, чтобы шаги после задачи (лаг, повышение
// реплики) ссылались на блоки ученика так же, как после «Показать решение».

const servers = ['app1', 'app2', 'app3', 'app4', 'app5'] as const

export default defineLesson(flow, {
  slug: 'read-replicas',
  steps: [
    {
      id: 'one-database',
      ops: [
        addNode('users', 'client', 100, 280),
        addNode('lb', 'lb', 300, 280),
        ...servers.map((id, index) =>
          addNode(id, 'server', 520, 80 + index * 100),
        ),
        addNode('db', 'db', 790, 280),
        connect('users', 'lb'),
        ...servers.map(id => connect('lb', id)),
        ...servers.map(id => connect(id, 'db')),
        setLoad(1200),
      ],
      stage: [annotate('db', 'dbLoad', 'ink')],
    },
    {
      id: 'evening-peak',
      ops: [setLoad(1600)],
      stage: [highlight('db', 'bad'), annotate('db', 'dbOverload', 'bad')],
    },
    {
      id: 'reads-and-writes',
      ops: [],
      stage: [
        highlight('db', 'warn'),
        annotate('db', 'readsAndWrites', 'warn'),
      ],
    },
    {
      id: 'add-replicas',
      ops: [],
      stage: [],
      task: {
        id: 'add-replicas',
        palette: ['replica'],
        goals: [
          { id: 'replica-exists', goal: Goal.HasKind({ kind: 'replica' }) },
          {
            id: 'servers-read-replicas',
            goal: Goal.FansOut({ from: 'server', to: 'replica', min: 1 }),
          },
          {
            id: 'primary-headroom',
            goal: Goal.MaxUtilization({ kind: 'db', max: 0.8, load: 1600 }),
          },
          {
            id: 'holds-load',
            goal: Goal.MaxErrorRate({ max: 0.01, load: 1600 }),
          },
          {
            id: 'spare-replica',
            goal: Goal.SurvivesFailure({
              kinds: ['replica'],
              maxErrorRate: 0.01,
              load: 1600,
            }),
          },
        ],
        solution: [
          addNode('replica-1', 'replica', 790, 130, { locked: false }),
          addNode('replica-2', 'replica', 790, 430, { locked: false }),
          ...servers.map(id => connect(id, 'replica-1')),
          ...servers.map(id => connect(id, 'replica-2')),
        ],
      },
    },
    {
      id: 'replication-lag',
      ops: [],
      stage: [
        annotate('db', 'primaryWrites', 'ink'),
        highlight('replica-1', 'info'),
        annotate('replica-1', 'replicaBehind', 'info'),
      ],
    },
    {
      id: 'failover',
      ops: [failNode('db')],
      stage: [
        highlight('db', 'bad'),
        annotate('db', 'primaryDown', 'bad'),
        annotate('replica-1', 'promoted', sim =>
          sim.errorRate > 0.01 ? 'bad' : 'ok',
        ),
      ],
    },
    {
      id: 'summary',
      ops: [recoverNode('db')],
      stage: [
        highlight('db', 'warn'),
        annotate('db', 'writesStayHere', 'warn'),
      ],
    },
  ],
})
