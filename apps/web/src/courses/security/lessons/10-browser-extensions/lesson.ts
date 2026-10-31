import {
  Goal,
  alt,
  blank,
  bubble,
  chooseAction,
  compare,
  detail,
  frame,
  gallery,
  item,
  narration,
  scenario,
  setUpTray,
  thumb,
} from '../../../../kinds/scenario/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import cleanup from './art/cleanup.webp'
import helper from './art/helper.webp'
import permissions from './art/permissions.webp'
import sold from './art/sold.webp'

// Урок 10 «Browser extensions. Что видит расширение» (план, раздел 3).
// Новые слова — «расширение браузера» и «разрешения». Задача — окно
// установки и страница расширений: отказаться от конвертера со всеми
// сайтами, поставить вариант «по нажатию», удалить два лишних из пяти.
// Установить расширение со всеми сайтами — ошибка с объяснением. Промпты
// кадров — в frames.md.

const install = ['install', 'cancel']
const review = ['keep', 'remove']
const grant = { action: 'install', risk: 'grant' } as const

export default defineLesson(scenario, {
  slug: 'browser-extensions',
  labels: [
    'marina',
    'striped',
    'extensions-app',
    'group:store',
    'group:installed',
    'item:pdf-pro',
    'item:pdf-lite',
    'item:vault',
    'item:translate',
    'item:coupons',
    'item:dark',
    'item:meet',
    'detail:all-sites',
    'detail:history',
    'detail:clipboard',
    'detail:on-click',
    'detail:meet',
    'action:install',
    'action:cancel',
    'action:keep',
    'action:remove',
    'res:pdf-pro:install',
    'res:pdf-pro:cancel',
    'res:pdf-lite:install',
    'res:vault:remove',
    'res:translate:remove',
    'res:coupons:remove',
    'res:dark:remove',
    'res:meet:remove',
  ],
  steps: [
    {
      id: 'helper',
      ops: [frame('helper', helper, ['marina', 'helper', 'tabs'])],
      stage: [
        alt('helper.alt'),
        narration('helper.narration', { x: 2.5, bottom: 3 }),
        bubble('helper.marina', 'marina', { x: 3, y: 3, w: 38, tail: 'br' }),
      ],
    },
    {
      id: 'permissions',
      ops: [frame('permissions', permissions, ['marina', 'dialog'])],
      stage: [
        alt('permissions.alt'),
        narration('permissions.narration', { x: 2.5, y: 3 }),
        compare('permissions.compare', 'dialog', { x: 34, bottom: 3, w: 64 }),
      ],
    },
    {
      id: 'sold',
      ops: [frame('sold', sold, ['striped', 'helper'])],
      stage: [
        alt('sold.alt'),
        narration('sold.narration', { x: 2.5, bottom: 3 }),
        bubble('sold.striped', 'striped', {
          x: 54,
          y: 3,
          w: 42,
          tail: 'br',
          tone: 'bad',
        }),
      ],
    },
    {
      id: 'cleanup',
      ops: [frame('cleanup', cleanup, ['marina', 'shelf'])],
      stage: [
        alt('cleanup.alt'),
        narration('cleanup.narration', { x: 2.5, bottom: 3 }),
        bubble('cleanup.marina', 'marina', { x: 3, y: 4, w: 36, tail: 'br' }),
      ],
      quiz: {
        id: 'which-permission',
        kind: 'Choice',
        candidates: ['one-site', 'all-sites', 'notify'],
        answer: 'all-sites',
      },
    },
    {
      id: 'extensions',
      ops: [
        blank(),
        setUpTray({
          owner: 'marina',
          look: 'extensions',
          app: 'extensions-app',
          items: [
            item({
              id: 'pdf-pro',
              icon: '📕',
              group: 'store',
              details: [detail('all-sites', true), detail('history', true)],
              actions: install,
              right: 'cancel',
              risk: grant,
            }),
            item({
              id: 'pdf-lite',
              icon: '📗',
              group: 'store',
              details: [detail('on-click')],
              actions: install,
              right: 'install',
            }),
            item({
              id: 'vault',
              icon: '🔑',
              group: 'installed',
              details: [detail('all-sites', true)],
              actions: review,
              right: 'keep',
              chosen: 'keep',
            }),
            item({
              id: 'translate',
              icon: '🌐',
              group: 'installed',
              details: [detail('on-click')],
              actions: review,
              right: 'keep',
              chosen: 'keep',
            }),
            item({
              id: 'coupons',
              icon: '🏷️',
              group: 'installed',
              details: [detail('all-sites', true), detail('history', true)],
              actions: review,
              right: 'remove',
              chosen: 'keep',
            }),
            item({
              id: 'dark',
              icon: '🌙',
              group: 'installed',
              details: [detail('all-sites', true), detail('clipboard', true)],
              actions: review,
              right: 'remove',
              chosen: 'keep',
            }),
            item({
              id: 'meet',
              icon: '📹',
              group: 'installed',
              details: [detail('meet')],
              actions: review,
              right: 'keep',
              chosen: 'keep',
            }),
          ],
        }),
      ],
      stage: [],
      task: {
        id: 'extensions',
        palette: [],
        surfaces: ['extensions:marina'],
        goals: [
          { id: 'declined', goal: Goal.Sorted({ items: ['pdf-pro'] }) },
          { id: 'narrow', goal: Goal.Sorted({ items: ['pdf-lite'] }) },
          {
            id: 'cleaned',
            goal: Goal.Sorted({
              items: ['vault', 'translate', 'coupons', 'dark', 'meet'],
            }),
          },
        ],
        solution: [
          chooseAction('pdf-pro', 'cancel'),
          chooseAction('pdf-lite', 'install'),
          chooseAction('coupons', 'remove'),
          chooseAction('dark', 'remove'),
        ],
      },
    },
    {
      id: 'summary',
      ops: [
        gallery([
          { id: 'helper', art: helper },
          { id: 'permissions', art: permissions },
          { id: 'sold', art: sold },
          { id: 'cleanup', art: cleanup },
        ]),
      ],
      stage: [
        thumb('summary.helper', 'helper'),
        thumb('summary.permissions', 'permissions'),
        thumb('summary.sold', 'sold'),
        thumb('summary.cleanup', 'cleanup'),
      ],
    },
  ],
})
