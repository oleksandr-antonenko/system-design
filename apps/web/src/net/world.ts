import { Array, Option, Result, pipe } from 'effect'

import { issueCertificate } from './acme'
import { normalizeUrl, parseUrl } from './address'
import { NetOp, apply, findHost } from './doc'
import { NetMessage } from './message'
import { type NetDoc, type NetState, emptyNet, emptyState } from './model'
import { type Intent, type Trace, pathOf, sourceOf } from './packet'
import {
  type CommandResult,
  type TerminalFeature,
  allFeatures,
  runCommand,
} from './terminal'
import { settle, trace } from './trace'

/** Мир сети: документ и состояние. Доска на шаге N — свёртка операций шагов
    0..N из пустого мира. */
export type World = Readonly<{ doc: NetDoc; state: NetState }>

export const emptyWorld: World = { doc: emptyNet, state: emptyState }

export type WorldResult = Result.Result<World, NetMessage>

const portOf = (intent: Intent): Option.Option<number> =>
  intent._tag === 'Connect'
    ? Option.some(intent.port)
    : intent._tag === 'Browse' ||
        intent._tag === 'Fetch' ||
        intent._tag === 'Submit' ||
        intent._tag === 'Raw'
      ? Option.map(parseUrl(normalizeUrl(intent.url)), url => url.port)
      : Option.none()

/** Намерение ученика: трасса на «включённой» сети и запись, где оно
    оказалось (для цели `Performed`). */
export const sendIntent = (
  world: World,
  intent: Intent,
): readonly [Trace, World] => {
  const [result, state] = trace(
    world.doc,
    settle(world.doc, world.state),
    intent,
  )
  const at =
    result.outcome._tag === 'Delivered'
      ? Option.some(result.outcome.at)
      : Option.none()
  return [
    result,
    {
      doc: world.doc,
      state: {
        ...state,
        performed: [
          ...state.performed,
          {
            intent: intent._tag,
            from: sourceOf(intent),
            maybeAt: at,
            delivered: result.outcome._tag === 'Delivered',
            maybePort: portOf(intent),
            devices: pathOf(result).devices,
          },
        ],
      },
    },
  ]
}

/** Ближайший момент, когда истечёт строка памяти DNS. */
export const nextExpiry = (
  state: NetState,
  maybeDevice: Option.Option<string> = Option.none(),
): Option.Option<number> =>
  pipe(
    state.dnsCache,
    Array.filter(entry =>
      Option.match(maybeDevice, {
        onNone: () => true,
        onSome: device => entry.device === device,
      }),
    ),
    Array.map(entry => entry.expiresAt),
    Array.filter(at => at > state.clock),
    Array.reduce(Option.none<number>(), (least, at) =>
      Option.exists(least, current => current <= at) ? least : Option.some(at),
    ),
  )

/** Закрепление адреса работает сразу: хост переподключается и получает
    закреплённый адрес. */
const releaseReserved = (
  world: World,
  router: string,
  mac: string,
  ip: string,
): World => {
  const stale = Array.some(
    world.state.leases,
    lease => lease.router === router && lease.mac === mac && lease.ip !== ip,
  )
  const state = stale
    ? {
        ...world.state,
        leases: Array.filter(
          world.state.leases,
          lease => !(lease.router === router && lease.mac === mac),
        ),
      }
    : world.state
  return { doc: world.doc, state: settle(world.doc, state) }
}

const dropSession = (
  state: NetState,
  device: string,
  kind: 'tunnel' | 'mesh',
): NetState => ({
  ...state,
  relaySessions: Array.filter(
    state.relaySessions,
    session => !(session.agent === device && session.kind === kind),
  ),
})

/** Операции, которые применяет команда; запись команды в журнал. */
const runInWorld = (
  world: World,
  device: string,
  line: string,
  available: ReadonlyArray<TerminalFeature>,
): readonly [CommandResult, WorldResult] => {
  const command = runCommand(world.doc, world.state, device, line, available)
  const applied = Array.reduce(
    command.ops,
    Result.succeed(world),
    (current: WorldResult, op) =>
      Result.flatMap(current, next => applyWorld(next, op)),
  )
  return [
    command,
    Result.map(applied, next => ({
      doc: next.doc,
      state:
        Option.isSome(command.maybeHint) &&
        Array.isReadonlyArrayEmpty(command.ops)
          ? next.state
          : {
              ...next.state,
              commandLog: [
                ...next.state.commandLog,
                {
                  device,
                  line,
                  program: command.program,
                  maybeTarget: command.maybeTarget,
                  saw: command.saw,
                  tags: Array.dedupe(
                    Array.map(command.lines, printed => printed.tag),
                  ),
                  path: Array.dedupe(
                    Array.flatMap(
                      command.traces,
                      traced => pathOf(traced).devices,
                    ),
                  ),
                },
              ],
            },
    })),
  ]
}

