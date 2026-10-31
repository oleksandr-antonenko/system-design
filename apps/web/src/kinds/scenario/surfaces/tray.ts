import { Array, Match, Option, Schema, pipe } from 'effect'
import { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import type { UiStrings } from '../../../i18n/ui'
import type {
  SurfaceContext,
  SurfaceDefinition,
  SurfaceOutMessage,
} from '../../contract'
import { SurfaceMessage, SurfaceState } from '../../state'
import type { ScenarioTypes } from '../../types'
import { ScenarioOp } from '../doc'
import {
  type FileName,
  type Look,
  type Tray,
  type TrayItem,
  chosenRisk,
  groupsOf,
  isRight,
} from '../tray'
import { classes, ghostOps, nameOf, noteOf, produceOps } from './parts'

// Разбор предметов: пароли на проверке `passwords:<владелец>` (урок 2), стол
// перед обедом `desk:<владелец>` (урок 8), папка «Загрузки»
// `downloads:<владелец>` (урок 9) и расширения браузера
// `extensions:<владелец>` (урок 10). Один документ и один вид: у каждого
// предмета кнопки действий, выбранное отмечено, под ним — итог выбора из
// подписей урока. В «Загрузках» расширения файлов скрыты, как в системе по
// умолчанию, и включаются переключателем: это состояние только экрана.

type Context = SurfaceContext<ScenarioTypes>

// MODEL

export const Model = Schema.Struct({ showsExtensions: Schema.Boolean })
export type Model = typeof Model.Type

export const initialModel: Model = { showsExtensions: false }

// MESSAGE

export const Message = defineMessageUnion({
  ClickedAction: { item: Schema.String, action: Schema.String },
  ToggledExtensions: {},
})
export type Message = typeof Message.Type

export type OutMessage = SurfaceOutMessage<ScenarioOp>

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

// UPDATE

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedAction: ({ item, action }) =>
        produceOps(context, model, [ScenarioOp.ChooseAction({ item, action })]),
      ToggledExtensions: () => ({
        model: modifyFields(model, {
          showsExtensions: showsExtensions => !showsExtensions,
        }),
      }),
    })

// GHOST

const ghostOf = (context: Context): Option.Option<string> =>
  pipe(
    Array.head(ghostOps(context.maybeGhost, context.journal)),
    Option.flatMap(op =>
      Match.value(op).pipe(
        Match.tag('ChooseAction', ({ item, action }) =>
          Option.some(`choose:${item}:${action}`),
        ),
        Match.orElse(() => Option.none()),
      ),
    ),
  )

// VIEW

type Parts<ParentMessage> = Readonly<{
  model: Model
  tray: Tray
  context: Context
  ui: UiStrings
  maybeGhost: Option.Option<string>
  send: (message: Message) => ParentMessage
  h: HtmlBuilder<ParentMessage>
}>

const name = <ParentMessage>(parts: Parts<ParentMessage>, id: string) =>
  nameOf(parts.context.label, id)

const note = <ParentMessage>(parts: Parts<ParentMessage>, id: string) =>
  noteOf(parts.context.label, id)

/** Расширения, которые запускают код: их показываем красным. */
const RUNNABLE: ReadonlyArray<string> = [
  'exe',
  'msi',
  'scr',
  'bat',
  'cmd',
  'js',
  'vbs',
  'docm',
  'xlsm',
]

const fileNameView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  item: TrayItem,
  file: FileName,
): ReadonlyArray<Html | string> => {
  const { h, model } = parts
  const base = name(parts, `item:${item.id}`)
  return model.showsExtensions
    ? [
        base,
        h.span(
          [
            h.Class(
              classes(
                'scenario-tray-ext',
                Array.contains(RUNNABLE, file.ext) && 'runnable',
              ),
            ),
          ],
          [`.${file.ext}`],
        ),
      ]
    : [base]
}

const itemTitle = <ParentMessage>(
  parts: Parts<ParentMessage>,
  item: TrayItem,
): string =>
  Option.match(item.maybeFile, {
    onNone: () => name(parts, `item:${item.id}`),
    onSome: file =>
      parts.model.showsExtensions
        ? `${name(parts, `item:${item.id}`)}.${file.ext}`
        : name(parts, `item:${item.id}`),
  })

