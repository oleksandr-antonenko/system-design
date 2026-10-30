import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'System Design',
  tagline:
    'Load balancers, caches, queues ir regionai: sukurkite sistemą, kuri atlaiko apkrovą',
  modules: {
    foundations: 'Pagrindai',
    scaling: 'Mastelio didinimas',
    distributed: 'Patikimumas ir paskirstytos sistemos',
    hard: 'Sudėtingos užduotys',
  },
} satisfies CourseText<typeof course>
