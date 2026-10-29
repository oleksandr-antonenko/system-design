import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'under-the-hood',
  module: 'local',
  order: 7,
  available: false,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: [
    'board.envelopeLayers',
    'board.legend',
    'board.switch',
    'transport.back',
    'transport.restart',
    'transport.slow',
    'router.devices',
    'terminal.arp',
  ],
})
