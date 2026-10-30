import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'System Design',
  tagline:
    'Load balancers, caches, queues і регіони: зберіть систему, яка витримає навантаження',
  modules: {
    foundations: 'Основи',
    scaling: 'Масштабування',
    distributed: 'Надійність і розподіленість',
    hard: 'Складні задачі',
  },
} satisfies CourseText<typeof course>
