import type { NetOp } from '../../net/doc'
import type { DeviceId } from '../../net/model'
import type { Intent, StackLevel } from '../../net/packet'
import type { Tone } from '../contract'

export { packet } from './kind'

// Язык уроков курса сетей (design D6, план 3.1). Операции — конструкторы
// модели пакетов из `net/build.ts` (`add`, `cable`, `radio`, `joinWifi`,
// `send(intent)`, `runCommand`…); здесь — сцена шага и поверхности.
// Сцена только показывает: документ и состояние сети она не меняет.

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
  | 'report'

// STAGE

/** Таблица устройства, которую сцена открывает в карточке. */
export type DeviceTable =
  | 'mac'
  | 'arp'
  | 'routes'
  | 'leases'
  | 'nat'
  | 'dns'
  | 'contacts'
  | 'records'
  | 'ports'
  | 'rules'

/** Цель на доске сетей: устройство (`router`), связь (`link:<id>`), поле
    конверта (`env:<уровень>`), зона (`zone:<роутер>`, `zone:internet`),
    наклейка (`sticker`), строка правил (`rule:<устройство>:<номер>`),
    элемент черновика (`draft:<номер>`). */
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

/** Что показывает проигрывание: `letters` — только конверты разговора
    (запрос и ответ, без поиска MAC, DHCP и рукопожатий; вопрос справочной —
    с урока 3), `request` — только запрос и ответ, без справочной даже после
    урока 3, `handshake` — разговор и перед ним договорённость о шифре (TLS
    hello, урок 11), `all` — все пакеты трассы с цветом протокола. По
    умолчанию `all` открывает урок 7 (легенда цветов), до него — `letters`. */
export type PlayShow = 'letters' | 'request' | 'handshake' | 'all'

/** Проиграть трассу намерения на доске. Состояние сети не меняется: это
    показ, а не операция (её делает `send`). `after` — операции, после
    которых считается трасса: так ход ученика «кабель» показывает, как
    устройство на новом кабеле просит адрес. */
export type Play = Readonly<{
  _tag: 'Play'
  intent: Intent
  show?: PlayShow
  after?: ReadonlyArray<NetOp>
}>

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

/** Раскрыть облако «Интернет»: внутри видны сети (урок 1) или настоящие
    транзитные роутеры, если они есть в документе. */
export type Expand = Readonly<{ _tag: 'Expand'; target: PacketTarget }>

/** Распечатка вывода команды на доске: шаг без терминала показывает, что
    напечатал бы терминал устройства. */
export type Printout = Readonly<{
  _tag: 'Printout'
  device: DeviceId
  command: string
}>

/** Сканер портов: `from` стучится в порты `target`, у устройства значки
    «открыто», «отказ», «тишина». */
export type Scan = Readonly<{
  _tag: 'Scan'
  from: DeviceId
  target: PacketTarget
  ports: ReadonlyArray<number>
}>

/** Черновик: операции рисуются пунктиром поверх доски и не попадают в
    документ. Новые элементы черновика — цели `draft:<номер операции>`. */
export type Preview = Readonly<{ _tag: 'Preview'; ops: ReadonlyArray<NetOp> }>

/** Строка финального прогона: намерение и чего от него ждут. */
export type RunRow = Readonly<{
  id: string
  intent: Intent
  expect: 'reach' | 'blocked'
}>

/** Финальный прогон: таблица путей с итогом, хопами и миллисекундами. */
export type RunAll = Readonly<{ _tag: 'RunAll'; rows: ReadonlyArray<RunRow> }>

/** Туман: видны только эти устройства и то, до чего дотянулись команды
    терминала (журнал команд): сами устройства, цели и пути их конвертов.
    Туман остаётся на доске и во время ходов ученика. */
export type Fog = Readonly<{ _tag: 'Fog'; visible: ReadonlyArray<DeviceId> }>

/** Лесенка проверок (урок 15): адрес, шлюз, DNS, port, приложение снизу
    вверх у левого края доски. Каждая команда терминала зажигает свою
    ступеньку: зелёным, если проверка прошла, красным — если нет. Ступеньки
    считаются по журналу команд мира, поэтому лесенка остаётся на доске и
    во время ходов ученика. */