/** Любая операция над миром: операции документа меняют документ, `Send` —
    состояние трассой, `Wait` двигает часы, `RunCommand` применяет действие
    команды, `IssueCertificate` проверяет имена и ставит сертификат, `Report`
    запоминает отчёт для ИИ, `Reset` начинает с пустого мира. */
export const applyWorld = (world: World, op: NetOp): WorldResult =>
  NetOp.match(op, {
    Send: ({ intent }) => Result.succeed(sendIntent(world, intent)[1]),
    Wait: ({ seconds }) =>
      Result.succeed({
        doc: world.doc,
        state: {
          ...world.state,
          clock: world.state.clock + Math.max(0, seconds),
        },
      }),
    FastForward: ({ maybeDevice }) =>
      Result.succeed({
        doc: world.doc,
        state: {
          ...world.state,
          clock: Option.getOrElse(
            nextExpiry(world.state, maybeDevice),
            () => world.state.clock,
          ),
        },
      }),
    FlushDns: ({ device }) =>
      Result.succeed({
        doc: world.doc,
        state: {
          ...world.state,
          dnsCache: Array.filter(
            world.state.dnsCache,
            entry => entry.device !== device,
          ),
        },
      }),
    RunCommand: ({ device, line }) =>
      runInWorld(world, device, line, allFeatures)[1],
    IssueCertificate: ({ device, names }) =>
      Result.map(
        issueCertificate(world.doc, world.state, device, names),
        issued => ({
          doc: issued.doc,
          state: issued.state,
        }),
      ),
    Report: report =>
      Result.succeed({
        doc: world.doc,
        state: {
          ...world.state,
          reports: [
            ...world.state.reports,
            { fault: report.fault, evidence: report.evidence },
          ],
        },
      }),
    Reset: () => Result.succeed(emptyWorld),
    ReserveAddress: reservation =>
      Result.map(apply(world.doc, op), doc =>
        releaseReserved(
          { doc, state: world.state },
          reservation.router,
          reservation.mac,
          reservation.ip,
        ),
      ),
    SetTunnel: ({ device, maybeTunnel }) =>
      Result.map(apply(world.doc, op), doc => {
        const closed = dropSession(world.state, device, 'tunnel')
        return Option.isSome(maybeTunnel)
          ? { doc, state: settle(doc, closed) }
          : { doc, state: closed }
      }),
    JoinMesh: ({ device }) =>
      Result.map(apply(world.doc, op), doc => ({
        doc,
        state: settle(doc, dropSession(world.state, device, 'mesh')),
      })),
    SetProxy: () => docOnly(world, op),
    SetMesh: ({ device, maybeMesh }) =>
      Result.map(apply(world.doc, op), doc => {
        const closed = dropSession(world.state, device, 'mesh')
        return Option.isSome(maybeMesh)
          ? { doc, state: settle(doc, closed) }
          : { doc, state: closed }
      }),
    AddDevice: () => docOnly(world, op),
    RemoveDevice: () => docOnly(world, op),
    MoveDevice: () => docOnly(world, op),
    Connect: () => docOnly(world, op),
    Disconnect: () => docOnly(world, op),
    SetLinkUp: () => docOnly(world, op),
    AddWall: () => docOnly(world, op),
    RemoveWall: () => docOnly(world, op),
    SetAddressing: () => docOnly(world, op),
    SetDns: () => docOnly(world, op),
    JoinWifi: () => docOnly(world, op),
    ForgetWifi: () => docOnly(world, op),
    ConfigureWifi: () => docOnly(world, op),
    SetLan: () => docOnly(world, op),
    SetDhcpEnabled: () => docOnly(world, op),
    SetDhcpPool: () => docOnly(world, op),
    SetDhcpDns: () => docOnly(world, op),
    RemoveReservation: () => docOnly(world, op),
    AddRoute: () => docOnly(world, op),
    RemoveRoute: () => docOnly(world, op),
    SetTransitRoutes: () => docOnly(world, op),
    SetNat: () => docOnly(world, op),
    Forward: () => docOnly(world, op),
    Unforward: () => docOnly(world, op),
    Listen: () => docOnly(world, op),
    StopListening: () => docOnly(world, op),
    SetRecord: () => docOnly(world, op),
    AddRecord: () => docOnly(world, op),
    RemoveRecord: () => docOnly(world, op),
    SetFirewall: () => docOnly(world, op),
    SetSecurityGroup: () => docOnly(world, op),
    SetCert: () => docOnly(world, op),
    SetRedirect: () => docOnly(world, op),
    SetVpn: () => docOnly(world, op),
    UpdateVpn: () => docOnly(world, op),
    SetDocker: () => docOnly(world, op),
    Publish: () => docOnly(world, op),
    Unpublish: () => docOnly(world, op),
    SetCompose: () => docOnly(world, op),
    ComposeUp: () => docOnly(world, op),
  })

