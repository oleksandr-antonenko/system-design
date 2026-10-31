import { Array, Match, Option, Schema, pipe } from 'effect'
import { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'
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
  type BaseCopy,
  type Keepass,
  addedCount,
  chosenPhrase,
  findPlace,
  hasStrongPhrase,
  isElsewhere,
  isFresh,
} from '../keepass'
import { classes, ghostOps, nameOf, noteOf, produceOps } from './parts'

// Сейф-файл `keepass:<владелец>` (урок 4): создать базу, выбрать надёжную
// мастер-фразу, перенести записи и положить копию файла на другое
// устройство. База, фраза, записи и копии — в документе; здесь только
// открытый лист «Сохранить копию».

type Context = SurfaceContext<ScenarioTypes>

// MODEL

export const Sheet = defineTaggedUnion({
  Closed: {},
  Copy: {},
})
export type Sheet = typeof Sheet.Type

export const Model = Schema.Struct({ sheet: Sheet })
export type Model = typeof Model.Type

export const initialModel: Model = { sheet: Sheet.Closed() }

// MESSAGE

export const Message = defineMessageUnion({
  ClickedCreate: {},
  ClickedPhrase: { phrase: Schema.String },
  ClickedAdd: { entry: Schema.String },
  ClickedCopy: {},
  ClickedPlace: { place: Schema.String },
  ClickedCloseSheet: {},
})
export type Message = typeof Message.Type

export type OutMessage = SurfaceOutMessage<ScenarioOp>

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

// UPDATE

const closed = (model: Model): Model =>
  modifyFields(model, { sheet: () => Sheet.Closed() })

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedCreate: () =>
        produceOps(context, model, [ScenarioOp.CreateBase()]),
      ClickedPhrase: ({ phrase }) =>
        produceOps(context, model, [ScenarioOp.SetPhrase({ phrase })]),
      ClickedAdd: ({ entry }) =>
        produceOps(context, model, [ScenarioOp.AddKeepassEntry({ entry })]),
      ClickedCopy: () => ({
        model: modifyFields(model, { sheet: () => Sheet.Copy() }),
      }),
      ClickedPlace: ({ place }) =>
        produceOps(context, closed(model), [ScenarioOp.CopyBase({ place })]),
      ClickedCloseSheet: () => ({ model: closed(model) }),
    })

// GHOST

const ghostKey = (model: Model, op: ScenarioOp): Option.Option<string> =>
  Match.value(op).pipe(
    Match.tag('CreateBase', () => Option.some('create')),
    Match.tag('SetPhrase', ({ phrase }) => Option.some(`phrase:${phrase}`)),
    Match.tag('AddKeepassEntry', ({ entry }) => Option.some(`add:${entry}`)),
    Match.tag('CopyBase', ({ place }) =>
      Option.some(model.sheet._tag === 'Copy' ? `place:${place}` : 'copy'),
    ),
    Match.orElse(() => Option.none()),
  )

const ghostOf = (context: Context, model: Model): Option.Option<string> =>
  pipe(
    Array.head(ghostOps(context.maybeGhost, context.journal)),
    Option.flatMap(op => ghostKey(model, op)),
  )

// VIEW

type Parts<ParentMessage> = Readonly<{
  model: Model
  keepass: Keepass
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

const button = <ParentMessage>(
  parts: Parts<ParentMessage>,
  label: string,
  message: Message,
  style: string,
  ghost: string,
  ariaLabel?: string,
): Html => {
  const { h, send } = parts
  return h.button(
    [
      h.Type('button'),
      h.Class(
        classes(
          'screen-button',
          style,
          Option.exists(parts.maybeGhost, key => key === ghost) && 'ghost',
        ),
      ),
      ...(ariaLabel === undefined ? [] : [h.AriaLabel(ariaLabel)]),
      ...(parts.context.mode === 'Edit'
        ? [h.OnClick(send(message))]
        : [h.Disabled(true)]),
    ],
    [label],
  )
}

const welcomeView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui } = parts
  return h.div(
    [h.Class('scenario-keepass-welcome')],
    [
      h.span([h.Class('scenario-envelope'), h.AriaHidden(true)], ['🗄️']),
      h.h3([], [ui.scenario.keepass.noBase]),
      h.p(
        [],
        [
          ui.scenario.keepass.noBaseNote(
            name(parts, `place:${parts.keepass.home}`),
          ),
        ],
      ),
      button(
        parts,
        ui.scenario.keepass.create,
        Message.ClickedCreate(),
        'primary',
        'create',
      ),
    ],
  )
}

