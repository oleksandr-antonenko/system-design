import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'Tinklai vaibkoderiams',
  tagline:
    'Tinklai nuo nulio gyvoje schemoje: nuo namų Wi-Fi iki savos svetainės internete',
  modules: {
    local: 'Kaip veikia namų tinklas',
    internet: 'Internetas',
    developer: 'Kūrėjo tinklas',
  },
} satisfies CourseText<typeof course>
