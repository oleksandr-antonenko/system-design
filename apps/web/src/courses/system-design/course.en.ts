import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'System Design',
  tagline:
    'Load balancers, caches, queues and regions: build a system that holds the load',
  modules: {
    foundations: 'Foundations',
    scaling: 'Scaling',
    distributed: 'Reliability and distribution',
    hard: 'Hard tasks',
  },
} satisfies CourseText<typeof course>
