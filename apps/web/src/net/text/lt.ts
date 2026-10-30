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
  value === 'dual' ? '2.4 ir 5 GHz' : value === '2.4' ? '2.4 GHz' : '5 GHz'

const how: Readonly<Record<Medium, string>> = {
  cable: 'kabeliu',
  radio: 'per Wi-Fi',
  cellular: 'mobiliuoju ryšiu',
  virtual: 'Docker tiltu',
}

const up = (value: string): string => value.toUpperCase()

const q = (id: string, context: TextContext): string => `„${context.name(id)}“`

const Of = (id: string, context: TextContext): string =>
  `Įrenginio ${q(id, context)}`

const of = (id: string, context: TextContext): string =>
  `įrenginio ${q(id, context)}`

const to = (id: string, context: TextContext): string =>
  `įrenginiui ${q(id, context)}`

const To = (id: string, context: TextContext): string =>
  `Įrenginiui ${q(id, context)}`

const on = (id: string, context: TextContext): string =>
  `įrenginyje ${q(id, context)}`

const On = (id: string, context: TextContext): string =>
  `Įrenginyje ${q(id, context)}`

const acc = (id: string, context: TextContext): string =>
  `įrenginį ${q(id, context)}`

const all = (ids: ReadonlyArray<string>, context: TextContext): string =>
  ids.map(id => q(id, context)).join(', ')

const scope: Readonly<Record<FirewallScope, string>> = {
  os: 'Įrenginio firewall',
  cloud: 'Prieglobos firewall',
  router: 'Router firewall',
}

const ruleName = (maybeRule: Option.Option<number>): string =>
  Option.match(maybeRule, {
    onNone: () => 'eilutė „visi kiti“',
    onSome: rule => `${rule} eilutė`,
  })

const security: Readonly<Record<Security, string>> = {
  open: 'be slaptažodžio',
  wpa2: 'WPA2',
  wpa3: 'WPA3',
}

const acme: Readonly<Record<AcmeProblem, string>> = {
  'not-found': 'tokio pavadinimo DNS nėra',
  refused: 'port 80 uždarytas',
  timeout: 'port 80 nepasiekiamas',
  'wrong-server': 'šiuo pavadinimu atsako kitas server',
}

// Ответ ассистента на неверный диагноз в отчёте (урок 15): выбранная
// ступенька ниже настоящей поломки — она цела; выше — до неё конверт не
// дошёл; та же — поломка соседняя.

type Below = (ran: boolean, host: string, port: number) => string

const belowFault: Readonly<Record<Fault, Below>> = {
  link: ran =>
    ran
      ? 'IP address yra, ir router atsako: ryšys tvarkingas.'
      : 'Pirmiausia patikrinkite: ip a — ar yra IP address, paskui ping — ar atsako router.',
  gateway: ran =>
    ran
      ? 'Vokai išeina iš namų: ping 1.1.1.1 atsako.'
      : 'Patikrinkite: ping 1.1.1.1 — ar vokas išeina iš namų.',
  dns: (ran, host) =>
    ran
      ? 'Vardas randamas: DNS server grąžino adresą.'
      : `Patikrinkite: nslookup ${host}.`,
  firewall: (ran, host, port) =>
    ran
      ? 'Durys atsidaro: ryšys užmegztas.'
      : `Patikrinkite: nc -zv ${host} ${port}.`,
  loopback: ran =>
    ran
      ? 'Ryšys atsidarė: serveris klausosi ne tik savęs.'
      : 'Patikrinkite serveryje: ss -ltn.',
  cert: ran =>
    ran
      ? 'Certificate tinka vardui.'
      : 'Patikrinkite: curl -v parodys, ką serveris pateikia prisijungiant.',
}

