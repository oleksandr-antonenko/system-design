import { defineCourse } from '../model'

export default defineCourse({
  id: 'system-design',
  order: 1,
  board: 'flow',
  modules: ['foundations', 'scaling', 'distributed', 'hard'],
  features: [],
  locales: ['uk', 'ru', 'en', 'lt'],
})
