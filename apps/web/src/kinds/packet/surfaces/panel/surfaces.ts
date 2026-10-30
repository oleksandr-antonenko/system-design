import { Option } from 'effect'
import { Update } from 'foldkit'

import type { SurfaceDefinition } from '../../../contract'
import { SurfaceMessage, SurfaceState } from '../../../state'
import type { PacketTypes } from '../../../types'
import * as Panel from './panel'
import { routerPanel } from './router'
import type { PanelDefinition } from './schema'

// Панели настроек как поверхности задачи (design D5 extract-board-kind):
// у всех панелей одно состояние `PanelSurface` в общем union, а различаются
// они описанием `PanelDefinition`.

const readPanel = (state: SurfaceState): Option.Option<Panel.Model> =>
  state._tag === 'PanelSurface' ? Option.some(state.model) : Option.none()

const toPanelMessage = (message: Panel.Message): SurfaceMessage =>
  SurfaceMessage.GotPanelSurfaceMessage({ message })

export const panelSurface = (
  definition: PanelDefinition,
): SurfaceDefinition<PacketTypes> => ({
  type: definition.type,
  feature: definition.feature,
  init: () => SurfaceState.PanelSurface({ model: Panel.initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotPanelSurfaceMessage'
      ? Update.foldChild({
          update: Panel.update({ definition, surface: context }),
          read: readPanel,
          write: (_state: SurfaceState, model: Panel.Model): SurfaceState =>
            SurfaceState.PanelSurface({ model }),
          toParentMessage: toPanelMessage,
          toParentOutMessage: (outMessage: Panel.OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: (context, ui) =>
    definition.tabLabel(Panel.panelContext(definition, context), ui.panel),
  view: (slot, h) =>
    Option.match(readPanel(slot.state), {
      onNone: () => h.empty,
      onSome: model =>
        Panel.view(
          {
            definition,
            surface: slot.context,
            locale: slot.locale,
            strings: slot.ui.panel,
            newBadge: slot.ui.board.newBadge,
          },
          model,
          message => slot.toParentMessage(toPanelMessage(message)),
          h,
        ),
    }),
})

/** Панели вида `packet`: id поверхности задачи — `тип[:устройство]`. */
export const panelSurfaces: ReadonlyArray<SurfaceDefinition<PacketTypes>> = [
  panelSurface(routerPanel),
]
