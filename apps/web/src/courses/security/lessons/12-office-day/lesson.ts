import {
  Goal,
  alt,
  blank,
  bubble,
  callContact,
  chooseAction,
  contact,
  createToken,
  detail,
  forwardThread,
  frame,
  gallery,
  giveReference,
  item,
  joinNetwork,
  mail,
  markMail,
  narration,
  network,
  passPortal,
  reply,
  revokeToken,
  saveToken,
  scenario,
  sendMail,
  sendReply,
  setUpAssistant,
  setUpChat,
  setUpInbox,
  setUpPhone,
  setUpTray,
  setVpn,
  sign,
  thread,
  thumb,
} from '../../../../kinds/scenario/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import cafe from './art/cafe.webp'
import evening from './art/evening.webp'
import guest from './art/guest.webp'
import morning from './art/morning.webp'

// Урок 12 «Practice. День в офисе» (план, раздел 3). Новых слов нет:
// шесть коротких ситуаций одного дня на экранах прошлых уроков — гость
// просит Wi-Fi (вопрос), обед в кафе (телефон), письмо «бухгалтерии»
// (почта), «Ира» с нового номера (мессенджер), новое расширение
// (страница расширений), ассистенту нужен доступ (чат с ИИ и CRM).
// Промпты кадров — в frames.md.

const CAFE = 'Rozmarin-Guest'
const TWIN = 'Rozmarin-Free-WiFi'
const MARINA = 'marina@romashka.example'

