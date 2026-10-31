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
  type EntryPlace,
  type Vault,
  type VaultEntry,
  findEntry,
  isInVault,
  twinsOf,
} from '../vault'
import { classes, ghostOps, nameOf, produceOps } from './parts'

// Менеджер паролей `vault:<владелец>` (урок 2): стикеры с паролями над
// окном, личный и общий сейф слева, открытая запись справа. Запись, пароль
// и место записи — в документе; здесь только открытая запись и лист поверх.
// Пароли в сейфе не показываются: только маска и что о пароле известно.

type Context = SurfaceContext<ScenarioTypes>

// MODEL

export const Sheet = defineTaggedUnion({
  Closed: {},
  Share: {},
  Sent: {},
})
export type Sheet = typeof Sheet.Type

export const Model = Schema.Struct({
  maybeOpen: Schema.Option(Schema.String),
  sheet: Sheet,
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  maybeOpen: Option.none(),
  sheet: Sheet.Closed(),
}

// MESSAGE

export const Message = defineMessageUnion({
  ClickedSaveSticker: { entry: Schema.String },
  ClickedEntry: { entry: Schema.String },
  ClickedGenerate: {},
  ClickedShare: {},
  ClickedMoveToShared: {},
  ClickedSendInChat: {},
  ClickedCloseSheet: {},
})
export type Message = typeof Message.Type

export type OutMessage = SurfaceOutMessage<ScenarioOp>

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

// UPDATE

const produce = (
  context: Context,
  model: Model,
  ops: ReadonlyArray<ScenarioOp>,
): UpdateReturn => produceOps<Model, Message>(context, model, ops)

const withOpen = (
  context: Context,
  model: Model,
  op: (entry: string) => ScenarioOp,
  next: Model = model,
): UpdateReturn =>
  Option.match(model.maybeOpen, {
    onNone: () => ({ model }),
    onSome: entry => produce(context, next, [op(entry)]),
  })

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedSaveSticker: ({ entry }) =>
        produce(
          context,
          modifyFields(model, {
            maybeOpen: () => Option.some(entry),
            sheet: () => Sheet.Closed(),
          }),
          [ScenarioOp.SaveEntry({ entry })],
        ),
      ClickedEntry: ({ entry }) => ({
        model: modifyFields(model, {
          maybeOpen: () => Option.some(entry),
          sheet: () => Sheet.Closed(),
        }),
      }),
      ClickedGenerate: () =>
        withOpen(context, model, entry =>
          ScenarioOp.GeneratePassword({ entry }),
        ),
      ClickedShare: () => ({
        model: modifyFields(model, { sheet: () => Sheet.Share() }),
      }),
      ClickedMoveToShared: () =>
        withOpen(
          context,
          model,
          entry => ScenarioOp.ShareEntry({ entry }),
          modifyFields(model, { sheet: () => Sheet.Closed() }),
        ),
      ClickedSendInChat: () =>
        withOpen(
          context,
          model,
          entry => ScenarioOp.SendPassword({ entry }),
          modifyFields(model, { sheet: () => Sheet.Sent() }),
        ),
      ClickedCloseSheet: () => ({
        model: modifyFields(model, { sheet: () => Sheet.Closed() }),
      }),
    })

// GHOST

/** Что обвести для первого ещё не сделанного хода эталона. */
const ghostKey = (model: Model, op: ScenarioOp): Option.Option<string> => {
  const isOpen = (entry: string) =>
    Option.exists(model.maybeOpen, open => open === entry)
  return Match.value(op).pipe(
    Match.tag('SaveEntry', ({ entry }) => Option.some(`save:${entry}`)),
    Match.tag('GeneratePassword', ({ entry }) =>
      Option.some(isOpen(entry) ? 'generate' : `entry:${entry}`),
    ),
    Match.tag('ShareEntry', ({ entry }) =>
      Option.some(
        !isOpen(entry)
          ? `entry:${entry}`
          : model.sheet._tag === 'Share'
            ? 'move'
            : 'share',
      ),
    ),
    Match.orElse(() => Option.none()),
  )
}

/** Призрак — только у следующего хода эталона: он может быть и на другом
    экране задачи. */
const ghostOf = (context: Context, model: Model): Option.Option<string> =>
  pipe(
    Array.head(ghostOps(context.maybeGhost, context.journal)),
    Option.flatMap(op => ghostKey(model, op)),
  )

// VIEW

type Parts<ParentMessage> = Readonly<{
  model: Model
  vault: Vault
  context: Context
  ui: UiStrings
  maybeGhost: Option.Option<string>
  send: (message: Message) => ParentMessage
  h: HtmlBuilder<ParentMessage>
}>

