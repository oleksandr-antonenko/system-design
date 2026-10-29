import { Goal } from '../../../../domain/goals'
import {
  addNode,
  annotate,
  connect,
  disconnect,
  failNode,
  flow,
  highlight,
  recoverNode,
  setLoad,
} from '../../../../kinds/flow/dsl'
import { defineLesson } from '../../../../lesson/dsl'

// Базу добавляет ученик, а доска называет первую добавленную базу `db2`.
// Эталон использует тот же id, чтобы шаги после задачи (связь app2 → db2,
// ссылки в текстах) работали и на доске ученика, и после «Показать решение».

export default defineLesson(flow, {
  slug: 'separate-database',
  steps: [
    {
      id: 'all-in-one',
      ops: [
        addNode('users', 'client', 100, 280),
        addNode('app1', 'server', 520, 280),
        connect('users', 'app1'),
        setLoad(300),
      ],
      stage: [annotate('app1', 'app1Data', 'ink')],
    },
    {
      id: 'server-fails',
      ops: [failNode('app1')],
      stage: [highlight('app1', 'bad'), annotate('app1', 'outage', 'bad')],
    },
    {
      id: 'second-server',
      ops: [recoverNode('app1'), addNode('app2', 'server', 520, 130)],
      stage: [
        annotate('app1', 'app1Orders', 'info'),
        highlight('app2', 'warn'),
        annotate('app2', 'app2Empty', 'warn'),
      ],
    },
    {
      id: 'move-data',
      ops: [],
      stage: [],
      task: {
        id: 'move-data',
        palette: ['db'],
        goals: [
          { id: 'db-exists', goal: Goal.HasKind({ kind: 'db' }) },
          {
            id: 'server-uses-db',
            goal: Goal.FansOut({ from: 'server', to: 'db', min: 1 }),
          },
          {
            id: 'holds-load',
            goal: Goal.MaxErrorRate({ max: 0.01, load: 300 }),
          },
        ],
        solution: [
          addNode('db2', 'db', 790, 280, { locked: false }),
          connect('app1', 'db2'),
        ],
      },
    },
    {
      id: 'replace-server',
      ops: [
        failNode('app1'),
        connect('app2', 'db2'),
        connect('users', 'app2'),
        disconnect('users', 'app1'),
      ],
      stage: [
        highlight('app1', 'bad'),
        highlight('app2', 'ok'),
        annotate('app2', 'app2Serves', 'ok'),
      ],
    },
    {
      id: 'summary',
      ops: [recoverNode('app1')],
      stage: [
        annotate('app1', 'spare', 'info'),
        highlight({ kind: 'db' }, 'warn'),
        annotate({ kind: 'db' }, 'databaseLoad', 'warn'),
      ],
    },
  ],
})
