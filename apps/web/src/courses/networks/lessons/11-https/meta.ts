import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'https',
  module: 'internet',
  order: 11,
  available: false,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: [
    'board.sealedEnvelope',
    'terminal.curl',
    'browser.certificate',
    'browser.errCert',
    'browser.form',
    'server.site',
    'server.cert',
  ],
})
