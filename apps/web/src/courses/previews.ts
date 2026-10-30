import { Option, Record } from 'effect'

import type { Lesson } from './assemble'

// Картинка урока лежит в его папке (docs/plans/lesson-previews.md):
// `preview.webp` 1200 × 630 — над заголовком урока и в og:image,
// `preview-600.webp` 600 × 315 — на карте курса.

export const PREVIEW_WIDTH = 1200
export const PREVIEW_HEIGHT = 630
export const PREVIEW_SMALL_WIDTH = 600
export const PREVIEW_SMALL_HEIGHT = 315

export type LessonPreview = Readonly<{
  /** Адрес `preview.webp`. */
  src: string
  /** Адрес `preview-600.webp`. */
  small: string
}>

const images = import.meta.glob<string>('./*/lessons/*/preview*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const previewFolder = (lesson: Lesson): string =>
  `./${lesson.course}/lessons/${lesson.folder}`

export const previewOf = (lesson: Lesson): Option.Option<LessonPreview> =>
  Option.all({
    src: Record.get(images, `${previewFolder(lesson)}/preview.webp`),
    small: Record.get(images, `${previewFolder(lesson)}/preview-600.webp`),
  })

/** `srcset` обеих версий: браузер берёт 600 px, пока её хватает. */
export const previewSrcset = (preview: LessonPreview): string =>
  `${preview.small} ${PREVIEW_SMALL_WIDTH}w, ${preview.src} ${PREVIEW_WIDTH}w`
