import { Array, Option, pipe } from 'effect'

import { type Hop, Layer, type StackLevel, levelOf } from '../../net/packet'

// Конверт хопа (план 3.1): в уроке 1 — «от → кому» именами, с урока 2 —
// с адресами, с урока 7 — слои снаружи внутрь. Значения полей — адреса,
// порты и флаги: как код, без перевода.

export type Field = Readonly<{ key: string; value: string }>

export type LayerRow = Readonly<{
  /** Номер слоя в конверте: по нему строка сравнивается с прошлым хопом. */
  position: number
  level: StackLevel
  title: string
  fields: ReadonlyArray<Field>
  /** Слой внутри шифра запечатанного конверта: полей не видно. */
  isSealed: boolean
}>

const option = <A>(value: Option.Option<A>, show: (a: A) => string): string =>
  Option.match(value, { onNone: () => '—', onSome: show })

const pair = (src: string, dst: string): ReadonlyArray<Field> => [
  { key: 'src', value: src },
  { key: 'dst', value: dst },
]

const fieldsOf = (layer: Layer): ReadonlyArray<Field> =>
  Layer.match(layer, {
    Ethernet: ({ src, dst }) => pair(src, dst),
    WiFi: ({ src, dst }) => pair(src, dst),
    Arp: arp => [
      { key: 'op', value: arp.kind },
      { key: 'who', value: arp.targetIp },
      { key: 'mac', value: arp.kind === 'reply' ? arp.senderMac : '?' },
    ],
    Ip: ip => [...pair(ip.src, ip.dst), { key: 'ttl', value: `${ip.ttl}` }],
    Icmp: icmp => [{ key: 'type', value: icmp.kind }],
    Udp: udp => pair(`${udp.src}`, `${udp.dst}`),
    Tcp: tcp => [
      ...pair(`${tcp.src}`, `${tcp.dst}`),
      { key: 'flags', value: tcp.flags },
    ],
    Dhcp: dhcp => [
      { key: 'op', value: dhcp.kind },
      { key: 'ip', value: option(dhcp.maybeIp, ip => ip) },
    ],
    Dns: dns => [
      { key: 'op', value: dns.kind },
      { key: 'name', value: `${dns.name} ${dns.rtype}` },
      ...Array.map(Array.take(dns.records, 2), record => ({
        key: record.rtype,
        value: record.value,
      })),
    ],
    Tls: tls => [
      { key: 'op', value: tls.kind },
      { key: 'sni', value: tls.sni },
    ],
    Http: http => [
      Option.match(http.maybeStatus, {
        onNone: () => ({ key: http.method, value: http.path }),
        onSome: status => ({ key: 'status', value: `${status}` }),
      }),
      { key: 'host', value: http.host },
      ...Array.map(http.fields, field => ({
        key: field.name,
        value: field.value,
      })),
    ],
    Tunnel: tunnel => [{ key: 'kind', value: tunnel.kind }],
    Payload: payload => [
      { key: 'kind', value: payload.kind },
      { key: 'what', value: payload.protocol },
    ],
  })

const titles: Readonly<Record<Layer['_tag'], string>> = {
  Ethernet: 'Ethernet',
  WiFi: 'Wi-Fi',
  Arp: 'ARP',
  Ip: 'IP',
  Icmp: 'ICMP',
  Udp: 'UDP',
  Tcp: 'TCP',
  Dhcp: 'DHCP',
  Dns: 'DNS',
  Tls: 'TLS',
  Http: 'HTTP',
  Tunnel: 'VPN',
  Payload: 'DATA',
}

const isCipher = (layer: Layer): boolean =>
  layer._tag === 'Tls' && layer.kind === 'data'

/** Слои конверта снаружи внутрь. В запечатанном конверте (`sealed`, с урока
    11) слои под шифром TLS видны только по названию: полей не прочитать. */
export const layerRows = (
  hop: Hop,
  sealed = false,
): ReadonlyArray<LayerRow> => {
  const cipher = Array.findFirstIndex(hop.envelope, isCipher)
  return Array.map(hop.envelope, (layer, position) => {
    const isSealed = sealed && Option.exists(cipher, index => position > index)
    return {
      position,
      level: levelOf(layer),
      title: titles[layer._tag],
      fields: isSealed ? [] : fieldsOf(layer),
      isSealed,
    }
  })
}

/** Поля, которые изменились с прошлого хопа того же пакета: на доске они
    подсвечены (MAC меняется на каждом хопе, адрес — на NAT, TTL — на роутере). */
export const changedFields = (
  previous: Option.Option<Hop>,
  hop: Hop,
): ReadonlyArray<string> =>
  Option.match(previous, {
    onNone: () => [],
    onSome: before => {
      const was = layerRows(before)
      return Array.flatMap(layerRows(hop), row =>
        pipe(
          Array.findFirst(
            was,
            candidate =>
              candidate.title === row.title && candidate.level === row.level,
          ),
          Option.match({
            onNone: () =>
              Array.map(row.fields, field => `${row.title}.${field.key}`),
            onSome: earlier =>
              Array.getSomes(
                Array.map(row.fields, field =>
                  Array.some(
                    earlier.fields,
                    old => old.key === field.key && old.value === field.value,
                  )
                    ? Option.none()
                    : Option.some(`${row.title}.${field.key}`),
                ),
              ),
          }),
        ),
      )
    },
  })

/** Адреса конверта для подписи с урока 2: IP отправителя и получателя
    (у поиска MAC — кого ищут). */
export const addressesOf = (
  hop: Hop,
): Option.Option<Readonly<{ from: string; to: string }>> =>
  Array.findFirst(hop.envelope, layer =>
    layer._tag === 'Ip'
      ? Option.some({ from: layer.src, to: layer.dst })
      : layer._tag === 'Arp'
        ? Option.some({ from: layer.senderIp, to: layer.targetIp })
        : Option.none(),
  )

/** Главное поле слоя: его подсвечивает квиз «какой это слой». */
export const keyFieldOf = (
  hop: Hop,
  level: StackLevel,
): Option.Option<string> =>
  pipe(
    layerRows(hop),
    Array.findLast(row => row.level === level),
    Option.flatMap(row =>
      Option.map(
        Array.findLast(row.fields, field => field.key !== 'op'),
        field => `${row.title}.${field.key}`,
      ),
    ),
  )

/** Конверт запечатан: внутри TLS — прикладной слой не прочитать. */
export const isSealed = (hop: Hop): boolean =>
  Array.some(hop.envelope, isCipher)
