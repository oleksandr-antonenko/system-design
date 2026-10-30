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
  value === 'dual' ? '2.4 и 5 GHz' : value === '2.4' ? '2.4 GHz' : '5 GHz'

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
  os: 'Firewall устройства',
  cloud: 'Firewall хостинга',
  router: 'Firewall домашней сети',
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
  refused: 'port 80 закрыт',
  timeout: 'port 80 не отвечает',
  'wrong-server': 'по этому имени отвечает другой server',
}

export const ru: NetTexts = {
  UnknownDevice: ({ id }, c) => `Устройства ${q(id, c)} нет на доске.`,
  DuplicateDeviceId: ({ id }, c) => `Устройство ${q(id, c)} уже есть на доске.`,
  InvalidMac: ({ value }) =>
    `«${value}» — не MAC address: нужно шесть пар символов через двоеточие.`,
  DuplicateMac: ({ mac, owner }, c) =>
    `MAC address ${mac} уже есть у ${of(owner, c)}.`,
  InvalidIp: ({ value }) =>
    `«${value}» — не IP address: нужно четыре числа от 0 до 255 через точку.`,
  InvalidPrefix: ({ value }) => `Subnet mask /${value} не подходит.`,
  AddressNotUsable: ({ ip, prefix }) =>
    `IP address ${ip}/${prefix} нельзя дать устройству: это адрес самой сети или адрес «для всех».`,
  GatewayOutsideSubnet: ({ gateway, ip, prefix }) =>
    `Router ${gateway} не в сети ${ip}/${prefix}: устройство до него не достанет.`,
  OnlyOneInternet: () => 'Облако «Internet» на доске может быть только одно.',
  ConnectSelf: ({ id }, c) =>
    `Устройство ${q(id, c)} нельзя соединить с самим собой.`,
  AlreadyLinked: ({ a, b }, c) => `${q(a, c)} и ${q(b, c)} уже соединены.`,
  UnknownLink: ({ a, b }, c) =>
    `Между устройствами ${q(a, c)} и ${q(b, c)} нет связи.`,
  PortBusy: ({ device }, c) =>
    `У ${of(device, c)} один разъём, и он уже занят.`,
  RadioNeedsAccessPoint: ({ a, b }, c) =>
    `Wi-Fi раздаёт router или access point, а ${q(a, c)} и ${q(b, c)} — не они.`,
  NoWifiOnDevice: ({ device }, c) =>
    `У ${of(device, c)} нет Wi-Fi: подключите его кабелем.`,
  InternetNeedsRouter: ({ device }, c) =>
    `К интернету подключают router или server, а не ${acc(device, c)}.`,
  SecondWanLink: ({ router }, c) =>
    `У ${of(router, c)} уже есть выход в интернет.`,
  LinkMakesLoop: ({ a, b }, c) =>
    `Связь ${q(a, c)} — ${q(b, c)} замкнёт кольцо: конверты бегали бы по кругу.`,
  NotAHost: ({ id }, c) =>
    `Это делает компьютер, телефон или server, а не ${acc(id, c)}.`,
  NotARouter: ({ id }, c) =>
    `${q(id, c)} — не router: такой настройки у него нет.`,
  NotAnAccessPoint: ({ id }, c) =>
    `У ${of(id, c)} нет своей сети Wi-Fi, её нельзя настроить.`,
  DhcpPoolOutsideSubnet: ({ start, end, network, prefix }) =>
    `DHCP pool ${start}–${end} не входит в домашнюю сеть ${network}/${prefix}.`,
  DhcpPoolReversed: ({ start, end }) =>
    `DHCP pool начинается с ${start}, а это больше его конца ${end}.`,
  DhcpPoolIncludesRouter: ({ ip }) =>
    `В DHCP pool попал ${ip}, а это IP address, который занимает сам router.`,
  ReservationOutsideSubnet: ({ mac, ip }) =>
    `IP address ${ip} для ${mac} не из домашней сети.`,
  ReservationTaken: ({ ip, mac }) =>
    `IP address ${ip} уже закреплён за ${mac}.`,
  EmptySsid: () => 'У сети Wi-Fi должен быть SSID — имя сети.',
  WifiPasswordTooShort: ({ min }) =>
    `Пароль Wi-Fi должен быть не короче ${min} символов.`,
  InvalidChannel: ({ band: value, channel }) =>
    `Канала ${channel} нет в диапазоне ${band(value)}.`,
  InvalidPort: ({ value }) =>
    `Port ${value} не подходит: нужен номер от 1 до 65535.`,
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
    `У ${of(device, c)} нет IP, поэтому конверт не уходит.`,
  UsesStaticAddress: ({ device }, c) =>
    `У ${of(device, c)} IP address задан вручную, просить его через DHCP не нужно.`,
  NoGateway: ({ device, ip }, c) =>
    `${q(device, c)} не знает, через кого отправить конверт на ${ip}: router (gateway) не задан.`,
  NoDnsServer: ({ device }, c) =>
    `${q(device, c)} не знает, у кого спросить адрес по имени: DNS server не задан.`,
  ArpNoReply: ({ device, ip }, c) =>
    `Никто не отозвался на адрес ${ip}, и ${q(device, c)} не может отправить конверт.`,
  NoDhcpServer: ({ device }, c) =>
    `Никто не выдал ${to(device, c)} IP address: рядом никто не раздаёт адреса по DHCP.`,
  DhcpPoolExhausted: ({ router }, c) =>
    `У ${of(router, c)} в DHCP pool не осталось свободных адресов.`,
  TtlExpired: ({ device }, c) =>
    `Конверт слишком долго в пути, и ${q(device, c)} выбрасывает его (TTL кончился).`,
  NoRouteToHost: ({ ip }) =>
    `IP address ${ip} в интернете никому не принадлежит.`,
  PrivateAddressNotRoutable: ({ ip }) =>
    `${ip} — private IP, домашний адрес: в интернете по нему никого не найти.`,
  NoWanLink: ({ router }, c) => `У ${of(router, c)} нет связи с интернетом.`,
  NatNoMapping: ({ router, proto, port }, c) =>
    `${q(router, c)} не ждал этого конверта (${up(proto)} ${port}) и выбрасывает его.`,
  PortClosed: ({ device, proto, port }, c) =>
    `На ${on(device, c)} никто не слушает port ${port} (${up(proto)}), соединение отклонено.`,
  ListensOnlyOnLoopback: ({ device, port }, c) =>
    `Port ${port} на ${on(device, c)} открыт только для него самого (127.0.0.1).`,
  NameNotFound: ({ name }) => `Имени ${name} нет в DNS.`,
  InvalidUrl: ({ url }) => `«${url}» — не адрес сайта.`,
  FrameLost: ({ device }, c) => `Конверт потерялся на ${on(device, c)}.`,

  GoalNotLinked: ({ a, b }, c) => `${q(a, c)} и ${q(b, c)} ещё не соединены.`,
  GoalWrongMedium: ({ a, b, want }, c) =>
    `${q(a, c)} и ${q(b, c)} нужно соединить ${how[want]}.`,
  GoalLinkDown: ({ a, b }, c) => `Связь ${q(a, c)} — ${q(b, c)} выключена.`,
  GoalNoRadioLink: ({ device, ap }, c) =>
    `Между устройствами ${q(device, c)} и ${q(ap, c)} нет связи по Wi-Fi.`,
  GoalWrongAddress: ({ device, have, want }, c) =>
    `У ${of(device, c)} IP address ${have}, а нужен ${want}.`,
  AddressConflict: ({ ip, devices }, c) =>
    `IP address ${ip} сразу у нескольких устройств: ${all(devices, c)}.`,
  GoalReachable: ({ from, at }, c) =>
    `Конверт от ${of(from, c)} доходит до ${of(at, c)}, а не должен.`,
  GoalNotListening: ({ device, proto, port }, c) =>
    `На ${on(device, c)} никто не слушает port ${port} (${up(proto)}).`,
  GoalListeningOnWrongAddress: ({ device, port, bind, want }, c) =>
    `Port ${port} на ${on(device, c)} слушают на ${bind}, а нужно на ${want}.`,
  GoalResolvesElsewhere: ({ name, have, want }) =>
    `Имя ${name} ведёт на ${have}, а нужно на ${want}.`,

  InvalidCidr: ({ value }) => `«${value}» — не сеть: нужен вид 10.0.0.0/8.`,
  CellularNeedsOperator: ({ a, b }, c) =>
    `Сотовая связь соединяет телефон с оператором, а не ${q(a, c)} с ${q(b, c)}.`,
  VirtualNeedsContainer: ({ a, b }, c) =>
    `Мост Docker соединяет container только с его хостом, а не ${q(a, c)} с ${q(b, c)}.`,
  NotATransit: ({ id }, c) => `${q(id, c)} — не ISP router.`,
  NotAVpnGateway: ({ id }, c) => `${q(id, c)} — не VPN gateway.`,
  NotADockerHost: ({ id }, c) => `На ${on(id, c)} не запущен Docker.`,
  NoVpnClient: ({ device }, c) => `На ${on(device, c)} не настроен VPN.`,
  RouteViaOutsideLan: ({ via }) =>
    `Следующий router ${via} должен быть в домашней сети.`,
  NotANeighbour: ({ device, via }, c) =>
    `${q(via, c)} не соединён с ${of(device, c)} напрямую.`,
  ForwardOutsideLan: ({ ip }) =>
    `Port forwarding ведёт на ${ip}, а нужен IP address из вашего дома.`,
  ForwardPortTaken: ({ proto, port }) =>
    `Правило для ${up(proto)} ${port} уже есть.`,
  UnknownForward: ({ proto, port }) => `Правила для ${up(proto)} ${port} нет.`,
  UnknownZone: ({ zone }) => `Этот DNS server не обслуживает domain ${zone}.`,
  UnknownRecord: ({ name, rtype }) =>
    `DNS record ${rtype} для ${name} не найдена.`,
  RecordNeedsAddress: ({ rtype, value }) =>
    `DNS record ${rtype} указывает на IP address, а «${value}» — не IP address.`,
  CnameNeedsName: ({ value }) =>
    `CNAME указывает на имя, а не на IP address «${value}». IP address записывают в DNS record A.`,
  CnameAtApex: ({ zone }) =>
    `CNAME нельзя ставить на сам domain ${zone} (@): для @ нужна DNS record A.`,
  CnameConflict: ({ name }) =>
    `У ${name} уже есть другие записи, поэтому CNAME рядом с ними поставить нельзя.`,
  SplitTunnelEmpty: () =>
    'В режиме «Только рабочие сети» список не может быть пустым: тогда в tunnel не пойдёт ничего.',
  InvalidPortMapping: ({ value }) =>
    `Port публикуют так: «снаружи:внутри», например 8080:3000, а «${value}» — не такая запись.`,
  HostPortTaken: ({ port }) => `Port ${port} хоста уже занят другой дверью.`,
  NoRelay: () => 'Relay на доске отсутствует, а tunnel идёт через него.',
  NoCertificateAuthority: () => 'Certificate authority на доске отсутствует.',
  NameIsAddress: ({ value }) => `Нужно имя сайта, а не IP address ${value}.`,
  AcmeChallengeFailed: ({ name, problem }) =>
    `Certificate authority не подтвердил ${name}: ${acme[problem]}.`,

  ForeignOpenNetwork: ({ ssid }) =>
    `«${ssid}» — открытая чужая сеть: подключиться может любой прохожий. Выберите свою сеть с наклейки.`,
  ForeignNetwork: ({ ssid }) =>
    `«${ssid}» — не ваша сеть. Сверьте SSID с наклейкой у «Router».`,
  NetworkNotFound: ({ ssid }) => `Сети «${ssid}» рядом нет.`,

  FirewallAllowed: ({ scope: where, maybeRule }) =>
    `${scope[where]} пропускает конверт: ${ruleName(maybeRule)}.`,
  TunnelUnwrapped: ({ device }, c) =>
    `${q(device, c)} открывает tunnel и достаёт конверт.`,
  RelayPassed: ({ device }, c) =>
    `${q(device, c)} передаёт конверт дальше по линии.`,
  PortPublished: ({ device, port, container }, c) =>
    `${q(device, c)} передаёт конверт, пришедший на port ${port}, в container ${q(container, c)}.`,

  GatewayUnreachable: ({ gateway }) =>
    `Gateway ${gateway} не отвечает: такого устройства в сети нет.`,
  GatewayIsSelf: ({ device }, c) =>
    `${q(device, c)} указал gateway — сам себя. А gateway — это router.`,
  GatewayNotARouter: ({ gateway }) =>
    `${gateway} — не router: чужие конверты дальше он не передаёт.`,
  PublishedPortClosed: ({ device, port }, c) =>
    `Дверь открылась, но в ${q(device, c)} port ${port} никто не слушает: ответ пустой.`,
  AppDown: ({ device, host, port }, c) =>
    `${q(device, c)} падает: не может достучаться до ${host}:${port}.`,
  FirewallDropped: ({ scope: where, maybeRule }) =>
    `${scope[where]} молча выбрасывает конверт (${ruleName(maybeRule)}).`,
  FirewallRejected: ({ scope: where, maybeRule }) =>
    `${scope[where]} сразу отказывает (${ruleName(maybeRule)}).`,
  TunnelNoRoute: ({ gateway, ip }, c) =>
    `У ${of(gateway, c)} нет пути к ${ip}: этой сети нет в офисе.`,
  NotConnected: ({ device }, c) => `У ${of(device, c)} tunnel не подключён.`,
  TunnelNotFound: ({ name }) => `Tunnel ${name} не найден: страница 404.`,
  UpstreamFailed: ({ device, port }, c) =>
    `За ${q(device, c)} никто не отвечает на port ${port}: 502 Bad Gateway.`,
  CertNameMismatch: ({ name, names }) =>
    `Certificate выдан на ${names.join(', ')}, а не на ${name}.`,
  CertExpired: ({ name, notAfter }) => `Certificate ${name} истёк ${notAfter}.`,
  CertUntrusted: ({ name, issuer }) =>
    `Certificate ${name} выдал «${issuer}», а ему браузер не верит.`,
  TlsNotConfigured: ({ device, port }, c) =>
    `На ${on(device, c)} port ${port} не умеет HTTPS: certificate не установлен.`,
  HttpError: ({ device, status }, c) =>
    `${q(device, c)} отвечает ошибкой ${status}.`,

  SeveralAddresses: ({ name, ips }) =>
    `${name} ведёт сразу на несколько адресов: ${ips.join(', ')}. Часть посетителей попадёт не туда.`,
  GoalWifiTooWeak: ({ ap, security: have, want }, c) =>
    `Wi-Fi ${of(ap, c)} — ${security[have]}, а нужно не слабее ${security[want]}.`,
  GoalChannelBusy: ({ ap, others }, c) =>
    `Канал ${of(ap, c)} пересекается с соседями: ${all(others, c)}.`,
  GoalNotPerformed: ({ from, at }, c) =>
    `Конверт от ${of(from, c)} ещё не дошёл до ${of(at, c)}.`,
  GoalNoRecord: ({ zone, name, rtype }) =>
    `DNS record ${rtype} для ${name} в ${zone} не найдена.`,
  GoalRecordValue: ({ name, rtype, have, want }) =>
    `DNS record ${rtype} у ${name} — ${have.join(', ')}, а нужно ${want}.`,
  GoalCommandNotRun: ({ device, commands }, c) =>
    `На ${on(device, c)} ещё не запускали ${commands.join(' или ')}.`,
  GoalCommandSawOther: ({ name, saw, want }) =>
    `Команда показала ${saw.join(', ') || 'пусто'} для ${name}, а ждём ${want}.`,
  GoalExtraOpenPort: ({ target, port }) =>
    `Снаружи открыт лишний port ${port} на ${target}.`,
  GoalPortNotOpen: ({ target, port }) =>
    `Port ${port} на ${target} закрыт, а должен быть открыт.`,
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
    `${q(device, c)} не может прочитать конверт: снаружи должен быть frame с MAC.`,
  NoAddressLayer: ({ device }, c) =>
    `${q(device, c)} не находит IP address получателя: первым слоем идёт frame, вторым должен быть IP.`,
  NoPortLayer: ({ device }, c) =>
    `${q(device, c)} не находит port: TCP должен идти сразу за IP.`,
  EnvelopeMisordered: ({ position, expected, found }) =>
    `На месте ${position} должен быть слой ${expected}, а лежит ${found || 'пусто'}.`,
}