const aboveFault: Readonly<Record<Fault, string>> = {
  link: 'Ryšys ir adresas čia niekuo dėti: bėda kitur.',
  gateway:
    'Vokas neišeina iš namų, bet priežastis žemiau: ar įrenginys turi IP address?',
  dns: 'DNS server tikrai neatsakė. Bet ar vokas jį pasiekė? DNS server gyvena išorėje.',
  firewall: 'Iki durų net neprieita: vokas nepasiekė serverio.',
  loopback: 'Iki durų net neprieita: vokas nepasiekė serverio.',
  cert: 'Certificate čia niekuo dėtas: ryšys net neatsidarė.',
}

const sameFault: Readonly<Partial<Record<Fault, string>>> = {
  firewall:
    'Atsisakymas atėjo iškart: vokas atkeliavo, ir jam atsakė „čia nieko nėra“. Firewall paprastai tyli. Pažiūrėkite, kuriuo adresu klausosi serveris: ss -ltn.',
  loopback:
    'Tyla, o ne atsisakymas: jei port būtų tuščias, greitai ateitų Connection refused. Serveryje patikrinkite ss -ltn ir sudo ufw status.',
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
      ? `${aboveFault[picked]}${ran ? ' Žemesnis laiptelis jau raudonas: ieškokite ten.' : ' Patikrinkite žemesnį laiptelį.'}`
      : (sameFault[picked] ??
        'Laiptelis tas pats, bet gedimas kitas. Dar kartą perskaitykite paskutines išvesties eilutes.')
}

