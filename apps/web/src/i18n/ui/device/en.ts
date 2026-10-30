import type { BrowserError } from '../../../net/browser'
import type { DeviceStrings, ErrorScreenText } from './types'

const unreachable = 'This site can’t be reached'
const unsafe = 'Your connection is not private'
const stolen = (host: string) =>
  `Attackers might be trying to steal your information from ${host} (for example, passwords, messages, or credit cards).`

const errorScreens: Readonly<
  Record<BrowserError, (host: string) => ErrorScreenText>
> = {
  ERR_CONNECTION_REFUSED: host => ({
    title: unreachable,
    line: `${host} refused to connect.`,
  }),
  ERR_CONNECTION_TIMED_OUT: host => ({
    title: unreachable,
    line: `${host} took too long to respond.`,
  }),
  ERR_NAME_NOT_RESOLVED: host => ({
    title: unreachable,
    line: `${host}’s server IP address could not be found.`,
  }),
  ERR_INTERNET_DISCONNECTED: () => ({
    title: 'No internet',
    line: 'Check your Wi-Fi connection.',
  }),
  ERR_ADDRESS_UNREACHABLE: host => ({
    title: unreachable,
    line: `${host} is unreachable.`,
  }),
  ERR_EMPTY_RESPONSE: host => ({
    title: 'This page isn’t working',
    line: `${host} didn’t send any data.`,
  }),
  ERR_SSL_PROTOCOL_ERROR: host => ({
    title: 'This site can’t provide a secure connection',
    line: `${host} sent an invalid response.`,
  }),
  ERR_INVALID_URL: host => ({
    title: 'This page can’t be opened',
    line: `The address ${host} is misspelled.`,
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

export const deviceEn: DeviceStrings = {
  screenTab: device => `Screen · ${device}`,
  terminalTab: device => `Terminal · ${device}`,
  consoleTab: device => `Hosting console · ${device}`,

  screenLabel: device => `Screen: ${device}`,
  apps: 'Apps',
  appSettings: 'Settings',
  appNetwork: 'Network',
  appBrowser: 'Browser',
  noNetwork: 'no network',
  back: 'Back',

  wifiTitle: 'Wi-Fi',
  wifiOn: 'Wi-Fi is on',
  myNetwork: 'My network',
  nearby: 'Networks nearby',
  otherNetworks: 'Other networks',
  noNetworks: 'No Wi-Fi networks nearby.',
  connected: 'Connected',
  notConnected: 'Not connected',
  secured: 'Protected by a password',
  openNetwork: 'Open network, no password',
  signal: bars => `Signal: ${bars} of 3`,
  wifiNote:
    'A lock means the network is protected by a password. More bars mean a better signal.',
  passwordFor: ssid => `Password for “${ssid}”`,
  password: 'Password',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  join: 'Join',
  cancel: 'Cancel',
  understood: 'Got it, I’ll pick mine',
  foreignTitle: ssid => `“${ssid}” is not your network`,
  wifiJoined: ssid => `Connected to “${ssid}”`,
  networkInfo: network => `Details of ${network}`,

  ethernet: 'Cable (Ethernet)',
  ipAddress: 'IP address',
  mask: 'Subnet mask',
  router: 'Router',
  dns: 'DNS',
  none: '—',
  configureDns: 'Configure DNS',
  configureAddress: 'Configure IP',
  automatic: 'Automatic',
  manual: 'Manual',
  dnsAutomatic: 'Automatic (from the router)',
  dnsServers: 'DNS servers',
  dnsServersEmpty: 'The list is empty: there is no one to ask for addresses.',
  newServer: 'Server address',
  addServer: 'Add DNS server',
  removeServer: server => `Remove ${server}`,
  addressAutomatic: 'Automatic from the router',
  gateway: 'Router (gateway)',
  save: 'Save',
  forget: 'Forget this network',

  addressBar: 'Site address',
  go: 'Go',
  reload: 'Reload',
  startPage: 'Type a site address in the bar above.',
  blankPage: 'The site will open here.',
  secure: 'Connection is secure',
  notSecure: 'Not secure',
  certificate: 'Certificate',
  certIssuedTo: 'Issued to',
  certIssuedBy: 'Issued by',
  certValidUntil: 'Valid until',
  close: 'Close',
  pageFrom: site => `The page came back in a reply envelope from: ${site}.`,
  devPageTitle: 'My site',
  devPageBody: 'This page comes from the dev server on your laptop.',
  loginTitle: 'Sign in',
  login: 'Login',
  signIn: 'Sign in',
  advanced: 'Advanced',
  hideAdvanced: 'Hide details',
  why: 'Why',
  errorScreen: (code, host) => errorScreens[code](host),

  terminalLabel: device => `Terminal: ${device}`,
  commandLine: 'Command',
  running: 'The server is running in this window. Ctrl+C stops it.',
  busy: 'The server is still running in this window and holds it. Stop it first: Ctrl+C.',
  suggestions: 'Commands',
  interrupt: 'Stop the program (Ctrl+C)',
  consoleNote:
    'ssh is closed. This is the hosting console: it works directly, without ssh.',
}
