import { Goal } from '../../../../domain/goals'
import {
  addNode,
  annotate,
  connect,
  defineLesson,
  highlight,
  setLoad,
} from '../../../../lesson/dsl'

// Чтобы реплики честно не спасали базу, одна запись (20 % нагрузки) должна
// занимать больше 80 % её 1500 rps, а чтение забирает кеш. Это тысячи rps,
// поэтому блок сервера здесь — группа из шести серверов за своим
// балансировщиком: 6 × 400 = 2400 rps. При 6400 rps запись даёт 1280 rps
// (85 % базы). Базы не переопределяются: шард из палитры такой же, как
// исходная база.
//
// Шард ставит ученик, а доска называет первую добавленную базу `db2`.
// Эталон использует тот же id, чтобы шаги после задачи ссылались на неё.

const groups = ['group1', 'group2', 'group3', 'group4'] as const

const GROUP_CAPACITY = 2400

export default defineLesson({
  slug: 'sharding',
  steps: [
    {
      id: 'one-primary',
      ops: [
        addNode('users', 'client', 100, 280),
        ...groups.map((id, index) =>
          addNode(id, 'server', 330, 100 + index * 120, {
            capacity: GROUP_CAPACITY,
          }),
        ),
        addNode('cache-1', 'cache', 560, 500),
        addNode('db', 'db', 790, 170),
        ...groups.map(id => connect('users', id)),
        ...groups.map(id => connect(id, 'cache-1')),
        ...groups.map(id => connect(id, 'db')),
        connect('cache-1', 'db'),
        setLoad(3200),
      ],
      stage: [annotate('db', 'writesAndMisses', 'ink')],
    },
    {
      id: 'sale-day',
      ops: [setLoad(6400)],
      stage: [highlight('db', 'bad'), annotate('db', 'dbOverload', 'bad')],
    },
    {
      id: 'replicas-wont-help',
      ops: [],
      stage: [highlight('db', 'warn'), annotate('db', 'writesAlone', 'warn')],
    },
    {
      id: 'split-data',
      ops: [],
      stage: [],
      task: {
        id: 'split-data',
        palette: ['db'],
        goals: [
          {
            id: 'servers-use-shards',
            goal: Goal.FansOut({ from: 'server', to: 'db', min: 2 }),
          },
          {
            id: 'cache-uses-shards',
            goal: Goal.FansOut({ from: 'cache', to: 'db', min: 2 }),
          },
          {
            id: 'shard-headroom',
            goal: Goal.MaxUtilization({ kind: 'db', max: 0.8, load: 6400 }),
          },
          {
            id: 'holds-load',
            goal: Goal.MaxErrorRate({ max: 0.01, load: 6400 }),
          },
        ],
        solution: [
          addNode('db2', 'db', 790, 410, { locked: false }),
          ...groups.map(id => connect(id, 'db2')),
          connect('cache-1', 'db2'),
        ],
      },
    },
    {
      id: 'shard-key',
      ops: [],
      stage: [
        annotate('db', 'shardOne', 'info'),
        annotate('db2', 'shardTwo', 'info'),
      ],
    },
    {
      id: 'resharding',
      ops: [setLoad(7200)],
      stage: [
        annotate('db', 'shardOneGrowth', sim =>
          (sim.nodes['db']?.utilization ?? 0) > 0.8 ? 'warn' : 'ok',
        ),
        annotate('db2', 'shardTwoGrowth', sim =>
          (sim.nodes['db2']?.utilization ?? 0) > 0.8 ? 'warn' : 'ok',
        ),
      ],
    },
    {
      id: 'summary',
      ops: [],
      stage: [
        highlight('db', 'warn'),
        highlight('db2', 'warn'),
        annotate('db', 'onlyCopyOne', 'warn'),
        annotate('db2', 'onlyCopyTwo', 'warn'),
      ],
    },
  ],
})
