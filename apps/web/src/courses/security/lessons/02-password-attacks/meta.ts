import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'password-attacks',
  module: 'access',
  order: 2,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['passwords.check'],
})
