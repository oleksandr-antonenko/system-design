import { Array, Option, pipe } from 'effect'

import type { BrowserError } from '../../../net/browser'
import { type TerminalFeature, allFeatures } from '../../../net/terminal'

// Что из поверхностей устройств открыто к уроку (план 3.4). Элементы курса
// (`UiFeature`) отображаются на команды терминала и экраны браузера модели
// пакетов. Закрытое не показывается вовсе, а не выключается.

export const isOpen = (
  unlocked: ReadonlyArray<string>,
  feature: string,
): boolean => Array.contains(unlocked, feature)

/** Песочница последнего урока открывает всё. */
const SANDBOX = 'board.sandbox'

/** Команда или деталь вывода терминала — элемент курса, который её открыл. */
const terminalUnlocks: ReadonlyArray<readonly [TerminalFeature, string]> = [
  ['ip', 'terminal.ipAddr'],
  ['ip.route', 'terminal.ipRoute'],
  ['ip.mac', 'board.deviceMac'],
  ['ping', 'terminal.ping'],
  ['ping.ttl', 'terminal.traceroute'],
  ['arp', 'terminal.arp'],
  ['npm', 'terminal.npmRunDev'],
  ['traceroute', 'terminal.traceroute'],
  ['nslookup', 'terminal.nslookup'],
  ['dig', 'terminal.dig'],
  ['curl', 'terminal.curl'],
  ['ss', 'terminal.ss'],
  ['nc', 'terminal.nc'],
  ['docker', 'terminal.docker'],
  ['ufw', 'terminal.ufw'],
  ['tunnel', 'terminal.tunnel'],
]

/** Команды и детали вывода, которые знает терминал на этом уроке. */
export const terminalFeatures = (
  unlocked: ReadonlyArray<string>,
): ReadonlyArray<TerminalFeature> =>
  isOpen(unlocked, SANDBOX)
    ? allFeatures
    : Array.getSomes(
        Array.map(terminalUnlocks, ([command, feature]) =>
          isOpen(unlocked, feature) ? Option.some(command) : Option.none(),
        ),
      )

/** Кнопки-подсказки: как набирают открытую команду. С пробелом в конце —
    команде нужен адрес. */
const suggestionOf: ReadonlyArray<readonly [TerminalFeature, string]> = [
  ['ip', 'ip a'],
  ['ip.route', 'ip route'],
  ['ping', 'ping '],
  ['arp', 'arp -a'],
  ['npm', 'npm run dev'],
  ['traceroute', 'traceroute '],
  ['nslookup', 'nslookup '],
  ['dig', 'dig '],
  ['curl', 'curl -v '],
  ['ss', 'ss -ltn'],
  ['nc', 'nc -zv '],
  ['docker', 'docker ps'],
  ['ufw', 'sudo ufw status'],
  ['tunnel', 'tunnel http '],
]

export type Suggestion = Readonly<{ command: string; isNew: boolean }>

/** Подсказки терминала в порядке открытия; в уроке 15 их нет. */
export const suggestions = (
  unlocked: ReadonlyArray<string>,
  newFeatures: ReadonlyArray<string>,
): ReadonlyArray<Suggestion> =>
  isOpen(unlocked, 'terminal.freeInput')
    ? []
    : pipe(
        terminalFeatures(unlocked),
        Array.map(command =>
          Option.map(
            Array.findFirst(suggestionOf, ([each]) => each === command),
            ([, text]) => ({
              command: text,
              isNew: Array.some(
                terminalUnlocks,
                ([each, feature]) =>
                  each === command && isOpen(newFeatures, feature),
              ),
            }),
          ),
        ),
        Array.getSomes,
      )

/** Код ошибки браузера виден, когда его открыл курс. У кодов без своего
    элемента достаточно адресной строки. */
const errorUnlocks: Readonly<Record<BrowserError, string>> = {
  ERR_NAME_NOT_RESOLVED: 'browser.errNameNotResolved',
  ERR_CONNECTION_REFUSED: 'browser.errConnectionRefused',
  ERR_CONNECTION_TIMED_OUT: 'browser.errConnectionTimedOut',
  'NET::ERR_CERT_COMMON_NAME_INVALID': 'browser.errCert',
  'NET::ERR_CERT_DATE_INVALID': 'browser.errCert',
  'NET::ERR_CERT_AUTHORITY_INVALID': 'browser.errCert',
  ERR_INTERNET_DISCONNECTED: 'browser.addressBar',
  ERR_ADDRESS_UNREACHABLE: 'browser.addressBar',
  ERR_EMPTY_RESPONSE: 'browser.addressBar',
  ERR_SSL_PROTOCOL_ERROR: 'browser.addressBar',
  ERR_INVALID_URL: 'browser.addressBar',
}

export const errorFeature = (code: BrowserError): string => errorUnlocks[code]

export const isCodeShown = (
  unlocked: ReadonlyArray<string>,
  code: BrowserError,
): boolean => isOpen(unlocked, SANDBOX) || isOpen(unlocked, errorUnlocks[code])

export const isCertError = (code: BrowserError): boolean =>
  code.startsWith('NET::ERR_CERT_')
