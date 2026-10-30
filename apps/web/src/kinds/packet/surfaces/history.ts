import { Array, Option, Result, Schema } from 'effect'

import { NetOp } from '../../../net/doc'
import type { DeviceId, Host } from '../../../net/model'
import { type World, applyWorld, emptyWorld } from '../../../net/world'
import type { EntityLabel } from '../../contract'

// Поверхности устройств ничего не запоминают о сети сами: вывод терминала и
// открытая страница восстанавливаются из операций, которыми свёрнута доска
// (`SurfaceContext.history`). Поэтому отмена, повтор, сброс и «Показать
// решение» показывают на поверхности ровно то, что лежит в журнале.

/** Операция истории и мир до неё. Отказанная операция пропускается, как
    при свёртке доски. */
export type Moment = Readonly<{ before: World; op: NetOp; after: World }>

export const momentsOf = (
  history: ReadonlyArray<NetOp>,
): ReadonlyArray<Moment> =>
  Array.reduce(
    history,
    { world: emptyWorld, moments: Array.empty<Moment>() },
    (current, op) =>
      Result.match(applyWorld(current.world, op), {
        onFailure: () => current,
        onSuccess: after => ({
          world: after,
          moments: [...current.moments, { before: current.world, op, after }],
        }),
      }),
  ).moments

export const sameOp = Schema.toEquivalence(NetOp)

/** Ходы эталона, которых ещё нет в журнале задачи: их обводит призрак. */
export const ghostOps = (
  maybeGhost: Option.Option<ReadonlyArray<NetOp>>,
  journal: ReadonlyArray<NetOp>,
): ReadonlyArray<NetOp> =>
  Option.match(maybeGhost, {
    onNone: () => [],
    onSome: solution =>
      Array.filter(
        solution,
        op => !Array.some(journal, done => sameOp(done, op)),
      ),
  })

/** Подпись устройства из текстов урока, иначе его id. */
export const nameOf = (
  label: (id: string) => Option.Option<EntityLabel>,
  id: DeviceId,
): string =>
  Option.match(label(id), {
    onNone: () => id,
    onSome: found => found.name,
  })

/** Компьютер ученика: с него он заходит на сервер по ssh. */
export const homeComputer = (
  hosts: ReadonlyArray<Host>,
  except: DeviceId,
): Option.Option<Host> =>
  Option.orElse(
    Array.findFirst(hosts, host => host.id === 'laptop' && host.id !== except),
    () =>
      Array.findFirst(
        hosts,
        host =>
          host.id !== except && (host.kind === 'laptop' || host.kind === 'pc'),
      ),
  )
