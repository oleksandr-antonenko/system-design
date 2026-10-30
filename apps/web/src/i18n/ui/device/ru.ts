import type { BrowserError } from '../../../net/browser'
import type { DeviceStrings, ErrorScreenText } from './types'

const unreachable = 'Не удаётся получить доступ к сайту'
const unsafe = 'Подключение не защищено'
const stolen = (host: string) =>
  `Злоумышленники могут пытаться похитить ваши данные с сайта ${host} (например, пароли, сообщения или номера банковских карт).`

const errorScreens: Readonly<
  Record<BrowserError, (host: string) => ErrorScreenText>
> = {
  ERR_CONNECTION_REFUSED: host => ({
    title: unreachable,
    line: `Сайт ${host} не позволяет установить соединение.`,
  }),
  ERR_CONNECTION_TIMED_OUT: host => ({
    title: unreachable,
    line: `Превышено время ожидания ответа от сайта ${host}.`,
  }),
  ERR_NAME_NOT_RESOLVED: host => ({
    title: `Не удаётся найти сайт ${host}`,
    line: `Не удалось найти IP-адрес сервера ${host}.`,
  }),
  ERR_INTERNET_DISCONNECTED: () => ({
    title: 'Нет подключения к интернету',
    line: 'Проверьте подключение к Wi-Fi.',
  }),
  ERR_ADDRESS_UNREACHABLE: host => ({
    title: unreachable,
    line: `Адрес ${host} недоступен.`,
  }),
  ERR_EMPTY_RESPONSE: host => ({
    title: 'Страница недоступна',
    line: `Сайт ${host} не отправил данных.`,
  }),
  ERR_SSL_PROTOCOL_ERROR: host => ({
    title: 'Не удаётся установить безопасное соединение',
    line: `Сайт ${host} отправил недействительный ответ.`,
  }),
  ERR_INVALID_URL: host => ({
    title: 'Не удаётся открыть страницу',
    line: `Адрес ${host} написан с ошибкой.`,
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

export const deviceRu: DeviceStrings = {
  screenTab: device => `Экран · ${device}`,
  terminalTab: device => `Терминал · ${device}`,
  consoleTab: device => `Консоль хостинга · ${device}`,

  screenLabel: device => `Экран: ${device}`,
  apps: 'Приложения',
  appSettings: 'Настройки',
  appNetwork: 'Сеть',
  appBrowser: 'Браузер',
  noNetwork: 'нет сети',
  back: 'Назад',

  wifiTitle: 'Wi-Fi',
  wifiOn: 'Wi-Fi включён',
  myNetwork: 'Моя сеть',
  nearby: 'Сети рядом',
  otherNetworks: 'Другие сети',
  noNetworks: 'Рядом нет сетей Wi-Fi.',
  connected: 'Подключено',
  notConnected: 'Не подключено',
  secured: 'Защищена паролем',
  openNetwork: 'Открытая сеть, без пароля',
  signal: bars => `Сигнал: ${bars} из 3`,
  wifiNote:
    'Замок значит, что сеть защищена паролем. Чем больше полосок, тем лучше ловит.',
  passwordFor: ssid => `Пароль для «${ssid}»`,
  password: 'Пароль',
  showPassword: 'Показать пароль',
  hidePassword: 'Скрыть пароль',
  join: 'Подключиться',
  cancel: 'Отмена',
  understood: 'Понятно, выберу свою',
  foreignTitle: ssid => `«${ssid}» — не ваша сеть`,
  wifiJoined: ssid => `Подключено к сети «${ssid}»`,
  networkInfo: network => `Сведения о сети ${network}`,

  ethernet: 'Кабель (Ethernet)',
  ipAddress: 'IP-адрес',
  mask: 'Маска',
  router: 'Роутер',
  dns: 'DNS',
  none: '—',
  configureDns: 'Настроить DNS',
  configureAddress: 'Настройка адреса',
  automatic: 'Автоматически',
  manual: 'Вручную',
  dnsAutomatic: 'Автоматически (от роутера)',
  dnsServers: 'DNS-серверы',
  dnsServersEmpty: 'Список пуст: спросить адрес по имени не у кого.',
  newServer: 'Адрес сервера',
  addServer: 'Добавить сервер',
  removeServer: server => `Убрать ${server}`,
  addressAutomatic: 'Автоматически от роутера',
  gateway: 'Роутер (шлюз)',
  save: 'Сохранить',
  forget: 'Забыть эту сеть',

  addressBar: 'Адрес сайта',
  go: 'Открыть',
  reload: 'Обновить',
  startPage: 'Наберите адрес сайта в строке сверху.',
  blankPage: 'Здесь откроется сайт.',
  secure: 'Соединение защищено',
  notSecure: 'Не защищено',
  certificate: 'Сертификат',
  certIssuedTo: 'Кому выдан',
  certIssuedBy: 'Кем выдан',
  certValidUntil: 'Действует до',
  close: 'Закрыть',
  pageFrom: site => `Страница пришла в ответном конверте от: ${site}.`,
  devPageTitle: 'Мой сайт',
  devPageBody: 'Эту страницу показывает dev-сервер с вашего ноутбука.',
  loginTitle: 'Вход',
  login: 'Логин',
  signIn: 'Войти',
  advanced: 'Дополнительные',
  hideAdvanced: 'Скрыть подробности',
  why: 'Почему',
  errorScreen: (code, host) => errorScreens[code](host),

  terminalLabel: device => `Терминал: ${device}`,
  commandLine: 'Команда',
  running: 'Сервер работает в этом окне. Ctrl+C — остановить.',
  busy: 'Сервер ещё работает в этом окне и занимает его. Остановите его: Ctrl+C.',
  suggestions: 'Команды',
  interrupt: 'Остановить программу (Ctrl+C)',
  consoleNote:
    'Вход по ssh закрыт. Это консоль хостинга: она работает напрямую, без ssh.',
}
