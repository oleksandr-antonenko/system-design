import {
  Goal,
  addKeepassEntry,
  alt,
  blank,
  bubble,
  compare,
  copyBase,
  createBase,
  frame,
  gallery,
  narration,
  scenario,
  setPhrase,
  setUpKeepass,
  thumb,
} from '../../../../kinds/scenario/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import box from './art/box.webp'
import copies from './art/copies.webp'
import forgot from './art/forgot.webp'
import phrase from './art/phrase.webp'

// Урок 3 «KeePass. Свой сейф-файл» (план, раздел 3). Новые слова — «файл
// базы» и «резервная копия». KeePass вводится простыми словами: тот же
// сейф, что 1Password из урока 2, только это файл у вас, и восстановить
// его некому. Задача — экран KeePass: создать базу, выбрать надёжную
// мастер-фразу, перенести пароли с бумажки и положить свежую копию на
// другое устройство. Промпты кадров — в frames.md.

export default defineLesson(scenario, {
  slug: 'keepass',
  labels: [
    'marina',
    'oleg',
    'ira',
    'keepass-app',
    'phrase:birthday',
    'phrase:old',
    'phrase:words',
    'place:laptop',
    'place:desktop',
    'place:usb',
    'place:cloud',
    'kp:bank',
    'kp:router',
  ],
  steps: [
    {
      id: 'own-file',
      ops: [frame('box', box, ['marina', 'safe'])],
      stage: [
        alt('box.alt'),
        narration('box.narration', { x: 2.5, bottom: 3 }),
        bubble('box.marina', 'marina', { x: 56, y: 4, w: 40, tail: 'bl' }),
      ],
    },
    {
      id: 'nobody',
      ops: [frame('forgot', forgot, ['oleg', 'ira', 'safe'])],
      stage: [
        alt('forgot.alt'),
        narration('forgot.narration', { x: 2.5, bottom: 3 }),
        bubble('forgot.oleg', 'oleg', {
          x: 3,
          y: 4,
          w: 40,
          tail: 'br',
          tone: 'think',
        }),
      ],
      quiz: {
        id: 'nobody',
        kind: 'Choice',
        candidates: ['ira', 'support', 'nobody'],
        answer: 'nobody',
      },
    },
    {
      id: 'phrase',
      ops: [frame('phrase', phrase, ['marina', 'cards'])],
      stage: [
        alt('phrase.alt'),
        narration('phrase.narration', { x: 2.5, bottom: 3 }),
        compare('phrase.compare', 'cards', { x: 50, y: 3, w: 48 }),
      ],
    },
    {
      id: 'backup',
      ops: [frame('copies', copies, ['marina', 'usb', 'cupboard'])],
      stage: [
        alt('copies.alt'),
        narration('copies.narration', { x: 2.5, bottom: 3 }),
        bubble('copies.marina', 'marina', { x: 3, y: 4, w: 44, tail: 'br' }),
      ],
    },
    {
      id: 'own-vault',
      ops: [
        blank(),
        setUpKeepass({
          owner: 'marina',
          app: 'keepass-app',
          file: 'marina.kdbx',
          home: 'laptop',
          phrases: [
            { id: 'birthday', isStrong: false },
            { id: 'old', isStrong: false },
            { id: 'words', isStrong: true },
          ],
          places: [
            { id: 'laptop', device: 'laptop' },
            { id: 'desktop', device: 'laptop' },
            { id: 'usb', device: 'usb' },
            { id: 'cloud', device: 'cloud' },
          ],
          entries: ['bank', 'router'],
        }),
      ],
      stage: [],
      task: {
        id: 'own-vault',
        palette: [],
        surfaces: ['keepass:marina'],
        goals: [
          { id: 'phrase', goal: Goal.StrongPhrase() },
          { id: 'entries', goal: Goal.EntriesAdded() },
          { id: 'backup', goal: Goal.FreshBackup() },
        ],
        solution: [
          createBase(),
          setPhrase('words'),
          addKeepassEntry('bank'),
          addKeepassEntry('router'),
          copyBase('usb'),
        ],
      },
    },
    {
      id: 'summary',
      ops: [
        gallery([
          { id: 'box', art: box },
          { id: 'forgot', art: forgot },
          { id: 'phrase', art: phrase },
          { id: 'copies', art: copies },
        ]),
      ],
      stage: [
        thumb('summary.box', 'box'),
        thumb('summary.forgot', 'forgot'),
        thumb('summary.phrase', 'phrase'),
        thumb('summary.copies', 'copies'),
      ],
    },
  ],
})
