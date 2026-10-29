import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'url-shortener',
  module: 'distributed',
  order: 13,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
})
