import { Array, String, pipe } from 'effect'

export type Inline =
  | Readonly<{ _tag: 'Text'; text: string }>
  | Readonly<{ _tag: 'Strong'; text: string }>
  | Readonly<{ _tag: 'Ref'; id: string; text: string }>

export type Paragraph = ReadonlyArray<Inline>

const TOKEN = /\*\*([^*]+)\*\*|\[\[([A-Za-z0-9_-]+)\|([^\]]+)\]\]/g

const parseInline = (source: string): Paragraph => {
  const matches = [...source.matchAll(TOKEN)]
  const pieces = Array.reduce(
    matches,
    { inlines: Array.empty<Inline>(), position: 0 },
    (state, match) => {
      const start = match.index ?? 0
      const before = source.slice(state.position, start)
      const token: Inline =
        match[1] !== undefined
          ? { _tag: 'Strong', text: match[1] }
          : { _tag: 'Ref', id: match[2] ?? '', text: match[3] ?? '' }
      return {
        inlines: [
          ...state.inlines,
          ...(before === '' ? [] : [{ _tag: 'Text' as const, text: before }]),
          token,
        ],
        position: start + match[0].length,
      }
    },
  )
  const rest = source.slice(pieces.position)
  return rest === ''
    ? pieces.inlines
    : [...pieces.inlines, { _tag: 'Text', text: rest }]
}

export const parseProse = (source: string): ReadonlyArray<Paragraph> =>
  pipe(
    source,
    String.split(/\n\s*\n/),
    Array.map(String.trim),
    Array.filter(String.isNonEmpty),
    Array.map(paragraph => parseInline(paragraph.replace(/\s*\n\s*/g, ' '))),
  )

export const referencedIds = (source: string): ReadonlyArray<string> =>
  Array.flatMap(parseProse(source), paragraph =>
    Array.flatMap(paragraph, inline =>
      inline._tag === 'Ref' ? [inline.id] : [],
    ),
  )
