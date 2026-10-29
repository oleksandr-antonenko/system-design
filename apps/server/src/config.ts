import { Config, Effect } from 'effect'
import { fileURLToPath } from 'node:url'

export interface ServerConfig {
  readonly port: number
  readonly host: string
  readonly webDist: string
  readonly appVersion: string
}

export const DEFAULT_PORT = 3620

const defaultWebDist = fileURLToPath(new URL('../../web/dist', import.meta.url))

export const loadServerConfig: Effect.Effect<ServerConfig, Config.ConfigError> =
  Effect.gen(function* () {
    const port = yield* Config.Port('PORT').pipe(
      Config.withDefault(DEFAULT_PORT),
    )
    const host = yield* Config.String('HOST').pipe(
      Config.withDefault('127.0.0.1'),
    )
    const webDist = yield* Config.String('WEB_DIST').pipe(
      Config.withDefault(defaultWebDist),
    )
    const appVersion = yield* Config.String('APP_VERSION').pipe(
      Config.withDefault('dev'),
    )

    return { port, host, webDist, appVersion }
  })
