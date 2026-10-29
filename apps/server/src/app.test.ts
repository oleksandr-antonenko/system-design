import { Layer } from 'effect'
import { HttpRouter } from 'effect/http'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'

import { NodeHttpServer } from '@effect/platform-node'

import { makeAppLayer } from './app.ts'
import type { ServerConfig } from './config.ts'

const makeWebDist = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'sd-web-'))
  mkdirSync(join(root, 'assets'))
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>app</title>')
  writeFileSync(join(root, 'assets', 'index-3f2a9c.js'), 'console.log(1)')
  writeFileSync(join(root, 'favicon.svg'), '<svg/>')
  return root
}

const handlerFor = (overrides: Partial<ServerConfig>) => {
  const config: ServerConfig = {
    port: 0,
    host: '127.0.0.1',
    webDist: makeWebDist(),
    appVersion: 'abc1234',
    ...overrides,
  }
  return HttpRouter.toWebHandler(
    makeAppLayer(config).pipe(Layer.provide(NodeHttpServer.layerHttpServices)),
    { disableLogger: true },
  )
}

const app = handlerFor({})
const appWithoutBuild = handlerFor({
  webDist: join(tmpdir(), 'sd-missing-build'),
})

afterAll(async () => {
  await app.dispose()
  await appWithoutBuild.dispose()
})

const get = (path: string, handler = app) =>
  handler.handler(new Request(`http://local${path}`))

describe('web server', () => {
  test('health reports status and version', async () => {
    const response = await get('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', version: 'abc1234' })
  })

  test('unknown API paths are JSON 404', async () => {
    const response = await get('/api/no-such-endpoint')

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toHaveProperty('error')
  })

  test.each([
    '/lt/lessons/load-balancer',
    '/lt/networks/',
    '/ru/system-design/lessons/caching',
  ])('deep link %s gets the app HTML without caching', async path => {
    const response = await get(path)

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<title>app</title>')
    expect(response.headers.get('cache-control')).toBe('no-cache')
  })

  test('hashed assets are cached forever', async () => {
    const response = await get('/assets/index-3f2a9c.js')

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('immutable')
  })

  test('other static files get a short cache', async () => {
    const response = await get('/favicon.svg')

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600')
  })

  test('a missing asset is a 404, not the app HTML', async () => {
    const response = await get('/assets/index-old.js')

    expect(response.status).toBe(404)
  })

  test('paths cannot escape the build directory', async () => {
    const response = await get('/%2e%2e/%2e%2e/etc/passwd')

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<title>app</title>')
  })

  test('without a web build the server explains what to do', async () => {
    const response = await get('/uk/', appWithoutBuild)

    expect(response.status).toBe(503)
    expect(await response.json()).toHaveProperty('error', 'web_build_missing')
  })
})