const isGhost = <ParentMessage>(
  parts: Parts<ParentMessage>,
  key: string,
): boolean => Option.exists(parts.maybeGhost, ghost => ghost === key)

const name = <ParentMessage>(parts: Parts<ParentMessage>, id: string) =>
  nameOf(parts.context.label, id)

const entryName = <ParentMessage>(
  parts: Parts<ParentMessage>,
  entry: VaultEntry,
) => name(parts, `entry:${entry.id}`)

const isEditable = <ParentMessage>(parts: Parts<ParentMessage>): boolean =>
  parts.context.mode === 'Edit'

const button = <ParentMessage>(
  parts: Parts<ParentMessage>,
  label: string,
  message: Message,
  style: string,
  ghost: string,
  isEnabled = true,
): Html => {
  const { h, send } = parts
  return h.button(
    [
      h.Type('button'),
      h.Class(
        classes('screen-button', style, isGhost(parts, ghost) && 'ghost'),
      ),
      ...(isEditable(parts) && isEnabled
        ? [h.OnClick(send(message))]
        : [h.Disabled(true)]),
    ],
    [label],
  )
}

const requestView = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, vault } = parts
  return Option.match(vault.maybeAsker, {
    onNone: () => [],
    onSome: asker => [
      h.p(
        [h.Class('scenario-toast'), h.Role('note')],
        [
          h.span(
            [h.Class('scenario-toast-avatar'), h.AriaHidden(true)],
            [name(parts, asker).charAt(0).toUpperCase()],
          ),
          h.strong([], [name(parts, asker)]),
          name(parts, 'vault:request'),
        ],
      ),
    ],
  })
}

const stickerView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  entry: VaultEntry,
): Html => {
  const { h, ui } = parts
  return h.keyed('li')(
    entry.id,
    [h.Class('scenario-sticker')],
    [
      h.strong([], [entryName(parts, entry)]),
      h.span([h.Class('scenario-sticker-url')], [entry.url]),
      h.span([], [ui.scenario.vault.stickerLogin(entry.login)]),
      h.span(
        [h.Class('scenario-sticker-password')],
        [ui.scenario.vault.stickerPassword(entry.password)],
      ),
      h.button(
        [
          h.Type('button'),
          h.Class(
            classes(
              'screen-button primary',
              isGhost(parts, `save:${entry.id}`) && 'ghost',
            ),
          ),
          h.AriaLabel(
            `${ui.scenario.vault.saveSticker} · ${entryName(parts, entry)}`,
          ),
          ...(isEditable(parts)
            ? [
                h.OnClick(
                  parts.send(Message.ClickedSaveSticker({ entry: entry.id })),
                ),
              ]
            : [h.Disabled(true)]),
        ],
        [ui.scenario.vault.saveSticker],
      ),
    ],
  )
}

const stickersView = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, vault } = parts
  return Array.match(
    Array.filter(vault.entries, entry => !isInVault(entry)),
    {
      onEmpty: () => [],
      onNonEmpty: stickers => [
        h.div(
          [h.Class('scenario-stickers')],
          [
            h.p(
              [h.Class('scenario-stickers-head')],
              [
                h.strong([], [ui.scenario.vault.stickers]),
                ` ${ui.scenario.vault.stickersNote}`,
              ],
            ),
            h.ul(
              [],
              Array.map(stickers, entry => stickerView(parts, entry)),
            ),
          ],
        ),
      ],
    },
  )
}

const entryRow = <ParentMessage>(
  parts: Parts<ParentMessage>,
  entry: VaultEntry,
): Html => {
  const { h, ui, model, vault, send } = parts
  const isOpen = Option.exists(model.maybeOpen, open => open === entry.id)
  const isReused = Array.isReadonlyArrayNonEmpty(twinsOf(vault, entry))
  return h.keyed('li')(
    entry.id,
    [],
    [
      h.button(
        [
          h.Type('button'),
          h.Class(
            classes(
              'scenario-entry',
              isOpen && 'open',
              isGhost(parts, `entry:${entry.id}`) && 'ghost',
            ),
          ),
          h.AriaPressed(isOpen ? 'true' : 'false'),
          h.OnClick(send(Message.ClickedEntry({ entry: entry.id }))),
        ],
        [
          h.span(
            [h.Class('scenario-entry-icon'), h.AriaHidden(true)],
            [entryName(parts, entry).charAt(0).toUpperCase()],
          ),
          h.span([h.Class('scenario-entry-name')], [entryName(parts, entry)]),
          h.span([h.Class('scenario-entry-login')], [entry.login]),
          ...(isReused
            ? [
                h.span(
                  [h.Class('scenario-entry-badge')],
                  [ui.scenario.vault.reusedBadge],
                ),
              ]
            : []),
        ],
      ),
    ],
  )
}

