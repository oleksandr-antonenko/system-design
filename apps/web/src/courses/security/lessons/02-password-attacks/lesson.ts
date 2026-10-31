import {
  Goal,
  alt,
  blank,
  bubble,
  chooseAction,
  compare,
  frame,
  gallery,
  item,
  narration,
  scenario,
  setUpTray,
  thumb,
  zoom,
} from '../../../../kinds/scenario/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import archive from './art/archive.webp'
import check from './art/check.webp'
import machine from './art/machine.webp'
import phrase from './art/phrase.webp'
import profile from './art/profile.webp'

// Урок 2 «Password attacks. Как подбирают пароли» (план, раздел 3 и
// исследование в разделе 9). Пароли не угадывают руками: программа
// перебирает списки популярных и утёкших паролей и привычные шаблоны, а для
// конкретного человека добавляет его данные из соцсетей. Новые слова —
// «dictionary attack» и «credential stuffing». Задача — пароли Олега на
// проверке: для каждого решить, упадёт он сразу, по данным из соцсетей или
// держится. Промпты кадров — в frames.md.

const ACTIONS = ['fast', 'personal', 'holds']

export default defineLesson(scenario, {
  slug: 'password-attacks',
  labels: [
    'marina',
    'oleg',
    'striped',
    'check-app',
    'group:oleg',
    'item:qwerty',
    'item:romashka',
    'item:barsik',
    'item:leaked',
    'item:phrase',
    'item:generated',
    'action:fast',
    'action:personal',
    'action:holds',
    'res:qwerty:fast',
    'res:qwerty:personal',
    'res:qwerty:holds',
    'res:romashka:fast',
    'res:romashka:personal',
    'res:romashka:holds',
    'res:barsik:fast',
    'res:barsik:personal',
    'res:barsik:holds',
    'res:leaked:fast',
    'res:leaked:personal',
    'res:leaked:holds',
    'res:phrase:fast',
    'res:phrase:personal',
    'res:phrase:holds',
    'res:generated:fast',
    'res:generated:personal',
    'res:generated:holds',
  ],
  steps: [
    {
      id: 'by-machine',
      ops: [frame('machine', machine, ['striped', 'machine', 'keys', 'door'])],
      stage: [
        alt('machine.alt'),
        narration('machine.narration', { x: 2.5, bottom: 3 }),
        bubble('machine.striped', 'striped', {
          x: 54,
          y: 4,
          w: 42,
          tail: 'bl',
          tone: 'bad',
        }),
      ],
    },
    {
      id: 'patterns',
      ops: [frame('machine', machine, ['striped', 'machine', 'keys', 'door'])],
      stage: [
        alt('patterns.alt'),
        narration('patterns.narration', { x: 2.5, bottom: 3 }),
        zoom('patterns.zoom', 'keys', { x: 50, y: 4, w: 46, tail: 'bl' }),
      ],
    },
    {
      id: 'leaks',
      ops: [frame('archive', archive, ['striped', 'drawer', 'box'])],
      stage: [
        alt('archive.alt'),
        narration('archive.narration', { x: 2.5, bottom: 3 }),
        bubble('archive.striped', 'striped', {
          x: 3,
          y: 4,
          w: 42,
          tail: 'br',
          tone: 'bad',
        }),
      ],
    },
    {
      id: 'stuffing',
      ops: [frame('archive', archive, ['striped', 'drawer', 'box'])],
      stage: [
        alt('stuffing.alt'),
        narration('stuffing.narration', { x: 2.5, bottom: 3 }),
      ],
      quiz: {
        id: 'stuffing',
        kind: 'Choice',
        candidates: ['delivery-only', 'mail-too', 'nothing'],
        answer: 'mail-too',
      },
    },
    {
      id: 'personal',
      ops: [frame('profile', profile, ['striped', 'oleg', 'feed'])],
      stage: [
        alt('profile.alt'),
        narration('profile.narration', { x: 2.5, bottom: 3 }),
        bubble('profile.striped', 'striped', {
          x: 62,
          y: 4,
          w: 35,
          tail: 'br',
          tone: 'bad',
        }),
      ],
    },
    {
      id: 'phrase',
      ops: [frame('phrase', phrase, ['marina', 'key', 'machine', 'striped'])],
      stage: [
        alt('phrase.alt'),
        narration('phrase.narration', { x: 2.5, bottom: 3 }),
        compare('phrase.compare', 'key', { x: 50, y: 3, w: 48 }),
      ],
    },
    {
      id: 'check',
      ops: [frame('check', check, ['marina', 'oleg', 'laptop'])],
      stage: [
        alt('check.alt'),
        narration('check.narration', { x: 2.5, bottom: 3 }),
        bubble('check.marina', 'marina', { x: 3, y: 4, w: 40, tail: 'br' }),
      ],
    },
    {
      id: 'audit',
      ops: [
        blank(),
        setUpTray({
          owner: 'oleg',
          look: 'passwords',
          app: 'check-app',
          items: [
            item({
              id: 'qwerty',
              icon: '🛒',
              group: 'oleg',
              actions: ACTIONS,
              right: 'fast',
            }),
            item({
              id: 'romashka',
              icon: '📊',
              group: 'oleg',
              actions: ACTIONS,
              right: 'fast',
            }),
            item({
              id: 'barsik',
              icon: '🏦',
              group: 'oleg',
              actions: ACTIONS,
              right: 'personal',
            }),
            item({
              id: 'leaked',
              icon: '🍱',
              group: 'oleg',
              actions: ACTIONS,
              right: 'fast',
            }),
            item({
              id: 'phrase',
              icon: '✉️',
              group: 'oleg',
              actions: ACTIONS,
              right: 'holds',
            }),
            item({
              id: 'generated',
              icon: '💬',
              group: 'oleg',
              actions: ACTIONS,
              right: 'holds',
            }),
          ],
        }),
      ],
      stage: [],
      task: {
        id: 'audit',
        palette: [],
        surfaces: ['passwords:oleg'],
        goals: [
          {
            id: 'lists',
            goal: Goal.Sorted({ items: ['qwerty', 'romashka', 'leaked'] }),
          },
          { id: 'personal', goal: Goal.Sorted({ items: ['barsik'] }) },
          {
            id: 'strong',
            goal: Goal.Sorted({ items: ['phrase', 'generated'] }),
          },
        ],
        solution: [
          chooseAction('qwerty', 'fast'),
          chooseAction('romashka', 'fast'),
          chooseAction('barsik', 'personal'),
          chooseAction('leaked', 'fast'),
          chooseAction('phrase', 'holds'),
          chooseAction('generated', 'holds'),
        ],
      },
    },
    {
      id: 'summary',
      ops: [
        gallery([
          { id: 'machine', art: machine },
          { id: 'archive', art: archive },
          { id: 'profile', art: profile },
          { id: 'phrase', art: phrase },
          { id: 'check', art: check },
        ]),
      ],
      stage: [
        thumb('summary.machine', 'machine'),
        thumb('summary.archive', 'archive'),
        thumb('summary.profile', 'profile'),
        thumb('summary.phrase', 'phrase'),
        thumb('summary.check', 'check'),
      ],
    },
  ],
})
