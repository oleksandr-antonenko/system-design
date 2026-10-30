import { Array, Option, Order, Result, Schema, pipe } from 'effect'

import { issueCertificate } from './acme'
import {
  compareIp,
  isCidr,
  isIp,
  macFromId,
  normalizeUrl,
  parseUrl,
} from './address'
import { addressesIn, cachedAnswer } from './dns'
import {
  NetOp,
  emptyHostFields,
  findDevice,
  findHost,
  parseMapping,
} from './doc'
import { NetMessage } from './message'
import {
  Addressing,
  type DeviceId,
  type DnsRecord,
  type Firewall,
  type FirewallAction,
  type FirewallProto,
  type FirewallRule,
  type Host,
  type NetDoc,
  type NetState,
  type RecordType,
} from './model'
import { Intent, type Outcome, type RouteLine, type Trace } from './packet'
import { certFor } from './tls'
import { IFACE, hostIface, ownAddresses, routeTable } from './topology'
import { settle, trace } from './trace'

// Терминал: чистый интерпретатор строки на устройстве. Вывод упрощён в
// стиле Unix и не переводится; действие команды — операции свёртки.

/** Команды и детали вывода, которые открывают уроки. */
export const TerminalFeature = Schema.Literals([
  'ip',
  'ip.route',
  'ip.mac',
  'ping',
  'ping.ttl',
  'arp',
  'npm',
  'traceroute',
  'nslookup',
  'dig',
  'curl',
  'ss',
  'nc',
  'docker',
  'ufw',
  'tunnel',
  'certbot',
])
export type TerminalFeature = typeof TerminalFeature.Type

export const allFeatures: ReadonlyArray<TerminalFeature> =
  TerminalFeature.literals

/** Метка строки вывода: по ней урок диагностики собирает доказательства. */
export const LineTag = Schema.Literals([
  'plain',
  'ok',
  'symptom',
  'dnsFailed',
  'dnsTimeout',
  'gatewayUnreachable',
  'timeout',
  'refused',
  'loopbackOnly',
  'certProblem',
])
export type LineTag = typeof LineTag.Type

export type TerminalLine = Readonly<{ text: string; tag: LineTag }>

export type CommandResult = Readonly<{
  lines: ReadonlyArray<TerminalLine>
  output: ReadonlyArray<string>
  maybeHint: Option.Option<NetMessage>
  ops: ReadonlyArray<NetOp>
  traces: ReadonlyArray<Trace>
  program: string
  maybeTarget: Option.Option<string>
  saw: ReadonlyArray<string>
  /** Программа держит терминал до Ctrl+C (`npm run dev`). */
  running: boolean
}>

const line = (text: string, tag: LineTag = 'plain'): TerminalLine => ({
  text,
  tag,
})

const result = (
  program: string,
  lines: ReadonlyArray<TerminalLine>,
  extra: Partial<Omit<CommandResult, 'lines' | 'output' | 'program'>> = {},
): CommandResult => ({
  lines,
  output: Array.map(lines, current => current.text),
  maybeHint: extra.maybeHint ?? Option.none(),
  ops: extra.ops ?? [],
  traces: extra.traces ?? [],
  program,
  maybeTarget: extra.maybeTarget ?? Option.none(),
  saw: extra.saw ?? [],
  running: extra.running ?? false,
})

const hint = (program: string, message: NetMessage): CommandResult =>
  result(program, [], { maybeHint: Option.some(message) })

const usage = (program: string, text: string): CommandResult =>
  hint(program, NetMessage.CommandUsage({ command: program, usage: text }))

const commandForms: ReadonlyArray<readonly [TerminalFeature, string]> = [
  ['ip', 'ip a'],
  ['ip.route', 'ip route'],
  ['ping', 'ping'],
  ['arp', 'arp -a'],
  ['npm', 'npm run dev'],
  ['traceroute', 'traceroute'],
  ['nslookup', 'nslookup'],
  ['dig', 'dig'],
  ['curl', 'curl -v'],
  ['ss', 'ss -ltn'],
  ['nc', 'nc -zv'],
  ['docker', 'docker'],
  ['ufw', 'ufw'],
  ['tunnel', 'tunnel http'],
  ['certbot', 'certbot'],
]

const availableForms = (
  available: ReadonlyArray<TerminalFeature>,
): ReadonlyArray<string> =>
  pipe(
    commandForms,
    Array.filter(([feature]) => Array.contains(available, feature)),
    Array.map(([, form]) => form),
  )

const programs: Readonly<Record<string, TerminalFeature>> = {
  ip: 'ip',
  ipconfig: 'ip',
  ifconfig: 'ip',
  route: 'ip.route',
  ping: 'ping',
  arp: 'arp',
  npm: 'npm',
  npx: 'npm',
  traceroute: 'traceroute',
  tracert: 'traceroute',
  nslookup: 'nslookup',
  dig: 'dig',
  curl: 'curl',
  ss: 'ss',
  nc: 'nc',
  docker: 'docker',
  ufw: 'ufw',
  tunnel: 'tunnel',
  certbot: 'certbot',
}

// HELPERS

const ms = (value: number): string => value.toFixed(1)

const outcomeReason = (outcome: Outcome): Option.Option<NetMessage> =>
  outcome._tag === 'Delivered' ? Option.none() : Option.some(outcome.reason)

const isNameFailure = (reason: NetMessage): boolean =>
  reason._tag === 'NameNotFound' || reason._tag === 'NoDnsServer'

/** Имя не превратилось в адрес: код «имя не найдено» или вопрос DNS погиб
    раньше, чем ушёл первый конверт к цели. */
const nameFailed = (result: Trace): boolean =>
  Option.exists(outcomeReason(result.outcome), isNameFailure) ||
  (result.outcome._tag !== 'Delivered' &&
    Array.some(result.hops, hop =>
      Array.some(hop.envelope, layer => layer._tag === 'Dns'),
    ) &&
    !Array.some(result.hops, hop =>
      Array.some(
        hop.envelope,
        layer => layer._tag === 'Icmp' || layer._tag === 'Tcp',
      ),
    ))

const traced = (
  doc: NetDoc,
  state: NetState,
  intent: Intent,
): readonly [Trace, NetState] => trace(doc, state, intent)

const serviceName: Readonly<Record<number, string>> = {
  22: 'ssh',
  53: 'domain',
  80: 'http',
  443: 'https',
  631: 'ipp',
  3306: 'mysql',
  5432: 'postgresql',
  6379: 'redis',
  9100: 'jetdirect',
  25565: 'minecraft',
}

/** Адрес имени для вывода: как есть, из памяти устройства или вопросом. */
const resolvedIp = (
  doc: NetDoc,
  state: NetState,
  from: DeviceId,
  host: string,
): Option.Option<string> => {
  if (isIp(host)) {
    return Option.some(host)
  }
  const remembered = Option.flatMap(
    cachedAnswer(state, from, host, 'A'),
    records => Array.head(addressesIn(records)),
  )
  if (Option.isSome(remembered)) {
    return remembered
  }
  const [named] = traced(doc, state, Intent.Resolve({ from, name: host }))
  return named.outcome._tag === 'Delivered' &&
    named.outcome.answer._tag === 'Resolved'
    ? Option.some(named.outcome.answer.ip)
    : Option.none()
}

// IP

