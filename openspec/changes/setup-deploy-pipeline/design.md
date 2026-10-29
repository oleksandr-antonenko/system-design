## Context

Мотивация — в proposal.md. Сервер — домашняя машина владельца, на которой работает около двадцати других проектов, есть nginx, certbot, sqlite3, Node 26 и pnpm. DNS домена уже указывает на сервер. Адрес, порт ssh и учётные данные администрирования в репозитории не хранятся: они нужны только владельцу и агенту для разовой настройки.

На этой машине у других проектов владельца работает своя схема:

- свой раннер Actions на каждый приватный репозиторий;
- `release.sh` со сборкой рядом и переключением ссылки;
- systemd --user, nginx и certbot.

Для публичного репозитория от неё сохраняется всё, кроме раннера.

## Goals / Non-Goals

**Goals:**

- Ноль путей от чужого кода к серверу: код из PR выполняется только на машинах GitHub, на сервер попадает только то, что владелец влил в `main`.
- Ни одного секрета доступа к серверу в GitHub.
- Выкатка и откат без участия человека, результат виден в Actions.

**Non-Goals:**

- Контейнеры. systemd и пользователь без прав дают нужную изоляцию проще.
- Staging-окружение. Его заменяют проверки PR и откат.
- Preview-развёртывания для PR. Позже их можно добавить на GitHub Pages или в отдельный сервис, без доступа к домашнему серверу.

## Decisions

### D1. CI на GitHub-hosted раннерах

Публичным репозиториям минуты GitHub бесплатны. У workflow из форка нет секретов, а `GITHUB_TOKEN` у него только на чтение. Даже если PR перепишет workflow, ему негде выполнить код, кроме одноразовой машины GitHub.

- *Почему не свой раннер:* GitHub прямо не рекомендует self-hosted раннеры для публичных репозиториев. PR из форка может изменить `runs-on` и выполнить код на сервере. Одобрение запуска защищает только до первой невнимательности.

Настройки репозитория через `gh api`:

- `actions/permissions/fork-pr-contributor-approval` = `all_external_contributors`;
- `actions/permissions/workflow` с `default_workflow_permissions: read`;
- защита ветки `production` от удаления.

### D2. Продвижение через ветку `production`

`.github/workflows/ci.yml`:

- `check` (PR, push в `main`, `workflow_dispatch`): `actions/setup-node` с версией из `.nvmrc`, `pnpm/action-setup`, проверка lock-файла с понятной ошибкой, `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`.
- `promote` (только push в `main`, `needs: check`):
  - `permissions: contents: write` только у этого job, `concurrency: production`;
  - `git push --force origin HEAD:production`.

  Ветка — указатель, которым владеет CI. Ручной откат владельца живёт до следующего push в `main`.
- `verify` (`needs: promote`): опрашивает `https://system-design.oleksandr-antonenko.com/api/health` каждые 10 с, пока `version` не станет коротким хешем коммита. Через 10 минут — ошибка с подсказкой посмотреть журнал выкатки на сервере. `environment: production` с URL сайта.

PR из форка не может сдвинуть `production`: у него нет прав на запись.

### D3. Pull-выкатка на сервере

Под пользователем приложения работают:

- `system-design-deploy.timer` — каждые 30 с запускает `system-design-deploy.service` (oneshot);
- он выполняет `deploy/poll.sh` (копия из последней успешной версии лежит в `~/bin`).

`poll.sh`:

1. `git ls-remote https://github.com/oleksandr-antonenko/system-design refs/heads/production`. Это не REST API: без токена и без лимита 60 запросов в час.
2. Если хеш совпадает с текущей версией или записан в `state/failed`, выйти.
3. Иначе взять `flock` на `state/deploy.lock` и вызвать `release.sh <sha>`.

`release.sh <sha>`:

1. Проверить `.env`.
2. Если версия этого коммита уже есть в `releases/`, перейти сразу к шагу 6. Это делает ручной откат быстрым.
3. `git fetch --depth 1 origin <sha>` в кеш-репозиторий `src.git`, затем `git archive <sha>` в `releases/<дата>-<sha>/` и записать `.release.env` с `APP_VERSION=<sha>`.
4. `pnpm install --frozen-lockfile` и `pnpm build`. Нативные модули (`better-sqlite3`) собираются под Node сервера.
5. Сделать резервную копию каждой `data/*.db`: `sqlite3 <db> ".backup backups/<имя>-<дата>-<sha>.db"`.
6. Атомарно переключить `current` (`ln -sfn` + `mv -T`), `systemctl --user restart system-design-web`.
7. До 30 раз с паузой 2 с опрашивать `http://127.0.0.1:3620/api/health` и сравнивать версию.
8. Если версия не ответила: вернуть прежнюю ссылку и перезапустить, записать `<sha>` в `state/failed`, вывести хвост журнала, выйти с ошибкой.
9. Если ответила: обновить `~/bin/poll.sh` из новой версии, удалить версии старше 5 последних и копии старше 10 последних.

