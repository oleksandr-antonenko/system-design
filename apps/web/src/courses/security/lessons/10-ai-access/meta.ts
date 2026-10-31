import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'ai-access',
  module: 'tools',
  order: 10,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['assistant.chat', 'crm.tokens'],
})
