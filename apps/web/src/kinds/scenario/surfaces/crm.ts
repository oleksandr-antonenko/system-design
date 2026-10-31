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
import { Access, type Assistant, type Token, isScoped } from '../assistant'
import { ScenarioOp } from '../doc'
import { classes, ghostOps, nameOf, produceOps } from './parts'

// Настройки CRM `crm:<владелец>` (урок 10): пароль администратора и токены
// для ассистентов. Форма нового токена по умолчанию самая широкая — полный
// доступ, все разделы, бессрочно, как во многих настоящих системах: ученик
// сам сужает её. Созданные токены, их сохранение и отзыв — в документе.

type Context = SurfaceContext<ScenarioTypes>

// MODEL

/** Сроки токена в форме, дней; 0 — бессрочно. */
export const TERMS: ReadonlyArray<number> = [7, 30, 0]

export const Model = Schema.Struct({
  access: Access,
  /** Разделы, с которых сняли отметку: по умолчанию отмечены все. */
  unchecked: Schema.Array(Schema.String),
  days: Schema.Number,
  isEmptyShown: Schema.Boolean,
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  access: 'admin',
  unchecked: [],
  days: 0,
  isEmptyShown: false,
}

// MESSAGE

export const Message = defineMessageUnion({
  SelectedAccess: { access: Access },
  ToggledSection: { section: Schema.String },
  SelectedDays: { days: Schema.Number },
  ClickedCreate: {},
  ClickedSave: { token: Schema.String },
  ClickedRevoke: { token: Schema.String },
  ClickedChangePassword: {},
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

const checkedSections = (
  assistant: Assistant,
  model: Model,
): ReadonlyArray<string> =>
  Array.filter(
    assistant.sections,
    section => !Array.contains(model.unchecked, section),
  )

const create = (context: Context, model: Model): UpdateReturn =>
  Option.match(context.doc.maybeAssistant, {
    onNone: () => ({ model }),
    onSome: assistant => {
      const sections = checkedSections(assistant, model)
      return Array.isReadonlyArrayEmpty(sections)
        ? { model: modifyFields(model, { isEmptyShown: () => true }) }
        : produce(context, modifyFields(model, { isEmptyShown: () => false }), [
            ScenarioOp.CreateToken({
              access: model.access,
              sections,
              days: model.days,
            }),
          ])
    },
  })

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      SelectedAccess: ({ access }) => ({
        model: modifyFields(model, { access: () => access }),
      }),
      ToggledSection: ({ section }) => ({
        model: modifyFields(model, {
          unchecked: unchecked =>
            Array.contains(unchecked, section)
              ? Array.filter(unchecked, other => other !== section)
              : [...unchecked, section],
          isEmptyShown: () => false,
        }),
      }),
      SelectedDays: ({ days }) => ({
        model: modifyFields(model, { days: () => days }),
      }),
      ClickedCreate: () => create(context, model),
      ClickedSave: ({ token }) =>
        produce(context, model, [ScenarioOp.SaveToken({ token })]),
      ClickedRevoke: ({ token }) =>
        produce(context, model, [ScenarioOp.RevokeToken({ token })]),
      ClickedChangePassword: () =>
        produce(context, model, [ScenarioOp.ChangeAdminPassword()]),
    })

// GHOST

/** Что обвести: поле формы, которое ещё отличается от эталона, или кнопку. */
const ghostKeys =
  (assistant: Assistant, model: Model) =>
  (op: ScenarioOp): ReadonlyArray<string> =>
    Match.value(op).pipe(
      Match.tag('CreateToken', wanted => {
        const checked = checkedSections(assistant, model)
        const fields = [
          ...(model.access === wanted.access
            ? []
            : [`access:${wanted.access}`]),
          ...Array.filter(
            Array.map(assistant.sections, section => `section:${section}`),
            key => {
              const section = key.slice('section:'.length)
              return (
                Array.contains(wanted.sections, section) !==
                Array.contains(checked, section)
              )
            },
          ),
          ...(model.days === wanted.days ? [] : [`days:${wanted.days}`]),
        ]
        return Array.isReadonlyArrayEmpty(fields) ? ['create'] : fields
      }),
      Match.tag('SaveToken', ({ token }) => [`save:${token}`]),
      Match.tag('RevokeToken', ({ token }) => [`revoke:${token}`]),
      Match.tag('ChangeAdminPassword', () => ['change-password']),
      Match.orElse(() => []),
    )

const ghostOf = (
  context: Context,
  assistant: Assistant,
  model: Model,
): ReadonlyArray<string> =>
  pipe(
    Array.head(ghostOps(context.maybeGhost, context.journal)),
    Option.match({ onNone: () => [], onSome: ghostKeys(assistant, model) }),
  )

// VIEW

type Parts<ParentMessage> = Readonly<{
  model: Model
  assistant: Assistant
  context: Context
  ui: UiStrings
  ghosts: ReadonlyArray<string>
  send: (message: Message) => ParentMessage
  h: HtmlBuilder<ParentMessage>
}>

const isGhost = <ParentMessage>(
  parts: Parts<ParentMessage>,
  key: string,
): boolean => Array.contains(parts.ghosts, key)

const name = <ParentMessage>(parts: Parts<ParentMessage>, id: string) =>
  nameOf(parts.context.label, id)

const isEditable = <ParentMessage>(parts: Parts<ParentMessage>): boolean =>
  parts.context.mode === 'Edit'

const button = <ParentMessage>(
  parts: Parts<ParentMessage>,
  label: string,
  message: Message,
  style: string,
  ghost: string,
): Html => {
  const { h, send } = parts
  return h.button(
    [
      h.Type('button'),
      h.Class(
        classes('screen-button', style, isGhost(parts, ghost) && 'ghost'),
      ),
      ...(isEditable(parts) ? [h.OnClick(send(message))] : [h.Disabled(true)]),
    ],
    [label],
  )
}

const accessName = (ui: UiStrings, access: Access): string =>
  access === 'read'
    ? ui.scenario.crm.accessRead
    : access === 'write'
      ? ui.scenario.crm.accessWrite
      : ui.scenario.crm.accessAdmin

const choice = <ParentMessage>(
  parts: Parts<ParentMessage>,
  group: string,
  label: string,
  isChecked: boolean,
  message: Message,
  ghost: string,
  kind: 'radio' | 'checkbox',
): Html => {
  const { h, send } = parts
  return h.label(
    [h.Class(classes('scenario-crm-choice', isGhost(parts, ghost) && 'ghost'))],
    [
      h.input([
        h.Type(kind),
        h.Name(group),
        h.Checked(isChecked),
        ...(isEditable(parts)
          ? [h.OnClick(send(message))]
          : [h.Disabled(true)]),
      ]),
      label,
    ],
  )
}

const formView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, model, assistant } = parts
  const checked = checkedSections(assistant, model)
  return h.div(
    [h.Class('scenario-crm-form')],
    [
      h.fieldset(
        [],
        [
          h.legend([], [ui.scenario.crm.access]),
          ...Array.map(['read', 'write', 'admin'] as const, access =>
            choice(
              parts,
              'crm-access',
              accessName(ui, access),
              model.access === access,
              Message.SelectedAccess({ access }),
              `access:${access}`,
              'radio',
            ),
          ),
        ],
      ),
      h.fieldset(
        [],
        [
          h.legend([], [ui.scenario.crm.sections]),
          ...Array.map(assistant.sections, section =>
            choice(
              parts,
              `crm-section-${section}`,
              name(parts, `section:${section}`),
              Array.contains(checked, section),
              Message.ToggledSection({ section }),
              `section:${section}`,
              'checkbox',
            ),
          ),
        ],
      ),
      h.fieldset(
        [],
        [
          h.legend([], [ui.scenario.crm.term]),
          ...Array.map(TERMS, days =>
            choice(
              parts,
              'crm-days',
              ui.scenario.crm.days(days),
              model.days === days,
              Message.SelectedDays({ days }),
              `days:${days}`,
              'radio',
            ),
          ),
        ],
      ),
      ...(model.isEmptyShown
        ? [
            h.p(
              [h.Class('screen-problem'), h.Role('alert')],
              [ui.scenario.crm.noSections],
            ),
          ]
        : []),
      button(
        parts,
        ui.scenario.crm.create,
        Message.ClickedCreate(),
        'primary',
        'create',
      ),
    ],
  )
}

