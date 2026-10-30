import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { BoardSlot } from '../contract'
import type { PacketTypes } from '../types'
import { Message } from './message'
import { type Picture, pictureOf } from './picture'
import {
  nextHopStop,
  nextStop,
  previousHopStop,
} from './timeline'

// Транспорт под доской (план 3.1, 3.4): в уроке 1 одна кнопка «Пуск / Ещё
// раз» и строка, где сейчас конверт; с урока 4 «Шаг» и «хоп N из M»; с
// урока 7 шаг назад, к началу, ×¼ и легенда. Неоткрытое не рисуется.

type Slot<ParentMessage> = BoardSlot<PacketTypes, ParentMessage>

type Tone = 'idle' | 'info' | 'ok' | 'bad'

const captionOf = (picture: Picture): Readonly<{ text: string; tone: Tone }> => {
  const ui = picture.context.ui.packetBoard.caption
  const moment = picture.moment
  const name = picture.name
  if (moment._tag === 'Idle') {
    return {
      text: Array.isReadonlyArrayNonEmpty(picture.timeline.walks)
        ? ui.walkIdle
        : Array.isReadonlyArrayNonEmpty(picture.timeline.plays)
          ? ui.idle
          : '',
      tone: 'idle',
    }
  }
  if (moment._tag === 'Walking') {
    return {
      text: ui.walking(
        Option.match(Array.head(picture.timeline.walks), {
          onNone: () => '',
          onSome: walk => name(walk.device),
        }),
      ),
      tone: 'info',
    }
  }
  if (moment._tag === 'Waiting') {
    return { text: ui.waiting(name(moment.leg.from)), tone: 'info' }
  }
  if (moment._tag === 'Flying') {
    const how =
      moment.leg.medium === 'radio'
        ? ui.viaRadio
        : moment.leg.medium === 'cable'
          ? ui.viaCable
          : moment.leg.medium === 'cellular'
            ? ui.viaCellular
            : moment.leg.medium === 'inner'
              ? ui.inside
              : ''
    return {
      text:
        moment.leg.medium === 'inner'
          ? ui.innerHop
          : ui.flying(name(moment.leg.from), name(moment.leg.to), how),
      tone: 'info',
    }
  }
  if (moment._tag === 'Resting') {
    const isPaused = picture.playhead >= picture.model.stopAt
    return {
      text: isPaused
        ? ui.paused(name(moment.leg.to))
        : ui.resting(name(moment.leg.to)),
      tone: 'info',
    }
  }
  if (moment._tag === 'Stuck') {
    return {
      text: Option.match(
        Array.findFirst(picture.timeline.plays, play => Option.isSome(play.maybeDrop)),
        { onNone: () => '', onSome: play => ui.dropped(picture.reason(play.trace)) },
      ),
      tone: 'bad',
    }
  }
  return Option.match(
    Array.findFirst(picture.timeline.plays, play => Option.isSome(play.maybeDrop)),
    {
      onSome: play => ({ text: ui.dropped(picture.reason(play.trace)), tone: 'bad' as const }),
      onNone: () =>
        Option.match(Array.last(picture.timeline.legs), {
          onNone: () => ({ text: '', tone: 'idle' as const }),
          onSome: leg => ({
            text: leg.isReply ? ui.replied(name(leg.to)) : ui.delivered(name(leg.to)),
            tone: 'ok' as const,
          }),
        }),
    },
  )
}

