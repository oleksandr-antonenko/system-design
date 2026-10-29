import { formatNumber } from '../format'
import { plural } from '../plural'
import type { UiStrings } from './types'

const inLanguage: UiStrings['inLanguage'] = {
  uk: 'ukrainiečių kalba',
  ru: 'rusų kalba',
  en: 'anglų kalba',
  lt: 'lietuvių kalba',
}

export const lt = {
  courseTitle: 'System Design',
  courseTagline:
    'Interaktyvus kursas: teorija gyvoje schemoje ir praktinės užduotys',
  documentTitle: pageTitle => `${pageTitle} · System Design`,
  languageSwitcherLabel: 'Kalba',
  inLanguage,
  home: {
    heading: 'Kurso programa',
    lessonCount: count =>
      `${formatNumber('lt', count)} ${plural('lt', count, {
        one: 'pamoka',
        few: 'pamokos',
        many: 'pamokos',
        other: 'pamokų',
      })}`,
    lessonNumber: order => `${formatNumber('lt', order)} pamoka`,
    comingSoon: 'Netrukus',
    moduleTitle: {
      foundations: 'Pagrindai',
      scaling: 'Mastelio didinimas',
      distributed: 'Patikimumas ir paskirstytos sistemos',
    },
  },
  lesson: {
    backToCourse: 'Atgal į kurso programą',
    theoryRegion: 'Teorija',
    boardRegion: 'Lenta',
    instrumentsRegion: 'Prietaisai',
    theoryPlaceholder: 'Pamoka dar ruošiama. Čia atsiras teorijos žingsniai.',
    boardPlaceholder: 'Čia bus lenta su sistemos schema.',
    instrumentsPlaceholder: 'Čia bus apkrova, klaidos ir atsako laikas.',
  },
  notFound: {
    title: 'Puslapis nerastas',
    body: path => `Adresu „${path}“ nieko nėra.`,
    backHome: 'Atgal į kurso programą',
  },
  domain: {
    UnknownLesson: ({ slug }) => `Kurse nėra pamokos „${slug}“.`,
    LessonNotTranslated: ({ shownIn }) =>
      `Ši pamoka dar neišversta į lietuvių kalbą, todėl rodoma ${inLanguage[shownIn]}.`,
  },
} satisfies UiStrings
