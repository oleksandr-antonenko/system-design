import { Layer } from 'effect'
import { HttpRouter, HttpServerResponse } from 'effect/http'

import type { ServerConfig } from './config.ts'
import { makeStaticHandler } from './static.ts'

const apiNotFound = HttpServerResponse.json(
  { error: 'not_found' },
  { status: 404 },
)

export const makeAppLayer = (config: ServerConfig) =>
  Layer.mergeAll(
    HttpRouter.add(
      'GET',
      '/api/health',
      HttpServerResponse.json({ status: 'ok', version: config.appVersion }),
    ),
    HttpRouter.add('*', '/api/*', apiNotFound),
    HttpRouter.add('GET', '/*', makeStaticHandler(config.webDist)),
  )
