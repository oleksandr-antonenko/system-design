import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'cdn',
  module: 'scaling',
  order: 5,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
