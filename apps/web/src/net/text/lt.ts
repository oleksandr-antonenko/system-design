import { type Medium, type WifiBand } from '../model'
import { type NetTexts, type TextContext } from './types'

const band = (value: WifiBand): string =>
  value === 'dual' ? '2,4 ir 5 GHz' : value === '2.4' ? '2,4 GHz' : '5 GHz'

const how: Readonly<Record<Medium, string>> = {
  cable: 'kabeliu',
  radio: 'per Wi-Fi',
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
}
