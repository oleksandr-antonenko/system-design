import { Effect, FileSystem, Layer, Option, Path } from 'effect'
import {
  HttpPlatform,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from 'effect/http'

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

const decodePathname = (rawUrl: string): Option.Option<string> =>
  Option.liftThrowable(() =>
    decodeURIComponent(new URL(rawUrl, 'http://local').pathname),
  )()

export const makeStaticRoute = (webDist: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const platform = yield* HttpPlatform.HttpPlatform
      const root = path.resolve(webDist)
      const indexFile = path.join(root, 'index.html')

      const isRegularFile = (filePath: string) =>
        fs.stat(filePath).pipe(
          Effect.map(info => info.type === 'File'),
          Effect.orElseSucceed(() => false),
        )

      const fileWithCache = (filePath: string, cacheControl: string) =>
        platform
          .fileResponse(filePath)
          .pipe(
            Effect.map(
              HttpServerResponse.setHeader('cache-control', cacheControl),
            ),
          )

      const serve = (pathname: string) =>
        Effect.gen(function* () {
          const candidate = path.resolve(root, `.${pathname}`)
          const isInsideRoot = candidate.startsWith(root + path.sep)

          if (isInsideRoot && (yield* isRegularFile(candidate))) {
            return yield* fileWithCache(candidate, cacheControlFor(pathname))
          }
          if (pathname.startsWith('/assets/')) {
            return HttpServerResponse.text('Not found', { status: 404 })
          }
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

      return HttpRouter.add(
        'GET',
        '/*',
        (request: HttpServerRequest.HttpServerRequest) =>
          Option.match(decodePathname(request.url), {
            onNone: () =>
              Effect.succeed(
                HttpServerResponse.text('Bad request', { status: 400 }),
              ),
            onSome: serve,
          }),
      )
    }),
  )
