import { Goal } from '../../../../domain/goals'
import {
  addNode,
  annotate,
  connect,
  defineLesson,
  failRegion,
  highlight,
  recoverRegion,
  setLoad,
} from '../../../../lesson/dsl'

// Европа сверху, США снизу. Зона США охватывает пользователей (y 340) и
// реплику (y 480), поэтому места палитры по умолчанию для балансировщика
// (300, 280) и сервера (520, 515) попадают в неё: блок, поставленный кликом,
// тоже получает регион США. Блоки ученика получают id `lb-2`, `app3`,
// `app4`, как и в эталоне, но шаги после задачи ссылаются только на блоки
// урока.
export default defineLesson({
  slug: 'multi-region',
  steps: [
    {
      id: 'one-region',
      ops: [
        addNode('users-eu', 'client', 100, 140, { region: 'eu' }),
        addNode('lb-1', 'lb', 300, 140, { region: 'eu' }),
        addNode('app1', 'server', 520, 100, { region: 'eu' }),
        addNode('app2', 'server', 520, 190, { region: 'eu' }),
        addNode('db', 'db', 760, 140, { region: 'eu' }),
        addNode('users-us', 'client', 100, 340, { region: 'us' }),
        connect('users-eu', 'lb-1'),
        connect('users-us', 'lb-1'),
        connect('lb-1', 'app1'),
        connect('lb-1', 'app2'),
        connect('app1', 'db'),
        connect('app2', 'db'),
        setLoad(500),
      ],
      stage: [
        annotate('users-eu', 'nearTrip', 'ok'),
        highlight('users-us', 'warn'),
        annotate('users-us', 'farTrip', 'warn'),
      ],
    },
    {
      id: 'region-down',
      ops: [failRegion('eu')],
      stage: [
        annotate('users-eu', 'noAnswer', 'bad'),
        annotate('users-us', 'noAnswer', 'bad'),
        highlight('db', 'bad'),
      ],
    },
    {
      id: 'second-region',
      ops: [
        recoverRegion('eu'),
        addNode('replica-1', 'replica', 760, 480, { region: 'us' }),
      ],
      stage: [
        annotate('db', 'leader', 'ink'),
        highlight('replica-1', 'info'),
        annotate('replica-1', 'replicaIdle', 'info'),
      ],
    },
    {
      id: 'build-us',
      ops: [],
      stage: [],
      task: {
        id: 'build-us',
        palette: ['lb', 'server'],
        goals: [
          {
            id: 'two-entrances',
            goal: Goal.FansOut({ from: 'client', to: 'lb', min: 2 }),
          },
          {
            id: 'reads-replica',
            goal: Goal.FansOut({ from: 'server', to: 'replica', min: 1 }),
          },
          {
            id: 'holds-load',
            goal: Goal.MaxErrorRate({ max: 0.01, load: 500 }),
          },
          {
            id: 'fast',
            goal: Goal.MaxP95({ max: 160, load: 500 }),
          },
          {
            id: 'survives-eu',
            goal: Goal.SurvivesRegionFailure({
              region: 'eu',
              maxErrorRate: 0.01,
              load: 500,
            }),
          },
        ],
        solution: [
          addNode('lb-2', 'lb', 300, 410, { locked: false, region: 'us' }),
          addNode('app3', 'server', 520, 350, { locked: false, region: 'us' }),
          addNode('app4', 'server', 520, 470, { locked: false, region: 'us' }),
          connect('lb-2', 'app3'),
          connect('lb-2', 'app4'),
          connect('app3', 'db'),
          connect('app3', 'replica-1'),
          connect('app4', 'db'),
          connect('app4', 'replica-1'),
          connect('users-us', 'lb-2'),
          connect('users-eu', 'lb-2'),
        ],
      },
    },
    {
      id: 'failover',
      ops: [failRegion('eu')],
      stage: [
        highlight('replica-1', 'ok'),
        annotate('replica-1', 'promoted', sim =>
          (sim.nodes['replica-1']?.incoming ?? 0) > 0 ? 'ok' : 'bad',
        ),
        annotate('users-eu', 'detour', sim =>
          sim.errorRate > 0.01 ? 'bad' : 'warn',
        ),
      ],
    },
    {
      id: 'cap',
      ops: [recoverRegion('eu')],
      stage: [
        highlight('db', 'warn'),
        annotate('db', 'oldLeader', 'warn'),
        annotate('replica-1', 'lag', 'info'),
      ],
    },
    {
      id: 'summary',
      ops: [],
      stage: [annotate('db', 'writesHere', 'warn')],
    },
  ],
})
