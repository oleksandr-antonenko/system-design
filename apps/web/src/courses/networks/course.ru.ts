import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'Сети для вайбкодеров',
  tagline:
    'Сети с нуля на живой схеме: от домашнего Wi-Fi до своего сайта в интернете',
  modules: {
    local: 'Как устроена домашняя сеть',
    internet: 'Интернет',
    developer: 'Сеть разработчика',
  },
} satisfies CourseText<typeof course>
