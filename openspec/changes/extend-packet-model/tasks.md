## 1. Тексты сообщений

- [x] 1.1 Модуль `net/text/`: тип `NetTexts` по тегам `NetMessage`, словари uk, ru, en, lt, `renderNetMessage` с подписями устройств. Проверка: `pnpm exec tsc --noEmit --pretty false` без ошибок; тест «каждый код на каждом языке» (`text/text.test.ts`) зелёный.

## 2. Модуль 1 по новому плану (уроки 1–7)

- [x] 2.1 Старые сценарии перенесены под новую нумерацию (`mechanics.test.ts`), механика сохранена. Проверка: `pnpm exec vitest run --silent=true --reporter=dot src/net` зелёный.
- [x] 2.2 Пробелы механики модуля 1: принтер и лампочка, сети рядом и `checkJoin`, стены, транзитные роутеры провайдера, `Ping` по имени, DNS «вручную» поверх адреса, `Send` и `Raw`, цели `Performed` и `HasDnsServer`, помощники квизов. Проверка: сценарии уроков 1–7.
- [x] 2.3 Сценарии уроков 1–7 (`lessons-local.test.ts`) по сценариям `docs/plans/networks-lessons/01–07`. Проверка: vitest зелёный.

## 3. Мир, терминал и браузер

- [x] 3.1 Операции мира `Send`, `Wait`, `FastForward`, `FlushDns`, `RunCommand`, `IssueCertificate`, свёртки `applyWorld`/`foldWorld`/`applyAllWorld`, журнал команд, `commandTranscript`, переподключение после закрепления адреса. Проверка: `world.test.ts`.
- [x] 3.2 `runCommand`: `ip a`, `ipconfig`, `ping`, `arp -a`, `npm run dev` и Ctrl+C, подсказки для незнакомых и закрытых команд, детали вывода по урокам. Проверка: `terminal.test.ts`.
- [x] 3.3 `browse` с нормализацией адреса, страницей и ошибками браузера. Проверка: `browser.test.ts`.

## 4. Механика В2 (уроки 8–11)

- [x] 4.1 Маршрутизация: таблицы транзитов и строка маршрута на хопе, роутер за роутером, статические маршруты, `routeTable`, ICMP Time Exceeded через NAT, `Traceroute`, команды `traceroute` (три замера, `^C`, `!H`) и `ip route`, сообщения о шлюзе. Проверка: сценарии урока 8 (`lessons-internet.test.ts`).
- [x] 4.2 NAT: таблица, пробросы (`forward`/`unforward`), CGNAT на транзите, сводка пула DHCP, `Connect`, цель `OnlyOpenPorts`. Проверка: сценарии урока 9.
- [x] 4.3 DNS: зоны с типом и TTL, CNAME, `*`, справочная с памятью на часах, `Query`, команды `nslookup` и `dig`, `setRecord`/`addRecord`/`removeRecord` с отказами, цели `HasRecord`, `Resolves` с `at`, `RanCommand` с увиденным адресом. Проверка: сценарии урока 10.
- [x] 4.4 TLS: сертификаты, ClientHello/ServerHello, проверки правилами, перенаправление 301, `Submit`, `Fetch`, ACME `IssueCertificate`, команды `curl -v` и `certbot`, цели `ValidCert` и `RedirectsToHttps`, «что видит посторонний». Проверка: сценарии урока 11, `browser.test.ts`.
- [x] 4.5 Цели `WifiSecurity`, `ChannelClear`, `RanCommand`. Проверка: сценарии уроков 5 и 10.

## 5. Механика В3 (уроки 12–16)

- [x] 5.1 Файрвол ОС, security group и роутера, правило на хопе, drop и reject, команды `ufw`, `ss -ltn`, `nc -zv`, выход «заперся сам». Проверка: сценарии урока 12 (`lessons-dev.test.ts`).
- [x] 5.2 Шлюз VPN и клиент, full и split tunnel, DNS через VPN, цель `Via`. Проверка: сценарии урока 13.
- [x] 5.3 Docker: контейнеры, мост, публикация мимо `ufw`, compose и имена сервисов, `host.docker.internal`, здоровье приложения, команды `docker run|ps|compose up|compose logs`. Проверка: сценарии урока 14.
- [x] 5.4 Ретранслятор туннеля (`tunnel http`), mesh с адресами `100.100.0.x` и именами, `settle` поднимает туннели и mesh. Проверка: сценарии уроков 14 и 16.
- [x] 5.5 Сценарии уроков 15 (пять поломок и метки строк вывода) и 16 (выкатить проект с прокси, сертификатом и mesh). Проверка: `lessons-dev.test.ts`.

## 6. Проверка

- [x] 6.1 Тексты всех новых кодов на четырёх языках. Проверка: тест текстов зелёный.
- [x] 6.2 Соглашения проекта. Проверка:
  - `pnpm exec tsc --noEmit --pretty false` без ошибок;
  - `pnpm lint` без ошибок;
  - `pnpm exec oxfmt --check src/net` чисто;
  - `pnpm check` зелёный;
  - `openspec validate extend-packet-model` проходит.
