import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'browser-extensions',
  module: 'tools',
  order: 10,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['extensions.permissions'],
})
