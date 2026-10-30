import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { UiStrings } from '../../../../i18n/ui'
import { browse } from '../../../../net/browser'
import { isSymptomGone } from '../../../../net/goals'
import type { NetMessage } from '../../../../net/message'
import { Fault } from '../../../../net/model'
import { sourceOf } from '../../../../net/packet'
import type { SurfaceContext } from '../../../contract'
import type { PacketTypes } from '../../../types'
import { nameOf } from '../history'
import { Message } from './message'
import {
  REPLY_ID,
  type Model,
  type RanCommand,
  type ReportGoal,
  commandsOf,
  isSameLine,
  replyOf,
  reportGoalOf,
  symptomWorld,
} from './report'

// VIEW

type Context = SurfaceContext<PacketTypes>

type Render<ParentMessage> = Readonly<{
  ui: UiStrings
  renderMessage: (message: NetMessage) => string
  send: (message: Message) => ParentMessage
  h: HtmlBuilder<ParentMessage>
}>

export const tabLabel = (_context: Context, ui: UiStrings): string =>
  ui.device.reportTab

/** «Что не работает»: устройство, адрес и код ошибки браузера сейчас. */
const symptomView = <ParentMessage>(
  context: Context,
  goal: ReportGoal,
  { ui, h }: Render<ParentMessage>,
): Html => {
  const symptom = goal.symptom
  const device = nameOf(context.label, sourceOf(symptom))
  const url =
    symptom._tag === 'Browse' || symptom._tag === 'Fetch' ? symptom.url : ''
  const broken = symptomWorld(context, goal)
  const browsed = browse(broken.doc, broken.state, sourceOf(symptom), url)
  const isGone = isSymptomGone(context.doc.doc, context.doc.state, symptom)
  return h.div(
    [h.Class('report-row')],
    [
      h.p([h.Class('report-label')], [ui.device.reportWhat]),
      h.p(
        [h.Class('report-symptom')],
        [
          ui.device.reportSymptom(device, url),
          ...(browsed.view._tag === 'Error'
            ? [' — ', h.code([], [browsed.view.code])]
            : []),
        ],
      ),
      ...(isGone
        ? [h.p([h.Class('report-symptom is-gone')], [ui.device.reportFixedNow])]
        : []),
    ],
  )
}

const commandView = <ParentMessage>(
  context: Context,
  model: Model,
  command: RanCommand,
  index: number,
  { send, h }: Render<ParentMessage>,
): Html => {
  const isEditable = context.mode === 'Edit'
  return h.keyed('div')(
    `command-${index}`,
    [h.Class('report-command')],
    [
      h.p(
        [h.Class('report-prompt')],
        [
          h.span(
            [h.Class('report-device')],
            [nameOf(context.label, command.device)],
          ),
          ` $ ${command.line}`,
        ],
      ),
      ...Array.map(
        Array.filter(command.lines, line => line.text.trim() !== ''),
        (line, lineIndex) => {
          const isPicked = Array.some(model.evidence, picked =>
            isSameLine(picked, line),
          )
          return h.keyed('button')(
            `line-${index}-${lineIndex}`,
            [
              h.Type('button'),
              h.Class(`report-line${isPicked ? ' picked' : ''}`),
              h.AriaPressed(isPicked ? 'true' : 'false'),
              ...(isEditable
                ? [
                    h.OnClick(
                      send(
                        Message.ToggledLine({ text: line.text, tag: line.tag }),
                      ),
                    ),
                  ]
                : [h.Disabled(true)]),
            ],
            [line.text],
          )
        },
      ),
    ],
  )
}

const evidenceView = <ParentMessage>(
  context: Context,
  model: Model,
  render: Render<ParentMessage>,
): Html => {
  const { ui, h } = render
  return h.div(
    [h.Class('report-row')],
    [
      h.p([h.Class('report-label')], [ui.device.reportEvidence]),
      h.p([h.Class('report-hint')], [ui.device.reportEvidenceHint]),
      Array.match(commandsOf(context), {
        onEmpty: () =>
          h.p([h.Class('report-empty')], [ui.device.reportNoOutput]),
        onNonEmpty: commands =>
          h.div(
            [
              h.Class('report-log'),
              h.Role('group'),
              h.AriaLabel(ui.device.reportEvidence),
            ],
            Array.map(commands, (command, index) =>
              commandView(context, model, command, index, render),
            ),
          ),
      }),
      h.p(
        [h.Class('report-hint'), h.AriaLive('polite')],
        [ui.device.reportPicked(model.evidence.length)],
      ),
    ],
  )
}

