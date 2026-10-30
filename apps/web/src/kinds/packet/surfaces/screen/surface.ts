import { Option } from 'effect'
import { Update } from 'foldkit'

import type { SurfaceDefinition } from '../../../contract'
import { SurfaceMessage, SurfaceState } from '../../../state'
import type { PacketTypes } from '../../../types'
import type * as ScreenMessage from './message'
import * as Screen from './screen'
import * as ScreenView from './view'

// Поверхности `wifi:<устройство>` и `browser:<устройство>` — один экран
// устройства (`screen: 'device'`): если задача объявила обе, у них одна
// вкладка, а внутри экрана переключатель «Настройки» / «Браузер».

const read = (state: SurfaceState): Option.Option<Screen.Model> =>
  state._tag === 'ScreenSurface' ? Option.some(state.model) : Option.none()

const toSurfaceMessage = (message: ScreenMessage.Message): SurfaceMessage =>
  SurfaceMessage.GotScreenSurfaceMessage({ message })

const screenSurface = (
  type: 'wifi' | 'browser',
  app: ScreenMessage.App,
): SurfaceDefinition<PacketTypes> => ({
  type,
  feature: type,
  screen: 'device',
  init: () => SurfaceState.ScreenSurface({ model: Screen.initialModel(app) }),
  update: context => (state, message) =>
    message._tag === 'GotScreenSurfaceMessage'
      ? Update.foldChild({
          update: Screen.update(context),
          read,
          write: (_state: SurfaceState, model: Screen.Model): SurfaceState =>
            SurfaceState.ScreenSurface({ model }),
          toParentMessage: toSurfaceMessage,
          toParentOutMessage: (outMessage: Screen.OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: ScreenView.tabLabel,
  view: (slot, h) =>
    Option.match(read(slot.state), {
      onNone: () => h.empty,
      onSome: model =>
        ScreenView.view(
          model,
          slot.context,
          app,
          { ui: slot.ui, renderMessage: slot.renderMessage },
          message => slot.toParentMessage(toSurfaceMessage(message)),
          h,
        ),
    }),
})

/** Настройки сети устройства: Wi-Fi, сведения о сети, DNS, адрес. */
export const wifiSurface = screenSurface('wifi', 'settings')

/** Браузер устройства: страница, адресная строка, экраны ошибок. */
export const browserSurface = screenSurface('browser', 'browser')
