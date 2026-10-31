import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'office-day',
  module: 'finale',
  order: 12,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
