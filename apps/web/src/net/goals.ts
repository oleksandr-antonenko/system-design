import { Array, Number, Option, Order, Schema, pipe } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { findDevice, findHost, isWan, linkBetween } from './doc'
import { NetMessage } from './message'
import {
  DeviceId,
  Ip,
  type LinkId,
  Medium,
  type NetDoc,
  type NetState,
  Port,
  Proto,
} from './model'
import {
  Intent,
  Outcome,
  type Trace,
  failingHop,
  pathOf,
  sourceOf,
} from './packet'
import {
  associationOf,
  hostIface,
  hostLinkOf,
  segmentOf,
  wanLinkOf,
} from './topology'
import { settle, trace } from './trace'

export const Goal = defineTaggedUnion({
  Linked: {
    a: DeviceId,
    b: DeviceId,
    maybeMedium: Schema.Option(Medium),
  },
  Associated: { device: DeviceId, ap: DeviceId },
  HasAddress: { device: DeviceId, maybeIp: Schema.Option(Ip) },
  NoAddressConflict: {},
  CanReach: { intent: Intent },
  CannotReach: { intent: Intent },
  Listening: {
    device: DeviceId,
    proto: Proto,
    port: Port,
    maybeBind: Schema.Option(Ip),
  },
  Resolves: {
    device: DeviceId,
    name: Schema.String,
    maybeIp: Schema.Option(Ip),
  },
})
export type Goal = typeof Goal.Type

/** Результат проверки цели: код сообщения и фокус на доске. Для целей по
    трассе — сама трасса и хоп, где погиб пакет. */
export type GoalCheck = Readonly<{
  met: boolean
  maybeFailure: Option.Option<NetMessage>
  focusDevices: ReadonlyArray<DeviceId>
  focusLinks: ReadonlyArray<LinkId>
  maybeHop: Option.Option<number>
  maybeTrace: Option.Option<Trace>
}>

const met: GoalCheck = {
  met: true,
  maybeFailure: Option.none(),
  focusDevices: [],
  focusLinks: [],
  maybeHop: Option.none(),
  maybeTrace: Option.none(),
}

const failed = (
  failure: NetMessage,
  focus: Partial<Omit<GoalCheck, 'met' | 'maybeFailure'>> = {},
): GoalCheck => ({
  met: false,
  maybeFailure: Option.some(failure),
  focusDevices: focus.focusDevices ?? [],
  focusLinks: focus.focusLinks ?? [],
  maybeHop: focus.maybeHop ?? Option.none(),
  maybeTrace: focus.maybeTrace ?? Option.none(),
})

const checkLinked = (
  doc: NetDoc,
  a: DeviceId,
  b: DeviceId,
  maybeMedium: Option.Option<'cable' | 'radio'>,
): GoalCheck =>
  Option.match(linkBetween(doc, a, b), {
    onNone: () =>
      failed(NetMessage.GoalNotLinked({ a, b }), { focusDevices: [a, b] }),
    onSome: link =>
      Option.exists(maybeMedium, want => want !== link.medium)
        ? failed(
            NetMessage.GoalWrongMedium({
              a,
              b,
              want: Option.getOrElse(maybeMedium, () => link.medium),
            }),
            { focusDevices: [a, b], focusLinks: [link.id] },
          )
        : link.up
          ? met
          : failed(NetMessage.GoalLinkDown({ a, b }), {
              focusDevices: [a, b],
              focusLinks: [link.id],
            }),
  })

const checkAssociated = (
  doc: NetDoc,
  device: DeviceId,
  ap: DeviceId,
): GoalCheck =>
  pipe(
    linkBetween(doc, device, ap),
    Option.filter(link => link.medium === 'radio'),
    Option.match({
      onNone: () =>
        failed(NetMessage.GoalNoRadioLink({ device, ap }), {
          focusDevices: [device, ap],
        }),
      onSome: link => {
        const focus = { focusDevices: [device, ap], focusLinks: [link.id] }
        if (!link.up) {
          return failed(NetMessage.LinkDown({ device, link: link.id }), focus)
        }
        return Option.match(associationOf(doc, link), {
          onNone: () => met,
          onSome: association =>
            association._tag === 'Associated'
              ? met
              : failed(association.reason, focus),
        })
      },
    }),
  )

