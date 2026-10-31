import { defineLessonMeta } from '../../../model'
import course from '../../course'

export default defineLessonMeta(course, {
  slug: 'phishing',
  module: 'people',
  order: 5,
  available: true,
  locales: ['uk', 'ru', 'en', 'lt'],
  unlocks: ['mail.inbox', 'mail.linkPreview', 'quiz.pickHotspot'],
})
