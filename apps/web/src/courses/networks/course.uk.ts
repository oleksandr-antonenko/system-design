import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'Мережі для вайбкодерів',
  tagline:
    'Мережі з нуля на живій схемі: від домашнього Wi-Fi до власного сайту в інтернеті',
  modules: {
    local: 'Як влаштована домашня мережа',
    internet: 'Інтернет',
    developer: 'Мережа розробника',
  },
} satisfies CourseText<typeof course>
