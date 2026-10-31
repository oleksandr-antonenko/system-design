import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'Кібербезпека для офісу',
  tagline:
    'Короткі мультики й знайомі екрани: Wi-Fi, паролі, листи-приманки та ШІ без витоків',
  modules: {
    access: 'Мережа й паролі',
    people: 'Люди й листи',
    tools: 'Програми, браузер і ШІ',
    finale: 'Фінал',
  },
} satisfies CourseText<typeof course>
