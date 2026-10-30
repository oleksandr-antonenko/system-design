import { Array, Option, Result, pipe } from 'effect'

import { meshJoin, meshLeave } from '../../../../net/build'
import { findHost } from '../../../../net/doc'
import { type DeviceId, type Host, kindOf } from '../../../../net/model'
import { netRules } from '../../../../net/run'
import type { PacketDoc } from '../../doc'
import * as Check from './fields'
import {
  type PanelContext,
  type PanelDefinition,
  type PanelTab,
  gatherAll,
  isOn,
  onOff,
  rowsOf,
  values,
} from './schema'

// Своя сеть устройств (`mesh`, урок 16): кто в ней, под каким именем и с
// каким адресом `100.100.0.x`. Адрес выдаёт координатор по порядку
// подключения, поэтому в панели он только показывается.

const isCoordinator = (host: Host): boolean =>
  Option.isSome(host.maybeRelayDomain) &&
  Array.some(
    host.listeners,
    listener => listener.proto === 'udp' && listener.port === netRules.meshPort,
  )

const hostsOf = (world: PacketDoc): ReadonlyArray<Host> =>
  Array.filter(
    world.doc.devices,
    (device): device is Host => device._tag === 'Host',
  )

/** Координатор: `mesh:<id>` или первый на доске. */
const meshDevice = (
  world: PacketDoc,
  target: string,
): Option.Option<DeviceId> =>
  pipe(
    target === ''
      ? Array.findFirst(hostsOf(world), isCoordinator)
      : Option.filter(findHost(world.doc, target), isCoordinator),
    Option.map(host => host.id),
  )

const MEMBER_KINDS = ['pc', 'phone', 'laptop', 'server']

/** Свои устройства, которые можно включить в сеть: компьютеры, телефоны и
    серверы, кроме служебных (справочные, DNS-провайдеры, CA, ретрансляторы). */
const candidatesOf = (context: PanelContext): ReadonlyArray<Host> =>
  Array.filter(
    hostsOf(context.world),
    host =>
      host.id !== context.device &&
      Array.contains(MEMBER_KINDS, kindOf(host)) &&
      Option.isNone(host.maybeContainer) &&
      Option.isNone(host.maybeCaIssuer) &&
      Option.isNone(host.maybeRelayDomain) &&
      !host.resolver &&
      Array.isReadonlyArrayEmpty(host.zones),
  )

const membershipOf = (context: PanelContext, host: Host) =>
  Option.filter(host.maybeMesh, mesh => mesh.relay === context.device)

const membersTab: PanelTab = {
  id: 'members',
  feature: 'mesh.members',
  label: strings => strings.mesh.tab,
  fields: () => [
    {
      _tag: 'List',
      id: 'members',
      label: strings => strings.mesh.members,
      fixed: true,
      columns: [
        { _tag: 'Info', id: 'device', label: strings => strings.mesh.device },
        { _tag: 'Check', id: 'member', label: strings => strings.mesh.member },
        {
          _tag: 'Input',
          id: 'name',
          label: strings => strings.mesh.name,
          input: 'text',
        },
        { _tag: 'Info', id: 'address', label: strings => strings.mesh.address },
      ],
      newRow: {},
    },
  ],
  read: context =>
    values(
      {},
      {
        members: Array.map(candidatesOf(context), host => {
          const maybeMesh = membershipOf(context, host)
          return {
            id: host.id,
            cells: {
              device: context.name(host.id),
              member: onOff(Option.isSome(maybeMesh)),
              name: Option.match(maybeMesh, {
                onNone: () => host.id,
                onSome: mesh => mesh.name,
              }),
              address: Option.match(maybeMesh, {
                onNone: () => '',
                onSome: mesh => mesh.ip,
              }),
            },
          }
        }),
      },
    ),
  save: (context, draft, base) =>
    Result.map(
      gatherAll(
        Array.map(rowsOf(draft, 'members'), row => {
          const before = Array.findFirst(
            rowsOf(base, 'members'),
            other => other.id === row.id,
          )
          const wasMember = Option.exists(before, other =>
            isOn(other.cells['member'] ?? ''),
          )
          const isMember = isOn(row.cells['member'] ?? '')
          const oldName = Option.match(before, {
            onNone: () => '',
            onSome: other => other.cells['name'] ?? '',
          })
          if (!isMember) {
            return Result.succeed(wasMember ? [meshLeave(row.id)] : [])
          }
          return Result.map(
            Check.cell<string>('members', row)('name', Check.text),
            name =>
              wasMember && name === oldName
                ? []
                : [
                    meshJoin(
                      row.id,
                      name === row.id
                        ? { relay: context.device }
                        : { name, relay: context.device },
                    ),
                  ],
          )
        }),
      ),
      Array.flatten,
    ),
}

export const meshPanel: PanelDefinition = {
  type: 'mesh',
  feature: 'mesh',
  device: meshDevice,
  tabLabel: (_maybeContext, strings) => strings.mesh.surfaceTab,
  heading: (context, strings) =>
    `${strings.mesh.surfaceTab} · ${context.name(context.device)}`,
  tabs: [membersTab],
}
