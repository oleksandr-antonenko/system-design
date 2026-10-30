import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'routing',
  module: 'internet',
  order: 8,
  available: false,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['board.routes', 'terminal.traceroute'],
})
