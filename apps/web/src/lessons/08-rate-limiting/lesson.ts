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

// Ограничитель ставит ученик: первый ограничитель из палитры получает id
// `limiter-1`, как и в эталоне, поэтому шаги после задачи ссылаются на него.
// Ограничитель ученика берёт ёмкость из каталога: 1000 rps.
export default defineLesson({
  slug: 'rate-limiting',
  steps: [
    {
      id: 'normal-day',
      ops: [
        addNode('users', 'client', 100, 280),
        addNode('lb-1', 'lb', 460, 280),
        addNode('app1', 'server', 640, 130),
        addNode('app2', 'server', 640, 280),
        addNode('app3', 'server', 640, 430),
        addNode('db', 'db', 810, 280),
        connect('users', 'lb-1'),
        connect('lb-1', 'app1'),
        connect('lb-1', 'app2'),
        connect('lb-1', 'app3'),
        connect('app1', 'db'),
        connect('app2', 'db'),
        connect('app3', 'db'),
        setLoad(600),
      ],
      stage: [annotate('lb-1', 'headroom', 'ok')],
    },
    {
      id: 'spike',
      ops: [setLoad(2000)],
      stage: [
        highlight('app1', 'bad'),
        highlight('app2', 'bad'),
        highlight('app3', 'bad'),
        annotate('lb-1', 'headroom', 'bad'),
        annotate('app2', 'overloaded', 'bad'),
      ],
    },
    {
      id: 'cascade',
      ops: [failNode('app2')],
      stage: [
        highlight('app2', 'bad'),
        annotate('app2', 'crashed', 'bad'),
        annotate('app1', 'survivor', 'bad'),
      ],
    },
    {
      id: 'place-limiter',
      ops: [recoverNode('app2')],
      stage: [],
      task: {
        id: 'place-limiter',
        palette: ['limiter'],
        goals: [
          { id: 'limiter-exists', goal: Goal.HasKind({ kind: 'limiter' }) },
          {
            id: 'only-through-limiter',
            goal: Goal.OnlyThrough({
              from: 'client',
              to: 'lb',
              via: 'limiter',
            }),
          },
          {
            id: 'fast-answers',
            goal: Goal.MaxP95({ max: 250, load: 2000 }),
          },
          {
            id: 'servers-headroom',
            goal: Goal.MaxUtilization({ kind: 'server', max: 0.9, load: 2000 }),
          },
        ],
        solution: [
          addNode('limiter-1', 'limiter', 280, 280, { locked: false }),
          connect('limiter-1', 'lb-1'),
          connect('users', 'limiter-1'),
          disconnect('users', 'lb-1'),
        ],
      },
    },
    {
      id: 'bots',
      ops: [setLoad(3000)],
      stage: [
        annotate({ kind: 'limiter' }, 'rejecting', 'info'),
        annotate('app2', 'steady', sim =>
          (sim.nodes['app2']?.utilization ?? 0) > 0.9 ? 'bad' : 'ok',
        ),
      ],
    },
    {
      id: 'backpressure',
      ops: [setLoad(1500)],
      stage: [
        annotate('users', 'backingOff', 'info'),
        annotate({ kind: 'limiter' }, 'rejecting', 'info'),
      ],
    },
    {
      id: 'summary',
      ops: [setLoad(600)],
      stage: [
        highlight({ kind: 'limiter' }, 'ok'),
        annotate({ kind: 'limiter' }, 'limiterCost', 'ok'),
        annotate('db', 'databaseLimit', 'info'),
      ],
    },
  ],
})
