import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'nat',
  module: 'internet',
  order: 9,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['board.natTable', 'router.addresses', 'router.ports'],
})
