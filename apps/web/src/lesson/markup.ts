import { Array, String, pipe } from 'effect'

export type Inline =
  | Readonly<{ _tag: 'Text'; text: string }>
  | Readonly<{ _tag: 'Strong'; text: string }>
  | Readonly<{ _tag: 'Ref'; id: string; text: string }>

export type Paragraph = ReadonlyArray<Inline>

const TOKEN = /\*\*([^*]+)\*\*|\[\[([A-Za-z0-9_.:-]+)\|([^\]]+)\]\]/g

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

const paragraphsOf = (source: string): ReadonlyArray<string> =>
  pipe(
    source,
    String.split(/\n\s*\n/),
    Array.map(String.trim),
    Array.filter(String.isNonEmpty),
  )

const joinLines = (text: string): string => text.replace(/\s*\n\s*/g, ' ')

export const parseProse = (source: string): ReadonlyArray<Paragraph> =>
  Array.map(paragraphsOf(source), paragraph =>
    parseInline(joinLines(paragraph)),
  )

/** Блок текста шага: абзац или маркированный список (строки с `- `). */
export type Block =
  | Readonly<{ _tag: 'Paragraph'; inlines: Paragraph }>
  | Readonly<{ _tag: 'List'; items: ReadonlyArray<Paragraph> }>

const BULLET = /^\s*-\s+/

type Grouped = Readonly<{
  lead: ReadonlyArray<string>
  items: ReadonlyArray<string>
}>

// Строки до первого `- ` — абзац перед списком. Строка без `- ` после пункта
// продолжает этот пункт.
const groupLines = (paragraph: string): Grouped =>
  Array.reduce(
    paragraph.split('\n'),
    { lead: Array.empty<string>(), items: Array.empty<string>() },
    (grouped, line): Grouped =>
      BULLET.test(line)
        ? { ...grouped, items: [...grouped.items, line.replace(BULLET, '')] }
        : Array.match(grouped.items, {
            onEmpty: () => ({ ...grouped, lead: [...grouped.lead, line] }),
            onNonEmpty: items => ({
              ...grouped,
              items: [
                ...Array.dropRight(items, 1),
                `${Array.lastNonEmpty(items)}\n${line}`,
              ],
            }),
          }),
  )

const blocksOf = (paragraph: string): ReadonlyArray<Block> => {
  const { lead, items } = groupLines(paragraph)
  const leadText = String.trim(lead.join('\n'))
  const leadBlocks: ReadonlyArray<Block> = String.isNonEmpty(leadText)
    ? [{ _tag: 'Paragraph', inlines: parseInline(joinLines(leadText)) }]
    : []
  const listBlocks: ReadonlyArray<Block> = Array.isReadonlyArrayNonEmpty(items)
    ? [
        {
          _tag: 'List',
          items: Array.map(items, item =>
            parseInline(joinLines(String.trim(item))),
          ),
        },
      ]
    : []
  return [...leadBlocks, ...listBlocks]
}

/** Текст шага по блокам: абзацы и списки. */
export const parseBlocks = (source: string): ReadonlyArray<Block> =>
  Array.flatMap(paragraphsOf(source), blocksOf)

const inlinesOf = (block: Block): ReadonlyArray<Inline> =>
  block._tag === 'Paragraph' ? block.inlines : Array.flatten(block.items)

export const referencedIds = (source: string): ReadonlyArray<string> =>
  Array.flatMap(parseBlocks(source), block =>
    Array.flatMap(inlinesOf(block), inline =>
      inline._tag === 'Ref' ? [inline.id] : [],
    ),
  )
