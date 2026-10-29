## 1. Тексты сообщений

- [ ] 1.1 Модуль `net/text/`: тип `NetTexts` по тегам `NetMessage`, словари uk, ru, en, lt, `renderNetMessage` с подписями устройств. Проверка: `pnpm exec tsc --noEmit --pretty false` без ошибок; тест «каждый код на каждом языке» зелёный.

## 2. Модуль 1 по новому плану (уроки 1–7)

- [ ] 2.1 Старые сценарии перенесены под новую нумерацию, механика сохранена. Проверка: `pnpm exec vitest run --silent=true --reporter=dot src/net` зелёный.
- [ ] 2.2 Пробелы механики модуля 1: принтер и лампочка, сети рядом и `checkJoin`, стены, транзитные роутеры провайдера, `Ping` по имени. Проверка: `wifi`- и `doc`-тесты.
- [ ] 2.3 Сценарии уроков 1–7 (`lessons-local.test.ts`) по сюжетам плана. Проверка: vitest зелёный.

## 3. Мир, терминал и браузер

- [ ] 3.1 Операции мира `Send`, `Wait`, `RunCommand`, свёртки `applyWorld`/`foldWorld`/`applyAllWorld`, журнал команд, `commandTranscript`. Проверка: `world.test.ts`.
- [ ] 3.2 `runCommand` с командами MVP (`ip a`, `ipconfig`, `ping`, `arp -a`, `npm run dev`) и подсказками для незнакомых и закрытых команд. Проверка: `terminal.test.ts`.
- [ ] 3.3 `browse` с нормализацией адреса, страницей и ошибками браузера. Проверка: `browser.test.ts`.

## 4. Механика В2 (уроки 8–11)

- [ ] 4.1 Маршрутизация: роутер за роутером, статические маршруты, `routeTable`, ICMP Time Exceeded через NAT, `Traceroute`, команда `traceroute`. Проверка: сценарии урока 8.
- [ ] 4.2 NAT: таблица, пробросы, CGNAT на транзите, сводка пула DHCP, `Connect`, цель `OnlyOpenPorts`. Проверка: сценарии урока 9.
- [ ] 4.3 DNS: записи с типом и TTL, CNAME, NS, рекурсивный резолвер, кэши на часах, `Query`, команды `nslookup` и `dig`, цель `HasRecord`. Проверка: `dns.test.ts`, сценарии урока 10.
- [ ] 4.4 TLS: сертификаты, ClientHello/ServerHello, проверки правилами, перенаправление 301, `Submit`, ACME `IssueCertificate`, команды `curl -v` и `certbot`, цель `ValidCert`. Проверка: `tls.test.ts`, сценарии урока 11.
- [ ] 4.5 Цели `WifiSecurity`, `ChannelClear`, `RanCommand`. Проверка: `goals.test.ts`.

## 5. Механика В3 (уроки 12–16)

- [ ] 5.1 Файрвол ОС, security group и роутера, правило на хопе, drop и reject, команды `ufw` и `ss -ltn`. Проверка: `firewall.test.ts`, сценарии урока 12.
- [ ] 5.2 VPN-клиент и сервер, full и split tunnel, DNS через VPN. Проверка: сценарии урока 13.
- [ ] 5.3 Docker: контейнеры, сети, публикация, compose и имена сервисов, `host.docker.internal`, зависимость слушателя, команды `docker run|ps|compose up`. Проверка: сценарии урока 14.
- [ ] 5.4 Ретранслятор туннеля, mesh, мобильная сеть, `settle` поднимает туннели и mesh. Проверка: сценарии уроков 14 и 16.
- [ ] 5.5 Сценарии уроков 15 (пять поломок терминалом) и 16 (выкатить проект). Проверка: `lessons-dev.test.ts`.

## 6. Проверка

- [ ] 6.1 Тексты всех новых кодов на четырёх языках. Проверка: тест текстов зелёный.
- [ ] 6.2 Соглашения проекта. Проверка:
  - `pnpm exec tsc --noEmit --pretty false` без ошибок;
  - `pnpm lint` без ошибок;
  - `pnpm exec oxfmt --check src/net` чисто;
  - `pnpm check` зелёный;
  - `openspec validate extend-packet-model` проходит.