const faultsView = <ParentMessage>(
  context: Context,
  model: Model,
  { ui, send, h }: Render<ParentMessage>,
): Html => {
  const isEditable = context.mode === 'Edit'
  return h.div(
    [h.Class('report-row')],
    [
      h.p(
        [h.Class('report-label'), h.Id('report-where')],
        [ui.device.reportWhere],
      ),
      h.div(
        [
          h.Class('report-faults'),
          h.Role('radiogroup'),
          h.AriaLabelledBy('report-where'),
        ],
        Array.map(Fault.literals, fault => {
          const isChosen = Option.exists(
            model.maybeFault,
            chosen => chosen === fault,
          )
          return h.keyed('button')(
            `fault-${fault}`,
            [
              h.Type('button'),
              h.Role('radio'),
              h.AriaChecked(isChosen),
              h.Class(`report-fault${isChosen ? ' chosen' : ''}`),
              ...(isEditable
                ? [h.OnClick(send(Message.SelectedFault({ fault })))]
                : [h.Disabled(true)]),
            ],
            [
              h.span([h.Class('report-radio'), h.AriaHidden(true)]),
              ui.device.reportFaults[fault],
            ],
          )
        }),
      ),
    ],
  )
}

const replyView = <ParentMessage>(
  context: Context,
  { ui, renderMessage, send, h }: Render<ParentMessage>,
): ReadonlyArray<Html> =>
  Option.match(replyOf(context), {
    onNone: () => [],
    onSome: reply => [
      h.div(
        [
          h.Id(REPLY_ID),
          h.Class(
            `report-reply${
              reply.message._tag === 'ReportAccepted' ||
              reply.message._tag === 'ReportConfirmed'
                ? ' accepted'
                : ''
            }`,
          ),
          h.Role('status'),
        ],
        [
          h.p([h.Class('report-label')], [ui.device.reportReply]),
          h.p([h.Class('report-answer')], [renderMessage(reply.message)]),
          ...(reply.isApplied
            ? [h.p([h.Class('report-hint')], [ui.device.reportApplied])]
            : []),
          ...(reply.canApply && context.mode === 'Edit'
            ? [
                h.button(
                  [
                    h.Type('button'),
                    h.Class('btn primary'),
                    h.OnClick(send(Message.ClickedApply())),
                  ],
                  [ui.device.reportApply],
                ),
              ]
            : []),
        ],
      ),
    ],
  })

export const view = <ParentMessage>(
  model: Model,
  context: Context,
  render: Readonly<{
    ui: UiStrings
    renderMessage: (message: NetMessage) => string
  }>,
  toParentMessage: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const parts: Render<ParentMessage> = {
    ...render,
    send: toParentMessage,
    h,
  }
  const { ui } = render
  const canSend =
    context.mode === 'Edit' &&
    Option.isSome(model.maybeFault) &&
    Array.isReadonlyArrayNonEmpty(model.evidence)
  return h.section(
    [h.Class('report-card'), h.AriaLabel(ui.device.reportTitle)],
    [
      h.h3([h.Class('report-title')], [ui.device.reportTitle]),
      ...Option.match(reportGoalOf(context.goals), {
        onNone: () => [],
        onSome: goal => [symptomView(context, goal, parts)],
      }),
      evidenceView(context, model, parts),
      faultsView(context, model, parts),
      h.div(
        [h.Class('report-actions')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('btn primary'),
              ...(canSend
                ? [h.OnClick(toParentMessage(Message.ClickedSend()))]
                : [h.Disabled(true)]),
            ],
            [ui.device.reportSend],
          ),
        ],
      ),
      ...replyView(context, parts),
    ],
  )
}
