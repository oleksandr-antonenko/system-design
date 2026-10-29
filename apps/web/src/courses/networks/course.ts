import { defineCourse } from '../model'
import { UiFeature } from './features'

export default defineCourse({
  id: 'networks',
  order: 2,
  board: 'packet',
  modules: ['local', 'internet', 'developer'],
  features: UiFeature.literals,
  locales: ['uk', 'ru', 'en', 'lt'],
})
