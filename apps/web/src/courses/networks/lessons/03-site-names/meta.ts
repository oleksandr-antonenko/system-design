import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'site-names',
  module: 'local',
  order: 3,
  available: false,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: [
    'board.dnsServer',
    'browser.addressBar',
    'browser.errNameNotResolved',
    'wifi.networkInfo',
  ],
})
