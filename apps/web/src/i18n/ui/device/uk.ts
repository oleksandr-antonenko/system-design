import type { BrowserError } from '../../../net/browser'
import type { DeviceStrings, ErrorScreenText } from './types'

const unreachable = 'Не вдається отримати доступ до сайту'
const unsafe = 'Підключення не захищене'
const stolen = (host: string) =>
  `Зловмисники можуть намагатися викрасти ваші дані із сайту ${host} (наприклад, паролі, повідомлення або номери банківських карток).`

const errorScreens: Readonly<
  Record<BrowserError, (host: string) => ErrorScreenText>
> = {
  ERR_CONNECTION_REFUSED: host => ({
    title: unreachable,
    line: `Сайт ${host} не дозволяє встановити з’єднання.`,
  }),
  ERR_CONNECTION_TIMED_OUT: host => ({
    title: unreachable,
    line: `Сайт ${host} занадто довго не відповідає.`,
  }),
  ERR_NAME_NOT_RESOLVED: host => ({
    title: `Не вдається знайти сайт ${host}`,
    line: `Не вдалося знайти IP-адресу сервера ${host}.`,
  }),
  ERR_INTERNET_DISCONNECTED: () => ({
    title: 'Немає підключення до інтернету',
    line: 'Перевірте підключення до Wi-Fi.',
  }),
  ERR_ADDRESS_UNREACHABLE: host => ({
    title: unreachable,
    line: `Адреса ${host} недоступна.`,
  }),
  ERR_EMPTY_RESPONSE: host => ({
    title: 'Сторінка недоступна',
    line: `Сайт ${host} не надіслав даних.`,
  }),
  ERR_SSL_PROTOCOL_ERROR: host => ({
    title: 'Не вдається встановити безпечне з’єднання',
    line: `Сайт ${host} надіслав недійсну відповідь.`,
  }),
  ERR_INVALID_URL: host => ({
    title: 'Не вдається відкрити сторінку',
    line: `Адресу ${host} написано з помилкою.`,
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

export const deviceUk: DeviceStrings = {
  screenTab: device => `Екран · ${device}`,
  terminalTab: device => `Термінал · ${device}`,
  consoleTab: device => `Консоль хостингу · ${device}`,

  screenLabel: device => `Екран: ${device}`,
  apps: 'Застосунки',
  appSettings: 'Налаштування',
  appNetwork: 'Мережа',
  appBrowser: 'Браузер',
  noNetwork: 'немає мережі',
  back: 'Назад',

  wifiTitle: 'Wi-Fi',
  wifiOn: 'Wi-Fi увімкнено',
  myNetwork: 'Моя мережа',
  nearby: 'Мережі поруч',
  otherNetworks: 'Інші мережі',
  noNetworks: 'Поруч немає мереж Wi-Fi.',
  connected: 'Підключено',
  notConnected: 'Не підключено',
  secured: 'Захищена паролем',
  openNetwork: 'Відкрита мережа, без пароля',
  signal: bars => `Сигнал: ${bars} з 3`,
  wifiNote:
    'Замок означає, що мережа захищена паролем. Що більше смужок, то краще ловить.',
  passwordFor: ssid => `Пароль для «${ssid}»`,
  password: 'Пароль',
  showPassword: 'Показати пароль',
  hidePassword: 'Сховати пароль',
  join: 'Підключитися',
  cancel: 'Скасувати',
  understood: 'Зрозуміло, виберу свою',
  foreignTitle: ssid => `«${ssid}» — не ваша мережа`,
  wifiJoined: ssid => `Підключено до мережі «${ssid}»`,
  networkInfo: network => `Відомості про мережу ${network}`,

  ethernet: 'Кабель (Ethernet)',
  ipAddress: 'IP address',
  mask: 'Subnet mask',
  router: 'Router',
  dns: 'DNS',
  none: '—',
  configureDns: 'Налаштувати DNS',
  configureAddress: 'Налаштування IP',
  automatic: 'Автоматично',
  manual: 'Вручну',
  dnsAutomatic: 'Автоматично (видає router)',
  dnsServers: 'DNS servers',
  dnsServersEmpty: 'Список порожній: спитати адресу за назвою нема в кого.',
  newServer: 'IP address',
  addServer: 'Додати DNS server',
  removeServer: server => `Прибрати ${server}`,
  addressAutomatic: 'Автоматично (видає router)',
  gateway: 'Router (gateway)',
  save: 'Зберегти',
  forget: 'Забути цю мережу',

  addressBar: 'Адреса сайту',
  go: 'Відкрити',
  reload: 'Оновити',
  startPage: 'Наберіть адресу сайту в рядку вгорі.',
  blankPage: 'Тут відкриється сайт.',
  secure: 'З’єднання захищене',
  notSecure: 'Не захищено',
  certificate: 'Сертифікат',
  certIssuedTo: 'Кому видано',
  certIssuedBy: 'Ким видано',
  certValidUntil: 'Дійсний до',
  close: 'Закрити',
  pageFrom: site => `Сторінка прийшла у зворотному конверті від: ${site}.`,
  devPageTitle: 'Мій сайт',
  devPageBody: 'Цю сторінку показує dev server із вашого ноутбука.',
  loginTitle: 'Вхід',
  login: 'Логін',
  signIn: 'Увійти',
  advanced: 'Додатково',
  hideAdvanced: 'Сховати подробиці',
  why: 'Чому',
  errorScreen: (code, host) => errorScreens[code](host),

  terminalLabel: device => `Термінал: ${device}`,
  commandLine: 'Команда',
  running: 'Server працює в цьому вікні. Ctrl+C — зупинити.',
  busy: 'Server ще працює в цьому вікні й займає його. Зупиніть його: Ctrl+C.',
  suggestions: 'Команди',
  interrupt: 'Зупинити програму (Ctrl+C)',
  consoleNote:
    'Вхід через ssh закрито. Це консоль хостингу: вона працює напряму, без ssh.',

  reportTab: 'Звіт для ШІ',
  reportTitle: 'Звіт для ШІ-асистента',
  reportWhat: 'Що не працює',
  reportSymptom: (device, url) => `${device} не відкриває ${url}`,
  reportFixedNow: 'Зараз уже відкривається.',
  reportEvidence: 'Доказ',
  reportEvidenceHint:
    'Натисніть рядок виводу, який доводить поломку, — не більше двох рядків.',
  reportNoOutput:
    'Тут з’явиться вивід команд із термінала. Запустіть перевірки знизу вгору.',
  reportPicked: count => `Вибрано рядків: ${count} з 2`,
  reportWhere: 'Де поломка',
  reportFaults: {
    link: 'Немає зв’язку чи адреси',
    gateway: 'Gateway: конверт не виходить із дому',
    dns: 'DNS: довідкова не перетворює ім’я на адресу',
    firewall: 'Firewall не пускає на port',
    loopback: 'Сервер слухає тільки себе (127.0.0.1)',
    cert: 'Certificate виписано на інше ім’я',
  },
  reportSend: 'Надіслати звіт',
  reportReply: 'Відповідь асистента',
  reportApply: 'Застосувати',
  reportApplied: 'Виправлення застосовано.',
}
