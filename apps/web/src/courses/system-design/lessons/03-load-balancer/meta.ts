import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'load-balancer',
  module: 'foundations',
  order: 3,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
