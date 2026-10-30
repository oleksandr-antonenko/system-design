import { Array, Option } from 'effect'
import { inertHtml as ih } from 'foldkit/html'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { uiFor } from '../../../../i18n/ui'
import * as Player from '../../../../lesson/player'
import { joinWifi, send, setDns, setStatic } from '../../../../net/build'
import { Intent } from '../../../../net/packet'
import { SurfaceMessage } from '../../../state'
import { packet } from '../../dsl'
import {
  CAFE,
  HOME,
  HOME_PASSWORD,
  NEIGHBOUR,
  devices,
  shopPage,
} from '../testing'
import { browserPicture, screenPicture } from './browser'
import { Message } from './message'
import { currentPage, dnsSettings, wifiStatus } from './network'
import type { Model } from './screen'
import { appsOf, ghostKeys } from './view'

// Экран устройства пишет ходы в журнал задачи; сеть, адрес и открытая
// страница берутся из документа и истории. Wi-Fi и браузер одного
// устройства — одна вкладка с переключателем приложений.

const update = (
  playerModel: Player.Model,
  playerMessage: Player.Message,
): ReturnType<typeof Player.update> =>
  Player.updateWith(devices)(playerModel, playerMessage)

/** Задачи решены эталоном: их ходы — в журнале. */
const solved = (ids: ReadonlyArray<string>) =>
  Object.fromEntries(
    Array.map(ids, id => [
      id,
      {
        ...Player.taskStateOf(Player.init('networks', devices, 0), id),
        log: Array.flatMap(devices.steps, step =>
          step.task?.id === id
            ? Array.map(step.task.solution, packet.op.wrap)
            : [],
        ),
        check: Player.CheckState.Solved({ withHint: false }),
      },
    ]),
  )

/** Шаг урока-фикстуры: задачи до него решены. */
const atStep = (step: number, before: ReadonlyArray<string>): Player.Model => ({
  ...Player.init('networks', devices, 0),
  tasks: solved(before),
  step,
})

const atJoin = () => atStep(1, [])
const atDns = () => atStep(2, ['join'])
const atGateway = () => atStep(4, ['join', 'dns', 'server'])

const screen = (surfaceId: string) => (screenMessage: Message) =>
  message(
    Player.Message.GotSurfaceMessage({
      surfaceId,
      message: SurfaceMessage.GotScreenSurfaceMessage({
        message: screenMessage,
      }),
    }),
  )

const phone = screen('browser:phone')
const dnsPhone = screen('wifi:phone')
const laptop = screen('wifi:laptop')

const logOf = (playerModel: Player.Model, task: string) =>
  Player.opsOf(packet, Player.taskStateOf(playerModel, task).log)

const contextOf = (playerModel: Player.Model, device: string) =>
  Player.surfaceContext(devices, playerModel, device)

const screenOf = (
  playerModel: Player.Model,
  surfaceId: string,
): Option.Option<Model> =>
  Option.flatMap(
    Option.fromNullishOr(playerModel.surfaces[surfaceId]),
    state =>
      state._tag === 'ScreenSurface' ? Option.some(state.model) : Option.none(),
  )

describe('one screen per device', () => {
  test('wifi:phone and browser:phone share one tab that opens on the first declared app', () => {
    expect(
      Array.map(Player.visibleSurfaces(devices, atJoin()), ({ id }) => id),
    ).toEqual(['browser:phone'])
    expect(appsOf(contextOf(atJoin(), 'phone'), 'browser')).toEqual([
      'settings',
      'browser',
    ])
    expect(
      Option.map(screenOf(atJoin(), 'browser:phone'), current => current.app),
    ).toEqual(Option.some('browser'))
  })

  test('a task with only the settings shows no app switch', () => {
    expect(appsOf(contextOf(atDns(), 'phone'), 'settings')).toEqual([
      'settings',
    ])
  })
})

