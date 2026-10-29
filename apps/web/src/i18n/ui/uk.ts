import { formatNumber } from '../format'
import { plural } from '../plural'
import type { UiStrings } from './types'

const inLanguage: UiStrings['inLanguage'] = {
  uk: 'українською',
  ru: 'російською',
  en: 'англійською',
  lt: 'литовською',
}

export const uk = {
  courseTitle: 'System Design',
  courseTagline:
    'Інтерактивний курс: теорія на живій схемі та задачі власноруч',
  documentTitle: pageTitle => `${pageTitle} · System Design`,
  languageSwitcherLabel: 'Мова',
  inLanguage,
  home: {
    heading: 'Програма курсу',
    lessonCount: count =>
      `${formatNumber('uk', count)} ${plural('uk', count, {
        one: 'урок',
        few: 'уроки',
        many: 'уроків',
        other: 'уроку',
      })}`,
    lessonNumber: order => `Урок ${formatNumber('uk', order)}`,
    comingSoon: 'Скоро',
    moduleTitle: {
      foundations: 'Основи',
      scaling: 'Масштабування',
      distributed: 'Надійність і розподіленість',
    },
  },
  lesson: {
    backToCourse: 'До програми курсу',
    theoryRegion: 'Теорія',
    boardRegion: 'Дошка',
    instrumentsRegion: 'Прилади',
    theoryPlaceholder: 'Урок ще готується. Тут з’являться кроки теорії.',
    boardPlaceholder: 'Тут буде дошка зі схемою системи.',
    instrumentsPlaceholder:
      'Тут будуть навантаження, помилки та час відповіді.',
  },
  notFound: {
    title: 'Сторінку не знайдено',
    body: path => `За адресою «${path}» нічого немає.`,
    backHome: 'До програми курсу',
  },
  domain: {
    UnknownLesson: ({ slug }) => `Уроку «${slug}» немає в курсі.`,
    LessonNotTranslated: ({ shownIn }) =>
      `Цей урок ще не перекладено українською, тому показуємо його ${inLanguage[shownIn]}.`,
  },
} satisfies UiStrings
