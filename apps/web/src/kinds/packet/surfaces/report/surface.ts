import { Option } from 'effect'
import { Update } from 'foldkit'

import type { SurfaceDefinition } from '../../../contract'
import { SurfaceMessage, SurfaceState } from '../../../state'
import type { PacketTypes } from '../../../types'
import type * as ReportMessage from './message'
import * as Report from './report'
import * as ReportView from './view'

// Поверхность `report`: отчёт для ИИ-ассистента (урок 15).

const read = (state: SurfaceState): Option.Option<Report.Model> =>
  state._tag === 'ReportSurface' ? Option.some(state.model) : Option.none()

const toSurfaceMessage = (message: ReportMessage.Message): SurfaceMessage =>
  SurfaceMessage.GotReportSurfaceMessage({ message })

export const reportSurface: SurfaceDefinition<PacketTypes> = {
  type: 'report',
  feature: 'report',
  init: () => SurfaceState.ReportSurface({ model: Report.initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotReportSurfaceMessage'
      ? Update.foldChild({
          update: Report.update(context),
          read,
          write: (_state: SurfaceState, model: Report.Model): SurfaceState =>
            SurfaceState.ReportSurface({ model }),
          toParentMessage: toSurfaceMessage,
          toParentOutMessage: (outMessage: Report.OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: ReportView.tabLabel,
  view: (slot, h) =>
    Option.match(read(slot.state), {
      onNone: () => h.empty,
      onSome: model =>
        ReportView.view(
          model,
          slot.context,
          { ui: slot.ui, renderMessage: slot.renderMessage },
          message => slot.toParentMessage(toSurfaceMessage(message)),
          h,
        ),
    }),
}