const ipAddr = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  showMac: boolean,
): CommandResult => {
  const iface = hostIface(doc, state, host)
  const name = Option.isSome(host.maybeContainer) ? 'eth0' : IFACE
  const main = Option.match(iface, {
    onNone: () => `${name}: no address`,
    onSome: current =>
      `${name}: inet ${current.ip}/${current.prefix}${showMac ? `  ether ${host.mac}` : ''}`,
  })
  const extra = [
    ...Option.toArray(
      pipe(
        host.maybeVpn,
        Option.filter(vpn => vpn.connected),
        Option.map(vpn => `wg0: inet ${vpn.address}/32`),
      ),
    ),
    ...Option.toArray(
      Option.map(host.maybeMesh, mesh => `mesh0: inet ${mesh.ip}/32`),
    ),
    ...Option.toArray(
      Option.map(
        host.maybeDocker,
        bridge => `docker0: inet ${bridge.ip}/${bridge.prefix}`,
      ),
    ),
  ]
  return result(
    'ip',
    Array.map(['lo0: inet 127.0.0.1/8', main, ...extra], text => line(text)),
    { saw: Option.toArray(Option.map(iface, current => current.ip)) },
  )
}

const ipRoute = (doc: NetDoc, state: NetState, host: Host): CommandResult => {
  const iface = hostIface(doc, state, host)
  const lines = Array.map(routeTable(doc, state, host.id), row =>
    row.kind === 'default'
      ? `default via ${Option.getOrElse(row.maybeVia, () => '')} dev ${row.iface}`
      : row.kind === 'vpn'
        ? `${row.network}/${row.prefix} dev ${row.iface}`
        : `${row.network}/${row.prefix} dev ${row.iface} src ${
            row.iface === 'docker0'
              ? Option.getOrElse(
                  Option.map(host.maybeDocker, bridge => bridge.ip),
                  () => '',
                )
              : Option.getOrElse(
                  Option.map(iface, current => current.ip),
                  () => '',
                )
          }`,
  )
  return result(
    'ip',
    Array.map(lines, text => line(text)),
  )
}

// PING

const pingLine = (
  doc: NetDoc,
  host: Host,
  state: NetState,
  seq: number,
  echo: Trace,
  showTtl: boolean,
): TerminalLine =>
  echo.outcome._tag === 'Delivered' && echo.outcome.answer._tag === 'EchoReply'
    ? line(
        `64 bytes from ${echo.outcome.answer.ip}: icmp_seq=${seq}${
          showTtl ? ` ttl=${echo.outcome.answer.ttl}` : ''
        } time=${Math.round(echo.outcome.answer.ms)} ms`,
        'ok',
      )
    : Option.match(outcomeReason(echo.outcome), {
        onNone: () => line(`Request timeout for icmp_seq ${seq}`, 'timeout'),
        onSome: reason =>
          reason._tag === 'GatewayUnreachable' || reason._tag === 'ArpNoReply'
            ? line(
                `From ${Option.getOrElse(
                  Option.map(hostIface(doc, state, host), iface => iface.ip),
                  () => '0.0.0.0',
                )} icmp_seq=${seq} Destination Host Unreachable`,
                'gatewayUnreachable',
              )
            : reason._tag === 'NoGateway' ||
                reason._tag === 'NoLink' ||
                reason._tag === 'NoAddress' ||
                reason._tag === 'LinkDown' ||
                reason._tag === 'WrongPassword' ||
                reason._tag === 'NoWifiProfile' ||
                reason._tag === 'OutOfRange'
              ? line('ping: sendto: Network is unreachable', 'symptom')
              : line(`Request timeout for icmp_seq ${seq}`, 'timeout'),
      })

const ping = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  args: ReadonlyArray<string>,
  showTtl: boolean,
): CommandResult => {
  const countIndex = Array.findFirstIndex(args, arg => arg === '-c')
  const count = pipe(
    countIndex,
    Option.flatMap(index => Array.get(args, index + 1)),
    Option.map(value => globalThis.Number(value)),
    Option.filter(value => globalThis.Number.isInteger(value) && value > 0),
    Option.getOrElse(() => 3),
  )
  const target = Array.findFirst(
    args,
    (arg, index) =>
      !arg.startsWith('-') &&
      !Option.exists(countIndex, flag => index === flag + 1),
  )
  if (Option.isNone(target)) {
    return usage('ping', 'ping [-c N] host')
  }
  const name = target.value
  const intent = Intent.Ping({ from: host.id, host: name })
  type Echoes = Readonly<{ state: NetState; traces: ReadonlyArray<Trace> }>
  const echoes = Array.reduce(
    Array.range(1, Math.min(count, 10)),
    { state, traces: [] },
    (current: Echoes): Echoes => {
      const [echo, after] = traced(doc, current.state, intent)
      return { state: after, traces: [...current.traces, echo] }
    },
  )
  const first = Array.head(echoes.traces)
  const unresolved = Option.exists(first, nameFailed)
  const ops = Array.map(echoes.traces, () => NetOp.Send({ intent }))
  if (unresolved && !isIp(name)) {
    return result(
      'ping',
      [line(`ping: cannot resolve ${name}: Unknown host`, 'dnsFailed')],
      {
        ops: Array.take(ops, 1),
        traces: Array.take(echoes.traces, 1),
        maybeTarget: Option.some(name),
      },
    )
  }
  const ip = Option.getOrElse(
    resolvedIp(doc, echoes.state, host.id, name),
    () => name,
  )
  const received = Array.filter(
    echoes.traces,
    echo => echo.outcome._tag === 'Delivered',
  ).length
  const loss = ((echoes.traces.length - received) / echoes.traces.length) * 100
  return result(
    'ping',
    [
      line(`PING ${name} (${ip}): 56 data bytes`),
      ...Array.map(echoes.traces, (echo, index) =>
        pingLine(doc, host, state, index, echo, showTtl),
      ),
      line(''),
      line(`--- ${name} ping statistics ---`),
      line(
        `${echoes.traces.length} packets transmitted, ${received} packets received, ${loss.toFixed(1)}% packet loss`,
        received === 0 ? 'symptom' : 'plain',
      ),
    ],
    {
      ops,
      traces: echoes.traces,
      maybeTarget: Option.some(name),
      saw: received > 0 ? [ip] : [],
    },
  )
}

// ARP

const ipOrder: Order.Order<string> = Order.make((left, right) => {
  const diff = compareIp(left, right)
  return diff < 0 ? -1 : diff > 0 ? 1 : 0
})

const arpTable = (state: NetState, host: Host): CommandResult =>
  result(
    'arp',
    pipe(
      state.arp,
      Array.filter(entry => entry.device === host.id),
      Array.sort(Order.mapInput(ipOrder, (entry: { ip: string }) => entry.ip)),
      Array.map(entry => line(`? (${entry.ip}) at ${entry.mac} on ${IFACE}`)),
    ),
  )

// NPM

const DEV_PORT = 5173

