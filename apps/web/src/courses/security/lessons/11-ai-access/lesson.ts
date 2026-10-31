import {
  Goal,
  alt,
  blank,
  bubble,
  createToken,
  frame,
  gallery,
  giveReference,
  narration,
  revokeToken,
  saveToken,
  scenario,
  setUpAssistant,
  thumb,
} from '../../../../kinds/scenario/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import dictate from './art/dictate.webp'
import friday from './art/friday.webp'
import pass from './art/pass.webp'
import three from './art/three.webp'

// Урок 11 «Access token. Свой пропуск для ИИ» (план, раздел 3). Новые
// слова — «токен доступа» и «права доступа». Задача — чат с ИИ-ассистентом
// и настройки CRM: не вставлять пароль администратора, создать токен
// «только чтение, один раздел, 7 дней», сохранить его в менеджер паролей,
// дать ассистенту ссылку на запись, после работы отозвать. Пароль или
// токен текстом в чате — ошибки: сообщение удаляют, пароль меняют.

const REFERENCE = 'op://Work/crm-agent/token'

export default defineLesson(scenario, {
  slug: 'ai-access',
  labels: [
    'marina',
    'oleg',
    'assistant',
    'crm',
    'assistant:intro',
    'assistant:say-password',
    'assistant:say-token',
    'assistant:say-reference',
    'assistant:password',
    'assistant:token',
    'assistant:reference',
    'assistant:done',
    'section:sales',
    'section:clients',
    'section:invoices',
    'section:staff',
  ],
  steps: [
    {
      id: 'not-a-vault',
      ops: [frame('dictate', dictate, ['oleg', 'assistant', 'archive'])],
      stage: [
        alt('dictate.alt'),
        narration('dictate.narration', { x: 2.5, bottom: 3 }),
        bubble('dictate.oleg', 'oleg', { x: 3, y: 4, w: 40, tail: 'br' }),
      ],
    },
    {
      id: 'own-pass',
      ops: [frame('pass', pass, ['marina', 'assistant'])],
      stage: [
        alt('pass.alt'),
        narration('pass.narration', { x: 2.5, bottom: 3 }),
        bubble('pass.marina', 'marina', { x: 3, y: 4, w: 42, tail: 'br' }),
        bubble('pass.robot', 'assistant', { x: 56, y: 4, w: 40, tail: 'bl' }),
      ],
    },
    {
      id: 'leak',
      ops: [frame('three', three, ['oleg'])],
      stage: [
        alt('three.alt'),
        narration('three.narration', { x: 2.5, bottom: 3 }),
      ],
      quiz: {
        id: 'leak',
        kind: 'Choice',
        candidates: ['export', 'reference', 'env'],
        answer: 'env',
      },
    },
    {
      id: 'friday',
      ops: [frame('friday', friday, ['marina', 'assistant'])],
      stage: [
        alt('friday.alt'),
        narration('friday.narration', { x: 2.5, bottom: 3 }),
        bubble('friday.robot', 'assistant', { x: 52, y: 4, w: 44, tail: 'bl' }),
      ],
    },
    {
      id: 'crm-token',
      ops: [
        blank(),
        setUpAssistant({
          owner: 'marina',
          bot: 'assistant',
          crm: 'crm',
          url: 'crm.romashka.example/settings/access',
          sections: ['sales', 'clients', 'invoices', 'staff'],
          need: 'sales',
          days: 7,
          reference: REFERENCE,
        }),
      ],
      stage: [],
      task: {
        id: 'crm-token',
        palette: [],
        surfaces: ['assistant:marina', 'crm:marina'],
        goals: [
          { id: 'scoped', goal: Goal.ScopedAccess() },
          { id: 'revoked', goal: Goal.AccessRevoked() },
          { id: 'clean', goal: Goal.ChatClean() },
        ],
        solution: [
          createToken({ access: 'read', sections: ['sales'], days: 7 }),
          saveToken('t1'),
          giveReference('t1'),
          revokeToken('t1'),
        ],
      },
    },
    {
      id: 'summary',
      ops: [
        gallery([
          { id: 'dictate', art: dictate },
          { id: 'pass', art: pass },
          { id: 'three', art: three },
          { id: 'friday', art: friday },
        ]),
      ],
      stage: [
        thumb('summary.dictate', 'dictate'),
        thumb('summary.pass', 'pass'),
        thumb('summary.three', 'three'),
        thumb('summary.friday', 'friday'),
      ],
    },
  ],
})
