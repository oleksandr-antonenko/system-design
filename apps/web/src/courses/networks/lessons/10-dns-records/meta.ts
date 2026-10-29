import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'dns-records',
  module: 'internet',
  order: 10,
  available: false,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: [
    'board.resolverCache',
    'dnsPanel.records',
    'terminal.nslookup',
    'terminal.dig',
  ],
})