const npmRunDev = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  args: ReadonlyArray<string>,
): CommandResult => {
  const isDev =
    (Array.get(args, 0).pipe(Option.contains('run')) &&
      Array.get(args, 1).pipe(Option.contains('dev'))) ||
    Array.get(args, 0).pipe(Option.contains('vite'))
  if (!isDev) {
    return usage('npm', 'npm run dev [-- --host]')
  }
  const separator = Array.findFirstIndex(args, arg => arg === '--')
  const npx = Array.get(args, 0).pipe(Option.contains('vite'))
  const flags = npx
    ? Array.drop(args, 1)
    : Option.match(separator, {
        onNone: () => [],
        onSome: index => Array.drop(args, index + 1),
      })
  const exposed = Array.some(
    flags,
    flag => flag === '--host' || flag.startsWith('--host='),
  )
  const bind = exposed ? '0.0.0.0' : '127.0.0.1'
  const port = DEV_PORT
  const network = exposed
    ? Array.map(
        Array.filter(ownAddresses(doc, state, host), ip => ip !== '127.0.0.1'),
        ip => line(`  ➜  Network: http://${ip}:${port}/`),
      )
    : [line('  ➜  Network: use --host to expose', 'loopbackOnly')]
  return result(
    'npm',
    [
      line(''),
      line('  VITE ready in 300 ms'),
      line(''),
      line(`  ➜  Local:   http://localhost:${port}/`),
      ...network,
    ],
    {
      ops: [NetOp.Listen({ device: host.id, proto: 'tcp', bind, port })],
      running: true,
      saw: exposed ? Array.map(network, current => current.text) : [],
    },
  )
}

// TRACEROUTE

const hopName = (
  doc: NetDoc,
  lineInfo: RouteLine,
  target: string,
  targetIp: string,
): string =>
  Option.match(lineInfo.maybeIp, {
    onNone: () => '',
    onSome: ip => {
      const named = pipe(
        lineInfo.maybeDevice,
        Option.flatMap(id => findDevice(doc, id)),
        Option.flatMap(device =>
          device._tag === 'Transit' && device.name !== ''
            ? Option.some(device.name)
            : Option.none(),
        ),
      )
      return `${Option.getOrElse(named, () => (ip === targetIp && !isIp(target) ? target : ip))} (${ip})`
    },
  })

const traceroute = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  args: ReadonlyArray<string>,
): CommandResult => {
  const target = Array.findFirst(args, arg => !arg.startsWith('-'))
  if (Option.isNone(target)) {
    return usage('traceroute', 'traceroute host')
  }
  const intent = Intent.Traceroute({ from: host.id, host: target.value })
  const [route] = traced(doc, state, intent)
  const ops = [NetOp.Send({ intent })]
  if (
    route.outcome._tag !== 'Delivered' ||
    route.outcome.answer._tag !== 'Route'
  ) {
    return result(
      'traceroute',
      [
        line(
          nameFailed(route)
            ? `traceroute: unknown host ${target.value}`
            : 'traceroute: sendto: Network is unreachable',
          'dnsFailed',
        ),
      ],
      { ops, traces: [route], maybeTarget: Option.some(target.value) },
    )
  }
  const answer = route.outcome.answer
  const rows = Array.map(answer.lines, current => {
    const number = String(current.ttl).padStart(2, ' ')
    if (Option.isNone(current.maybeIp)) {
      return line(`${number}  * * *`, 'timeout')
    }
    if (current.unreachable) {
      const time = `${ms(current.ms)} ms !H`
      return line(
        `${number}  ${hopName(doc, current, target.value, answer.ip)}  ${time}  ${time}  ${time}`,
        'gatewayUnreachable',
      )
    }
    return line(
      `${number}  ${hopName(doc, current, target.value, answer.ip)}  ${ms(current.ms)} ms  ${ms(current.ms + 0.2)} ms  ${ms(current.ms + 0.1)} ms`,
      'ok',
    )
  })
  const stopped =
    !answer.reached &&
    Option.exists(Array.last(answer.lines), last => Option.isNone(last.maybeIp))
  return result(
    'traceroute',
    [
      line(
        `traceroute to ${target.value} (${answer.ip}), 30 hops max, 60 byte packets`,
      ),
      ...rows,
      ...(stopped ? [line('^C')] : []),
    ],
    {
      ops,
      traces: [route],
      maybeTarget: Option.some(target.value),
      saw: Array.flatMap(answer.lines, current =>
        Option.toArray(current.maybeIp),
      ),
    },
  )
}

// DNS

const recordTypes: ReadonlyArray<RecordType> = [
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'TXT',
  'NS',
]

const isRecordType = (value: string): value is RecordType =>
  Array.some(recordTypes, type => type === value)

type Queried = Readonly<{
  trace: Trace
  maybeRecords: Option.Option<
    Readonly<{
      records: ReadonlyArray<DnsRecord>
      server: string
      authoritative: boolean
    }>
  >
}>

const query = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  name: string,
  rtype: RecordType,
  maybeServer: Option.Option<string>,
): Queried => {
  const [answer] = traced(
    doc,
    state,
    Intent.Query({ from: host.id, name, rtype, maybeServer }),
  )
  return {
    trace: answer,
    maybeRecords:
      answer.outcome._tag === 'Delivered' &&
      answer.outcome.answer._tag === 'Records'
        ? Option.some(answer.outcome.answer)
        : Option.none(),
  }
}

const serverShown = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  maybeServer: Option.Option<string>,
): string =>
  Option.getOrElse(
    Option.orElse(
      Option.flatMap(maybeServer, server =>
        resolvedIp(doc, state, host.id, server),
      ),
      () =>
        Option.flatMap(hostIface(doc, state, host), iface => iface.maybeDns),
    ),
    () => '0.0.0.0',
  )

const nslookup = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  args: ReadonlyArray<string>,
): CommandResult => {
  const positional = Array.filter(args, arg => !arg.startsWith('-'))
  const maybeName = Array.head(positional)
  if (Option.isNone(maybeName)) {
    return usage('nslookup', 'nslookup name [server]')
  }
  const name = maybeName.value
  const maybeServer = Array.get(positional, 1)
  const asked = query(doc, state, host, name, 'A', maybeServer)
  const server = serverShown(doc, state, host, maybeServer)
  const ops = [
    NetOp.Send({
      intent: Intent.Query({ from: host.id, name, rtype: 'A', maybeServer }),
    }),
  ]
  const head = [
    line(`Server:\t\t${server}`),
    line(`Address:\t${server}#53`),
    line(''),
  ]
  return Option.match(asked.maybeRecords, {
    onNone: () =>
      result(
        'nslookup',
        Option.exists(
          outcomeReason(asked.trace.outcome),
          reason => reason._tag === 'NameNotFound',
        )
          ? [
              ...head,
              line(`** server can't find ${name}: NXDOMAIN`, 'dnsFailed'),
            ]
          : [
              line(
                ';; connection timed out; no servers could be reached',
                'dnsTimeout',
              ),
            ],
        { ops, traces: [asked.trace], maybeTarget: Option.some(name) },
      ),
    onSome: answer => {
      const addresses = Array.filter(
        answer.records,
        record => record.rtype === 'A',
      )
      return result(
        'nslookup',
        [
          ...head,
          ...(answer.authoritative ? [] : [line('Non-authoritative answer:')]),
          ...Array.flatMap(answer.records, record =>
            record.rtype === 'CNAME'
              ? [line(`${record.name}\tcanonical name = ${record.value}.`)]
              : [],
          ),
          ...Array.flatMap(addresses, record => [
            line(`Name:\t${record.name}`),
            line(`Address: ${record.value}`, 'ok'),
          ]),
        ],
        {
          ops,
          traces: [asked.trace],
          maybeTarget: Option.some(name),
          saw: Array.map(addresses, record => record.value),
        },
      )
    },
  })
}

