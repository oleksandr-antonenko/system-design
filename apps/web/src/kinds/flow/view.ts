import { Array, Option, Schema } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { type BoardViewInputs, view as editorView } from '../../board/view'
import type { BoardDoc } from '../../domain/board'
import {
  type ComponentKind,
  ComponentKind as ComponentKindSchema,
} from '../../domain/catalog'
import type { SimResult } from '../../domain/simulate'
import type { UiStrings } from '../../i18n/ui'
import { type Anim, shownSimulation } from '../../lesson/anim'
import { ghostPlan } from '../../lesson/ghost'
import type { BoardSlot, Tone } from '../contract'
import type { FlowTypes } from '../types'
import { Message } from './message'
import { resolveTarget } from './target'

type Slot<ParentMessage> = BoardSlot<FlowTypes, ParentMessage>

const isComponentKind = Schema.is(ComponentKindSchema)

// BOARD

const toneOf = (
  tone: Tone | ((sim: SimResult) => Tone),
  sim: SimResult,
): Tone => (typeof tone === 'function' ? tone(sim) : tone)

export const boardInputs = <ParentMessage>(
  slot: Slot<ParentMessage>,
): BoardViewInputs => {
  const { context } = slot
  const doc = context.doc
  const steady = context.run
  const stageHalos = Array.getSomes(
    Array.map(context.stage, item =>
      item._tag === 'Highlight'
        ? Option.map(resolveTarget(doc, item.target), id => ({
            id,
            tone: item.tone,
          }))
        : Option.none(),
    ),
  )
  const focusHalos = Option.match(context.maybeTask, {
    onNone: () => [],
    onSome: ({ focusNodes }) =>
      Array.map(focusNodes, (id): Readonly<{ id: string; tone: Tone }> => ({
        id,
        tone: 'bad',
      })),
  })
  const annotations = Array.getSomes(
    Array.map(context.stage, item =>
      item._tag === 'Annotate'
        ? Option.map(resolveTarget(doc, item.target), id => ({
            id,
            text: context.annotationText(item.key),
            tone: toneOf(item.tone, steady),
          }))
        : Option.none(),
    ),
  )
  const ghost = Option.flatMap(context.maybeTask, task =>
    task.isGhostShown
      ? Option.some(ghostPlan(doc, task.solution))
      : Option.none(),
  )
  const anim = slot.model.anim

  return {
    locale: context.locale,
    doc,
    mode: context.mode,
    palette: context.palette,
    newKinds: Array.filter(context.newPalette, isComponentKind),
    later: Array.getSomes(
      Array.map(context.laterPalette, ({ kind, lesson }) =>
        isComponentKind(kind) ? Option.some({ kind, lesson }) : Option.none(),
      ),
    ),
    halos: [...stageHalos, ...focusHalos],
    annotations,
    focusEdges: Option.match(context.maybeTask, {
      onNone: () => [],
      onSome: ({ focusEdges }) => focusEdges,
    }),
    ghost,
    maybeHoveredRef: context.maybeHoveredRef,
    flows: {
      clock: anim.clock,
      nodeUtil: anim.nodeUtil,
      nodeIncoming: anim.nodeIncoming,
      edgeFlow: anim.edgeFlow,
    },
    sim: shownSimulation(anim, doc),
    prefersDark: context.prefersDark,
    isReducedMotion: context.isReducedMotion,
    ...Option.match(context.maybeQuiz, {
      onNone: () => ({}),
      onSome: quiz => ({ pick: quiz }),
    }),
  }
}

