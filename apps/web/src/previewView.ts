import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type LessonPreview,
  PREVIEW_HEIGHT,
  PREVIEW_SMALL_HEIGHT,
  PREVIEW_SMALL_WIDTH,
  PREVIEW_WIDTH,
  previewSrcset,
} from './courses/previews'
import type { Locale } from './i18n/locale'

// Картинка урока: над заголовком урока и на карте курса. Размеры заданы
// атрибутами, поэтому место под картинку занято до её загрузки.

/** Над заголовком урока: видна сразу, грузится первой. */
export const lessonHeroView = <Message>(
  preview: LessonPreview,
  alt: string,
  lang: Locale,
  h: HtmlBuilder<Message>,
): Html =>
  h.img([
    h.Class('lesson-hero'),
    h.Src(preview.src),
    h.Srcset(previewSrcset(preview)),
    h.Sizes('(min-width: 1024px) 38vw, 100vw'),
    h.Width(`${PREVIEW_WIDTH}`),
    h.Height(`${PREVIEW_HEIGHT}`),
    h.Alt(alt),
    h.Lang(lang),
    h.Decoding('async'),
    h.Fetchpriority('high'),
  ])

/** В строке урока на карте курса: грузится, когда до неё долистали. */
export const lessonThumbnailView = <Message>(
  preview: LessonPreview,
  alt: string,
  lang: Locale,
  h: HtmlBuilder<Message>,
): Html =>
  h.img([
    h.Class('lesson-thumb'),
    h.Src(preview.small),
    h.Srcset(previewSrcset(preview)),
    h.Sizes('(min-width: 640px) 200px, calc(100vw - 32px)'),
    h.Width(`${PREVIEW_SMALL_WIDTH}`),
    h.Height(`${PREVIEW_SMALL_HEIGHT}`),
    h.Alt(alt),
    h.Lang(lang),
    h.Loading('lazy'),
    h.Decoding('async'),
  ])
