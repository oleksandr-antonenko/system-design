import { Result } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { NetOp, apply } from '../../net/doc'
import type { NetMessage } from '../../net/message'
import {
  type NetDoc,
  type NetState,
  emptyNet,
  emptyState,
} from '../../net/model'
import { Intent, type Trace } from '../../net/packet'
import { settle, trace } from '../../net/trace'

// Документ вида сетей (design D6): свёртка операций сети и трасс `send`.
// Состояние сети (кэши, таблицы, аренды) — итог трасс по порядку, поэтому
// «доска = свёртка» сохраняется.
//
// NOTE: когда модель пакетов получит `NetOp.Send` и мир `{ doc, state }`
// (изменение extend-packet-model), `PacketOp` сводится к `NetOp`, а
// `applyPacketOp` — к `applyWorld`.

/** Ход урока или ученика: правка сети или отправка пакета. */
export const PacketOp = defineTaggedUnion({
  Edit: { op: NetOp },
  Send: { intent: Intent },
})
export type PacketOp = typeof PacketOp.Type

export type PacketDoc = Readonly<{
  net: NetDoc
  state: NetState
  /** Трассы отправок по порядку: доска проигрывает последнюю. */
  traces: ReadonlyArray<Trace>
}>

export const emptyPacketDoc: PacketDoc = {
  net: emptyNet,
  state: emptyState,
  traces: [],
}

export const applyPacketOp = (
  doc: PacketDoc,
  op: PacketOp,
): Result.Result<PacketDoc, NetMessage> =>
  PacketOp.match(op, {
    Edit: ({ op: netOp }) =>
      Result.map(apply(doc.net, netOp), net => ({ ...doc, net })),
    Send: ({ intent }) => {
      const [sent, state] = trace(doc.net, doc.state, intent)
      return Result.succeed({ ...doc, state, traces: [...doc.traces, sent] })
    },
  })

/** Расчёт по документу: сеть «включилась», хосты на DHCP получили адреса.
    Цели проверяются на этом состоянии. */
export type PacketRun = Readonly<{ settled: NetState }>

export const runPacket = (doc: PacketDoc): PacketRun => ({
  settled: settle(doc.net, doc.state),
})

/** Что получают функции-тексты шага и подписи на доске. */
export type PacketContext = Readonly<{ doc: PacketDoc; run: PacketRun }>