const dig = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  args: ReadonlyArray<string>,
): CommandResult => {
  const maybeServer = pipe(
    Array.findFirst(args, arg => arg.startsWith('@')),
    Option.map(arg => arg.slice(1)),
  )
  const short = Array.contains(args, '+short')
  const words = Array.filter(
    args,
    arg => !arg.startsWith('@') && !arg.startsWith('+'),
  )
  const rtype = pipe(
    Array.findFirst(words, word => isRecordType(word.toUpperCase())),
    Option.map(word => word.toUpperCase()),
    Option.filter(isRecordType),
    Option.getOrElse((): RecordType => 'A'),
  )
  const maybeName = Array.findFirst(
    words,
    word => !isRecordType(word.toUpperCase()),
  )
  if (Option.isNone(maybeName)) {
    return usage('dig', 'dig [@server] [type] name')
  }
  const name = maybeName.value
  const asked = query(doc, state, host, name, rtype, maybeServer)
  const ops = [
    NetOp.Send({
      intent: Intent.Query({ from: host.id, name, rtype, maybeServer }),
    }),
  ]
  const server = serverShown(doc, state, host, maybeServer)
  return Option.match(asked.maybeRecords, {
    onNone: () => {
      const nx = Option.exists(
        outcomeReason(asked.trace.outcome),
        reason => reason._tag === 'NameNotFound',
      )
      return result(
        'dig',
        nx
          ? short
            ? []
            : [
                line(''),
                line(';; status: NXDOMAIN', 'dnsFailed'),
                line(''),
                line(`;; SERVER: ${server}#53`),
              ]
          : [
              line(
                ';; connection timed out; no servers could be reached',
                'dnsTimeout',
              ),
            ],
        { ops, traces: [asked.trace], maybeTarget: Option.some(name) },
      )
    },
    onSome: answer => {
      const saw = Array.map(
        Array.filter(answer.records, record => record.rtype === rtype),
        record => record.value,
      )
      return result(
        'dig',
        short
          ? Array.map(answer.records, record =>
              line(
                record.rtype === 'CNAME' ? `${record.value}.` : record.value,
                'ok',
              ),
            )
          : [
              line(''),
              ...(answer.authoritative ? [line(';; flags: qr aa')] : []),
              line(';; ANSWER SECTION:'),
              ...Array.map(answer.records, record =>
                line(
                  `${record.name}.\t\t${record.ttl}\tIN\t${record.rtype}\t${
                    record.rtype === 'CNAME'
                      ? `${record.value}.`
                      : record.rtype === 'TXT'
                        ? `"${record.value}"`
                        : record.value
                  }`,
                  'ok',
                ),
              ),
              line(''),
              line(`;; SERVER: ${answer.server}#53`),
            ],
        { ops, traces: [asked.trace], maybeTarget: Option.some(name), saw },
      )
    },
  })
}

// CURL AND NC

const TIMEOUT_MS = 75004

const curl = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  args: ReadonlyArray<string>,
): CommandResult => {
  const verbose = Array.some(
    args,
    arg => arg === '-v' || arg === '-vI' || arg === '-Iv',
  )
  const follow = Array.contains(args, '-L')
  const raw = Array.findFirst(args, arg => !arg.startsWith('-'))
  if (Option.isNone(raw)) {
    return usage('curl', 'curl [-v] url')
  }
  const url = normalizeUrl(raw.value)
  const parsed = parseUrl(url)
  if (Option.isNone(parsed)) {
    return result('curl', [
      line(
        `curl: (3) URL rejected: Malformed input to a URL function`,
        'symptom',
      ),
    ])
  }
  const target = parsed.value
  const intent = follow
    ? Intent.Browse({ from: host.id, url })
    : Intent.Fetch({ from: host.id, url })
  const [page] = traced(doc, state, intent)
  const ops = [NetOp.Send({ intent })]
  const ip = Option.getOrElse(
    resolvedIp(doc, state, host.id, target.host),
    () => target.host,
  )
  const extras = { ops, traces: [page], maybeTarget: Option.some(target.host) }
  const trying = verbose ? [line(`*   Trying ${ip}:${target.port}...`)] : []
  const server = Option.flatMap(
    page.outcome._tag === 'Delivered'
      ? Option.some(page.outcome.at)
      : Option.none(),
    id => findHost(doc, id),
  )
  return Option.match(outcomeReason(page.outcome), {
    onSome: reason => {
      if (isNameFailure(reason)) {
        return result(
          'curl',
          [
            line(
              `curl: (6) Could not resolve host: ${target.host}`,
              'dnsFailed',
            ),
          ],
          extras,
        )
      }
      if (
        reason._tag === 'PortClosed' ||
        reason._tag === 'FirewallRejected' ||
        reason._tag === 'AppDown' ||
        reason._tag === 'ListensOnlyOnLoopback'
      ) {
        return result(
          'curl',
          [
            ...trying,
            ...(verbose
              ? [
                  line(
                    `* connect to ${ip} port ${target.port} failed: Connection refused`,
                  ),
                ]
              : []),
            line(
              `curl: (7) Failed to connect to ${target.host} port ${target.port} after 3 ms: Couldn't connect to server`,
              reason._tag === 'ListensOnlyOnLoopback'
                ? 'loopbackOnly'
                : 'refused',
            ),
          ],
          extras,
        )
      }
      if (reason._tag === 'PublishedPortClosed') {
        return result(
          'curl',
          [...trying, line('curl: (52) Empty reply from server', 'refused')],
          extras,
        )
      }
      if (reason._tag === 'TlsNotConfigured') {
        return result(
          'curl',
          [...trying, line('curl: (35) SSL connect error', 'certProblem')],
          extras,
        )
      }
      if (
        reason._tag === 'CertNameMismatch' ||
        reason._tag === 'CertExpired' ||
        reason._tag === 'CertUntrusted'
      ) {
        const cert = Option.flatMap(findHost(doc, reason.device), found =>
          certFor(found, target.host),
        )
        const message =
          reason._tag === 'CertNameMismatch'
            ? `SSL: no alternative certificate subject name matches target host name '${target.host}'`
            : reason._tag === 'CertExpired'
              ? 'SSL certificate problem: certificate has expired'
              : 'SSL certificate problem: unable to get local issuer certificate'
        return result(
          'curl',
          [
            ...trying,
            ...(verbose
              ? [
                  line(
                    `* Connected to ${target.host} (${ip}) port ${target.port}`,
                  ),
                  ...Option.match(cert, {
                    onNone: () => [],
                    onSome: current => [
                      line('* Server certificate:'),
                      line(
                        `*  subject: CN=${Option.getOrElse(Array.head(current.names), () => '')}`,
                      ),
                      line(`*  subjectAltName: ${current.names.join(', ')}`),
                      line(`*  expire date: ${current.notAfter}`),
                      line(`*  issuer: ${current.issuer}`),
                    ],
                  }),
                  line(`* ${message}`, 'certProblem'),
                ]
              : []),
            line(`curl: (60) ${message}`, 'certProblem'),
          ],
          extras,
        )
      }
      return result(
        'curl',
        [
          ...trying,
          line(
            `curl: (28) Failed to connect to ${target.host} port ${target.port} after ${TIMEOUT_MS} ms: Timeout was reached`,
            'timeout',
          ),
        ],
        extras,
      )
    },
    onNone: () => {
      const answer =
        page.outcome._tag === 'Delivered' && page.outcome.answer._tag === 'Page'
          ? Option.some(page.outcome.answer)
          : Option.none()
      const status = Option.getOrElse(
        Option.map(answer, current => current.status),
        () => 200,
      )
      const statusText: Readonly<Record<number, string>> = {
        200: 'OK',
        301: 'Moved Permanently',
        404: 'Not Found',
        502: 'Bad Gateway',
      }
      const location = Option.flatMap(answer, current =>
        current.status === 301
          ? Option.some(`https://${target.host}${target.path}`)
          : Option.none(),
      )
      const certLines = pipe(
        Option.flatMap(answer, current => current.maybeCert),
        Option.match({
          onNone: () => [],
          onSome: cert => [
            line('* Server certificate:'),
            line(
              `*  subject: CN=${Option.getOrElse(Array.head(cert.names), () => '')}`,
            ),
            line(`*  subjectAltName: ${cert.names.join(', ')}`),
            line(`*  expire date: ${cert.notAfter}`),
            line(`*  issuer: ${cert.issuer}`),
            line('* SSL certificate verify ok.', 'ok'),
          ],
        }),
      )
      const body =
        status === 200
          ? `<!doctype html><title>${target.host}</title>`
          : `<html><body>${status} ${statusText[status] ?? ''}</body></html>`
      return result(
        'curl',
        verbose
          ? [
              ...trying,
              line(`* Connected to ${target.host} (${ip}) port ${target.port}`),
              ...certLines,
              line(`> GET ${target.path} HTTP/1.1`),
              line(`> Host: ${target.host}`),
              line('>'),
              line(
                `< HTTP/1.1 ${status} ${statusText[status] ?? ''}`,
                status < 400 ? 'ok' : 'symptom',
              ),
              ...Option.toArray(
                Option.map(location, value => line(`< Location: ${value}`)),
              ),
              line('<'),
              ...(status === 301 ? [] : [line(body)]),
            ]
          : [line(body, status < 400 ? 'ok' : 'symptom')],
        {
          ...extras,
          saw: Option.toArray(Option.map(server, found => found.id)),
        },
      )
    },
  })
}

