import { Array, Option, Result } from 'effect'

import {
  add,
  cable,
  configureWifi,
  host,
  radio,
  router,
  wall,
  wifi,
} from '../../../../net/build'
import type { NetOp } from '../../../../net/doc'
import {
  type PacketDoc,
  applyPacketOp,
  emptyPacketDoc,
  runPacket,
} from '../../doc'
import type { Surface } from './panel'

// Доска для тестов панелей: квартира урока 5 в начале задачи — роутер
// раздаёт только 5 ГГц, телефон и лампочка на кухне за двумя стенами.

export const SSID = 'Router-7C21'
export const PASSWORD = '12345678'

const remembered = { ssid: SSID, password: PASSWORD }

export const kitchenOps: ReadonlyArray<NetOp> = [
  add(
    router('router', 300, 320, {
      lan: '192.168.1.1/24',
      wan: '203.0.113.7',
      wifi: wifi(SSID, PASSWORD, { band: '5', channel: 36 }),
      reservations: [{ mac: '3c:22:fb:4a:10:42', ip: '192.168.1.42' }],
    }),
  ),
  add(host('phone', 'phone', 640, 260, { wifi: remembered })),
  add(
    host('laptop', 'laptop', 420, 400, {
      mac: '3c:22:fb:4a:10:42',
      wifi: remembered,
    }),
  ),
  add(host('printer', 'printer', 180, 440)),
  add(host('bulb', 'bulb', 640, 400, { wifi: remembered })),
  radio('phone', 'router'),
  radio('laptop', 'router'),
  radio('bulb', 'router'),
  cable('printer', 'router'),
  wall(470, 40, 470, 470),
  wall(560, 40, 560, 470),
]

/** Эталон задачи урока 5. */
export const dualBand = configureWifi(
  'router',
  wifi(SSID, PASSWORD, { band: 'dual' }),
)

export const worldOf = (ops: ReadonlyArray<NetOp>): PacketDoc =>
  Array.reduce(ops, emptyPacketDoc, (world, op) =>
    Result.getOrElse(applyPacketOp(world, op), () => world),
  )

export const kitchen: PacketDoc = worldOf(kitchenOps)

export const surfaceFor = (
  world: PacketDoc,
  overrides: Partial<Surface> = {},
): Surface => ({
  doc: world,
  run: runPacket(world),
  mode: 'Edit',
  target: '',
  label: () => Option.none(),
  maybeGhost: Option.none(),
  unlocked: ['router.wifi'],
  newFeatures: ['router.wifi'],
  history: [],
  journal: [],
  surfaces: [],
  ...overrides,
})
