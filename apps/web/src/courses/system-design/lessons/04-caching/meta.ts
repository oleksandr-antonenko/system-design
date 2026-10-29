import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'caching',
  module: 'foundations',
  order: 4,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
