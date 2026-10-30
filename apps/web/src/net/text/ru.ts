import { Option } from 'effect'

import { type AcmeProblem } from '../message'
import {
  type FirewallScope,
  type Medium,
  type Security,
  type WifiBand,
} from '../model'
import { type NetTexts, type TextContext } from './types'

const band = (value: WifiBand): string =>
  value === 'dual' ? '2,4 и 5 ГГц' : value === '2.4' ? '2,4 ГГц' : '5 ГГц'

const how: Readonly<Record<Medium, string>> = {
  cable: 'кабелем',
  radio: 'по Wi-Fi',
  cellular: 'сотовой связью',
  virtual: 'мостом Docker',
}

const up = (value: string): string => value.toUpperCase()

const q = (id: string, context: TextContext): string => `«${context.name(id)}»`

const of = (id: string, context: TextContext): string =>
  `устройства ${q(id, context)}`

const to = (id: string, context: TextContext): string =>
  `устройству ${q(id, context)}`

const on = (id: string, context: TextContext): string =>
  `устройстве ${q(id, context)}`

const acc = (id: string, context: TextContext): string =>
  `устройство ${q(id, context)}`

const all = (ids: ReadonlyArray<string>, context: TextContext): string =>
  ids.map(id => q(id, context)).join(', ')

const scope: Readonly<Record<FirewallScope, string>> = {
  os: 'Файрвол устройства',
  cloud: 'Файрвол хостинга',
  router: 'Файрвол роутера',
}

const ruleName = (maybeRule: Option.Option<number>): string =>
  Option.match(maybeRule, {
    onNone: () => 'строка «все остальные»',
    onSome: rule => `строка ${rule}`,
  })

const security: Readonly<Record<Security, string>> = {
  open: 'без пароля',
  wpa2: 'WPA2',
  wpa3: 'WPA3',
}

const acme: Readonly<Record<AcmeProblem, string>> = {
  'not-found': 'такого имени нет в DNS',
  refused: 'порт 80 закрыт',
  timeout: 'до порта 80 не достучаться',
  'wrong-server': 'по этому имени отвечает другой сервер',
}