const actionButton = <ParentMessage>(
  parts: Parts<ParentMessage>,
  item: TrayItem,
  action: string,
): Html => {
  const { h, send } = parts
  const isChosen = Option.exists(item.maybeChosen, chosen => chosen === action)
  const isRisky = Option.exists(item.maybeRisk, risk => risk.action === action)
  return h.button(
    [
      h.Type('button'),
      h.Class(
        classes(
          'screen-button',
          isChosen && 'chosen',
          isRisky && 'scenario-danger',
          Option.exists(
            parts.maybeGhost,
            ghost => ghost === `choose:${item.id}:${action}`,
          ) && 'ghost',
        ),
      ),
      h.AriaPressed(isChosen ? 'true' : 'false'),
      h.AriaLabel(
        `${name(parts, `action:${action}`)} · ${itemTitle(parts, item)}`,
      ),
      ...(parts.context.mode === 'Edit'
        ? [h.OnClick(send(Message.ClickedAction({ item: item.id, action })))]
        : [h.Disabled(true)]),
    ],
    [name(parts, `action:${action}`)],
  )
}

const resultView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  item: TrayItem,
): ReadonlyArray<Html> => {
  const { h } = parts
  return pipe(
    item.maybeChosen,
    Option.flatMap(chosen => parts.context.label(`res:${item.id}:${chosen}`)),
    Option.match({
      onNone: () => [],
      onSome: found => [
        h.p(
          [
            h.Class(
              classes(
                'scenario-banner',
                Option.isSome(chosenRisk(item))
                  ? 'bad'
                  : isRight(item)
                    ? 'ok'
                    : 'plain',
              ),
            ),
            h.Role(Option.isSome(chosenRisk(item)) ? 'alert' : 'status'),
          ],
          [found.name],
        ),
      ],
    }),
  )
}

const itemView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  item: TrayItem,
): Html => {
  const { h, ui } = parts
  const itemNote = note(parts, `item:${item.id}`)
  return h.keyed('li')(
    item.id,
    [
      h.Class(
        classes(
          'scenario-tray-item',
          Option.isSome(chosenRisk(item)) && 'risky',
          Option.isSome(item.maybeChosen) && 'decided',
        ),
      ),
    ],
    [
      h.span([h.Class('scenario-tray-icon'), h.AriaHidden(true)], [item.icon]),
      h.div(
        [h.Class('scenario-tray-body')],
        [
          h.p(
            [h.Class('scenario-tray-name')],
            Option.match(item.maybeFile, {
              onNone: () => [name(parts, `item:${item.id}`)],
              onSome: file => fileNameView(parts, item, file),
            }),
          ),
          ...Option.match(item.maybeFile, {
            onNone: () => [],
            onSome: file => [
              h.p(
                [h.Class('scenario-tray-type')],
                [ui.scenario.tray.fileType(file.ext)],
              ),
            ],
          }),
          ...(itemNote === ''
            ? []
            : [h.p([h.Class('scenario-tray-note')], [itemNote])]),
          ...Array.match(item.details, {
            onEmpty: () => [],
            onNonEmpty: details => [
              h.ul(
                [h.Class('scenario-tray-details')],
                Array.map(details, line =>
                  h.li(
                    [h.Class(classes(line.isWide && 'wide'))],
                    [
                      h.span([h.AriaHidden(true)], [line.isWide ? '⚠ ' : '• ']),
                      name(parts, `detail:${line.id}`),
                    ],
                  ),
                ),
              ),
            ],
          }),
          h.div(
            [h.Class('scenario-tray-actions')],
            Array.map(item.actions, action =>
              actionButton(parts, item, action),
            ),
          ),
          ...resultView(parts, item),
        ],
      ),
    ],
  )
}

