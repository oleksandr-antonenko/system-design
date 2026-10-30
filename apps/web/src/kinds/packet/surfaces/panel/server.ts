import { Array, Option, Order, Result, pipe } from 'effect'

import { isLoopback } from '../../../../net/address'
import {
  firewall,
  issueCert,
  listen,
  rule,
  setRedirect,
  stopListening,
} from '../../../../net/build'
import { NetOp, findHost } from '../../../../net/doc'
import { NetMessage } from '../../../../net/message'
import type {
  DeviceId,
  FirewallAction,
  FirewallProto,
  FirewallRule,
  Host,
} from '../../../../net/model'
import { addressOf } from '../../../../net/topology'
import type { PacketDoc } from '../../doc'
import * as Check from './fields'
import {
  type Check as Checked,
  type Choice,
  ON,
  type PanelContext,
  type PanelDefinition,
  type PanelTab,
  type SelectField,
  type Text,
  type Values,
  choice,
  fieldOf,
  gather,
  gatherAll,
  isOn,
  onOff,
  refusedAt,
  rowsOf,
  values,
} from './schema'

// Панель сервера `server:<устройство>` (уроки 11, 12, 16): «Сайт» — кому
// открыта каждая программа и перенаправление на https, «Сертификат» —
// какой сейчас и выпуск нового, «Файрвол» — правила для входящих.

// DEVICE

const serverDevice = (
  world: PacketDoc,
  target: string,
): Option.Option<DeviceId> =>
  Option.map(findHost(world.doc, target), host => host.id)

const hostOf = (context: PanelContext): Option.Option<Host> =>
  findHost(context.world.doc, context.device)

const readHost = (
  context: PanelContext,
  read: (host: Host) => Values,
): Values =>
  Option.match(hostOf(context), { onNone: () => values({}), onSome: read })

const blameOn =
  (field: string, tags: ReadonlyArray<NetMessage['_tag']>) =>
  (message: NetMessage): Option.Option<string> =>
    Array.contains(tags, message._tag) ? Option.some(field) : Option.none()

// SITE

const CLOSED = 'closed'
const LOCAL = 'local'
const EVERYONE = 'everyone'

const HTTP = 80
const HTTPS = 443
const DATABASES: ReadonlyArray<number> = [5432, 3306, 6379, 27017]

const portField = (port: number): string => `port-${port}`

/** Программы сервера: веб (80 и 443) и всё, что слушает TCP. */
const sitePorts = (host: Host): ReadonlyArray<number> =>
  Array.sort(
    Array.dedupe([
      HTTP,
      HTTPS,
      ...Array.filterMap(host.listeners, listener =>
        listener.proto === 'tcp'
          ? Result.succeed(listener.port)
          : Result.failVoid,
      ),
    ]),
    Order.Number,
  )

const accessOf = (host: Host, port: number): string =>
  Option.match(
    Array.findFirst(
      host.listeners,
      listener => listener.proto === 'tcp' && listener.port === port,
    ),
    {
      onNone: () => CLOSED,
      onSome: listener => (isLoopback(listener.bind) ? LOCAL : EVERYONE),
    },
  )

const programLabel =
  (port: number): Text =>
  strings =>
    port === HTTP
      ? strings.server.web('http', port)
      : port === HTTPS
        ? strings.server.web('https', port)
        : Array.contains(DATABASES, port)
          ? strings.server.database(port)
          : strings.server.app(port)

const accessChoices = (
  port: number,
  current: string,
): ReadonlyArray<Choice> => {
  const closed = choice(CLOSED, strings => strings.server.closed)
  const local = choice(LOCAL, strings => strings.server.local)
  const everyone = choice(EVERYONE, strings => strings.server.everyone)
  return port === HTTP || port === HTTPS
    ? current === LOCAL
      ? [closed, local, everyone]
      : [closed, everyone]
    : current === CLOSED
      ? [closed, local, everyone]
      : [local, everyone]
}

const accessOp = (device: DeviceId, port: number, access: string): NetOp =>
  access === CLOSED
    ? stopListening(device, 'tcp', port)
    : listen(device, 'tcp', access === LOCAL ? '127.0.0.1' : '0.0.0.0', port)

