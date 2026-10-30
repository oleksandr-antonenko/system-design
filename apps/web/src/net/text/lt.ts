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
  value === 'dual' ? '2,4 ir 5 GHz' : value === '2.4' ? '2,4 GHz' : '5 GHz'

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
  os: 'Įrenginio užkarda',
  cloud: 'Prieglobos užkarda',
  router: 'Maršrutizatoriaus užkarda',
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
  refused: '80 prievadas uždarytas',
  timeout: '80 prievado nepasiekti',
  'wrong-server': 'šiuo pavadinimu atsako kitas serveris',
}

export const lt: NetTexts = {
  UnknownDevice: ({ id }, c) => `Įrenginio ${q(id, c)} lentoje nėra.`,
  DuplicateDeviceId: ({ id }, c) => `Įrenginys ${q(id, c)} jau yra lentoje.`,
  InvalidMac: ({ value }) =>
    `„${value}“ nėra MAC adresas: reikia šešių simbolių porų, atskirtų dvitaškiais.`,
  DuplicateMac: ({ mac, owner }, c) =>
    `MAC ${mac} jau turi įrenginys ${q(owner, c)}.`,
  InvalidIp: ({ value }) =>
    `„${value}“ nėra adresas: reikia keturių skaičių nuo 0 iki 255, atskirtų taškais.`,
  InvalidPrefix: ({ value }) => `Kaukė /${value} netinka.`,
  AddressNotUsable: ({ ip, prefix }) =>
    `Adreso ${ip}/${prefix} negalima duoti įrenginiui: tai pačio tinklo arba „visiems“ adresas.`,
  GatewayOutsideSubnet: ({ gateway, ip, prefix }) =>
    `Maršrutizatorius ${gateway} nėra tinkle ${ip}/${prefix}, todėl įrenginys jo nepasieks.`,
  OnlyOneInternet: () => 'Lentoje gali būti tik vienas internetas.',
  ConnectSelf: ({ id }, c) => `${Of(id, c)} negalima sujungti su pačiu savimi.`,
  AlreadyLinked: ({ a, b }, c) => `${q(a, c)} ir ${q(b, c)} jau sujungti.`,
  UnknownLink: ({ a, b }, c) =>
    `Tarp įrenginių ${q(a, c)} ir ${q(b, c)} ryšio nėra.`,
  PortBusy: ({ device }, c) =>
    `${q(device, c)} turi vieną lizdą, ir jis jau užimtas.`,
  RadioNeedsAccessPoint: ({ a, b }, c) =>
    `Per Wi-Fi jungiamasi prie maršrutizatoriaus ar prieigos taško, o ${q(a, c)} ir ${q(b, c)} jais nėra.`,
  NoWifiOnDevice: ({ device }, c) =>
    `${q(device, c)} neturi Wi-Fi: prijunkite jį kabeliu.`,
  InternetNeedsRouter: ({ device }, c) =>
    `Prie interneto jungiamas maršrutizatorius arba serveris, o ne įrenginys ${q(device, c)}.`,
  SecondWanLink: ({ router }, c) =>
    `${q(router, c)} jau turi išėjimą į internetą.`,
  LinkMakesLoop: ({ a, b }, c) =>
    `Ryšys ${q(a, c)} — ${q(b, c)} uždarytų ratą: vokai suktųsi ratu.`,
  NotAHost: ({ id }, c) =>
    `Tai daroma kompiuteryje, telefone ar serveryje, o ne ${on(id, c)}.`,
  NotARouter: ({ id }, c) =>
    `Tai maršrutizatoriaus nustatymas, o ${q(id, c)} nėra maršrutizatorius.`,
  NotAnAccessPoint: ({ id }, c) =>
    `${q(id, c)} neturi savo Wi-Fi tinklo, kurį būtų galima nustatyti.`,
  DhcpPoolOutsideSubnet: ({ start, end, network, prefix }) =>
    `Adresai ${start}–${end} nėra iš namų tinklo ${network}/${prefix}.`,
  DhcpPoolReversed: ({ start, end }) =>
    `Telkinio pradžia ${start} didesnė už jo pabaigą ${end}.`,
  DhcpPoolIncludesRouter: ({ ip }) =>
    `Į telkinį pateko paties maršrutizatoriaus adresas ${ip}.`,
  ReservationOutsideSubnet: ({ mac, ip }) =>
    `Adresas ${ip}, skirtas ${mac}, nėra iš namų tinklo.`,
  ReservationTaken: ({ ip, mac }) => `Adresas ${ip} jau priskirtas ${mac}.`,
  EmptySsid: () => 'Wi-Fi tinklas turi turėti pavadinimą.',
  WifiPasswordTooShort: ({ min }) =>
    `Wi-Fi slaptažodis turi būti ne trumpesnis nei ${min} simboliai.`,
  InvalidChannel: ({ band: value, channel }) =>
    `${band(value)} diapazone kanalo ${channel} nėra.`,
  InvalidPort: ({ value }) =>
    `Prievadas ${value} netinka: reikia skaičiaus nuo 1 iki 65535.`,
  EmptyName: () => 'Pavadinimas negali būti tuščias.',

  WifiOff: ({ ap }, c) => `${Of(ap, c)} Wi-Fi išjungtas.`,
  NoWifiProfile: ({ device }, c) =>
    `${q(device, c)} dar nežino šio Wi-Fi tinklo slaptažodžio.`,
  WrongSsid: ({ device, ssid, ap }, c) =>
    `${q(device, c)} ieško tinklo „${ssid}“, o ${q(ap, c)} transliuoja kitą.`,
  WrongPassword: ({ device, ssid }, c) =>
    `Tinklo „${ssid}“ slaptažodis netinka, ir ${q(device, c)} negali prisijungti.`,
  BandUnsupported: ({ device, band: value }, c) =>
    `${q(device, c)} nemoka veikti ${band(value)} dažniu.`,
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
    `${q(device, c)} neturi adreso, todėl vokas neišeina.`,
  UsesStaticAddress: ({ device }, c) =>
    `${Of(device, c)} adresas nustatytas rankiniu būdu, prašyti jo iš maršrutizatoriaus nereikia.`,
  NoGateway: ({ device, ip }, c) =>
    `${q(device, c)} nežino, per ką siųsti voką adresu ${ip}: maršrutizatorius nenustatytas.`,
  NoDnsServer: ({ device }, c) =>
    `${q(device, c)} nežino, ko klausti adreso pagal pavadinimą: DNS nenustatytas.`,
  ArpNoReply: ({ device, ip }, c) =>
    `Niekas neatsiliepė adresu ${ip}, todėl ${q(device, c)} negali išsiųsti voko.`,
  NoDhcpServer: ({ device }, c) =>
    `Niekas nedavė ${to(device, c)} adreso: šalia nėra maršrutizatoriaus su DHCP.`,
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
    `${On(device, c)} niekas neklauso prievado ${port} (${up(proto)}), ryšys atmestas.`,
  ListensOnlyOnLoopback: ({ device, port }, c) =>
    `${Of(device, c)} prievadas ${port} atviras tik jam pačiam (127.0.0.1).`,
  NameNotFound: ({ name }) => `DNS žinyne pavadinimo ${name} nėra.`,
  InvalidUrl: ({ url }) => `„${url}“ nėra svetainės adresas.`,
  FrameLost: ({ device }, c) => `Vokas pasimetė ${on(device, c)}.`,

  GoalNotLinked: ({ a, b }, c) => `${q(a, c)} ir ${q(b, c)} dar nesujungti.`,
  GoalWrongMedium: ({ a, b, want }, c) =>
    `${q(a, c)} ir ${q(b, c)} reikia sujungti ${how[want]}.`,
  GoalLinkDown: ({ a, b }, c) => `Ryšys ${q(a, c)} — ${q(b, c)} išjungtas.`,
  GoalNoRadioLink: ({ device, ap }, c) =>
    `Tarp įrenginių ${q(device, c)} ir ${q(ap, c)} nėra Wi-Fi ryšio.`,
  GoalWrongAddress: ({ device, have, want }, c) =>
    `${Of(device, c)} adresas ${have}, o reikia ${want}.`,
  AddressConflict: ({ ip, devices }, c) =>
    `Adresą ${ip} turi keli įrenginiai: ${all(devices, c)}.`,
  GoalReachable: ({ from, at }, c) =>
    `Vokas iš ${of(from, c)} pasiekia ${acc(at, c)}, nors neturėtų.`,
  GoalNotListening: ({ device, proto, port }, c) =>
    `${On(device, c)} niekas neklauso prievado ${port} (${up(proto)}).`,
  GoalListeningOnWrongAddress: ({ device, port, bind, want }, c) =>
    `${Of(device, c)} prievado ${port} klausoma adresu ${bind}, o reikia ${want}.`,
  GoalResolvesElsewhere: ({ name, have, want }) =>
    `Pavadinimas ${name} veda į ${have}, o turi vesti į ${want}.`,

  InvalidCidr: ({ value }) =>
    `„${value}“ nėra tinklas: rašoma taip: 10.0.0.0/8.`,
  CellularNeedsOperator: ({ a, b }, c) =>
    `Mobilusis ryšys jungia telefoną su operatoriumi, o ne ${acc(a, c)} su ${q(b, c)}.`,
  VirtualNeedsContainer: ({ a, b }, c) =>
    `Docker tiltas jungia konteinerį tik su jo šeimininku, o ne ${acc(a, c)} su ${q(b, c)}.`,
  NotATransit: ({ id }, c) => `${q(id, c)} nėra tiekėjo maršrutizatorius.`,
  NotAVpnGateway: ({ id }, c) => `${q(id, c)} nėra VPN šliuzas.`,
  NotADockerHost: ({ id }, c) => `${On(id, c)} Docker nepaleistas.`,
  NoVpnClient: ({ device }, c) => `${On(device, c)} VPN nenustatytas.`,
  RouteViaOutsideLan: ({ via }) =>
    `Kitas maršrutizatorius ${via} turi būti namų tinkle.`,
  NotANeighbour: ({ device, via }, c) =>
    `${q(via, c)} nesujungtas su ${of(device, c)} tiesiogiai.`,
  ForwardOutsideLan: ({ ip }) =>
    `Peradresavimas veda į ${ip}, o reikia adreso iš jūsų namų.`,
  ForwardPortTaken: ({ proto, port }) =>
    `Taisyklė ${up(proto)} ${port} jau yra.`,
  UnknownForward: ({ proto, port }) => `Taisyklės ${up(proto)} ${port} nėra.`,
  UnknownZone: ({ zone }) => `Šiame DNS serveryje domeno ${zone} nėra.`,
  UnknownRecord: ({ name, rtype }) => `${name} neturi ${rtype} įrašo.`,
  RecordNeedsAddress: ({ rtype, value }) =>
    `${rtype} įrašas rodo į adresą, o „${value}“ nėra adresas.`,
  CnameNeedsName: ({ value }) =>
    `CNAME rodo į pavadinimą, o ne į adresą „${value}“. Adresui reikia A įrašo.`,
  CnameAtApex: ({ zone }) =>
    `CNAME negalima dėti pačiam domenui ${zone} (@): @ reikia A įrašo.`,
  CnameConflict: ({ name }) =>
    `${name} jau turi kitų įrašų, todėl šalia jų CNAME dėti negalima.`,
  SplitTunnelEmpty: () =>
    'Režime „Tik darbo tinklai“ sąrašas negali būti tuščias: į tunelį nieko neitų.',
  InvalidPortMapping: ({ value }) =>
    `„${value}“ nėra prievado publikavimas: rašoma „išorėje:viduje“, pavyzdžiui, 8080:3000.`,
  HostPortTaken: ({ port }) =>
    `Šeimininko prievadą ${port} jau užima kitos durys.`,
  NoRelay: () => 'Lentoje nėra tunelio tarpininko.',
  NoCertificateAuthority: () => 'Lentoje nėra sertifikavimo centro.',
  NameIsAddress: ({ value }) =>
    `Reikia svetainės pavadinimo, o ne adreso ${value}.`,
  AcmeChallengeFailed: ({ name, problem }) =>
    `Sertifikavimo centras nepatvirtino ${name}: ${acme[problem]}.`,

  ForeignOpenNetwork: ({ ssid }) =>
    `„${ssid}“ yra svetimas atviras tinklas: prisijungti gali bet kuris praeivis. Pasirinkite savo tinklą nuo lipduko.`,
  ForeignNetwork: ({ ssid }) =>
    `„${ssid}“ nėra jūsų tinklas. Palyginkite pavadinimą su lipduku ant maršrutizatoriaus.`,
  NetworkNotFound: ({ ssid }) => `Tinklo „${ssid}“ šalia nėra.`,

  FirewallAllowed: ({ scope: where, maybeRule }) =>
    `${scope[where]} praleidžia voką: ${ruleName(maybeRule)}.`,
  TunnelUnwrapped: ({ device }, c) =>
    `${q(device, c)} ištraukia voką iš tunelio.`,
  RelayPassed: ({ device }, c) =>
    `${q(device, c)} perduoda voką toliau linija.`,
  PortPublished: ({ device, port, container }, c) =>
    `${q(device, c)} perduoda voką iš prievado ${port} į konteinerį ${q(container, c)}.`,

  GatewayUnreachable: ({ gateway }) =>
    `Šliuzas ${gateway} neatsako: tokio įrenginio tinkle nėra.`,
  GatewayIsSelf: ({ device }, c) =>
    `${q(device, c)} nurodo šliuzu save patį. Šliuzas yra maršrutizatorius.`,
  GatewayNotARouter: ({ gateway }) =>
    `${gateway} nėra maršrutizatorius: svetimų vokų jis toliau neperduoda.`,
  PublishedPortClosed: ({ device, port }, c) =>
    `Durys atsidarė, bet ${on(device, c)} prievado ${port} niekas neklauso: atsakymas tuščias.`,
  AppDown: ({ device, host, port }, c) =>
    `${q(device, c)} vis lūžta: nepasiekia ${host}:${port}.`,
  FirewallDropped: ({ scope: where, maybeRule }) =>
    `${scope[where]} tyliai išmeta voką (${ruleName(maybeRule)}).`,
  FirewallRejected: ({ scope: where, maybeRule }) =>
    `${scope[where]} iškart atsisako (${ruleName(maybeRule)}).`,
  TunnelNoRoute: ({ gateway, ip }, c) =>
    `${Of(gateway, c)} kelio į ${ip} nėra: tokio tinklo biure nėra.`,
  NotConnected: ({ device }, c) => `${q(device, c)} neprijungtas prie tunelio.`,
  TunnelNotFound: ({ name }) => `Tunelio ${name} nėra: puslapis 404.`,
  UpstreamFailed: ({ device, port }, c) =>
    `Už ${of(device, c)} prievadu ${port} niekas neatsako: 502 Bad Gateway.`,
  CertNameMismatch: ({ name, names }) =>
    `Sertifikatas išduotas ${names.join(', ')}, o ne ${name}.`,
  CertExpired: ({ name, notAfter }) =>
    `${name} sertifikato galiojimas baigėsi ${notAfter}.`,
  CertUntrusted: ({ name, issuer }) =>
    `${name} sertifikatą išdavė „${issuer}“, o juo naršyklė nepasitiki.`,
  TlsNotConfigured: ({ device, port }, c) =>
    `${On(device, c)} prievadas ${port} nemoka HTTPS: sertifikato nėra.`,
  HttpError: ({ device, status }, c) =>
    `${q(device, c)} atsako klaida ${status}.`,

  SeveralAddresses: ({ name, ips }) =>
    `${name} turi kelis adresus: ${ips.join(', ')}. Dalis lankytojų pateks ne ten.`,
  GoalWifiTooWeak: ({ ap, security: have, want }, c) =>
    `${Of(ap, c)} Wi-Fi yra ${security[have]}, o reikia ne silpnesnio nei ${security[want]}.`,
  GoalChannelBusy: ({ ap, others }, c) =>
    `${Of(ap, c)} kanalas persidengia su kaimynais: ${all(others, c)}.`,
  GoalNotPerformed: ({ from, at }, c) =>
    `Vokas iš ${of(from, c)} dar nepasiekė ${acc(at, c)}.`,
  GoalNoRecord: ({ zone, name, rtype }) =>
    `Domene ${zone} nėra ${rtype} įrašo ${name}.`,
  GoalRecordValue: ({ name, rtype, have, want }) =>
    `${name} ${rtype} įrašas yra ${have.join(', ')}, o reikia ${want}.`,
  GoalCommandNotRun: ({ device, commands }, c) =>
    `${On(device, c)} dar nepaleista ${commands.join(' ar ')}.`,
  GoalCommandSawOther: ({ name, saw, want }) =>
    `Komanda parodė ${saw.join(', ') || 'nieko'} pavadinimui ${name}, o laukiame ${want}.`,
  GoalExtraOpenPort: ({ target, port }) =>
    `Iš išorės atviras perteklinis prievadas ${port} adresu ${target}.`,
  GoalPortNotOpen: ({ target, port }) =>
    `Prievadas ${port} adresu ${target} uždarytas, o turi būti atviras.`,
  GoalNotRedirected: ({ url, status }) =>
    `${url} nenukreipia į https:// (atsakymas ${status}).`,
  GoalNotThrough: ({ device }, c) => `Vokas eina pro šalį ${of(device, c)}.`,
  GoalThrough: ({ device }, c) =>
    `Vokas eina per ${acc(device, c)}, o turi eiti tiesiogiai.`,
  GoalNoDevice: ({ id }, c) => `Lentoje dar nėra ${of(id, c)}.`,
  SshLockedOut: ({ device }, c) =>
    `Uždarėte ssh patys sau: ${q(device, c)} jūsų daugiau neįleidžia.`,

  UnknownCommand: ({ command, available }) =>
    `Komandos ${command} čia nėra. Bandykite: ${available.join(', ')}.`,
  CommandLocked: ({ command, available }) =>
    `Komanda ${command} atsivers vėliau kurse. Dabar galima: ${available.join(', ')}.`,
  CommandUsage: ({ usage }) => `Ši komanda rašoma taip: ${usage}.`,
  NoLinkLayer: ({ device }, c) =>
    `${q(device, c)} negali perskaityti voko: išorėje turi būti kadras su MAC.`,
  NoAddressLayer: ({ device }, c) =>
    `${q(device, c)} neranda gavėjo adreso: IP turi eiti iškart po kadro.`,
  NoPortLayer: ({ device }, c) =>
    `${q(device, c)} neranda prievado numerio: TCP turi eiti iškart po IP.`,
  EnvelopeMisordered: ({ position, expected, found }) =>
    `${position} vietoje turi būti sluoksnis ${expected}, o yra ${found || 'nieko'}.`,
}
