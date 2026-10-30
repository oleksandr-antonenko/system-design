import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { UiStrings } from '../../../../i18n/ui'
import type { NetMessage } from '../../../../net/message'
import type { TerminalLine } from '../../../../net/terminal'
import type { SurfaceContext } from '../../../contract'
import type { PacketTypes } from '../../../types'
import { momentsOf, nameOf } from '../history'
import { suggestions, terminalFeatures } from '../unlocks'
import { Message } from './message'
import { type Model, type Notice, inputId } from './terminal'
import {
  type Entry,
  isConsole,
  isInterrupt,
  isRunning,
  nextGhostCommand,
  sessionOf,
  transcriptOf,
} from './transcript'

// VIEW

type Context = SurfaceContext<PacketTypes>

export type TerminalView = Readonly<{
  entries: ReadonlyArray<Entry>
  isRunning: boolean
  isConsole: boolean
  maybeGhost: Option.Option<string>
}>

/** Что видно в терминале: записи по истории, занят ли он, консоль ли это и
    призрак третьей подсказки. */
export const terminalView = (context: Context): TerminalView => {
  const maybeSession = sessionOf(context.doc, context.target)
  const entries = transcriptOf(
    momentsOf(context.history),
    context.target,
    terminalFeatures(context.unlocked),
    maybeSession,
  )
  return {
    entries,
    isRunning: isRunning(entries),
    isConsole: isConsole(entries, maybeSession),
    maybeGhost: Option.flatMap(context.maybeGhost, solution =>
      nextGhostCommand(solution, context.journal, context.target),
    ),
  }
}

export const tabLabel = (context: Context, ui: UiStrings): string => {
  const name = nameOf(context.label, context.target)
  return terminalView(context).isConsole
    ? ui.device.consoleTab(name)
    : ui.device.terminalTab(name)
}

const PROMPT = '$'

