import { type ChildProcess, spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const mainFile = fileURLToPath(new URL('./main.ts', import.meta.url))

const freePort = async (): Promise<number> => {
  const probe = createServer().listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const address = probe.address()
  probe.close()
  if (address === null || typeof address === 'string') {
    throw new Error('no port')
  }
  return address.port
}

const startServer = (env: Record<string, string>) => {
  const child = spawn(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', mainFile],
    { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const output: Array<string> = []
  child.stdout.on('data', chunk => output.push(String(chunk)))
  child.stderr.on('data', chunk => output.push(String(chunk)))
  return { child, output }
}

const exitCodeOf = async (child: ChildProcess): Promise<number | null> => {
  if (child.exitCode !== null) {
    return child.exitCode
  }
  const [code] = await once(child, 'exit')
  return code
}

const waitForHealth = async (port: number): Promise<void> => {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const ok = await fetch(`http://127.0.0.1:${port}/api/health`)
      .then(response => response.ok)
      .catch(() => false)
    if (ok) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('server did not start')
}

describe('server process', () => {
  test('an invalid PORT stops startup with a message naming it', async () => {
    const { child, output } = startServer({ PORT: 'abc' })

    expect(await exitCodeOf(child)).not.toBe(0)
    expect(output.join('')).toContain('PORT')
  }, 15_000)

  test('SIGTERM lets an in-flight response finish, then exits with 0', async () => {
    const webDist = mkdtempSync(join(tmpdir(), 'sd-web-'))
    mkdirSync(join(webDist, 'assets'))
    writeFileSync(join(webDist, 'index.html'), '<!doctype html>')
    const size = 32 * 1024 * 1024
    writeFileSync(join(webDist, 'assets', 'big-1.bin'), Buffer.alloc(size, 7))

    const port = await freePort()
    const { child } = startServer({ PORT: String(port), WEB_DIST: webDist })
    await waitForHealth(port)

    const response = await fetch(`http://127.0.0.1:${port}/assets/big-1.bin`)
    const reader = response.body?.getReader()
    if (reader === undefined) {
      throw new Error('no body')
    }
    const first = await reader.read()
    child.kill('SIGTERM')

    let received = first.value?.byteLength ?? 0
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) {
        break
      }
      received += chunk.value.byteLength
    }

    expect(received).toBe(size)
    expect(await exitCodeOf(child)).toBe(0)
  }, 30_000)
})
