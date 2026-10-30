import { Array, Option, pipe } from 'effect'

// Адреса хранятся строками, как их видит ученик. Арифметика подсетей идёт
// через число 0..2^32-1, без побитовых операций: они знаковые в JS.

export const ANY_ADDRESS = '0.0.0.0'
export const LOOPBACK = '127.0.0.1'
export const LIMITED_BROADCAST = '255.255.255.255'
export const BROADCAST_MAC = 'ff:ff:ff:ff:ff:ff'
export const ZERO_MAC = '00:00:00:00:00:00'
export const LOCALHOST = 'localhost'

const OCTET = /^(0|[1-9]\d{0,2})$/
const MAC = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/

export const parseIp = (value: string): Option.Option<number> => {
  const parts = value.split('.')
  return parts.length === 4 &&
    Array.every(
      parts,
      part => OCTET.test(part) && globalThis.Number(part) <= 255,
    )
    ? Option.some(
        Array.reduce(
          parts,
          0,
          (sum, part) => sum * 256 + globalThis.Number(part),
        ),
      )
    : Option.none()
}

export const isIp = (value: string): boolean => Option.isSome(parseIp(value))

export const formatIp = (value: number): string =>
  pipe(
    [24, 16, 8, 0],
    Array.map(shift => `${Math.floor(value / 2 ** shift) % 256}`),
    Array.join('.'),
  )

export const isValidPrefix = (prefix: number): boolean =>
  globalThis.Number.isInteger(prefix) && prefix >= 1 && prefix <= 32

const blockSize = (prefix: number): number => 2 ** (32 - prefix)

export const networkOf = (ip: number, prefix: number): number =>
  ip - (ip % blockSize(prefix))

export const broadcastOf = (ip: number, prefix: number): number =>
  networkOf(ip, prefix) + blockSize(prefix) - 1

/** Маска как трафарет: «255.255.255.0» для /24. */
export const maskOf = (prefix: number): string =>
  formatIp(2 ** 32 - blockSize(prefix))

/** «В одной ли сети»: совпадает ли сетевая часть под маской `prefix`. */
export const inSubnet = (
  ip: string,
  network: string,
  prefix: number,
): boolean =>
  Option.exists(
    Option.all([parseIp(ip), parseIp(network)]),
    ([left, right]) => networkOf(left, prefix) === networkOf(right, prefix),
  )

export const networkAddress = (ip: string, prefix: number): string =>
  Option.match(parseIp(ip), {
    onNone: () => ip,
    onSome: value => formatIp(networkOf(value, prefix)),
  })

/** Адрес сети и широковещательный адрес нельзя дать устройству (кроме /31, /32). */
export const isUsableHost = (ip: string, prefix: number): boolean =>
  Option.exists(
    parseIp(ip),
    value =>
      prefix >= 31 ||
      (value !== networkOf(value, prefix) &&
        value !== broadcastOf(value, prefix)),
  )

export const compareIp = (left: string, right: string): number =>
  Option.getOrElse(parseIp(left), () => 0) -
  Option.getOrElse(parseIp(right), () => 0)

export const isLoopback = (ip: string): boolean => inSubnet(ip, LOOPBACK, 8)

/** Частные диапазоны RFC 1918: интернет такие адреса не возит. */
export const isPrivate = (ip: string): boolean =>
  inSubnet(ip, '10.0.0.0', 8) ||
  inSubnet(ip, '172.16.0.0', 12) ||
  inSubnet(ip, '192.168.0.0', 16)

export const shiftIp = (ip: string, delta: number): string =>
  Option.match(parseIp(ip), {
    onNone: () => ip,
    onSome: value => formatIp(value + delta),
  })

export const isMac = (value: string): boolean => MAC.test(value)

const fnv1a = (text: string, seed: number): number =>
  Array.reduce(
    text.split(''),
    seed,
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0,
  )

const hex = (value: number): string =>
  (value % 256).toString(16).padStart(2, '0')

/** MAC, выведенный из id устройства: детерминированный, локально
    администрируемый (первый байт 02). */
export const macFromId = (id: string): string => {
  const high = fnv1a(id, 2166136261)
  const low = fnv1a(`${id}#`, 2166136261)
  return pipe(
    [2, high / 2 ** 24, high / 2 ** 16, high / 2 ** 8, high, low],
    Array.map(value => hex(Math.floor(value))),
    Array.join(':'),
  )
}

// NETWORKS

export type Network = Readonly<{ ip: string; prefix: number }>

/** `10.0.0.0/8` → сеть и маска; `/0` — «все адреса». */
export const parseCidr = (value: string): Option.Option<Network> => {
  const [ip = '', prefix = ''] = value.trim().split('/')
  const bits = globalThis.Number(prefix)
  return isIp(ip) && /^\d{1,2}$/.test(prefix) && bits >= 0 && bits <= 32
    ? Option.some({ ip, prefix: bits })
    : Option.none()
}

export const isCidr = (value: string): boolean =>
  Option.isSome(parseCidr(value))

export const inCidr = (ip: string, cidr: string): boolean =>
  Option.exists(parseCidr(cidr), network =>
    inSubnet(ip, network.ip, network.prefix),
  )

/** Общее пространство провайдеров `100.64.0.0/10` (CGNAT, mesh). */
export const isShared = (ip: string): boolean => inSubnet(ip, '100.64.0.0', 10)

/** Адрес, который интернет возит: не частный, не петля, не CGNAT. */
export const isRoutable = (ip: string): boolean =>
  !isPrivate(ip) && !isLoopback(ip) && !isShared(ip)

/** Адресная строка браузера: без схемы — `http://`. */
export const normalizeUrl = (input: string): string => {
  const trimmed = input.trim()
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`
}

// URL

export type Url = Readonly<{
  scheme: 'http' | 'https'
  host: string
  port: number
  path: string
}>

const URL_PATTERN = /^(https?):\/\/([a-z0-9.-]+)(?::(\d{1,5}))?(\/[^\s]*)?$/

export const parseUrl = (url: string): Option.Option<Url> =>
  pipe(
    Option.fromNullishOr(URL_PATTERN.exec(url.trim().toLowerCase())),
    Option.flatMap(([, scheme, host, port, path]): Option.Option<Url> => {
      const secure = scheme === 'https'
      const portNumber =
        port === undefined ? (secure ? 443 : 80) : globalThis.Number(port)
      return host === undefined || portNumber < 1 || portNumber > 65535
        ? Option.none()
        : Option.some({
            scheme: secure ? 'https' : 'http',
            host,
            port: portNumber,
            path: path ?? '/',
          })
    }),
  )

export const urlText = (url: Url): string => {
  const defaultPort = url.scheme === 'https' ? 443 : 80
  return `${url.scheme}://${url.host}${url.port === defaultPort ? '' : `:${url.port}`}${url.path}`
}

/** Имя совпадает с образцом: точно или `*.зона` на один уровень. */
export const nameMatches = (pattern: string, name: string): boolean =>
  pattern === name ||
  (pattern.startsWith('*.') &&
    name.endsWith(pattern.slice(1)) &&
    !name.slice(0, name.length - pattern.length + 1).includes('.'))