const outputLines = <ParentMessage>(
  lines: ReadonlyArray<TerminalLine>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> =>
  Array.map(lines, line =>
    h.div([h.Class(`terminal-out line-${line.tag}`)], [line.text]),
  )

const promptLine = <ParentMessage>(
  line: string,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.div(
    [h.Class('terminal-cmd')],
    [h.span([h.Class('terminal-prompt'), h.AriaHidden(true)], [PROMPT]), line],
  )

const hintLine = <ParentMessage>(
  text: string,
  h: HtmlBuilder<ParentMessage>,
): Html => h.p([h.Class('terminal-hint')], [text])

type Render<ParentMessage> = Readonly<{
  ui: UiStrings
  renderMessage: (message: NetMessage) => string
  h: HtmlBuilder<ParentMessage>
}>

const entryView = <ParentMessage>(
  entry: Entry,
  { ui, renderMessage, h }: Render<ParentMessage>,
): ReadonlyArray<Html> => {
  if (entry._tag === 'Login') {
    return Option.match(entry.maybeBanner, {
      onNone: () => [],
      onSome: banner => [h.div([h.Class('terminal-out')], [banner])],
    })
  }
  if (entry._tag === 'Disconnected') {
    return [
      h.div(
        [h.Class('terminal-out line-symptom')],
        ['client_loop: send disconnect: Broken pipe'],
      ),
      hintLine(ui.device.consoleNote, h),
    ]
  }
  return [
    ...(isInterrupt(entry.line) ? [] : [promptLine(entry.line, h)]),
    ...outputLines(entry.result.lines, h),
    ...Option.match(entry.result.maybeHint, {
      onNone: () => [],
      onSome: message => [hintLine(renderMessage(message), h)],
    }),
  ]
}

const noticeView = <ParentMessage>(
  notice: Notice,
  { ui, renderMessage, h }: Render<ParentMessage>,
): ReadonlyArray<Html> => [
  promptLine(notice.line, h),
  hintLine(
    notice._tag === 'Busy' ? ui.device.busy : renderMessage(notice.message),
    h,
  ),
]

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
  const { ui } = render
  const shown = terminalView(context)
  const isEditable = context.mode === 'Edit'
  const name = nameOf(context.label, context.target)
  const ghostIsInterrupt = Option.exists(shown.maybeGhost, isInterrupt)
  const ghostCommand = Option.filter(
    shown.maybeGhost,
    command => !isInterrupt(command),
  )
  const parts: Render<ParentMessage> = { ...render, h }
  const send = (message: Message) => toParentMessage(message)

  const input = h.input([
    h.Id(inputId(context.target)),
    h.Class(
      Option.isSome(ghostCommand) && model.draft === ''
        ? 'terminal-input ghost'
        : 'terminal-input',
    ),
    h.Type('text'),
    h.Value(model.draft),
    h.AriaLabel(ui.device.commandLine),
    h.Autocomplete('off'),
    h.Spellcheck(false),
    h.Placeholder(
      shown.isRunning
        ? ui.device.running
        : Option.getOrElse(ghostCommand, () => ''),
    ),
    ...(isEditable
      ? [
          h.OnInput(value => send(Message.UpdatedDraft({ value }))),
          h.OnKeyDownPreventDefault((key, modifiers) =>
            key === 'ArrowUp'
              ? Option.some(send(Message.PressedRecall({ direction: 'Older' })))
              : key === 'ArrowDown'
                ? Option.some(
                    send(Message.PressedRecall({ direction: 'Newer' })),
                  )
                : modifiers.ctrlKey && (key === 'c' || key === 'C')
                  ? Option.some(send(Message.PressedInterrupt()))
                  : Option.none(),
          ),
        ]
      : [h.Disabled(true)]),
  ])

  return h.section(
    [
      h.Class(shown.isConsole ? 'terminal is-console' : 'terminal'),
      h.AriaLabel(ui.device.terminalLabel(name)),
    ],
    [
      h.div(
        [h.Class('terminal-head')],
        [
          h.span([h.Class('terminal-dots'), h.AriaHidden(true)]),
          h.span(
            [h.Class('terminal-title')],
            [
              shown.isConsole
                ? ui.device.consoleTab(name)
                : ui.device.terminalTab(name),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('terminal-screen')],
        [
          h.div(
            [h.Class('terminal-lines'), h.Role('log')],
            [
              ...Array.flatMap(Array.drop(shown.entries, model.hidden), entry =>
                entryView(entry, parts),
              ),
              ...Option.match(model.maybeNotice, {
                onNone: () => [],
                onSome: notice => noticeView(notice, parts),
              }),
              h.form(
                [
                  h.Class('terminal-line'),
                  h.AriaLabel(ui.device.commandLine),
                  h.OnSubmit(send(Message.SubmittedLine())),
                ],
                [
                  h.span(
                    [h.Class('terminal-prompt'), h.AriaHidden(true)],
                    [shown.isRunning ? '' : PROMPT],
                  ),
                  input,
                  ...(shown.isRunning && isEditable
                    ? [
                        h.button(
                          [
                            h.Type('button'),
                            h.Class(
                              ghostIsInterrupt
                                ? 'terminal-key ghost'
                                : 'terminal-key',
                            ),
                            h.AriaLabel(ui.device.interrupt),
                            h.OnClick(send(Message.PressedInterrupt())),
                          ],
                          ['Ctrl+C'],
                        ),
                      ]
                    : []),
                ],
              ),
            ],
          ),
        ],
      ),
      Array.match(suggestions(context.unlocked, context.newFeatures), {
        onEmpty: () => h.empty,
        onNonEmpty: commands =>
          h.div(
            [
              h.Class('terminal-suggestions'),
              h.AriaLabel(ui.device.suggestions),
            ],
            Array.map(commands, suggestion =>
              h.keyed('button')(
                suggestion.command,
                [
                  h.Type('button'),
                  h.Class('terminal-suggestion'),
                  ...(isEditable
                    ? [
                        h.OnClick(
                          send(
                            Message.ClickedSuggestion({
                              command: suggestion.command,
                            }),
                          ),
                        ),
                      ]
                    : [h.Disabled(true)]),
                ],
                [
                  suggestion.command.trim(),
                  ...(suggestion.isNew
                    ? [h.span([h.Class('badge-new')], [ui.board.newBadge])]
                    : []),
                ],
              ),
            ),
          ),
      }),
    ],
  )
}
