import { Array, Option, pipe } from 'effect'

import { BROADCAST_MAC, ZERO_MAC } from './address'
import { findDevice, isWan, otherEnd } from './doc'
import { NetMessage } from './message'
import {
  Device,
  type DeviceId,
  type Ip,
  type Link,
  type LinkId,
  type Mac,
  type NetDoc,
  type NetState,
} from './model'
import { Layer, type TableChange } from './packet'
import {
  type Run,
  type Step,
  andThen,
  arpMac,
  dropped,
  editHop,
  learnArp,
  learnMac,
  macPort,
  netRules,
  nextPacket,
  succeed,
} from './run'
import {
  activeLinksOf,
  hostIface,
  hostLinkOf,
  isLinkActive,
  lanLinksOf,
} from './topology'

// L2: FRAMES

export type Frame = Readonly<{
  packet: number
  src: Mac
  dst: Mac
  payload: ReadonlyArray<Layer>
}>

type Delivery = Readonly<{
  from: DeviceId
  link: Link
  frame: Frame
  sentAt: number
}>

/** Устройство приняло кадр себе (а не только переслало его). */
export type Reception = Readonly<{
  device: Device
  link: Link
  frame: Frame
  at: number
  hop: number
}>

type Handled = Readonly<{
  run: Run
  forwards: ReadonlyArray<Delivery>
  received: ReadonlyArray<Reception>
}>

export type Walk = Readonly<{ run: Run; received: ReadonlyArray<Reception> }>

const delayOf = (doc: NetDoc, link: Link): number =>
  isWan(doc, link)
    ? netRules.internetMs
    : link.medium === 'radio'
      ? netRules.radioMs
      : netRules.cableMs

const frameHeader = (link: Link, frame: Frame): Layer =>
  link.medium === 'radio'
    ? Layer.WiFi({ src: frame.src, dst: frame.dst })
    : Layer.Ethernet({ src: frame.src, dst: frame.dst })

const idsOf = (links: ReadonlyArray<Link>): ReadonlyArray<LinkId> =>
  Array.map(links, link => link.id)

// Коммутатор, точка доступа и LAN роутера — мосты: учат MAC отправителя на
// входном порту, broadcast и неизвестный адрес рассылают во все остальные
// порты, известный — в один.
const deliver = (doc: NetDoc, run: Run, delivery: Delivery): Handled => {
  const { from, link, frame, sentAt } = delivery
  const to = otherEnd(link, from)
  const at = sentAt + delayOf(doc, link)
  const isBroadcast = frame.dst === BROADCAST_MAC

  const emit = (
    device: Device,
    state: NetState,
    note: NetMessage,
    changes: ReadonlyArray<TableChange>,
    forwardTo: ReadonlyArray<Link>,
    accepts: boolean,
  ): Handled => ({
    run: {
      ...run,
      state,
      hops: [
        ...run.hops,
        {
          packet: frame.packet,
          from,
          to,
          link: link.id,
          envelope: [frameHeader(link, frame), ...frame.payload],
          note,
          changes,
          sentAt,
          arrivedAt: at,
        },
      ],
    },
    forwards: Array.map(forwardTo, out => ({
      from: to,
      link: out,
      frame,
      sentAt: at,
    })),
    received: accepts
      ? [{ device, link, frame, at, hop: run.hops.length }]
      : [],
  })

  const bridge = (
    device: Device,
    ports: ReadonlyArray<Link>,
    maybeOwnMac: Option.Option<Mac>,
  ): Handled => {
    const [state, learned] = learnMac(run.state, to, frame.src, link.id)
    const changes = Option.toArray(learned)
    const others = Array.filter(ports, port => port.id !== link.id)
    if (Option.exists(maybeOwnMac, mac => mac === frame.dst)) {
      return emit(
        device,
        state,
        NetMessage.FrameReceived({ device: to }),
        changes,
        [],
        true,
      )
    }
    if (isBroadcast) {
      return emit(
        device,
        state,
        NetMessage.FrameBroadcast({ device: to, links: idsOf(others) }),
        changes,
        others,
        Option.isSome(maybeOwnMac),
      )
    }
    return Option.match(
      Option.flatMap(macPort(state, to, frame.dst), known =>
        Array.findFirst(ports, port => port.id === known),
      ),
      {
        onNone: () =>
          emit(
            device,
            state,
            NetMessage.FrameFlooded({ device: to, links: idsOf(others) }),
            changes,
            others,
            false,
          ),
        onSome: port =>
          port.id === link.id
            ? emit(
                device,
                state,
                NetMessage.FrameFiltered({ device: to }),
                changes,
                [],
                false,
              )
            : emit(
                device,
                state,
                NetMessage.FrameForwarded({ device: to, link: port.id }),
                changes,
                [port],
                false,
              ),
      },
    )
  }

  const accept = (device: Device): Handled =>
    emit(
      device,
      run.state,
      NetMessage.FrameReceived({ device: to }),
      [],
      [],
      true,
    )

  return Option.match(findDevice(doc, to), {
    onNone: () => ({ run, forwards: [], received: [] }),
    onSome: device =>
      Device.match(device, {
        Host: host =>
          isBroadcast || frame.dst === host.mac
            ? accept(device)
            : emit(
                device,
                run.state,
                NetMessage.FrameNotForMe({ device: to }),
                [],
                [],
                false,
              ),
        Switch: () => bridge(device, activeLinksOf(doc, to), Option.none()),
        AccessPoint: () =>
          bridge(device, activeLinksOf(doc, to), Option.none()),
        Router: router =>
          isWan(doc, link)
            ? accept(device)
            : bridge(device, lanLinksOf(doc, to), Option.some(router.lan.mac)),
        Internet: () => accept(device),
      }),
  })
}

