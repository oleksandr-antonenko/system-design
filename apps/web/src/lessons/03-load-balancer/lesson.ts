import { Goal } from '../../domain/goals'
import {
  addNode,
  annotate,
  connect,
  defineLesson,
  disconnect,
  failNode,
  highlight,
  recoverNode,
  setLoad,
} from '../../lesson/dsl'

export default defineLesson({
  slug: 'load-balancer',
  steps: [
    {
      id: 'one-server',
      ops: [
        addNode('users', 'client', 100, 280),
        addNode('app1', 'server', 520, 280),
        addNode('db', 'db', 790, 280),
        connect('users', 'app1'),
        connect('app1', 'db'),
        setLoad(300),
      ],
      stage: [annotate('app1', 'app1Load', 'ink')],
    },
    {
      id: 'overload',
      ops: [setLoad(900)],
      stage: [
        highlight('app1', 'bad'),
        annotate('app1', 'app1Overload', 'bad'),
      ],
    },
    {
      id: 'scale-out',
      ops: [
        addNode('app2', 'server', 520, 130),
        addNode('app3', 'server', 520, 430),
        connect('app2', 'db'),
        connect('app3', 'db'),
      ],
      stage: [
        highlight('app2', 'warn'),
        highlight('app3', 'warn'),
        annotate('app2', 'idle', 'warn'),
        annotate('app3', 'idle', 'warn'),
      ],
    },
    {
      id: 'place-lb',
      ops: [],
      stage: [],
      task: {
        id: 'place-lb',
        palette: ['lb', 'server'],
        goals: [
          { id: 'lb-exists', goal: Goal.HasKind({ kind: 'lb' }) },
          {
            id: 'lb-fans-out',
            goal: Goal.FansOut({ from: 'lb', to: 'server', min: 3 }),
          },
          {
            id: 'only-through-lb',
            goal: Goal.OnlyThrough({ from: 'client', to: 'server', via: 'lb' }),
          },
          {
            id: 'holds-load',
            goal: Goal.MaxErrorRate({ max: 0.01, load: 900 }),
          },
        ],
        solution: [
          addNode('lb-1', 'lb', 300, 280, { locked: false }),
          connect('lb-1', 'app1'),
          connect('lb-1', 'app2'),
          connect('lb-1', 'app3'),
          connect('users', 'lb-1'),
          disconnect('users', 'app1'),
        ],
      },
    },
    {
      id: 'server-down',
      ops: [failNode('app2')],
      stage: [
        highlight('app2', 'bad'),
        annotate({ kind: 'lb' }, 'excluded', 'info'),
        annotate('app1', 'survivorLoad', sim =>
          (sim.nodes['app1']?.utilization ?? 0) > 1 ? 'bad' : 'ok',
        ),
      ],
    },
    {
      id: 'summary',
      ops: [recoverNode('app2')],
      stage: [highlight('db', 'warn'), annotate('db', 'databaseLoad', 'warn')],
    },
  ],
})
