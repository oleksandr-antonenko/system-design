import { Array, Option, Order, pipe } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { renderDomainMessage } from '../../i18n/domainMessage'
import type { ProtocolName } from '../../i18n/ui/packetBoard/types'
import { networkAddress } from '../../net/address'
import { runAll } from '../../net/answers'
import { findHost, macsOf } from '../../net/doc'
import type { Device, DeviceId, NetState } from '../../net/model'
import {
  type Hop,
  type Intent,
  type StackLevel,
  TableChange,
  sourceOf,
} from '../../net/packet'
import { type Rung, type RungState, ladderOf, rungs } from '../../net/report'
import { certChecks, certFor } from '../../net/tls'
import {
  type RouteRow,
  addressOf,
  hostIface,
  routeTable,
} from '../../net/topology'
import { runInTerminal } from '../../net/world'
import type { DeviceTable } from './dsl'
import { changedFields, keyFieldOf, layerRows } from './envelope'
import { Message } from './message'
import { type Picture, deviceOf, isAddressOpen, pairsOf } from './picture'
import { printoutFeatures } from './surfaces/unlocks'

// HTML поверх доски сетей: карточка устройства, конверт по слоям, распечатка
// команды, финальный прогон, легенда; под доской — лоток квиза (слои,
// правила, чипы, «Готово») и сборка конверта.

type Send<ParentMessage> = (message: Message) => ParentMessage

const LEGEND: ReadonlyArray<ProtocolName> = [
  'dns',
  'arp',
  'dhcp',
  'tcp',
  'tls',
  'http',
  'icmp',
  'data',
]

const LEVELS: ReadonlyArray<StackLevel> = [
  'link',
  'internet',
  'transport',
  'application',
]

// CARD

/** Куда ведёт строка маршрутов: сеть или `default` («всё остальное»), как
    в выводе `ip route`. */
const routeTarget = (row: RouteRow): string =>
  row.prefix === 0 ? 'default' : `${row.network}/${row.prefix}`

/** Номер строки маршрутов устройства, по которой конверт ушёл дальше. */
const matchedRouteIndex = (
  picture: Picture,
  device: DeviceId,
): Option.Option<number> =>
  Option.flatMap(
    Option.filter(picture.maybeRoute, match => match.device === device),
    match =>
      Array.findFirstIndex(
        routeTable(picture.context.doc.doc, picture.state, device),
        row =>
          row.kind === match.kind &&
          row.prefix === match.prefix &&
          networkAddress(row.network, row.prefix) ===
            networkAddress(match.network, match.prefix),
      ),
  )

const tableRows = (
  picture: Picture,
  device: Device,
  table: DeviceTable,
  state: NetState,
): ReadonlyArray<ReadonlyArray<string>> => {
  const id = device.id
  const clock = state.clock
  const ui = picture.context.ui.packetBoard.card
  if (table === 'arp') {
    return Array.map(
      Array.filter(state.arp, entry => entry.device === id),
      entry => [entry.ip, entry.mac],
    )
  }
  if (table === 'mac') {
    return Array.map(
      Array.filter(state.macTables, entry => entry.device === id),
      entry => [entry.mac, entry.link],
    )
  }
  if (table === 'routes') {
    const doc = picture.context.doc.doc
    return Array.map(routeTable(doc, state, id), row => [
      routeTarget(row),
      Option.match(row.maybeVia, {
        onNone: () => (row.kind === 'transit' ? 'connected' : row.kind),
        onSome: via => Option.getOrElse(addressOf(doc, state, via), () => via),
      }),
      row.iface,
    ])
  }
  if (table === 'leases') {
    return Array.map(
      Array.filter(state.leases, lease => lease.router === id),
      lease => [lease.ip, lease.mac],
    )
  }
  if (table === 'nat') {
    return Array.map(
      Array.filter(state.nat, entry => entry.router === id),
      entry => [
        `${entry.inside}:${entry.insidePort}`,
        `${entry.outside}:${entry.outsidePort}`,
        `${entry.remote}:${entry.remotePort}`,
      ],
    )
  }
  if (table === 'dns' || table === 'contacts') {
    return Array.map(
      Array.filter(state.dnsCache, entry => entry.device === id),
      entry => [
        entry.name,
        entry.value,
        ...(table === 'dns'
          ? [
              entry.expiresAt > clock
                ? ui.expiresIn(entry.expiresAt - clock)
                : ui.expired,
            ]
          : []),
      ],
    )
  }
  if (table === 'records') {
    return device._tag === 'Host' || device._tag === 'Router'
      ? Array.flatMap(device.zones, zone =>
          Array.map(zone.records, record => [
            `${record.name === '@' ? zone.name : `${record.name}.${zone.name}`}`,
            record.rtype,
            record.value,
            `${record.ttl}`,
          ]),
        )
      : []
  }
  if (table === 'ports') {
    return device._tag === 'Host'
      ? Array.map(device.listeners, listener => [
          `${listener.proto} ${listener.port}`,
          listener.bind === '127.0.0.1' ? ui.portOnlySelf : listener.bind,
        ])
      : []
  }
  return device._tag === 'Host' || device._tag === 'Router'
    ? [
        ...Array.map(device.firewall.rules, (rule, index) => [
          `${index + 1}`,
          Option.getOrElse(rule.maybeFrom, () => '*'),
          `${rule.proto} ${Option.match(rule.maybePort, { onNone: () => '*', onSome: port => `${port}` })}`,
          rule.action,
        ]),
        ['·', ui.defaultRule, '', device.firewall.defaultIn],
      ]
    : []
}

