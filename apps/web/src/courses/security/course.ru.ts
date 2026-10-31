import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'Кибербезопасность для офиса',
  tagline:
    'Короткие мультики и знакомые экраны: Wi-Fi, пароли, письма-приманки и ИИ без утечек',
  modules: {
    access: 'Сеть и пароли',
    people: 'Люди и письма',
    tools: 'Программы, браузер и ИИ',
    finale: 'Финал',
  },
} satisfies CourseText<typeof course>
