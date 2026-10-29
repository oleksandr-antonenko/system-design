import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'Networking for vibe coders',
  tagline:
    'Networking from scratch on a live diagram: from home Wi-Fi to your own site on the internet',
  modules: {
    local: 'How a home network works',
    internet: 'The internet',
    developer: 'The developer’s network',
  },
} satisfies CourseText<typeof course>
