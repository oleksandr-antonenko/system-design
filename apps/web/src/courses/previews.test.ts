import { Array, Option, Record, String, pipe } from 'effect'
import { describe, expect, test } from 'vitest'

import {
  PREVIEW_HEIGHT,
  PREVIEW_SMALL_HEIGHT,
  PREVIEW_SMALL_WIDTH,
  PREVIEW_WIDTH,
  previewFolder,
  previewOf,
} from './previews'
import { courses } from './registry'

// Картинка урока и её alt (docs/plans/lesson-previews.md): у каждого урока
// есть обе версии картинки нужного размера, промпт в preview.md и alt на
// каждом языке урока, который описывает картинку через тему урока.

const inlined = import.meta.glob<string>('./*/lessons/*/preview*.webp', {
  eager: true,
  query: '?inline',
  import: 'default',
})

const prompts = import.meta.glob<string>('./*/lessons/*/preview.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const bytesOf = (dataUrl: string): Uint8Array =>
  Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), character =>
    character.charCodeAt(0),
  )

const fourCc = (bytes: Uint8Array, offset: number): string =>
  globalThis.String.fromCharCode(...bytes.slice(offset, offset + 4))

const littleEndian = (bytes: Uint8Array, offset: number, length: number) =>
  Array.reduce(
    Array.range(0, length - 1),
    0,
    (sum, index) => sum + (bytes[offset + index] ?? 0) * 256 ** index,
  )

/** Ширина и высота WebP по заголовку: VP8 (с потерями), VP8L, VP8X. */
const webpSize = (
  bytes: Uint8Array,
): Option.Option<readonly [number, number]> => {
  if (fourCc(bytes, 0) !== 'RIFF' || fourCc(bytes, 8) !== 'WEBP') {
    return Option.none()
  }
  const chunk = fourCc(bytes, 12)
  if (chunk === 'VP8 ') {
    return Option.some([
      littleEndian(bytes, 26, 2) & 0x3fff,
      littleEndian(bytes, 28, 2) & 0x3fff,
    ])
  }
  if (chunk === 'VP8L') {
    const bits = littleEndian(bytes, 21, 4)
    return Option.some([(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1])
  }
  if (chunk === 'VP8X') {
    return Option.some([
      littleEndian(bytes, 24, 3) + 1,
      littleEndian(bytes, 27, 3) + 1,
    ])
  }
  return Option.none()
}

/** Термины урока: английское название в начале заголовка («Ping и hops.
    …»), каждое отдельно, и его главное слово («Separate database» →
    database), в том числе без английского -s («replicas» → replica). */
const keyTermsOf = (title: string): ReadonlyArray<string> =>
  pipe(
    title.split('. ')[0] ?? title,
    head => head.split(/ (?:and|и|і|ir) /),
    Array.flatMap(term => {
      const lastWord = term.split(' ').at(-1) ?? term
      return [term, lastWord, lastWord.replace(/(?<=[a-z]{3})s$/, '')]
    }),
    Array.map(String.toLowerCase),
    Array.dedupe,
  )

const FORBIDDEN_START =
  /^(картинка|изображение|зображення|фото|image|picture|photo|paveikslėlis|vaizdas|nuotrauka)/i

const lessons = Array.flatMap(courses, course =>
  Array.filter(course.lessons, lesson => lesson.meta.available),
)

describe('lesson previews', () => {
  test.each(Array.map(lessons, lesson => [previewFolder(lesson), lesson]))(
    '%s: both images, their sizes and the prompt',
    (folder, lesson) => {
      expect(
        Option.isSome(previewOf(lesson)),
        `${folder}: preview.webp and preview-600.webp`,
      ).toBe(true)

      const sizes = [
        ['preview.webp', PREVIEW_WIDTH, PREVIEW_HEIGHT, 160_000],
        ['preview-600.webp', PREVIEW_SMALL_WIDTH, PREVIEW_SMALL_HEIGHT, 40_000],
      ] as const
      Array.forEach(sizes, ([file, width, height, maxBytes]) => {
        const bytes = bytesOf(
          Record.get(inlined, `${folder}/${file}`).pipe(
            Option.getOrElse(() => ''),
          ),
        )
        expect(webpSize(bytes), `${folder}/${file}`).toEqual(
          Option.some([width, height]),
        )
        expect(
          bytes.length,
          `${folder}/${file} is too heavy`,
        ).toBeLessThanOrEqual(maxBytes)
      })

      const prompt = Option.getOrElse(
        Record.get(prompts, `${folder}/preview.md`),
        () => '',
      )
      expect(
        prompt.replace(/^#.*$|<!--[\s\S]*?-->/gm, '').trim().length,
        `${folder}/preview.md`,
      ).toBeGreaterThan(80)
    },
  )

  test.each(
    Array.flatMap(lessons, lesson =>
      Array.map(lesson.summaries, ({ locale, text }) => [
        `${previewFolder(lesson)} ${locale}`,
        text.title,
        text.preview.alt,
      ]),
    ),
  )('%s: alt text', (where, title, alt) => {
    expect(alt.length, `${where}: 100–160 characters`).toBeGreaterThanOrEqual(
      100,
    )
    expect(alt.length, `${where}: 100–160 characters`).toBeLessThanOrEqual(160)
    expect(alt, `${where}: describe what is shown`).not.toMatch(FORBIDDEN_START)
    expect(
      Array.some(keyTermsOf(title), term => alt.toLowerCase().includes(term)),
      `${where}: the alt names none of ${keyTermsOf(title).join(', ')}`,
    ).toBe(true)
  })

  test('key terms come from the English head of the title', () => {
    expect(keyTermsOf('Ping и hops. Путь конверта')).toEqual([
      'ping',
      'hops',
      'hop',
    ])
    expect(keyTermsOf('Separate database. Data on its own machine')).toEqual([
      'separate database',
      'database',
    ])
  })
})
