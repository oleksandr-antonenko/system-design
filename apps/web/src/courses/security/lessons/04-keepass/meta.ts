import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'keepass',
  module: 'access',
  order: 4,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['keepass.base'],
})
