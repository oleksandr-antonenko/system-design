import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'queues',
  module: 'scaling',
  order: 7,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
