import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'sharding',
  module: 'scaling',
  order: 9,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