export const view = <ParentMessage>(
  slot: Slot<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.submodel({
    slotId: 'board',
    model: slot.model.editor,
    view: editorView,
    toParentMessage: message =>
      slot.toParentMessage(Message.GotEditorMessage({ message })),
    viewInputs: boardInputs(slot),
  })

// INSTRUMENTS

const sparkView = <ParentMessage>(
  values: ReadonlyArray<number>,
  max: number,
  className: string,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.svg(
    [h.ViewBox('0 0 76 22'), h.Class('spark'), h.AriaHidden(true)],
    [
      h.polyline([
        h.Class(className),
        h.Points(
          Array.map(
            values,
            (value, index) =>
              `${((index / 89) * 76).toFixed(1)},${(21 - Math.min(value / max, 1) * 19).toFixed(1)}`,
          ).join(' '),
        ),
      ]),
    ],
  )

const hasAnyKind = (
  doc: BoardDoc,
  kinds: ReadonlyArray<ComponentKind>,
): boolean => Array.some(doc.nodes, node => Array.contains(kinds, node.kind))

export type ExtraMetric = Readonly<{ label: string; value: string }>

/** Приборы, которые есть не на каждой доске: «отклонено» — когда стоит
    ограничитель, «очередь растёт» — когда есть очередь или шина (D4, D3). */
export const extraMetrics = (
  doc: BoardDoc,
  anim: Anim,
  ui: UiStrings,
): ReadonlyArray<ExtraMetric> => [
  ...(hasAnyKind(doc, ['limiter'])
    ? [{ label: ui.hud.rejected, value: ui.hud.rps(anim.hudRejected) }]
    : []),
  ...(hasAnyKind(doc, ['queue', 'events'])
    ? [{ label: ui.hud.backlog, value: ui.hud.growth(anim.hudBacklog) }]
    : []),
]

export const instruments = <ParentMessage>(
  slot: Slot<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { context } = slot
  const ui = context.ui
  const anim = slot.model.anim
  const errorClass =
    anim.hudErrorRate > 0.05
      ? 'value bad'
      : anim.hudErrorRate > 0.01
        ? 'value warn'
        : 'value'
  const p95 = Option.getOrElse(anim.hudP95, () => 0)
  const p95Class = p95 > 600 ? 'value bad' : p95 > 250 ? 'value warn' : 'value'

  return h.section(
    [h.AriaLabel(ui.lesson.instrumentsRegion), h.Class('hud')],
    [
      h.div(
        [h.Class('metrics')],
        [
          h.div(
            [h.Class('metric')],
            [
              h.span([h.Class('label')], [ui.hud.load]),
              h.span([h.Class('value')], [ui.hud.rps(anim.hudLoad)]),
            ],
          ),
          h.div(
            [h.Class('metric')],
            [
              h.span([h.Class('label')], [ui.hud.errors]),
              h.span(
                [h.Class(errorClass)],
                [ui.hud.percent(anim.hudErrorRate)],
              ),
              sparkView(anim.sparkErrors, 0.6, 'spark-errors', h),
            ],
          ),
          h.div(
            [h.Class('metric')],
            [
              h.span([h.Class('label')], [ui.hud.p95]),
              h.span(
                [h.Class(p95Class)],
                [
                  Option.match(anim.hudP95, {
                    onNone: () => '—',
                    onSome: ui.hud.ms,
                  }),
                ],
              ),
              sparkView(anim.sparkP95, 1400, 'spark-p95', h),
            ],
          ),
          h.div(
            [h.Class('metric')],
            [
              h.span([h.Class('label')], [ui.hud.database]),
              h.span([h.Class('value')], [ui.hud.rps(anim.hudDatabase)]),
            ],
          ),
          ...Array.map(
            extraMetrics(context.doc, anim, ui),
            ({ label, value }) =>
              h.keyed('div')(
                label,
                [h.Class('metric')],
                [
                  h.span([h.Class('label')], [label]),
                  h.span([h.Class('value')], [value]),
                ],
              ),
          ),
          h.div(
            [h.Class('metric')],
            [
              h.span([h.Class('label')], [ui.hud.cost]),
              h.span(
                [h.Class('value')],
                [
                  ui.hud.perHour(
                    shownSimulation(anim, context.doc).costPerHour,
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('controls')],
        [
          h.button(
            [
              h.Type('button'),
              h.Class('btn'),
              h.AriaPressed(anim.isRunning ? 'false' : 'true'),
              h.OnClick(slot.toParentMessage(Message.ClickedPlayPause())),
            ],
            [anim.isRunning ? `❚❚ ${ui.hud.pause}` : `▶ ${ui.hud.play}`],
          ),
          h.div(
            [h.Class('segmented'), h.Role('group'), h.AriaLabel(ui.hud.speed)],
            Array.map([1, 2, 4], speed =>
              h.keyed('button')(
                `speed-${speed}`,
                [
                  h.Type('button'),
                  h.AriaPressed(anim.speed === speed ? 'true' : 'false'),
                  h.OnClick(
                    slot.toParentMessage(Message.ClickedSpeed({ speed })),
                  ),
                ],
                [`×${speed}`],
              ),
            ),
          ),
          h.span([h.Class('separator'), h.AriaHidden(true)]),
          ...slot.controls(),
        ],
      ),
      h.div(
        [h.Class('legend')],
        [
          h.span([], [h.i([h.Class('dot ok')]), ui.hud.legendOk]),
          h.span([], [h.i([h.Class('dot warn')]), ui.hud.legendHot]),
          h.span([], [h.i([h.Class('dot bad')]), ui.hud.legendLost]),
          h.span([h.Class('model-note')], [ui.hud.modelNote]),
        ],
      ),
    ],
  )
}
