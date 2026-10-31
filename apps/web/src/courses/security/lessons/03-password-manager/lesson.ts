import {
  Goal,
  alt,
  blank,
  bubble,
  compare,
  entry,
  frame,
  gallery,
  generatePassword,
  narration,
  saveEntry,
  scenario,
  setUpVault,
  shareEntry,
  tag,
  thumb,
} from '../../../../kinds/scenario/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import keys from './art/keys.webp'
import leak from './art/leak.webp'
import twin from './art/twin.webp'
import vault from './art/vault.webp'

// Урок 3 «Password manager. Один пароль — одна дверь» (план, раздел 3).
// Новые слова — «менеджер паролей» и «мастер-пароль». Задача — менеджер
// паролей Марины: пароли со стикеров — в сейф, повтор — заменить
// сгенерированным, доступ к соцсети — Олегу через общий сейф, а не в чат.
//

export default defineLesson(scenario, {
  slug: 'password-manager',
  labels: [
    'marina',
    'oleg',
    'striped',
    'vault-app',
    'vault-personal',
    'vault-marketing',
    'vault:request',
    'entry:crm',
    'entry:lunch',
    'entry:social',
  ],
  steps: [
    {
      id: 'one-key',
      ops: [frame('keys', keys, ['oleg', 'keyring', 'doors'])],
      stage: [
        alt('keys.alt'),
        narration('keys.narration', { x: 2.5, bottom: 3 }),
        bubble('keys.oleg', 'oleg', { x: 3, y: 4, w: 34, tail: 'br' }),
        tag('keys.doors', 'doors', { x: 64, y: 8, color: '#E8A33A' }),
      ],
    },
    {
      id: 'leak',
      ops: [frame('leak', leak, ['striped', 'doors'])],
      stage: [
        alt('leak.alt'),
        narration('leak.narration', { x: 2.5, bottom: 3 }),
        bubble('leak.striped', 'striped', {
          x: 52,
          y: 4,
          w: 44,
          tail: 'bl',
          tone: 'bad',
        }),
      ],
    },
    {
      id: 'vault',
      ops: [frame('vault', vault, ['marina', 'safe'])],
      stage: [
        alt('vault.alt'),
        narration('vault.narration', { x: 2.5, bottom: 3 }),
        bubble('vault.marina', 'marina', { x: 3, y: 4, w: 40, tail: 'br' }),
      ],
    },
    {
      id: 'app',
      ops: [frame('vault', vault, ['marina', 'safe', 'screen'])],
      stage: [
        alt('app.alt'),
        narration('app.narration', { x: 2.5, bottom: 3 }),
        bubble('app.marina', 'marina', { x: 3, y: 4, w: 40, tail: 'br' }),
        tag('app.screen', 'screen', { x: 68, y: 62, color: '#5B6BD6' }),
      ],
    },
    {
      id: 'no-autofill',
      ops: [frame('twin', twin, ['oleg', 'safe', 'page'])],
      stage: [
        alt('twin.alt'),
        narration('twin.narration', { x: 2.5, bottom: 3 }),
        bubble('twin.oleg', 'oleg', {
          x: 52,
          y: 4,
          w: 44,
          tail: 'bl',
          tone: 'think',
        }),
      ],
      quiz: {
        id: 'no-autofill',
        kind: 'Choice',
        candidates: ['wrong-address', 'vault-broken', 'new-design'],
        answer: 'wrong-address',
      },
    },
    {
      id: 'lookalike',
      ops: [frame('twin', twin, ['oleg', 'safe', 'page'])],
      stage: [
        alt('lookalike.alt'),
        narration('lookalike.narration', { x: 2.5, bottom: 3 }),
        compare('lookalike.compare', 'page', { x: 50, y: 3, w: 48 }),
      ],
    },
    {
      id: 'stickers',
      ops: [
        blank(),
        setUpVault({
          owner: 'marina',
          app: 'vault-app',
          personal: 'vault-personal',
          shared: 'vault-marketing',
          members: ['oleg'],
          asker: 'oleg',
          entries: [
            entry({
              id: 'crm',
              url: 'crm.romashka.example',
              login: 'marina',
              password: 'Romashka2024',
            }),
            entry({
              id: 'lunch',
              url: 'lunch-delivery.example',
              login: 'marina@romashka.example',
              password: 'Romashka2024',
            }),
            entry({
              id: 'social',
              url: 'social.example/romashka',
              login: 'romashka.official',
              password: 'Lastochka!7',
            }),
          ],
        }),
      ],
      stage: [],
      task: {
        id: 'stickers',
        palette: [],
        surfaces: ['vault:marina'],
        goals: [
          { id: 'saved', goal: Goal.AllSaved() },
          { id: 'unique', goal: Goal.NoReuse() },
          { id: 'shared', goal: Goal.InShared({ entry: 'social' }) },
        ],
        solution: [
          saveEntry('crm'),
          saveEntry('lunch'),
          saveEntry('social'),
          generatePassword('crm'),
          shareEntry('social'),
        ],
      },
    },
    {
      id: 'summary',
      ops: [
        gallery([
          { id: 'keys', art: keys },
          { id: 'leak', art: leak },
          { id: 'vault', art: vault },
          { id: 'twin', art: twin },
        ]),
      ],
      stage: [
        thumb('summary.keys', 'keys'),
        thumb('summary.leak', 'leak'),
        thumb('summary.vault', 'vault'),
        thumb('summary.twin', 'twin'),
      ],
    },
  ],
})
