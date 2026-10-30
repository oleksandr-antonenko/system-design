import { Array, Option, Result, pipe } from 'effect'

import { isIp } from './address'
import { NetOp, apply } from './doc'
import { type AcmeProblem, NetMessage } from './message'
import {
  type Cert,
  type DeviceId,
  type Host,
  type NetDoc,
  type NetState,
} from './model'
import { Intent, type Trace } from './packet'
import { ACME_DAYS, addDays, dateAt } from './tls'
import { settle, trace } from './trace'

/** Путь, по которому центр сертификации забирает файл-пароль сервера. */
export const challengePath = (device: DeviceId): string =>
  `/.well-known/acme-challenge/${device}`

export type Issued = Readonly<{
  doc: NetDoc
  state: NetState
  cert: Cert
  traces: ReadonlyArray<Trace>
}>

const caOf = (doc: NetDoc): Option.Option<Host> =>
  Array.findFirst(
    doc.devices,
    (device): device is Host =>
      device._tag === 'Host' && Option.isSome(device.maybeCaIssuer),
  )

/** Что делает центр сертификации при выпуске: по имени открывает путь
    файла-пароля по http:// (вопрос справочной — внутри трассы). Доска
    проигрывает эти конверты после «Выпустить» (урок 11). */
export const challengeIntents = (
  doc: NetDoc,
  device: DeviceId,
  names: ReadonlyArray<string>,
): ReadonlyArray<Intent> =>
  Option.match(caOf(doc), {
    onNone: () => [],
    onSome: ca =>
      Array.map(names, name =>
        Intent.Fetch({
          from: ca.id,
          url: `http://${name.trim().toLowerCase()}${challengePath(device)}`,
        }),
      ),
  })

type Checked = Readonly<{
  state: NetState
  traces: ReadonlyArray<Trace>
  failure: Option.Option<NetMessage>
}>

const problemOf = (
  name: string,
  problem: AcmeProblem,
  maybeIp: Option.Option<string>,
): Option.Option<NetMessage> =>
  Option.some(NetMessage.AcmeChallengeFailed({ name, problem, maybeIp }))

/** Проверка одного имени: CA узнаёт адрес и открывает по http:// путь
    файла-пароля. Ответить 200 должен тот сервер, что просит сертификат. */
const checkName = (
  doc: NetDoc,
  current: Checked,
  ca: Host,
  device: DeviceId,
  name: string,
): Checked => {
  if (Option.isSome(current.failure)) {
    return current
  }
  const [resolved, afterResolve] = trace(
    doc,
    current.state,
    Intent.Resolve({ from: ca.id, name }),
  )
  const maybeIp =
    resolved.outcome._tag === 'Delivered' &&
    resolved.outcome.answer._tag === 'Resolved'
      ? Option.some(resolved.outcome.answer.ip)
      : Option.none()
  if (Option.isNone(maybeIp)) {
    return {
      state: afterResolve,
      traces: [...current.traces, resolved],
      failure: problemOf(name, 'not-found', Option.none()),
    }
  }
  const [fetched, afterFetch] = trace(
    doc,
    afterResolve,
    Intent.Fetch({
      from: ca.id,
      url: `http://${name}${challengePath(device)}`,
    }),
  )
  const failure: Option.Option<NetMessage> =
    fetched.outcome._tag === 'Delivered'
      ? fetched.outcome.answer._tag === 'Page' &&
        fetched.outcome.answer.status === 200 &&
        fetched.outcome.at === device
        ? Option.none()
        : problemOf(name, 'wrong-server', maybeIp)
      : fetched.outcome._tag === 'Refused'
        ? fetched.outcome.reason._tag === 'NameNotFound'
          ? problemOf(name, 'not-found', maybeIp)
          : problemOf(name, 'refused', maybeIp)
        : problemOf(name, 'timeout', maybeIp)
  return {
    state: afterFetch,
    traces: [...current.traces, resolved, fetched],
    failure,
  }
}

/** Выпуск сертификата по HTTP-01 на все имена: при успехе сервер получает
    сертификат CA на 90 дней от «сегодня» на часах сети. */
export const issueCertificate = (
  doc: NetDoc,
  state: NetState,
  device: DeviceId,
  rawNames: ReadonlyArray<string>,
): Result.Result<Issued, NetMessage> => {
  const names = Array.map(rawNames, name => name.trim().toLowerCase())
  const numeric = Array.findFirst(names, isIp)
  if (Option.isSome(numeric)) {
    return Result.fail(NetMessage.NameIsAddress({ value: numeric.value }))
  }
  if (Array.isReadonlyArrayEmpty(names)) {
    return Result.fail(NetMessage.EmptyName())
  }
  return Option.match(caOf(doc), {
    onNone: () => Result.fail(NetMessage.NoCertificateAuthority()),
    onSome: ca => {
      const checked = Array.reduce(
        names,
        { state: settle(doc, state), traces: [], failure: Option.none() },
        (current: Checked, name) => checkName(doc, current, ca, device, name),
      )
      return Option.match(checked.failure, {
        onSome: Result.fail,
        onNone: () => {
          const cert: Cert = {
            names,
            issuer: Option.getOrElse(ca.maybeCaIssuer, () => ''),
            notAfter: addDays(dateAt(checked.state.clock), ACME_DAYS),
          }
          return pipe(
            apply(doc, NetOp.SetCert({ device, cert })),
            Result.map(next => ({
              doc: next,
              state: checked.state,
              cert,
              traces: checked.traces,
            })),
          )
        },
      })
    },
  })
}