const nc = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  args: ReadonlyArray<string>,
): CommandResult => {
  const positional = Array.filter(args, arg => !arg.startsWith('-'))
  const maybeTarget = Array.head(positional)
  const maybePort = pipe(
    Array.get(positional, 1),
    Option.map(value => globalThis.Number(value)),
    Option.filter(
      value => globalThis.Number.isInteger(value) && value > 0 && value < 65536,
    ),
  )
  if (Option.isNone(maybeTarget) || Option.isNone(maybePort)) {
    return usage('nc', 'nc -zv host port')
  }
  const target = maybeTarget.value
  const port = maybePort.value
  const intent = Intent.Connect({ from: host.id, host: target, port })
  const [connected] = traced(doc, state, intent)
  const ip = Option.getOrElse(
    resolvedIp(doc, state, host.id, target),
    () => target,
  )
  const extras = {
    ops: [NetOp.Send({ intent })],
    traces: [connected],
    maybeTarget: Option.some(target),
  }
  const shown = isIp(target) ? target : `${target} (${ip})`
  return Option.match(outcomeReason(connected.outcome), {
    onNone: () =>
      result(
        'nc',
        [
          line(
            `Connection to ${shown} ${port} port [tcp/${serviceName[port] ?? '*'}] succeeded!`,
            'ok',
          ),
        ],
        { ...extras, saw: [String(port)] },
      ),
    onSome: reason =>
      result(
        'nc',
        [
          isNameFailure(reason)
            ? line(
                `nc: getaddrinfo for host "${target}" port ${port}: Name or service not known`,
                'dnsFailed',
              )
            : reason._tag === 'PortClosed' ||
                reason._tag === 'FirewallRejected' ||
                reason._tag === 'AppDown' ||
                reason._tag === 'ListensOnlyOnLoopback' ||
                reason._tag === 'PublishedPortClosed'
              ? line(
                  `nc: connect to ${shown} port ${port} (tcp) failed: Connection refused`,
                  reason._tag === 'ListensOnlyOnLoopback'
                    ? 'loopbackOnly'
                    : 'refused',
                )
              : line(
                  `nc: connect to ${shown} port ${port} (tcp) timed out`,
                  'timeout',
                ),
        ],
        extras,
      ),
  })
}

// SS

const ss = (host: Host): CommandResult => {
  const rows = pipe(
    [
      ...Array.filter(host.listeners, listener => listener.proto === 'tcp'),
      ...Array.map(host.publishes, publish => ({
        proto: publish.proto,
        bind: publish.bind,
        port: publish.hostPort,
      })),
    ],
    Array.sort(
      Order.mapInput(Order.Number, (entry: { port: number }) => entry.port),
    ),
    Array.map(entry => {
      const local = `${entry.bind}:${entry.port}`
      return line(
        `LISTEN  0       128      ${local.padStart(18, ' ')}      0.0.0.0:*`,
        entry.bind === '127.0.0.1' ? 'loopbackOnly' : 'plain',
      )
    }),
  )
  return result('ss', [
    line('State   Recv-Q  Send-Q   Local Address:Port   Peer Address:Port'),
    ...rows,
  ])
}

// UFW

const ruleText = (rule: FirewallRule): readonly [string, string, string] => {
  const to = Option.match(rule.maybePort, {
    onNone: () => 'Anywhere',
    onSome: port =>
      rule.proto === 'any' ? String(port) : `${port}/${rule.proto}`,
  })
  const action =
    rule.action === 'allow'
      ? 'ALLOW'
      : rule.action === 'drop'
        ? 'DENY'
        : 'REJECT'
  const from = Option.match(rule.maybeFrom, {
    onNone: () => 'Anywhere',
    onSome: cidr => cidr.replace(/\/32$/, ''),
  })
  return [to, action, from]
}

const ufwStatus = (
  firewall: Firewall,
  mode: 'plain' | 'verbose' | 'numbered',
): ReadonlyArray<TerminalLine> => {
  if (!firewall.enabled) {
    return mode === 'verbose'
      ? [
          line('Status: inactive'),
          line(
            `Default: ${firewall.defaultIn === 'allow' ? 'allow' : firewall.defaultIn === 'reject' ? 'reject' : 'deny'} (incoming), allow (outgoing), disabled (routed)`,
          ),
        ]
      : [line('Status: inactive', 'symptom')]
  }
  const pad = (text: string, width: number): string => text.padEnd(width, ' ')
  return [
    line('Status: active'),
    ...(mode === 'verbose'
      ? [
          line(
            `Default: ${firewall.defaultIn === 'allow' ? 'allow' : firewall.defaultIn === 'reject' ? 'reject' : 'deny'} (incoming), allow (outgoing), disabled (routed)`,
          ),
        ]
      : []),
    line(''),
    line(
      `${mode === 'numbered' ? '     ' : ''}${pad('To', 27)}${pad('Action', 12)}From`,
    ),
    line(
      `${mode === 'numbered' ? '     ' : ''}${pad('--', 27)}${pad('------', 12)}----`,
    ),
    ...Array.map(firewall.rules, (rule, index) => {
      const [to, action, from] = ruleText(rule)
      return line(
        `${mode === 'numbered' ? `[${String(index + 1).padStart(2, ' ')}] ` : ''}${pad(to, 27)}${pad(action, 12)}${from}`,
      )
    }),
  ]
}

const ufwAction = (word: string): Option.Option<FirewallAction> =>
  word === 'allow'
    ? Option.some<FirewallAction>('allow')
    : word === 'deny'
      ? Option.some<FirewallAction>('drop')
      : word === 'reject'
        ? Option.some<FirewallAction>('reject')
        : Option.none()

