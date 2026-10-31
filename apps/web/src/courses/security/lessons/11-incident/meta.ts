import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'incident',
  module: 'finale',
  order: 11,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['mail.report', 'mail.sessions'],
})
