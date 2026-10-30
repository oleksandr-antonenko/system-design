import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { listen, run, send, setLinkUp } from './build'
import { NetMessage } from './message'
import { emptyState } from './model'
import { Intent } from './packet'
import { runCommand } from './terminal'
import { buildWorld, chainNet, homeNet } from './testing'
import { commandTranscript, foldWorld, runInTerminal } from './world'

const lines = (output: ReadonlyArray<string>): string => output.join('\n')

describe('terminal: gated commands', () => {
  test('an unknown command and a locked command give hints with the available list, never a shell error', () => {
    const doc = homeNet()
    const unknown = runCommand(doc, emptyState, 'laptop', 'ls -la', [
      'ping',
      'ip',
    ])
    expect(unknown.output).toEqual([])
    expect(unknown.ops).toEqual([])
    expect(unknown.maybeHint).toEqual(
      Option.some(
        NetMessage.UnknownCommand({
          command: 'ls',
          available: ['ip a', 'ping'],
        }),
      ),
    )
    const locked = runCommand(doc, emptyState, 'laptop', 'traceroute 8.8.8.8', [
      'ping',
      'ip',
    ])
    expect(locked.maybeHint).toEqual(
      Option.some(
        NetMessage.CommandLocked({
          command: 'traceroute',
          available: ['ip a', 'ping'],
        }),
      ),
    )
    expect(locked.ops).toEqual([])
  })

  test('ip a shows the address; the MAC only once lesson 7 opens it; ipconfig is the same', () => {
    const doc = homeNet()
    expect(
      runCommand(doc, emptyState, 'laptop', 'ip a', ['ip']).output,
    ).toEqual(['lo0: inet 127.0.0.1/8', 'en0: inet 192.168.1.42/24'])
    expect(
      runCommand(doc, emptyState, 'laptop', 'ipconfig', ['ip', 'ip.mac'])
        .output,
    ).toEqual([
      'lo0: inet 127.0.0.1/8',
      'en0: inet 192.168.1.42/24  ether 3c:22:fb:4a:10:42',
    ])
  })
})

describe('terminal: ping (lesson 4)', () => {
  test('three echoes, whole milliseconds, no ttl until lesson 8', () => {
    const result = runCommand(
      chainNet(),
      emptyState,
      'laptop',
      'ping shop.example',
      ['ping'],
    )
    expect(lines(result.output)).toBe(
      [
        'PING shop.example (198.51.100.10): 56 data bytes',
        '64 bytes from 198.51.100.10: icmp_seq=0 time=90 ms',
        '64 bytes from 198.51.100.10: icmp_seq=1 time=90 ms',
        '64 bytes from 198.51.100.10: icmp_seq=2 time=90 ms',
        '',
        '--- shop.example ping statistics ---',
        '3 packets transmitted, 3 packets received, 0.0% packet loss',
      ].join('\n'),
    )
    expect(result.ops).toHaveLength(3)
    expect(result.traces).toHaveLength(3)
    const withTtl = runCommand(
      chainNet(),
      emptyState,
      'laptop',
      'ping -c 1 192.168.1.1',
      ['ping', 'ping.ttl'],
    )
    expect(withTtl.output[1]).toBe(
      '64 bytes from 192.168.1.1: icmp_seq=0 ttl=64 time=6 ms',
    )
  })

  test('with the provider cable out the router answers and the shop times out', () => {
    const world = foldWorld(buildWorld([], chainNet()), [
      send(Intent.Ping({ from: 'laptop', host: 'shop.example' })),
      setLinkUp('router', 'isp', false),
    ])
    const router = runCommand(
      world.doc,
      world.state,
      'laptop',
      'ping 192.168.1.1',
      ['ping'],
    )
    expect(router.output[1]).toBe(
      '64 bytes from 192.168.1.1: icmp_seq=0 time=6 ms',
    )
    const shop = runCommand(
      world.doc,
      world.state,
      'laptop',
      'ping shop.example',
      ['ping'],
    )
    expect(lines(shop.output)).toBe(
      [
        'PING shop.example (198.51.100.10): 56 data bytes',
        'Request timeout for icmp_seq 0',
        'Request timeout for icmp_seq 1',
        'Request timeout for icmp_seq 2',
        '',
        '--- shop.example ping statistics ---',
        '3 packets transmitted, 0 packets received, 100.0% packet loss',
      ].join('\n'),
    )
    expect(
      runCommand(world.doc, world.state, 'laptop', 'ping nowhere.example', [
        'ping',
      ]).output,
    ).toEqual(['ping: cannot resolve nowhere.example: Unknown host'])
  })
})

describe('terminal: npm run dev (lesson 6)', () => {
  test('the default listens on localhost; -- --host exposes it; --host without -- stays local', () => {
    const doc = homeNet()
    const local = runCommand(doc, emptyState, 'laptop', 'npm run dev', ['npm'])
    expect(local.output).toEqual([
      '',
      '  VITE ready in 300 ms',
      '',
      '  ➜  Local:   http://localhost:5173/',
      '  ➜  Network: use --host to expose',
    ])
    expect(local.running).toBe(true)
    expect(local.ops).toEqual([listen('laptop', 'tcp', '127.0.0.1', 5173)])
    const exposed = runCommand(
      doc,
      emptyState,
      'laptop',
      'npm run dev -- --host',
      ['npm'],
    )
    expect(exposed.output[4]).toBe('  ➜  Network: http://192.168.1.42:5173/')
    const swallowed = runCommand(
      doc,
      emptyState,
      'laptop',
      'npm run dev --host',
      ['npm'],
    )
    expect(swallowed.output[4]).toBe('  ➜  Network: use --host to expose')
  })

  test('the transcript replays the same output from the journal', () => {
    const start = buildWorld([], homeNet())
    const ops = [
      run('laptop', 'npm run dev'),
      run('laptop', 'Ctrl+C'),
      run('laptop', 'npm run dev -- --host'),
    ]
    const transcript = commandTranscript(start, ops)
    expect(Array.map(transcript, entry => entry.result.output.at(-1))).toEqual([
      '  ➜  Network: use --host to expose',
      '^C',
      '  ➜  Network: http://192.168.1.42:5173/',
    ])
    const [, after] = runInTerminal(foldWorld(start, ops), 'laptop', 'ss -ltn')
    expect(after.state.commandLog.length).toBe(4)
  })
})

describe('terminal: arp -a', () => {
  test('a ping fills the ARP cache that arp -a prints', () => {
    const world = foldWorld(buildWorld([], homeNet()), [
      run('laptop', 'ping -c 1 192.168.1.1'),
    ])
    const [result] = runInTerminal(world, 'laptop', 'arp -a')
    expect(result.output).toHaveLength(1)
    expect(result.output[0]).toMatch(
      /^\? \(192\.168\.1\.1\) at 02:[0-9a-f:]+ on en0$/,
    )
  })
})