// NOTE: петли второго уровня запрещает `apply`; предел защищает от
// документа, собранного в обход операций.
const walk = (
  doc: NetDoc,
  run: Run,
  queue: ReadonlyArray<Delivery>,
  received: ReadonlyArray<Reception>,
  budget: number,
): Walk =>
  Array.match(queue, {
    onEmpty: () => ({ run, received }),
    onNonEmpty: ([delivery, ...rest]) => {
      if (budget <= 0) {
        return { run, received }
      }
      const handled = deliver(doc, run, delivery)
      return walk(
        doc,
        handled.run,
        [...rest, ...handled.forwards],
        [...received, ...handled.received],
        budget - 1,
      )
    },
  })

export const sendFrame = (
  doc: NetDoc,
  run: Run,
  from: DeviceId,
  ports: ReadonlyArray<Link>,
  frame: Frame,
  at: number,
): Walk =>
  walk(
    doc,
    run,
    Array.map(ports, link => ({ from, link, frame, sentAt: at })),
    [],
    netRules.maxDeliveries,
  )

/** Куда устройство отправляет свой кадр в LAN. */
export const egressOf = (
  doc: NetDoc,
  state: NetState,
  device: Device,
  dst: Mac,
): ReadonlyArray<Link> =>
  Device.match(device, {
    Host: host =>
      Array.filter(Option.toArray(hostLinkOf(doc, host.id)), link =>
        isLinkActive(doc, link),
      ),
    Router: router => {
      const lan = lanLinksOf(doc, router.id)
      return dst === BROADCAST_MAC
        ? lan
        : pipe(
            macPort(state, router.id, dst),
            Option.flatMap(known =>
              Array.findFirst(lan, port => port.id === known),
            ),
            Option.match({ onNone: () => lan, onSome: port => [port] }),
          )
    },
    Switch: () => [],
    AccessPoint: () => [],
    Internet: () => [],
  })

export const receptionAt = (
  received: ReadonlyArray<Reception>,
  device: DeviceId,
): Option.Option<Reception> =>
  Array.findFirst(received, reception => reception.device.id === device)

// ARP

export type Sender = Readonly<{ device: DeviceId; mac: Mac; ip: Ip }>

export type ArpAnswer = Readonly<{
  macs: Array.NonEmptyReadonlyArray<Mac>
  owners: Array.NonEmptyReadonlyArray<DeviceId>
  at: number
}>

type Owner = Readonly<{
  device: Device
  mac: Mac
  at: number
  hop: number
}>

const arpOwner = (
  doc: NetDoc,
  state: NetState,
  reception: Reception,
  ip: Ip,
): Option.Option<Mac> =>
  Device.match(reception.device, {
    Host: host =>
      Option.flatMap(hostIface(doc, state, host), iface =>
        iface.ip === ip ? Option.some(host.mac) : Option.none(),
      ),
    Router: router =>
      !isWan(doc, reception.link) && router.lan.ip === ip
        ? Option.some(router.lan.mac)
        : Option.none(),
    Switch: () => Option.none(),
    AccessPoint: () => Option.none(),
    Internet: () => Option.none(),
  })

