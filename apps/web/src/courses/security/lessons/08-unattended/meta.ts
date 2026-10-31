import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'unattended',
  module: 'people',
  order: 8,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['desk.items'],
})