const changedRow = (
  changes: ReadonlyArray<TableChange>,
  device: DeviceId,
  table: DeviceTable,
  row: ReadonlyArray<string>,
): boolean =>
  Array.some(changes, change =>
    TableChange.match(change, {
      MacLearned: found =>
        table === 'mac' && found.device === device && row[0] === found.mac,
      ArpLearned: found =>
        table === 'arp' && found.device === device && row[0] === found.ip,
      LeaseGranted: found =>
        table === 'leases' && found.router === device && row[0] === found.ip,
      NatAdded: found =>
        table === 'nat' &&
        found.router === device &&
        row[0] === `${found.inside}:${found.insidePort}`,
      DnsCached: found =>
        (table === 'dns' || table === 'contacts') &&
        found.device === device &&
        row[0] === found.name,
      VpnSessionLearned: () => false,
      RelayOpened: () => false,
    }),
  )

/** Таблицы, которые сцена шага открыла в карточке этого устройства. */
const askedTables = (
  picture: Picture,
  device: Device,
): ReadonlyArray<DeviceTable> =>
  Array.getSomes(
    Array.map(picture.context.stage, item =>
      item._tag === 'ShowTable' && item.device === device.id
        ? Option.some(item.table)
        : Option.none(),
    ),
  )

/** Таблицы карточки: те, что открыла сцена (карточка router с урока 9 иначе
    закрывает всю доску на телефоне), или всё, что открыто курсом и подходит
    устройству. */
const tablesFor = (
  picture: Picture,
  device: Device,
): ReadonlyArray<DeviceTable> => {
  const isHost = device._tag === 'Host'
  const isRouter = device._tag === 'Router'
  const candidates: ReadonlyArray<readonly [DeviceTable, string, boolean]> = [
    ['contacts', 'board.contacts', isHost && !device.resolver],
    ['ports', 'board.ports', isHost],
    ['arp', 'board.deviceMac', isHost || isRouter],
    ['mac', 'board.deviceMac', device._tag === 'Switch' || isRouter],
    ['routes', 'board.routes', isRouter || device._tag === 'Transit'],
    ['leases', 'board.natTable', isRouter],
    ['nat', 'board.natTable', isRouter],
    ['dns', 'board.resolverCache', isHost && device.resolver],
    [
      'records',
      'board.resolverCache',
      (isHost || isRouter) &&
        Array.isReadonlyArrayNonEmpty(
          device._tag === 'Host' || device._tag === 'Router'
            ? device.zones
            : [],
        ),
    ],
    [
      'rules',
      'board.firewall',
      (isHost || isRouter) &&
        (device._tag === 'Host' || device._tag === 'Router') &&
        (device.firewall.enabled ||
          Array.isReadonlyArrayNonEmpty(device.firewall.rules)),
    ],
  ]
  const asked = askedTables(picture, device)
  return Array.isReadonlyArrayNonEmpty(asked)
    ? Array.dedupe(asked)
    : Array.map(
        Array.filter(
          candidates,
          ([, feature, fits]) => fits && picture.isOpen(feature),
        ),
        ([table]) => table,
      )
}

