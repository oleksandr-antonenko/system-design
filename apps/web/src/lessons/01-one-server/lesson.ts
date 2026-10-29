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

// Сервер ставит ученик, поэтому шаги после задачи ссылаются на его блок:
// первый сервер из палитры получает id `app1`, как и в эталоне.
export default defineLesson({
  slug: 'one-server',
  steps: [
    {
      id: 'no-answer',
      ops: [addNode('users', 'client', 100, 280), setLoad(100)],
      stage: [annotate('users', 'noAnswer', 'bad')],
    },
    {
      id: 'place-server',
      ops: [],
      stage: [],
      task: {
        id: 'place-server',
        palette: ['server'],
        goals: [
          { id: 'server-exists', goal: Goal.HasKind({ kind: 'server' }) },
          {
            id: 'users-connected',
            goal: Goal.FansOut({ from: 'client', to: 'server', min: 1 }),
          },
          {
            id: 'answers',
            goal: Goal.MaxErrorRate({ max: 0.01, load: 100 }),
          },
        ],
        solution: [
          addNode('app1', 'server', 450, 280, { locked: false }),
          connect('users', 'app1'),
        ],
      },
    },
    {
      id: 'reading-the-board',
      ops: [setLoad(200)],
      stage: [annotate('app1', 'responseTime', 'ink')],
    },
    {
      id: 'near-limit',
      ops: [setLoad(360)],
      stage: [
        annotate('app1', 'nearLimit', sim =>
          (sim.nodes['app1']?.utilization ?? 0) > 0.8 ? 'warn' : 'ok',
        ),
      ],
    },
    {
      id: 'overload',
      ops: [setLoad(600)],
      stage: [
        annotate('app1', 'overload', sim =>
          sim.errorRate > 0.01 ? 'bad' : 'ok',
        ),
      ],
    },
    {
      id: 'single-point',
      ops: [setLoad(200), failNode('app1')],
      stage: [highlight('app1', 'bad'), annotate('app1', 'down', 'bad')],
    },
    {
      id: 'summary',
      ops: [recoverNode('app1')],
      stage: [highlight('app1', 'warn'), annotate('app1', 'ceiling', 'warn')],
    },
  ],
})