const tokenView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  token: Token,
  index: number,
): Html => {
  const { h, ui, assistant } = parts
  const summary = [
    accessName(ui, token.access),
    Array.map(token.sections, section =>
      name(parts, `section:${section}`),
    ).join(', '),
    ui.scenario.crm.days(token.days),
  ].join(' · ')
  return h.keyed('li')(
    token.id,
    [h.Class(classes('scenario-token', token.isRevoked && 'revoked'))],
    [
      h.div(
        [h.Class('scenario-token-head')],
        [
          h.strong([], [ui.scenario.crm.tokenTitle(index + 1)]),
          h.span(
            [
              h.Class(
                classes('scenario-token-status', !token.isRevoked && 'on'),
              ),
            ],
            [
              token.isRevoked
                ? ui.scenario.crm.revoked
                : ui.scenario.crm.active,
            ],
          ),
        ],
      ),
      h.span([h.Class('scenario-token-summary')], [summary]),
      h.code([h.Class('scenario-token-value')], ['crm_tok_••••••••••••3f9a']),
      ...(isScoped(assistant, token) || token.isRevoked
        ? []
        : [h.p([h.Class('scenario-banner bad')], [ui.scenario.crm.tooBroad])]),
      ...(token.isSaved
        ? [
            h.p(
              [h.Class('scenario-token-saved')],
              [ui.scenario.crm.saved(assistant.reference)],
            ),
          ]
        : []),
      ...(token.isRevoked
        ? []
        : [
            h.div(
              [h.Class('screen-actions scenario-token-actions')],
              [
                ...(token.isSaved
                  ? []
                  : [
                      button(
                        parts,
                        ui.scenario.crm.save,
                        Message.ClickedSave({ token: token.id }),
                        'primary',
                        `save:${token.id}`,
                      ),
                    ]),
                button(
                  parts,
                  ui.scenario.crm.revoke,
                  Message.ClickedRevoke({ token: token.id }),
                  'scenario-danger',
                  `revoke:${token.id}`,
                ),
              ],
            ),
          ]),
    ],
  )
}

