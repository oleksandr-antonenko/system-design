import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'shared-room',
  module: 'access',
  order: 1,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['phone.wifi', 'phone.vpn', 'phone.mail', 'quiz.choice'],
})