const checkHasAddress = (
  doc: NetDoc,
  state: NetState,
  device: DeviceId,
  maybeIp: Option.Option<string>,
): GoalCheck =>
  Option.match(findHost(doc, device), {
    onNone: () =>
      failed(NetMessage.NotAHost({ id: device }), { focusDevices: [device] }),
    onSome: current => {
      const settled = settle(doc, state)
      return Option.match(hostIface(doc, settled, current), {
        onNone: () => {
          const [join] = trace(doc, settled, Intent.DhcpJoin({ device }))
          return Outcome.match(join.outcome, {
            Delivered: () =>
              failed(NetMessage.NoAddress({ device }), {
                focusDevices: [device],
              }),
            Dropped: ({ at, reason }) =>
              failed(reason, {
                focusDevices: Array.dedupe([device, at]),
                maybeTrace: Option.some(join),
              }),
            Refused: ({ at, reason }) =>
              failed(reason, {
                focusDevices: Array.dedupe([device, at]),
                maybeTrace: Option.some(join),
              }),
          })
        },
        onSome: iface =>
          Option.exists(maybeIp, want => want !== iface.ip)
            ? failed(
                NetMessage.GoalWrongAddress({
                  device,
                  have: iface.ip,
                  want: Option.getOrElse(maybeIp, () => iface.ip),
                }),
                { focusDevices: [device] },
              )
            : met,
      })
    },
  })

type Claim = Readonly<{ device: DeviceId; ip: string; scope: string }>

const INTERNET_SCOPE = 'internet'

// Адреса сравниваются внутри своего сегмента: два дома могут оба жить в
// 192.168.1.0/24. Публичные адреса в облаке должны быть уникальны все.
const claimsOf = (doc: NetDoc, state: NetState): ReadonlyArray<Claim> => {
  const scopeOf = (device: DeviceId): string =>
    pipe(
      segmentOf(doc, device),
      Array.sort(Order.String),
      Array.head,
      Option.getOrElse(() => device),
    )
  return Array.flatMap(doc.devices, (device): ReadonlyArray<Claim> => {
    if (device._tag === 'Host') {
      const onCloud = Option.exists(hostLinkOf(doc, device.id), link =>
        isWan(doc, link),
      )
      return Option.match(hostIface(doc, state, device), {
        onNone: () => [],
        onSome: iface => [
          {
            device: device.id,
            ip: iface.ip,
            scope: onCloud ? INTERNET_SCOPE : scopeOf(device.id),
          },
        ],
      })
    }
    if (device._tag === 'Router') {
      const lan = {
        device: device.id,
        ip: device.lan.ip,
        scope: scopeOf(device.id),
      }
      return Option.isSome(wanLinkOf(doc, device.id))
        ? [lan, { device: device.id, ip: device.wan.ip, scope: INTERNET_SCOPE }]
        : [lan]
    }
    return []
  })
}

const checkNoConflict = (doc: NetDoc, state: NetState): GoalCheck => {
  const claims = claimsOf(doc, settle(doc, state))
  return pipe(
    claims,
    Array.map(claim => ({
      ip: claim.ip,
      devices: pipe(
        claims,
        Array.filter(
          other => other.ip === claim.ip && other.scope === claim.scope,
        ),
        Array.map(other => other.device),
        Array.dedupe,
      ),
    })),
    Array.findFirst(group => group.devices.length > 1),
    Option.match({
      onNone: () => met,
      onSome: ({ ip, devices }) =>
        failed(NetMessage.AddressConflict({ ip, devices }), {
          focusDevices: devices,
        }),
    }),
  )
}

const traceOf = (doc: NetDoc, state: NetState, intent: Intent): Trace =>
  trace(doc, settle(doc, state), intent)[0]

const checkCanReach = (
  doc: NetDoc,
  state: NetState,
  intent: Intent,
): GoalCheck => {
  const result = traceOf(doc, state, intent)
  const failure = (at: DeviceId, reason: NetMessage): GoalCheck => {
    const maybeHop = failingHop(result)
    return failed(reason, {
      focusDevices: [at],
      focusLinks: pipe(
        maybeHop,
        Option.flatMap(index => Array.get(result.hops, index)),
        Option.map(hop => hop.link),
        Option.toArray,
      ),
      maybeHop,
      maybeTrace: Option.some(result),
    })
  }
  return Outcome.match(result.outcome, {
    Delivered: () => ({ ...met, maybeTrace: Option.some(result) }),
    Dropped: ({ at, reason }) => failure(at, reason),
    Refused: ({ at, reason }) => failure(at, reason),
  })
}

