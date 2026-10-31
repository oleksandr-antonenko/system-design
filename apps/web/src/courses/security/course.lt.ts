import type { CourseText } from '../model'
import type course from './course'

export default {
  title: 'Kibernetinis saugumas biure',
  tagline:
    'Trumpi animaciniai filmukai ir pažįstami ekranai: Wi-Fi, slaptažodžiai, laiškai masalai ir DI be nutekėjimų',
  modules: {
    access: 'Tinklas ir slaptažodžiai',
    people: 'Žmonės ir laiškai',
    tools: 'Programos, naršyklė ir DI',
    finale: 'Finalas',
  },
} satisfies CourseText<typeof course>
