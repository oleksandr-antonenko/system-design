import { Array, Option } from 'effect'

import { formatIp, macFromId, networkOf, parseIp } from './address'
import { NetOp } from './doc'
import {
  Addressing,
  type Band,
  Device,
  type DeviceId,
  type DnsRecord,
  type HostKind,
  type Ip,
  type Listener,
  type Mac,
  type Proto,
  type Reservation,
  type Security,
  type WifiBand,
  type WifiConfig,
} from './model'

// Помощники для уроков и тестов: собирают устройства с умолчаниями и
// операции короткими вызовами. Проверку значений делает `apply`.

const splitCidr = (cidr: string): Readonly<{ ip: Ip; prefix: number }> => {
  const [ip = '', prefix] = cidr.split('/')
  return {
    ip,
    prefix:
      prefix === undefined ? globalThis.Number.NaN : globalThis.Number(prefix),
  }
}

export const staticAddress = (
  cidr: string,
  gateway?: Ip,
  dns?: Ip,
): Addressing => {
  const { ip, prefix } = splitCidr(cidr)
  return Addressing.Static({
    ip,
    prefix,
    maybeGateway: Option.fromNullishOr(gateway),
    maybeDns: Option.fromNullishOr(dns),
  })
}

const defaultBands: Readonly<Record<HostKind, ReadonlyArray<Band>>> = {
  pc: [],
  phone: ['2.4', '5'],
  laptop: ['2.4', '5'],
  server: [],
}

export type HostOptions = Readonly<{
  mac?: Mac
  /** `192.168.1.50/24`; без адреса хост берёт его по DHCP. */
  address?: string
  gateway?: Ip
  dns?: Ip
  wifiBands?: ReadonlyArray<Band>
  wifi?: Readonly<{ ssid: string; password: string }>
  listeners?: ReadonlyArray<Listener>
  records?: ReadonlyArray<DnsRecord>
}>

export const host = (
  id: DeviceId,
  kind: HostKind,
  x: number,
  y: number,
  options: HostOptions = {},
): Device =>
  Device.Host({
    id,
    x,
    y,
    kind,
    mac: options.mac ?? macFromId(id),
    addressing:
      options.address === undefined
        ? Addressing.Dhcp()
        : staticAddress(options.address, options.gateway, options.dns),
    wifiBands: options.wifiBands ?? defaultBands[kind],
    maybeWifiProfile: Option.fromNullishOr(options.wifi),
    listeners: options.listeners ?? [],
    dnsRecords: Array.map(options.records ?? [], record => ({
      name: record.name.toLowerCase(),
      ip: record.ip,
    })),
  })

export const tcp = (port: number, bind: Ip = '0.0.0.0'): Listener => ({
  proto: 'tcp',
  bind,
  port,
})

export const udp = (port: number, bind: Ip = '0.0.0.0'): Listener => ({
  proto: 'udp',
  bind,
  port,
})

export const wifi = (
  ssid: string,
  password: string,
  options: Readonly<{
    security?: Security
    band?: WifiBand
    channel?: number
  }> = {},
): WifiConfig => ({
  ssid,
  password,
  security: options.security ?? 'wpa2',
  band: options.band ?? 'dual',
  channel: options.channel ?? 6,
})

export type RouterOptions = Readonly<{
  /** Адрес роутера в LAN с маской: `192.168.1.1/24`. */
  lan: string
  wan: Ip
  mac?: Mac
  wanMac?: Mac
  /** По умолчанию пул `.100–.199` сети LAN. */
  pool?: Readonly<{ start: Ip; end: Ip }>
  dhcp?: boolean
  dns?: Ip
  reservations?: ReadonlyArray<Reservation>
  wifi?: WifiConfig
}>

const defaultPool = (
  lan: Readonly<{ ip: Ip; prefix: number }>,
): Readonly<{ start: Ip; end: Ip }> => {
  const network = networkOf(
    Option.getOrElse(parseIp(lan.ip), () => 0),
    globalThis.Number.isInteger(lan.prefix) ? lan.prefix : 24,
  )
  return { start: formatIp(network + 100), end: formatIp(network + 199) }
}

export const router = (
  id: DeviceId,
  x: number,
  y: number,
  options: RouterOptions,
): Device => {
  const lan = splitCidr(options.lan)
  const pool = options.pool ?? defaultPool(lan)
  return Device.Router({
    id,
    x,
    y,
    lan: { mac: options.mac ?? macFromId(id), ip: lan.ip, prefix: lan.prefix },
    wan: { mac: options.wanMac ?? macFromId(`${id}:wan`), ip: options.wan },
    dhcp: {
      enabled: options.dhcp ?? true,
      start: pool.start,
      end: pool.end,
      maybeDns: Option.fromNullishOr(options.dns),
      reservations: options.reservations ?? [],
    },
    maybeWifi: Option.fromNullishOr(options.wifi),
  })
}

export const accessPoint = (
  id: DeviceId,
  x: number,
  y: number,
  config?: WifiConfig,
): Device =>
  Device.AccessPoint({ id, x, y, maybeWifi: Option.fromNullishOr(config) })

export const networkSwitch = (id: DeviceId, x: number, y: number): Device =>
  Device.Switch({ id, x, y })

export const internet = (
  id: DeviceId,
  x: number,
  y: number,
  mac?: Mac,
): Device => Device.Internet({ id, x, y, mac: mac ?? macFromId(id) })

// OPERATIONS

export const add = (device: Device): NetOp => NetOp.AddDevice({ device })

export const cable = (a: DeviceId, b: DeviceId): NetOp =>
  NetOp.Connect({ a, b, medium: 'cable' })

export const radio = (a: DeviceId, b: DeviceId): NetOp =>
  NetOp.Connect({ a, b, medium: 'radio' })

export const unplug = (a: DeviceId, b: DeviceId): NetOp =>
  NetOp.Disconnect({ a, b })

export const setLinkUp = (a: DeviceId, b: DeviceId, up: boolean): NetOp =>
  NetOp.SetLinkUp({ a, b, up })

export const setStatic = (
  device: DeviceId,
  cidr: string,
  gateway?: Ip,
  dns?: Ip,
): NetOp =>
  NetOp.SetAddressing({ device, addressing: staticAddress(cidr, gateway, dns) })

export const useDhcp = (device: DeviceId): NetOp =>
  NetOp.SetAddressing({ device, addressing: Addressing.Dhcp() })

export const joinWifi = (
  device: DeviceId,
  ssid: string,
  password: string,
): NetOp => NetOp.JoinWifi({ device, ssid, password })

export const forgetWifi = (device: DeviceId): NetOp =>
  NetOp.ForgetWifi({ device })

export const configureWifi = (device: DeviceId, config?: WifiConfig): NetOp =>
  NetOp.ConfigureWifi({ device, maybeWifi: Option.fromNullishOr(config) })

export const setDhcpPool = (router: DeviceId, start: Ip, end: Ip): NetOp =>
  NetOp.SetDhcpPool({ router, start, end })

export const reserve = (router: DeviceId, mac: Mac, ip: Ip): NetOp =>
  NetOp.ReserveAddress({ router, mac, ip })

export const listen = (
  device: DeviceId,
  proto: Proto,
  bind: Ip,
  port: number,
): NetOp => NetOp.Listen({ device, proto, bind, port })

export const stopListening = (
  device: DeviceId,
  proto: Proto,
  port: number,
): NetOp => NetOp.StopListening({ device, proto, port })