const checkCannotReach = (
  doc: NetDoc,
  state: NetState,
  intent: Intent,
): GoalCheck => {
  const result = traceOf(doc, state, intent)
  return Outcome.match(result.outcome, {
    Delivered: ({ at }) => {
      const path = pathOf(result)
      return failed(NetMessage.GoalReachable({ from: sourceOf(intent), at }), {
        focusDevices: Array.dedupe([...path.devices, at]),
        focusLinks: path.links,
        maybeTrace: Option.some(result),
      })
    },
    Dropped: () => ({ ...met, maybeTrace: Option.some(result) }),
    Refused: () => ({ ...met, maybeTrace: Option.some(result) }),
  })
}

const checkListening = (
  doc: NetDoc,
  device: DeviceId,
  proto: 'tcp' | 'udp',
  port: number,
  maybeBind: Option.Option<string>,
): GoalCheck =>
  pipe(
    findDevice(doc, device),
    Option.flatMap(current =>
      current._tag === 'Host'
        ? Array.findFirst(
            current.listeners,
            listener => listener.proto === proto && listener.port === port,
          )
        : Option.none(),
    ),
    Option.match({
      onNone: () =>
        failed(NetMessage.GoalNotListening({ device, proto, port }), {
          focusDevices: [device],
        }),
      onSome: listener =>
        Option.exists(maybeBind, want => want !== listener.bind)
          ? failed(
              NetMessage.GoalListeningOnWrongAddress({
                device,
                port,
                bind: listener.bind,
                want: Option.getOrElse(maybeBind, () => listener.bind),
              }),
              { focusDevices: [device] },
            )
          : met,
    }),
  )

const checkResolves = (
  doc: NetDoc,
  state: NetState,
  device: DeviceId,
  name: string,
  maybeIp: Option.Option<string>,
): GoalCheck => {
  const result = traceOf(doc, state, Intent.Resolve({ from: device, name }))
  const failure = (at: DeviceId, reason: NetMessage): GoalCheck =>
    failed(reason, {
      focusDevices: Array.dedupe([device, at]),
      maybeHop: failingHop(result),
      maybeTrace: Option.some(result),
    })
  return Outcome.match(result.outcome, {
    Delivered: ({ answer }) =>
      answer._tag === 'Resolved' &&
      Option.exists(maybeIp, want => want !== answer.ip)
        ? failed(
            NetMessage.GoalResolvesElsewhere({
              name: answer.name,
              have: answer.ip,
              want: Option.getOrElse(maybeIp, () => answer.ip),
            }),
            { focusDevices: [device], maybeTrace: Option.some(result) },
          )
        : { ...met, maybeTrace: Option.some(result) },
    Dropped: ({ at, reason }) => failure(at, reason),
    Refused: ({ at, reason }) => failure(at, reason),
  })
}

/** Цели проверяются по документу и состоянию сети, в котором хосты на DHCP
    уже получили адреса (`settle`). */
export const checkGoal = (
  doc: NetDoc,
  state: NetState,
  goal: Goal,
): GoalCheck =>
  Goal.match(goal, {
    Linked: ({ a, b, maybeMedium }) => checkLinked(doc, a, b, maybeMedium),
    Associated: ({ device, ap }) => checkAssociated(doc, device, ap),
    HasAddress: ({ device, maybeIp }) =>
      checkHasAddress(doc, state, device, maybeIp),
    NoAddressConflict: () => checkNoConflict(doc, state),
    CanReach: ({ intent }) => checkCanReach(doc, state, intent),
    CannotReach: ({ intent }) => checkCannotReach(doc, state, intent),
    Listening: ({ device, proto, port, maybeBind }) =>
      checkListening(doc, device, proto, port, maybeBind),
    Resolves: ({ device, name, maybeIp }) =>
      checkResolves(doc, state, device, name, maybeIp),
  })

export const firstFailedGoal = (
  doc: NetDoc,
  state: NetState,
  goals: ReadonlyArray<Goal>,
): Option.Option<Readonly<{ index: number; check: GoalCheck }>> =>
  pipe(
    goals,
    Array.map((goal, index) => ({ index, check: checkGoal(doc, state, goal) })),
    Array.findFirst(({ check }) => !check.met),
  )

export const allGoalsMet = (
  doc: NetDoc,
  state: NetState,
  goals: ReadonlyArray<Goal>,
): boolean => Option.isNone(firstFailedGoal(doc, state, goals))

export const countMet = (
  doc: NetDoc,
  state: NetState,
  goals: ReadonlyArray<Goal>,
): number =>
  Number.sumAll(
    Array.map(goals, goal => (checkGoal(doc, state, goal).met ? 1 : 0)),
  )