const protoOfText = (text: string | undefined): FirewallProto =>
  text === 'udp' ? 'udp' : text === 'tcp' ? 'tcp' : 'any'

/** `allow 22/tcp`, `allow 80`, `allow from 203.0.113.7 to any port 22 proto tcp`. */
const parseUfwRule = (
  action: FirewallAction,
  words: ReadonlyArray<string>,
): Option.Option<FirewallRule> => {
  const [first] = words
  if (first === undefined) {
    return Option.none()
  }
  if (first === 'from') {
    const from = Array.get(words, 1)
    const portIndex = Array.findFirstIndex(words, word => word === 'port')
    const protoIndex = Array.findFirstIndex(words, word => word === 'proto')
    const port = pipe(
      portIndex,
      Option.flatMap(index => Array.get(words, index + 1)),
      Option.map(value => globalThis.Number(value)),
    )
    const proto = pipe(
      protoIndex,
      Option.flatMap(index => Array.get(words, index + 1)),
      Option.filter(value => value === 'tcp' || value === 'udp'),
    )
    return Option.flatMap(from, source =>
      source === 'any' || isIp(source) || isCidr(source)
        ? Option.some({
            direction: 'in',
            action,
            proto: Option.match(proto, {
              onNone: (): FirewallProto => 'any',
              onSome: (value): FirewallProto =>
                value === 'udp' ? 'udp' : 'tcp',
            }),
            maybePort: Option.filter(port, value =>
              globalThis.Number.isInteger(value),
            ),
            maybeFrom:
              source === 'any'
                ? Option.none()
                : Option.some(source.includes('/') ? source : `${source}/32`),
          })
        : Option.none(),
    )
  }
  const [portText = '', protoText] = first.split('/')
  const port = globalThis.Number(portText)
  return globalThis.Number.isInteger(port) &&
    port > 0 &&
    port < 65536 &&
    (protoText === undefined || protoText === 'tcp' || protoText === 'udp')
    ? Option.some({
        direction: 'in',
        action,
        proto: protoOfText(protoText),
        maybePort: Option.some(port),
        maybeFrom: Option.none(),
      })
    : Option.none()
}

const ufw = (host: Host, args: ReadonlyArray<string>): CommandResult => {
  const current = host.firewall
  const set = (
    firewall: Firewall,
    lines: ReadonlyArray<TerminalLine>,
  ): CommandResult =>
    result('ufw', lines, {
      ops: [NetOp.SetFirewall({ device: host.id, firewall })],
    })
  const invalid = result('ufw', [line('ERROR: Invalid syntax', 'symptom')], {
    maybeHint: Option.some(
      NetMessage.CommandUsage({
        command: 'ufw',
        usage:
          'allow, deny, reject, delete, insert, default, enable, disable, status',
      }),
    ),
  })
  const [verb = '', ...rest] = args
  if (verb === 'status') {
    const mode =
      rest[0] === 'verbose'
        ? 'verbose'
        : rest[0] === 'numbered'
          ? 'numbered'
          : 'plain'
    return result('ufw', ufwStatus(current, mode))
  }
  if (verb === 'enable') {
    return set({ ...current, enabled: true }, [
      line(
        'Command may disrupt existing ssh connections. Proceed with operation (y|n)? y',
      ),
      line('Firewall is active and enabled on system startup'),
    ])
  }
  if (verb === 'disable') {
    return set({ ...current, enabled: false }, [
      line('Firewall stopped and disabled on system startup'),
    ])
  }
  if (verb === 'default') {
    const action = Option.flatMap(Array.head(rest), ufwAction)
    const direction =
      rest[1] === 'outgoing' ? 'out' : rest[1] === 'incoming' ? 'in' : ''
    return Option.match(action, {
      onNone: () => invalid,
      onSome: value =>
        direction === ''
          ? invalid
          : set(
              direction === 'in'
                ? { ...current, defaultIn: value }
                : { ...current, defaultOut: value },
              [
                line(
                  `Default ${direction === 'in' ? 'incoming' : 'outgoing'} policy changed to '${rest[0] ?? ''}'`,
                ),
                line('(be sure to update your rules accordingly)'),
              ],
            ),
    })
  }
  if (verb === 'delete') {
    const index = globalThis.Number(rest[0])
    return globalThis.Number.isInteger(index) &&
      index >= 1 &&
      index <= current.rules.length
      ? set(
          {
            ...current,
            rules: Array.filter(current.rules, (_, at) => at !== index - 1),
          },
          [line('Rule deleted')],
        )
      : invalid
  }
  if (verb === 'insert') {
    const index = globalThis.Number(rest[0])
    const parsed = Option.flatMap(
      Option.flatMap(Array.get(rest, 1), ufwAction),
      action => parseUfwRule(action, Array.drop(rest, 2)),
    )
    return globalThis.Number.isInteger(index) &&
      index >= 1 &&
      Option.isSome(parsed)
      ? set(
          {
            ...current,
            rules: [
              ...Array.take(current.rules, index - 1),
              parsed.value,
              ...Array.drop(current.rules, index - 1),
            ],
          },
          [line('Rule inserted')],
        )
      : invalid
  }
  return Option.match(
    Option.flatMap(ufwAction(verb), action => parseUfwRule(action, rest)),
    {
      onNone: () => invalid,
      onSome: parsed =>
        set({ ...current, rules: [...current.rules, parsed] }, [
          line('Rules updated'),
        ]),
    },
  )
}

// DOCKER

const containerId = (id: string): string =>
  pipe(
    Array.range(0, 11),
    Array.map(index =>
      ((id.charCodeAt(index % id.length) * (index + 7)) % 16).toString(16),
    ),
    Array.join(''),
  )

const containersOf = (doc: NetDoc, host: Host): ReadonlyArray<Host> =>
  Array.filter(
    doc.devices,
    (device): device is Host =>
      device._tag === 'Host' &&
      Option.exists(
        device.maybeContainer,
        container => container.host === host.id,
      ),
  )

const projectOf = (host: Host): string =>
  Option.getOrElse(
    Option.map(host.maybeDocker, bridge =>
      bridge.network.replace(/_default$/, ''),
    ),
    () => 'app',
  )

const isUp = (doc: NetDoc, state: NetState, container: Host): boolean =>
  Option.match(
    Option.flatMap(container.maybeContainer, info => info.maybeNeeds),
    {
      onNone: () => true,
      onSome: needs =>
        trace(
          doc,
          state,
          Intent.Connect({
            from: container.id,
            host: needs.host,
            port: needs.port,
          }),
        )[0].outcome._tag === 'Delivered',
    },
  )

const dockerPs = (doc: NetDoc, state: NetState, host: Host): CommandResult => {
  const project = projectOf(host)
  const rows = Array.map(containersOf(doc, host), container => {
    const image = Option.getOrElse(
      Option.map(container.maybeContainer, info => info.image),
      () => '',
    )
    const ports = pipe(
      container.listeners,
      Array.map(listener => {
        const published = Array.findFirst(
          host.publishes,
          publish =>
            publish.container === container.id &&
            publish.containerPort === listener.port,
        )
        return Option.match(published, {
          onNone: () => `${listener.port}/tcp`,
          onSome: publish =>
            `${publish.bind}:${publish.hostPort}->${listener.port}/tcp`,
        })
      }),
      Array.join(', '),
    )
    const up = isUp(doc, state, container)
    return line(
      `${containerId(container.id)}   ${image.padEnd(13, ' ')} ${(up ? 'Up 3 seconds' : 'Restarting (1) 4 seconds ago').padEnd(30, ' ')} ${ports.padEnd(24, ' ')} ${project}-${container.id}-1`,
      up ? 'ok' : 'symptom',
    )
  })
  return result('docker', [
    line(
      'CONTAINER ID   IMAGE         STATUS                         PORTS                    NAMES',
    ),
    ...rows,
  ])
}

