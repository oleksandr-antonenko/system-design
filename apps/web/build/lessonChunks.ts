import type { Plugin, Rolldown } from 'vite'

// Every lesson's script and texts become one file of the build,
// `assets/lessons/<course>-<NN-slug>-<hash>.js`, loaded when the lesson is
// opened (see `src/courses/registry.ts`). `meta.ts` and the course files stay
// in the main bundle, so the course maps can show every lesson.

const LESSON_MODULE = /\/src\/courses\/([^/]+)\/lessons\/([^/]+)\/([^/?]+)\.ts$/

export type LessonModule = Readonly<{
  course: string
  folder: string
  file: string
}>

/** A module of a lesson folder that loads with the lesson (not `meta.ts`,
    not a test, not a `?query` view of a file). */
export const lessonModuleOf = (moduleId: string): LessonModule | undefined => {
  const match = LESSON_MODULE.exec(moduleId)
  if (match === null) {
    return undefined
  }
  const [, course = '', folder = '', file = ''] = match
  return file === 'meta' || file.endsWith('.test')
    ? undefined
    : { course, folder, file }
}

/** The chunk name of a lesson; a build extension may give some lessons
    another folder. */
export type LessonChunkNamer = (
  course: string,
  folder: string,
) => string | undefined

export const lessonChunkName =
  (namers: ReadonlyArray<LessonChunkNamer>) =>
  (moduleId: string): string | null => {
    const lesson = lessonModuleOf(moduleId)
    if (lesson === undefined) {
      return null
    }
    for (const namer of namers) {
      const name = namer(lesson.course, lesson.folder)
      if (name !== undefined) {
        return name
      }
    }
    return `lessons/${lesson.course}-${lesson.folder}`
  }

/** The chunk and every chunk it imports statically. */
export const staticClosure = (
  chunks: ReadonlyArray<Rolldown.OutputChunk>,
  entry: Rolldown.OutputChunk,
): ReadonlyArray<Rolldown.OutputChunk> => {
  const byFile = new Map(chunks.map(chunk => [chunk.fileName, chunk]))
  const visit = (
    pending: ReadonlyArray<string>,
    seen: ReadonlyMap<string, Rolldown.OutputChunk>,
  ): ReadonlyMap<string, Rolldown.OutputChunk> => {
    const [next, ...rest] = pending
    if (next === undefined) {
      return seen
    }
    const chunk = byFile.get(next)
    if (chunk === undefined || seen.has(next)) {
      return visit(rest, seen)
    }
    return visit([...rest, ...chunk.imports], new Map([...seen, [next, chunk]]))
  }
  return [...visit([entry.fileName], new Map()).values()]
}

const lessonOf = (module: LessonModule) => `${module.course}/${module.folder}`

const lessonsIn = (chunk: Rolldown.OutputChunk): ReadonlyArray<string> => [
  ...new Set(
    chunk.moduleIds.flatMap(id => {
      const lesson = lessonModuleOf(id)
      return lesson === undefined ? [] : [lessonOf(lesson)]
    }),
  ),
]

/** Problems with how lessons were split into files; empty when all is well. */
export const lessonChunkProblems = (
  chunks: ReadonlyArray<Rolldown.OutputChunk>,
): ReadonlyArray<string> => {
  const lessonChunks = chunks.filter(chunk => lessonsIn(chunk).length > 0)
  const lessonFiles = new Set(lessonChunks.map(chunk => chunk.fileName))

  const mixed = lessonChunks.flatMap(chunk => {
    const lessons = lessonsIn(chunk)
    const strangers = chunk.moduleIds.filter(
      id => lessonModuleOf(id) === undefined,
    )
    return [
      ...(lessons.length > 1
        ? [`${chunk.fileName} holds several lessons: ${lessons.join(', ')}`]
        : []),
      ...(strangers.length > 0
        ? [
            `${chunk.fileName} (${lessons.join(', ')}) also holds app code: ${strangers.join(', ')}`,
          ]
        : []),
    ]
  })

  const crossImports = lessonChunks.flatMap(chunk =>
    [...chunk.imports, ...chunk.dynamicImports]
      .filter(file => lessonFiles.has(file))
      .map(file => `${chunk.fileName} imports another lesson's file ${file}`),
  )

  const eager = chunks
    .filter(chunk => chunk.isEntry)
    .flatMap(entry =>
      staticClosure(chunks, entry)
        .filter(chunk => lessonFiles.has(chunk.fileName))
        .map(
          chunk =>
            `${entry.fileName} loads the lesson file ${chunk.fileName} at start`,
        ),
    )

  return [...mixed, ...crossImports, ...eager]
}

/** Fails the build when a lesson is not alone in its own lazily loaded file. */
export const lessonChunkCheck = (): Plugin => ({
  name: 'lesson-chunk-check',
  apply: 'build',
  generateBundle(_options, bundle) {
    const problems = lessonChunkProblems(
      Object.values(bundle).filter(
        (output): output is Rolldown.OutputChunk => output.type === 'chunk',
      ),
    )
    if (problems.length > 0) {
      this.error(
        `Lessons must load as their own files:\n${problems.join('\n')}`,
      )
    }
  },
})
