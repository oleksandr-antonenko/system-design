import type { BrowserError } from '../../../net/browser'

/** Экран ошибки браузера: заголовок и строка, как в настоящем браузере на
    языке интерфейса. Код ошибки не переводится. */
export type ErrorScreenText = Readonly<{ title: string; line: string }>

/** Тексты поверхностей устройств курса сетей: экран телефона или ноутбука
    (настройки сети и браузер) и терминал. Вывод команд и коды ошибок не
    переводятся, поэтому их здесь нет. */
export type DeviceStrings = Readonly<{
  // TABS
  screenTab: (device: string) => string
  terminalTab: (device: string) => string
  consoleTab: (device: string) => string

  // SCREEN
  screenLabel: (device: string) => string
  apps: string
  appSettings: string
  appNetwork: string
  appBrowser: string
  noNetwork: string
  back: string

  // WI-FI
  wifiTitle: string
  wifiOn: string
  myNetwork: string
  nearby: string
  otherNetworks: string
  noNetworks: string
  connected: string
  notConnected: string
  secured: string
  openNetwork: string
  signal: (bars: number) => string
  wifiNote: string
  passwordFor: (ssid: string) => string
  password: string
  showPassword: string
  hidePassword: string
  join: string
  cancel: string
  understood: string
  foreignTitle: (ssid: string) => string
  wifiJoined: (ssid: string) => string
  networkInfo: (network: string) => string

  // NETWORK INFO
  ethernet: string
  ipAddress: string
  mask: string
  router: string
  dns: string
  none: string
  configureDns: string
  configureAddress: string
  automatic: string
  manual: string
  dnsAutomatic: string
  dnsServers: string
  dnsServersEmpty: string
  newServer: string
  addServer: string
  removeServer: (server: string) => string
  addressAutomatic: string
  gateway: string
  save: string
  forget: string

  // BROWSER
  addressBar: string
  go: string
  reload: string
  startPage: string
  blankPage: string
  secure: string
  notSecure: string
  certificate: string
  certIssuedTo: string
  certIssuedBy: string
  certValidUntil: string
  close: string
  pageFrom: (site: string) => string
  devPageTitle: string
  devPageBody: string
  loginTitle: string
  login: string
  signIn: string
  advanced: string
  hideAdvanced: string
  why: string
  errorScreen: (code: BrowserError, host: string) => ErrorScreenText

  // TERMINAL
  terminalLabel: (device: string) => string
  commandLine: string
  running: string
  busy: string
  suggestions: string
  interrupt: string
  consoleNote: string
}>