const sendForm = <ParentMessage>(
  picture: Picture,
  device: Device,
  send: Send<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => {
  const ui = picture.context.ui.packetBoard.card
  if (
    !picture.isOpen('board.sendTo') ||
    picture.context.mode !== 'Edit' ||
    device._tag !== 'Host' ||
    device.kind === 'server' ||
    device.kind === 'printer'
  ) {
    return []
  }
  const what = device.kind === 'phone' ? 'photo' : 'document'
  const title = what === 'photo' ? ui.sendPhoto : ui.printDocument
  // Третья подсказка обводит поле, если эталон отправляет с этого
  // устройства; адрес не подставляется.
  const isGhost = Option.exists(
    picture.context.maybeTask,
    task =>
      task.isGhostShown &&
      Array.some(
        task.solution,
        op => op._tag === 'Send' && sourceOf(op.intent) === device.id,
      ),
  )
  return [
    h.form(
      [
        h.Class('pb-send'),
        h.AriaLabel(title),
        h.OnSubmit(send(Message.SubmittedSend({ from: device.id, what }))),
      ],
      [
        h.p([h.Class('pb-card-section')], [title]),
        h.label(
          [],
          [
            h.span([], [ui.sendAddress]),
            h.input([
              h.Class(
                [
                  isGhost ? 'ghost' : '',
                  Option.isSome(picture.model.maybeSendRefusal)
                    ? 'refused'
                    : '',
                ].join(' '),
              ),
              h.Type('text'),
              h.Attribute('inputmode', 'decimal'),
              h.Attribute('autocomplete', 'off'),
              h.AriaInvalid(Option.isSome(picture.model.maybeSendRefusal)),
              h.Value(picture.model.sendAddress),
              h.OnInput(value => send(Message.UpdatedSendAddress({ value }))),
            ]),
          ],
        ),
        ...Option.match(picture.model.maybeSendRefusal, {
          onNone: () => [],
          onSome: refusal => [
            h.p(
              [h.Class('pb-send-refusal'), h.Role('alert')],
              [renderDomainMessage(picture.context.ui.domain, refusal)],
            ),
          ],
        }),
        h.button([h.Type('submit'), h.Class('btn primary')], [ui.send]),
      ],
    ),
  ]
}

const cardView = <ParentMessage>(
  picture: Picture,
  send: Send<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => {
  if (!picture.isOpen('board.deviceCard')) {
    return []
  }
  const ui = picture.context.ui.packetBoard.card
  return Option.match(
    Option.flatMap(picture.maybeCard, id => deviceOf(picture, id)),
    {
      onNone: () => [],
      onSome: device => {
        const title = picture.name(device.id)
        const note = picture.note(device.id)
        const address = addressOf(
          picture.context.doc.doc,
          picture.state,
          device.id,
        )
        const tables = tablesFor(picture, device)
        const facts: ReadonlyArray<readonly [string, string]> = [
          ...(isAddressOpen(picture.context, device.id) &&
          (device._tag === 'Host' ||
            device._tag === 'Router' ||
            device._tag === 'Transit')
            ? [
                [
                  ui.address,
                  Option.getOrElse(address, () => ui.noAddress),
                ] as const,
              ]
            : []),
          ...(device._tag === 'Router' && picture.isOpen('board.routes')
            ? [['WAN', device.wan.ip] as const]
            : []),
          ...(device._tag === 'Host' && picture.isOpen('board.routes')
            ? Option.toArray(
                Option.map(
                  Option.flatMap(
                    hostIface(picture.context.doc.doc, picture.state, device),
                    iface => iface.maybeGateway,
                  ),
                  gateway => [ui.gateway, gateway] as const,
                ),
              )
            : []),
          ...(picture.isOpen('board.deviceMac')
            ? Array.map(macsOf(device), mac => [ui.mac, mac] as const)
            : []),
        ]
        return [
          h.aside(
            [h.Class('pb-card'), h.AriaLabel(ui.open(title))],
            [
              h.div(
                [h.Class('pb-card-head')],
                [
                  h.div(
                    [],
                    [
                      h.h3([], [title]),
                      ...(note === ''
                        ? []
                        : [h.p([h.Class('pb-card-note')], [note])]),
                    ],
                  ),
                  h.button(
                    [
                      h.Type('button'),
                      h.Class('pb-x'),
                      h.AriaLabel(ui.close),
                      h.OnClick(send(Message.ClickedCloseCard())),
                    ],
                    ['×'],
                  ),
                ],
              ),
              ...(Array.isReadonlyArrayEmpty(facts)
                ? []
                : [
                    h.dl(
                      [h.Class('pb-card-facts')],
                      Array.flatMap(facts, ([key, value]) => [
                        h.dt([], [key]),
                        h.dd([], [value]),
                      ]),
                    ),
                  ]),
              ...Array.map(tables, table => {
                const rows = tableRows(picture, device, table, picture.state)
                const isAsked = Array.contains(picture.cardTables, table)
                const maybeMatched =
                  table === 'routes'
                    ? matchedRouteIndex(picture, device.id)
                    : Option.none()
                return h.keyed('section')(
                  table,
                  [h.Class(`pb-card-table${isAsked ? ' asked' : ''}`)],
                  [
                    h.p([h.Class('pb-card-section')], [ui.tables[table]]),
                    Array.match(rows, {
                      onEmpty: () =>
                        h.p(
                          [h.Class('pb-empty')],
                          [table === 'ports' ? ui.noPorts : ui.empty],
                        ),
                      onNonEmpty: found =>
                        h.table(
                          [],
                          [
                            h.tbody(
                              [],
                              Array.map(found, (row, index) =>
                                h.keyed('tr')(
                                  row.join('|'),
                                  [
                                    h.Class(
                                      changedRow(
                                        picture.changes,
                                        device.id,
                                        table,
                                        row,
                                      )
                                        ? 'changed'
                                        : Option.contains(maybeMatched, index)
                                          ? 'matched'
                                          : '',
                                    ),
                                  ],
                                  Array.map(row, cell => h.td([], [cell])),
                                ),
                              ),
                            ),
                          ],
                        ),
                    }),
                  ],
                )
              }),
              ...sendForm(picture, device, send, h),
            ],
          ),
        ]
      },
    },
  )
}

// ENVELOPE PANEL

/** Конверт по слоям: какие поля изменились с прошлого хопа; наведение на
    слой подсвечивает связь или устройства. */
const envelopePanel = <ParentMessage>(
  picture: Picture,
  send: Send<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => {
  const ui = picture.context.ui.packetBoard.envelope
  const isPickLayer = Option.exists(
    picture.quiz,
    marks => marks.quiz.kind === 'PickLayer',
  )
  const isPickPending =
    isPickLayer && Option.exists(picture.quiz, marks => !marks.isAnswered)
  const isShown =
    picture.isOpen('board.envelopeLayers') &&
    (isPickPending ||
      (!picture.model.isEnvelopeDismissed &&
        (picture.model.isEnvelopeOpen ||
          Option.isSome(picture.maybeOpenLevel) ||
          isPickLayer)))
  if (!isShown) {
    return []
  }
  return Option.match(picture.maybeLeg, {
    onNone: () => [],
    onSome: ({ leg }) => {
      const play = Array.get(picture.timeline.plays, leg.play)
      const previous: Option.Option<Hop> = Option.flatMap(play, found =>
        pipe(
          found.trace.hops,
          Array.filter(
            hop =>
              hop.packet === leg.hop.packet &&
              hop.arrivedAt < leg.hop.arrivedAt,
          ),
          Array.last,
        ),
      )
      const changed = changedFields(previous, leg.hop)
      const keyField = isPickLayer
        ? Option.flatMap(picture.maybeOpenLevel, level =>
            keyFieldOf(leg.hop, level, picture.isOpen),
          )
        : Option.none()
      const isNamesHidden = isPickPending
      const pickedLevels = Option.match(picture.quiz, {
        onNone: () => [],
        onSome: marks => (marks.isAnswered ? marks.picked : []),
      })
      const answerLevels = Option.match(picture.quiz, {
        onNone: () => [],
        onSome: marks => (marks.isAnswered ? marks.answer : []),
      })
      return [
        h.section(
          [h.Class('pb-envelope'), h.AriaLabel(ui.title(leg.index, leg.count))],
          [
            h.div(
              [h.Class('pb-envelope-head')],
              [
                h.p([], [ui.title(leg.index, leg.count)]),
                ...(isPickPending
                  ? []
                  : [
                      h.button(
                        [
                          h.Type('button'),
                          h.Class('pb-x'),
                          h.AriaLabel(ui.close),
                          h.OnClick(send(Message.ClickedCloseEnvelope())),
                        ],
                        ['×'],
                      ),
                    ]),
              ],
            ),
            h.p(
              [h.Class('pb-hint')],
              [
                isPickLayer
                  ? picture.context.ui.packetBoard.quiz.layerQuestion
                  : ui.layersHint,
              ],
            ),
            h.ol(
              [h.Class('pb-layers')],
              Array.map(layerRows(leg.hop, picture.isOpen), row => {
                const isOpen =
                  Option.exists(
                    picture.maybeOpenLevel,
                    level => level === row.level,
                  ) ||
                  Option.exists(
                    picture.context.maybeHoveredRef,
                    ref => ref === `env:${row.level}`,
                  )
                const isAnswer = Array.contains(
                  answerLevels,
                  `env:${row.level}`,
                )
                const isPicked =
                  !isAnswer && Array.contains(pickedLevels, `env:${row.level}`)
                return h.keyed('li')(
                  `${row.position}`,
                  [
                    h.Class(
                      `pb-layer level-${row.level}${isOpen ? ' open' : ''}${isAnswer ? ' answer' : ''}${isPicked ? ' picked' : ''}${row.isSealed ? ' sealed' : ''}`,
                    ),
                    h.OnMouseEnter(
                      send(Message.HoveredLayer({ position: row.position })),
                    ),
                    h.OnMouseLeave(send(Message.LeftLayer())),
                    h.Tabindex(0),
                    h.OnFocus(
                      send(Message.HoveredLayer({ position: row.position })),
                    ),
                    h.OnBlur(send(Message.LeftLayer())),
                  ],
                  [
                    h.span(
                      [h.Class('pb-layer-title')],
                      [
                        isNamesHidden ? '' : row.title,
                        isNamesHidden
                          ? ''
                          : h.small([], [` · ${ui.levels[row.level]}`]),
                      ],
                    ),
                    h.span(
                      [h.Class('pb-fields')],
                      Array.map(row.fields, field => {
                        const id = `${row.title}.${field.key}`
                        const isKey = Option.exists(keyField, key => key === id)
                        return h.span(
                          [
                            h.Class(
                              `pb-field${Array.contains(changed, id) ? ' changed' : ''}${isKey ? ' key' : ''}`,
                            ),
                            ...(Array.contains(changed, id)
                              ? [h.Title(ui.changed)]
                              : []),
                          ],
                          [
                            isNamesHidden && !isKey ? '' : `${field.key} `,
                            h.b([], [field.value]),
                          ],
                        )
                      }),
                    ),
                    ...(row.isSealed
                      ? [h.span([h.Class('pb-sealed')], [`🔒 ${ui.sealed}`])]
                      : []),
                  ],
                )
              }),
            ),
          ],
        ),
      ]
    },
  })
}

// PRINTOUT, FINAL RUN, LEGEND

const printouts = <ParentMessage>(
  picture: Picture,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> =>
  picture.isOpen('board.printout')
    ? Array.flatMap(picture.context.stage, item =>
        item._tag !== 'Printout'
          ? []
          : [
              h.keyed('figure')(
                `printout-${item.device}-${item.command}`,
                [h.Class('pb-printout')],
                [
                  h.figcaption(
                    [],
                    [
                      picture.context.ui.packetBoard.printout(
                        picture.name(item.device),
                      ),
                    ],
                  ),
                  h.pre(
                    [],
                    [
                      [
                        `$ ${item.command}`,
                        ...runInTerminal(
                          picture.context.doc,
                          item.device,
                          item.command,
                          printoutFeatures(picture.context.unlocked),
                        )[0].output,
                      ].join('\n'),
                    ],
                  ),
                ],
              ),
            ],
      )
    : []

/** Паспорт сайта (урок 11): certificate, который сервер покажет для имени,
    и три проверки браузера — галочка или крест. Без certificate — строка
    «certificate нет». */
const certCards = <ParentMessage>(
  picture: Picture,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => {
  const ui = picture.context.ui.packetBoard.cert
  const world = picture.context.doc
  return picture.isOpen('browser.certificate')
    ? Array.flatMap(picture.context.stage, item => {
        if (item._tag !== 'ShowCert') {
          return []
        }
        const maybeCert = Option.flatMap(
          findHost(world.doc, item.device),
          server => certFor(server, item.name),
        )
        const check = (label: string, isPassed: boolean) =>
          h.li(
            [
              h.Class(isPassed ? 'ok' : 'bad'),
              h.AriaLabel(`${label}: ${isPassed ? ui.passed : ui.failed}`),
            ],
            [
              h.span([h.AriaHidden(true)], [isPassed ? '✓' : '✗']),
              h.span([h.AriaHidden(true)], [label]),
            ],
          )
        return [
          h.keyed('section')(
            `cert-${item.device}-${item.name}`,
            [
              h.Class('pb-cert'),
              h.AriaLabel(ui.title(picture.name(item.device))),
            ],
            [
              h.p(
                [h.Class('pb-card-section')],
                [ui.title(picture.name(item.device))],
              ),
              ...Option.match(maybeCert, {
                onNone: () => [h.p([h.Class('pb-hint')], [ui.none])],
                onSome: cert => {
                  const checks = certChecks(
                    world.doc,
                    picture.context.run.settled.clock,
                    item.name,
                    cert,
                  )
                  const facts: ReadonlyArray<readonly [string, string]> = [
                    [ui.issuedTo, cert.names.join(', ')],
                    [ui.issuedBy, cert.issuer],
                    [ui.validUntil, cert.notAfter],
                  ]
                  return [
                    h.dl(
                      [h.Class('pb-card-facts')],
                      Array.flatMap(facts, ([label, value]) => [
                        h.dt([], [label]),
                        h.dd([], [value]),
                      ]),
                    ),
                    h.ul(
                      [h.Class('pb-cert-checks')],
                      [
                        check(ui.checks.name, checks.name),
                        check(ui.checks.date, checks.date),
                        check(ui.checks.issuer, checks.issuer),
                      ],
                    ),
                  ]
                },
              }),
            ],
          ),
        ]
      })
    : []
}

/** Что проверяет строка прогона: адрес страницы или «хост:port». */
const rowTarget = (intent: Intent): string =>
  intent._tag === 'Browse' ||
  intent._tag === 'Fetch' ||
  intent._tag === 'Submit'
    ? intent.url
    : intent._tag === 'Connect'
      ? `${intent.host}:${intent.port}`
      : intent._tag === 'Ping' || intent._tag === 'Traceroute'
        ? intent.host
        : intent._tag === 'Resolve' || intent._tag === 'Query'
          ? intent.name
          : ''

const finalRun = <ParentMessage>(
  picture: Picture,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => {
  const ui = picture.context.ui.packetBoard.runAll
  return picture.isOpen('board.finalRun')
    ? Array.flatMap(picture.context.stage, item =>
        item._tag !== 'RunAll'
          ? []
          : [
              h.keyed('section')(
                'run-all',
                [h.Class('pb-run-all'), h.AriaLabel(ui.title)],
                [
                  h.p([h.Class('pb-card-section')], [ui.title]),
                  h.table(
                    [],
                    [
                      h.thead(
                        [],
                        [
                          h.tr(
                            [],
                            [
                              h.th([], [ui.path]),
                              h.th([], [ui.result]),
                              h.th([], [ui.hops]),
                              h.th([], [ui.ms]),
                            ],
                          ),
                        ],
                      ),
                      h.tbody(
                        [],
                        Array.map(
                          Array.zip(
                            item.rows,
                            runAll(
                              picture.context.doc.doc,
                              picture.context.run.settled,
                              Array.map(item.rows, row => row.intent),
                            ),
                          ),
                          ([row, result]) => {
                            const isAsExpected =
                              result.delivered === (row.expect === 'reach')
                            const target = rowTarget(row.intent)
                            return h.keyed('tr')(
                              row.id,
                              [
                                h.Class(
                                  `${isAsExpected ? 'ok' : 'bad'} ${row.expect}`,
                                ),
                              ],
                              [
                                h.td(
                                  [],
                                  [
                                    ...(target === ''
                                      ? []
                                      : [
                                          h.span(
                                            [h.Class('pb-run-target')],
                                            [target],
                                          ),
                                        ]),
                                    h.span(
                                      [h.Class('pb-run-path')],
                                      [
                                        Array.map(
                                          result.devices,
                                          picture.name,
                                        ).join(' → '),
                                      ],
                                    ),
                                  ],
                                ),
                                h.td(
                                  [],
                                  [
                                    `${isAsExpected ? '✓' : '✕'} ${result.delivered ? ui.reach : ui.blocked}`,
                                    ...(isAsExpected
                                      ? []
                                      : [
                                          h.small(
                                            [],
                                            [
                                              ` · ${ui.expected(row.expect === 'reach' ? ui.reach : ui.blocked)}`,
                                            ],
                                          ),
                                        ]),
                                  ],
                                ),
                                h.td([], [`${result.hops}`]),
                                h.td([], [`${result.ms}`]),
                              ],
                            )
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
      )
    : []
}

const legend = <ParentMessage>(
  picture: Picture,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => {
  const ui = picture.context.ui.packetBoard.legend
  return picture.isOpen('board.legend') && picture.model.isLegendOpen
    ? [
        h.section(
          [h.Class('pb-legend'), h.AriaLabel(ui.title)],
          [
            h.p([h.Class('pb-card-section')], [ui.title]),
            h.ul(
              [],
              Array.map(LEGEND, protocol =>
                h.li(
                  [h.Class(`proto-${protocol}`)],
                  [
                    h.span([h.Class('pb-swatch'), h.AriaHidden(true)]),
                    ui.protocols[protocol],
                  ],
                ),
              ),
            ),
            h.p(
              [h.Class('pb-hint')],
              [
                h.span([h.Class('pb-swatch request'), h.AriaHidden(true)]),
                ` ${ui.request}  `,
                h.span([h.Class('pb-swatch reply'), h.AriaHidden(true)]),
                ` ${ui.reply}  `,
                h.span([h.Class('pb-swatch lost'), h.AriaHidden(true)]),
                ` ${ui.lost}`,
              ],
            ),
          ],
        ),
      ]
    : []
}

// LADDER

/** Подписи ступенек — английские, как в документации и выводе команд. */
const rungLabel: Readonly<Record<Rung, string>> = {
  address: 'IP address',
  gateway: 'Gateway',
  dns: 'DNS',
  port: 'Port',
  app: 'App',
}

const rungMark: Readonly<Record<RungState, string>> = {
  idle: '',
  seen: '·',
  ok: '✓',
  bad: '✕',
}

/** Лесенка проверок у левого края доски (урок 15): ступеньки снизу вверх,
    у каждой — итог последней проверки и команда, которая её проверила. */
const ladderView = <ParentMessage>(
  picture: Picture,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => {
  const ui = picture.context.ui.packetBoard.ladder
  const ladder = ladderOf(picture.context.doc.state.commandLog)
  return picture.isOpen('board.checkLadder') &&
    Array.some(picture.context.stage, item => item._tag === 'Ladder')
    ? [
        h.keyed('section')(
          'ladder',
          [h.Class('pb-ladder'), h.AriaLabel(ui.title)],
          [
            h.p([h.Class('pb-ladder-title')], [ui.title]),
            h.ol(
              [h.Class('pb-rungs')],
              Array.map(Array.reverse(rungs), rung => {
                const { state, maybeCommand } = ladder[rung]
                return h.keyed('li')(
                  rung,
                  [
                    h.Class(`pb-rung ${state}`),
                    h.AriaLabel(`${rungLabel[rung]}: ${ui[state]}`),
                  ],
                  [
                    h.span(
                      [h.Class('pb-rung-mark'), h.AriaHidden(true)],
                      [rungMark[state]],
                    ),
                    h.span([h.Class('pb-rung-name')], [rungLabel[rung]]),
                    ...Option.match(maybeCommand, {
                      onNone: () => [],
                      onSome: command => [
                        h.span(
                          [h.Class('pb-rung-cmd'), h.AriaHidden(true)],
                          [command],
                        ),
                      ],
                    }),
                  ],
                )
              }),
            ),
          ],
        ),
      ]
    : []
}

/** Слои над доской, привязанные к её углам. */
export const stageOverlays = <ParentMessage>(
  picture: Picture,
  _send: Send<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => [
  ...ladderView(picture, h),
  ...legend(picture, h),
  ...printouts(picture, h),
  ...certCards(picture, h),
  ...finalRun(picture, h),
]

export const boardPanels = <ParentMessage>(
  picture: Picture,
  send: Send<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => [
  ...cardView(picture, send, h),
  ...envelopePanel(picture, send, h),
]

// QUIZ TRAY

const doneButton = <ParentMessage>(
  picture: Picture,
  send: Send<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
  isReady: boolean,
  count: number,
): Html =>
  h.div(
    [h.Class('pb-done')],
    [
      h.span(
        [h.Class('pb-hint')],
        [picture.context.ui.packetBoard.quiz.selected(count)],
      ),
      h.button(
        [
          h.Type('button'),
          h.Class('btn primary'),
          ...(isReady
            ? [
                h.OnClick(
                  send(
                    Message.ClickedDone({
                      playTo: picture.revealed.totalMs,
                      total: picture.revealed.totalMs,
                    }),
                  ),
                ),
              ]
            : [h.Disabled(true)]),
        ],
        [picture.context.ui.packetBoard.quiz.done],
      ),
    ],
  )

const layerButtons = <ParentMessage>(
  picture: Picture,
  send: Send<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> =>
  Option.match(picture.quiz, {
    onNone: () => [],
    onSome: marks =>
      marks.quiz.kind !== 'PickLayer'
        ? []
        : [
            h.div(
              [
                h.Class('pb-tray-buttons'),
                h.Role('group'),
                h.AriaLabel(picture.context.ui.packetBoard.quiz.layerQuestion),
              ],
              Array.map(
                Array.filter(LEVELS, level =>
                  Array.contains(marks.quiz.candidates, `env:${level}`),
                ),
                level => {
                  const id = `env:${level}`
                  const state = marks.isAnswered
                    ? Array.contains(marks.answer, id)
                      ? ' right'
                      : Array.contains(marks.picked, id)
                        ? ' wrong'
                        : ''
                    : ''
                  return h.keyed('button')(
                    id,
                    [
                      h.Type('button'),
                      h.Class(`quiz-option${state}`),
                      ...(marks.isAnswered || picture.context.mode !== 'Pick'
                        ? [h.Disabled(true)]
                        : [
                            h.OnClick(
                              send(
                                Message.ClickedCandidate({
                                  id,
                                  playTo: picture.playhead,
                                  total: picture.revealed.totalMs,
                                }),
                              ),
                            ),
                          ]),
                    ],
                    [
                      marks.quiz.names[id] ??
                        picture.context.ui.packetBoard.envelope.levels[level],
                    ],
                  )
                },
              ),
            ),
          ],
  })

const ruleTable = <ParentMessage>(
  picture: Picture,
  send: Send<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> =>
  Option.match(picture.quiz, {
    onNone: () => [],
    onSome: marks => {
      const rules = Array.filter(marks.quiz.candidates, id =>
        id.startsWith('rule:'),
      )
      if (marks.quiz.kind !== 'PickRule' && Array.isReadonlyArrayEmpty(rules)) {
        return []
      }
      const devices = Array.dedupe(
        Array.map(rules, id => id.split(':')[1] ?? ''),
      )
      return Array.flatMap(devices, deviceId =>
        Option.match(deviceOf(picture, deviceId), {
          onNone: () => [],
          onSome: device => {
            const rows = tableRows(picture, device, 'rules', picture.state)
            return [
              h.keyed('section')(
                `rules-${deviceId}`,
                [h.Class('pb-rules')],
                [
                  h.p(
                    [h.Class('pb-card-section')],
                    [
                      picture.context.ui.packetBoard.quiz.rulesTitle(
                        picture.name(deviceId),
                      ),
                    ],
                  ),
                  h.div(
                    [h.Role('group')],
                    Array.map(rows, (row, index) => {
                      const id = `rule:${deviceId}:${index + 1 > rows.length - 1 ? 'default' : index + 1}`
                      const candidate = Array.findFirst(
                        rules,
                        rule =>
                          rule === id ||
                          (index === rows.length - 1 &&
                            rule === `rule:${deviceId}:0`),
                      )
                      const target = Option.getOrElse(candidate, () => id)
                      const state = marks.isAnswered
                        ? Array.contains(marks.answer, target)
                          ? ' right'
                          : Array.contains(marks.picked, target)
                            ? ' wrong'
                            : ''
                        : Array.contains(picture.model.selection, target)
                          ? ' selected'
                          : ''
                      const canPick =
                        Option.isSome(candidate) &&
                        !marks.isAnswered &&
                        picture.context.mode === 'Pick'
                      return h.keyed('button')(
                        target,
                        [
                          h.Type('button'),
                          h.Class(`pb-rule${state}`),
                          ...(canPick
                            ? [
                                h.OnClick(
                                  send(
                                    marks.quiz.multiple
                                      ? Message.ToggledCandidate({ id: target })
                                      : Message.ClickedCandidate({
                                          id: target,
                                          playTo: picture.revealed.totalMs,
                                          total: picture.revealed.totalMs,
                                        }),
                                  ),
                                ),
                              ]
                            : [h.Disabled(true)]),
                        ],
                        Array.map(row, cell => h.span([], [cell])),
                      )
                    }),
                  ),
                ],
              ),
            ]
          },
        }),
      )
    },
  })

const chipsTray = <ParentMessage>(
  picture: Picture,
  send: Send<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> =>
  Option.match(picture.quiz, {
    onNone: () => [],
    onSome: marks => {
      if (marks.quiz.slots.length === 0) {
        return []
      }
      const ui = picture.context.ui.packetBoard.quiz
      const name = (id: string) => marks.quiz.names[id] ?? picture.name(id)
      const placements = marks.isAnswered
        ? pairsOf(marks.picked)
        : picture.model.placements
      const answer = pairsOf(marks.answer)
      const placed = Object.values(placements)
      const isLive = !marks.isAnswered && picture.context.mode === 'Pick'
      return [
        h.div(
          [h.Class('pb-chips'), h.Role('group'), h.AriaLabel(ui.chips)],
          Array.map(marks.quiz.candidates, chip => {
            const isUsed = Array.contains(placed, chip)
            const isPicked = Option.exists(
              picture.model.maybeChip,
              picked => picked === chip,
            )
            return h.keyed('button')(
              `chip-${chip}`,
              [
                h.Type('button'),
                h.Class(
                  `pb-chip${isUsed ? ' used' : ''}${isPicked ? ' picked' : ''}`,
                ),
                h.AriaPressed(isPicked ? 'true' : 'false'),
                ...(isLive
                  ? [
                      h.Draggable(true),
                      h.OnDragStart(send(Message.DraggedChip({ chip }))),
                      h.OnClick(send(Message.ClickedChip({ chip }))),
                    ]
                  : [h.Disabled(true)]),
              ],
              [name(chip)],
            )
          }),
        ),
        h.ol(
          [h.Class('pb-slots')],
          Array.map(marks.quiz.slots, slot => {
            const chip = Option.fromNullishOr(placements[slot])
            const expected = Option.fromNullishOr(answer[slot])
            const state = marks.isAnswered
              ? Option.exists(chip, found =>
                  Option.exists(expected, wanted => wanted === found),
                )
                ? ' right'
                : ' wrong'
              : ''
            return h.keyed('li')(
              `slot-${slot}`,
              [
                h.Class(`pb-slot${state}`),
                ...(isLive
                  ? [
                      h.AllowDrop(),
                      h.OnDrop(send(Message.DroppedOnSlot({ slot }))),
                    ]
                  : []),
              ],
              [
                h.div([h.Class('pb-slot-text')], [name(slot)]),
                h.button(
                  [
                    h.Type('button'),
                    h.Class('pb-slot-target'),
                    h.AriaLabel(
                      `${name(slot)}: ${Option.match(chip, {
                        onNone: () => ui.slotEmpty,
                        onSome: name,
                      })}`,
                    ),
                    ...(isLive
                      ? [h.OnClick(send(Message.ClickedSlot({ slot })))]
                      : [h.Disabled(true)]),
                  ],
                  [
                    Option.match(chip, {
                      onNone: () => ui.slotEmpty,
                      onSome: name,
                    }),
                  ],
                ),
                ...(marks.isAnswered && state === ' wrong'
                  ? Option.match(expected, {
                      onNone: () => [],
                      onSome: wanted => [
                        h.p([h.Class('pb-hint')], [`→ ${name(wanted)}`]),
                      ],
                    })
                  : []),
              ],
            )
          }),
        ),
        ...(isLive
          ? [
              doneButton(
                picture,
                send,
                h,
                Array.every(
                  marks.quiz.slots,
                  slot => placements[slot] !== undefined,
                ),
                Object.keys(placements).length,
              ),
            ]
          : []),
      ]
    },
  })

// BUILDER

const builderPanel = <ParentMessage>(
  picture: Picture,
  send: Send<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => {
  const ui = picture.context.ui.packetBoard.builder
  return Array.flatMap(picture.context.stage, item =>
    item._tag !== 'Builder' || !picture.isOpen('envelope.builder')
      ? []
      : (() => {
          const isLive = picture.context.mode === 'Edit'
          const headers = picture.model.headers
          const loose = Array.filter(
            Array.sort(
              LEVELS,
              Order.mapInput(
                Order.String,
                (level: StackLevel) =>
                  picture.context.ui.packetBoard.envelope.levels[level],
              ),
            ),
            level => !Array.contains(headers, level),
          )
          return [
            h.keyed('section')(
              'builder',
              [h.Class('pb-builder'), h.AriaLabel(ui.title)],
              [
                h.p([h.Class('pb-card-section')], [ui.title]),
                h.p([h.Class('pb-hint')], [ui.hint]),
                h.div(
                  [h.Class('pb-chips')],
                  Array.map(loose, level => {
                    const isPicked = Option.exists(
                      picture.model.maybeHeader,
                      picked => picked === level,
                    )
                    return h.keyed('button')(
                      `header-${level}`,
                      [
                        h.Type('button'),
                        h.Class(
                          `pb-chip level-${level}${isPicked ? ' picked' : ''}`,
                        ),
                        h.AriaPressed(isPicked ? 'true' : 'false'),
                        ...(isLive
                          ? [
                              h.Draggable(true),
                              h.OnDragStart(
                                send(Message.DraggedHeader({ level })),
                              ),
                              h.OnClick(send(Message.ClickedHeader({ level }))),
                            ]
                          : [h.Disabled(true)]),
                      ],
                      [headerName(level)],
                    )
                  }),
                ),
                h.ol(
                  [h.Class('pb-slots builder')],
                  Array.map(Array.range(0, 3), position =>
                    h.keyed('li')(
                      `place-${position}`,
                      [
                        h.Class('pb-slot'),
                        ...(isLive
                          ? [
                              h.AllowDrop(),
                              h.OnDrop(
                                send(Message.DroppedOnHeaderSlot({ position })),
                              ),
                            ]
                          : []),
                      ],
                      [
                        h.div(
                          [h.Class('pb-slot-text')],
                          [
                            ui.position(position + 1),
                            position === 0
                              ? ` · ${ui.outside}`
                              : position === 3
                                ? ` · ${ui.inside}`
                                : '',
                          ],
                        ),
                        h.button(
                          [
                            h.Type('button'),
                            h.Class('pb-slot-target'),
                            h.AriaLabel(
                              `${ui.position(position + 1)}: ${Option.match(
                                Array.get(headers, position),
                                {
                                  onNone: () =>
                                    picture.context.ui.packetBoard.quiz
                                      .slotEmpty,
                                  onSome: headerName,
                                },
                              )}`,
                            ),
                            ...(isLive
                              ? [
                                  h.OnClick(
                                    send(
                                      Message.ClickedHeaderSlot({ position }),
                                    ),
                                  ),
                                ]
                              : [h.Disabled(true)]),
                          ],
                          [
                            Option.match(Array.get(headers, position), {
                              onNone: () =>
                                picture.context.ui.packetBoard.quiz.slotEmpty,
                              onSome: headerName,
                            }),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                h.div(
                  [h.Class('pb-done')],
                  [
                    h.button(
                      [
                        h.Type('button'),
                        h.Class('btn'),
                        ...(isLive
                          ? [h.OnClick(send(Message.ClickedBuilderReset()))]
                          : [h.Disabled(true)]),
                      ],
                      [ui.reset],
                    ),
                    h.button(
                      [
                        h.Type('button'),
                        h.Class('btn primary'),
                        ...(isLive && headers.length === 4
                          ? [
                              h.OnClick(
                                send(
                                  Message.ClickedBuilderSend({
                                    from: item.from,
                                    url: item.url,
                                  }),
                                ),
                              ),
                            ]
                          : [h.Disabled(true)]),
                      ],
                      [ui.send],
                    ),
                  ],
                ),
              ],
            ),
          ]
        })(),
  )
}

const headerName = (level: StackLevel): string =>
  level === 'link'
    ? 'Wi-Fi / Ethernet'
    : level === 'internet'
      ? 'IP'
      : level === 'transport'
        ? 'TCP'
        : 'HTTP'

/** Под доской: выбор слоя, правила, чипы, «Готово», сборка конверта. */
export const quizTray = <ParentMessage>(
  picture: Picture,
  send: Send<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => {
  const multiDone = Option.match(picture.quiz, {
    onNone: () => [],
    onSome: marks =>
      marks.quiz.multiple &&
      marks.quiz.slots.length === 0 &&
      !marks.isAnswered &&
      picture.context.mode === 'Pick'
        ? [
            doneButton(
              picture,
              send,
              h,
              Array.isReadonlyArrayNonEmpty(picture.model.selection),
              picture.model.selection.length,
            ),
          ]
        : [],
  })
  const parts = [
    ...layerButtons(picture, send, h),
    ...ruleTable(picture, send, h),
    ...chipsTray(picture, send, h),
    ...multiDone,
    ...builderPanel(picture, send, h),
  ]
  return Array.isReadonlyArrayEmpty(parts)
    ? []
    : [h.div([h.Class('pb-tray')], parts)]
}

export type { NetState }
