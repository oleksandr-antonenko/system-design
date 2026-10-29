import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'fault-tolerance',
  module: 'distributed',
  order: 10,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
