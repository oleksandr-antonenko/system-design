import { Array, Option, pipe } from 'effect'

import { nameMatches } from './address'
import { NetMessage } from './message'
import { type Cert, type Host, type NetDoc } from './model'

/** «Сегодня» на часах сети при `clock = 0`. Часы идут только операцией
    «подождать», поэтому срок сертификата проверяется детерминированно. */
export const TODAY = '2026-10-30'

/** Центр, которому браузеры доверяют без оговорок. CA на доске (хост с
    `maybeCaIssuer`) тоже доверенный. */
export const PUBLIC_CA = 'Example CA'

export const ACME_DAYS = 90

const DAY = 86400

const epochDay = (date: string): number => {
  const [year = 0, month = 1, day = 1] = Array.map(date.split('-'), part =>
    globalThis.Number(part),
  )
  return Date.UTC(year, month - 1, day) / 1000 / DAY
}

const dateOfDay = (day: number): string =>
  new Date(day * DAY * 1000).toISOString().slice(0, 10)

/** Дата на часах сети: `TODAY` плюс прошедшие секунды. */
export const dateAt = (clock: number): string =>
  dateOfDay(epochDay(TODAY) + Math.floor(clock / DAY))

export const addDays = (date: string, days: number): string =>
  dateOfDay(epochDay(date) + days)

export const trustedIssuers = (doc: NetDoc): ReadonlyArray<string> => [
  PUBLIC_CA,
  ...Array.flatMap(doc.devices, device =>
    device._tag === 'Host' ? Option.toArray(device.maybeCaIssuer) : [],
  ),
]

/** Сертификат, который сервер покажет для имени: подходящий по имени,
    иначе первый. */
export const certFor = (host: Host, name: string): Option.Option<Cert> =>
  pipe(
    Array.findFirst(host.certs, cert =>
      Array.some(cert.names, pattern => nameMatches(pattern, name)),
    ),
    Option.orElse(() => Array.head(host.certs)),
  )

/** Три проверки браузера по отдельности: имя из адреса есть в certificate,
    срок не вышел, издатель доверенный. Паспорт сайта на доске (урок 11)
    ставит у каждой галочку или крест. */
export type CertChecks = Readonly<{
  name: boolean
  date: boolean
  issuer: boolean
}>

export const certChecks = (
  doc: NetDoc,
  clock: number,
  name: string,
  cert: Cert,
): CertChecks => ({
  name: Array.some(cert.names, pattern => nameMatches(pattern, name)),
  date: cert.notAfter >= dateAt(clock),
  issuer: Array.contains(trustedIssuers(doc), cert.issuer),
})

/** Проверки браузера по порядку: издатель доверенный, имя совпадает,
    срок не вышел. Первая неудача — код ошибки. */
export const certProblem = (
  doc: NetDoc,
  clock: number,
  host: Host,
  name: string,
  cert: Cert,
): Option.Option<NetMessage> =>
  !Array.contains(trustedIssuers(doc), cert.issuer)
    ? Option.some(
        NetMessage.CertUntrusted({
          device: host.id,
          name,
          issuer: cert.issuer,
        }),
      )
    : !Array.some(cert.names, pattern => nameMatches(pattern, name))
      ? Option.some(
          NetMessage.CertNameMismatch({
            device: host.id,
            name,
            names: cert.names,
          }),
        )
      : cert.notAfter < dateAt(clock)
        ? Option.some(
            NetMessage.CertExpired({
              device: host.id,
              name,
              notAfter: cert.notAfter,
            }),
          )
        : Option.none()
