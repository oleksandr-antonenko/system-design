import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'social-engineering',
  module: 'people',
  order: 7,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['chat.messenger', 'chat.directory'],
})