const groupView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  place: EntryPlace,
): Html => {
  const { h, ui, vault } = parts
  const entries = Array.filter(vault.entries, entry => entry.place === place)
  const isShared = place === 'shared'
  return h.div(
    [h.Class('scenario-vault-group')],
    [
      h.p(
        [h.Class('scenario-vault-group-head')],
        [
          h.strong([], [name(parts, isShared ? vault.shared : vault.personal)]),
          ...(isShared
            ? [
                h.span(
                  [h.Class('scenario-shared-badge')],
                  [ui.scenario.vault.sharedBadge],
                ),
              ]
            : []),
          h.span([h.Class('scenario-vault-count')], [`${entries.length}`]),
        ],
      ),
      ...(isShared
        ? [
            h.p(
              [h.Class('scenario-vault-members')],
              [
                ui.scenario.vault.access(
                  Array.map([vault.owner, ...vault.members], id =>
                    name(parts, id),
                  ).join(', '),
                ),
              ],
            ),
          ]
        : []),
      Array.match(entries, {
        onEmpty: () =>
          h.p([h.Class('scenario-vault-empty')], [ui.scenario.vault.empty]),
        onNonEmpty: found =>
          h.ul(
            [],
            Array.map(found, entry => entryRow(parts, entry)),
          ),
      }),
    ],
  )
}

const strengthView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  entry: VaultEntry,
): Html => {
  const { h, ui, vault } = parts
  return Array.match(twinsOf(vault, entry), {
    onNonEmpty: twins =>
      h.p(
        [h.Class('scenario-banner bad'), h.Role('status')],
        [
          ui.scenario.vault.reusedWith(
            Array.map(twins, twin => `«${entryName(parts, twin)}»`).join(', '),
          ),
        ],
      ),
    onEmpty: () =>
      entry.isGenerated
        ? h.p(
            [h.Class('scenario-banner ok'), h.Role('status')],
            [ui.scenario.vault.generatedNote],
          )
        : h.p([h.Class('scenario-vault-note')], [ui.scenario.vault.ownNote]),
  })
}

const field = <ParentMessage>(
  parts: Parts<ParentMessage>,
  label: string,
  value: string,
  style = '',
): Html =>
  parts.h.div(
    [parts.h.Class('scenario-vault-field')],
    [
      parts.h.span([parts.h.Class('scenario-vault-label')], [label]),
      parts.h.span(
        [parts.h.Class(classes('scenario-vault-value', style))],
        [value],
      ),
    ],
  )

const detailView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, model, vault } = parts
  return Option.match(
    pipe(
      model.maybeOpen,
      Option.flatMap(id => findEntry(vault, id)),
      Option.filter(isInVault),
    ),
    {
      onNone: () =>
        h.div(
          [h.Class('scenario-vault-detail empty')],
          [
            h.span([h.Class('scenario-envelope'), h.AriaHidden(true)], ['🔑']),
            h.p([], [ui.scenario.vault.choose]),
          ],
        ),
      onSome: entry =>
        h.div(
          [h.Class('scenario-vault-detail')],
          [
            h.h3([], [entryName(parts, entry)]),
            ...(entry.place === 'shared'
              ? [
                  h.p(
                    [h.Class('scenario-vault-where')],
                    [ui.scenario.vault.inShared(name(parts, vault.shared))],
                  ),
                ]
              : []),
            field(parts, ui.scenario.vault.site, entry.url),
            field(parts, ui.scenario.vault.login, entry.login),
            field(
              parts,
              ui.scenario.vault.password,
              '•'.repeat(entry.isGenerated ? 20 : entry.password.length),
              'masked',
            ),
            strengthView(parts, entry),
            h.div(
              [h.Class('screen-actions scenario-vault-actions')],
              [
                button(
                  parts,
                  entry.isGenerated
                    ? ui.scenario.vault.generatedButton
                    : ui.scenario.vault.generate,
                  Message.ClickedGenerate(),
                  'primary',
                  'generate',
                  !entry.isGenerated,
                ),
                ...(entry.place === 'personal'
                  ? [
                      button(
                        parts,
                        ui.scenario.vault.share,
                        Message.ClickedShare(),
                        '',
                        'share',
                      ),
                    ]
                  : []),
              ],
            ),
            ...sheetView(parts, entry),
          ],
        ),
    },
  )
}

// SHEETS

