import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'System Design',
  tagline:
    'Балансировщики, кеши, очереди и регионы: соберите систему, которая выдержит нагрузку',
  modules: {
    foundations: 'Основы',
    scaling: 'Масштабирование',
    distributed: 'Надёжность и распределённость',
  },
} satisfies CourseText<typeof course>