const docOnly = (world: World, op: NetOp): WorldResult =>
  Result.map(apply(world.doc, op), doc => ({ doc, state: world.state }))

/** Свёртка мира: отказанная операция пропускается, как на доске. */
export const foldWorld = (world: World, ops: ReadonlyArray<NetOp>): World =>
  Array.reduce(ops, world, (current, op) =>
    Result.getOrElse(applyWorld(current, op), () => current),
  )

/** Строгая свёртка: первый отказ останавливает её (контент и тесты). */
export const applyAllWorld = (
  world: World,
  ops: ReadonlyArray<NetOp>,
): WorldResult =>
  Array.reduce(ops, Result.succeed(world), (current: WorldResult, op) =>
    Result.flatMap(current, next => applyWorld(next, op)),
  )

export type TranscriptEntry = Readonly<{
  device: string
  line: string
  result: CommandResult
}>

/** Вывод терминала по журналу: каждая `RunCommand` считается на мире до
    неё, поэтому «Показать решение» печатает то же самое. */
export const commandTranscript = (
  world: World,
  ops: ReadonlyArray<NetOp>,
  available: ReadonlyArray<TerminalFeature> = allFeatures,
): ReadonlyArray<TranscriptEntry> =>
  Array.reduce(
    ops,
    { world, entries: [] },
    (
      current: Readonly<{
        world: World
        entries: ReadonlyArray<TranscriptEntry>
      }>,
      op,
    ) => {
      if (op._tag !== 'RunCommand') {
        return {
          world: Result.getOrElse(
            applyWorld(current.world, op),
            () => current.world,
          ),
          entries: current.entries,
        }
      }
      const [command, next] = runInWorld(
        current.world,
        op.device,
        op.line,
        available,
      )
      return {
        world: Result.getOrElse(next, () => current.world),
        entries: [
          ...current.entries,
          { device: op.device, line: op.line, result: command },
        ],
      }
    },
  ).entries

/** Выполнить строку терминала на мире: результат команды и новый мир. */
export const runInTerminal = (
  world: World,
  device: string,
  line: string,
  available: ReadonlyArray<TerminalFeature> = allFeatures,
): readonly [CommandResult, World] => {
  const [command, next] = runInWorld(world, device, line, available)
  return [command, Result.getOrElse(next, () => world)]
}

/** Есть ли такой хост: для терминала на удалённом сервере. */
export const hasHost = (world: World, device: string): boolean =>
  Option.isSome(findHost(world.doc, device))

/** Ученик закрыл себе ssh: до операции сессия проходила, после — нет.
    Терминал показывает обрыв и переключается в консоль хостинга. */
export const sshLockedOut = (
  before: World,
  after: World,
  ssh: Intent,
  server: string,
): Option.Option<NetMessage> => {
  const passes = (world: World): boolean =>
    trace(world.doc, settle(world.doc, world.state), ssh)[0].outcome._tag ===
    'Delivered'
  return passes(before) && !passes(after)
    ? Option.some(NetMessage.SshLockedOut({ device: server }))
    : Option.none()
}
