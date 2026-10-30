import { Option } from 'effect'
import { Update } from 'foldkit'

import type { SurfaceDefinition } from '../../../contract'
import { SurfaceMessage, SurfaceState } from '../../../state'
import type { PacketTypes } from '../../../types'
import type * as TerminalMessage from './message'
import * as Terminal from './terminal'
import * as TerminalView from './view'

// Поверхность `terminal:<устройство>`: терминал ноутбука, сервера (вход по
// ssh, консоль хостинга) или любого другого хоста.

const read = (state: SurfaceState): Option.Option<Terminal.Model> =>
  state._tag === 'TerminalSurface' ? Option.some(state.model) : Option.none()

const toSurfaceMessage = (message: TerminalMessage.Message): SurfaceMessage =>
  SurfaceMessage.GotTerminalSurfaceMessage({ message })

export const terminalSurface: SurfaceDefinition<PacketTypes> = {
  type: 'terminal',
  feature: 'terminal',
  init: () => SurfaceState.TerminalSurface({ model: Terminal.initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotTerminalSurfaceMessage'
      ? Update.foldChild({
          update: Terminal.update(context),
          read,
          write: (_state: SurfaceState, model: Terminal.Model): SurfaceState =>
            SurfaceState.TerminalSurface({ model }),
          toParentMessage: toSurfaceMessage,
          toParentOutMessage: (outMessage: Terminal.OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: TerminalView.tabLabel,
  view: (slot, h) =>
    Option.match(read(slot.state), {
      onNone: () => h.empty,
      onSome: model =>
        TerminalView.view(
          model,
          slot.context,
          { ui: slot.ui, renderMessage: slot.renderMessage },
          message => slot.toParentMessage(toSurfaceMessage(message)),
          h,
        ),
    }),
}
