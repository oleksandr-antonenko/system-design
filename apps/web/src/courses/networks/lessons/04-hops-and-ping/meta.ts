import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'hops-and-ping',
  module: 'local',
  order: 4,
  available: false,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: [
    'transport.step',
    'transport.hopCounter',
    'board.routerChain',
    'terminal.ping',
    'board.printout',
    'quiz.nextHop',
  ],
})
