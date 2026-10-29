import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'ports-and-localhost',
  module: 'local',
  order: 6,
  available: false,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: [
    'board.ports',
    'terminal.npmRunDev',
    'terminal.ipAddr',
    'browser.typeAddress',
    'browser.errConnectionRefused',
  ],
})