const badge = <ParentMessage>(
  picture: Picture,
  feature: string,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> =>
  picture.isNew(feature)
    ? [h.span([h.Class('pb-new-tag')], [picture.context.ui.packetBoard.newBadge])]
    : []

const toolButton = <ParentMessage>(
  picture: Picture,
  send: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
  feature: string,
  label: string,
  message: Message,
  options: Readonly<{ isPressed?: boolean; isDisabled?: boolean; ariaLabel?: string }> = {},
): ReadonlyArray<Html> =>
  picture.isOpen(feature)
    ? [
        h.button(
          [
            h.Type('button'),
            h.Class(`btn${options.isPressed === true ? ' pressed' : ''}`),
            ...(options.isPressed === undefined ? [] : [h.AriaPressed(options.isPressed ? 'true' : 'false')]),
            ...(options.ariaLabel === undefined ? [] : [h.AriaLabel(options.ariaLabel)]),
            ...(options.isDisabled === true ? [h.Disabled(true)] : [h.OnClick(send(message))]),
          ],
          [label, ...badge(picture, feature, h)],
        ),
      ]
    : []

export const instruments = <ParentMessage>(
  slot: Slot<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const picture = pictureOf(slot.context, slot.model)
  const send = slot.toParentMessage
  const ui = picture.context.ui.packetBoard
  const timeline = picture.timeline
  const total = timeline.totalMs
  const hasTrace = total > 0
  const isHidden = Array.contains(picture.hidden, 'play')
  const isPicking = picture.context.mode === 'Pick'
  const isAtEnd = picture.hasStarted && picture.playhead >= total
  const isMoving = picture.hasStarted && picture.playhead < slot.model.stopAt
  const isPaused = picture.hasStarted && !isMoving && !isAtEnd && picture.playhead > 0
  const runLabel = isAtEnd ? ui.transport.again : isPaused ? ui.transport.resume : ui.transport.run
  const startAt = isAtEnd || !picture.hasStarted ? 0 : picture.playhead
  const canPlay = hasTrace && !isHidden && !isPicking
  const caption = captionOf(picture)
  const counter = Option.match(picture.maybeLeg, {
    onNone: () => [],
    onSome: ({ leg }) =>
      picture.isOpen('transport.hopCounter')
        ? [
            h.span(
              [h.Class('pb-counter')],
              [
                ui.transport.hopOf(
                  leg.isReply ? ui.transport.reply : ui.transport.request,
                  leg.index,
                  leg.count,
                ),
              ],
            ),
          ]
        : [],
  })
  const isCableTool = picture.model.tool._tag === 'Cable'
  return h.section(
    [h.AriaLabel(picture.context.ui.lesson.instrumentsRegion), h.Class('hud pb-transport')],
    [
      h.div(
        [h.Class('pb-transport-row')],
        [
          ...(picture.isOpen('transport.run')
            ? [
                h.button(
                  [
                    h.Type('button'),
                    h.Class(`pb-play${!picture.hasStarted && canPlay && !picture.context.isReducedMotion ? ' nudge' : ''}`),
                    ...(canPlay
                      ? [
                          h.OnClick(
                            send(
                              Message.ClickedRun({
                                startAt,
                                stopAt: nextStop(timeline, startAt),
                                total,
                              }),
                            ),
                          ),
                        ]
                      : [h.Disabled(true)]),
                  ],
                  [`▶ ${runLabel}`, ...(picture.hasStarted ? [] : badge(picture, 'transport.run', h))],
                ),
              ]
            : []),
          ...toolButton(
            picture,
            send,
            h,
            'transport.step',
            `${ui.transport.step} ▸`,
            Message.ClickedStep({
              startAt,
              stopAt: nextHopStop(timeline, startAt),
              total,
            }),
            { isDisabled: !canPlay || isMoving },
          ),
          ...toolButton(
            picture,
            send,
            h,
            'transport.back',
            `◂ ${ui.transport.back}`,
            Message.ClickedBack({
              at: previousHopStop(timeline, picture.playhead),
              total,
            }),
            { isDisabled: !canPlay || !picture.hasStarted },
          ),
          ...toolButton(
            picture,
            send,
            h,
            'transport.restart',
            `|◂ ${ui.transport.restart}`,
            Message.ClickedRestart(),
            { isDisabled: !canPlay || !picture.hasStarted },
          ),
          ...toolButton(
            picture,
            send,
            h,
            'transport.slow',
            ui.transport.slow,
            Message.ClickedSpeed(),
            { isPressed: slot.model.isSlow, ariaLabel: `${ui.transport.speed} ${ui.transport.slow}` },
          ),
          ...toolButton(
            picture,
            send,
            h,
            'board.legend',
            ui.transport.legend,
            Message.ClickedLegend(),
            { isPressed: slot.model.isLegendOpen },
          ),
          ...counter,
          h.p(
            [h.Class(`pb-caption ${caption.tone}`), h.AriaLive('polite')],
            [h.span([h.Class('pb-dot'), h.AriaHidden(true)]), caption.text],
          ),
        ],
      ),
      ...(picture.context.mode === 'Edit' && picture.isOpen('board.cable')
        ? [
            h.div(
              [h.Class('pb-tools')],
              [
                ...toolButton(picture, send, h, 'board.cable', ui.tools.cable, Message.ClickedCableTool(), {
                  isPressed: isCableTool,
                }),
                ...(isCableTool
                  ? [
                      h.span(
                        [h.Class('pb-hint')],
                        [
                          picture.model.tool._tag === 'Cable'
                            ? Option.match(picture.model.tool.maybeFrom, {
                                onNone: () => ui.tools.cableHint,
                                onSome: from => ui.tools.cableFrom(picture.name(from)),
                              })
                            : '',
                        ],
                      ),
                    ]
                  : []),
              ],
            ),
          ]
        : []),
      ...(Option.isSome(picture.context.maybeTask)
        ? [h.div([h.Class('controls')], [...slot.controls()])]
        : []),
    ],
  )
}