const dockerLogs = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  name: string,
): CommandResult =>
  Option.match(
    Array.findFirst(
      containersOf(doc, host),
      container => container.id === name,
    ),
    {
      onNone: () =>
        result('docker', [line(`no such service: ${name}`, 'symptom')]),
      onSome: container => {
        const port = Option.getOrElse(
          Option.map(
            Array.head(container.listeners),
            listener => listener.port,
          ),
          () => 0,
        )
        const tag = `${container.id}-1  | `
        return Option.match(
          Option.flatMap(container.maybeContainer, info => info.maybeNeeds),
          {
            onNone: () =>
              result('docker', [
                line(`${tag}Listening on 0.0.0.0:${port}`, 'ok'),
              ]),
            onSome: needs => {
              const up = isUp(doc, state, container)
              const ip = isIp(needs.host)
                ? needs.host
                : needs.host === 'localhost'
                  ? '127.0.0.1'
                  : needs.host
              return result(
                'docker',
                [
                  line(`${tag}Starting on 0.0.0.0:${port}`),
                  line(`${tag}Connecting to ${needs.host}:${needs.port}...`),
                  ...(up
                    ? [line(`${tag}Connected.`, 'ok')]
                    : [
                        line(
                          `${tag}Error: connect ECONNREFUSED ${ip}:${needs.port}`,
                          'refused',
                        ),
                        line(`${container.id}-1 exited with code 1`, 'symptom'),
                      ]),
                ],
                { saw: up ? ['connected'] : [] },
              )
            },
          },
        )
      },
    },
  )

const dockerRun = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  args: ReadonlyArray<string>,
): CommandResult => {
  const bridge = host.maybeDocker
  if (Option.isNone(bridge)) {
    return result('docker', [
      line(
        'docker: Cannot connect to the Docker daemon. Is the docker daemon running?',
        'symptom',
      ),
    ])
  }
  type Parsed = Readonly<{
    ports: ReadonlyArray<string>
    name: Option.Option<string>
    image: Option.Option<string>
    skip: boolean
  }>
  const parsed = Array.reduce(
    args,
    { ports: [], name: Option.none(), image: Option.none(), skip: false },
    (current: Parsed, arg, index): Parsed => {
      if (current.skip) {
        return { ...current, skip: false }
      }
      const next = Array.get(args, index + 1)
      if (arg === '-p' || arg === '--publish') {
        return {
          ...current,
          ports: [...current.ports, ...Option.toArray(next)],
          skip: true,
        }
      }
      if (arg === '--name') {
        return { ...current, name: next, skip: true }
      }
      if (arg.startsWith('-')) {
        return current
      }
      return Option.isNone(current.image)
        ? { ...current, image: Option.some(arg) }
        : current
    },
  )
  return Option.match(parsed.image, {
    onNone: () =>
      usage(
        'docker',
        'docker run [-d] [-p host:container] [--name name] image',
      ),
    onSome: image => {
      const imagePorts: Readonly<Record<string, number>> = {
        nginx: 80,
        postgres: 5432,
        redis: 6379,
        httpd: 80,
        node: 3000,
      }
      const port = imagePorts[image.split(':')[0] ?? ''] ?? 80
      const id = Option.getOrElse(
        parsed.name,
        () => image.split(':')[0] ?? 'app',
      )
      const taken = Array.flatMap(containersOf(doc, host), container =>
        Option.toArray(
          Option.map(hostIface(doc, state, container), iface => iface.ip),
        ),
      )
      const ip = pipe(
        Array.range(2, 250),
        Array.map(offset => {
          const parts = bridge.value.ip.split('.')
          return `${parts[0] ?? '172'}.${parts[1] ?? '17'}.0.${offset}`
        }),
        Array.findFirst(
          candidate =>
            candidate !== bridge.value.ip && !Array.contains(taken, candidate),
        ),
        Option.getOrElse(() => bridge.value.ip),
      )
      const mappings = Array.map(parsed.ports, value => parseMapping(value))
      if (Array.some(mappings, Option.isNone)) {
        return hint(
          'docker',
          NetMessage.InvalidPortMapping({ value: parsed.ports.join(' ') }),
        )
      }
      const device = {
        id,
        dockerHost: host.id,
        ip,
        prefix: bridge.value.prefix,
        gateway: bridge.value.ip,
        image,
        port,
      }
      return result('docker', [line(containerId(id) + '0'.repeat(52))], {
        ops: [
          NetOp.AddDevice({
            device: {
              ...hostTemplate(device),
            },
          }),
          NetOp.Connect({ a: host.id, b: id, medium: 'virtual' }),
          ...Array.flatMap(mappings, mapping =>
            Option.toArray(
              Option.map(mapping, value =>
                NetOp.Publish({
                  device: host.id,
                  proto: 'tcp',
                  bind: value.bind,
                  hostPort: value.hostPort,
                  container: id,
                  containerPort: value.port,
                }),
              ),
            ),
          ),
        ],
      })
    },
  })
}

const hostTemplate = (
  spec: Readonly<{
    id: string
    dockerHost: DeviceId
    ip: string
    prefix: number
    gateway: string
    image: string
    port: number
  }>,
): Host => ({
  ...emptyHostFields,
  id: spec.id,
  x: 0,
  y: 0,
  mac: macFromId(`${spec.dockerHost}/${spec.id}`),
  addressing: Addressing.Static({
    ip: spec.ip,
    prefix: spec.prefix,
    maybeGateway: Option.some(spec.gateway),
    maybeDns: Option.none(),
  }),
  listeners: [{ proto: 'tcp', bind: '0.0.0.0', port: spec.port }],
  maybeContainer: Option.some({
    host: spec.dockerHost,
    network: 'bridge',
    image: spec.image,
    maybeNeeds: Option.none(),
  }),
})

const docker = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  args: ReadonlyArray<string>,
): CommandResult => {
  const [verb = '', ...rest] = args
  if (verb === 'ps') {
    return dockerPs(doc, state, host)
  }
  if (verb === 'run') {
    return dockerRun(doc, state, host, rest)
  }
  if (verb === 'compose') {
    const [sub = '', ...more] = rest
    if (sub === 'ps') {
      return dockerPs(doc, state, host)
    }
    if (sub === 'logs') {
      return Option.match(
        Array.findFirst(more, arg => !arg.startsWith('-')),
        {
          onNone: () => usage('docker', 'docker compose logs service'),
          onSome: name => dockerLogs(doc, state, host, name),
        },
      )
    }
    if (sub === 'up') {
      const services = Option.match(host.maybeCompose, {
        onNone: () => [],
        onSome: file => file.services,
      })
      if (Option.isNone(host.maybeCompose)) {
        return result('docker', [
          line('no configuration file provided: not found', 'symptom'),
        ])
      }
      return result(
        'docker',
        [
          line(`[+] Running ${services.length}/${services.length}`),
          ...Array.map(services, current =>
            line(
              ` ✔ Container ${projectOf(host)}-${current.name}-1  Recreated`,
            ),
          ),
        ],
        { ops: [NetOp.ComposeUp({ device: host.id })] },
      )
    }
    return usage('docker', 'docker compose up -d | ps | logs service')
  }
  return usage('docker', 'docker run | ps | compose up -d')
}

