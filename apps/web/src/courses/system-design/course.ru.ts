import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'System Design',
  tagline:
    'Load balancers, caches, queues и регионы: соберите систему, которая выдержит нагрузку',
  modules: {
    foundations: 'Основы',
    scaling: 'Масштабирование',
    distributed: 'Надёжность и распределённость',
    hard: 'Advanced System Design',
  },
} satisfies CourseText<typeof course>
