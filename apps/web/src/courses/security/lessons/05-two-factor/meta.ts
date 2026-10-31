import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'two-factor',
  module: 'access',
  order: 5,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['auth.authenticator'],
})
