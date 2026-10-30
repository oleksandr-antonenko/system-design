import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'addresses',
  module: 'local',
  order: 2,
  available: false,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: [
    'board.addresses',
    'board.deviceCard',
    'board.cable',
    'board.sendTo',
  ],
})
