import { Array, Option, Order, Record, Schema } from 'effect'

import { isIp } from './address'
import {
  type CommandRecord,
  type Evidence,
  type Fault,
  type ReportRecord,
} from './model'

// Диагностика снизу вверх (урок 15). Каждая команда терминала проверяет
// ступеньку лесенки: адрес, шлюз, DNS, порт, приложение, — и по меткам строк
// своего вывода (`LineTag`) говорит, прошла проверка или нет. Отчёт для
// ИИ-ассистента — диагноз (ступенька поломки) и строки вывода, которые его
// доказывают.

// RUNGS

export const Rung = Schema.Literals([
  'address',
  'gateway',
  'dns',
  'port',
  'app',
])
export type Rung = typeof Rung.Type

/** Ступеньки снизу вверх. */
export const rungs: ReadonlyArray<Rung> = Rung.literals

const height = (rung: Rung): number => rungs.indexOf(rung)

/** Ступенька, на которой случается поломка. */
export const rungOfFault: Readonly<Record<Fault, Rung>> = {
  link: 'address',
  gateway: 'gateway',
  dns: 'dns',
  firewall: 'port',
  loopback: 'port',
  cert: 'app',
}

/** Что показала проверка: прошла, не прошла или только посмотрели. */
export type Verdict = 'ok' | 'bad' | 'seen'

export type Check = Readonly<{ rung: Rung; verdict: Verdict }>

const check = (rung: Rung, verdict: Verdict): Check => ({ rung, verdict })

const argsOf = (line: string): ReadonlyArray<string> => {
  const words = Array.filter(line.trim().split(/\s+/), word => word !== '')
  return Array.drop(words, words[0] === 'sudo' ? 2 : 1)
}

const positional = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  Array.filter(args, arg => !arg.startsWith('-') && !arg.startsWith('+'))

/** Цель — имя: значит, команда сначала спросила DNS. */
const byName = (record: CommandRecord): boolean =>
  Option.exists(record.maybeTarget, target => !isIp(target))

const has = (record: CommandRecord, tag: string): boolean =>
  Array.contains(record.tags, tag)

const hasAny = (record: CommandRecord, tags: ReadonlyArray<string>): boolean =>
  Array.some(tags, tag => has(record, tag))

/** Имя превратилось в адрес: перед ступенькой выше DNS цел. */
const resolved = (record: CommandRecord): ReadonlyArray<Check> =>
  byName(record) ? [check('dns', 'ok')] : []

const pingChecks = (record: CommandRecord): ReadonlyArray<Check> =>
  has(record, 'dnsFailed')
    ? [check(byName(record) ? 'dns' : 'address', 'bad')]
    : has(record, 'ok')
      ? [check(byName(record) ? 'dns' : 'gateway', 'ok')]
      : hasAny(record, ['gatewayUnreachable', 'timeout'])
        ? [...resolved(record), check('gateway', 'bad')]
        : [check('address', 'bad')]

const dnsChecks = (record: CommandRecord): ReadonlyArray<Check> => {
  const args = argsOf(record.line)
  const askedServer =
    record.program === 'dig'
      ? Array.some(args, arg => arg.startsWith('@'))
      : positional(args).length > 1
  return askedServer
    ? [check('dns', 'seen')]
    : has(record, 'ok')
      ? [check('dns', 'ok')]
      : hasAny(record, ['dnsTimeout', 'dnsFailed'])
        ? [check('dns', 'bad')]
        : [check('dns', 'seen')]
}

const portChecks = (record: CommandRecord): ReadonlyArray<Check> =>
  has(record, 'dnsFailed')
    ? [check('dns', 'bad')]
    : has(record, 'certProblem')
      ? [check('port', 'ok'), check('app', 'bad')]
      : hasAny(record, ['timeout', 'refused', 'loopbackOnly'])
        ? [...resolved(record), check('port', 'bad')]
        : has(record, 'symptom')
          ? [check('port', 'ok'), check('app', 'bad')]
          : has(record, 'ok')
            ? [check(record.program === 'curl' ? 'app' : 'port', 'ok')]
            : []

/** Какие ступеньки проверила команда и с каким итогом. */
export const checksOf = (record: CommandRecord): ReadonlyArray<Check> => {
  const args = argsOf(record.line)
  const program = record.program
  if (program === 'ip') {
    const isRoute =
      record.line.trim().startsWith('route') ||
      args[0] === 'route' ||
      args[0] === 'r'
    return isRoute
      ? [check('gateway', has(record, 'wrongGateway') ? 'bad' : 'ok')]
      : [
          check(
            'address',
            Array.isReadonlyArrayEmpty(record.saw) ? 'bad' : 'ok',
          ),
        ]
  }
  if (program === 'ping' || program === 'traceroute') {
    return pingChecks(record)
  }
  if (program === 'arp') {
    return [check('gateway', 'seen')]
  }
  if (program === 'nslookup' || program === 'dig') {
    return dnsChecks(record)
  }
  if (program === 'nc' || program === 'curl') {
    return portChecks(record)
  }
  if (program === 'ss' || program === 'ufw') {
    return [check('port', 'seen')]
  }
  return []
}

