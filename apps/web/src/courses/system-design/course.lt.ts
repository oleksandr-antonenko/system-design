import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'System Design',
  tagline:
    'Balansuotuvai, podėliai, eilės ir regionai: sukurkite sistemą, kuri atlaiko apkrovą',
  modules: {
    foundations: 'Pagrindai',
    scaling: 'Mastelio didinimas',
    distributed: 'Patikimumas ir paskirstytos sistemos',
  },
} satisfies CourseText<typeof course>
