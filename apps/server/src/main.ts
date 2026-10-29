import { Cause, Effect, Exit, Layer, Runtime } from 'effect'
import { HttpRouter } from 'effect/http'
import { createServer } from 'node:http'

import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'

import { makeAppLayer } from './app.ts'
import { loadServerConfig } from './config.ts'

const GRACEFUL_SHUTDOWN = '10 seconds'

const ServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* loadServerConfig

    return HttpRouter.serve(makeAppLayer(config), { disableLogger: true }).pipe(
      Layer.provide(
        NodeHttpServer.layer(createServer, {
          port: config.port,
          host: config.host,
          gracefulShutdownTimeout: GRACEFUL_SHUTDOWN,
        }),
      ),
    )
  }),
)

const stopCleanlyOnSignal: Runtime.Teardown = (exit, onExit) => {
  if (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)) {
    onExit(0)
    return
  }
  Runtime.defaultTeardown(exit, onExit)
}

NodeRuntime.runMain(Layer.launch(ServerLive), { teardown: stopCleanlyOnSignal })
