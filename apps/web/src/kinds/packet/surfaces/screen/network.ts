import { Array, Option, pipe } from 'effect'

import { maskOf } from '../../../../net/address'
import { type Browsed, browse } from '../../../../net/browser'
import { findHost, linksOf } from '../../../../net/doc'
import type { NetMessage } from '../../../../net/message'
import type { Host } from '../../../../net/model'
import {
  type Iface,
  type NearbyNetwork,
  hostIface,
  linkFault,
  nearbyNetworks,
} from '../../../../net/topology'
import type { SurfaceContext } from '../../../contract'
import type { PacketTypes } from '../../../types'
import { momentsOf } from '../history'
import type { AddressDraft } from './screen'

// Что экран устройства читает из сети: подключение, адрес, DNS и последнюю
// открытую страницу. Всё — из документа и истории, а не из Model экрана.

type Context = SurfaceContext<PacketTypes>

export const hostOf = (context: Context): Option.Option<Host> =>
  findHost(context.doc.doc, context.target)

/** Экран телефона или окно компьютера. */
export const isPhone = (context: Context): boolean =>
  Option.exists(hostOf(context), host => host.kind === 'phone')

export const ifaceOf = (context: Context): Option.Option<Iface> =>
  Option.flatMap(hostOf(context), host =>
    hostIface(context.doc.doc, context.run.settled, host),
  )

/** Сеть Wi-Fi, к которой устройство подключено или пытается: если не
    вышло — почему (неверный пароль, далеко, точка выключена). */
export type WifiStatus = Readonly<{
  network: NearbyNetwork
  maybeProblem: Option.Option<NetMessage>
}>

export const wifiStatus = (context: Context): Option.Option<WifiStatus> =>
  pipe(
    hostOf(context),
    Option.flatMap(host => host.maybeWifiProfile),
    Option.flatMap(profile =>
      Array.findFirst(
        nearbyNetworks(context.doc.doc, context.target),
        network => network.linked && network.ssid === profile.ssid,
      ),
    ),
    Option.map(network => ({
      network,
      maybeProblem: pipe(
        Array.findFirst(
          linksOf(context.doc.doc, context.target),
          link =>
            link.medium === 'radio' &&
            (link.a === network.ap || link.b === network.ap),
        ),
        Option.flatMap(link =>
          linkFault(context.doc.doc, link, context.target),
        ),
      ),
    })),
  )

/** Подключён кабелем: сведения о сети открываются без Wi-Fi. */
export const isWired = (context: Context): boolean =>
  Array.some(
    linksOf(context.doc.doc, context.target),
    link =>
      link.medium === 'cable' &&
      Option.isNone(linkFault(context.doc.doc, link, context.target)),
  )

export type DnsSettings = Readonly<{
  isManual: boolean
  /** Серверы «вручную» или тот, что сообщил роутер. */
  servers: ReadonlyArray<string>
}>

export const dnsSettings = (context: Context): Option.Option<DnsSettings> =>
  Option.map(hostOf(context), host =>
    Option.match(host.maybeDnsOverride, {
      onSome: servers => ({ isManual: true, servers }),
      onNone: () => ({
        isManual: false,
        servers: pipe(
          ifaceOf(context),
          Option.flatMap(iface => iface.maybeDns),
          Option.toArray,
        ),
      }),
    }),
  )

/** Поля «Настройка адреса» по текущему адресу: вручную — как задано,
    автоматически — что выдал роутер, чтобы «Вручную» начиналось с них. */
export const addressSettings = (
  context: Context,
): Option.Option<AddressDraft> =>
  Option.map(hostOf(context), host => {
    const iface = ifaceOf(context)
    const text = (pick: (current: Iface) => Option.Option<string>) =>
      pipe(
        iface,
        Option.flatMap(pick),
        Option.getOrElse(() => ''),
      )
    return {
      mode: host.addressing._tag === 'Static' ? 'static' : 'dhcp',
      ip: text(current => Option.some(current.ip)),
      mask: text(current => Option.some(maskOf(current.prefix))),
      gateway: text(current => current.maybeGateway),
      dns: text(current => current.maybeDns),
    }
  })

/** Последний адрес, который устройство открыло, на мире до этого хода. */
const openedPage = (context: Context): Option.Option<Browsed> =>
  pipe(
    momentsOf(context.history),
    Array.findLast(
      moment =>
        moment.op._tag === 'Send' &&
        (moment.op.intent._tag === 'Browse' ||
          moment.op.intent._tag === 'Submit') &&
        moment.op.intent.from === context.target,
    ),
    Option.flatMap(moment =>
      moment.op._tag === 'Send' &&
      (moment.op.intent._tag === 'Browse' || moment.op.intent._tag === 'Submit')
        ? Option.some(
            browse(
              moment.before.doc,
              moment.before.state,
              context.target,
              moment.op.intent.url,
            ),
          )
        : Option.none(),
    ),
  )

/** Стартовая страница браузера (`homePage` устройства) на нынешней сети:
    видна, как только открывается, а до того браузер пуст. */
const homePage = (context: Context): Option.Option<Browsed> =>
  pipe(
    hostOf(context),
    Option.flatMap(host => host.maybeHomePage),
    Option.map(url =>
      browse(context.doc.doc, context.doc.state, context.target, url),
    ),
    Option.filter(browsed => browsed.view._tag === 'Page'),
  )

/** Открытая страница: последняя открытая, а если устройство ещё ничего не
    открывало — стартовая. */
export const currentPage = (context: Context): Option.Option<Browsed> =>
  pipe(
    openedPage(context),
    Option.orElse(() => homePage(context)),
  )