export const view = <ParentMessage>(
  model: Model,
  context: Context,
  ui: UiStrings,
  send: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  Option.match(context.doc.maybeAssistant, {
    onNone: () => h.empty,
    onSome: assistant => {
      const parts: Parts<ParentMessage> = {
        model,
        assistant,
        context,
        ui,
        ghosts: ghostOf(context, assistant, model),
        send,
        h,
      }
      return h.section(
        [
          h.Class('scenario-window scenario-crm'),
          h.AriaLabel(ui.scenario.crm.label),
        ],
        [
          h.div(
            [h.Class('scenario-mailbar')],
            [
              h.span([h.Class('device-dots'), h.AriaHidden(true)]),
              h.span(
                [h.Class('scenario-page-url')],
                [`🔒 https://${assistant.url}`],
              ),
            ],
          ),
          h.div(
            [h.Class('scenario-site-body')],
            [
              h.p(
                [h.Class('scenario-site-name')],
                [name(parts, assistant.crm)],
              ),
              h.h3([], [ui.scenario.crm.settings]),
              h.section(
                [h.Class('scenario-site-section')],
                [
                  h.h4([], [ui.scenario.crm.adminTitle]),
                  h.p(
                    [],
                    [
                      assistant.isPasswordChanged
                        ? ui.scenario.crm.adminChanged
                        : ui.scenario.crm.adminOld,
                    ],
                  ),
                  button(
                    parts,
                    ui.scenario.crm.changePassword,
                    Message.ClickedChangePassword(),
                    '',
                    'change-password',
                  ),
                ],
              ),
              h.section(
                [h.Class('scenario-site-section')],
                [
                  h.h4([], [ui.scenario.crm.tokensTitle]),
                  h.p([], [ui.scenario.crm.tokensNote]),
                  formView(parts),
                  ...Array.match(assistant.tokens, {
                    onEmpty: () => [],
                    onNonEmpty: tokens => [
                      h.ul(
                        [h.Class('scenario-tokens')],
                        Array.map(tokens, (token, index) =>
                          tokenView(parts, token, index),
                        ),
                      ),
                    ],
                  }),
                ],
              ),
            ],
          ),
        ],
      )
    },
  })

// SURFACE

const read = (state: SurfaceState): Option.Option<Model> =>
  state._tag === 'ScenarioCrmSurface' ? Option.some(state.model) : Option.none()

const toSurfaceMessage = (message: Message): SurfaceMessage =>
  SurfaceMessage.GotScenarioCrmMessage({ message })

export const crmSurface: SurfaceDefinition<ScenarioTypes> = {
  type: 'crm',
  feature: 'crm',
  init: () => SurfaceState.ScenarioCrmSurface({ model: initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotScenarioCrmMessage'
      ? Update.foldChild({
          update: update(context),
          read,
          write: (_state: SurfaceState, nextCrm: Model): SurfaceState =>
            SurfaceState.ScenarioCrmSurface({ model: nextCrm }),
          toParentMessage: toSurfaceMessage,
          toParentOutMessage: (outMessage: OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: (context, ui) =>
    ui.scenario.crm.tab(nameOf(context.label, context.target)),
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
