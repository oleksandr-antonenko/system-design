import { Array, Option, pipe } from 'effect'

import { type NetOp, isHost } from '../../../../net/doc'
import type { DeviceId, Host } from '../../../../net/model'
import { Intent } from '../../../../net/packet'
import {
  type CommandResult,
  type TerminalFeature,
  loginBanner,
  runCommand,
} from '../../../../net/terminal'
import { addressOf } from '../../../../net/topology'
import { settle, trace } from '../../../../net/trace'
import type { World } from '../../../../net/world'
import { type Moment, homeComputer } from '../history'

// Вывод терминала — функция истории операций: каждая команда `RunCommand`
// устройства считается на мире до неё. Поэтому «Показать решение» печатает
// то же, что напечатал бы ученик, а отмена стирает строку.

export type Entry =
  | Readonly<{ _tag: 'Command'; line: string; result: CommandResult }>
  /** Вход на сервер по ssh: баннер `Last login: … from …`. */
  | Readonly<{ _tag: 'Login'; maybeBanner: Option.Option<string> }>
  /** Ученик закрыл себе ssh: сессия оборвалась, дальше — консоль хостинга. */
  | Readonly<{ _tag: 'Disconnected' }>

/** Терминал на сервере — сессия ssh с компьютера ученика. */
export type Session = Readonly<{ server: DeviceId; from: DeviceId }>

const hostsOf = (world: World): ReadonlyArray<Host> =>
  Array.filter(world.doc.devices, isHost)

/** Сервер открывают по ssh с компьютера ученика. */
export const sessionOf = (
  world: World,
  device: DeviceId,
): Option.Option<Session> =>
  pipe(
    Array.findFirst(hostsOf(world), host => host.id === device),
    Option.filter(host => host.kind === 'server'),
    Option.flatMap(() => homeComputer(hostsOf(world), device)),
    Option.map(home => ({ server: device, from: home.id })),
  )

/** Проходит ли вход по ssh на этом мире. */
export const sshPasses = (world: World, session: Session): boolean => {
  const state = settle(world.doc, world.state)
  return Option.match(addressOf(world.doc, state, session.server), {
    onNone: () => false,
    onSome: ip =>
      trace(
        world.doc,
        state,
        Intent.Connect({ from: session.from, host: ip, port: 22 }),
      )[0].outcome._tag === 'Delivered',
  })
}

const commandEntry = (
  moment: Moment,
  device: DeviceId,
  available: ReadonlyArray<TerminalFeature>,
): ReadonlyArray<Entry> =>
  moment.op._tag === 'RunCommand' && moment.op.device === device
    ? [
        {
          _tag: 'Command',
          line: moment.op.line,
          result: runCommand(
            moment.before.doc,
            moment.before.state,
            device,
            moment.op.line,
            available,
          ),
        },
      ]
    : []

type Link = 'never' | 'up' | 'down'

type SessionFold = Readonly<{ link: Link; entries: ReadonlyArray<Entry> }>

const login = (world: World, session: Session): Entry => ({
  _tag: 'Login',
  maybeBanner: loginBanner(
    world.doc,
    world.state,
    session.server,
    session.from,
  ),
})

const disconnected: Entry = { _tag: 'Disconnected' }

/** Записи терминала устройства по истории. У сессии ssh — ещё вход, обрыв,
    когда ход ученика закрыл ему вход, и новый вход, когда он снова открыт. */
export const transcriptOf = (
  moments: ReadonlyArray<Moment>,
  device: DeviceId,
  available: ReadonlyArray<TerminalFeature>,
  maybeSession: Option.Option<Session>,
): ReadonlyArray<Entry> =>
  Option.match(maybeSession, {
    onNone: () =>
      Array.flatMap(moments, moment => commandEntry(moment, device, available)),
    onSome: session => {
      const start: SessionFold = { link: 'never', entries: [] }
      return Array.reduce(
        moments,
        start,
        (current: SessionFold, moment): SessionFold => {
          const entries = [
            ...current.entries,
            ...commandEntry(moment, device, available),
          ]
          const passes = sshPasses(moment.after, session)
          return passes && current.link !== 'up'
            ? {
                link: 'up',
                entries: [...entries, login(moment.after, session)],
              }
            : !passes && current.link === 'up'
              ? { link: 'down', entries: [...entries, disconnected] }
              : { link: current.link, entries }
        },
      ).entries
    },
  })

/** Терминал сервера работает через консоль хостинга: ssh не пускает. */
export const isConsole = (
  entries: ReadonlyArray<Entry>,
  maybeSession: Option.Option<Session>,
): boolean =>
  Option.isSome(maybeSession) &&
  !pipe(
    Array.findLast(entries, entry => entry._tag !== 'Command'),
    Option.exists(entry => entry._tag === 'Login'),
  )

/** Программа держит терминал до Ctrl+C (`npm run dev`, `tunnel http`). */
export const isRunning = (entries: ReadonlyArray<Entry>): boolean =>
  pipe(
    Array.findLast(entries, entry => entry._tag === 'Command'),
    Option.exists(entry => entry._tag === 'Command' && entry.result.running),
  )

/** Ctrl+C — не команда: в журнале это строка `Ctrl+C`. */
export const isInterrupt = (line: string): boolean => {
  const trimmed = line.trim()
  return trimmed === 'Ctrl+C' || trimmed === '^C'
}

export const INTERRUPT = 'Ctrl+C'

const normalize = (line: string): string => line.trim().split(/\s+/).join(' ')

const linesOn = (
  ops: ReadonlyArray<NetOp>,
  device: DeviceId,
): ReadonlyArray<string> =>
  Array.getSomes(
    Array.map(ops, op =>
      op._tag === 'RunCommand' && op.device === device
        ? Option.some(normalize(op.line))
        : Option.none(),
    ),
  )

/** Следующая команда эталона для призрака: команды устройства из эталона,
    которых ученик ещё не набрал по порядку. */
export const nextGhostCommand = (
  solution: ReadonlyArray<NetOp>,
  journal: ReadonlyArray<NetOp>,
  device: DeviceId,
): Option.Option<string> => {
  const wanted = linesOn(solution, device)
  const done = Array.reduce(linesOn(journal, device), 0, (matched, line) =>
    Array.get(wanted, matched).pipe(Option.contains(line))
      ? matched + 1
      : matched,
  )
  return Array.get(wanted, done)
}
