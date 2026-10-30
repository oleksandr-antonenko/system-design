import type { BrowserError } from '../../../net/browser'
import type { DeviceStrings, ErrorScreenText } from './types'

const unreachable = 'Nepavyksta pasiekti svetainės'
const unsafe = 'Jūsų ryšys nėra privatus'
const stolen = (host: string) =>
  `Užpuolikai gali bandyti pavogti jūsų informaciją iš ${host} (pavyzdžiui, slaptažodžius, pranešimus ar banko kortelių numerius).`

const errorScreens: Readonly<
  Record<BrowserError, (host: string) => ErrorScreenText>
> = {
  ERR_CONNECTION_REFUSED: host => ({
    title: unreachable,
    line: `${host} atmetė prisijungimą.`,
  }),
  ERR_CONNECTION_TIMED_OUT: host => ({
    title: unreachable,
    line: `${host} per ilgai neatsako.`,
  }),
  ERR_NAME_NOT_RESOLVED: host => ({
    title: unreachable,
    line: `Nepavyko rasti ${host} serverio IP adreso.`,
  }),
  ERR_INTERNET_DISCONNECTED: () => ({
    title: 'Nėra interneto ryšio',
    line: 'Patikrinkite Wi-Fi ryšį.',
  }),
  ERR_ADDRESS_UNREACHABLE: host => ({
    title: unreachable,
    line: `Adresas ${host} nepasiekiamas.`,
  }),
  ERR_EMPTY_RESPONSE: host => ({
    title: 'Šis puslapis neveikia',
    line: `${host} neatsiuntė jokių duomenų.`,
  }),
  ERR_SSL_PROTOCOL_ERROR: host => ({
    title: 'Ši svetainė negali užtikrinti saugaus ryšio',
    line: `${host} atsiuntė netinkamą atsakymą.`,
  }),
  ERR_INVALID_URL: host => ({
    title: 'Šio puslapio atidaryti nepavyksta',
    line: `Adresas ${host} parašytas su klaida.`,
  }),
  'NET::ERR_CERT_COMMON_NAME_INVALID': host => ({
    title: unsafe,
    line: stolen(host),
  }),
  'NET::ERR_CERT_DATE_INVALID': host => ({ title: unsafe, line: stolen(host) }),
  'NET::ERR_CERT_AUTHORITY_INVALID': host => ({
    title: unsafe,
    line: stolen(host),
  }),
}

