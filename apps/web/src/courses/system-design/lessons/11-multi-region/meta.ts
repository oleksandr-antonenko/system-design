import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'multi-region',
  module: 'distributed',
  order: 11,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