describe('Wi-Fi settings', () => {
  test('the open café network is explained, not joined', () => {
    story(
      update,
      given(atJoin()),
      phone(Message.ClickedNetwork({ ssid: CAFE })),
      model(next => {
        expect(logOf(next, 'join')).toEqual([])
        expect(
          Option.map(screenOf(next, 'browser:phone'), current => current.sheet),
        ).toMatchObject(
          Option.some({
            _tag: 'Explained',
            problem: { _tag: 'ForeignOpenNetwork', ssid: CAFE },
          }),
        )
      }),
    )
  })

  test('the neighbour’s network asks for a password and explains it is not yours', () => {
    story(
      update,
      given(atJoin()),
      phone(Message.ClickedNetwork({ ssid: NEIGHBOUR })),
      phone(Message.UpdatedWifiPassword({ value: 'qwerty' })),
      phone(Message.SubmittedWifiPassword()),
      model(next => {
        expect(logOf(next, 'join')).toEqual([])
        expect(
          Option.map(screenOf(next, 'browser:phone'), current => current.sheet),
        ).toMatchObject(
          Option.some({
            _tag: 'Password',
            maybeProblem: Option.some({ _tag: 'ForeignNetwork' }),
          }),
        )
      }),
    )
  })

  test('a wrong password for the home network is a move that does not connect; the right one does', () => {
    story(
      update,
      given(atJoin()),
      phone(Message.ClickedNetwork({ ssid: HOME })),
      phone(Message.UpdatedWifiPassword({ value: '87654321' })),
      phone(Message.ClickedPasswordVisibility()),
      phone(Message.SubmittedWifiPassword()),
      model(next => {
        expect(logOf(next, 'join')).toEqual([
          joinWifi('phone', HOME, '87654321'),
        ])
        expect(
          Option.flatMap(
            wifiStatus(contextOf(next, 'phone')),
            status => status.maybeProblem,
          ),
        ).toMatchObject(Option.some({ _tag: 'WrongPassword' }))
        expect(
          Option.map(screenOf(next, 'browser:phone'), current => current.sheet),
        ).toMatchObject(
          Option.some({
            _tag: 'Password',
            isPasswordShown: false,
            maybeProblem: Option.some({ _tag: 'WrongPassword' }),
          }),
        )
      }),
      phone(Message.UpdatedWifiPassword({ value: HOME_PASSWORD })),
      phone(Message.SubmittedWifiPassword()),
      model(next => {
        expect(Array.last(logOf(next, 'join'))).toEqual(
          Option.some(joinWifi('phone', HOME, HOME_PASSWORD)),
        )
        expect(
          Option.map(wifiStatus(contextOf(next, 'phone')), status =>
            Option.isNone(status.maybeProblem),
          ),
        ).toEqual(Option.some(true))
        expect(
          Option.map(screenOf(next, 'browser:phone'), current => current.sheet),
        ).toEqual(Option.some({ _tag: 'Closed' }))
      }),
    )
  })

  test('outside the task the screen only shows', () => {
    story(
      update,
      given(atStep(0, [])),
      phone(Message.ClickedNetwork({ ssid: HOME })),
      model(next => {
        expect(next.tasks).toEqual({})
      }),
    )
  })
})

describe('browser', () => {
  test('a typed address gets http:// and opens; reload repeats it', () => {
    story(
      update,
      given(atJoin()),
      phone(Message.ClickedNetwork({ ssid: HOME })),
      phone(Message.UpdatedWifiPassword({ value: HOME_PASSWORD })),
      phone(Message.SubmittedWifiPassword()),
      phone(Message.UpdatedUrl({ value: 'shop.example' })),
      phone(Message.SubmittedUrl()),
      model(next => {
        expect(Array.last(logOf(next, 'join'))).toEqual(
          Option.some(
            send(Intent.Browse({ from: 'phone', url: 'http://shop.example/' })),
          ),
        )
        expect(
          Option.map(currentPage(contextOf(next, 'phone')), page => page.view),
        ).toMatchObject(Option.some({ _tag: 'Page', status: 200 }))
        expect(
          Option.flatMap(
            screenOf(next, 'browser:phone'),
            current => current.maybeUrlDraft,
          ),
        ).toEqual(Option.none())
      }),
      phone(Message.ClickedReload()),
      model(next => {
        expect(logOf(next, 'join')).toHaveLength(3)
      }),
    )
  })

  test('without Wi-Fi the page is a real browser error with the model’s reason', () => {
    story(
      update,
      given(atJoin()),
      phone(Message.UpdatedUrl({ value: 'https://shop.example' })),
      phone(Message.SubmittedUrl()),
      model(next => {
        expect(
          Option.map(currentPage(contextOf(next, 'phone')), page => page.view),
        ).toMatchObject(
          Option.some({ _tag: 'Error', code: 'ERR_INTERNET_DISCONNECTED' }),
        )
      }),
    )
  })

  test('the ghost points at the next move; show solution replays it through the journal', () => {
    const replayStep = Command.resolve(
      Player.WaitBeforeReplayStep,
      Player.Message.CompletedWaitBeforeReplayStep(),
    )
    story(
      update,
      given(atJoin()),
      ...Array.makeBy(3, () => message(Player.Message.ClickedHint())),
      model(next => {
        expect(ghostKeys(contextOf(next, 'phone'))).toEqual([
          'app:settings',
          `network:${HOME}`,
        ])
      }),
      phone(Message.ClickedNetwork({ ssid: HOME })),
      phone(Message.UpdatedWifiPassword({ value: HOME_PASSWORD })),
      phone(Message.SubmittedWifiPassword()),
      model(next => {
        expect(ghostKeys(contextOf(next, 'phone'))).toEqual([
          'app:browser',
          'url',
        ])
      }),
      message(Player.Message.ClickedReset()),
      message(Player.Message.ClickedShowSolution()),
      replayStep,
      replayStep,
      replayStep,
      model(next => {
        expect(logOf(next, 'join')).toEqual([
          joinWifi('phone', HOME, HOME_PASSWORD),
          send(shopPage('phone')),
        ])
        expect(Player.taskStateOf(next, 'join').check).toEqual(
          Player.CheckState.Solved({ withHint: true }),
        )
        expect(
          Option.map(currentPage(contextOf(next, 'phone')), page => page.view),
        ).toMatchObject(Option.some({ _tag: 'Page', secure: true }))
      }),
    )
  })

  test('a quiz picture is a mini browser screen', () => {
    const ui = uiFor('ru')
    expect(
      Option.isSome(
        browserPicture(
          screenPicture('ERR_CONNECTION_REFUSED', 'localhost:5173'),
          ui,
          ih,
        ),
      ),
    ).toBe(true)
    expect(
      Option.isSome(browserPicture(screenPicture('page', 'x'), ui, ih)),
    ).toBe(true)
    expect(Option.isSome(browserPicture('browser NOPE x', ui, ih))).toBe(false)
    expect(Option.isSome(browserPicture('board x', ui, ih))).toBe(false)
  })
})

