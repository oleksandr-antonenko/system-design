import {
  Goal,
  alt,
  bubble,
  frame,
  gallery,
  joinNetwork,
  narration,
  network,
  passPortal,
  scenario,
  sendMail,
  setUpPhone,
  setVpn,
  sign,
  tag,
  thumb,
} from '../../../../kinds/scenario/dsl'
import { defineLesson } from '../../../../lesson/dsl'
import airport from './art/airport.webp'
import cafe from './art/cafe.webp'
import courier from './art/courier.webp'
import guest from './art/guest.webp'
import meeting from './art/meeting.webp'
import office from './art/office.webp'
import parking from './art/parking.webp'
import vpn from './art/vpn.webp'

// Урок 1 «Wi-Fi — общая комната» (план, раздел 5; макет
// docs/mockups/security-lesson-1.html). Один шаг — один кадр и его текст.
// Новые слова — «гостевая сеть» и «VPN». Задача — аэропорт: сеть с таблички,
// VPN, потом почта; рядом двойник с самым сильным сигналом.

const AIRPORT = 'AIRPORT-FREE'
const TWIN = 'AIRPORT-FREE-WiFi'

export default defineLesson(scenario, {
  slug: 'shared-room',
  labels: [
    'marina',
    'oleg',
    'courier',
    'striped',
    'guest',
    'client',
    'vpn-profile',
    'contract',
    'contract:file',
    `net:${AIRPORT}`,
    `net:${TWIN}`,
    'net:Lounge-Business',
    'net:Galaxy A52',
  ],
  steps: [
    {
      id: 'office',
      ops: [
        frame('office', office, ['marina', 'oleg', 'printer', 'nas', 'cam']),
      ],
      stage: [
        alt('office.alt'),
        narration('office.narration'),
        bubble('office.oleg', 'oleg', { x: 22, y: 15, w: 30, tail: 'br' }),
        tag('office.printer', 'printer', { x: 63, y: 64 }),
        tag('office.nas', 'nas', { x: 76, y: 39, color: '#E8A33A' }),
        tag('office.cam', 'cam', { x: 86, y: 33, color: '#7A6FD8' }),
      ],
    },
    {
      id: 'courier',
      ops: [frame('courier', courier, ['courier', 'marina'])],
      stage: [
        alt('courier.alt'),
        narration('courier.narration'),
        bubble('courier.courier', 'courier', {
          x: 50,
          y: 2,
          w: 47,
          tail: 'bl',
        }),
        bubble('courier.marina', 'marina', {
          x: 3,
          y: 13,
          w: 26,
          tail: 'br',
          tone: 'think',
        }),
      ],
    },
    {
      id: 'parking',
      ops: [frame('parking', parking, ['striped'])],
      stage: [
        alt('parking.alt'),
        narration('parking.narration'),
        bubble('parking.striped', 'striped', {
          x: 50,
          y: 31,
          w: 36,
          tail: 'br',
        }),
      ],
    },
    {
      id: 'guest-network',
      ops: [
        frame('guest', guest, ['marina', 'guest', 'office-net', 'guest-net']),
      ],
      stage: [
        alt('guest.alt'),
        narration('guest.narration'),
        tag('guest.officeNet', 'office-net', { x: 66, y: 93 }),
        tag('guest.guestNet', 'guest-net', { x: 19, y: 93, color: '#F29A6B' }),
        bubble('guest.marina', 'marina', { x: 33, y: 21, w: 32, tail: 'bl' }),
        bubble('guest.guest', 'guest', { x: 3, y: 37, w: 22, tail: 'br' }),
      ],
    },
    {
      id: 'client-wifi',
      ops: [frame('meeting', meeting, ['client', 'oleg'])],
      stage: [
        alt('meeting.alt'),
        narration('meeting.narration'),
        bubble('meeting.client', 'client', { x: 52, y: 3, w: 44, tail: 'bl' }),
      ],
      quiz: {
        id: 'client-wifi',
        kind: 'Choice',
        candidates: ['office-password', 'guest-card', 'open-network'],
        answer: 'guest-card',
      },
    },
    {
      id: 'cafe',
      ops: [frame('cafe', cafe, ['marina', 'striped'])],
      stage: [
        alt('cafe.alt'),
        narration('cafe.narration'),
        bubble('cafe.striped', 'striped', { x: 50, y: 25, w: 30, tail: 'bl' }),
      ],
    },
    {
      id: 'vpn',
      ops: [frame('vpn', vpn, ['marina', 'striped', 'tunnel'])],
      stage: [
        alt('vpn.alt'),
        narration('vpn.narration'),
        bubble('vpn.striped', 'striped', { x: 50, y: 25, w: 30, tail: 'bl' }),
        bubble('vpn.marina', 'marina', { x: 2, y: 27, w: 24, tail: 'br' }),
      ],
    },
    {
      id: 'airport',
      ops: [
        frame('airport', airport, ['marina', 'striped', 'sign']),
        setUpPhone({
          owner: 'marina',
          account: 'marina@romashka.example',
          networks: [
            network({
              ssid: TWIN,
              signal: 3,
              portal: 'login',
              portalUrl: 'free-wifi-login.example',
            }),
            network({
              ssid: AIRPORT,
              signal: 2,
              portal: 'consent',
              portalUrl: 'wifi.airport.example',
            }),
            network({ ssid: 'Lounge-Business', signal: 2, isLocked: true }),
            network({ ssid: 'Galaxy A52', signal: 1, isLocked: true }),
          ],
          vpn: 'vpn-profile',
          draft: 'contract',
          to: 'client@lastochka.example',
        }),
      ],
      stage: [
        alt('airport.alt'),
        narration('airport.narration'),
        sign('airport.sign', AIRPORT, { x: 31, y: 12 }),
        bubble('airport.marina', 'marina', { x: 4, y: 20, w: 27, tail: 'br' }),
        bubble('airport.striped', 'striped', {
          x: 64,
          y: 10,
          w: 33,
          tail: 'bl',
          tone: 'bad',
        }),
      ],
      task: {
        id: 'airport',
        palette: [],
        surfaces: ['phone:marina'],
        goals: [
          { id: 'on-sign-network', goal: Goal.Online({ ssid: AIRPORT }) },
          { id: 'vpn-on', goal: Goal.VpnOn() },
          { id: 'sent', goal: Goal.MailSent() },
        ],
        solution: [
          joinNetwork(AIRPORT),
          passPortal(),
          setVpn(true),
          sendMail(),
        ],
      },
    },
    {
      id: 'summary',
      ops: [
        gallery([
          { id: 'parking', art: parking },
          { id: 'guest', art: guest },
          { id: 'cafe', art: cafe },
          { id: 'vpn', art: vpn },
        ]),
      ],
      stage: [
        thumb('summary.parking', 'parking'),
        thumb('summary.guest', 'guest'),
        thumb('summary.cafe', 'cafe'),
        thumb('summary.vpn', 'vpn'),
      ],
    },
  ],
})