const groupView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  group: string,
): Html => {
  const { h, tray } = parts
  const groupNote = note(parts, `group:${group}`)
  return h.keyed('div')(
    group,
    [h.Class('scenario-tray-group')],
    [
      h.p(
        [h.Class('scenario-tray-group-head')],
        [h.strong([], [name(parts, `group:${group}`)])],
      ),
      ...(groupNote === ''
        ? []
        : [h.p([h.Class('scenario-tray-group-note')], [groupNote])]),
      h.ul(
        [h.Class('scenario-tray-items')],
        Array.map(
          Array.filter(tray.items, item => item.group === group),
          item => itemView(parts, item),
        ),
      ),
    ],
  )
}

const MARKS: Readonly<Record<Look, string>> = {
  passwords: '🔑',
  desk: '🏢',
  downloads: '📁',
  extensions: '🧩',
}

const toolbarView = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, tray, model, send } = parts
  return tray.look !== 'downloads'
    ? []
    : [
        h.div(
          [h.Class('scenario-tray-toolbar')],
          [
            h.button([
              h.Type('button'),
              h.Role('switch'),
              h.AriaChecked(model.showsExtensions),
              h.AriaLabel(ui.scenario.tray.showExtensions),
              h.Class(
                classes('scenario-switch', model.showsExtensions && 'on'),
              ),
              h.OnClick(send(Message.ToggledExtensions())),
            ]),
            h.span(
              [h.Class('scenario-tray-switch-label')],
              [ui.scenario.tray.showExtensions],
            ),
            h.span(
              [h.Class('scenario-tray-hint')],
              [
                model.showsExtensions
                  ? ui.scenario.tray.extensionsShown
                  : ui.scenario.tray.extensionsHidden,
              ],
            ),
          ],
        ),
      ]
}

export const view = <ParentMessage>(
  model: Model,
  context: Context,
  ui: UiStrings,
  send: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  Option.match(context.doc.maybeTray, {
    onNone: () => h.empty,
    onSome: tray => {
      const parts: Parts<ParentMessage> = {
        model,
        tray,
        context,
        ui,
        maybeGhost: ghostOf(context),
        send,
        h,
      }
      return h.section(
        [
          h.Class(`scenario-window scenario-tray look-${tray.look}`),
          h.AriaLabel(name(parts, tray.app)),
        ],
        [
          h.div(
            [h.Class('scenario-mailbar')],
            [
              h.span([h.Class('device-dots'), h.AriaHidden(true)]),
              h.span(
                [h.Class('scenario-app-mark'), h.AriaHidden(true)],
                [MARKS[tray.look]],
              ),
              h.strong([], [name(parts, tray.app)]),
              h.span([h.Class('scenario-account')], [name(parts, tray.owner)]),
            ],
          ),
          ...toolbarView(parts),
          h.div(
            [h.Class('scenario-tray-main')],
            Array.map(groupsOf(tray), group => groupView(parts, group)),
          ),
        ],
      )
    },
  })

// SURFACE

const read = (state: SurfaceState): Option.Option<Model> =>
  state._tag === 'ScenarioTraySurface'
    ? Option.some(state.model)
    : Option.none()

const toSurfaceMessage = (message: Message): SurfaceMessage =>
  SurfaceMessage.GotScenarioTrayMessage({ message })

const traySurface = (look: Look): SurfaceDefinition<ScenarioTypes> => ({
  type: look,
  feature: look,
  init: () => SurfaceState.ScenarioTraySurface({ model: initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotScenarioTrayMessage'
      ? Update.foldChild({
          update: update(context),
          read,
          write: (_state: SurfaceState, next: Model): SurfaceState =>
            SurfaceState.ScenarioTraySurface({ model: next }),
          toParentMessage: toSurfaceMessage,
          toParentOutMessage: (outMessage: OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: (context, ui) =>
    ui.scenario.tray.tab(look, nameOf(context.label, context.target)),
  view: (slot, h) =>
    Option.match(read(slot.state), {
      onNone: () => h.empty,
      onSome: model =>
        view(
          model,
          slot.context,
          slot.ui,
          message => slot.toParentMessage(toSurfaceMessage(message)),
          h,
        ),
    }),
})

export const passwordsSurface = traySurface('passwords')
export const deskSurface = traySurface('desk')
export const downloadsSurface = traySurface('downloads')
export const extensionsSurface = traySurface('extensions')
