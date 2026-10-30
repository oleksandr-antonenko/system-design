## 1. Имена и подсказки устройств

- [x] 1.1 `deviceKindName` рядом с `DeviceKind` в `net/model.ts`; доска (`picture.ts`, `targets.ts`, облако в `view.ts`) берёт имя оттуда, `packetBoard.kindName` удалён. Проверка: `tsc --noEmit --pretty false`.
- [x] 1.2 `packetBoard.kindHint` на uk, ru, en, lt; `NodeText.hint`, подсказка `<title>` и `aria-description` у устройства и облака. Проверка: `kinds/packet/names.scene.test.ts` (ru: «Router» с русской подсказкой).

## 2. Словари доски, экранов и панелей

- [x] 2.1 `i18n/ui/packetBoard/*`: таблицы, поля карточки, наклейка (SSID), слои конверта, «hop N из M», диапазоны 2.4 / 5 GHz, Internet, tunnel, Firewall rules. Проверка: `kinds/packet/quiz.scene.test.ts`, `phone-online.scene.test.ts`.
- [x] 2.2 `i18n/ui/device/*`: IP address, Subnet mask, Router, Router (gateway), DNS servers, dev server, Server в строках терминала; браузер и экраны ошибок родные. Проверка: `courses/networks/lessons/06-ports-and-localhost/scene.test.ts`.
- [x] 2.3 `i18n/ui/panel/*`: Router, SSID, Band, Ports, Routes, Certificate, Firewall, поля правил и записей DNS. Проверка: `kinds/packet/surfaces/panel/*.scene.test.ts`.
- [x] 2.4 `net/text/*`: сообщения модели и целей с английскими терминами без родных окончаний. Проверка: `net/text/text.test.ts`.

## 3. Тексты уроков

- [x] 3.1 Урок 1 на uk, ru, lt: правило одной фразой, Router и packet при первом упоминании, подписи-виды по-английски; en — подпись Router и SSID. Проверка: тест контента `courses/content.test.ts`.
- [x] 3.2 Урок 5 на uk, ru, lt: диапазон (band), 2.4 GHz и 5 GHz, Smart bulb, access point; en — подписи. Проверка: тест контента, `05-wifi-range/lesson.test.ts`.
- [x] 3.3 Урок 6 на uk, ru, lt: port при образе «квартира», localhost, dev server, firewall; en — подписи DNS server и Router. Проверка: тест контента, `06-ports-and-localhost/scene.test.ts`.

## 4. Документация и проверка

- [x] 4.1 `CONTRIBUTING.md`: правила английских терминов для уроков сетей. Проверка: чтение раздела.
- [x] 4.2 `pnpm check` зелёный; `openspec validate english-network-terms` проходит.
