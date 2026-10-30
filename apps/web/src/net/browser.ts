import { Array, Option, Schema, pipe } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { normalizeUrl, parseUrl } from './address'
import { NetMessage } from './message'
import { Cert, type DeviceId, Ip, type NetDoc, type NetState } from './model'
import { Intent, type Trace, failingHop } from './packet'
import { settle, trace } from './trace'

/** Коды ошибок браузера: показываются как есть, без перевода. */
export const BrowserError = Schema.Literals([
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_TIMED_OUT',
  'ERR_NAME_NOT_RESOLVED',
  'ERR_INTERNET_DISCONNECTED',
  'ERR_ADDRESS_UNREACHABLE',
  'ERR_EMPTY_RESPONSE',
  'ERR_SSL_PROTOCOL_ERROR',
  'ERR_INVALID_URL',
  'NET::ERR_CERT_COMMON_NAME_INVALID',
  'NET::ERR_CERT_DATE_INVALID',
  'NET::ERR_CERT_AUTHORITY_INVALID',
])
export type BrowserError = typeof BrowserError.Type

/** Экран браузера: страница (заголовок — имя сайта, статус, замок) или
    ошибка с кодом и причиной-кодом сообщения для строки пояснения. */
export const BrowserView = defineTaggedUnion({
  Page: {
    url: Schema.String,
    title: Schema.String,
    status: Schema.Number,
    secure: Schema.Boolean,
    maybeCert: Schema.Option(Cert),
    seenFrom: Ip,
  },
  Error: { url: Schema.String, code: BrowserError, reason: NetMessage },
})
export type BrowserView = typeof BrowserView.Type

export type Browsed = Readonly<{
  url: string
  view: BrowserView
  trace: Trace
  state: NetState
}>

const disconnected: ReadonlyArray<NetMessage['_tag']> = [
  'NoLink',
  'LinkDown',
  'WifiOff',
  'NoWifiProfile',
  'WrongSsid',
  'WrongPassword',
  'BandUnsupported',
  'OutOfRange',
  'NoAddress',
  'NoDhcpServer',
  'DhcpPoolExhausted',
]

const refusedTags: ReadonlyArray<NetMessage['_tag']> = [
  'PortClosed',
  'ListensOnlyOnLoopback',
  'FirewallRejected',
  'AppDown',
]

const unreachable: ReadonlyArray<NetMessage['_tag']> = [
  'NoGateway',
  'GatewayUnreachable',
  'GatewayIsSelf',
  'ArpNoReply',
]

/** Ошибка браузера по причине итога; гибель вопроса DNS — «имя не
    найдено», как у настоящего браузера. */
export const browserErrorOf = (
  trace: Trace,
  reason: NetMessage,
): BrowserError => {
  const dnsDied = pipe(
    failingHop(trace),
    Option.flatMap(index => Array.get(trace.hops, index)),
    Option.exists(hop =>
      Array.some(hop.envelope, layer => layer._tag === 'Dns'),
    ),
  )
  return reason._tag === 'InvalidUrl'
    ? 'ERR_INVALID_URL'
    : Array.contains(disconnected, reason._tag)
      ? 'ERR_INTERNET_DISCONNECTED'
      : reason._tag === 'NameNotFound' ||
          reason._tag === 'NoDnsServer' ||
          dnsDied
        ? 'ERR_NAME_NOT_RESOLVED'
        : Array.contains(refusedTags, reason._tag)
          ? 'ERR_CONNECTION_REFUSED'
          : reason._tag === 'PublishedPortClosed'
            ? 'ERR_EMPTY_RESPONSE'
            : Array.contains(unreachable, reason._tag)
              ? 'ERR_ADDRESS_UNREACHABLE'
              : reason._tag === 'CertNameMismatch'
                ? 'NET::ERR_CERT_COMMON_NAME_INVALID'
                : reason._tag === 'CertExpired'
                  ? 'NET::ERR_CERT_DATE_INVALID'
                  : reason._tag === 'CertUntrusted'
                    ? 'NET::ERR_CERT_AUTHORITY_INVALID'
                    : reason._tag === 'TlsNotConfigured'
                      ? 'ERR_SSL_PROTOCOL_ERROR'
                      : 'ERR_CONNECTION_TIMED_OUT'
}

/** Открыть адрес в браузере устройства: адрес без схемы — `http://`,
    трасса на «включённой» сети, страница или ошибка браузера. */
export const browse = (
  doc: NetDoc,
  state: NetState,
  device: DeviceId,
  input: string,
): Browsed => {
  const url = normalizeUrl(input)
  const [result, after] = trace(
    doc,
    settle(doc, state),
    Intent.Browse({ from: device, url }),
  )
  const view = (() => {
    const outcome = result.outcome
    if (outcome._tag === 'Delivered' && outcome.answer._tag === 'Page') {
      const page = outcome.answer
      return BrowserView.Page({
        url: page.url,
        title: Option.match(parseUrl(page.url), {
          onNone: () => page.url,
          onSome: parsed => parsed.host,
        }),
        status: page.status,
        secure: page.secure,
        maybeCert: page.maybeCert,
        seenFrom: page.seenFrom,
      })
    }
    const reason =
      outcome._tag === 'Delivered'
        ? NetMessage.InvalidUrl({ url })
        : outcome.reason
    return BrowserView.Error({
      url,
      code: browserErrorOf(result, reason),
      reason,
    })
  })()
  return { url, view, trace: result, state: after }
}