describe('network details', () => {
  test('DNS «automatic» is one move; the ghost leads to it', () => {
    story(
      update,
      given(atDns()),
      ...Array.makeBy(3, () => message(Player.Message.ClickedHint())),
      model(next => {
        expect(ghostKeys(contextOf(next, 'phone'))).toEqual([
          'app:settings',
          'info',
          'dns',
          'dns-mode:auto',
        ])
        expect(dnsSettings(contextOf(next, 'phone'))).toEqual(
          Option.some({ isManual: true, servers: [] }),
        )
      }),
      dnsPhone(Message.ClickedPage({ page: 'info' })),
      dnsPhone(Message.ClickedPage({ page: 'dns' })),
      dnsPhone(Message.SelectedDnsMode({ mode: 'auto' })),
      model(next => {
        expect(logOf(next, 'dns')).toEqual([setDns('phone', { mode: 'auto' })])
        expect(dnsSettings(contextOf(next, 'phone'))).toEqual(
          Option.some({ isManual: false, servers: ['192.0.2.53'] }),
        )
        expect(
          Option.map(screenOf(next, 'wifi:phone'), current => current.page),
        ).toEqual(Option.some('info'))
      }),
    )
  })

  test('DNS «manual»: servers are added to a list and saved as one move', () => {
    story(
      update,
      given(atDns()),
      dnsPhone(Message.ClickedPage({ page: 'dns' })),
      dnsPhone(Message.UpdatedDnsServer({ value: '1.1.1.1' })),
      dnsPhone(Message.SubmittedDnsServer()),
      dnsPhone(Message.UpdatedDnsServer({ value: '192.0.2.53' })),
      dnsPhone(Message.SubmittedDnsServer()),
      dnsPhone(Message.ClickedRemoveDnsServer({ server: '1.1.1.1' })),
      dnsPhone(Message.ClickedSaveDns()),
      model(next => {
        expect(logOf(next, 'dns')).toEqual([
          setDns('phone', { mode: 'manual', servers: ['192.0.2.53'] }),
        ])
      }),
    )
  })

  test('the laptop address is set by hand; the ghost marks only the wrong field', () => {
    story(
      update,
      given(atGateway()),
      ...Array.makeBy(3, () => message(Player.Message.ClickedHint())),
      model(next => {
        expect(ghostKeys(contextOf(next, 'laptop'))).toEqual([
          'app:settings',
          'info',
          'address',
          'address-mode:static',
          'address-field:gateway',
          'address-save',
        ])
      }),
      laptop(Message.ClickedPage({ page: 'address' })),
      model(next => {
        expect(
          Option.flatMap(
            screenOf(next, 'wifi:laptop'),
            current => current.maybeAddressDraft,
          ),
        ).toEqual(
          Option.some({
            mode: 'static',
            ip: '192.168.1.42',
            mask: '255.255.255.0',
            gateway: '192.168.1.254',
            dns: '192.0.2.53',
          }),
        )
      }),
      laptop(
        Message.UpdatedAddressField({ field: 'gateway', value: '192.168.1.1' }),
      ),
      laptop(Message.ClickedSaveAddress()),
      message(Player.Message.ClickedCheck()),
      model(next => {
        expect(logOf(next, 'gateway')).toEqual([
          setStatic('laptop', '192.168.1.42/24', '192.168.1.1', '192.0.2.53'),
        ])
        expect(Player.taskStateOf(next, 'gateway').check).toEqual(
          Player.CheckState.Solved({ withHint: false }),
        )
      }),
    )
  })

  test('a gateway outside the home network is refused with the model’s reason', () => {
    story(
      update,
      given(atGateway()),
      laptop(Message.ClickedPage({ page: 'address' })),
      laptop(
        Message.UpdatedAddressField({ field: 'gateway', value: '203.0.113.1' }),
      ),
      laptop(Message.ClickedSaveAddress()),
      Command.resolve(
        Player.WaitBeforeHidingToast,
        Player.Message.CompletedWaitBeforeHidingToast({ serial: 1 }),
      ),
      model(next => {
        expect(logOf(next, 'gateway')).toEqual([])
      }),
    )
  })
})
