import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'rate-limiting',
  module: 'scaling',
  order: 8,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
