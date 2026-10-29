import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'one-server',
  module: 'foundations',
  order: 1,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
