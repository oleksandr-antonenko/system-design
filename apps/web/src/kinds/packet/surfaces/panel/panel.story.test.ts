import { Array, Option, Record } from 'effect'
import {
  expectNoOutMessage,
  expectOutMessage,
  given,
  message,
  model,
  story,
} from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { macFromId } from '../../../../net/address'
import { configureWifi, reserve, wifi } from '../../../../net/build'
import { NetMessage } from '../../../../net/message'
import { SurfaceOutMessage } from '../../../contract'
import * as Panel from './panel'
import { routerPanel } from './router'
import { PanelProblem, problemAt, values } from './schema'
import {
  PASSWORD,
  SSID,
  dualBand,
  kitchen,
  kitchenOps,
  surfaceFor,
  worldOf,
} from './testing'

// Компонент панели на уровне update: черновик, «Сохранить» → операции,
// проверка ввода кодами модели, «Отменить», призрак и вкладки по unlocks.

const input = (overrides: Parameters<typeof surfaceFor>[1] = {}) => ({
  definition: routerPanel,
  surface: surfaceFor(kitchen, overrides),
})

const update = Panel.update(input())

const context = Option.getOrThrow(
  Panel.panelContext(routerPanel, surfaceFor(kitchen)),
)

const wifiTab = Option.getOrThrow(
  Panel.activeTab(routerPanel, Panel.initialModel, ['router.wifi']),
)

const field = (name: string, value: string) =>
  message(Panel.Message.UpdatedField({ field: name, value }))

const save = message(Panel.Message.SubmittedPanel())

