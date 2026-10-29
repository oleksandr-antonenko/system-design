import { formatNumber } from '../format'
import { plural } from '../plural'
import type { UiStrings } from './types'

const inLanguage: UiStrings['inLanguage'] = {
  uk: 'на украинском',
  ru: 'на русском',
  en: 'на английском',
  lt: 'на литовском',
}

export const ru = {
  courseTitle: 'System Design',
  courseTagline: 'Интерактивный курс: теория на живой схеме и задачи своими руками',
  documentTitle: pageTitle => `${pageTitle} · System Design`,
  languageSwitcherLabel: 'Язык',
  inLanguage,
  home: {
    heading: 'Программа курса',
    lessonCount: count =>
      `${formatNumber('ru', count)} ${plural('ru', count, {
        one: 'урок',
        few: 'урока',
        many: 'уроков',
        other: 'урока',
      })}`,
    lessonNumber: order => `Урок ${formatNumber('ru', order)}`,
    comingSoon: 'Скоро',
    moduleTitle: {
      foundations: 'Основы',
      scaling: 'Масштабирование',
      distributed: 'Надёжность и распределённость',
    },
  },
  lesson: {
    backToCourse: 'К программе курса',
    theoryRegion: 'Теория',
    boardRegion: 'Доска',
    instrumentsRegion: 'Приборы',
    theoryPlaceholder: 'Урок ещё готовится. Здесь появятся шаги теории.',
    boardPlaceholder: 'Здесь будет доска со схемой системы.',
    instrumentsPlaceholder: 'Здесь будут нагрузка, ошибки и время ответа.',
  },
  notFound: {
    title: 'Страница не найдена',
    body: path => `По адресу «${path}» ничего нет.`,
    backHome: 'К программе курса',
  },
  domain: {
    UnknownLesson: ({ slug }) => `Урока «${slug}» нет в курсе.`,
    LessonNotTranslated: ({ shownIn }) =>
      `Этот урок ещё не переведён на русский, поэтому показываем его ${inLanguage[shownIn]}.`,
  },
} satisfies UiStrings
