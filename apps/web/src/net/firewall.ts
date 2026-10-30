import { Array, Match, Option, pipe } from 'effect'

import { inCidr } from './address'
import {
  type Direction,
  type Firewall,
  type FirewallAction,
  type FirewallRule,
  type Ip,
  type NatProto,
  type Port,
} from './model'
import { type Layer } from './packet'

/** Что файрвол решил о пакете: действие и номер строки с 1 (`none` —
    сработало умолчание направления). */
export type Verdict = Readonly<{
  action: FirewallAction
  maybeRule: Option.Option<number>
}>

/** Пакет, открывающий соединение: его проверяет файрвол. Ответы на свои
    соединения проходят без проверки, как у conntrack. */
export type Opener = Readonly<{ proto: NatProto; port: Port }>

export const openerOf = (
  payload: ReadonlyArray<Layer>,
): Option.Option<Opener> =>
  pipe(
    Array.head(payload),
    Option.flatMap((layer): Option.Option<Opener> =>
      Match.value(layer).pipe(
        Match.tag('Tcp', tcp =>
          tcp.flags === 'SYN'
            ? Option.some<Opener>({ proto: 'tcp', port: tcp.dst })
            : Option.none<Opener>(),
        ),
        Match.tag('Udp', udp =>
          Array.some(
            payload,
            inner =>
              (inner._tag === 'Dns' && inner.kind === 'query') ||
              (inner._tag === 'Payload' && inner.kind === 'request') ||
              inner._tag === 'Tunnel',
          )
            ? Option.some<Opener>({ proto: 'udp', port: udp.dst })
            : Option.none<Opener>(),
        ),
        Match.tag('Icmp', icmp =>
          icmp.kind === 'echo-request'
            ? Option.some<Opener>({ proto: 'icmp', port: 0 })
            : Option.none<Opener>(),
        ),
        Match.orElse(() => Option.none<Opener>()),
      ),
    ),
  )

const matches = (
  rule: FirewallRule,
  direction: Direction,
  opener: Opener,
  remote: Ip,
): boolean =>
  rule.direction === direction &&
  (rule.proto === 'any' || rule.proto === opener.proto) &&
  Option.match(rule.maybePort, {
    onNone: () => true,
    onSome: port => port === opener.port,
  }) &&
  Option.match(rule.maybeFrom, {
    onNone: () => true,
    onSome: cidr => inCidr(remote, cidr),
  })

/** Правила сверху вниз: решает первое совпадение, иначе умолчание. Эхо
    ICMP файрвол пропускает всегда, как `ufw` по умолчанию; выключенный
    файрвол не проверяет ничего. */
export const judge = (
  firewall: Firewall,
  direction: Direction,
  opener: Opener,
  remote: Ip,
): Option.Option<Verdict> =>
  !firewall.enabled || opener.proto === 'icmp'
    ? Option.none()
    : Option.some(
        pipe(
          firewall.rules,
          Array.findFirstIndex(rule =>
            matches(rule, direction, opener, remote),
          ),
          Option.flatMap(index =>
            Option.map(Array.get(firewall.rules, index), rule => ({
              action: rule.action,
              maybeRule: Option.some(index + 1),
            })),
          ),
          Option.getOrElse((): Verdict => ({
            action:
              direction === 'in' ? firewall.defaultIn : firewall.defaultOut,
            maybeRule: Option.none(),
          })),
        ),
      )

export const offFirewall: Firewall = {
  enabled: false,
  defaultIn: 'drop',
  defaultOut: 'allow',
  rules: [],
}