// «У кого этот IP?» уходит всем в сегменте; отвечает каждый владелец адреса
// (при конфликте их несколько), в кэше остаётся последний ответ.
export const arpExchange = (
  doc: NetDoc,
  run: Run,
  asker: Sender,
  ports: ReadonlyArray<Link>,
  ip: Ip,
  at: number,
): Step<ArpAnswer> => {
  const [numbered, packet] = nextPacket(run)
  const request = sendFrame(
    doc,
    numbered,
    asker.device,
    ports,
    {
      packet,
      src: asker.mac,
      dst: BROADCAST_MAC,
      payload: [
        Layer.Arp({
          kind: 'request',
          senderMac: asker.mac,
          senderIp: asker.ip,
          targetMac: ZERO_MAC,
          targetIp: ip,
        }),
      ],
    },
    at,
  )
  const asked: Readonly<{ run: Run; owners: ReadonlyArray<Owner> }> =
    Array.reduce(
      request.received,
      { run: request.run, owners: [] },
      (
        current: Readonly<{ run: Run; owners: ReadonlyArray<Owner> }>,
        reception,
      ) =>
        Option.match(arpOwner(doc, current.run.state, reception, ip), {
          onNone: () => ({
            ...current,
            run: editHop(current.run, Option.some(reception.hop), {
              note: NetMessage.ArpNotMine({ device: reception.device.id, ip }),
            }),
          }),
          onSome: mac => {
            const [state, learned] = learnArp(
              current.run.state,
              reception.device.id,
              asker.ip,
              asker.mac,
            )
            return {
              run: editHop(
                { ...current.run, state },
                Option.some(reception.hop),
                {
                  note: NetMessage.ArpIsMine({
                    device: reception.device.id,
                    ip,
                  }),
                  changes: Option.toArray(learned),
                },
              ),
              owners: [
                ...current.owners,
                {
                  device: reception.device,
                  mac,
                  at: reception.at,
                  hop: reception.hop,
                },
              ],
            }
          },
        }),
    )

  type Replies = Readonly<{
    run: Run
    macs: ReadonlyArray<Mac>
    owners: ReadonlyArray<DeviceId>
    at: number
  }>
  const replied = Array.reduce(
    asked.owners,
    { run: asked.run, macs: [], owners: [], at },
    (current: Replies, owner): Replies => {
      const [replyRun, replyPacket] = nextPacket(current.run)
      const back = sendFrame(
        doc,
        replyRun,
        owner.device.id,
        egressOf(doc, replyRun.state, owner.device, asker.mac),
        {
          packet: replyPacket,
          src: owner.mac,
          dst: asker.mac,
          payload: [
            Layer.Arp({
              kind: 'reply',
              senderMac: owner.mac,
              senderIp: ip,
              targetMac: asker.mac,
              targetIp: asker.ip,
            }),
          ],
        },
        owner.at,
      )
      return Option.match(receptionAt(back.received, asker.device), {
        onNone: () => ({ ...current, run: back.run }),
        onSome: reception => {
          const [state, learned] = learnArp(
            back.run.state,
            asker.device,
            ip,
            owner.mac,
          )
          return {
            run: editHop({ ...back.run, state }, Option.some(reception.hop), {
              changes: Option.toArray(learned),
            }),
            macs: [...current.macs, owner.mac],
            owners: [...current.owners, owner.device.id],
            at: Math.max(current.at, reception.at),
          }
        },
      })
    },
  )
  return Option.match(
    Option.all([
      Option.liftPredicate(replied.macs, Array.isReadonlyArrayNonEmpty),
      Option.liftPredicate(replied.owners, Array.isReadonlyArrayNonEmpty),
    ]),
    {
      onNone: () =>
        dropped(
          replied.run,
          asker.device,
          NetMessage.ArpNoReply({ device: asker.device, ip }),
        ),
      onSome: ([macs, owners]) =>
        succeed(replied.run, { macs, owners, at: replied.at }),
    },
  )
}

/** MAC следующего хопа: из ARP-кэша или ARP-запросом. */
export const resolveMac = (
  doc: NetDoc,
  run: Run,
  asker: Sender,
  ports: ReadonlyArray<Link>,
  ip: Ip,
  at: number,
): Step<Readonly<{ mac: Mac; at: number }>> =>
  Option.match(arpMac(run.state, asker.device, ip), {
    onSome: mac => succeed(run, { mac, at }),
    onNone: () =>
      andThen(arpExchange(doc, run, asker, ports, ip, at), (next, answer) =>
        succeed(next, { mac: Array.lastNonEmpty(answer.macs), at: answer.at }),
      ),
  })
