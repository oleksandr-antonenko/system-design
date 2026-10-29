import { formatNumber } from '../format'
import { plural } from '../plural'
import type { UiStrings } from './types'

const inLanguage: UiStrings['inLanguage'] = {
  uk: 'in Ukrainian',
  ru: 'in Russian',
  en: 'in English',
  lt: 'in Lithuanian',
}

export const en = {
  courseTitle: 'System Design',
  courseTagline:
    'An interactive course: theory on a live board and hands-on tasks',
  documentTitle: pageTitle => `${pageTitle} · System Design`,
  languageSwitcherLabel: 'Language',
  inLanguage,
  home: {
    heading: 'Course outline',
    lessonCount: count =>
      `${formatNumber('en', count)} ${plural('en', count, {
        one: 'lesson',
        other: 'lessons',
      })}`,
    lessonNumber: order => `Lesson ${formatNumber('en', order)}`,
    comingSoon: 'Coming soon',
    moduleTitle: {
      foundations: 'Foundations',
      scaling: 'Scaling',
      distributed: 'Reliability and distribution',
    },
  },
  lesson: {
    backToCourse: 'Back to the course outline',
    theoryRegion: 'Theory',
    boardRegion: 'Board',
    instrumentsRegion: 'Instruments',
    theoryPlaceholder:
      'This lesson is still in the works. Theory steps will appear here.',
    boardPlaceholder: 'The system diagram board will appear here.',
    instrumentsPlaceholder: 'Load, errors and response time will appear here.',
  },
  notFound: {
    title: 'Page not found',
    body: path => `There is nothing at “${path}”.`,
    backHome: 'Back to the course outline',
  },
  domain: {
    UnknownLesson: ({ slug }) => `There is no lesson “${slug}” in the course.`,
    LessonNotTranslated: ({ shownIn }) =>
      `This lesson hasn’t been translated into English yet, so it is shown ${inLanguage[shownIn]}.`,
  },
} satisfies UiStrings
