## Context

Мотивация — в proposal.md. Основа — рецепт better-auth, проверенный в других проектах владельца (Next.js + better-auth 1.7 + Drizzle + SQLite); в репозитории он описан этим документом. У нас не Next.js, поэтому интеграция идёт в варианте для любого HTTP-сервера:

- `auth.handler(request)` на `/api/auth/*`;
- `signInEmail({ asResponse: true })` с пересылкой `Set-Cookie`;
- `getSession` по заголовкам запроса.

Сервер написан на Effect 4.1 (`apps/server` из `bootstrap-foldkit-app`), клиент — на Foldkit. Работает один origin: в проде через nginx, в разработке через прокси Vite.

## Goals / Non-Goals

**Goals:**

- Перенести проверенную конфигурацию better-auth без ослабления защит (`requireLocalEmailVerified`, лимиты, `trustedOrigins`).
- Регистрация открыта, поэтому подтверждение почты обязательно.
- Все тексты, включая письма, на четырёх языках.

**Non-Goals:**

- Синхронизация прогресса — изменение `add-learning-progress`. Здесь только аккаунт, к которому прогресс потом привяжется.
- Роли и администрирование (плагин `admin`). Ролей у учеников нет. Плагин понадобится, если появятся авторы контента в интерфейсе.
- Magic link, passkeys и другие провайдеры, кроме Google.

## Decisions

### D1. Конфигурация better-auth — проверенный рецепт, режим «открытая регистрация»

- `emailAndPassword`: `enabled: true`, `disableSignUp: !mailConfigured`, `requireEmailVerification: true`, `minPasswordLength: 10`, `revokeSessionsOnPasswordReset: true`, `resetPasswordTokenExpiresIn: 3600`.
- `emailVerification`: `sendOnSignUp: true`, `autoSignInAfterVerification: true`, `expiresIn: 86400`. Письмо отправляется на языке пользователя.
- `socialProviders.google` задаётся только при обоих ключах: `prompt: 'select_account'`, `disableSignUp: false`.
- `account.accountLinking`: `enabled: true`, `trustedProviders: ['google', 'email-password']`, `allowDifferentEmails: false`. Защита `requireLocalEmailVerified` не выключается.
- `rateLimit`: общий лимит 100 в минуту. Правила: `/sign-in/email` — 10 в минуту, `/sign-up/email` — 5 в минуту, `/request-password-reset` — 5 в минуту. IP берётся из `x-forwarded-for`, nginx его ставит (изменение `setup-deploy-pipeline`).
- `user.additionalFields.locale`: строка из четырёх языков, `input: true`, проверяется Schema `Locale` в хуке `databaseHooks.user.create.before` и `update.before`.
- `onPasswordReset` ставит `emailVerified: true`: ссылка пришла на почту, значит ящик принадлежит пользователю. Это нужно для автопривязки Google.
- `secret` берётся из `BETTER_AUTH_SECRET` без значения по умолчанию. `baseURL` и `trustedOrigins` берутся из `BETTER_AUTH_URL`, в разработке добавляется `http://localhost:5173`.

Регистрация на занятый адрес не должна раскрывать существование аккаунта (спецификация, сценарий «Почта уже занята»). Хук `hooks.before` на `/sign-up/email` при существующем адресе возвращает тот же ответ, что при успехе, и отправляет владельцу адреса письмо «у вас уже есть аккаунт, вот ссылка на вход и сброс пароля». Точный механизм хуков в 1.7 сверяется по установленным типам.

### D2. Мост Effect HTTP ↔ better-auth

Маршрут `ALL /api/auth/*` в роутере Effect:

1. преобразовать `HttpServerRequest` в web `Request`;
2. вызвать `auth.handler(request)` через `Effect.tryPromise`;
3. вернуть web `Response` через конструктор ответа из web `Response`.

Функции конверсии в Effect 4 (`HttpServerRequest.toWeb`, `HttpServerResponse.fromWeb` или их аналоги) сверяются по установленным типам. Если их нет, пишется небольшой адаптер на `node:http` поверх `IncomingMessage`.

Экземпляр better-auth создаётся в слое `AuthLive`, который зависит от `Database`, `Mailer` и `Config`. Ошибки конфигурации, например нет секрета в проде, всплывают при старте, а не при первом запросе.

- *Альтернатива:* перевести сервер на Hono, у которого готовая связка с better-auth. Это запасной вариант, если мост окажется хрупким. Web это не затронет.

### D3. Хранилище — SQLite + Drizzle

`data/app.db`: better-sqlite3, режим WAL, первой командой `busy_timeout`. Таблицы better-auth `user`, `session`, `account` и `verification` генерируются `@better-auth/cli generate` в схему Drizzle. Миграции генерирует `drizzle-kit`, а применяет их сервер при старте.

Известная грабля: миграции, которые пересоздают таблицу, при `foreign_keys = ON` каскадно стирают `session` и `account`. Поэтому `PRAGMA foreign_keys=OFF` выставляется снаружи `migrate()`, после миграции выполняется `PRAGMA foreign_key_check`, а `release.sh` делает резервную копию перед переключением версии.

Слой `DatabaseLive` — scoped-ресурс Effect, соединение закрывается при остановке.

