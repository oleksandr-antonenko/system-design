import {
  Goal,
  alt,
  blank,
  bubble,
  entry,
  forwardMail,
  frame,
  gallery,
  generatePassword,
  mail,
  narration,
  reply,
  scenario,
  sendReply,
  session,
  setUpChat,
  setUpInbox,
  setUpVault,
  signOutEverywhere,
  thread,
  thumb,
} from '../../../../kinds/scenario/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import bin from './art/bin.webp'
import blush from './art/blush.webp'
import door from './art/door.webp'
import toIra from './art/to-ira.webp'

// Урок 11 «Incident. Если уже нажали» (план, раздел 3). Новое слово —
// «инцидент». Олег ввёл пароль на картонной двери из урока 5; задача —
// первые 15 минут на экранах прошлых уроков: сказать Ире в мессенджере,
// сменить пароль почты в менеджере паролей, выйти на всех устройствах и
// переслать приманку в IT, не удаляя её. Удалённая приманка — ошибка: она
// лежит в корзине, и переслать её можно оттуда. Промпты кадров —
// в frames.md.

const OLEG = 'oleg@romashka.example'

export default defineLesson(scenario, {
  slug: 'incident',
  labels: [
    'oleg',
    'marina',
    'ira',
    'striped',
    'chat:ira',
    'chat:ira:body',
    'reply:ira:report',
    'chat:marina',
    'chat:marina:body',
    'vault-app',
    'vault-personal',
    'vault-marketing',
    'entry:mail',
    'entry:crm',
    'entry:social',
    'mail:it',
    'mail:it:body',
    'mail:it:link',
    'mail:ira',
    'mail:ira:body',
    'session:laptop',
    'session:phone',
    'session:stranger',
  ],
  steps: [
    {
      id: 'blush',
      ops: [frame('blush', blush, ['oleg'])],
      stage: [
        alt('blush.alt'),
        narration('blush.narration', { x: 2.5, bottom: 3 }),
        bubble('blush.oleg', 'oleg', {
          x: 3,
          y: 4,
          w: 40,
          tail: 'br',
          tone: 'think',
        }),
      ],
    },
    {
      id: 'tell-it',
      ops: [frame('to-ira', toIra, ['oleg', 'ira'])],
      stage: [
        alt('toIra.alt'),
        narration('toIra.narration', { x: 2.5, bottom: 3 }),
        bubble('toIra.ira', 'ira', { x: 3, y: 4, w: 42, tail: 'br' }),
        bubble('toIra.oleg', 'oleg', { x: 56, y: 4, w: 40, tail: 'bl' }),
      ],
    },
    {
      id: 'close-door',
      ops: [frame('door', door, ['ira', 'striped'])],
      stage: [
        alt('door.alt'),
        narration('door.narration', { x: 2.5, bottom: 3 }),
        bubble('door.striped', 'striped', {
          x: 54,
          y: 4,
          w: 42,
          tail: 'bl',
          tone: 'bad',
        }),
      ],
    },
    {
      id: 'bait-after',
      ops: [frame('bin', bin, ['oleg'])],
      stage: [
        alt('bin.alt'),
        narration('bin.narration', { x: 2.5, bottom: 3 }),
      ],
      quiz: {
        id: 'bait-after',
        kind: 'Choice',
        candidates: ['delete', 'forward', 'reply'],
        answer: 'forward',
      },
    },
    {
      id: 'first-15',
      ops: [
        blank(),
        setUpChat({
          owner: 'oleg',
          it: 'ira',
          threads: [
            thread({
              id: 'ira',
              number: '+370 5 200 1120',
              replies: [reply('report', 'safe')],
            }),
            thread({ id: 'marina', number: '+370 5 200 1112' }),
          ],
        }),
        setUpVault({
          owner: 'oleg',
          app: 'vault-app',
          personal: 'vault-personal',
          shared: 'vault-marketing',
          members: ['marina'],
          entries: [
            entry({
              id: 'mail',
              url: 'mail.romashka.example',
              login: OLEG,
              password: 'Oleg-1990!',
              place: 'personal',
            }),
            entry({
              id: 'crm',
              url: 'crm.romashka.example',
              login: 'oleg',
              password: 'Kv7-mercury-lamp',
              place: 'personal',
            }),
            entry({
              id: 'social',
              url: 'social.example/romashka',
              login: 'romashka.official',
              password: 'Lastochka!7',
              place: 'shared',
            }),
          ],
        }),
        setUpInbox({
          owner: 'oleg',
          account: OLEG,
          domain: 'romashka.example',
          actions: 'report',
          sessions: [
            session('laptop', true),
            session('phone', true),
            session('stranger', false),
          ],
          mails: [
            mail({
              id: 'it',
              address: 'it-support@rornashka.example',
              time: '09:12',
              isPhish: true,
              link: {
                url: 'https://rornashka.example/mail/login',
                look: 'button',
                page: 'login',
              },
            }),
            mail({
              id: 'ira',
              address: 'ira@romashka.example',
              time: '08:40',
              isPhish: false,
            }),
          ],
        }),
      ],
      stage: [],
      task: {
        id: 'first-15',
        palette: [],
        surfaces: ['chat:oleg', 'vault:oleg', 'mail:oleg'],
        goals: [
          {
            id: 'told',
            goal: Goal.Replied({ thread: 'ira', reply: 'report' }),
          },
          { id: 'password', goal: Goal.Regenerated({ entry: 'mail' }) },
          { id: 'sessions', goal: Goal.SignedOut() },
          { id: 'evidence', goal: Goal.MailForwarded({ mail: 'it' }) },
        ],
        solution: [
          sendReply('ira', 'report'),
          generatePassword('mail'),
          signOutEverywhere(),
          forwardMail('it'),
        ],
      },
    },
    {
      id: 'summary',
      ops: [
        gallery([
          { id: 'blush', art: blush },
          { id: 'to-ira', art: toIra },
          { id: 'door', art: door },
          { id: 'bin', art: bin },
        ]),
      ],
      stage: [
        thumb('summary.blush', 'blush'),
        thumb('summary.toIra', 'to-ira'),
        thumb('summary.door', 'door'),
        thumb('summary.bin', 'bin'),
      ],
    },
  ],
})
