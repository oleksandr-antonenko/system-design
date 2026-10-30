import { Option } from 'effect'

import { type AcmeProblem } from '../message'
import {
  type Fault,
  type FirewallScope,
  type Medium,
  type Security,
  type WifiBand,
} from '../model'
import { faultPlace } from '../report'
import { type NetTexts, type TextContext } from './types'

const band = (value: WifiBand): string =>
  value === 'dual' ? '2.4 і 5 GHz' : value === '2.4' ? '2.4 GHz' : '5 GHz'

const how: Readonly<Record<Medium, string>> = {
  cable: 'кабелем',
  radio: 'через Wi-Fi',
  cellular: 'мобільним зв’язком',
  virtual: 'мостом Docker',
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

const scope: Readonly<Record<FirewallScope, string>> = {
  os: 'Firewall пристрою',
  cloud: 'Firewall хостингу',
  router: 'Firewall на router',
}

const ruleName = (maybeRule: Option.Option<number>): string =>
  Option.match(maybeRule, {
    onNone: () => 'рядок «усі інші»',
    onSome: rule => `рядок ${rule}`,
  })

const security: Readonly<Record<Security, string>> = {
  open: 'без пароля',
  wpa2: 'WPA2',
  wpa3: 'WPA3',
}

const acme: Readonly<Record<AcmeProblem, string>> = {
  'not-found': 'такої назви немає в DNS',
  refused: 'port 80 закритий',
  timeout: 'port 80 не відповідає',
  'wrong-server': 'за цією назвою відповідає інший server',
}

// Ответ ассистента на неверный диагноз в отчёте (урок 15): выбранная
// ступенька ниже настоящей поломки — она цела; выше — до неё конверт не
// дошёл; та же — поломка соседняя.

type Below = (ran: boolean, host: string, port: number) => string

const belowFault: Readonly<Record<Fault, Below>> = {
  link: ran =>
    ran
      ? 'IP address є, і router відповідає: зв’язок у порядку.'
      : 'Перевірте спершу: ip a — чи є IP address, потім ping до router.',
  gateway: ran =>
    ran
      ? 'Конверти виходять із дому: ping 1.1.1.1 відповідає.'
      : 'Перевірте: ping 1.1.1.1 — чи виходить конверт із дому.',
  dns: (ran, host) =>
    ran
      ? 'Ім’я знаходиться: DNS server повернув адресу.'
      : `Перевірте: nslookup ${host}.`,
  firewall: (ran, host, port) =>
    ran
      ? 'Двері відчиняються: з’єднання встановлено.'
      : `Перевірте: nc -zv ${host} ${port}.`,
  loopback: ran =>
    ran
      ? 'З’єднання відкрилося: сервер слухає не тільки себе.'
      : 'Перевірте на сервері: ss -ltn.',
  cert: ran =>
    ran
      ? 'Certificate підходить до імені.'
      : 'Перевірте: curl -v покаже, що сервер показує під час входу.',
}

const aboveFault: Readonly<Record<Fault, string>> = {
  link: 'Зв’язок і адреса тут ні до чого: біда в іншому місці.',
  gateway:
    'Конверт не йде далі дому, але причина нижче: чи є в пристрою IP address?',
  dns: 'DNS server і справді не відповів. Але чи дійшов до нього конверт? DNS server живе зовні.',
  firewall: 'До дверей справа не дійшла: конверт не дістався до сервера.',
  loopback: 'До дверей справа не дійшла: конверт не дістався до сервера.',
  cert: 'До certificate справа не дійшла: з’єднання навіть не відкрилося.',
}

const sameFault: Readonly<Partial<Record<Fault, string>>> = {
  firewall:
    'Відмова прийшла одразу: конверт дійшов, і йому відповіли «тут нікого». Firewall зазвичай мовчить. Подивіться, на якій адресі слухає сервер: ss -ltn.',
  loopback:
    'Тиша, а не відмова: якби port ніхто не слухав, прийшов би швидкий Connection refused. Перевірте на сервері ss -ltn і sudo ufw status.',
}

const wrongFault = ({
  picked,
  expected,
  ran,
  host,
  port,
}: Readonly<{
  picked: Fault
  expected: Fault
  ran: boolean
  host: string
  port: number
}>): string => {
  const place = faultPlace(picked, expected)
  return place === 'below'
    ? belowFault[picked](ran, host, port)
    : place === 'above'
      ? `${aboveFault[picked]}${ran ? ' Сходинка нижче вже червона: шукайте там.' : ' Перевірте сходинку нижче.'}`
      : (sameFault[picked] ??
        'Сходинка та сама, але поломка інша. Перечитайте останні рядки виводу.')
}

export const uk: NetTexts = {
  UnknownDevice: ({ id }, c) => `Пристрою ${q(id, c)} немає на дошці.`,
  DuplicateDeviceId: ({ id }, c) => `Пристрій ${q(id, c)} уже є на дошці.`,
  InvalidMac: ({ value }) =>
    `«${value}» — не MAC address: потрібно шість пар символів через двокрапку.`,
  DuplicateMac: ({ mac, owner }, c) =>
    `MAC address ${mac} уже є в ${of(owner, c)}.`,
  InvalidIp: ({ value }) =>
    `«${value}» — не IP address: потрібно чотири числа від 0 до 255 через крапку.`,
  InvalidPrefix: ({ value }) => `Subnet mask /${value} не підходить.`,
  AddressNotUsable: ({ ip, prefix }) =>
    `IP address ${ip}/${prefix} не можна дати пристрою: це адреса самої мережі або адреса «для всіх».`,
  GatewayOutsideSubnet: ({ gateway, ip, prefix }) =>
    `Router ${gateway} не в мережі ${ip}/${prefix}: пристрій до нього не дістане.`,
  OnlyOneInternet: () => 'Інтернет на дошці може бути лише один.',
  ConnectSelf: ({ id }, c) =>
    `Пристрій ${q(id, c)} не можна з'єднати із самим собою.`,
  AlreadyLinked: ({ a, b }, c) => `${q(a, c)} і ${q(b, c)} уже з'єднані.`,
  UnknownLink: ({ a, b }, c) =>
    `Між пристроями ${q(a, c)} і ${q(b, c)} немає зв'язку.`,
  PortBusy: ({ device }, c) =>
    `У ${of(device, c)} один роз'єм, і він уже зайнятий.`,
  RadioNeedsAccessPoint: ({ a, b }, c) =>
    `Wi-Fi роздає router або access point, а ${q(a, c)} і ${q(b, c)} — не вони.`,
  NoWifiOnDevice: ({ device }, c) =>
    `У ${of(device, c)} немає Wi-Fi: підключіть його кабелем.`,
  InternetNeedsRouter: ({ device }, c) =>
    `До інтернету підключають router або server, а не ${acc(device, c)}.`,
  SecondWanLink: ({ router }, c) =>
    `У ${of(router, c)} уже є вихід в інтернет.`,
  LinkMakesLoop: ({ a, b }, c) =>
    `Зв'язок ${q(a, c)} — ${q(b, c)} замкне коло: конверти бігали б по колу.`,
  NotAHost: ({ id }, c) =>
    `Це робить комп'ютер, телефон або server, а не ${acc(id, c)}.`,
  NotARouter: ({ id }, c) =>
    `Так налаштовують router, а ${q(id, c)} — не router.`,
  NotAnAccessPoint: ({ id }, c) =>
    `У ${of(id, c)} немає власної мережі Wi-Fi, її не можна налаштувати.`,
  DhcpPoolOutsideSubnet: ({ start, end, network, prefix }) =>
    `Адреси ${start}–${end} не з домашньої мережі ${network}/${prefix}.`,
  DhcpPoolReversed: ({ start, end }) =>
    `DHCP pool починається з ${start}, а закінчується раніше — на ${end}.`,
  DhcpPoolIncludesRouter: ({ ip }) =>
    `DHCP pool містить ${ip}, а цю IP address має сам router.`,
  ReservationOutsideSubnet: ({ mac, ip }) =>
    `IP address ${ip} для ${mac} не з домашньої мережі.`,
  ReservationTaken: ({ ip, mac }) =>
    `IP address ${ip} уже закріплено за ${mac}.`,
  EmptySsid: () => 'SSID не може бути порожнім: мережі Wi-Fi потрібна назва.',
  WifiPasswordTooShort: ({ min }) =>
    `Пароль Wi-Fi має бути не коротшим за ${min} символів.`,
  InvalidChannel: ({ band: value, channel }) =>
    `Channel ${channel} не підходить для ${band(value)}.`,
  InvalidPort: ({ value }) =>
    `Port ${value} не підходить: потрібен номер від 1 до 65535.`,
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
    `У ${of(device, c)} не задано IP address, тому конверт не йде.`,
  UsesStaticAddress: ({ device }, c) =>
    `У ${of(device, c)} IP address задано вручну: router її видавати не мусить.`,
  NoGateway: ({ device, ip }, c) =>
    `${q(device, c)} не знає, через кого надіслати конверт на ${ip}: router не задано.`,
  NoDnsServer: ({ device }, c) =>
    `${q(device, c)} не знає, у кого запитати адресу за назвою: DNS не задано.`,
  ArpNoReply: ({ device, ip }, c) =>
    `Ніхто не відгукнувся на IP address ${ip}, і ${q(device, c)} не може надіслати конверт.`,
  NoDhcpServer: ({ device }, c) =>
    `Ніхто не видав ${of(device, c)} IP address: поруч жоден router не роздає адрес через DHCP.`,
  DhcpPoolExhausted: ({ router }, c) =>
    `DHCP pool ${of(router, c)} вичерпано: вільних адрес немає.`,
  TtlExpired: ({ device }, c) =>
    `Конверт надто довго в дорозі, і ${q(device, c)} викидає його (TTL закінчився).`,
  NoRouteToHost: ({ ip }) => `IP address ${ip} в інтернеті нікому не належить.`,
  PrivateAddressNotRoutable: ({ ip }) =>
    `${ip} — private IP, домашня адреса: в інтернеті за нею нікого не знайти.`,
  NoWanLink: ({ router }, c) =>
    `У ${of(router, c)} немає зв'язку з інтернетом.`,
  NatNoMapping: ({ router, proto, port }, c) =>
    `${q(router, c)} не чекав цього конверта (${up(proto)} ${port}) і викидає його.`,
  PortClosed: ({ device, proto, port }, c) =>
    `На ${on(device, c)} ніхто не слухає port ${port} (${up(proto)}), з'єднання відхилено.`,
  ListensOnlyOnLoopback: ({ device, port }, c) =>
    `Port ${port} на ${on(device, c)} відкритий лише для нього самого (127.0.0.1).`,
  NameNotFound: ({ name }) => `Назви ${name} немає в DNS.`,
  InvalidUrl: ({ url }) => `«${url}» — не адреса сайту.`,
  FrameLost: ({ device }, c) => `Конверт загубився на ${on(device, c)}.`,

  GoalNotLinked: ({ a, b }, c) => `${q(a, c)} і ${q(b, c)} ще не з'єднані.`,
  GoalWrongMedium: ({ a, b, want }, c) =>
    `${q(a, c)} і ${q(b, c)} треба з'єднати ${how[want]}.`,
  GoalLinkDown: ({ a, b }, c) => `Зв'язок ${q(a, c)} — ${q(b, c)} вимкнено.`,
  GoalNoRadioLink: ({ device, ap }, c) =>
    `Між пристроями ${q(device, c)} і ${q(ap, c)} немає зв'язку через Wi-Fi.`,
  GoalWrongAddress: ({ device, have, want }, c) =>
    `У ${of(device, c)} IP address ${have}, а потрібна ${want}.`,
  AddressConflict: ({ ip, devices }, c) =>
    `IP address ${ip} одразу в кількох пристроїв: ${all(devices, c)}.`,
  GoalReachable: ({ from, at }, c) =>
    `Конверт від ${of(from, c)} доходить до ${of(at, c)}, а не повинен.`,
  GoalNotListening: ({ device, proto, port }, c) =>
    `На ${on(device, c)} ніхто не слухає port ${port} (${up(proto)}).`,
  GoalListeningOnWrongAddress: ({ device, port, bind, want }, c) =>
    `Port ${port} на ${on(device, c)} слухають на ${bind}, а треба на ${want}.`,
  GoalResolvesElsewhere: ({ name, have, want }) =>
    `Назва ${name} веде на ${have}, а треба на ${want}.`,

  InvalidCidr: ({ value }) =>
    `«${value}» — не мережа: потрібен вигляд 10.0.0.0/8.`,
  CellularNeedsOperator: ({ a, b }, c) =>
    `Мобільний зв’язок з’єднує телефон з оператором, а не ${q(a, c)} з ${q(b, c)}.`,
  VirtualNeedsContainer: ({ a, b }, c) =>
    `Міст Docker з’єднує container лише з комп’ютером, на якому той запущений, а не ${q(a, c)} з ${q(b, c)}.`,
  NotATransit: ({ id }, c) => `${q(id, c)} — не ISP router.`,
  NotAVpnGateway: ({ id }, c) => `${q(id, c)} — не VPN gateway.`,
  NotADockerHost: ({ id }, c) => `На ${on(id, c)} не запущено Docker.`,
  NoVpnClient: ({ device }, c) => `На ${on(device, c)} не налаштовано VPN.`,
  RouteViaOutsideLan: ({ via }) =>
    `Наступний router ${via} має бути в домашній мережі.`,
  NotANeighbour: ({ device, via }, c) =>
    `${q(via, c)} не з’єднаний з ${q(device, c)} напряму.`,
  ForwardOutsideLan: ({ ip }) =>
    `Port forwarding веде на ${ip}, а потрібна IP address з вашого дому.`,
  ForwardPortTaken: ({ proto, port }) =>
    `Правило для ${up(proto)} ${port} уже є.`,
  UnknownForward: ({ proto, port }) =>
    `Правила для ${up(proto)} ${port} немає.`,
  UnknownZone: ({ zone }) => `Цей DNS server не знає domain ${zone}.`,
  UnknownRecord: ({ name, rtype }) =>
    `DNS record ${rtype} для ${name} не існує.`,
  RecordNeedsAddress: ({ rtype, value }) =>
    `DNS record ${rtype} вказує на IP address, а «${value}» — не IP address.`,
  CnameNeedsName: ({ value }) =>
    `CNAME вказує на назву, а «${value}» — це IP address. Для неї потрібен A record.`,
  CnameAtApex: ({ zone }) =>
    `CNAME не можна ставити на сам domain ${zone} (@): для @ потрібен A record.`,
  CnameConflict: ({ name }) =>
    `У ${name} уже є інші DNS records, тому CNAME поруч із ними поставити не можна.`,
  SplitTunnelEmpty: () =>
    'У режимі «Лише робочі мережі» список не може бути порожнім: тоді в tunnel не піде нічого.',
  InvalidPortMapping: ({ value }) =>
    `«${value}» — так port не публікують: пишуть «ззовні:всередині», наприклад 8080:3000.`,
  HostPortTaken: ({ port }) =>
    `Port ${port} хоста вже зайнятий іншими дверима.`,
  NoRelay: () => 'Tunnel потребує relay, а на дошці його немає.',
  NoCertificateAuthority: () =>
    'Certificate authority (центр сертифікації) на дошці відсутній.',
  NameIsAddress: ({ value }) =>
    `Потрібна назва сайту, а не IP address ${value}.`,
  AcmeChallengeFailed: ({ name, problem }) =>
    `Certificate authority не підтвердив ${name}: ${acme[problem]}.`,

  ForeignOpenNetwork: ({ ssid }) =>
    `«${ssid}» — відкрита чужа мережа: підключитися може будь-який перехожий. Оберіть свою мережу з наліпки.`,
  ForeignNetwork: ({ ssid }) =>
    `«${ssid}» — не ваша мережа. Звірте SSID з наліпкою: її клеять на router.`,
  NetworkNotFound: ({ ssid }) => `Мережі «${ssid}» поруч немає.`,

  FirewallAllowed: ({ scope: where, maybeRule }) =>
    `${scope[where]} пропускає конверт: ${ruleName(maybeRule)}.`,
  TunnelUnwrapped: ({ device }, c) =>
    `${q(device, c)} виймає конверт, що прийшов через tunnel.`,
  RelayPassed: ({ device }, c) =>
    `${q(device, c)} передає конверт далі лінією.`,
  PortPublished: ({ device, port, container }, c) =>
    `${q(device, c)} передає конверт, що прийшов на port ${port}, у container ${q(container, c)}.`,

  GatewayUnreachable: ({ gateway }) =>
    `Gateway ${gateway} не відповідає: такого пристрою в мережі немає.`,
  GatewayIsSelf: ({ device }, c) =>
    `${q(device, c)} вказав себе як gateway. А gateway — це router.`,
  GatewayNotARouter: ({ gateway }) =>
    `${gateway} — не router: чужі конверти далі він не передає.`,
  PublishedPortClosed: ({ device, port }, c) =>
    `Двері відчинилися, але в ${q(device, c)} port ${port} ніхто не слухає: відповідь порожня.`,
  AppDown: ({ device, host, port }, c) =>
    `${q(device, c)} падає: не може достукатися до ${host}:${port}.`,
  FirewallDropped: ({ scope: where, maybeRule }) =>
    `${scope[where]} мовчки викидає конверт (${ruleName(maybeRule)}).`,
  FirewallRejected: ({ scope: where, maybeRule }) =>
    `${scope[where]} одразу відмовляє (${ruleName(maybeRule)}).`,
  TunnelNoRoute: ({ gateway, ip }, c) =>
    `У ${of(gateway, c)} немає шляху до ${ip}: такої мережі в офісі немає.`,
  NotConnected: ({ device }, c) => `У ${of(device, c)} tunnel не підключено.`,
  TunnelNotFound: ({ name }) => `Tunnel ${name} не знайдено: сторінка 404.`,
  UpstreamFailed: ({ device, port }, c) =>
    `За ${q(device, c)} ніхто не відповідає на port ${port}: 502 Bad Gateway.`,
  CertNameMismatch: ({ name, names }) =>
    `Certificate видано на ${names.join(', ')}, а не на ${name}.`,
  CertExpired: ({ name, notAfter }) =>
    `Certificate ${name} закінчився ${notAfter}.`,
  CertUntrusted: ({ name, issuer }) =>
    `Certificate ${name} видав «${issuer}», а йому браузер не довіряє.`,
  TlsNotConfigured: ({ device, port }, c) =>
    `На ${on(device, c)} port ${port} не вміє HTTPS: certificate не встановлено.`,
  HttpError: ({ device, status }, c) =>
    `${q(device, c)} відповідає помилкою ${status}.`,

  SeveralAddresses: ({ name, ips }) =>
    `У ${name} кілька адрес: ${ips.join(', ')}. Частина відвідувачів потрапить не туди.`,
  GoalWifiTooWeak: ({ ap, security: have, want }, c) =>
    `Wi-Fi ${of(ap, c)} — ${security[have]}, а треба не слабше за ${security[want]}.`,
  GoalChannelBusy: ({ ap, others }, c) =>
    `Channel ${of(ap, c)} перетинається із сусідами: ${all(others, c)}.`,
  GoalNotPerformed: ({ from, at }, c) =>
    `Конверт від ${of(from, c)} ще не дійшов до ${of(at, c)}.`,
  GoalNoRecord: ({ zone, name, rtype }) =>
    `Domain ${zone} не має DNS record ${rtype} для ${name}.`,
  GoalRecordValue: ({ name, rtype, have, want }) =>
    `DNS record ${rtype} для ${name} — ${have.join(', ')}, а треба ${want}.`,
  GoalCommandNotRun: ({ device, commands }, c) =>
    `На ${on(device, c)} ще не запускали ${commands.join(' або ')}.`,
  GoalCommandSawOther: ({ name, saw, want }) =>
    `Команда показала ${saw.join(', ') || 'порожньо'} для ${name}, а чекаємо ${want}.`,
  GoalExtraOpenPort: ({ target, port }) =>
    `Ззовні відкритий зайвий port ${port} на ${target}.`,
  GoalPortNotOpen: ({ target, port }) =>
    `Port ${port} на ${target} закритий, а має бути відкритий.`,
  GoalNotRedirected: ({ url, status }) =>
    `${url} не перенаправляє на https:// (відповідь ${status}).`,
  GoalNotThrough: ({ device }, c) => `Конверт іде повз ${acc(device, c)}.`,
  GoalThrough: ({ device }, c) =>
    `Конверт іде через ${acc(device, c)}, а має напряму.`,
  GoalNoDevice: ({ id }, c) => `На дошці ще немає ${of(id, c)}.`,
  SshLockedOut: ({ device }, c) =>
    `Ви закрили вхід по ssh самі собі: ${q(device, c)} більше вас не пускає.`,
  ReportMissing: () =>
    'Звіт ще не надіслано: виберіть рядок-доказ і де поломка.',
  ReportAfterFix: () =>
    'Полагодили — чудово. Тепер опишіть, що було зламано: звіт — половина задачі.',
  ReportNoEvidence: () =>
    'Додайте доказ: натисніть рядок виводу, який показує поломку.',
  ReportWrongFault: wrongFault,
  ReportTrap: wrongFault,
  ReportEvidenceOk: () =>
    'Цей рядок — добра відповідь: тут усе працює. Потрібен рядок, де видно біду.',
  ReportEvidenceSymptom: () =>
    'Це симптом, а не причина: рядок повторює те, що написав браузер. Потрібен рядок, який показує, чому так.',
  ReportEvidenceAbove: () =>
    'Цей рядок показує, де біду помітили, а не де вона сталася. Потрібен рядок зі сходинки нижче.',
  ReportEvidenceOther: () =>
    'Цей рядок про інше. Натисніть рядок, який доводить ваш діагноз.',
  ReportAccepted: () =>
    'Звіт точний: асистент знає, що лагодити. Натисніть «Застосувати».',
  ReportConfirmed: () => 'Звіт точний, і все вже працює: ви полагодили самі.',

  UnknownCommand: ({ command, available }) =>
    `Команди ${command} тут немає. Спробуйте: ${available.join(', ')}.`,
  CommandLocked: ({ command, available }) =>
    `Команда ${command} відкриється пізніше в курсі. Зараз доступні: ${available.join(', ')}.`,
  CommandUsage: ({ usage }) => `Так пишуть цю команду: ${usage}.`,
  NoLinkLayer: ({ device }, c) =>
    `${q(device, c)} не може прочитати конверт: ззовні має бути frame з MAC address.`,
  NoAddressLayer: ({ device }, c) =>
    `${q(device, c)} не знаходить IP address одержувача: IP має йти другим, одразу всередині frame.`,
  NoPortLayer: ({ device }, c) =>
    `${q(device, c)} не знаходить port: TCP має йти одразу за IP.`,
  EnvelopeMisordered: ({ position, expected, found }) =>
    `На місці ${position} має бути шар ${expected}, а лежить ${found || 'порожньо'}.`,
}
