import { Goal } from '../../../../domain/goals'
import {
  addNode,
  annotate,
  connect,
  flow,
  setLoad,
} from '../../../../kinds/flow/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import { budget } from './review'

// Итоговый проект: на доске только пользователи и база, остальное ученик
// собирает сам. Эталон — CDN, два балансировщика, три сервера (N+1) и
// реплика: 3,20 $ в час при бюджете 4 $. Без CDN серверов нужно шесть, и
// бюджет не сходится. Шаги после задачи ссылаются только на `users` и `db`:
// схемы учеников различаются.
export default defineLesson(flow, {
  slug: 'url-shortener',
  steps: [
    {
      id: 'requirements',
      ops: [
        addNode('users', 'client', 100, 280),
        addNode('db', 'db', 790, 200),
        setLoad(2000),
      ],
      stage: [annotate('users', 'noAnswer', 'bad')],
    },
    {
      id: 'estimates',
      ops: [],
      stage: [annotate('db', 'storage', 'info')],
    },
    {
      id: 'api',
      ops: [],
      stage: [annotate('db', 'schema', 'ink')],
    },
    {
      id: 'design',
      ops: [],
      stage: [],
      task: {
        id: 'design',
        palette: ['cdn', 'lb', 'server', 'cache', 'replica'],
        goals: [
          {
            id: 'holds-load',
            goal: Goal.MaxErrorRate({ max: 0.01, load: 2000 }),
          },
          { id: 'fast', goal: Goal.MaxP95({ max: 150, load: 2000 }) },
          {
            id: 'survives',
            goal: Goal.SurvivesFailure({
              kinds: ['lb', 'server', 'db'],
              maxErrorRate: 0.01,
              load: 2000,
            }),
          },
          { id: 'budget', goal: Goal.MaxCost({ max: budget }) },
        ],
        solution: [
          addNode('cdn-1', 'cdn', 270, 280, { locked: false }),
          addNode('lb-1', 'lb', 440, 200, { locked: false }),
          addNode('lb-2', 'lb', 440, 360, { locked: false }),
          addNode('app1', 'server', 610, 120, { locked: false }),
          addNode('app2', 'server', 610, 280, { locked: false }),
          addNode('app3', 'server', 610, 440, { locked: false }),
          addNode('replica-1', 'replica', 790, 360, { locked: false }),
          connect('users', 'cdn-1'),
          connect('cdn-1', 'lb-1'),
          connect('cdn-1', 'lb-2'),
          connect('lb-1', 'app1'),
          connect('lb-1', 'app2'),
          connect('lb-1', 'app3'),
          connect('lb-2', 'app1'),
          connect('lb-2', 'app2'),
          connect('lb-2', 'app3'),
          connect('app1', 'db'),
          connect('app2', 'db'),
          connect('app3', 'db'),
          connect('app1', 'replica-1'),
          connect('app2', 'replica-1'),
          connect('app3', 'replica-1'),
        ],
      },
    },
    {
      id: 'review',
      ops: [],
      stage: [
        annotate('users', 'userView', sim =>
          sim.errorRate > 0.01 ? 'bad' : 'ok',
        ),
        annotate('db', 'dbLoad', 'info'),
      ],
    },
    {
      id: 'next',
      ops: [],
      stage: [],
    },
  ],
})
