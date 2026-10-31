import { defineCourse } from '../model'
import { SecurityFeature } from './features'

// Курс «Кибербезопасность для офиса» (план docs/plans/security-course.md,
// OpenSpec add-security-course): уроки-слайды на виде доски «сценарий».

export default defineCourse({
  id: 'security',
  order: 4,
  board: 'scenario',
  modules: ['access', 'people', 'tools', 'finale'],
  features: SecurityFeature.literals,
  locales: ['uk', 'ru', 'en', 'lt'],
})