const siteTab: PanelTab = {
  id: 'site',
  feature: 'server.site',
  label: strings => strings.server.siteTab,
  fields: context =>
    Option.match(hostOf(context), {
      onNone: () => [],
      onSome: host => [
        ...Array.map(sitePorts(host), (port): SelectField => ({
          _tag: 'Select',
          id: portField(port),
          label: programLabel(port),
          choices: accessChoices(port, accessOf(host, port)),
        })),
        {
          _tag: 'Check',
          id: 'redirect',
          label: strings => strings.server.redirect,
          enabled: (current: Values) =>
            fieldOf(current, portField(HTTP)) !== CLOSED,
        },
      ],
    }),
  read: context =>
    readHost(context, host =>
      values({
        ...Object.fromEntries(
          Array.map(sitePorts(host), port => [
            portField(port),
            accessOf(host, port),
          ]),
        ),
        redirect: onOff(host.httpsRedirect),
      }),
    ),
  save: (context, draft, base) =>
    Result.succeed(
      Option.match(hostOf(context), {
        onNone: () => [],
        onSome: host => [
          ...Array.filterMap(sitePorts(host), port =>
            fieldOf(draft, portField(port)) === fieldOf(base, portField(port))
              ? Result.failVoid
              : Result.succeed(
                  accessOp(host.id, port, fieldOf(draft, portField(port))),
                ),
          ),
          ...(fieldOf(draft, 'redirect') === fieldOf(base, 'redirect')
            ? []
            : [setRedirect(host.id, isOn(fieldOf(draft, 'redirect')))]),
        ],
      }),
    ),
  blame: blameOn('redirect', ['InvalidPort']),
}

// CERTIFICATE

const certTab: PanelTab = {
  id: 'cert',
  feature: 'server.cert',
  label: strings => strings.server.certTab,
  saveLabel: strings => strings.server.issue,
  fields: context => [
    {
      _tag: 'Note',
      id: 'current',
      tone: 'info',
      text: strings =>
        `${strings.server.current}: ${Option.match(
          Option.flatMap(hostOf(context), host => Array.head(host.certs)),
          {
            onNone: () => strings.server.noCert,
            onSome: cert =>
              strings.server.certLine(
                cert.names.join(', '),
                cert.issuer,
                cert.notAfter,
              ),
          },
        )}`,
    },
    {
      _tag: 'List',
      id: 'names',
      label: strings => strings.server.names,
      columns: [
        {
          _tag: 'Input',
          id: 'name',
          label: strings => strings.server.name,
          input: 'text',
          placeholder: () => 'example.com',
        },
      ],
      newRow: { name: '' },
    },
  ],
  read: context =>
    readHost(context, host =>
      values(
        {},
        {
          names: pipe(
            Array.head(host.certs),
            Option.match({
              onNone: () => [],
              onSome: cert =>
                Array.map(cert.names, (name, index) => ({
                  id: `n${index}`,
                  cells: { name },
                })),
            }),
          ),
        },
      ),
    ),
  save: (context, draft) =>
    Result.flatMap(
      gatherAll(
        Array.map(rowsOf(draft, 'names'), row =>
          Check.cell<string>('names', row)('name', Check.text),
        ),
      ),
      names =>
        Array.isReadonlyArrayEmpty(names)
          ? Result.fail([
              refusedAt(Option.some('names'), NetMessage.EmptyName()),
            ])
          : Result.succeed([issueCert(context.device, names)]),
    ),
  blame: blameOn('names', [
    'AcmeChallengeFailed',
    'NameIsAddress',
    'EmptyName',
    'NoCertificateAuthority',
  ]),
}

// FIREWALL

const ACTIONS: ReadonlyArray<FirewallAction> = ['allow', 'drop', 'reject']

const actionChoices: ReadonlyArray<Choice> = [
  choice('allow', strings => strings.firewall.allow),
  choice('drop', strings => strings.firewall.drop),
  choice('reject', strings => strings.firewall.reject),
]

const actionOf = (value: string): FirewallAction =>
  Option.getOrElse(
    Array.findFirst(ACTIONS, action => action === value),
    () => 'drop',
  )

const protoOf = (value: string): FirewallProto =>
  value === 'tcp' || value === 'udp' ? value : 'any'

const fromText = (rule: FirewallRule): string =>
  Option.match(rule.maybeFrom, {
    onNone: () => '',
    onSome: from => (from.endsWith('/32') ? from.slice(0, -3) : from),
  })

const fromCheck = (
  path: string,
  value: string,
): Checked<Option.Option<string>> =>
  Check.optional(value, raw =>
    raw.includes('/') ? Check.cidr(path, raw) : Check.ip(path, raw),
  )

