import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'separate-database',
  module: 'foundations',
  order: 2,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
