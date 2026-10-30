import type { NetOp } from '../../net/doc'
import type { NetState } from '../../net/model'
import { settle } from '../../net/trace'
import { type World, applyWorld, emptyWorld } from '../../net/world'

// Документ вида сетей (design D6) — мир модели пакетов `{ doc, state }`:
// свёртка операций сети, где `Send` оставляет в состоянии след трассы,
// `RunCommand` — действие команды терминала, `Wait` двигает часы. Состояние
// сети (кэши, таблицы, аренды) — итог операций по порядку, поэтому
// «доска = свёртка» сохраняется.

/** Ход урока или ученика — операция модели пакетов. */
export type PacketOp = NetOp

export type PacketDoc = World

export const emptyPacketDoc: PacketDoc = emptyWorld

export const applyPacketOp = applyWorld

/** Расчёт по документу: сеть «включилась», хосты на DHCP получили адреса.
    Цели проверяются на этом состоянии. */
export type PacketRun = Readonly<{ settled: NetState }>

export const runPacket = (world: PacketDoc): PacketRun => ({
  settled: settle(world.doc, world.state),
})

/** Что получают функции-тексты шага и подписи на доске. */
export type PacketContext = Readonly<{ doc: PacketDoc; run: PacketRun }>
