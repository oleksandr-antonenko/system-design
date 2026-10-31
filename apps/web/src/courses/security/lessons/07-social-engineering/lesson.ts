import {
  Goal,
  alt,
  blank,
  bubble,
  callContact,
  contact,
  forwardThread,
  frame,
  gallery,
  narration,
  reply,
  scenario,
  sendReply,
  setUpChat,
  thread,
  thumb,
} from '../../../../kinds/scenario/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import check from './art/check.webp'
import door from './art/door.webp'
import fakeIra from './art/fake-ira.webp'
import newAccount from './art/new-account.webp'
import requests from './art/requests.webp'

// Урок 7 «Social engineering. Звонок «из IT»» (план, раздел 3). Новые
// слова — «социальная инженерия» и «проверка по второму каналу». Задача —
// мессенджер Марины: «Виктор» с нового номера просит срочно оплатить счёт;
// ответить без оплаты, проверить звонком по номеру из справочника и
// переслать чат в IT. Согласие без проверки и звонок на номер из сообщения
// — ошибки с объяснением. Промпты кадров — в frames.md.

export default defineLesson(scenario, {
  slug: 'social-engineering',
  labels: [
    'marina',
    'striped',
    'victor',
    'victor-mask',
    'chat:new-victor',
    'chat:new-victor:body',
    'chat:new-victor:call',
    'chat:new-victor:forwarded',
    'reply:new-victor:pay',
    'reply:new-victor:pause',
    'chat:ira',
    'chat:ira:body',
    'chat:oleg',
    'chat:oleg:body',
    'contact:victor',
    'contact:ira',
    'call:victor',
    'call:ira',
  ],
  steps: [
    {
      id: 'fake-ira',
      ops: [frame('fake-ira', fakeIra, ['marina', 'striped'])],
      stage: [
        alt('fakeIra.alt'),
        narration('fakeIra.narration', { x: 2.5, bottom: 3 }),
        bubble('fakeIra.striped', 'striped', {
          x: 50,
          y: 4,
          w: 46,
          tail: 'bl',
          tone: 'bad',
        }),
        bubble('fakeIra.marina', 'marina', {
          x: 3,
          y: 4,
          w: 34,
          tail: 'br',
          tone: 'think',
        }),
      ],
    },
    {
      id: 'door',
      ops: [frame('door', door, ['striped', 'marina', 'boxes'])],
      stage: [
        alt('door.alt'),
        narration('door.narration', { x: 2.5, bottom: 3 }),
        bubble('door.striped', 'striped', {
          x: 52,
          y: 4,
          w: 44,
          tail: 'bl',
        }),
      ],
    },
    {
      id: 'which',
      ops: [frame('requests', requests, ['marina'])],
      stage: [
        alt('requests.alt'),
        narration('requests.narration', { x: 2.5, bottom: 3 }),
      ],
      quiz: {
        id: 'which',
        kind: 'Choice',
        candidates: ['bank-call', 'ira-chat', 'victor-meeting'],
        answer: 'bank-call',
      },
    },
    {
      id: 'new-account',
      ops: [frame('new-account', newAccount, ['marina', 'victor-mask'])],
      stage: [
        alt('newAccount.alt'),
        narration('newAccount.narration', { x: 2.5, bottom: 3 }),
        bubble('newAccount.victor', 'victor-mask', {
          x: 48,
          y: 4,
          w: 48,
          tail: 'bl',
          tone: 'bad',
        }),
      ],
    },
    {
      id: 'second-channel',
      ops: [frame('check', check, ['marina', 'victor'])],
      stage: [
        alt('check.alt'),
        narration('check.narration', { x: 2.5, bottom: 3 }),
        bubble('check.marina', 'marina', { x: 3, y: 4, w: 34, tail: 'br' }),
        bubble('check.victor', 'victor', { x: 52, y: 4, w: 44, tail: 'bl' }),
      ],
    },
    {
      id: 'messenger',
      ops: [
        blank(),
        setUpChat({
          owner: 'marina',
          it: 'ira',
          threads: [
            thread({
              id: 'new-victor',
              number: '+370 600 41 977',
              isKnown: false,
              replies: [reply('pay', 'comply'), reply('pause', 'safe')],
            }),
            thread({ id: 'ira', number: '+370 5 200 1120' }),
            thread({ id: 'oleg', number: '+370 5 200 1133' }),
          ],
          contacts: [
            contact('victor', '+370 5 200 1101'),
            contact('ira', '+370 5 200 1120'),
          ],
        }),
      ],
      stage: [],
      task: {
        id: 'messenger',
        palette: [],
        surfaces: ['chat:marina'],
        goals: [
          {
            id: 'pause',
            goal: Goal.Replied({ thread: 'new-victor', reply: 'pause' }),
          },
          { id: 'verified', goal: Goal.Called({ contact: 'victor' }) },
          {
            id: 'forwarded',
            goal: Goal.Forwarded({ thread: 'new-victor' }),
          },
        ],
        solution: [
          sendReply('new-victor', 'pause'),
          callContact('victor'),
          forwardThread('new-victor'),
        ],
      },
    },
    {
      id: 'summary',
      ops: [
        gallery([
          { id: 'fake-ira', art: fakeIra },
          { id: 'door', art: door },
          { id: 'new-account', art: newAccount },
          { id: 'check', art: check },
        ]),
      ],
      stage: [
        thumb('summary.fakeIra', 'fake-ira'),
        thumb('summary.door', 'door'),
        thumb('summary.newAccount', 'new-account'),
        thumb('summary.check', 'check'),
      ],
    },
  ],
})
