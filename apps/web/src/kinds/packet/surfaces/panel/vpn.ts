import { Array, Option, Result } from 'effect'

import { vpnSettings } from '../../../../net/build'
import { findHost, findRouter } from '../../../../net/doc'
import type { NetMessage } from '../../../../net/message'
import type { DeviceId, Host, VpnClient } from '../../../../net/model'
import type { PacketDoc } from '../../doc'
import * as Check from './fields'
import {
  ON,
  type PanelContext,
  type PanelDefinition,
  type PanelTab,
  choice,
  fieldOf,
  gatherAll,
  isOn,
  onOff,
  rowsOf,
  values,
} from './schema'

// Настройки VPN-клиента `vpn:<устройство>` (урок 13): подключение, что
// отправлять в туннель (весь трафик или только рабочие сети) и список
// рабочих сетей. Шлюз, адрес в туннеле и DNS офиса только показываются.
//
// NOTE: `read` не зависит от подписей устройств: плеер обновляет панель без
// текстов урока, а черновик живёт, пока `read` в обновлении и в виде
// совпадает. Поэтому шлюз показан своим внешним адресом, а не подписью.

const FULL = 'full'
const SPLIT = 'split'

const vpnDevice = (world: PacketDoc, target: string): Option.Option<DeviceId> =>
  Option.map(findHost(world.doc, target), host => host.id)

const vpnOf = (context: PanelContext): Option.Option<VpnClient> =>
  Option.flatMap(
    findHost(context.world.doc, context.device),
    host => host.maybeVpn,
  )

const hostOf = (context: PanelContext): Option.Option<Host> =>
  findHost(context.world.doc, context.device)

const settingsTab: PanelTab = {
  id: 'vpn',
  feature: 'vpn.settings',
  label: strings => strings.vpn.tab,
  fields: context => [
    {
      _tag: 'Segmented',
      id: 'connected',
      label: strings => strings.vpn.connection,
      choices: [
        choice(ON, strings => strings.vpn.connected),
        choice('', strings => strings.vpn.disconnected),
      ],
    },
    { _tag: 'Info', id: 'gateway', label: strings => strings.vpn.gateway },
    { _tag: 'Info', id: 'address', label: strings => strings.vpn.address },
    {
      _tag: 'Segmented',
      id: 'mode',
      label: strings => strings.vpn.mode,
      choices: [
        choice(FULL, strings => strings.vpn.full),
        choice(SPLIT, strings => strings.vpn.split),
      ],
    },
    {
      _tag: 'List',
      id: 'networks',
      label: strings => strings.vpn.networks,
      columns: [
        {
          _tag: 'Input',
          id: 'network',
          label: strings => strings.vpn.network,
          input: 'cidr',
          placeholder: strings => strings.vpn.networkPlaceholder,
        },
      ],
      newRow: { network: '' },
      enabled: current => fieldOf(current, 'mode') === SPLIT,
    },
    {
      _tag: 'Note',
      id: 'dns',
      tone: 'info',
      text: strings =>
        `${strings.vpn.dns}: ${Option.match(
          Option.flatMap(vpnOf(context), vpn => vpn.maybeDns),
          {
            onNone: () => strings.vpn.noDns,
            onSome: dns => strings.vpn.dnsLine(dns.zone, dns.server),
          },
        )}`,
    },
  ],
  read: context =>
    Option.match(vpnOf(context), {
      onNone: () =>
        values(
          { connected: '', gateway: '', address: '', mode: FULL },
          { networks: [] },
        ),
      onSome: vpn =>
        values(
          {
            connected: onOff(vpn.connected),
            gateway: Option.match(findRouter(context.world.doc, vpn.gateway), {
              onNone: () => vpn.gateway,
              onSome: router => router.wan.ip,
            }),
            address: vpn.address,
            mode: vpn.mode,
          },
          {
            networks: Array.map(vpn.networks, (network, index) => ({
              id: `n${index}`,
              cells: { network },
            })),
          },
        ),
    }),
  save: (context, draft) => {
    const mode = fieldOf(draft, 'mode') === SPLIT ? SPLIT : FULL
    const current = Option.match(vpnOf(context), {
      onNone: () => [],
      onSome: vpn => vpn.networks,
    })
    return Result.map(
      mode === SPLIT
        ? gatherAll(
            Array.map(rowsOf(draft, 'networks'), row =>
              Check.cell<string>('networks', row)('network', Check.cidr),
            ),
          )
        : Result.succeed(current),
      networks => [
        vpnSettings(context.device, {
          connected: isOn(fieldOf(draft, 'connected')),
          mode,
          networks,
        }),
      ],
    )
  },
  blame: (message: NetMessage) =>
    message._tag === 'SplitTunnelEmpty' || message._tag === 'InvalidCidr'
      ? Option.some('networks')
      : Option.none(),
}

export const vpnPanel: PanelDefinition = {
  type: 'vpn',
  feature: 'vpn',
  device: vpnDevice,
  tabLabel: (maybeContext, strings, target) =>
    strings.vpn.surfaceTab(
      Option.match(maybeContext, {
        onNone: () => target,
        onSome: context => context.name(context.device),
      }),
    ),
  heading: (context, strings) =>
    Option.match(hostOf(context), {
      onNone: () => strings.vpn.connection,
      onSome: host => `${strings.vpn.connection} · ${context.name(host.id)}`,
    }),
  tabs: [settingsTab],
}
