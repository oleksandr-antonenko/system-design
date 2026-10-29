import { type Medium, type WifiBand } from '../model'
import { type NetTexts, type TextContext } from './types'

const band = (value: WifiBand): string =>
  value === 'dual' ? '2,4 і 5 ГГц' : value === '2.4' ? '2,4 ГГц' : '5 ГГц'

const how: Readonly<Record<Medium, string>> = {
  cable: 'кабелем',
  radio: 'через Wi-Fi',
}

const up = (value: string): string => value.toUpperCase()

const q = (id: string, context: TextContext): string => `«${context.name(id)}»`

const of = (id: string, context: TextContext): string =>
  `пристрою ${q(id, context)}`

const on = (id: string, context: TextContext): string =>
  `пристрої ${q(id, context)}`

const acc = (id: string, context: TextContext): string =>
  `пристрій ${q(id, context)}`

const all = (ids: ReadonlyArray<string>, context: TextContext): string =>
  ids.map(id => q(id, context)).join(', ')

export const uk: NetTexts = {
  UnknownDevice: ({ id }, c) => `Пристрою ${q(id, c)} немає на дошці.`,
  DuplicateDeviceId: ({ id }, c) => `Пристрій ${q(id, c)} уже є на дошці.`,
  InvalidMac: ({ value }) =>
    `«${value}» — не MAC-адреса: потрібно шість пар символів через двокрапку.`,
  DuplicateMac: ({ mac, owner }, c) => `MAC ${mac} уже є в ${of(owner, c)}.`,
  InvalidIp: ({ value }) =>
    `«${value}» — не адреса: потрібно чотири числа від 0 до 255 через крапку.`,
  InvalidPrefix: ({ value }) => `Маска /${value} не підходить.`,
  AddressNotUsable: ({ ip, prefix }) =>
    `Адресу ${ip}/${prefix} не можна дати пристрою: це адреса самої мережі або адреса «для всіх».`,
  GatewayOutsideSubnet: ({ gateway, ip, prefix }) =>
    `Роутер ${gateway} не в мережі ${ip}/${prefix}: пристрій до нього не дістане.`,
  OnlyOneInternet: () => 'Інтернет на дошці може бути лише один.',
  ConnectSelf: ({ id }, c) =>
    `Пристрій ${q(id, c)} не можна з'єднати із самим собою.`,
  AlreadyLinked: ({ a, b }, c) => `${q(a, c)} і ${q(b, c)} уже з'єднані.`,
  UnknownLink: ({ a, b }, c) =>
    `Між пристроями ${q(a, c)} і ${q(b, c)} немає зв'язку.`,
  PortBusy: ({ device }, c) =>
    `У ${of(device, c)} один роз'єм, і він уже зайнятий.`,
  RadioNeedsAccessPoint: ({ a, b }, c) =>
    `Через Wi-Fi підключаються до роутера або точки доступу, а ${q(a, c)} і ${q(b, c)} — не вони.`,
  NoWifiOnDevice: ({ device }, c) =>
    `У ${of(device, c)} немає Wi-Fi: підключіть його кабелем.`,
  InternetNeedsRouter: ({ device }, c) =>
    `До інтернету підключають роутер або сервер, а не ${acc(device, c)}.`,
  SecondWanLink: ({ router }, c) =>
    `У ${of(router, c)} уже є вихід в інтернет.`,
  LinkMakesLoop: ({ a, b }, c) =>
    `Зв'язок ${q(a, c)} — ${q(b, c)} замкне коло: конверти бігали б по колу.`,
  NotAHost: ({ id }, c) =>
    `Це роблять на комп'ютері, телефоні або сервері, а не на ${on(id, c)}.`,
  NotARouter: ({ id }, c) =>
    `Це налаштування роутера, а ${q(id, c)} — не роутер.`,
  NotAnAccessPoint: ({ id }, c) =>
    `У ${of(id, c)} немає власної мережі Wi-Fi, її не можна налаштувати.`,
  DhcpPoolOutsideSubnet: ({ start, end, network, prefix }) =>
    `Адреси ${start}–${end} не з домашньої мережі ${network}/${prefix}.`,
  DhcpPoolReversed: ({ start, end }) =>
    `Початок пулу ${start} більший за його кінець ${end}.`,
  DhcpPoolIncludesRouter: ({ ip }) =>
    `До пулу потрапила адреса самого роутера ${ip}.`,
  ReservationOutsideSubnet: ({ mac, ip }) =>
    `Адреса ${ip} для ${mac} не з домашньої мережі.`,
  ReservationTaken: ({ ip, mac }) => `Адресу ${ip} уже закріплено за ${mac}.`,
  EmptySsid: () => 'Мережа Wi-Fi повинна мати назву.',
  WifiPasswordTooShort: ({ min }) =>
    `Пароль Wi-Fi має бути не коротшим за ${min} символів.`,
  InvalidChannel: ({ band: value, channel }) =>
    `Каналу ${channel} немає в діапазоні ${band(value)}.`,
  InvalidPort: ({ value }) =>
    `Порт ${value} не підходить: потрібен номер від 1 до 65535.`,
  EmptyName: () => "Ім'я не може бути порожнім.",

  WifiOff: ({ ap }, c) => `Wi-Fi на ${on(ap, c)} вимкнено.`,
  NoWifiProfile: ({ device }, c) =>
    `${q(device, c)} ще не знає пароля від цієї мережі Wi-Fi.`,
  WrongSsid: ({ device, ssid, ap }, c) =>
    `${q(device, c)} шукає мережу «${ssid}», а ${q(ap, c)} роздає іншу.`,
  WrongPassword: ({ device, ssid }, c) =>
    `Пароль від «${ssid}» не підійшов, і ${q(device, c)} не може підключитися.`,
  BandUnsupported: ({ device, band: value }, c) =>
    `${q(device, c)} не вміє працювати на ${band(value)}.`,
  OutOfRange: ({ device, ap }, c) =>
    `${q(device, c)} надто далеко від ${of(ap, c)}: сигнал не долітає.`,

  FrameReceived: ({ device }, c) => `${q(device, c)} отримує конверт.`,
  FrameNotForMe: ({ device }, c) =>
    `${q(device, c)} бачить, що конверт не йому, і викидає його.`,
  FrameForwarded: ({ device }, c) =>
    `${q(device, c)} знає, де одержувач, і передає конверт лише туди.`,
  FrameFlooded: ({ device }, c) =>
    `${q(device, c)} не знає, де одержувач, і надсилає конверт на всі боки.`,
  FrameBroadcast: ({ device }, c) =>
    `Конверт «для всіх»: ${q(device, c)} розсилає його на всі боки.`,
  FrameFiltered: ({ device }, c) =>
    `${q(device, c)} не пересилає конверт: одержувач там само, звідки він прийшов.`,
  PacketRouted: ({ device }, c) =>
    `${q(device, c)} передає конверт далі шляхом.`,
  PacketIgnored: ({ device }, c) =>
    `${q(device, c)} не відповідає: питання не до нього.`,
  ArpIsMine: ({ device, ip }, c) =>
    `${q(device, c)}: «${ip} — це я», і відповідає.`,
  ArpNotMine: ({ device, ip }, c) =>
    `${q(device, c)}: «${ip} — не моя адреса», і мовчить.`,
  DhcpServerOff: ({ router }, c) =>
    `${q(router, c)} не роздає адреси: DHCP вимкнено.`,

  NoLink: ({ device }, c) => `У ${of(device, c)} немає ні кабелю, ні Wi-Fi.`,
  LinkDown: ({ device }, c) =>
    `У ${of(device, c)} зв'язок вимкнено, конверт не йде.`,
  NoAddress: ({ device }, c) =>
    `У ${of(device, c)} немає адреси, тому конверт не йде.`,
  UsesStaticAddress: ({ device }, c) =>
    `У ${of(device, c)} адресу задано вручну, просити її в роутера не треба.`,
  NoGateway: ({ device, ip }, c) =>
    `${q(device, c)} не знає, через кого надіслати конверт на ${ip}: роутер не задано.`,
  NoDnsServer: ({ device }, c) =>
    `${q(device, c)} не знає, у кого запитати адресу за назвою: DNS не задано.`,
  ArpNoReply: ({ device, ip }, c) =>
    `Ніхто не відгукнувся на адресу ${ip}, і ${q(device, c)} не може надіслати конверт.`,
  NoDhcpServer: ({ device }, c) =>
    `Ніхто не видав ${of(device, c)} адресу: поруч немає роутера з DHCP.`,
  DhcpPoolExhausted: ({ router }, c) =>
    `У ${of(router, c)} закінчилися вільні адреси.`,
  TtlExpired: ({ device }, c) =>
    `Конверт надто довго в дорозі, і ${q(device, c)} викидає його (TTL закінчився).`,
  NoRouteToHost: ({ ip }) => `В інтернеті немає нікого з адресою ${ip}.`,
  PrivateAddressNotRoutable: ({ ip }) =>
    `${ip} — домашня адреса: в інтернеті за нею нікого не знайти.`,
  NoWanLink: ({ router }, c) =>
    `У ${of(router, c)} немає зв'язку з інтернетом.`,
  NatNoMapping: ({ router, proto, port }, c) =>
    `${q(router, c)} не чекав цього конверта (${up(proto)} ${port}) і викидає його.`,
  PortClosed: ({ device, proto, port }, c) =>
    `На ${on(device, c)} ніхто не слухає порт ${port} (${up(proto)}), з'єднання відхилено.`,
  ListensOnlyOnLoopback: ({ device, port }, c) =>
    `Порт ${port} на ${on(device, c)} відкритий лише для нього самого (127.0.0.1).`,
  NameNotFound: ({ name }) => `Назви ${name} немає в довідковій DNS.`,
  InvalidUrl: ({ url }) => `«${url}» — не адреса сайту.`,
  FrameLost: ({ device }, c) => `Конверт загубився на ${on(device, c)}.`,

  GoalNotLinked: ({ a, b }, c) => `${q(a, c)} і ${q(b, c)} ще не з'єднані.`,
  GoalWrongMedium: ({ a, b, want }, c) =>
    `${q(a, c)} і ${q(b, c)} треба з'єднати ${how[want]}.`,
  GoalLinkDown: ({ a, b }, c) => `Зв'язок ${q(a, c)} — ${q(b, c)} вимкнено.`,
  GoalNoRadioLink: ({ device, ap }, c) =>
    `Між пристроями ${q(device, c)} і ${q(ap, c)} немає зв'язку через Wi-Fi.`,
  GoalWrongAddress: ({ device, have, want }, c) =>
    `У ${of(device, c)} адреса ${have}, а потрібна ${want}.`,
  AddressConflict: ({ ip, devices }, c) =>
    `Адреса ${ip} одразу в кількох пристроїв: ${all(devices, c)}.`,
  GoalReachable: ({ from, at }, c) =>
    `Конверт від ${of(from, c)} доходить до ${of(at, c)}, а не повинен.`,
  GoalNotListening: ({ device, proto, port }, c) =>
    `На ${on(device, c)} ніхто не слухає порт ${port} (${up(proto)}).`,
  GoalListeningOnWrongAddress: ({ device, port, bind, want }, c) =>
    `Порт ${port} на ${on(device, c)} слухають на ${bind}, а треба на ${want}.`,
  GoalResolvesElsewhere: ({ name, have, want }) =>
    `Назва ${name} веде на ${have}, а треба на ${want}.`,
}