const firewallTab: PanelTab = {
  id: 'firewall',
  feature: 'server.firewall',
  label: strings => strings.server.firewallTab,
  fields: () => [
    {
      _tag: 'Segmented',
      id: 'enabled',
      label: strings => strings.firewall.enabled,
      choices: [
        choice(ON, strings => strings.firewall.on),
        choice('', strings => strings.firewall.off),
      ],
    },
    {
      _tag: 'List',
      id: 'rules',
      label: strings => strings.firewall.rules,
      columns: [
        {
          _tag: 'Input',
          id: 'from',
          label: strings => strings.firewall.from,
          input: 'text',
          placeholder: strings => strings.firewall.fromPlaceholder,
        },
        {
          _tag: 'Input',
          id: 'port',
          label: strings => strings.firewall.port,
          input: 'port',
          placeholder: strings => strings.firewall.portPlaceholder,
        },
        {
          _tag: 'Select',
          id: 'proto',
          label: strings => strings.firewall.proto,
          choices: [
            choice('tcp', () => 'TCP'),
            choice('udp', () => 'UDP'),
            choice('any', strings => strings.firewall.anyProto),
          ],
        },
        {
          _tag: 'Select',
          id: 'action',
          label: strings => strings.firewall.action,
          choices: actionChoices,
        },
      ],
      newRow: { from: '', port: '', proto: 'tcp', action: 'allow' },
    },
    {
      _tag: 'Select',
      id: 'defaultIn',
      label: strings => strings.firewall.defaultIn,
      choices: actionChoices,
    },
  ],
  read: context =>
    readHost(context, host =>
      values(
        {
          enabled: onOff(host.firewall.enabled),
          defaultIn: host.firewall.defaultIn,
        },
        {
          rules: Array.filterMap(host.firewall.rules, (current, index) =>
            current.direction === 'in'
              ? Result.succeed({
                  id: `r${index}`,
                  cells: {
                    from: fromText(current),
                    port: Option.match(current.maybePort, {
                      onNone: () => '',
                      onSome: port => `${port}`,
                    }),
                    proto: current.proto,
                    action: current.action,
                  },
                })
              : Result.failVoid,
          ),
        },
      ),
    ),
  save: (context, draft) =>
    Option.match(hostOf(context), {
      onNone: () => Result.succeed([]),
      onSome: host =>
        Result.map(
          gatherAll(
            Array.map(rowsOf(draft, 'rules'), row => {
              const cell = Check.cell<Option.Option<string>>('rules', row)
              const portCell = Check.cell<Option.Option<number>>('rules', row)
              return Result.map(
                gather({
                  from: cell('from', fromCheck),
                  port: portCell('port', (path, value) =>
                    Check.optional(value, raw => Check.port(path, raw)),
                  ),
                }),
                ({ from, port }) =>
                  rule({
                    action: actionOf(row.cells['action'] ?? ''),
                    proto: protoOf(row.cells['proto'] ?? ''),
                    ...Option.match(port, {
                      onNone: () => ({}),
                      onSome: value => ({ port: value }),
                    }),
                    ...Option.match(from, {
                      onNone: () => ({}),
                      onSome: value => ({ from: value }),
                    }),
                  }),
              )
            }),
          ),
          rules => [
            firewall(host.id, {
              enabled: isOn(fieldOf(draft, 'enabled')),
              defaultIn: actionOf(fieldOf(draft, 'defaultIn')),
              defaultOut: host.firewall.defaultOut,
              rules: [
                ...rules,
                ...Array.filter(
                  host.firewall.rules,
                  current => current.direction === 'out',
                ),
              ],
            }),
          ],
        ),
    }),
  blame: blameOn('rules', ['InvalidCidr', 'InvalidPort', 'InvalidIp']),
}

// PANEL

const addressLine = (context: PanelContext): string =>
  Option.match(
    addressOf(context.world.doc, context.run.settled, context.device),
    {
      onNone: () => context.name(context.device),
      onSome: ip => `${context.name(context.device)} · ${ip}`,
    },
  )

export const serverPanel: PanelDefinition = {
  type: 'server',
  feature: 'server',
  device: serverDevice,
  tabLabel: (maybeContext, strings, target) =>
    strings.server.surfaceTab(
      Option.match(maybeContext, {
        onNone: () => target,
        onSome: context => context.name(context.device),
      }),
    ),
  heading: addressLine,
  tabs: [siteTab, certTab, firewallTab],
}
