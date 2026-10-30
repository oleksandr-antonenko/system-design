import { Option } from 'effect'

import { type BoardDoc, BoardOp } from '../../domain/board'
import type { ComponentKind, Region } from '../../domain/catalog'
import type { SimResult } from '../../domain/simulate'
import type { Tone } from '../contract'

export { flow } from './kind'

// Язык уроков System Design: операции доски потоков и сцена шага.

// STAGE

export type Target = string | Readonly<{ kind: ComponentKind }>

export type Highlight = Readonly<{
  _tag: 'Highlight'
  target: Target
  tone: Tone
}>

export type Annotate<Key extends string = string> = Readonly<{
  _tag: 'Annotate'
  target: Target
  key: Key
  tone: Tone | ((sim: SimResult) => Tone)
}>

export type FlowStage = Highlight | Annotate

export const highlight = (target: Target, tone: Tone): Highlight => ({
  _tag: 'Highlight',
  target,
  tone,
})

export const annotate = <const Key extends string>(
  target: Target,
  key: Key,
  tone: Tone | ((sim: SimResult) => Tone),
): Annotate<Key> => ({ _tag: 'Annotate', target, key, tone })

/** Что получает функция-текст шага: установившаяся симуляция и доска. */
export type StepContext = Readonly<{ sim: SimResult; doc: BoardDoc }>

// OPERATIONS

export type NodeOptions = Readonly<{
  /** Блок задачи нельзя удалить. По умолчанию `true`; решение задачи
      добавляет блоки с `locked: false`. */
  locked?: boolean
  /** Своя ёмкость в rps вместо каталожной, например лимит ограничителя. */
  capacity?: number
  /** Регион блока: доска рисует под блоками региона подписанную зону. */
  region?: Region
}>

export const addNode = (
  id: string,
  kind: ComponentKind,
  x: number,
  y: number,
  options: NodeOptions = {},
): BoardOp =>
  BoardOp.AddNode({
    id,
    kind,
    x,
    y,
    locked: options.locked ?? true,
    maybeCapacity: Option.fromNullishOr(options.capacity),
    maybeRegion: Option.fromNullishOr(options.region),
  })

export const connect = (from: string, to: string): BoardOp =>
  BoardOp.Connect({ from, to })

export const disconnect = (from: string, to: string): BoardOp =>
  BoardOp.Disconnect({ from, to })

export const setLoad = (rps: number): BoardOp => BoardOp.SetLoad({ rps })

export const failNode = (id: string): BoardOp => BoardOp.FailNode({ id })

export const recoverNode = (id: string): BoardOp => BoardOp.RecoverNode({ id })

/** Роняет все блоки региона, кроме пользователей. */
export const failRegion = (region: Region): BoardOp =>
  BoardOp.FailRegion({ region })

export const recoverRegion = (region: Region): BoardOp =>
  BoardOp.RecoverRegion({ region })

/** Вес группы пользователей в общей нагрузке. По умолчанию у каждой группы
    вес 1, и нагрузка делится поровну; `setShare('users-us', 3)` рядом с
    `users-eu` (вес 1) отдаёт американской группе три четверти нагрузки. Цели
    с `load` масштабируют все группы пропорционально. */
export const setShare = (id: string, share: number): BoardOp =>
  BoardOp.SetShare({ id, share })

/** Начать с пустой доски. Шаг поэтапного урока строит общую эталонную схему
    заново: `ops: [reset(), ...reference, ...twist]`. Нагрузку и доли групп
    эталон задаёт сам. Вернувшись на прежний шаг, ученик снова видит свою
    схему. */
export const reset = (): BoardOp => BoardOp.Reset()
