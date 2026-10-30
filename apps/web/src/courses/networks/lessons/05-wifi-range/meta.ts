import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'wifi-range',
  module: 'local',
  order: 5,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['board.floorPlan', 'board.wifiRange', 'router.wifi'],
})
