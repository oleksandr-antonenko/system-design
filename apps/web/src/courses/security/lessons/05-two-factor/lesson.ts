import {
  Goal,
  alt,
  blank,
  bubble,
  confirmCode,
  declineSignIn,
  frame,
  gallery,
  narration,
  reportSignIn,
  saveBackupCodes,
  scanQr,
  scenario,
  setUpAuth,
  thumb,
} from '../../../../kinds/scenario/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import call from './art/call.webp'
import locks from './art/locks.webp'
import night from './art/night.webp'
import stolen from './art/stolen.webp'

// Урок 5 «2FA. Второй замок» (план, раздел 3). Новые слова —
// «двухфакторная защита» и «одноразовый код». Задача — страница
// безопасности CRM и телефон Марины: включить 2FA по QR-коду, сохранить
// резервные коды, отклонить чужой запрос входа и сообщить IT. «Да» на
// чужой запрос — ошибка, вход тут же завершают. Промпты кадров —
// в frames.md.

export default defineLesson(scenario, {
  slug: 'two-factor',
  labels: ['marina', 'striped', 'site-crm', 'request'],
  steps: [
    {
      id: 'second-lock',
      ops: [frame('locks', locks, ['marina', 'door'])],
      stage: [
        alt('locks.alt'),
        narration('locks.narration', { x: 2.5, bottom: 3 }),
        bubble('locks.marina', 'marina', { x: 3, y: 4, w: 42, tail: 'br' }),
      ],
    },
    {
      id: 'stolen',
      ops: [frame('stolen', stolen, ['striped', 'door'])],
      stage: [
        alt('stolen.alt'),
        narration('stolen.narration', { x: 2.5, bottom: 3 }),
        bubble('stolen.striped', 'striped', {
          x: 52,
          y: 4,
          w: 44,
          tail: 'bl',
          tone: 'bad',
        }),
      ],
    },
    {
      id: 'code-call',
      ops: [frame('call', call, ['marina', 'striped'])],
      stage: [
        alt('call.alt'),
        narration('call.narration', { x: 2.5, bottom: 3 }),
        bubble('call.striped', 'striped', {
          x: 50,
          y: 4,
          w: 46,
          tail: 'bl',
          tone: 'bad',
        }),
        bubble('call.marina', 'marina', {
          x: 3,
          y: 4,
          w: 32,
          tail: 'br',
          tone: 'think',
        }),
      ],
      quiz: {
        id: 'code-call',
        kind: 'Choice',
        candidates: ['dictate', 'call-back', 'half'],
        answer: 'call-back',
      },
    },
    {
      id: 'night',
      ops: [frame('night', night, ['marina', 'phone'])],
      stage: [
        alt('night.alt'),
        narration('night.narration', { x: 2.5, bottom: 3 }),
        bubble('night.marina', 'marina', {
          x: 3,
          y: 4,
          w: 40,
          tail: 'br',
          tone: 'think',
        }),
      ],
    },
    {
      id: 'enable',
      ops: [
        blank(),
        setUpAuth({
          owner: 'marina',
          site: 'site-crm',
          url: 'crm.romashka.example/settings/security',
          account: 'marina@romashka.example',
          code: '381640',
          request: 'request',
        }),
      ],
      stage: [],
      task: {
        id: 'enable',
        palette: [],
        surfaces: ['auth:marina'],
        goals: [
          { id: 'on', goal: Goal.TwoFactorOn() },
          { id: 'codes', goal: Goal.CodesSaved() },
          { id: 'stranger', goal: Goal.StrangerStopped() },
        ],
        solution: [
          scanQr(),
          confirmCode('381640'),
          saveBackupCodes(),
          declineSignIn(),
          reportSignIn(),
        ],
      },
    },
    {
      id: 'summary',
      ops: [
        gallery([
          { id: 'locks', art: locks },
          { id: 'stolen', art: stolen },
          { id: 'call', art: call },
          { id: 'night', art: night },
        ]),
      ],
      stage: [
        thumb('summary.locks', 'locks'),
        thumb('summary.stolen', 'stolen'),
        thumb('summary.call', 'call'),
        thumb('summary.night', 'night'),
      ],
    },
  ],
})
