import {
  Goal,
  alt,
  blank,
  bubble,
  frame,
  gallery,
  letter,
  mail,
  markMail,
  narration,
  scenario,
  setUpInbox,
  thumb,
  trapPage,
  zoom,
} from '../../../../kinds/scenario/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import bait from './art/bait.webp'
import call from './art/call.webp'
import costume from './art/costume.webp'
import fakedoor from './art/fakedoor.webp'
import mask from './art/mask.webp'
import research from './art/research.webp'

// Урок 5 «Письмо-приманка» (план, раздел 6; макет
// docs/mockups/security-lesson-2.html). Сначала проверка «Вам повезло?» на
// странице-двойнике, потом кадры, вопрос «Найдите улику» и разбор почты.
// Новые слова — «фишинг» и «персональный фишинг». Домены вымышленные:
// своя компания — romashka.example, двойники — rornashka.example,
// romashka-group.example, romashka-docs.example.

const MARINA = 'marina@romashka.example'

export default defineLesson(scenario, {
  slug: 'phishing',
  labels: [
    'marina',
    'oleg',
    'striped',
    'victor',
    'victor-mask',
    'bait-letter',
    'letter:act',
    'letter:act:body',
    'letter:act:button',
    'letter:act:sign',
    'mail:ceo',
    'mail:ceo:body',
    'mail:ceo:link',
    'mail:ceo:why',
    'mail:hr',
    'mail:hr:body',
    'mail:hr:link',
    'mail:hr:why',
    'mail:oleg',
    'mail:oleg:body',
    'mail:oleg:link',
    'mail:oleg:why',
    'mail:parcel',
    'mail:parcel:body',
    'mail:parcel:link',
    'mail:parcel:why',
    'mail:ira',
    'mail:ira:body',
    'mail:ira:why',
    'mail:it',
    'mail:it:body',
    'mail:it:link',
    'mail:it:why',
  ],
  steps: [
    {
      id: 'prize',
      ops: [trapPage('https://gooogle-prizes.example/iphone-duo', 'Gooogle')],
      stage: [],
      quiz: {
        id: 'prize',
        kind: 'PickHotspot',
        candidates: ['skip', 'login'],
        answer: 'skip',
      },
    },
    {
      id: 'bait',
      ops: [frame('bait', bait, ['striped', 'oleg', 'marina', 'bait-letter'])],
      stage: [
        alt('bait.alt'),
        narration('bait.narration', { x: 2.5, bottom: 3 }),
        bubble('bait.letter', 'bait-letter', {
          x: 55,
          y: 3,
          w: 43,
          tail: 'bl',
        }),
        bubble('bait.oleg', 'oleg', { x: 60, y: 40, w: 22, tail: 'bl' }),
        bubble('bait.marina', 'marina', {
          x: 79,
          y: 28,
          w: 20,
          tail: 'bl',
          tone: 'think',
        }),
      ],
    },
    {
      id: 'fake-door',
      ops: [frame('fakedoor', fakedoor, ['oleg', 'striped'])],
      stage: [
        alt('fakedoor.alt'),
        narration('fakedoor.narration', { x: 2.5, bottom: 3 }),
        bubble('fakedoor.oleg', 'oleg', { x: 2, y: 3, w: 28, tail: 'br' }),
        bubble('fakedoor.striped', 'striped', {
          x: 62,
          y: 2,
          w: 34,
          tail: 'bl',
          tone: 'bad',
        }),
      ],
    },
    {
      id: 'costume',
      ops: [frame('costume', costume, ['striped', 'marina', 'addr'])],
      stage: [
        alt('costume.alt'),
        narration('costume.narration'),
        bubble('costume.striped', 'striped', {
          x: 75,
          y: 24,
          w: 24,
          tail: 'bl',
        }),
        zoom('costume.zoom', 'addr', { x: 2, bottom: 4, w: 46, tail: 'tr' }),
      ],
    },
    {
      id: 'research',
      ops: [frame('research', research, ['striped', 'marina', 'victor'])],
      stage: [
        alt('research.alt'),
        narration('research.narration'),
        bubble('research.striped', 'striped', {
          x: 62,
          y: 3,
          w: 36,
          tail: 'bl',
        }),
      ],
    },
    {
      id: 'mask',
      ops: [frame('mask', mask, ['victor-mask', 'marina'])],
      stage: [
        alt('mask.alt'),
        narration('mask.narration', { x: 2.5, bottom: 3 }),
        bubble('mask.victor', 'victor-mask', {
          x: 32,
          y: 2,
          w: 38,
          tail: 'br',
        }),
        bubble('mask.marina', 'marina', {
          x: 2,
          y: 3,
          w: 27,
          tail: 'br',
          tone: 'think',
        }),
      ],
    },
    {
      id: 'call',
      ops: [frame('call', call, ['marina', 'victor'])],
      stage: [
        alt('call.alt'),
        narration('call.narration', { x: 2.5, bottom: 3 }),
        bubble('call.marina', 'marina', { x: 2, y: 2, w: 34, tail: 'br' }),
        bubble('call.victor', 'victor', { x: 56, y: 1.5, w: 42, tail: 'bl' }),
      ],
    },
    {
      id: 'clue',
      ops: [
        letter({
          id: 'act',
          address: 'buh@romashka-docs.example',
          to: MARINA,
          time: '14:52',
        }),
      ],
      stage: [],
      quiz: {
        id: 'clue',
        kind: 'PickHotspot',
        candidates: ['name', 'addr', 'subj', 'btn', 'sign'],
        answer: 'addr',
      },
    },
    {
      id: 'inbox',
      ops: [
        blank(),
        setUpInbox({
          owner: 'marina',
          account: MARINA,
          domain: 'romashka.example',
          mails: [
            mail({
              id: 'ceo',
              address: 'viktor@romashka-group.example',
              time: '16:40',
              isPhish: true,
              link: {
                url: 'https://romashka-group.example/files/invoice-vilnius.pdf',
                look: 'file',
                page: 'file',
              },
            }),
            mail({
              id: 'hr',
              address: 'hr@romashka.example',
              time: '15:15',
              isPhish: false,
              link: {
                url: 'https://hr.romashka.example/poll/summer',
                look: 'text',
                page: 'own',
              },
            }),
            mail({
              id: 'oleg',
              address: 'oleg@romashka.example',
              time: '13:02',
              isPhish: false,
              link: {
                url: 'https://drive.romashka.example/party-2026',
                look: 'text',
                page: 'own',
              },
            }),
            mail({
              id: 'parcel',
              address: 'notify@parcel-track.example',
              time: '11:30',
              isPhish: true,
              link: {
                url: 'https://parcel-track.example/pay?id=88213',
                look: 'button',
                page: 'payment',
              },
            }),
            mail({
              id: 'ira',
              address: 'ira@romashka.example',
              time: '10:05',
              isPhish: false,
            }),
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
          ],
        }),
      ],
      stage: [],
      task: {
        id: 'inbox',
        palette: [],
        surfaces: ['mail:marina'],
        goals: [
          { id: 'phish', goal: Goal.PhishFlagged() },
          { id: 'real', goal: Goal.RealKept() },
        ],
        solution: [
          markMail('it', 'phish'),
          markMail('ira', 'real'),
          markMail('parcel', 'phish'),
          markMail('oleg', 'real'),
          markMail('hr', 'real'),
          markMail('ceo', 'phish'),
        ],
      },
    },
    {
      id: 'summary',
      ops: [
        gallery([
          { id: 'bait', art: bait },
          { id: 'costume', art: costume },
          { id: 'mask', art: mask },
          { id: 'call', art: call },
        ]),
      ],
      stage: [
        thumb('summary.bait', 'bait'),
        thumb('summary.costume', 'costume'),
        thumb('summary.mask', 'mask'),
        thumb('summary.call', 'call'),
      ],
    },
  ],
})