export const lt: NetTexts = {
  UnknownDevice: ({ id }, c) => `Įrenginio ${q(id, c)} lentoje nėra.`,
  DuplicateDeviceId: ({ id }, c) => `Įrenginys ${q(id, c)} jau yra lentoje.`,
  InvalidMac: ({ value }) =>
    `„${value}“ nėra MAC address: reikia šešių simbolių porų, atskirtų dvitaškiais.`,
  DuplicateMac: ({ mac, owner }, c) =>
    `MAC address ${mac} jau turi įrenginys ${q(owner, c)}.`,
  InvalidIp: ({ value }) =>
    `„${value}“ nėra IP address: reikia keturių skaičių nuo 0 iki 255, atskirtų taškais.`,
  InvalidPrefix: ({ value }) => `Subnet mask /${value} netinka.`,
  AddressNotUsable: ({ ip, prefix }) =>
    `${ip}/${prefix} netinka įrenginiui: tai pačio tinklo arba „visiems“ skirtas IP address.`,
  GatewayOutsideSubnet: ({ gateway, ip, prefix }) =>
    `Router ${gateway} nėra tinkle ${ip}/${prefix}, todėl įrenginys jo nepasieks.`,
  OnlyOneInternet: () => 'Lentoje gali būti tik vienas „Internet“.',
  ConnectSelf: ({ id }, c) => `${Of(id, c)} negalima sujungti su pačiu savimi.`,
  AlreadyLinked: ({ a, b }, c) => `${q(a, c)} ir ${q(b, c)} jau sujungti.`,
  UnknownLink: ({ a, b }, c) =>
    `Tarp įrenginių ${q(a, c)} ir ${q(b, c)} ryšio nėra.`,
  PortBusy: ({ device }, c) =>
    `${q(device, c)} turi vieną lizdą, ir jis jau užimtas.`,
  RadioNeedsAccessPoint: ({ a, b }, c) =>
    `Per Wi-Fi jungiamasi prie įrenginio, kuris yra router arba access point, o ${q(a, c)} ir ${q(b, c)} tokie nėra.`,
  NoWifiOnDevice: ({ device }, c) =>
    `${q(device, c)} neturi Wi-Fi: prijunkite jį kabeliu.`,
  InternetNeedsRouter: ({ device }, c) =>
    `Prie interneto jungiamas router arba server, o ne įrenginys ${q(device, c)}.`,
  SecondWanLink: ({ router }, c) =>
    `${q(router, c)} jau turi išėjimą į internetą.`,
  LinkMakesLoop: ({ a, b }, c) =>
    `Ryšys ${q(a, c)} — ${q(b, c)} uždarytų ratą: vokai suktųsi ratu.`,
  NotAHost: ({ id }, c) =>
    `Tai gali padaryti kompiuteris, telefonas ar server, bet ne ${q(id, c)}.`,
  NotARouter: ({ id }, c) =>
    `Tai router nustatymas, o ${q(id, c)} nėra router.`,
  NotAnAccessPoint: ({ id }, c) =>
    `${q(id, c)} neturi savo Wi-Fi tinklo, kurį būtų galima nustatyti.`,
  DhcpPoolOutsideSubnet: ({ start, end, network, prefix }) =>
    `Adresai ${start}–${end} nėra iš namų tinklo ${network}/${prefix}.`,
  DhcpPoolReversed: ({ start, end }) =>
    `DHCP pool pradžia ${start} didesnė už jo pabaigą ${end}.`,
  DhcpPoolIncludesRouter: ({ ip }) =>
    `DHCP pool apima ${ip}, o tai IP address, kurį turi pats router.`,
  ReservationOutsideSubnet: ({ mac, ip }) =>
    `IP address ${ip}, skirtas ${mac}, nėra iš namų tinklo.`,
  ReservationTaken: ({ ip, mac }) => `IP address ${ip} jau priskirtas ${mac}.`,
  EmptySsid: () => 'SSID negali būti tuščias: Wi-Fi tinklui reikia pavadinimo.',
  WifiPasswordTooShort: ({ min }) =>
    `Wi-Fi slaptažodis turi būti ne trumpesnis nei ${min} simboliai.`,
  InvalidChannel: ({ band: value, channel }) =>
    `Channel ${channel} netinka: tokio nėra ${band(value)} juostoje.`,
  InvalidPort: ({ value }) =>
    `Port ${value} netinka: reikia skaičiaus nuo 1 iki 65535.`,
  EmptyName: () => 'Pavadinimas negali būti tuščias.',

  WifiOff: ({ ap }, c) => `${Of(ap, c)} Wi-Fi išjungtas.`,
  NoWifiProfile: ({ device }, c) =>
    `${q(device, c)} dar nežino šio Wi-Fi tinklo slaptažodžio.`,
  WrongSsid: ({ device, ssid, ap }, c) =>
    `${q(device, c)} ieško tinklo „${ssid}“, o ${q(ap, c)} transliuoja kitą.`,
  WrongPassword: ({ device, ssid }, c) =>
    `Tinklo „${ssid}“ slaptažodis netinka, ir ${q(device, c)} negali prisijungti.`,
  BandUnsupported: ({ device, band: value }, c) =>
    `${q(device, c)} nepalaiko ${band(value)}.`,
  OutOfRange: ({ device, ap }, c) =>
    `${q(device, c)} per toli nuo ${of(ap, c)}: signalas nepasiekia.`,

  FrameReceived: ({ device }, c) => `${q(device, c)} gauna voką.`,
  FrameNotForMe: ({ device }, c) =>
    `${q(device, c)} mato, kad vokas ne jam, ir jį išmeta.`,
  FrameForwarded: ({ device }, c) =>
    `${q(device, c)} žino, kur gavėjas, ir perduoda voką tik ten.`,
  FrameFlooded: ({ device }, c) =>
    `${q(device, c)} nežino, kur gavėjas, ir siunčia voką į visas puses.`,
  FrameBroadcast: ({ device }, c) =>
    `Vokas „visiems“: ${q(device, c)} išsiuntinėja jį į visas puses.`,
  FrameFiltered: ({ device }, c) =>
    `${q(device, c)} voko nepersiunčia: gavėjas ten pat, iš kur vokas atėjo.`,
  PacketRouted: ({ device }, c) =>
    `${q(device, c)} perduoda voką toliau keliu.`,
  PacketIgnored: ({ device }, c) =>
    `${q(device, c)} neatsako: klausimas ne jam.`,
  ArpIsMine: ({ device, ip }, c) =>
    `${q(device, c)}: „${ip} — tai aš“, ir atsako.`,
  ArpNotMine: ({ device, ip }, c) =>
    `${q(device, c)}: „${ip} — ne mano adresas“, ir tyli.`,
  DhcpServerOff: ({ router }, c) =>
    `${q(router, c)} adresų nedalija: DHCP išjungtas.`,

  NoLink: ({ device }, c) => `${q(device, c)} neturi nei kabelio, nei Wi-Fi.`,
  LinkDown: ({ device }, c) =>
    `${Of(device, c)} ryšys išjungtas, vokas neišeina.`,
  NoAddress: ({ device }, c) =>
    `${q(device, c)} neturi IP address, todėl vokas neišeina.`,
  UsesStaticAddress: ({ device }, c) =>
    `${Of(device, c)} IP address nustatytas rankiniu būdu, prašyti jo per DHCP nereikia.`,
  NoGateway: ({ device, ip }, c) =>
    `${q(device, c)} nežino, per ką siųsti voką adresu ${ip}: router (gateway) nenustatytas.`,
  NoDnsServer: ({ device }, c) =>
    `${q(device, c)} nežino, ko klausti adreso pagal pavadinimą: DNS nenustatytas.`,
  ArpNoReply: ({ device, ip }, c) =>
    `Niekas neatsiliepė adresu ${ip}, todėl ${q(device, c)} negali išsiųsti voko.`,
  NoDhcpServer: ({ device }, c) =>
    `Niekas nedavė ${to(device, c)} IP address: šalia nėra router su DHCP.`,
  DhcpPoolExhausted: ({ router }, c) =>
    `${To(router, c)} baigėsi laisvi adresai.`,
  TtlExpired: ({ device }, c) =>
    `Vokas per ilgai kelyje, todėl ${q(device, c)} jį išmeta (baigėsi TTL).`,
  NoRouteToHost: ({ ip }) => `Internete nėra nieko su adresu ${ip}.`,
  PrivateAddressNotRoutable: ({ ip }) =>
    `${ip} yra namų adresas: internete pagal jį nieko nerasti.`,
  NoWanLink: ({ router }, c) => `${q(router, c)} neturi ryšio su internetu.`,
  NatNoMapping: ({ router, proto, port }, c) =>
    `${q(router, c)} nelaukė šio voko (${up(proto)} ${port}) ir jį išmeta.`,
  PortClosed: ({ device, proto, port }, c) =>
    `${On(device, c)} port ${port} (${up(proto)}) uždarytas: niekas jo neklauso, ryšys atmestas.`,
  ListensOnlyOnLoopback: ({ device, port }, c) =>
    `${Of(device, c)} port ${port} atviras tik jam pačiam (127.0.0.1).`,
  NameNotFound: ({ name }) => `DNS pavadinimo ${name} nežino.`,
  InvalidUrl: ({ url }) => `„${url}“ nėra svetainės adresas.`,
  FrameLost: ({ device }, c) => `Vokas pasimetė ${on(device, c)}.`,

  GoalNotLinked: ({ a, b }, c) => `${q(a, c)} ir ${q(b, c)} dar nesujungti.`,
  GoalWrongMedium: ({ a, b, want }, c) =>
    `${q(a, c)} ir ${q(b, c)} reikia sujungti ${how[want]}.`,
  GoalLinkDown: ({ a, b }, c) => `Ryšys ${q(a, c)} — ${q(b, c)} išjungtas.`,
  GoalNoRadioLink: ({ device, ap }, c) =>
    `Tarp įrenginių ${q(device, c)} ir ${q(ap, c)} nėra Wi-Fi ryšio.`,
  GoalWrongAddress: ({ device, have, want }, c) =>
    `${Of(device, c)} IP address ${have}, o reikia ${want}.`,
  AddressConflict: ({ ip, devices }, c) =>
    `IP address ${ip} turi keli įrenginiai: ${all(devices, c)}.`,
  GoalReachable: ({ from, at }, c) =>
    `Vokas iš ${of(from, c)} pasiekia ${acc(at, c)}, nors neturėtų.`,
  GoalNotListening: ({ device, proto, port }, c) =>
    `${On(device, c)} port ${port} (${up(proto)}) uždarytas: niekas jo neklauso.`,
  GoalListeningOnWrongAddress: ({ device, port, bind, want }, c) =>
    `${Of(device, c)} port ${port} atidarytas adresu ${bind}, o reikia ${want}.`,
  GoalResolvesElsewhere: ({ name, have, want }) =>
    `Pavadinimas ${name} veda į ${have}, o turi vesti į ${want}.`,

  InvalidCidr: ({ value }) =>
    `„${value}“ nėra tinklas: rašoma taip: 10.0.0.0/8.`,
  CellularNeedsOperator: ({ a, b }, c) =>
    `Mobilusis ryšys jungia telefoną su operatoriumi, o ne ${acc(a, c)} su ${q(b, c)}.`,
  VirtualNeedsContainer: ({ a, b }, c) =>
    `Docker tiltu sujungiamas tik container ir jo šeimininkas, o ne ${acc(a, c)} su ${q(b, c)}.`,
  NotATransit: ({ id }, c) => `${q(id, c)} nėra ISP router.`,
  NotAVpnGateway: ({ id }, c) => `${q(id, c)} nėra VPN gateway.`,
  NotADockerHost: ({ id }, c) => `${On(id, c)} Docker nepaleistas.`,
  NoVpnClient: ({ device }, c) => `${On(device, c)} VPN nenustatytas.`,
  RouteViaOutsideLan: ({ via }) => `Kitas router ${via} turi būti namų tinkle.`,
  NotANeighbour: ({ device, via }, c) =>
    `${q(via, c)} nesujungtas su ${of(device, c)} tiesiogiai.`,
  ForwardOutsideLan: ({ ip }) =>
    `Port forwarding veda į ${ip}, o turi vesti į IP address jūsų namuose.`,
  ForwardPortTaken: ({ proto, port }) =>
    `Port forwarding taisyklė ${up(proto)} ${port} jau yra.`,
  UnknownForward: ({ proto, port }) => `Taisyklės ${up(proto)} ${port} nėra.`,
  UnknownZone: ({ zone }) => `Šis DNS server domain ${zone} neturi.`,
  UnknownRecord: ({ name, rtype }) => `${name}: ${rtype} record nerastas.`,
  RecordNeedsAddress: ({ rtype, value }) =>
    `${rtype} record rodo į IP address, o „${value}“ nėra IP address.`,
  CnameNeedsName: ({ value }) =>
    `CNAME rodo į pavadinimą, o ne į IP address „${value}“. IP address rašomas į A record.`,
  CnameAtApex: ({ zone }) =>
    `CNAME negalima dėti ant @ (paties domain ${zone}): @ turi turėti A record.`,
  CnameConflict: ({ name }) =>
    `${name} jau turi kitų įrašų, todėl šalia jų CNAME dėti negalima.`,
  SplitTunnelEmpty: () =>
    'Režime „Tik darbo tinklai“ sąrašas negali būti tuščias: į tunnel nieko neitų.',
  InvalidPortMapping: ({ value }) =>
    `„${value}“ nėra port publikavimas: rašoma „išorėje:viduje“, pavyzdžiui, 8080:3000.`,
  HostPortTaken: ({ port }) =>
    `Šeimininko port ${port} jau užimtas: ten jau kitos durys.`,
  NoRelay: () => 'Tunnel tarpininko (relay) lentoje nėra.',
  NoCertificateAuthority: () => 'Lentoje nėra certificate authority.',
  NameIsAddress: ({ value }) =>
    `Reikia svetainės pavadinimo, o ne IP address ${value}.`,
  AcmeChallengeFailed: ({ name, problem }) =>
    `Certificate authority nepatvirtino ${name}: ${acme[problem]}.`,

  ForeignOpenNetwork: ({ ssid }) =>
    `„${ssid}“ yra svetimas atviras tinklas: prisijungti gali bet kuris praeivis. Pasirinkite savo tinklą nuo lipduko.`,
  ForeignNetwork: ({ ssid }) =>
    `„${ssid}“ nėra jūsų tinklas. Palyginkite SSID su router lipduku.`,
  NetworkNotFound: ({ ssid }) => `Tinklo „${ssid}“ šalia nėra.`,

  FirewallAllowed: ({ scope: where, maybeRule }) =>
    `${scope[where]} praleidžia voką: ${ruleName(maybeRule)}.`,
  TunnelUnwrapped: ({ device }, c) =>
    `${q(device, c)} išpakuoja voką, atėjusį per tunnel.`,
  RelayPassed: ({ device }, c) =>
    `${q(device, c)} perduoda voką toliau linija.`,
  PortPublished: ({ device, port, container }, c) =>
    `${q(device, c)} perduoda voką iš port ${port} į container ${q(container, c)}.`,

  GatewayUnreachable: ({ gateway }) =>
    `Gateway ${gateway} neatsako: tokio įrenginio tinkle nėra.`,
  GatewayIsSelf: ({ device }, c) =>
    `${q(device, c)} kaip gateway nurodo save patį. Gateway – tai router.`,
  GatewayNotARouter: ({ gateway }) =>
    `${gateway} nėra router: svetimų vokų jis toliau neperduoda.`,
  PublishedPortClosed: ({ device, port }, c) =>
    `Durys atsidarė, bet ${on(device, c)} už port ${port} nieko nėra: atsakymas tuščias.`,
  AppDown: ({ device, host, port }, c) =>
    `${q(device, c)} vis lūžta: nepasiekia ${host}:${port}.`,
  FirewallDropped: ({ scope: where, maybeRule }) =>
    `${scope[where]} tyliai išmeta voką (${ruleName(maybeRule)}).`,
  FirewallRejected: ({ scope: where, maybeRule }) =>
    `${scope[where]} iškart atsisako (${ruleName(maybeRule)}).`,
  TunnelNoRoute: ({ gateway, ip }, c) =>
    `${Of(gateway, c)} kelio į ${ip} nėra: tokio tinklo biure nėra.`,
  NotConnected: ({ device }, c) => `${q(device, c)}: tunnel neprijungtas.`,
  TunnelNotFound: ({ name }) => `Tunnel ${name} nerastas: puslapis 404.`,
  UpstreamFailed: ({ device, port }, c) =>
    `Už ${of(device, c)} niekas neatsako per port ${port}: 502 Bad Gateway.`,
  CertNameMismatch: ({ name, names }) =>
    `Certificate išduotas ${names.join(', ')}, o ne ${name}.`,
  CertExpired: ({ name, notAfter }) =>
    `${name} certificate galiojo tik iki ${notAfter}.`,
  CertUntrusted: ({ name, issuer }) =>
    `${name} certificate išdavėjas – „${issuer}“, o juo naršyklė nepasitiki.`,
  TlsNotConfigured: ({ device, port }, c) =>
    `${On(device, c)} port ${port} nemoka HTTPS: certificate nėra.`,
  HttpError: ({ device, status }, c) =>
    `${q(device, c)} atsako klaida ${status}.`,

  SeveralAddresses: ({ name, ips }) =>
    `${name} turi kelis adresus: ${ips.join(', ')}. Dalis lankytojų pateks ne ten.`,
  GoalWifiTooWeak: ({ ap, security: have, want }, c) =>
    `${Of(ap, c)} Wi-Fi yra ${security[have]}, o reikia ne silpnesnio nei ${security[want]}.`,
  GoalChannelBusy: ({ ap, others }, c) =>
    `${Of(ap, c)} channel persidengia su kaimynais: ${all(others, c)}.`,
  GoalNotPerformed: ({ from, at }, c) =>
    `Vokas iš ${of(from, c)} dar nepasiekė ${acc(at, c)}.`,
  GoalNoRecord: ({ zone, name, rtype }) =>
    `Domain ${zone}: ${rtype} record vardui ${name} nerastas.`,
  GoalRecordValue: ({ name, rtype, have, want }) =>
    `${name} ${rtype} record yra ${have.join(', ')}, o reikia ${want}.`,
  GoalCommandNotRun: ({ device, commands }, c) =>
    `${On(device, c)} dar nepaleista ${commands.join(' ar ')}.`,
  GoalCommandSawOther: ({ name, saw, want }) =>
    `Komanda parodė ${saw.join(', ') || 'nieko'} pavadinimui ${name}, o laukiame ${want}.`,
  GoalExtraOpenPort: ({ target, port }) =>
    `Iš išorės atviras perteklinis port ${port} adresu ${target}.`,
  GoalPortNotOpen: ({ target, port }) =>
    `Port ${port} adresu ${target} uždarytas, o turi būti atviras.`,
  GoalNotRedirected: ({ url, status }) =>
    `${url} nenukreipia į https:// (atsakymas ${status}).`,
  GoalNotThrough: ({ device }, c) => `Vokas eina pro šalį ${of(device, c)}.`,
  GoalThrough: ({ device }, c) =>
    `Vokas eina per ${acc(device, c)}, o turi eiti tiesiogiai.`,
  GoalNoDevice: ({ id }, c) => `Lentoje dar nėra ${of(id, c)}.`,
  SshLockedOut: ({ device }, c) =>
    `Uždarėte ssh patys sau: ${q(device, c)} jūsų daugiau neįleidžia.`,
  ReportMissing: () =>
    'Ataskaita dar neišsiųsta: pasirinkite eilutę-įrodymą ir kur gedimas.',
  ReportAfterFix: () =>
    'Sutaisėte — puiku. Dabar aprašykite, kas buvo sugedę: ataskaita yra pusė užduoties.',
  ReportNoEvidence: () =>
    'Pridėkite įrodymą: spustelėkite išvesties eilutę, kuri rodo gedimą.',
  ReportWrongFault: wrongFault,
  ReportTrap: wrongFault,
  ReportEvidenceOk: () =>
    'Ši eilutė — geras atsakymas: čia viskas veikia. Reikia eilutės, kurioje matyti bėda.',
  ReportEvidenceSymptom: () =>
    'Tai simptomas, o ne priežastis: eilutė kartoja tai, ką parašė naršyklė. Reikia eilutės, kuri parodo, kodėl taip yra.',
  ReportEvidenceAbove: () =>
    'Ši eilutė rodo, kur bėdą pastebėjo, o ne kur ji atsitiko. Reikia eilutės iš žemesnio laiptelio.',
  ReportEvidenceOther: () =>
    'Ši eilutė apie ką kita. Spustelėkite eilutę, kuri įrodo jūsų diagnozę.',
  ReportAccepted: () =>
    'Ataskaita tiksli: asistentas žino, ką taisyti. Spauskite „Pritaikyti“.',
  ReportConfirmed: () =>
    'Ataskaita tiksli, ir viskas jau veikia: sutaisėte patys.',

  UnknownCommand: ({ command, available }) =>
    `Komandos ${command} čia nėra. Bandykite: ${available.join(', ')}.`,
  CommandLocked: ({ command, available }) =>
    `Komanda ${command} atsivers vėliau kurse. Dabar galima: ${available.join(', ')}.`,
  CommandUsage: ({ usage }) => `Ši komanda rašoma taip: ${usage}.`,
  NoLinkLayer: ({ device }, c) =>
    `${q(device, c)} negali perskaityti voko: išorėje turi būti frame su MAC address.`,
  NoAddressLayer: ({ device }, c) =>
    `${q(device, c)} neranda gavėjo IP address: iškart frame viduje turi būti IP.`,
  NoPortLayer: ({ device }, c) =>
    `${q(device, c)} neranda port numerio: TCP turi eiti iškart po IP.`,
  EnvelopeMisordered: ({ position, expected, found }) =>
    `${position} vietoje turi būti sluoksnis ${expected}, o yra ${found || 'nieko'}.`,
}
