import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'office-day',
  module: 'finale',
  order: 13,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
