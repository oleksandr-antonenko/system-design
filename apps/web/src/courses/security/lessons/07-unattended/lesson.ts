import {
  Goal,
  alt,
  blank,
  bubble,
  chooseAction,
  frame,
  gallery,
  item,
  narration,
  scenario,
  setUpTray,
  thumb,
} from '../../../../kinds/scenario/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import coffee from './art/coffee.webp'
import desk from './art/desk.webp'
import lock from './art/lock.webp'
import usb from './art/usb.webp'

// Урок 7 «Screen lock. Офис без присмотра» (план, раздел 3). Новое слово —
// «блокировка экрана». Открытый ноутбук и найденная флешка — открытая
// дверь. Задача — стол Марины перед обедом: стикер с паролем — в сейф,
// распечатку — из принтера, флешку — Ире, ноутбук — заблокировать.
// Вставленная флешка и открытый экран — ошибки с объяснением. Промпты
// кадров — в frames.md.

export default defineLesson(scenario, {
  slug: 'unattended',
  labels: [
    'marina',
    'oleg',
    'striped',
    'desk-app',
    'group:desk',
    'item:laptop',
    'item:sticker',
    'item:printout',
    'item:usb',
    'action:lock',
    'action:leave',
    'action:vault',
    'action:flip',
    'action:take',
    'action:later',
    'action:to-it',
    'action:plug',
    'res:laptop:lock',
    'res:laptop:leave',
    'res:sticker:vault',
    'res:sticker:flip',
    'res:printout:take',
    'res:printout:later',
    'res:usb:to-it',
    'res:usb:plug',
  ],
  steps: [
    {
      id: 'open-door',
      ops: [frame('coffee', coffee, ['oleg', 'striped', 'laptop'])],
      stage: [
        alt('coffee.alt'),
        narration('coffee.narration', { x: 2.5, bottom: 3 }),
        bubble('coffee.striped', 'striped', {
          x: 54,
          y: 4,
          w: 42,
          tail: 'br',
          tone: 'bad',
        }),
      ],
    },
    {
      id: 'two-minutes',
      ops: [frame('desk', desk, ['laptop', 'sticker', 'printer', 'usb'])],
      stage: [
        alt('desk.alt'),
        narration('desk.narration', { x: 2.5, bottom: 3 }),
      ],
      quiz: {
        id: 'two-minutes',
        kind: 'Choice',
        candidates: ['turn', 'ask', 'lock'],
        answer: 'lock',
      },
    },
    {
      id: 'lock',
      ops: [frame('lock', lock, ['marina', 'laptop'])],
      stage: [
        alt('lock.alt'),
        narration('lock.narration', { x: 2.5, bottom: 3 }),
        bubble('lock.marina', 'marina', { x: 3, y: 4, w: 40, tail: 'br' }),
      ],
    },
    {
      id: 'usb',
      ops: [frame('usb', usb, ['oleg', 'striped', 'usb'])],
      stage: [
        alt('usb.alt'),
        narration('usb.narration', { x: 2.5, bottom: 3 }),
        bubble('usb.oleg', 'oleg', {
          x: 52,
          y: 4,
          w: 44,
          tail: 'bl',
          tone: 'think',
        }),
      ],
    },
    {
      id: 'lunch',
      ops: [
        blank(),
        setUpTray({
          owner: 'marina',
          look: 'desk',
          app: 'desk-app',
          items: [
            item({
              id: 'laptop',
              icon: '💻',
              group: 'desk',
              actions: ['lock', 'leave'],
              right: 'lock',
              risk: { action: 'leave', risk: 'unlocked' },
            }),
            item({
              id: 'sticker',
              icon: '📝',
              group: 'desk',
              actions: ['vault', 'flip'],
              right: 'vault',
            }),
            item({
              id: 'printout',
              icon: '🖨️',
              group: 'desk',
              actions: ['take', 'later'],
              right: 'take',
            }),
            item({
              id: 'usb',
              icon: '💾',
              group: 'desk',
              actions: ['to-it', 'plug'],
              right: 'to-it',
              risk: { action: 'plug', risk: 'plug' },
            }),
          ],
        }),
      ],
      stage: [],
      task: {
        id: 'lunch',
        palette: [],
        surfaces: ['desk:marina'],
        goals: [
          {
            id: 'clean',
            goal: Goal.Sorted({ items: ['sticker', 'printout'] }),
          },
          { id: 'usb', goal: Goal.Sorted({ items: ['usb'] }) },
          { id: 'locked', goal: Goal.Sorted({ items: ['laptop'] }) },
        ],
        solution: [
          chooseAction('sticker', 'vault'),
          chooseAction('printout', 'take'),
          chooseAction('usb', 'to-it'),
          chooseAction('laptop', 'lock'),
        ],
      },
    },
    {
      id: 'summary',
      ops: [
        gallery([
          { id: 'coffee', art: coffee },
          { id: 'desk', art: desk },
          { id: 'lock', art: lock },
          { id: 'usb', art: usb },
        ]),
      ],
      stage: [
        thumb('summary.coffee', 'coffee'),
        thumb('summary.desk', 'desk'),
        thumb('summary.lock', 'lock'),
        thumb('summary.usb', 'usb'),
      ],
    },
  ],
})