export default defineLesson(scenario, {
  slug: 'office-day',
  labels: [
    'marina',
    'oleg',
    'ira',
    'victor',
    'guest',
    'striped',
    'vpn-profile',
    'offer',
    'offer:file',
    `net:${CAFE}`,
    `net:${TWIN}`,
    'net:Galaxy S24',
    'mail:pay',
    'mail:pay:body',
    'mail:pay:link',
    'mail:pay:why',
    'mail:olga',
    'mail:olga:body',
    'mail:olga:why',
    'mail:hr',
    'mail:hr:body',
    'mail:hr:link',
    'mail:hr:why',
    'chat:fake-ira',
    'chat:fake-ira:body',
    'chat:fake-ira:call',
    'chat:fake-ira:forwarded',
    'reply:fake-ira:install',
    'reply:fake-ira:check',
    'chat:oleg',
    'chat:oleg:body',
    'contact:ira',
    'call:ira',
    'extensions-app',
    'group:store',
    'group:installed',
    'item:sheets',
    'item:coupons',
    'detail:all-sites',
    'detail:clipboard',
    'action:install',
    'action:cancel',
    'action:keep',
    'action:remove',
    'res:sheets:install',
    'res:sheets:cancel',
    'res:coupons:remove',
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
      id: 'morning',
      ops: [frame('morning', morning, ['marina', 'oleg', 'ira', 'victor'])],
      stage: [
        alt('morning.alt'),
        narration('morning.narration', { x: 2.5, bottom: 3 }),
        bubble('morning.marina', 'marina', { x: 3, y: 4, w: 36, tail: 'bl' }),
      ],
    },
    {
      id: 'guest',
      ops: [frame('guest', guest, ['guest', 'marina', 'card'])],
      stage: [
        alt('guest.alt'),
        narration('guest.narration', { x: 2.5, bottom: 3 }),
        bubble('guest.guest', 'guest', { x: 3, y: 4, w: 40, tail: 'br' }),
      ],
      quiz: {
        id: 'guest-wifi',
        kind: 'Choice',
        candidates: ['office', 'phone', 'guest'],
        answer: 'guest',
      },
    },
    {
      id: 'lunch',
      ops: [
        frame('cafe', cafe, ['marina', 'striped', 'sign']),
        setUpPhone({
          owner: 'marina',
          account: MARINA,
          networks: [
            network({
              ssid: TWIN,
              signal: 3,
              portal: 'login',
              portalUrl: 'free-wifi-login.example',
            }),
            network({
              ssid: CAFE,
              signal: 2,
              portal: 'consent',
              portalUrl: 'wifi.rozmarin.example',
            }),
            network({ ssid: 'Galaxy S24', signal: 1, isLocked: true }),
          ],
          vpn: 'vpn-profile',
          draft: 'offer',
          to: 'client@lastochka.example',
        }),
      ],
      stage: [
        alt('cafe.alt'),
        narration('cafe.narration', { x: 2.5, bottom: 3 }),
        sign('cafe.sign', CAFE, { x: 30, y: 30 }),
      ],
      task: {
        id: 'lunch',
        palette: [],
        surfaces: ['phone:marina'],
        goals: [
          { id: 'cafe-network', goal: Goal.Online({ ssid: CAFE }) },
          { id: 'vpn', goal: Goal.VpnOn() },
          { id: 'sent', goal: Goal.MailSent() },
        ],
        solution: [joinNetwork(CAFE), passPortal(), setVpn(true), sendMail()],
      },
    },
    {
      id: 'accounting',
      ops: [
        blank(),
        setUpInbox({
          owner: 'marina',
          account: MARINA,
          domain: 'romashka.example',
          mails: [
            mail({
              id: 'pay',
              address: 'buh@romashka-pay.example',
              time: '14:05',
              isPhish: true,
              link: {
                url: 'https://romashka-pay.example/salary/confirm',
                look: 'button',
                page: 'login',
              },
            }),
            mail({
              id: 'olga',
              address: 'olga@romashka.example',
              time: '13:40',
              isPhish: false,
            }),
            mail({
              id: 'hr',
              address: 'hr@romashka.example',
              time: '11:20',
              isPhish: false,
              link: {
                url: 'https://hr.romashka.example/vacation',
                look: 'text',
                page: 'own',
              },
            }),
          ],
        }),
      ],
      stage: [],
      task: {
        id: 'accounting',
        palette: [],
        surfaces: ['mail:marina'],
        goals: [
          { id: 'phish', goal: Goal.PhishFlagged() },
          { id: 'real', goal: Goal.RealKept() },
        ],
        solution: [
          markMail('pay', 'phish'),
          markMail('olga', 'real'),
          markMail('hr', 'real'),
        ],
      },
    },
    {
      id: 'it-call',
      ops: [
        blank(),
        setUpChat({
          owner: 'marina',
          it: 'ira',
          threads: [
            thread({
              id: 'fake-ira',
              number: '+370 611 20 450',
              isKnown: false,
              replies: [reply('install', 'comply'), reply('check', 'safe')],
            }),
            thread({ id: 'oleg', number: '+370 5 200 1133' }),
          ],
          contacts: [contact('ira', '+370 5 200 1120')],
        }),
      ],
      stage: [],
      task: {
        id: 'it-call',
        palette: [],
        surfaces: ['chat:marina'],
        goals: [
          {
            id: 'pause',
            goal: Goal.Replied({ thread: 'fake-ira', reply: 'check' }),
          },
          { id: 'verified', goal: Goal.Called({ contact: 'ira' }) },
          { id: 'forwarded', goal: Goal.Forwarded({ thread: 'fake-ira' }) },
        ],
        solution: [
          sendReply('fake-ira', 'check'),
          callContact('ira'),
          forwardThread('fake-ira'),
        ],
      },
    },
    {
      id: 'extension',
      ops: [
        blank(),
        setUpTray({
          owner: 'marina',
          look: 'extensions',
          app: 'extensions-app',
          items: [
            item({
              id: 'sheets',
              icon: '📊',
              group: 'store',
              details: [detail('all-sites', true), detail('clipboard', true)],
              actions: ['install', 'cancel'],
              right: 'cancel',
              risk: { action: 'install', risk: 'grant' },
            }),
            item({
              id: 'coupons',
              icon: '🏷️',
              group: 'installed',
              details: [detail('all-sites', true)],
              actions: ['keep', 'remove'],
              right: 'remove',
              chosen: 'keep',
            }),
          ],
        }),
      ],
      stage: [],
      task: {
        id: 'extension',
        palette: [],
        surfaces: ['extensions:marina'],
        goals: [
          { id: 'declined', goal: Goal.Sorted({ items: ['sheets'] }) },
          { id: 'cleaned', goal: Goal.Sorted({ items: ['coupons'] }) },
        ],
        solution: [
          chooseAction('sheets', 'cancel'),
          chooseAction('coupons', 'remove'),
        ],
      },
    },
    {
      id: 'assistant',
      ops: [
        blank(),
        setUpAssistant({
          owner: 'marina',
          bot: 'assistant',
          crm: 'crm',
          url: 'crm.romashka.example/settings/access',
          sections: ['sales', 'clients', 'invoices', 'staff'],
          need: 'clients',
          days: 7,
          reference: 'op://Work/crm-agent/token',
        }),
      ],
      stage: [],
      task: {
        id: 'assistant',
        palette: [],
        surfaces: ['assistant:marina', 'crm:marina'],
        goals: [
          { id: 'scoped', goal: Goal.ScopedAccess() },
          { id: 'revoked', goal: Goal.AccessRevoked() },
          { id: 'clean', goal: Goal.ChatClean() },
        ],
        solution: [
          createToken({ access: 'read', sections: ['clients'], days: 7 }),
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
          { id: 'morning', art: morning },
          { id: 'guest', art: guest },
          { id: 'cafe', art: cafe },
          { id: 'evening', art: evening },
        ]),
      ],
      stage: [
        thumb('summary.morning', 'morning'),
        thumb('summary.guest', 'guest'),
        thumb('summary.cafe', 'cafe'),
        thumb('summary.evening', 'evening'),
      ],
    },
  ],
})
