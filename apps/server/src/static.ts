import { Effect, FileSystem, Path } from 'effect'
import { HttpServerRequest, HttpServerResponse } from 'effect/http'

export const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable'
export const CACHE_NONE = 'no-cache'
const CACHE_SHORT = 'public, max-age=3600'

const cacheControlFor = (pathname: string): string => {
  if (pathname.startsWith('/assets/')) {
    return CACHE_IMMUTABLE
  }
  if (pathname.endsWith('.html')) {
    return CACHE_NONE
  }
  return CACHE_SHORT
}

const decodePathname = (rawUrl: string) =>
  Effect.try({
    try: () => decodeURIComponent(new URL(rawUrl, 'http://local').pathname),
    catch: () => 'MalformedUrl' as const,
  })

const isRegularFile = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return yield* fs.stat(filePath).pipe(
      Effect.map(info => info.type === 'File'),
      Effect.orElseSucceed(() => false),
    )
  })

const fileWithCache = (filePath: string, cacheControl: string) =>
  HttpServerResponse.file(filePath).pipe(
    Effect.map(HttpServerResponse.setHeader('cache-control', cacheControl)),
  )

export const makeStaticHandler =
  (webDist: string) => (request: HttpServerRequest.HttpServerRequest) =>
    Effect.gen(function* () {
      const path = yield* Path.Path
      const root = path.resolve(webDist)
      const maybePathname = yield* decodePathname(request.url).pipe(
        Effect.option,
      )

      if (maybePathname._tag === 'None') {
        return HttpServerResponse.text('Bad request', { status: 400 })
      }
      const pathname = maybePathname.value

      const candidate = path.resolve(root, `.${pathname}`)
      const isInsideRoot = candidate.startsWith(root + path.sep)

      if (isInsideRoot && (yield* isRegularFile(candidate))) {
        return yield* fileWithCache(candidate, cacheControlFor(pathname))
      }

      if (pathname.startsWith('/assets/')) {
        return HttpServerResponse.text('Not found', { status: 404 })
      }

      const indexFile = path.join(root, 'index.html')
      if (!(yield* isRegularFile(indexFile))) {
        return yield* HttpServerResponse.json(
          {
            error: 'web_build_missing',
            hint: 'Run `pnpm build`, or use the Vite dev server in development.',
          },
          { status: 503 },
        )
      }

      return yield* fileWithCache(indexFile, CACHE_NONE)
    })
