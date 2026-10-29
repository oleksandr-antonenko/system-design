import { Goal } from '../../domain/goals'
import {
  addNode,
  annotate,
  connect,
  defineLesson,
  disconnect,
  highlight,
  setLoad,
} from '../../lesson/dsl'

// CDN ставит ученик, а доска называет первый добавленный CDN `cdn-1`.
// Эталон использует тот же id, чтобы ссылки в текстах после задачи работали
// и на доске ученика, и после «Показать решение».
//
// Слева от балансировщика оставлено место под CDN. Кеш из урока 4 на доске
// не показан: шестой столбец блоков не помещается.
//
// Числа: три сервера по 400 rps. При 2400 rps каждому достаётся 800, и
// половина запросов теряется. CDN сам отдаёт 60 % (статику), серверам
// остаётся 960 rps, по 320 на каждый.

export default defineLesson({
  slug: 'cdn',
  steps: [
    {
      id: 'shop-front',
      ops: [
        addNode('users', 'client', 100, 280),
        addNode('lb', 'lb', 450, 280),
        addNode('app1', 'server', 620, 130),
        addNode('app2', 'server', 620, 280),
        addNode('app3', 'server', 620, 430),
        addNode('db', 'db', 790, 280),
        connect('users', 'lb'),
        connect('lb', 'app1'),
        connect('lb', 'app2'),
        connect('lb', 'app3'),
        connect('app1', 'db'),
        connect('app2', 'db'),
        connect('app3', 'db'),
        setLoad(900),
      ],
      stage: [annotate('app2', 'serverLoad', 'ink')],
    },
    {
      id: 'photo-catalog',
      ops: [setLoad(2400)],
      stage: [
        highlight('app1', 'bad'),
        highlight('app2', 'bad'),
        highlight('app3', 'bad'),
        annotate('app2', 'serverOverload', 'bad'),
      ],
    },
    {
      id: 'static-files',
      ops: [],
      stage: [
        highlight('app2', 'warn'),
        annotate('app2', 'staticShare', 'warn'),
      ],
    },
    {
      id: 'place-cdn',
      ops: [],
      stage: [],
      task: {
        id: 'place-cdn',
        palette: ['cdn'],
        goals: [
          { id: 'cdn-exists', goal: Goal.HasKind({ kind: 'cdn' }) },
          {
            id: 'only-through-cdn',
            goal: Goal.OnlyThrough({ from: 'client', to: 'lb', via: 'cdn' }),
          },
          {
            id: 'cdn-to-lb',
            goal: Goal.FansOut({ from: 'cdn', to: 'lb', min: 1 }),
          },
          {
            id: 'holds-load',
            goal: Goal.MaxErrorRate({ max: 0.01, load: 2400 }),
          },
          {
            id: 'fast',
            goal: Goal.MaxP95({ max: 250, load: 2400 }),
          },
        ],
        solution: [
          addNode('cdn-1', 'cdn', 280, 280, { locked: false }),
          connect('users', 'cdn-1'),
          connect('cdn-1', 'lb'),
          disconnect('users', 'lb'),
        ],
      },
    },
    {
      id: 'edge-locations',
      ops: [],
      stage: [
        annotate('cdn-1', 'cdnServed', 'ok'),
        annotate('app2', 'serverAfter', 'ok'),
      ],
    },
    {
      id: 'cache-headers',
      ops: [],
      stage: [highlight('lb', 'info'), annotate('lb', 'dynamicOnly', 'info')],
    },
    {
      id: 'summary',
      ops: [],
      stage: [highlight('db', 'warn'), annotate('db', 'dbLoad', 'warn')],
    },
  ],
})
