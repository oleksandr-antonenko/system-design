import { type Medium, type WifiBand } from '../model'
import { type NetTexts, type TextContext } from './types'

const band = (value: WifiBand): string =>
  value === 'dual' ? '2,4 и 5 ГГц' : value === '2.4' ? '2,4 ГГц' : '5 ГГц'

const how: Readonly<Record<Medium, string>> = {
  cable: 'кабелем',
  radio: 'по Wi-Fi',
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
}