export const deviceLt: DeviceStrings = {
  screenTab: device => `Ekranas · ${device}`,
  terminalTab: device => `Terminalas · ${device}`,
  consoleTab: device => `Prieglobos konsolė · ${device}`,

  screenLabel: device => `Ekranas: ${device}`,
  apps: 'Programėlės',
  appSettings: 'Nustatymai',
  appNetwork: 'Tinklas',
  appBrowser: 'Naršyklė',
  noNetwork: 'nėra tinklo',
  back: 'Atgal',

  wifiTitle: 'Wi-Fi',
  wifiOn: 'Wi-Fi įjungtas',
  myNetwork: 'Mano tinklas',
  nearby: 'Tinklai netoliese',
  otherNetworks: 'Kiti tinklai',
  noNetworks: 'Netoliese nėra Wi-Fi tinklų.',
  connected: 'Prisijungta',
  notConnected: 'Neprisijungta',
  secured: 'Apsaugotas slaptažodžiu',
  openNetwork: 'Atviras tinklas, be slaptažodžio',
  signal: bars => `Signalas: ${bars} iš 3`,
  wifiNote:
    'Spyna reiškia, kad tinklas apsaugotas slaptažodžiu. Kuo daugiau brūkšnelių, tuo geresnis signalas.',
  passwordFor: ssid => `„${ssid}“ slaptažodis`,
  password: 'Slaptažodis',
  showPassword: 'Rodyti slaptažodį',
  hidePassword: 'Slėpti slaptažodį',
  join: 'Prisijungti',
  cancel: 'Atšaukti',
  understood: 'Supratau, pasirinksiu savo',
  foreignTitle: ssid => `„${ssid}“ — ne jūsų tinklas`,
  wifiJoined: ssid => `Prisijungta prie „${ssid}“`,
  networkInfo: network => `Tinklo ${network} informacija`,

  ethernet: 'Kabelis (Ethernet)',
  ipAddress: 'IP address',
  mask: 'Subnet mask',
  router: 'Router',
  dns: 'DNS',
  none: '—',
  configureDns: 'Nustatyti DNS',
  configureAddress: 'IP nustatymas',
  automatic: 'Automatiškai',
  manual: 'Rankiniu būdu',
  dnsAutomatic: 'Automatiškai (suteikia router)',
  dnsServers: 'DNS servers',
  dnsServersEmpty: 'Sąrašas tuščias: nėra ko paklausti adreso pagal vardą.',
  newServer: 'IP address',
  addServer: 'Pridėti DNS server',
  removeServer: server => `Pašalinti ${server}`,
  addressAutomatic: 'Automatiškai (suteikia router)',
  gateway: 'Router (gateway)',
  save: 'Išsaugoti',
  forget: 'Pamiršti šį tinklą',

  addressBar: 'Svetainės adresas',
  go: 'Atidaryti',
  reload: 'Įkelti iš naujo',
  startPage: 'Įrašykite svetainės adresą eilutėje viršuje.',
  blankPage: 'Čia atsidarys svetainė.',
  secure: 'Ryšys saugus',
  notSecure: 'Nesaugu',
  certificate: 'Sertifikatas',
  certIssuedTo: 'Kam išduotas',
  certIssuedBy: 'Kas išdavė',
  certValidUntil: 'Galioja iki',
  close: 'Uždaryti',
  pageFrom: site => `Puslapis atkeliavo atsakymo voke iš: ${site}.`,
  devPageTitle: 'Mano svetainė',
  devPageBody: 'Šį puslapį rodo dev server jūsų nešiojamajame kompiuteryje.',
  loginTitle: 'Prisijungimas',
  login: 'Vartotojo vardas',
  signIn: 'Prisijungti',
  advanced: 'Išsamiau',
  hideAdvanced: 'Slėpti išsamią informaciją',
  why: 'Kodėl',
  errorScreen: (code, host) => errorScreens[code](host),

  terminalLabel: device => `Terminalas: ${device}`,
  commandLine: 'Komanda',
  running: 'Server veikia šiame lange. Ctrl+C — sustabdyti.',
  busy: 'Server vis dar veikia šiame lange ir jį užima. Pirmiau sustabdykite: Ctrl+C.',
  suggestions: 'Komandos',
  interrupt: 'Sustabdyti programą (Ctrl+C)',
  consoleNote:
    'Prisijungimas per ssh uždarytas. Tai prieglobos konsolė: ji veikia tiesiogiai, be ssh.',

  reportTab: 'Ataskaita DI',
  reportTitle: 'Ataskaita DI asistentui',
  reportWhat: 'Kas neveikia',
  reportSymptom: (device, url) => `${device} neatidaro ${url}`,
  reportFixedNow: 'Dabar jau atsidaro.',
  reportEvidence: 'Įrodymas',
  reportEvidenceHint:
    'Spustelėkite išvesties eilutę, kuri įrodo gedimą, — ne daugiau kaip dvi eilutes.',
  reportNoOutput:
    'Čia atsiras komandų išvestis iš terminalo. Paleiskite patikras iš apačios į viršų.',
  reportPicked: count => `Pasirinkta eilučių: ${count} iš 2`,
  reportWhere: 'Kur gedimas',
  reportFaults: {
    link: 'Nėra ryšio ar adreso',
    gateway: 'Gateway: vokas neišeina iš namų',
    dns: 'DNS: informacijos tarnyba nepaverčia vardo adresu',
    firewall: 'Port uždarytas: firewall neįleidžia',
    loopback: 'Serveris klausosi tik savęs (127.0.0.1)',
    cert: 'Certificate išduotas kitam vardui',
  },
  reportSend: 'Siųsti ataskaitą',
  reportReply: 'Asistento atsakymas',
  reportApply: 'Pritaikyti',
  reportApplied: 'Pataisymas pritaikytas.',
}