export type Ladder = Readonly<{ _tag: 'Ladder' }>

/** Устройство проходит по точкам, полоски сигнала меняются на ходу. */
export type Walk = Readonly<{
  _tag: 'Walk'
  device: DeviceId
  points: ReadonlyArray<readonly [number, number]>
}>

/** Комната на плане квартиры: подпись — `labels['zone:<id>']`. */
export type Room = Readonly<{
  _tag: 'Room'
  id: string
  x: number
  y: number
  width: number
  height: number
}>

/** Сборка конверта (урок 7): четыре заголовка раскладываются по порядку,
    «Отправить» пишет в журнал `send(Raw)`. */
export type Builder = Readonly<{ _tag: 'Builder'; from: DeviceId; url: string }>

/** Паспорт сайта (урок 11): карточка certificate сервера и три проверки
    браузера для имени `name` — имя, срок, кто выдал. */
export type ShowCert = Readonly<{
  _tag: 'ShowCert'
  device: DeviceId
  name: string
}>

/** Готовый блок (урок 16, `board.sandbox`): пунктирное место на доске, где
    встанет первое устройство из `ops`. Нажатие пишет `ops` в журнал задачи,
    как ход ученика; когда устройство уже на доске, места нет. */
export type Place = Readonly<{ _tag: 'Place'; ops: ReadonlyArray<NetOp> }>

export type PacketStage =
  | PacketHighlight
  | PacketAnnotate
  | Play
  | PauseAt
  | OpenEnvelope
  | ShowTable
  | Expand
  | Printout
  | Scan
  | Preview
  | RunAll
  | Fog
  | Ladder
  | Walk
  | Room
  | Builder
  | ShowCert
  | Place

export const highlight = (
  target: PacketTarget,
  tone: Tone,
): PacketHighlight => ({ _tag: 'Highlight', target, tone })

export const annotate = <const Key extends string>(
  target: PacketTarget,
  key: Key,
  tone: Tone,
): PacketAnnotate<Key> => ({ _tag: 'Annotate', target, key, tone })

/** `after` в сцене урока — подготовка, которую доска не показывает: так урок 9
    проигрывает разговор с сайтом без вопроса справочной (ноутбук уже знает
    адрес), а таблицы на доске растут только от показанной трассы. */
export const play = (
  intent: Intent,
  options: Readonly<{ show?: PlayShow; after?: ReadonlyArray<NetOp> }> = {},
): Play => ({
  _tag: 'Play',
  intent,
  ...(options.show === undefined ? {} : { show: options.show }),
  ...(options.after === undefined ? {} : { after: options.after }),
})

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

export const expand = (target: PacketTarget = 'internet'): Expand => ({
  _tag: 'Expand',
  target,
})

export const printout = (device: DeviceId, command: string): Printout => ({
  _tag: 'Printout',
  device,
  command,
})

export const scan = (
  from: DeviceId,
  target: PacketTarget,
  ports: ReadonlyArray<number>,
): Scan => ({ _tag: 'Scan', from, target, ports })

export const preview = (ops: ReadonlyArray<NetOp>): Preview => ({
  _tag: 'Preview',
  ops,
})

export const runAll = (rows: ReadonlyArray<RunRow>): RunAll => ({
  _tag: 'RunAll',
  rows,
})

export const fog = (visible: ReadonlyArray<DeviceId>): Fog => ({
  _tag: 'Fog',
  visible,
})

export const ladder = (): Ladder => ({ _tag: 'Ladder' })

export const walk = (
  device: DeviceId,
  points: ReadonlyArray<readonly [number, number]>,
): Walk => ({ _tag: 'Walk', device, points })

export const room = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Room => ({ _tag: 'Room', id, x, y, width, height })

export const builder = (from: DeviceId, url: string): Builder => ({
  _tag: 'Builder',
  from,
  url,
})

export const showCert = (device: DeviceId, name: string): ShowCert => ({
  _tag: 'ShowCert',
  device,
  name,
})

export const place = (ops: ReadonlyArray<NetOp>): Place => ({
  _tag: 'Place',
  ops,
})
