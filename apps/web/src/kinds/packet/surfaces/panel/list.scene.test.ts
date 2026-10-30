import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  change,
  click,
  expect,
  expectOutMessage,
  given,
  label,
  role,
  scene,
  text,
  type,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import { uiFor } from '../../../../i18n/ui'
import { macFromId } from '../../../../net/address'
import { reserve } from '../../../../net/build'
import { SurfaceOutMessage } from '../../../contract'
import * as Panel from './panel'
import { routerPanel } from './router'
import { kitchen, surfaceFor } from './testing'

// Вид компонента панели без плеера: вкладки по unlocks с меткой «новое»,
// список строк («Добавить», ячейки с подписями, «×»), проверка ячейки и
// «Сохранить» → операции.

const surface = surfaceFor(kitchen, {
  unlocked: ['router.wifi', 'router.addresses'],
  newFeatures: ['router.addresses'],
})

const input = { definition: routerPanel, surface }

const panelScene = {
  update: Panel.update(input),
  view: (model: Panel.Model, h: HtmlBuilder<Panel.Message>) =>
    Panel.view(
      {
        ...input,
        locale: 'en',
        strings: uiFor('en').panel,
        newBadge: uiFor('en').board.newBadge,
      },
      model,
      message => message,
      h,
    ),
}

describe('settings panel view', () => {
  test('only unlocked tabs are shown; the newly opened one has the badge', () => {
    scene(
      panelScene,
      given(Panel.initialModel),
      expect(role('tab', { name: 'Wi-Fi' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(role('tab', { name: 'Addresses new' })).toExist(),
      expect(role('tab', { name: /Devices/ })).toBeAbsent(),
      expect(role('tab', { name: /Ports/ })).toBeAbsent(),
    )
  })

  test('a reservation row: add, fill in, save; a bad address stays on the cell', () => {
    scene(
      panelScene,
      given(Panel.initialModel),
      click(role('tab', { name: 'Addresses new' })),
      expect(label('Hand out addresses from')).toHaveValue('192.168.1.100'),
      expect(label('IP address, row 1')).toHaveValue('192.168.1.42'),
      click(role('button', { name: '+ Add' })),
      change(label('Device, row 2'), macFromId('printer')),
      type(label('IP address, row 2'), '192.168.1.5o'),
      click(role('button', { name: 'Save' })),
      expect(label('IP address, row 2')).toHaveAttr('aria-invalid', 'true'),
      expect(
        text(
          '“192.168.1.5o” is not an address: it needs four numbers from 0 to 255 separated by dots.',
        ),
      ).toExist(),
      type(label('IP address, row 2'), '192.168.1.50'),
      click(role('button', { name: 'Save' })),
      expectOutMessage(
        SurfaceOutMessage.ProducedOps([
          reserve('router', macFromId('printer'), '192.168.1.50'),
        ]),
      ),
    )
  })

  test('removing the only row leaves an empty list', () => {
    scene(
      panelScene,
      given({ ...Panel.initialModel, maybeTab: Option.some('addresses') }),
      click(role('button', { name: 'Remove row 1' })),
      expect(text('Nothing here yet.')).toExist(),
      expect(role('button', { name: 'Save' })).toBeEnabled(),
    )
  })
})
