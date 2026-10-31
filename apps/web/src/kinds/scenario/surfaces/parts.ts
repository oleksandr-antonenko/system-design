import { Array, Option } from 'effect'
import type { Update } from 'foldkit'

import {
  type EntityLabel,
  type SurfaceContext,
  SurfaceOutMessage,
} from '../../contract'
import type { ScenarioTypes } from '../../types'
import { type ScenarioOp, sameOp } from '../doc'

// Общие части экранов вида «сценарий»: имена из подписей урока и призрак
// третьей подсказки.

export const classes = (...names: ReadonlyArray<string | false>): string =>
  Array.filter(names, (name): name is string => name !== false).join(' ')

/** Подпись урока, иначе id. */
export const nameOf = (
  label: (id: string) => Option.Option<EntityLabel>,
  id: string,
): string =>
  Option.match(label(id), {
    onNone: () => id,
    onSome: found => found.name,
  })

/** Пояснение подписи урока, иначе пусто. */
export const noteOf = (
  label: (id: string) => Option.Option<EntityLabel>,
  id: string,
): string =>
  Option.match(label(id), {
    onNone: () => '',
    onSome: found => found.note ?? '',
  })

/** Ход ученика уходит в журнал, только пока задача открыта. */
export const produceOps = <Model, Message>(
  context: SurfaceContext<ScenarioTypes>,
  model: Model,
  ops: ReadonlyArray<ScenarioOp>,
): Update.ReturnWithOutMessage<
  Model,
  Message,
  SurfaceOutMessage<ScenarioOp>
> =>
  context.mode === 'Edit'
    ? { model, outMessage: SurfaceOutMessage.ProducedOps(ops) }
    : { model }

/** Ходы эталона, которых ещё нет в журнале задачи: их обводит призрак. */
export const ghostOps = (
  maybeGhost: Option.Option<ReadonlyArray<ScenarioOp>>,
  journal: ReadonlyArray<ScenarioOp>,
): ReadonlyArray<ScenarioOp> =>
  Option.match(maybeGhost, {
    onNone: () => [],
    onSome: solution =>
      Array.filter(
        solution,
        op => !Array.some(journal, done => sameOp(done, op)),
      ),
  })
