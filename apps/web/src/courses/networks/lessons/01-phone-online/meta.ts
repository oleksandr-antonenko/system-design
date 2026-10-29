import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'phone-online',
  module: 'local',
  order: 1,
  available: false,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: [
    'transport.run',
    'board.devices',
    'board.envelope',
    'board.routerSticker',
    'quiz.pickDevice',
    'wifi.join',
    'browser.page',
  ],
})
