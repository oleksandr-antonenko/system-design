import type { ModuleId } from '../../lessons/model'
import type { DomainMessageTexts } from '../domainMessage'
import type { Locale } from '../locale'

export type UiStrings = Readonly<{
  courseTitle: string
  courseTagline: string
  documentTitle: (pageTitle: string) => string
  languageSwitcherLabel: string
  inLanguage: Readonly<Record<Locale, string>>
  home: Readonly<{
    heading: string
    lessonCount: (count: number) => string
    lessonNumber: (order: number) => string
    comingSoon: string
    moduleTitle: Readonly<Record<ModuleId, string>>
  }>
  lesson: Readonly<{
    backToCourse: string
    theoryRegion: string
    boardRegion: string
    instrumentsRegion: string
    theoryPlaceholder: string
    boardPlaceholder: string
    instrumentsPlaceholder: string
  }>
  notFound: Readonly<{
    title: string
    body: (path: string) => string
    backHome: string
  }>
  domain: DomainMessageTexts
}>