// TUNNEL AND CERTBOT

const TUNNEL_NAME = 'quiet-river-42'

const tunnel = (
  doc: NetDoc,
  host: Host,
  args: ReadonlyArray<string>,
): CommandResult => {
  const port = globalThis.Number(args[1])
  if (
    args[0] !== 'http' ||
    !globalThis.Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    return usage('tunnel', 'tunnel http <port>')
  }
  const relay = Array.findFirst(
    doc.devices,
    (device): device is Host =>
      device._tag === 'Host' && Option.isSome(device.maybeRelayDomain),
  )
  return Option.match(relay, {
    onNone: () =>
      result('tunnel', [line('tunnel: cannot reach the relay', 'symptom')], {
        maybeHint: Option.some(NetMessage.NoRelay()),
      }),
    onSome: found => {
      const name = Option.getOrElse(
        Option.map(host.maybeTunnel, current => current.name),
        () => TUNNEL_NAME,
      )
      const url = `https://${name}.${Option.getOrElse(found.maybeRelayDomain, () => '')}`
      return result(
        'tunnel',
        [
          line('Tunnel started', 'ok'),
          line(`Forwarding  ${url} -> http://localhost:${port}`),
        ],
        {
          ops: [
            NetOp.SetTunnel({
              device: host.id,
              maybeTunnel: Option.some({ relay: found.id, name, port }),
            }),
          ],
          running: true,
          saw: [url],
        },
      )
    },
  })
}

const certbot = (
  doc: NetDoc,
  state: NetState,
  host: Host,
  args: ReadonlyArray<string>,
): CommandResult => {
  const names = Array.flatMap(args, (arg, index) =>
    arg === '-d' ? Option.toArray(Array.get(args, index + 1)) : [],
  )
  if (Array.isReadonlyArrayEmpty(names)) {
    return usage('certbot', 'certbot --nginx -d name [-d name]')
  }
  const ops = [NetOp.IssueCertificate({ device: host.id, names })]
  return Result.match(issueCertificate(doc, state, host.id, names), {
    onSuccess: issued =>
      result(
        'certbot',
        [
          line('Successfully received certificate.', 'ok'),
          line(
            `Certificate is saved at: /etc/letsencrypt/live/${names[0] ?? ''}/fullchain.pem`,
          ),
          line(`This certificate expires on ${issued.cert.notAfter}.`),
        ],
        { ops, traces: issued.traces, saw: names },
      ),
    onFailure: failure =>
      result(
        'certbot',
        [
          line(
            'Certbot failed to authenticate some domains (authenticator: nginx).',
            'certProblem',
          ),
          ...(failure._tag === 'AcmeChallengeFailed'
            ? [
                line(`  Domain: ${failure.name}`),
                line(
                  `  Detail: ${
                    failure.problem === 'not-found'
                      ? `DNS problem: NXDOMAIN looking up A for ${failure.name}`
                      : `${Option.getOrElse(failure.maybeIp, () => '')}: Fetching http://${failure.name}/.well-known/acme-challenge/...: ${
                          failure.problem === 'refused'
                            ? 'Connection refused'
                            : failure.problem === 'timeout'
                              ? 'Timeout during connect (likely firewall problem)'
                              : 'Invalid response: 404'
                        }`
                  }`,
                  'symptom',
                ),
              ]
            : []),
        ],
        { ops: [], maybeHint: Option.some(failure) },
      ),
  })
}

// RUN

/** Строка терминала на устройстве: вывод, подсказка, операции действия и
    трассы для анимации. `available` — открытые уроками команды и детали
    вывода (`ping.ttl`, `ip.mac`). Незнакомая или закрытая команда — только
    подсказка-код. */
export const runCommand = (
  doc: NetDoc,
  rawState: NetState,
  device: DeviceId,
  rawLine: string,
  available: ReadonlyArray<TerminalFeature> = allFeatures,
): CommandResult => {
  const words = Array.filter(rawLine.trim().split(/\s+/), word => word !== '')
  const withoutSudo = words[0] === 'sudo' ? Array.drop(words, 1) : words
  const [program = '', ...args] = withoutSudo
  if (program === '' || program === 'clear' || program === 'exit') {
    return result(program, [])
  }
  if (program === 'Ctrl+C' || program === '^C') {
    return result('^C', [line('^C')], {
      ops: Option.match(findHost(doc, device), {
        onNone: () => [],
        onSome: host =>
          Array.some(host.listeners, listener => listener.port === DEV_PORT)
            ? [NetOp.StopListening({ device, proto: 'tcp', port: DEV_PORT })]
            : [],
      }),
    })
  }
  const forms = availableForms(available)
  const feature = programs[program]
  if (feature === undefined) {
    return hint(
      program,
      NetMessage.UnknownCommand({ command: program, available: forms }),
    )
  }
  const routeCommand =
    (program === 'ip' && (args[0] === 'route' || args[0] === 'r')) ||
    program === 'route'
  const needed: TerminalFeature = routeCommand ? 'ip.route' : feature
  if (!Array.contains(available, needed)) {
    return hint(
      program,
      NetMessage.CommandLocked({ command: program, available: forms }),
    )
  }
  return Option.match(findHost(doc, device), {
    onNone: () => hint(program, NetMessage.NotAHost({ id: device })),
    onSome: host => {
      const state = settle(doc, rawState)
      if (routeCommand) {
        return ipRoute(doc, state, host)
      }
      const handlers: Readonly<Record<TerminalFeature, () => CommandResult>> = {
        ip: () => ipAddr(doc, state, host, Array.contains(available, 'ip.mac')),
        'ip.route': () => ipRoute(doc, state, host),
        'ip.mac': () => ipAddr(doc, state, host, true),
        ping: () =>
          ping(doc, state, host, args, Array.contains(available, 'ping.ttl')),
        'ping.ttl': () => ping(doc, state, host, args, true),
        arp: () => arpTable(state, host),
        npm: () => npmRunDev(doc, state, host, args),
        traceroute: () => traceroute(doc, state, host, args),
        nslookup: () => nslookup(doc, state, host, args),
        dig: () => dig(doc, state, host, args),
        curl: () => curl(doc, state, host, args),
        ss: () => ss(host),
        nc: () => nc(doc, state, host, args),
        docker: () => docker(doc, state, host, args),
        ufw: () => ufw(host, args),
        tunnel: () => tunnel(doc, host, args),
        certbot: () => certbot(doc, state, host, args),
      }
      return handlers[feature]()
    },
  })
}

/** Строка входа по ssh: адрес, каким сервер видит ученика (после NAT). */
export const loginBanner = (
  doc: NetDoc,
  state: NetState,
  server: DeviceId,
  from: DeviceId,
): Option.Option<string> =>
  Option.flatMap(findHost(doc, server), target =>
    Option.flatMap(hostIface(doc, settle(doc, state), target), iface => {
      const [connected] = trace(
        doc,
        settle(doc, state),
        Intent.Connect({ from, host: iface.ip, port: 22 }),
      )
      return connected.outcome._tag === 'Delivered' &&
        connected.outcome.answer._tag === 'Connected'
        ? Option.some(
            `Last login: Thu Oct 29 21:14:03 2026 from ${connected.outcome.answer.seenFrom}`,
          )
        : Option.none()
    }),
  )