const sheetView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  entry: VaultEntry,
): ReadonlyArray<Html> => {
  const { h, ui, model, vault, send } = parts
  const closeButton = (label: string) =>
    h.button(
      [
        h.Type('button'),
        h.Class('screen-button'),
        h.OnClick(send(Message.ClickedCloseSheet())),
      ],
      [label],
    )
  const members = Array.map(vault.members, id => name(parts, id)).join(', ')
  return Sheet.match(model.sheet, {
    Closed: () => [],
    Share: () => [
      h.div(
        [
          h.Class('scenario-vault-sheet'),
          h.Role('dialog'),
          h.AriaLabel(ui.scenario.vault.shareTitle(entryName(parts, entry))),
        ],
        [
          h.h4([], [ui.scenario.vault.shareTitle(entryName(parts, entry))]),
          h.div(
            [h.Class('scenario-choice')],
            [
              button(
                parts,
                ui.scenario.vault.moveToShared(name(parts, vault.shared)),
                Message.ClickedMoveToShared(),
                'primary',
                'move',
              ),
              h.p([], [ui.scenario.vault.moveNote(members)]),
            ],
          ),
          ...Option.match(vault.maybeAsker, {
            onNone: () => [],
            onSome: asker => [
              h.div(
                [h.Class('scenario-choice')],
                [
                  button(
                    parts,
                    ui.scenario.vault.sendInChat(name(parts, asker)),
                    Message.ClickedSendInChat(),
                    'scenario-danger',
                    'send',
                  ),
                  h.p([], [ui.scenario.vault.sendNote]),
                ],
              ),
            ],
          }),
          h.div(
            [h.Class('screen-actions')],
            [closeButton(ui.scenario.vault.cancel)],
          ),
        ],
      ),
    ],
    Sent: () => [
      h.div(
        [
          h.Class('scenario-vault-sheet is-alert'),
          h.Role('alertdialog'),
          h.AriaLabel(ui.scenario.vault.sentTitle),
        ],
        [
          h.h4([], [ui.scenario.vault.sentTitle]),
          h.p([h.Class('screen-problem')], [ui.scenario.vault.sentBody]),
          h.p([], [ui.scenario.vault.sentNext]),
          h.div(
            [h.Class('screen-actions')],
            [closeButton(ui.scenario.phone.understood)],
          ),
        ],
      ),
    ],
  })
}

export const view = <ParentMessage>(
  model: Model,
  context: Context,
  ui: UiStrings,
  send: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  Option.match(context.doc.maybeVault, {
    onNone: () => h.empty,
    onSome: vault => {
      const parts: Parts<ParentMessage> = {
        model,
        vault,
        context,
        ui,
        maybeGhost: ghostOf(context, model),
        send,
        h,
      }
      return h.section(
        [
          h.Class('scenario-window scenario-vault'),
          h.AriaLabel(ui.scenario.vault.label),
        ],
        [
          h.div(
            [h.Class('scenario-mailbar')],
            [
              h.span([h.Class('device-dots'), h.AriaHidden(true)]),
              h.span(
                [h.Class('scenario-app-mark'), h.AriaHidden(true)],
                ['🔑'],
              ),
              h.strong([], [name(parts, vault.app)]),
              h.span([h.Class('scenario-account')], [name(parts, vault.owner)]),
            ],
          ),
          ...requestView(parts),
          ...stickersView(parts),
          h.div(
            [h.Class('scenario-vault-main')],
            [
              h.div(
                [h.Class('scenario-vault-list')],
                [groupView(parts, 'personal'), groupView(parts, 'shared')],
              ),
              detailView(parts),
            ],
          ),
        ],
      )
    },
  })

// SURFACE

const read = (state: SurfaceState): Option.Option<Model> =>
  state._tag === 'ScenarioVaultSurface'
    ? Option.some(state.model)
    : Option.none()

const toSurfaceMessage = (message: Message): SurfaceMessage =>
  SurfaceMessage.GotScenarioVaultMessage({ message })

export const vaultSurface: SurfaceDefinition<ScenarioTypes> = {
  type: 'vault',
  feature: 'vault',
  init: () => SurfaceState.ScenarioVaultSurface({ model: initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotScenarioVaultMessage'
      ? Update.foldChild({
          update: update(context),
          read,
          write: (_state: SurfaceState, nextVault: Model): SurfaceState =>
            SurfaceState.ScenarioVaultSurface({ model: nextVault }),
          toParentMessage: toSurfaceMessage,
          toParentOutMessage: (outMessage: OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: (context, ui) =>
    ui.scenario.vault.tab(nameOf(context.label, context.target)),
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