const phraseView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, keepass } = parts
  const maybeWeak = Option.filter(
    chosenPhrase(keepass),
    phrase => !phrase.isStrong,
  )
  return h.div(
    [
      h.Class('scenario-keepass-phrase'),
      h.Role('dialog'),
      h.AriaLabel(ui.scenario.keepass.phraseTitle(keepass.file)),
    ],
    [
      h.h4([], [ui.scenario.keepass.phraseTitle(keepass.file)]),
      h.p([], [ui.scenario.keepass.phraseNote]),
      h.ul(
        [h.Class('scenario-keepass-phrases')],
        Array.map(keepass.phrases, phrase =>
          h.keyed('li')(
            phrase.id,
            [],
            [
              button(
                parts,
                name(parts, `phrase:${phrase.id}`),
                Message.ClickedPhrase({ phrase: phrase.id }),
                classes(
                  'scenario-keepass-phrase-option',
                  Option.exists(maybeWeak, weak => weak.id === phrase.id) &&
                    'picked',
                ),
                `phrase:${phrase.id}`,
              ),
            ],
          ),
        ),
      ),
      ...Option.match(maybeWeak, {
        onNone: () => [],
        onSome: weak => [
          h.p(
            [h.Class('scenario-banner bad'), h.Role('alert')],
            [
              h.strong([], [ui.scenario.keepass.weakTitle]),
              ` ${note(parts, `phrase:${weak.id}`)}`,
            ],
          ),
        ],
      }),
    ],
  )
}

const copyRow = <ParentMessage>(
  parts: Parts<ParentMessage>,
  copy: BaseCopy,
): Html => {
  const { h, ui, keepass } = parts
  const total = addedCount(keepass)
  const state = !isElsewhere(keepass, copy)
    ? { tone: 'bad', text: ui.scenario.keepass.sameDevice }
    : isFresh(keepass, copy)
      ? { tone: 'ok', text: ui.scenario.keepass.fresh }
      : { tone: 'bad', text: ui.scenario.keepass.stale }
  return h.keyed('li')(
    copy.place,
    [h.Class('scenario-keepass-copy')],
    [
      h.span(
        [h.Class('scenario-keepass-copy-icon'), h.AriaHidden(true)],
        ['💾'],
      ),
      h.span(
        [h.Class('scenario-keepass-copy-name')],
        [name(parts, `place:${copy.place}`)],
      ),
      h.span(
        [h.Class('scenario-keepass-copy-count')],
        [ui.scenario.keepass.copyCount(copy.entries, total)],
      ),
      h.span(
        [h.Class(classes('scenario-keepass-badge', state.tone))],
        [state.text],
      ),
    ],
  )
}

const fileView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, keepass } = parts
  return h.div(
    [h.Class('scenario-keepass-file')],
    [
      h.p(
        [h.Class('scenario-keepass-file-head')],
        [h.span([h.AriaHidden(true)], ['🗄️ ']), h.strong([], [keepass.file])],
      ),
      h.p(
        [h.Class('scenario-keepass-where')],
        [ui.scenario.keepass.where(name(parts, `place:${keepass.home}`))],
      ),
      h.p([h.Class('scenario-keepass-note')], [ui.scenario.keepass.noCloud]),
      h.h4([], [ui.scenario.keepass.copiesTitle]),
      Array.match(keepass.copies, {
        onEmpty: () =>
          h.p(
            [h.Class('scenario-keepass-note')],
            [ui.scenario.keepass.noCopies],
          ),
        onNonEmpty: copies =>
          h.ul(
            [h.Class('scenario-keepass-copies')],
            Array.map(copies, copy => copyRow(parts, copy)),
          ),
      }),
      button(
        parts,
        ui.scenario.keepass.saveCopy,
        Message.ClickedCopy(),
        '',
        'copy',
      ),
    ],
  )
}