- *Альтернатива:* встроенный Kysely-адаптер better-auth с `@better-auth/cli migrate`. Отклонена: Drizzle уже проверен в рецепте и понадобится для таблиц прогресса.
- *Альтернатива:* Postgres, который на сервере есть. Отклонена: одна SQLite-база на приложение проще в резервном копировании и переносе, а нагрузка курса для неё мала.

### D4. Почта

Сервис `Mailer` на nodemailer: транспорт создаётся лениво при первом письме из `SMTP_URL`, отправитель берётся из `MAIL_FROM`. Без `SMTP_URL` письмо пишется в журнал. В проде без SMTP регистрация по почте отключена (`disableSignUp`), а страница регистрации показывает только Google.

Шаблоны писем (подтверждение, сброс пароля, «аккаунт уже есть») — функции в `apps/server/src/mail/templates.{uk,ru,en,lt}.ts` с проверкой полноты тем же способом, что и словари интерфейса. Язык письма берётся из `user.locale`, а если пользователя ещё нет — из `locale` в теле запроса.

### D5. Клиент — Commands поверх `better-auth/client`

В web используется vanilla-клиент `createAuthClient` без React. Каждый вызов обёрнут в Command Foldkit:

- `FetchSession`, `SignInEmail`, `SignUpEmail`, `SignInGoogle`, `SignOut`;
- `RequestPasswordReset`, `ResetPassword`, `ResendVerification`;
- `UpdateAccountLocale`, `DeleteAccount`.

Каждый Command возвращает `Succeeded*` или `Failed*` с кодом ошибки better-auth. Ни один не бросает исключение.

Состояние в корневом Model: `session: Session`, где `Session = defineTaggedUnion({ Loading, Guest, SignedIn: { user } })`. Формы страниц входа — отдельные Submodel со своими полями и `FieldValidation`.

Коды ошибок better-auth (`INVALID_EMAIL_OR_PASSWORD`, `EMAIL_NOT_VERIFIED`, `PASSWORD_TOO_SHORT`, `INVALID_TOKEN`, `TOO_MANY_REQUESTS` и другие) сопоставляются с доменными сообщениями из `bootstrap-foldkit-app` (D6) и показываются на языке страницы. Неизвестный код показывается общим сообщением, а сам код пишется в консоль разработчика.

### D6. Автовход после нового пароля

Как в рецепте, но без Next. Служебный маршрут `POST /api/account/reset-password { token, newPassword }`:

1. по токену найти пользователя в `verification` (`identifier = 'reset-password:<token>'`), до сброса;
2. `auth.api.resetPassword`;
3. `auth.api.signInEmail({ asResponse: true })`;
4. переслать `Set-Cookie` в ответ.

Если вход не удался, клиент ведёт на `/sign-in` с сообщением «пароль сохранён, войдите».

### D7. Язык аккаунта и перенаправления

- Регистрация передаёт `locale` из маршрута.
- Смена языка вошедшим пользователем отправляет `UpdateAccountLocale` (best-effort, ошибка не мешает переключению).
- После входа и подтверждения почты `callbackURL` = `/{locale}/` на языке аккаунта.
- Правило выбора языка из `bootstrap-foldkit-app` для адресов без префикса дополняется: язык вошедшего пользователя идёт перед сохранённым на устройстве.

### D8. Удаление аккаунта

Используется `user.deleteUser` better-auth с `beforeDelete`, который удаляет связанные данные приложения. Сейчас их нет, хук — точка расширения для прогресса. Подтверждение — ввод слова, показанного на языке страницы, плюс свежая сессия (`freshAge`). Это защищает от удаления с чужого незакрытого устройства.

## Risks / Trade-offs

- [Письма уходят в спам, если у домена отправителя нет DKIM] → Отправитель на домене с SPF и DKIM. Пока его нет, регистрация по почте может быть выключена, а Google работает независимо. Решение за владельцем, см. Open Questions.
- [Мост Effect ↔ better-auth (D2)] → Интеграционные тесты сервера на полный цикл: регистрация → письмо в тестовый Mailer → подтверждение → сессия → выход. Запасной вариант — Hono.
- [Каскадное удаление при миграциях SQLite] → PRAGMA снаружи, проверка ключей, резервная копия перед выкаткой.
- [Лимит попыток при неверном IP за nginx] → Заголовок ставит nginx (`setup-deploy-pipeline`), тест проверяет, что 11-я попытка с одного IP отклоняется, а с другого — проходит.
- [Переводы писем и ошибок пишет не носитель языка] → Вычитка вместе с переводами уроков перед публичным запуском.

## Migration Plan

На сервере в `.env` добавляются `BETTER_AUTH_SECRET` (`openssl rand -base64 48`), `BETTER_AUTH_URL`, `DATABASE_PATH=…/data/app.db`, `SMTP_URL`, `MAIL_FROM`, `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`. При первом старте сервер создаёт базу и применяет миграции. Откат — выкатка предыдущей версии. База остаётся и не мешает, потому что предыдущая версия её не читает.

## Open Questions

- Почтовый ящик-отправитель: адрес на домене с SPF и DKIM (например, на `oleksandr-antonenko.com`). На спецификацию это не влияет: без SMTP регистрация по почте скрыта, вход через Google работает.
- Google OAuth-клиент: владелец создаёт его в Google Cloud Console. Redirect URI: `https://system-design.oleksandr-antonenko.com/api/auth/callback/google` и `http://localhost:5173/api/auth/callback/google`. Пока ключей нет, кнопки Google нет.
