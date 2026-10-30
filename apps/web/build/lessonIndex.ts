import { readFileSync } from 'node:fs'
import { type Plugin, parseAst } from 'vite'

// Lessons load one by one, when opened. The course maps still need every
// lesson's title and summary, and the board's “later in the course” palette
// needs every lesson's task palettes. This plugin reads them from the source
// files without running them, so the main bundle carries only these few
// strings:
//
//   text.uk.ts?lesson-summary  →  export default { title, summary }
//   lesson.ts?lesson-palette   →  export default { palette: ['lb', …],
//                                                  introduces: ['cdn', …] }
//
// Titles, summaries and palettes are therefore written as literals; anything
// else stops the build with the file named.

export const SUMMARY_QUERY = '?lesson-summary'
export const PALETTE_QUERY = '?lesson-palette'

type Node = Readonly<Record<string, unknown>> & { readonly type: string }

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  typeof value.type === 'string'

const childNodes = (node: Node): ReadonlyArray<Node> =>
  Object.values(node).flatMap(value =>
    Array.isArray(value) ? value.filter(isNode) : isNode(value) ? [value] : [],
  )

const walk = (node: Node, visit: (node: Node) => void): void => {
  visit(node)
  for (const child of childNodes(node)) {
    walk(child, visit)
  }
}

/** A string literal or a template literal without expressions. */
const stringOf = (node: unknown): string | undefined => {
  if (!isNode(node)) {
    return undefined
  }
  if (node.type === 'Literal' && typeof node['value'] === 'string') {
    return node['value']
  }
  if (node.type === 'TemplateLiteral') {
    const expressions = node['expressions']
    const quasis = node['quasis']
    if (
      Array.isArray(expressions) &&
      expressions.length === 0 &&
      Array.isArray(quasis) &&
      quasis.length === 1
    ) {
      const [quasi] = quasis
      const value = isNode(quasi) ? quasi['value'] : undefined
      if (
        typeof value === 'object' &&
        value !== null &&
        'cooked' in value &&
        typeof value.cooked === 'string'
      ) {
        return value.cooked
      }
    }
  }
  return undefined
}

const keyName = (property: Node): string | undefined => {
  const key = property['key']
  if (!isNode(key)) {
    return undefined
  }
  if (key.type === 'Identifier' && typeof key['name'] === 'string') {
    return key['name']
  }
  return stringOf(key)
}

const unwrap = (node: unknown): unknown =>
  isNode(node) &&
  (node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'ParenthesizedExpression')
    ? unwrap(node['expression'])
    : node

const parse = (file: string): Node => {
  const program: unknown = parseAst(readFileSync(file, 'utf8'), {
    lang: 'ts',
    sourceType: 'module',
  })
  if (!isNode(program)) {
    throw new Error(`${file}: cannot be parsed`)
  }
  return program
}

/** `title` and `summary` of a lesson's `text.<locale>.ts`. */
export const readSummary = (
  file: string,
): Readonly<{
  title: string
  summary: string
  preview: Readonly<{ alt: string }>
}> => {
  const program = parse(file)
  const body = program['body']
  const exported = Array.isArray(body)
    ? body.find(
        (statement): statement is Node =>
          isNode(statement) && statement.type === 'ExportDefaultDeclaration',
      )
    : undefined
  const object = unwrap(exported?.['declaration'])
  const properties =
    isNode(object) && object.type === 'ObjectExpression'
      ? object['properties']
      : undefined
  if (!Array.isArray(properties)) {
    throw new Error(`${file}: the default export must be an object literal`)
  }
  const valueIn = (within: ReadonlyArray<unknown>, name: string): unknown =>
    within.find(
      (candidate): candidate is Node =>
        isNode(candidate) &&
        candidate.type === 'Property' &&
        keyName(candidate) === name,
    )?.['value']
  const literal = (value: unknown, name: string): string => {
    const text = stringOf(value)
    if (text === undefined) {
      throw new Error(
        `${file}: \`${name}\` must be a string literal (it is shown on the course map before the lesson loads)`,
      )
    }
    return text
  }
  const preview = unwrap(valueIn(properties, 'preview'))
  const previewProperties =
    isNode(preview) && preview.type === 'ObjectExpression'
      ? preview['properties']
      : undefined
  return {
    title: literal(valueIn(properties, 'title'), 'title'),
    summary: literal(valueIn(properties, 'summary'), 'summary'),
    preview: {
      alt: literal(
        Array.isArray(previewProperties)
          ? valueIn(previewProperties, 'alt')
          : undefined,
        'preview.alt',
      ),
    },
  }
}

/** Every block or device a lesson's tasks offer (`palette`), or that it
    introduces (`introduces`), in order, without repeats. */
export const readPalette = (
  file: string,
  key: 'palette' | 'introduces' = 'palette',
): ReadonlyArray<string> => {
  const found: Array<string> = []
  walk(parse(file), node => {
    if (node.type !== 'Property' || keyName(node) !== key) {
      return
    }
    const value = unwrap(node['value'])
    const elements =
      isNode(value) && value.type === 'ArrayExpression'
        ? value['elements']
        : undefined
    const items = Array.isArray(elements) ? elements.map(stringOf) : undefined
    if (items === undefined || items.some(item => item === undefined)) {
      throw new Error(`${file}: \`${key}\` must be an array of string literals`)
    }
    for (const item of items) {
      if (item !== undefined && !found.includes(item)) {
        found.push(item)
      }
    }
  })
  return found
}

const fileOf = (id: string, query: string) =>
  id.endsWith(query) ? id.slice(0, -query.length) : undefined

export const lessonIndex = (): Plugin => ({
  name: 'lesson-index',
  enforce: 'pre',
  load(id) {
    const summaryFile = fileOf(id, SUMMARY_QUERY)
    if (summaryFile !== undefined) {
      this.addWatchFile(summaryFile)
      return `export default ${JSON.stringify(readSummary(summaryFile))}`
    }
    const paletteFile = fileOf(id, PALETTE_QUERY)
    if (paletteFile !== undefined) {
      this.addWatchFile(paletteFile)
      return `export default ${JSON.stringify({
        palette: readPalette(paletteFile),
        introduces: readPalette(paletteFile, 'introduces'),
      })}`
    }
    return undefined
  },
})
