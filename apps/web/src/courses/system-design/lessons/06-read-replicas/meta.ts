import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'read-replicas',
  module: 'scaling',
  order: 6,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
