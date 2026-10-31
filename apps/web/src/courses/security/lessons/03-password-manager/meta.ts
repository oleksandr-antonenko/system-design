import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'password-manager',
  module: 'access',
  order: 3,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['vault.entries'],
})
