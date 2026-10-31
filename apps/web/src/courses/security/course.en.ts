import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'Cybersecurity for the office',
  tagline:
    'Short cartoons and familiar screens: Wi-Fi, passwords, bait emails and AI without leaks',
  modules: {
    access: 'Network and passwords',
    people: 'People and emails',
    tools: 'Programs, browser and AI',
    finale: 'Finale',
  },
} satisfies CourseText<typeof course>