const entriesView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, keepass } = parts
  const added = Array.filter(keepass.entries, entry => entry.isAdded)
  const waiting = Array.filter(keepass.entries, entry => !entry.isAdded)
  return h.div(
    [h.Class('scenario-keepass-entries')],
    [
      h.h4([], [ui.scenario.keepass.entriesTitle(added.length)]),
      Array.match(added, {
        onEmpty: () =>
          h.p(
            [h.Class('scenario-keepass-note')],
            [ui.scenario.keepass.emptyBase],
          ),
        onNonEmpty: found =>
          h.ul(
            [h.Class('scenario-keepass-list')],
            Array.map(found, entry =>
              h.keyed('li')(
                entry.id,
                [h.Class('scenario-keepass-entry')],
                [
                  h.span(
                    [h.Class('scenario-entry-icon'), h.AriaHidden(true)],
                    [name(parts, `kp:${entry.id}`).charAt(0).toUpperCase()],
                  ),
                  h.span(
                    [h.Class('scenario-entry-name')],
                    [name(parts, `kp:${entry.id}`)],
                  ),
                  h.span(
                    [h.Class('scenario-entry-login')],
                    [note(parts, `kp:${entry.id}`)],
                  ),
                ],
              ),
            ),
          ),
      }),
      ...Array.match(waiting, {
        onEmpty: () => [],
        onNonEmpty: rest => [
          h.div(
            [h.Class('scenario-keepass-waiting')],
            [
              h.p(
                [h.Class('scenario-keepass-note')],
                [ui.scenario.keepass.waiting],
              ),
              h.ul(
                [h.Class('scenario-keepass-list')],
                Array.map(rest, entry =>
                  h.keyed('li')(
                    entry.id,
                    [h.Class('scenario-keepass-entry waiting')],
                    [
                      h.span(
                        [h.Class('scenario-entry-name')],
                        [name(parts, `kp:${entry.id}`)],
                      ),
                      h.span(
                        [h.Class('scenario-entry-login')],
                        [note(parts, `kp:${entry.id}`)],
                      ),
                      button(
                        parts,
                        ui.scenario.keepass.add,
                        Message.ClickedAdd({ entry: entry.id }),
                        'primary',
                        `add:${entry.id}`,
                        `${ui.scenario.keepass.add} · ${name(parts, `kp:${entry.id}`)}`,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      }),
    ],
  )
}

const copySheet = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, keepass, model, send } = parts
  return model.sheet._tag !== 'Copy'
    ? []
    : [
        h.div(
          [
            h.Class('scenario-vault-sheet'),
            h.Role('dialog'),
            h.AriaLabel(ui.scenario.keepass.copyTitle(keepass.file)),
          ],
          [
            h.h4([], [ui.scenario.keepass.copyTitle(keepass.file)]),
            ...Array.map(
              Array.filter(keepass.places, place => place.id !== keepass.home),
              place =>
                h.div(
                  [h.Class('scenario-choice')],
                  [
                    button(
                      parts,
                      name(parts, `place:${place.id}`),
                      Message.ClickedPlace({ place: place.id }),
                      '',
                      `place:${place.id}`,
                    ),
                    h.p([], [note(parts, `place:${place.id}`)]),
                  ],
                ),
            ),
            h.div(
              [h.Class('screen-actions')],
              [
                h.button(
                  [
                    h.Type('button'),
                    h.Class('screen-button'),
                    h.OnClick(send(Message.ClickedCloseSheet())),
                  ],
                  [ui.scenario.vault.cancel],
                ),
              ],
            ),
          ],
        ),
      ]
}

const bodyView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, keepass } = parts
  return !keepass.isCreated
    ? welcomeView(parts)
    : !hasStrongPhrase(keepass)
      ? phraseView(parts)
      : h.div(
          [h.Class('scenario-keepass-main')],
          [fileView(parts), entriesView(parts), ...copySheet(parts)],
        )
}

export const view = <ParentMessage>(
  model: Model,
  context: Context,
  ui: UiStrings,
  send: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  Option.match(context.doc.maybeKeepass, {
    onNone: () => h.empty,
    onSome: keepass => {
      const parts: Parts<ParentMessage> = {
        model,
        keepass,
        context,
        ui,
        maybeGhost: ghostOf(context, model),
        send,
        h,
      }
      return h.section(
        [
          h.Class('scenario-window scenario-keepass'),
          h.AriaLabel(ui.scenario.keepass.label),
        ],
        [
          h.div(
            [h.Class('scenario-mailbar')],
            [
              h.span([h.Class('device-dots'), h.AriaHidden(true)]),
              h.span(
                [h.Class('scenario-app-mark'), h.AriaHidden(true)],
                ['🔐'],
              ),
              h.strong([], [name(parts, keepass.app)]),
              h.span(
                [h.Class('scenario-account')],
                [
                  keepass.isCreated
                    ? `${keepass.file} · ${Option.match(findPlace(keepass, keepass.home), { onNone: () => '', onSome: place => name(parts, `place:${place.id}`) })}`
                    : name(parts, keepass.owner),
                ],
              ),
            ],
          ),
          bodyView(parts),
        ],
      )
    },
  })

// SURFACE

const read = (state: SurfaceState): Option.Option<Model> =>
  state._tag === 'ScenarioKeepassSurface'
    ? Option.some(state.model)
    : Option.none()

const toSurfaceMessage = (message: Message): SurfaceMessage =>
  SurfaceMessage.GotScenarioKeepassMessage({ message })

export const keepassSurface: SurfaceDefinition<ScenarioTypes> = {
  type: 'keepass',
  feature: 'keepass',
  init: () => SurfaceState.ScenarioKeepassSurface({ model: initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotScenarioKeepassMessage'
      ? Update.foldChild({
          update: update(context),
          read,
          write: (_state: SurfaceState, next: Model): SurfaceState =>
            SurfaceState.ScenarioKeepassSurface({ model: next }),
          toParentMessage: toSurfaceMessage,
          toParentOutMessage: (outMessage: OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: (context, ui) =>
    ui.scenario.keepass.tab(nameOf(context.label, context.target)),
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
}