export const ru: NetTexts = {
  UnknownDevice: ({ id }, c) => `Устройства ${q(id, c)} нет на доске.`,
  DuplicateDeviceId: ({ id }, c) => `Устройство ${q(id, c)} уже есть на доске.`,
  InvalidMac: ({ value }) =>
    `«${value}» — не MAC-адрес: нужно шесть пар символов через двоеточие.`,
  DuplicateMac: ({ mac, owner }, c) => `MAC ${mac} уже есть у ${of(owner, c)}.`,
  InvalidIp: ({ value }) =>
    `«${value}» — не адрес: нужно четыре числа от 0 до 255 через точку.`,
  InvalidPrefix: ({ value }) => `Маска /${value} не подходит.`,
  AddressNotUsable: ({ ip, prefix }) =>
    `Адрес ${ip}/${prefix} нельзя дать устройству: это адрес самой сети или адрес «для всех».`,
  GatewayOutsideSubnet: ({ gateway, ip, prefix }) =>
    `Роутер ${gateway} не в сети ${ip}/${prefix}: устройство до него не достанет.`,
  OnlyOneInternet: () => 'Интернет на доске может быть только один.',
  ConnectSelf: ({ id }, c) =>
    `Устройство ${q(id, c)} нельзя соединить с самим собой.`,
  AlreadyLinked: ({ a, b }, c) => `${q(a, c)} и ${q(b, c)} уже соединены.`,
  UnknownLink: ({ a, b }, c) =>
    `Между устройствами ${q(a, c)} и ${q(b, c)} нет связи.`,
  PortBusy: ({ device }, c) =>
    `У ${of(device, c)} один разъём, и он уже занят.`,
  RadioNeedsAccessPoint: ({ a, b }, c) =>
    `По Wi-Fi подключаются к роутеру или точке доступа, а ${q(a, c)} и ${q(b, c)} — не они.`,
  NoWifiOnDevice: ({ device }, c) =>
    `У ${of(device, c)} нет Wi-Fi: подключите его кабелем.`,
  InternetNeedsRouter: ({ device }, c) =>
    `К интернету подключают роутер или сервер, а не ${acc(device, c)}.`,
  SecondWanLink: ({ router }, c) =>
    `У ${of(router, c)} уже есть выход в интернет.`,
  LinkMakesLoop: ({ a, b }, c) =>
    `Связь ${q(a, c)} — ${q(b, c)} замкнёт кольцо: конверты бегали бы по кругу.`,
  NotAHost: ({ id }, c) =>
    `Это делают на компьютере, телефоне или сервере, а не на ${on(id, c)}.`,
  NotARouter: ({ id }, c) =>
    `Это настройка роутера, а ${q(id, c)} — не роутер.`,
  NotAnAccessPoint: ({ id }, c) =>
    `У ${of(id, c)} нет своей сети Wi-Fi, её нельзя настроить.`,
  DhcpPoolOutsideSubnet: ({ start, end, network, prefix }) =>
    `Адреса ${start}–${end} не из домашней сети ${network}/${prefix}.`,
  DhcpPoolReversed: ({ start, end }) =>
    `Начало пула ${start} больше его конца ${end}.`,
  DhcpPoolIncludesRouter: ({ ip }) => `В пул попал адрес самого роутера ${ip}.`,
  ReservationOutsideSubnet: ({ mac, ip }) =>
    `Адрес ${ip} для ${mac} не из домашней сети.`,
  ReservationTaken: ({ ip, mac }) => `Адрес ${ip} уже закреплён за ${mac}.`,
  EmptySsid: () => 'У сети Wi-Fi должно быть имя.',
  WifiPasswordTooShort: ({ min }) =>
    `Пароль Wi-Fi должен быть не короче ${min} символов.`,
  InvalidChannel: ({ band: value, channel }) =>
    `Канала ${channel} нет в диапазоне ${band(value)}.`,
  InvalidPort: ({ value }) =>
    `Порт ${value} не подходит: нужен номер от 1 до 65535.`,
  EmptyName: () => 'Имя не может быть пустым.',

  WifiOff: ({ ap }, c) => `Wi-Fi на ${on(ap, c)} выключен.`,
  NoWifiProfile: ({ device }, c) =>
    `${q(device, c)} ещё не знает пароль от этой сети Wi-Fi.`,
  WrongSsid: ({ device, ssid, ap }, c) =>
    `${q(device, c)} ищет сеть «${ssid}», а ${q(ap, c)} раздаёт другую.`,
  WrongPassword: ({ device, ssid }, c) =>
    `Пароль от «${ssid}» не подошёл, и ${q(device, c)} не может подключиться.`,
  BandUnsupported: ({ device, band: value }, c) =>
    `${q(device, c)} не умеет работать на ${band(value)}.`,
  OutOfRange: ({ device, ap }, c) =>
    `${q(device, c)} слишком далеко от ${of(ap, c)}: сигнал не долетает.`,

  FrameReceived: ({ device }, c) => `${q(device, c)} получает конверт.`,
  FrameNotForMe: ({ device }, c) =>
    `${q(device, c)} видит, что конверт не ему, и выбрасывает его.`,
  FrameForwarded: ({ device }, c) =>
    `${q(device, c)} знает, где получатель, и передаёт конверт только туда.`,
  FrameFlooded: ({ device }, c) =>
    `${q(device, c)} не знает, где получатель, и отправляет конверт во все стороны.`,
  FrameBroadcast: ({ device }, c) =>
    `Конверт «для всех»: ${q(device, c)} рассылает его во все стороны.`,
  FrameFiltered: ({ device }, c) =>
    `${q(device, c)} не пересылает конверт: получатель там же, откуда он пришёл.`,
  PacketRouted: ({ device }, c) =>
    `${q(device, c)} передаёт конверт дальше по пути.`,
  PacketIgnored: ({ device }, c) =>
    `${q(device, c)} не отвечает: вопрос не к нему.`,
  ArpIsMine: ({ device, ip }, c) =>
    `${q(device, c)}: «${ip} — это я», и отвечает.`,
  ArpNotMine: ({ device, ip }, c) =>
    `${q(device, c)}: «${ip} — не мой адрес», и молчит.`,
  DhcpServerOff: ({ router }, c) =>
    `${q(router, c)} не раздаёт адреса: DHCP выключен.`,

  NoLink: ({ device }, c) => `У ${of(device, c)} нет ни кабеля, ни Wi-Fi.`,
  LinkDown: ({ device }, c) =>
    `У ${of(device, c)} связь выключена, конверт не уходит.`,
  NoAddress: ({ device }, c) =>
    `У ${of(device, c)} нет адреса, поэтому конверт не уходит.`,
  UsesStaticAddress: ({ device }, c) =>
    `У ${of(device, c)} адрес задан вручную, просить его у роутера не нужно.`,
  NoGateway: ({ device, ip }, c) =>
    `${q(device, c)} не знает, через кого отправить конверт на ${ip}: роутер не задан.`,
  NoDnsServer: ({ device }, c) =>
    `${q(device, c)} не знает, у кого спросить адрес по имени: DNS не задан.`,
  ArpNoReply: ({ device, ip }, c) =>
    `Никто не отозвался на адрес ${ip}, и ${q(device, c)} не может отправить конверт.`,
  NoDhcpServer: ({ device }, c) =>
    `Никто не выдал ${to(device, c)} адрес: рядом нет роутера с DHCP.`,
  DhcpPoolExhausted: ({ router }, c) =>
    `У ${of(router, c)} закончились свободные адреса.`,
  TtlExpired: ({ device }, c) =>
    `Конверт слишком долго в пути, и ${q(device, c)} выбрасывает его (TTL кончился).`,
  NoRouteToHost: ({ ip }) => `В интернете нет никого с адресом ${ip}.`,
  PrivateAddressNotRoutable: ({ ip }) =>
    `${ip} — домашний адрес: в интернете по нему никого не найти.`,
  NoWanLink: ({ router }, c) => `У ${of(router, c)} нет связи с интернетом.`,
  NatNoMapping: ({ router, proto, port }, c) =>
    `${q(router, c)} не ждал этого конверта (${up(proto)} ${port}) и выбрасывает его.`,
  PortClosed: ({ device, proto, port }, c) =>
    `На ${on(device, c)} никто не слушает порт ${port} (${up(proto)}), соединение отклонено.`,
  ListensOnlyOnLoopback: ({ device, port }, c) =>
    `Порт ${port} на ${on(device, c)} открыт только для него самого (127.0.0.1).`,
  NameNotFound: ({ name }) => `Имени ${name} нет в справочной DNS.`,
  InvalidUrl: ({ url }) => `«${url}» — не адрес сайта.`,
  FrameLost: ({ device }, c) => `Конверт потерялся на ${on(device, c)}.`,

  GoalNotLinked: ({ a, b }, c) => `${q(a, c)} и ${q(b, c)} ещё не соединены.`,
  GoalWrongMedium: ({ a, b, want }, c) =>
    `${q(a, c)} и ${q(b, c)} нужно соединить ${how[want]}.`,
  GoalLinkDown: ({ a, b }, c) => `Связь ${q(a, c)} — ${q(b, c)} выключена.`,
  GoalNoRadioLink: ({ device, ap }, c) =>
    `Между устройствами ${q(device, c)} и ${q(ap, c)} нет связи по Wi-Fi.`,
  GoalWrongAddress: ({ device, have, want }, c) =>
    `У ${of(device, c)} адрес ${have}, а нужен ${want}.`,
  AddressConflict: ({ ip, devices }, c) =>
    `Адрес ${ip} сразу у нескольких устройств: ${all(devices, c)}.`,
  GoalReachable: ({ from, at }, c) =>
    `Конверт от ${of(from, c)} доходит до ${of(at, c)}, а не должен.`,
  GoalNotListening: ({ device, proto, port }, c) =>
    `На ${on(device, c)} никто не слушает порт ${port} (${up(proto)}).`,
  GoalListeningOnWrongAddress: ({ device, port, bind, want }, c) =>
    `Порт ${port} на ${on(device, c)} слушают на ${bind}, а нужно на ${want}.`,
  GoalResolvesElsewhere: ({ name, have, want }) =>
    `Имя ${name} ведёт на ${have}, а нужно на ${want}.`,

  InvalidCidr: ({ value }) => `«${value}» — не сеть: нужен вид 10.0.0.0/8.`,
  CellularNeedsOperator: ({ a, b }, c) =>
    `Сотовая связь соединяет телефон с оператором, а не ${q(a, c)} с ${q(b, c)}.`,
  VirtualNeedsContainer: ({ a, b }, c) =>
    `Мост Docker соединяет контейнер только с его хостом, а не ${q(a, c)} с ${q(b, c)}.`,
  NotATransit: ({ id }, c) => `${q(id, c)} — не роутер провайдера.`,
  NotAVpnGateway: ({ id }, c) => `${q(id, c)} — не VPN-шлюз.`,
  NotADockerHost: ({ id }, c) => `На ${on(id, c)} не запущен Docker.`,
  NoVpnClient: ({ device }, c) => `На ${on(device, c)} не настроен VPN.`,
  RouteViaOutsideLan: ({ via }) =>
    `Следующий роутер ${via} должен быть в домашней сети.`,
  NotANeighbour: ({ device, via }, c) =>
    `${q(via, c)} не соединён с ${of(device, c)} напрямую.`,
  ForwardOutsideLan: ({ ip }) =>
    `Проброс ведёт на ${ip}, а нужен адрес из вашего дома.`,
  ForwardPortTaken: ({ proto, port }) =>
    `Правило для ${up(proto)} ${port} уже есть.`,
  UnknownForward: ({ proto, port }) => `Правила для ${up(proto)} ${port} нет.`,
  UnknownZone: ({ zone }) => `Домена ${zone} нет у этого DNS-сервера.`,
  UnknownRecord: ({ name, rtype }) => `Записи ${rtype} у ${name} нет.`,
  RecordNeedsAddress: ({ rtype, value }) =>
    `Запись ${rtype} указывает на адрес, а «${value}» — не адрес.`,
  CnameNeedsName: ({ value }) =>
    `CNAME указывает на имя, а не на адрес «${value}». Для адреса нужна запись A.`,
  CnameAtApex: ({ zone }) =>
    `CNAME нельзя ставить на сам домен ${zone} (@): для @ нужна запись A.`,
  CnameConflict: ({ name }) =>
    `У ${name} уже есть другие записи, поэтому CNAME рядом с ними поставить нельзя.`,
  SplitTunnelEmpty: () =>
    'В режиме «Только рабочие сети» список не может быть пустым: тогда в туннель не пойдёт ничего.',
  InvalidPortMapping: ({ value }) =>
    `«${value}» — не публикация порта: пишут «снаружи:внутри», например 8080:3000.`,
  HostPortTaken: ({ port }) => `Порт ${port} хоста уже занят другой дверью.`,
  NoRelay: () => 'Посредника для туннеля на доске нет.',
  NoCertificateAuthority: () => 'Центра сертификации на доске нет.',
  NameIsAddress: ({ value }) => `Нужно имя сайта, а не адрес ${value}.`,
  AcmeChallengeFailed: ({ name, problem }) =>
    `Центр сертификации не подтвердил ${name}: ${acme[problem]}.`,

  ForeignOpenNetwork: ({ ssid }) =>
    `«${ssid}» — открытая чужая сеть: подключиться может любой прохожий. Выберите свою сеть с наклейки.`,
  ForeignNetwork: ({ ssid }) =>
    `«${ssid}» — не ваша сеть. Сверьте имя с наклейкой на роутере.`,
  NetworkNotFound: ({ ssid }) => `Сети «${ssid}» рядом нет.`,

  FirewallAllowed: ({ scope: where, maybeRule }) =>
    `${scope[where]} пропускает конверт: ${ruleName(maybeRule)}.`,
  TunnelUnwrapped: ({ device }, c) =>
    `${q(device, c)} достаёт конверт из туннеля.`,
  RelayPassed: ({ device }, c) =>
    `${q(device, c)} передаёт конверт дальше по линии.`,
  PortPublished: ({ device, port, container }, c) =>
    `${q(device, c)} отдаёт конверт с порта ${port} в контейнер ${q(container, c)}.`,

  GatewayUnreachable: ({ gateway }) =>
    `Шлюз ${gateway} не отвечает: такого устройства в сети нет.`,
  GatewayIsSelf: ({ device }, c) =>
    `${q(device, c)} указывает шлюзом сам себя. Шлюз — это роутер.`,
  GatewayNotARouter: ({ gateway }) =>
    `${gateway} — не роутер: чужие конверты дальше он не передаёт.`,
  PublishedPortClosed: ({ device, port }, c) =>
    `Дверь открылась, но в ${q(device, c)} порт ${port} никто не слушает: ответ пустой.`,
  AppDown: ({ device, host, port }, c) =>
    `${q(device, c)} падает: не может достучаться до ${host}:${port}.`,
  FirewallDropped: ({ scope: where, maybeRule }) =>
    `${scope[where]} молча выбрасывает конверт (${ruleName(maybeRule)}).`,
  FirewallRejected: ({ scope: where, maybeRule }) =>
    `${scope[where]} сразу отказывает (${ruleName(maybeRule)}).`,
  TunnelNoRoute: ({ gateway, ip }, c) =>
    `У ${of(gateway, c)} нет пути к ${ip}: этой сети нет в офисе.`,
  NotConnected: ({ device }, c) => `У ${of(device, c)} туннель не подключён.`,
  TunnelNotFound: ({ name }) => `Туннеля ${name} нет: страница 404.`,
  UpstreamFailed: ({ device, port }, c) =>
    `За ${q(device, c)} на порту ${port} никто не отвечает: 502 Bad Gateway.`,
  CertNameMismatch: ({ name, names }) =>
    `Сертификат выдан на ${names.join(', ')}, а не на ${name}.`,
  CertExpired: ({ name, notAfter }) => `Сертификат ${name} истёк ${notAfter}.`,
  CertUntrusted: ({ name, issuer }) =>
    `Сертификат ${name} выдал «${issuer}», а ему браузер не верит.`,
  TlsNotConfigured: ({ device, port }, c) =>
    `На ${on(device, c)} порт ${port} не умеет HTTPS: сертификата нет.`,
  HttpError: ({ device, status }, c) =>
    `${q(device, c)} отвечает ошибкой ${status}.`,

  SeveralAddresses: ({ name, ips }) =>
    `У ${name} несколько адресов: ${ips.join(', ')}. Часть посетителей попадёт не туда.`,
  GoalWifiTooWeak: ({ ap, security: have, want }, c) =>
    `Wi-Fi ${of(ap, c)} — ${security[have]}, а нужно не слабее ${security[want]}.`,
  GoalChannelBusy: ({ ap, others }, c) =>
    `Канал ${of(ap, c)} пересекается с соседями: ${all(others, c)}.`,
  GoalNotPerformed: ({ from, at }, c) =>
    `Конверт от ${of(from, c)} ещё не дошёл до ${of(at, c)}.`,
  GoalNoRecord: ({ zone, name, rtype }) =>
    `В домене ${zone} нет записи ${rtype} для ${name}.`,
  GoalRecordValue: ({ name, rtype, have, want }) =>
    `Запись ${rtype} у ${name} — ${have.join(', ')}, а нужно ${want}.`,
  GoalCommandNotRun: ({ device, commands }, c) =>
    `На ${on(device, c)} ещё не запускали ${commands.join(' или ')}.`,
  GoalCommandSawOther: ({ name, saw, want }) =>
    `Команда показала ${saw.join(', ') || 'пусто'} для ${name}, а ждём ${want}.`,
  GoalExtraOpenPort: ({ target, port }) =>
    `Снаружи открыт лишний порт ${port} на ${target}.`,
  GoalPortNotOpen: ({ target, port }) =>
    `Порт ${port} на ${target} закрыт, а должен быть открыт.`,
  GoalNotRedirected: ({ url, status }) =>
    `${url} не перенаправляет на https:// (ответ ${status}).`,
  GoalNotThrough: ({ device }, c) => `Конверт идёт мимо ${of(device, c)}.`,
  GoalThrough: ({ device }, c) =>
    `Конверт идёт через ${acc(device, c)}, а должен напрямую.`,
  GoalNoDevice: ({ id }, c) => `На доске ещё нет ${of(id, c)}.`,
  SshLockedOut: ({ device }, c) =>
    `Вы закрыли вход по ssh сами себе: ${q(device, c)} больше вас не пускает.`,

  UnknownCommand: ({ command, available }) =>
    `Команды ${command} здесь нет. Попробуйте: ${available.join(', ')}.`,
  CommandLocked: ({ command, available }) =>
    `Команда ${command} откроется позже в курсе. Сейчас доступны: ${available.join(', ')}.`,
  CommandUsage: ({ usage }) => `Так пишут эту команду: ${usage}.`,
  NoLinkLayer: ({ device }, c) =>
    `${q(device, c)} не может прочитать конверт: снаружи должен быть кадр с MAC.`,
  NoAddressLayer: ({ device }, c) =>
    `${q(device, c)} не находит адрес получателя: IP должен идти сразу за кадром.`,
  NoPortLayer: ({ device }, c) =>
    `${q(device, c)} не находит номер порта: TCP должен идти сразу за IP.`,
  EnvelopeMisordered: ({ position, expected, found }) =>
    `На месте ${position} должен быть слой ${expected}, а лежит ${found || 'пусто'}.`,
}
