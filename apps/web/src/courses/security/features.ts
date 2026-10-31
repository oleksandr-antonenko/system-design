import { Schema } from 'effect'

/**
 * Элементы интерфейса курса безопасности, которые открывают уроки
 * (`meta.unlocks`). Имя — `<экран>.<элемент>`; экраны: `phone` (телефон:
 * Wi-Fi, VPN, почта), `passwords` (проверка паролей), `mail` (почтовый ящик),
 * `vault` (менеджер паролей),
 * `keepass` (сейф-файл KeePass), `auth` (страница безопасности и
 * аутентификатор), `chat` (мессенджер и
 * справочник), `desk` (стол), `downloads` (папка «Загрузки»), `extensions`
 * (расширения браузера), `assistant` (чат с ИИ), `crm` (токены CRM), `quiz` (виды
 * вопросов).
 * Экран виден, если открыт хотя бы один его элемент. Порядок — порядок
 * уроков, которые их открывают.
 */
export const SecurityFeature = Schema.Literals([
  'phone.wifi',
  'phone.vpn',
  'phone.mail',
  'quiz.choice',
  'passwords.check',
  'vault.entries',
  'keepass.base',
  'auth.authenticator',
  'mail.inbox',
  'mail.linkPreview',
  'quiz.pickHotspot',
  'chat.messenger',
  'chat.directory',
  'desk.items',
  'downloads.files',
  'extensions.permissions',
  'assistant.chat',
  'crm.tokens',
  'mail.report',
  'mail.sessions',
])
export type SecurityFeature = typeof SecurityFeature.Type
