import { Array, Option, Result } from 'effect'

import { isCidr, isIp } from '../../../../net/address'
import { NetMessage } from '../../../../net/message'
import {
  type Check,
  PanelProblem,
  type Row,
  cellOf,
  cellPath,
  problemAt,
} from './schema'

// Проверка ввода панели до операций: пустое поле, не число, не адрес.
// Тексты — коды модели пакетов (`InvalidIp`, `InvalidPort`…) или свои коды
// панели (`Required`, `NotANumber`).

const failAt = <A>(path: string, problem: PanelProblem): Check<A> =>
  Result.fail([problemAt(path, problem)])

const refused = <A>(path: string, message: NetMessage): Check<A> =>
  failAt(path, PanelProblem.Refused({ message }))

export const text = (path: string, value: string): Check<string> =>
  value.trim() === ''
    ? failAt(path, PanelProblem.Required())
    : Result.succeed(value.trim())

/** Текст как есть: пароль может начинаться с пробела. */
export const rawText = (path: string, value: string): Check<string> =>
  value === '' ? failAt(path, PanelProblem.Required()) : Result.succeed(value)

export const ip = (path: string, value: string): Check<string> =>
  Result.flatMap(text(path, value), trimmed =>
    isIp(trimmed)
      ? Result.succeed(trimmed)
      : refused(path, NetMessage.InvalidIp({ value: trimmed })),
  )

export const cidr = (path: string, value: string): Check<string> =>
  Result.flatMap(text(path, value), trimmed =>
    isCidr(trimmed)
      ? Result.succeed(trimmed)
      : refused(path, NetMessage.InvalidCidr({ value: trimmed })),
  )

const DIGITS = /^\d+$/

export const number = (path: string, value: string): Check<number> =>
  Result.flatMap(text(path, value), trimmed =>
    DIGITS.test(trimmed)
      ? Result.succeed(globalThis.Number(trimmed))
      : failAt(path, PanelProblem.NotANumber({ value: trimmed })),
  )

export const port = (path: string, value: string): Check<number> =>
  Result.flatMap(number(path, value), parsed =>
    parsed >= 1 && parsed <= 65535
      ? Result.succeed(parsed)
      : refused(path, NetMessage.InvalidPort({ value: parsed })),
  )

/** Необязательное поле: пусто — `none`, иначе проверка. */
export const optional = <A>(
  value: string,
  check: (value: string) => Check<A>,
): Check<Option.Option<A>> =>
  value.trim() === ''
    ? Result.succeed(Option.none())
    : Result.map(check(value), Option.some)

/** Проверка ячейки строки списка: путь `<список>/<строка>/<колонка>`. */
export const cell =
  <A>(list: string, row: Row) =>
  (
    column: string,
    check: (path: string, value: string) => Check<A>,
  ): Check<A> =>
    check(cellPath(list, row.id, column), cellOf(row, column))

/** Строки, которых нет в другом списке по ключу (`mac`, `proto:port`). */
export const missingFrom = <A, B>(
  rows: ReadonlyArray<A>,
  others: ReadonlyArray<B>,
  keyOf: (row: A) => string,
  otherKeyOf: (row: B) => string,
): ReadonlyArray<A> =>
  Array.filter(
    rows,
    row => !Array.some(others, other => otherKeyOf(other) === keyOf(row)),
  )