// LADDER

/** Ступенька на лесенке: ещё не проверяли, посмотрели, цела, сломана. */
export type RungState = 'idle' | 'seen' | 'ok' | 'bad'

/** Ступенька и команда, которая её так зажгла. */
export type RungLight = Readonly<{
  state: RungState
  maybeCommand: Option.Option<string>
}>

export type Ladder = Readonly<Record<Rung, RungLight>>

const unlit: RungLight = { state: 'idle', maybeCommand: Option.none() }

export const emptyLadder: Ladder = {
  address: unlit,
  gateway: unlit,
  dns: unlit,
  port: unlit,
  app: unlit,
}

/** Проверка на лесенке: прошедшая ступенька держит и всё ниже неё, а
    сломанная лишает смысла всё выше — те ступеньки снова не проверены. */
const lightRung =
  (command: string) =>
  (ladder: Ladder, { rung, verdict }: Check): Ladder =>
    Record.map(ladder, (was, current): RungLight => {
      const lit = (state: RungState): RungLight => ({
        state,
        maybeCommand: Option.some(command),
      })
      const isAbove = height(current) > height(rung)
      if (verdict === 'ok') {
        return isAbove
          ? was
          : current === rung || was.state !== 'ok'
            ? lit('ok')
            : was
      }
      if (verdict === 'bad') {
        return current === rung ? lit('bad') : isAbove ? unlit : was
      }
      return current === rung && was.state === 'idle' ? lit('seen') : was
    })

/** Лесенка по журналу команд: каждая команда зажигает свои ступеньки. */
export const ladderOf = (log: ReadonlyArray<CommandRecord>): Ladder =>
  Array.reduce(log, emptyLadder, (ladder, record) =>
    Array.reduce(checksOf(record), ladder, lightRung(record.line.trim())),
  )

// REPORT

/** Ступенька, о которой говорит строка вывода с этой меткой. */
const tagRung: Readonly<Record<string, Rung>> = {
  dnsFailed: 'dns',
  dnsTimeout: 'dns',
  gatewayUnreachable: 'gateway',
  wrongGateway: 'gateway',
  timeout: 'port',
  refused: 'port',
  loopbackOnly: 'port',
  certProblem: 'app',
}

/** Чем строка оказалась для отчёта: доказательством, хорошим ответом,
    симптомом, бедой ступенькой выше поломки или чем-то другим. */
export type EvidenceVerdict = 'accepted' | 'ok' | 'symptom' | 'above' | 'other'

export const evidenceVerdict = (
  evidence: Evidence,
  fault: Fault,
  accepted: ReadonlyArray<string>,
): EvidenceVerdict => {
  if (Array.contains(accepted, evidence.tag)) {
    return 'accepted'
  }
  if (evidence.tag === 'ok') {
    return 'ok'
  }
  if (evidence.tag === 'symptom') {
    return 'symptom'
  }
  const maybeRung = Option.fromNullishOr(tagRung[evidence.tag])
  return Option.match(maybeRung, {
    onNone: () => 'other',
    onSome: rung =>
      rung === rungOfFault[fault]
        ? 'symptom'
        : height(rung) > height(rungOfFault[fault])
          ? 'above'
          : 'other',
  })
}

/** Ступенька, проверка которой отличает выбранный диагноз от верного: та,
    что ниже. Ответ ассистента ссылается на неё, если команда уже была. */
export const decidingRung = (picked: Fault, expected: Fault): Rung =>
  Array.min(
    [rungOfFault[picked], rungOfFault[expected]],
    Order.mapInput(Order.Number, height),
  )

/** Ступеньку уже проверяли: команда дала по ней итог, или прошла проверка
    выше — она держится и на этой ступеньке. */
export const wasChecked = (
  log: ReadonlyArray<CommandRecord>,
  rung: Rung,
): boolean =>
  Array.some(log, record =>
    Array.some(
      checksOf(record),
      current =>
        (current.rung === rung && current.verdict !== 'seen') ||
        (current.verdict === 'ok' && height(current.rung) > height(rung)),
    ),
  )

/** Сравнение ступенек: выбранная ниже настоящей, выше или та же. */
export const faultPlace = (
  picked: Fault,
  expected: Fault,
): 'below' | 'above' | 'same' => {
  const diff = height(rungOfFault[picked]) - height(rungOfFault[expected])
  return diff < 0 ? 'below' : diff > 0 ? 'above' : 'same'
}

export const lastReport = (
  reports: ReadonlyArray<ReportRecord>,
): Option.Option<ReportRecord> => Array.last(reports)