describe('settings panel: router Wi-Fi tab', () => {
  test('fields show the router settings from the document', () => {
    expect(Panel.shownValues(wifiTab, context, Panel.initialModel)).toEqual(
      values({
        ssid: SSID,
        password: PASSWORD,
        security: 'secured',
        band: '5',
      }),
    )
  })

  test('save turns the draft into the matching configureWifi op', () => {
    story(
      update,
      given(Panel.initialModel),
      field('band', 'dual'),
      model(next => {
        expect(Panel.shownValues(wifiTab, context, next).fields['band']).toBe(
          'dual',
        )
      }),
      save,
      expectOutMessage(SurfaceOutMessage.ProducedOps([dualBand])),
      model(next => {
        expect(next.drafts).toEqual({})
        expect(next.maybeSavedTab).toEqual(Option.some('wifi'))
      }),
    )
  })

  test('the hidden channel follows the band: 5 GHz keeps 36, 2.4 GHz gets 6', () => {
    story(
      update,
      given(Panel.initialModel),
      field('band', '2.4'),
      save,
      expectOutMessage(
        SurfaceOutMessage.ProducedOps([
          configureWifi(
            'router',
            wifi(SSID, PASSWORD, { band: '2.4', channel: 6 }),
          ),
        ]),
      ),
    )
  })

  test('"No password" saves an open network', () => {
    story(
      update,
      given(Panel.initialModel),
      field('security', 'open'),
      save,
      expectOutMessage(
        SurfaceOutMessage.ProducedOps([
          configureWifi(
            'router',
            wifi(SSID, PASSWORD, {
              security: 'open',
              band: '5',
              channel: 36,
            }),
          ),
        ]),
      ),
    )
  })

  test('a short password comes back as the model refusal on its field', () => {
    story(
      update,
      given(Panel.initialModel),
      field('password', '1234'),
      save,
      expectNoOutMessage(),
      model(next => {
        expect(
          Option.map(Record.get(next.drafts, 'wifi'), draft => draft.problems),
        ).toEqual(
          Option.some([
            problemAt(
              'password',
              PanelProblem.Refused({
                message: NetMessage.WifiPasswordTooShort({ min: 8 }),
              }),
            ),
          ]),
        )
      }),
      field('password', '12345678'),
      model(next => {
        expect(
          Option.map(Record.get(next.drafts, 'wifi'), draft => draft.problems),
        ).toEqual(Option.some([]))
      }),
    )
  })

  test('an empty network name is refused on the name field', () => {
    story(
      update,
      given(Panel.initialModel),
      field('ssid', ''),
      save,
      expectNoOutMessage(),
      model(next => {
        expect(
          Option.map(Record.get(next.drafts, 'wifi'), draft => draft.problems),
        ).toEqual(
          Option.some([
            problemAt(
              'ssid',
              PanelProblem.Refused({ message: NetMessage.EmptySsid() }),
            ),
          ]),
        )
      }),
    )
  })

  test('cancel throws the draft away', () => {
    story(
      update,
      given(Panel.initialModel),
      field('ssid', 'Kitchen'),
      message(Panel.Message.ClickedCancel()),
      model(next => {
        expect(next.drafts).toEqual({})
        expect(Panel.shownValues(wifiTab, context, next).fields['ssid']).toBe(
          SSID,
        )
      }),
      save,
      expectNoOutMessage(),
    )
  })

  test('save without changes produces nothing', () => {
    story(
      update,
      given(Panel.initialModel),
      field('band', '5'),
      save,
      expectNoOutMessage(),
    )
  })

  test('outside the open task the panel only shows', () => {
    story(
      Panel.update(input({ mode: 'View' })),
      given(Panel.initialModel),
      field('band', 'dual'),
      model(next => {
        expect(next.drafts).toEqual({})
      }),
    )
  })

  test('a draft goes stale when the document moves (undo, reset, solution)', () => {
    const edited = update(
      Panel.initialModel,
      Panel.Message.UpdatedField({
        field: 'band',
        value: '2.4',
      }),
    ).model
    const solved = Option.getOrThrow(
      Panel.panelContext(
        routerPanel,
        surfaceFor(worldOf([...kitchenOps, dualBand])),
      ),
    )
    expect(Panel.shownValues(wifiTab, context, edited).fields['band']).toBe(
      '2.4',
    )
    expect(Panel.shownValues(wifiTab, solved, edited).fields['band']).toBe(
      'dual',
    )
  })

  test('the ghost frames the band field only, without its value', () => {
    expect(Panel.ghostPaths(wifiTab, context, Option.some([dualBand]))).toEqual(
      ['band'],
    )
    expect(Panel.ghostPaths(wifiTab, context, Option.none())).toEqual([])
  })

  test('the ghost skips read-only tables: a reservation frames the list, not the devices', () => {
    const tabOf = (id: string) =>
      Option.getOrThrow(
        Array.findFirst(routerPanel.tabs, candidate => candidate.id === id),
      )
    const reservePrinter = Option.some([
      reserve('router', macFromId('printer'), '192.168.1.50'),
    ])
    expect(
      Panel.ghostPaths(tabOf('addresses'), context, reservePrinter),
    ).toEqual(['reservations'])
    expect(Panel.ghostPaths(tabOf('devices'), context, reservePrinter)).toEqual(
      [],
    )
  })

  test('tabs are hidden until the course unlocks them', () => {
    expect(
      Panel.visibleTabs(routerPanel, ['router.wifi']).map(tab => tab.id),
    ).toEqual(['wifi'])
    expect(
      Panel.visibleTabs(routerPanel, ['router.wifi', 'router.devices']).map(
        tab => tab.id,
      ),
    ).toEqual(['wifi', 'devices'])
    expect(Panel.visibleTabs(routerPanel, [])).toEqual([])
  })

  test('a chosen tab that is not open falls back to the first open one', () => {
    expect(
      Option.map(
        Panel.activeTab(
          routerPanel,
          { ...Panel.initialModel, maybeTab: Option.some('devices') },
          ['router.wifi'],
        ),
        tab => tab.id,
      ),
    ).toEqual(Option.some('wifi'))
  })
})

describe('settings panel: router devices tab', () => {
  const devicesTab = Option.getOrThrow(
    Panel.activeTab(
      routerPanel,
      { ...Panel.initialModel, maybeTab: Option.some('devices') },
      ['router.wifi', 'router.devices'],
    ),
  )

  test('lists the hosts on the router network with address and link', () => {
    const solved = Option.getOrThrow(
      Panel.panelContext(
        routerPanel,
        surfaceFor(worldOf([...kitchenOps, dualBand])),
      ),
    )
    expect(devicesTab.read(solved).lists['devices']).toEqual([
      {
        id: 'phone',
        cells: {
          name: 'phone',
          ip: '192.168.1.100',
          mac: expect.any(String),
          link: '2.4',
        },
      },
      {
        id: 'laptop',
        cells: {
          name: 'laptop',
          ip: '192.168.1.42',
          mac: '3c:22:fb:4a:10:42',
          link: '5',
        },
      },
      {
        id: 'printer',
        cells: {
          name: 'printer',
          ip: '192.168.1.101',
          mac: expect.any(String),
          link: 'cable',
        },
      },
      {
        id: 'bulb',
        cells: {
          name: 'bulb',
          ip: '192.168.1.102',
          mac: expect.any(String),
          link: '2.4',
        },
      },
    ])
  })
})
