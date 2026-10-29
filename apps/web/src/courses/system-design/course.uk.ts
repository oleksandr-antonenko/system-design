import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'System Design',
  tagline:
    'Балансувальники, кеші, черги й регіони: зберіть систему, яка витримає навантаження',
  modules: {
    foundations: 'Основи',
    scaling: 'Масштабування',
    distributed: 'Надійність і розподіленість',
  },
} satisfies CourseText<typeof course>