Журнал выкатки идёт в `logs/deploy.log` и в journald.

- *Альтернатива:* выкатка по ssh из GitHub Actions с ключом в секретах environment и forced command. Отклонена: в GitHub появляется ключ доступа к серверу, а ssh-порт должен быть открыт для адресов GitHub. Pull-схема не требует ни того, ни другого. Задержка до 30 с не важна.
- *Альтернатива:* опрос статуса проверок через REST API. Отклонена: лимит без токена 60 запросов в час, а токен — лишний секрет на сервере. Ветка `production` сама по себе означает «проверено».

### D4. Пользователь приложения и каталоги

Отдельный пользователь приложения (имя выбирает администратор, в репозитории не фигурирует) без sudo, с включённым linger, чтобы службы `systemd --user` жили без входа в систему. Его домашний каталог:

```
apps/system-design/
  releases/<YYYYmmdd-HHMMSS>-<sha>/   версии
  current -> releases/...
  src.git/                            кеш репозитория для fetch по хешу
  .env                                права 600
  data/  backups/  logs/  state/{failed,deploy.lock}
bin/poll.sh
.config/systemd/user/system-design-{web.service,deploy.service,deploy.timer}
```

Создание пользователя, linger, nginx и certbot — разовая настройка администратором сервера, вне репозитория. Учётные данные администратора выкатка не использует.

### D5. Служба приложения

`system-design-web.service`:

- `WorkingDirectory=%h/apps/system-design/current`;
- `EnvironmentFile=%h/apps/system-design/.env` и `EnvironmentFile=-%h/apps/system-design/current/.release.env`;
- `Environment=NODE_ENV=production PORT=3620 HOST=127.0.0.1`;
- `ExecStart=/usr/bin/node apps/server/dist/main.js`, `Restart=on-failure`, `TimeoutStopSec=15`.

Порт 3620 и путь к Node — значения по умолчанию в unit-файле. Если они на сервере другие, их переопределяет drop-in вне репозитория.

### D6. nginx и TLS

`deploy/nginx.conf`:

- `server_name system-design.oleksandr-antonenko.com`, `proxy_pass http://127.0.0.1:3620`;
- `X-Forwarded-For $remote_addr`: better-auth считает лимит попыток по нему;
- `X-Forwarded-Proto`, `client_max_body_size 1m`.

Сертификат и редирект добавляет `certbot --nginx --redirect`, продление — таймер certbot.

## Risks / Trade-offs

- [Владелец влил вредный PR в `main`] → Он выполнится на сервере, но под пользователем без прав и без доступа к другим проектам. Ревью PR остаётся главной защитой. В `CONTRIBUTING.md` перечислено, на что смотреть в PR: зависимости, скрипты `postinstall`, файлы `deploy/`.
- [Скрипты установки зависимостей выполняются на сервере при `pnpm install`] → Сборка идёт под пользователем без прав. Изменения в `package.json` и `pnpm-lock.yaml` видны в ревью. Можно включить `pnpm` `onlyBuiltDependencies`, чтобы разрешить установочные скрипты только известным пакетам (`better-sqlite3`, `esbuild`).
- [GitHub недоступен] → Сайт продолжает работать на текущей версии. Выкатка подождёт.
- [Сломанный `poll.sh` в новой версии] → `~/bin/poll.sh` обновляется только после успешной выкатки, так что сломанная версия не заменит работающий опросчик.
- [Версия, которая падает при старте, даёт до минуты ответов 502: `release.sh` сначала переключает `current` и перезапускает службу, а здоровье проверяет потом. На проверке 2026-10-29 простой составил около 55 с, после чего откат сработал] → Улучшение: перед переключением запускать новую сборку на запасном порту и проверять её версию там. Тогда сломанная версия не затронет сайт, а простой при успешной выкатке сократится до перезапуска процесса.
- [Сборка на сервере нагружает CPU] → Сборка Vite и сервера занимает секунды или десятки секунд. Это приемлемо.

## Migration Plan

Разовая настройка администратором:

1. Пользователь, linger, каталоги и `.env`.
2. Unit-файлы и `poll.sh` из репозитория, `systemctl --user enable --now system-design-deploy.timer`.
3. nginx-хост и `certbot`.
4. Настройки репозитория (D1).

Затем push в `main` выкатывает первую версию.

Откат всей схемы:

1. `systemctl --user disable --now system-design-deploy.timer system-design-web`.
2. Удалить nginx-хост.
3. Удалить пользователя.

Другие проекты не затрагиваются.
