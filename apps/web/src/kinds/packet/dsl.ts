import type { DeviceId } from '../../net/model'
import type { Intent, StackLevel } from '../../net/packet'
import type { Tone } from '../contract'

export { packet } from './kind'

// Язык уроков курса сетей (design D6, план 3.1). Операции — конструкторы
// модели пакетов из `net/build.ts` (`add`, `cable`, `radio`, `joinWifi`,
// `send(intent)`, `runCommand`…); здесь — сцена шага и поверхности.

// SURFACES

/** Поверхности задачи (план 4.4). Панели настроек (add-settings-panel):
    `router` — админка домашнего роутера, `dns-panel` — записи DNS-провайдера,
    `server:<id>` — панель сервера, `vpn:<id>` — VPN-клиент, `mesh` — своя
    сеть устройств, `compose:<id>` — compose.yaml хоста Docker. */
export type PacketSurface =
  | 'board'
  | 'router'
  | `router:${DeviceId}`
  | 'dns-panel'
  | `dns-panel:${DeviceId}`
  | `server:${DeviceId}`
  | `vpn:${DeviceId}`
  | 'mesh'
  | `compose:${DeviceId}`
  | `wifi:${DeviceId}`
  | `terminal:${DeviceId}`
  | `browser:${DeviceId}`

// STAGE

/** Таблица устройства, которую сцена открывает в карточке. */
export type DeviceTable = 'mac' | 'arp' | 'leases' | 'nat' | 'dns'

/** Цель на доске сетей: устройство (`router`), связь (`link:<id>`), поле
    конверта (`env:<уровень>`), зона (`zone:<id>`). */
export type PacketTarget = string

export type PacketHighlight = Readonly<{
  _tag: 'Highlight'
  target: PacketTarget
  tone: Tone
}>

export type PacketAnnotate<Key extends string = string> = Readonly<{
  _tag: 'Annotate'
  target: PacketTarget
  key: Key
  tone: Tone
}>

/** Проиграть трассу намерения на доске. Состояние сети не меняется: это
    показ, а не операция (её делает `send`). */
export type Play = Readonly<{ _tag: 'Play'; intent: Intent }>

/** Остановить проигрывание, когда пакет дошёл до устройства. */
export type PauseAt = Readonly<{ _tag: 'PauseAt'; device: DeviceId }>

/** Раскрыть конверт на слое. */
export type OpenEnvelope = Readonly<{ _tag: 'OpenEnvelope'; level: StackLevel }>

/** Открыть таблицу в карточке устройства. */
export type ShowTable = Readonly<{
  _tag: 'ShowTable'
  device: DeviceId
  table: DeviceTable
}>

export type PacketStage =
  | PacketHighlight
  | PacketAnnotate
  | Play
  | PauseAt
  | OpenEnvelope
  | ShowTable

export const highlight = (
  target: PacketTarget,
  tone: Tone,
): PacketHighlight => ({ _tag: 'Highlight', target, tone })

export const annotate = <const Key extends string>(
  target: PacketTarget,
  key: Key,
  tone: Tone,
): PacketAnnotate<Key> => ({ _tag: 'Annotate', target, key, tone })

export const play = (intent: Intent): Play => ({ _tag: 'Play', intent })

export const pauseAt = (device: DeviceId): PauseAt => ({
  _tag: 'PauseAt',
  device,
})

export const openEnvelope = (level: StackLevel): OpenEnvelope => ({
  _tag: 'OpenEnvelope',
  level,
})

export const showTable = (device: DeviceId, table: DeviceTable): ShowTable => ({
  _tag: 'ShowTable',
  device,
  table,
})
