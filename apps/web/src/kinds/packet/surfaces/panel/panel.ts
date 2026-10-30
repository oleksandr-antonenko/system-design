import { Array, Match, Option, Record, Result, Schema, pipe } from 'effect'
import type { Update } from 'foldkit'
import type { Attribute, Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import type { Locale } from '../../../../i18n/locale'
import type { PanelStrings } from '../../../../i18n/ui/panel/types'
import type { NetMessage } from '../../../../net/message'
import { renderNetMessage } from '../../../../net/text'
import { type SurfaceContext, SurfaceOutMessage } from '../../../contract'
import type { PacketTypes } from '../../../types'
import {
  type PacketDoc,
  type PacketOp,
  applyPacketOp,
  runPacket,
} from '../../doc'
import {
  type Field,
  FieldProblem,
  type InputField,
  type InputKind,
  type ListField,
  type PanelContext,
  type PanelDefinition,
  type PanelProblem,
  type PanelTab,
  type Row,
  type ScalarField,
  type SegmentedField,
  type SelectField,
  type TableField,
  Values,
  cellOf,
  cellPath,
  fieldOf,
  isOn,
  onOff,
  refusedAt,
  rowsOf,
  sameValues,
} from './schema'

// Панель настроек по схеме (план 3.2, изменение add-settings-panel): одна
// поверхность на любое описание `PanelDefinition`. Ученик правит черновик
// вкладки; «Сохранить» проверяет ввод, пробует операции на документе и
// отдаёт их плееру (`ProducedOps`), «Отменить» выбрасывает черновик.
// Черновик помнит значения, с которых начался: если документ ушёл от них
// (отмена хода, сброс, «Показать решение»), черновик устарел и панель
// снова показывает документ.

// MODEL

export const Draft = Schema.Struct({
  base: Values,
  values: Values,
  problems: Schema.Array(FieldProblem),
})
export type Draft = typeof Draft.Type

export const Model = Schema.Struct({
  maybeTab: Schema.Option(Schema.String),
  /** Черновики по id вкладки. */
  drafts: Schema.Record(Schema.String, Draft),
  /** Поля-пароли, которые ученик попросил показать. */
  revealed: Schema.Array(Schema.String),
  /** Вкладка, которую только что сохранили: под кнопками «Сохранено». */
  maybeSavedTab: Schema.Option(Schema.String),
  nextRow: Schema.Number,
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  maybeTab: Option.none(),
  drafts: {},
  revealed: [],
  maybeSavedTab: Option.none(),
  nextRow: 1,
}

// MESSAGE

export const Message = defineMessageUnion({
  ClickedTab: { tab: Schema.String },
  UpdatedField: { field: Schema.String, value: Schema.String },
  UpdatedCell: {
    list: Schema.String,
    row: Schema.String,
    column: Schema.String,
    value: Schema.String,
  },
  ClickedAddRow: { list: Schema.String },
  ClickedRemoveRow: { list: Schema.String, row: Schema.String },
  ClickedReveal: { field: Schema.String },
  ClickedCancel: {},
  SubmittedPanel: {},
})
export type Message = typeof Message.Type

export type OutMessage = SurfaceOutMessage<PacketOp>

// CONTEXT

export type Surface = SurfaceContext<PacketTypes>

const nameOf =
  (surface: Surface) =>
  (id: string): string =>
    Option.match(surface.label(id), {
      onNone: () => id,
      onSome: label => label.name,
    })

/** Контекст панели: её устройство есть на доске. */
export const panelContext = (
  definition: PanelDefinition,
  surface: Surface,
): Option.Option<PanelContext> =>
  Option.map(definition.device(surface.doc, surface.target), device => ({
    world: surface.doc,
    run: surface.run,
    device,
    name: nameOf(surface),
  }))

/** Вкладки, которые открыл курс (скрыты, а не заблокированы: план 3.4). */
export const visibleTabs = (
  definition: PanelDefinition,
  unlocked: ReadonlyArray<string>,
): ReadonlyArray<PanelTab> =>
  Array.filter(definition.tabs, tab => Array.contains(unlocked, tab.feature))

export const activeTab = (
  definition: PanelDefinition,
  model: Model,
  unlocked: ReadonlyArray<string>,
): Option.Option<PanelTab> => {
  const tabs = visibleTabs(definition, unlocked)
  return pipe(
    model.maybeTab,
    Option.flatMap(chosen => Array.findFirst(tabs, tab => tab.id === chosen)),
    Option.orElse(() => Array.head(tabs)),
  )
}

/** Черновик вкладки, если он начался с того, что сейчас в документе. */
export const currentDraft = (
  tab: PanelTab,
  context: PanelContext,
  model: Model,
): Option.Option<Draft> =>
  pipe(
    Record.get(model.drafts, tab.id),
    Option.filter(draft => sameValues(draft.base, tab.read(context))),
  )

export const shownValues = (
  tab: PanelTab,
  context: PanelContext,
  model: Model,
): Values =>
  Option.match(currentDraft(tab, context, model), {
    onNone: () => tab.read(context),
    onSome: draft => draft.values,
  })

const isDirty = (draft: Draft): boolean => !sameValues(draft.base, draft.values)

// GHOST

const foldWorld = (world: PacketDoc, ops: ReadonlyArray<PacketOp>): PacketDoc =>
  Array.reduce(ops, world, (current, op) =>
    Result.getOrElse(applyPacketOp(current, op), () => current),
  )

const differentKeys = <A>(
  before: Readonly<Record<string, A>>,
  after: Readonly<Record<string, A>>,
  same: (left: A | undefined, right: A | undefined) => boolean,
): ReadonlyArray<string> =>
  Array.filter(
    Array.dedupe([...Object.keys(before), ...Object.keys(after)]),
    key => !same(before[key], after[key]),
  )

const sameRows = Schema.toEquivalence(Schema.Array(Schema.Unknown))

/** Призрак третьей подсказки: поля и списки вкладки, которые эталон задачи
    меняет. Панель обводит их, не подставляя значений. */
export const ghostPaths = (
  tab: PanelTab,
  context: PanelContext,
  maybeSolution: Option.Option<ReadonlyArray<PacketOp>>,
): ReadonlyArray<string> =>
  Option.match(maybeSolution, {
    onNone: () => [],
    onSome: solution => {
      const world = foldWorld(context.world, solution)
      const before = tab.read(context)
      const after = tab.read({ ...context, world, run: runPacket(world) })
      return [
        ...differentKeys(
          before.fields,
          after.fields,
          (left, right) => left === right,
        ),
        ...differentKeys(before.lists, after.lists, (left, right) =>
          sameRows(left ?? [], right ?? []),
        ),
      ]
    },
  })

// UPDATE

export type Input = Readonly<{
  definition: PanelDefinition
  surface: Surface
}>

export type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage
>

const firstRefusal = (
  world: PacketDoc,
  ops: ReadonlyArray<PacketOp>,
): Option.Option<NetMessage> => {
  const start: Result.Result<PacketDoc, NetMessage> = Result.succeed(world)
  return Result.getFailure(
    Array.reduce(ops, start, (current, op) =>
      Result.flatMap(current, next => applyPacketOp(next, op)),
    ),
  )
}

const withoutProblemsAt = (
  problems: ReadonlyArray<FieldProblem>,
  path: string,
): ReadonlyArray<FieldProblem> =>
  Array.filter(problems, problem =>
    Option.exists(problem.maybePath, problemPath => problemPath !== path),
  )

const fresh = (tab: PanelTab, context: PanelContext): Draft => {
  const base = tab.read(context)
  return { base, values: base, problems: [] }
}

const editDraft = (
  tab: PanelTab,
  context: PanelContext,
  model: Model,
  path: string,
  change: (current: Values) => Values,
): Model => {
  const draft = Option.getOrElse(currentDraft(tab, context, model), () =>
    fresh(tab, context),
  )
  return modifyFields(model, {
    drafts: drafts =>
      Record.set(drafts, tab.id, {
        base: draft.base,
        values: change(draft.values),
        problems: withoutProblemsAt(draft.problems, path),
      }),
    maybeSavedTab: () => Option.none(),
  })
}

const setField = (current: Values, field: string, value: string): Values => ({
  fields: Record.set(current.fields, field, value),
  lists: current.lists,
})

const setRows = (
  current: Values,
  list: string,
  change: (rows: ReadonlyArray<Row>) => ReadonlyArray<Row>,
): Values => ({
  fields: current.fields,
  lists: Record.set(current.lists, list, change(rowsOf(current, list))),
})

const listField = (
  tab: PanelTab,
  context: PanelContext,
  list: string,
): Option.Option<ListField> =>
  Array.findFirst(
    tab.fields(context),
    (field): field is ListField => field._tag === 'List' && field.id === list,
  )

const save = (
  tab: PanelTab,
  context: PanelContext,
  model: Model,
): UpdateReturn =>
  Option.match(Option.filter(currentDraft(tab, context, model), isDirty), {
    onNone: () => ({
      model: modifyFields(model, {
        drafts: drafts => Record.remove(drafts, tab.id),
      }),
    }),
    onSome: draft => {
      const withProblems = (problems: ReadonlyArray<FieldProblem>) => ({
        model: modifyFields(model, {
          drafts: drafts => Record.set(drafts, tab.id, { ...draft, problems }),
        }),
      })
      return Result.match(tab.save(context, draft.values, draft.base), {
        onFailure: withProblems,
        onSuccess: (ops): UpdateReturn =>
          Option.match(firstRefusal(context.world, ops), {
            onSome: message =>
              withProblems([
                refusedAt(
                  Option.flatMap(Option.fromNullishOr(tab.blame), blame =>
                    blame(message),
                  ),
                  message,
                ),
              ]),
            onNone: () => {
              const saved = modifyFields(model, {
                drafts: drafts => Record.remove(drafts, tab.id),
                maybeSavedTab: () => Option.some(tab.id),
              })
              return Array.isReadonlyArrayEmpty(ops)
                ? { model: saved }
                : {
                    model: saved,
                    outMessage: SurfaceOutMessage.ProducedOps(ops),
                  }
            },
          }),
      })
    },
  })

const editTab = (
  input: Input,
  model: Model,
  edit: (tab: PanelTab, context: PanelContext) => UpdateReturn,
): UpdateReturn =>
  input.surface.mode !== 'Edit'
    ? { model }
    : Option.match(
        Option.all({
          context: panelContext(input.definition, input.surface),
          tab: activeTab(input.definition, model, input.surface.unlocked),
        }),
        {
          onNone: () => ({ model }),
          onSome: ({ context, tab }) => edit(tab, context),
        },
      )

export const update =
  (input: Input) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedTab: ({ tab }) => ({
        model: modifyFields(model, {
          maybeTab: () => Option.some(tab),
          maybeSavedTab: () => Option.none(),
        }),
      }),
      ClickedReveal: ({ field }) => ({
        model: modifyFields(model, {
          revealed: revealed =>
            Array.contains(revealed, field)
              ? Array.filter(revealed, other => other !== field)
              : [...revealed, field],
        }),
      }),
      UpdatedField: ({ field, value }) =>
        editTab(input, model, (tab, context) => ({
          model: editDraft(tab, context, model, field, current =>
            setField(current, field, value),
          ),
        })),
      UpdatedCell: ({ list, row, column, value }) =>
        editTab(input, model, (tab, context) => ({
          model: editDraft(
            tab,
            context,
            model,
            cellPath(list, row, column),
            current =>
              setRows(current, list, rows =>
                Array.map(rows, candidate =>
                  candidate.id === row
                    ? {
                        id: candidate.id,
                        cells: Record.set(candidate.cells, column, value),
                      }
                    : candidate,
                ),
              ),
          ),
        })),
      ClickedAddRow: ({ list }) =>
        editTab(input, model, (tab, context) =>
          Option.match(listField(tab, context, list), {
            onNone: () => ({ model }),
            onSome: field => ({
              model: modifyFields(
                editDraft(tab, context, model, list, current =>
                  setRows(current, list, rows => [
                    ...rows,
                    { id: `new-${model.nextRow}`, cells: field.newRow },
                  ]),
                ),
                { nextRow: next => next + 1 },
              ),
            }),
          }),
        ),
      ClickedRemoveRow: ({ list, row }) =>
        editTab(input, model, (tab, context) => ({
          model: editDraft(tab, context, model, list, current =>
            setRows(current, list, rows =>
              Array.filter(rows, candidate => candidate.id !== row),
            ),
          ),
        })),
      ClickedCancel: () =>
        Option.match(
          activeTab(input.definition, model, input.surface.unlocked),
          {
            onNone: () => ({ model }),
            onSome: tab => ({
              model: modifyFields(model, {
                drafts: drafts => Record.remove(drafts, tab.id),
              }),
            }),
          },
        ),
      SubmittedPanel: () =>
        editTab(input, model, (tab, context) => save(tab, context, model)),
    })

// VIEW

export type ViewInput = Input &
  Readonly<{
    locale: Locale
    strings: PanelStrings
    newBadge: string
  }>

type Ctx<ParentMessage> = Readonly<{
  input: ViewInput
  context: PanelContext
  model: Model
  tab: PanelTab
  shown: Values
  ghost: ReadonlyArray<string>
  problems: ReadonlyArray<FieldProblem>
  isEditable: boolean
  send: (message: Message) => ParentMessage
}>

const domId = (tab: PanelTab, path: string): string =>
  `panel-${tab.id}-${path.replaceAll('/', '-')}`

export const problemText = (
  locale: Locale,
  strings: PanelStrings,
  name: (id: string) => string,
  problem: PanelProblem,
): string =>
  problem._tag === 'Refused'
    ? renderNetMessage(locale, problem.message, name)
    : problem._tag === 'Required'
      ? strings.required
      : strings.notANumber(problem.value)

const problemsAt = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  path: string,
): ReadonlyArray<FieldProblem> =>
  Array.filter(ctx.problems, problem =>
    Option.exists(problem.maybePath, problemPath => problemPath === path),
  )

const errorsView = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  path: string,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> =>
  Array.match(problemsAt(ctx, path), {
    onEmpty: () => [],
    onNonEmpty: problems => [
      h.p(
        [h.Id(`${domId(ctx.tab, path)}-error`), h.Class('panel-error')],
        [
          Array.map(problems, problem =>
            problemText(
              ctx.input.locale,
              ctx.input.strings,
              ctx.context.name,
              problem.problem,
            ),
          ).join(' '),
        ],
      ),
    ],
  })

const invalidAttributes = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  path: string,
  h: HtmlBuilder<ParentMessage>,
) =>
  Array.isReadonlyArrayNonEmpty(problemsAt(ctx, path))
    ? [h.AriaInvalid(true), h.AriaDescribedBy(`${domId(ctx.tab, path)}-error`)]
    : []

const isGhost = <ParentMessage>(ctx: Ctx<ParentMessage>, id: string) =>
  Array.contains(ctx.ghost, id)

const ghostAttributes = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  id: string,
  h: HtmlBuilder<ParentMessage>,
) => (isGhost(ctx, id) ? [h.AriaDescription(ctx.input.strings.ghost)] : [])

const isEnabled = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  field: Readonly<{ enabled?: (current: Values) => boolean }>,
): boolean =>
  ctx.isEditable && (field.enabled === undefined || field.enabled(ctx.shown))

const inputType = (input: InputKind, isRevealed: boolean): string =>
  input === 'password' ? (isRevealed ? 'text' : 'password') : 'text'

const inputMode = (input: InputKind): string =>
  input === 'port' || input === 'number'
    ? 'numeric'
    : input === 'ip' || input === 'cidr'
      ? 'decimal'
      : 'text'

const fieldClass = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  id: string,
  extra: string,
): string =>
  [
    'panel-field',
    extra,
    isGhost(ctx, id) ? 'ghost' : '',
    Array.isReadonlyArrayNonEmpty(problemsAt(ctx, id)) ? 'invalid' : '',
  ]
    .filter(part => part !== '')
    .join(' ')

type Control<ParentMessage> = Readonly<{
  path: string
  value: string
  enabled: boolean
  naming: ReadonlyArray<Attribute<ParentMessage>>
  onValue: (value: string) => ParentMessage
}>

const controlAttributes = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  control: Control<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Attribute<ParentMessage>> => [
  h.Id(domId(ctx.tab, control.path)),
  ...control.naming,
  ...invalidAttributes(ctx, control.path, h),
  ...ghostAttributes(ctx, control.path, h),
]

const inputControl = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  field: InputField,
  control: Control<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const isRevealed = Array.contains(ctx.model.revealed, control.path)
  return h.div(
    [h.Class('panel-control')],
    [
      h.input([
        ...controlAttributes(ctx, control, h),
        h.Type(inputType(field.input, isRevealed)),
        h.Value(control.value),
        h.InputMode(inputMode(field.input)),
        h.Autocomplete('off'),
        h.Spellcheck(false),
        ...Option.match(Option.fromNullishOr(field.placeholder), {
          onNone: () => [],
          onSome: placeholder => [
            h.Placeholder(placeholder(ctx.input.strings)),
          ],
        }),
        ...(control.enabled
          ? [h.OnInput(control.onValue)]
          : [h.Disabled(true)]),
      ]),
      ...(field.input === 'password'
        ? [
            h.button(
              [
                h.Type('button'),
                h.Class('btn link panel-reveal'),
                h.AriaPressed(isRevealed ? 'true' : 'false'),
                h.AriaControls(domId(ctx.tab, control.path)),
                h.OnClick(
                  ctx.send(Message.ClickedReveal({ field: control.path })),
                ),
              ],
              [isRevealed ? ctx.input.strings.hide : ctx.input.strings.show],
            ),
          ]
        : []),
    ],
  )
}

const selectControl = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  field: SelectField | SegmentedField,
  control: Control<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.select(
    [
      ...controlAttributes(ctx, control, h),
      ...(control.enabled ? [h.OnChange(control.onValue)] : [h.Disabled(true)]),
    ],
    Array.map(field.choices, option =>
      h.keyed('option')(
        option.value,
        [h.Value(option.value), h.Selected(option.value === control.value)],
        [option.label(ctx.input.strings)],
      ),
    ),
  )

const segmentedControl = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  field: SegmentedField,
  control: Control<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.div(
    [
      ...controlAttributes(ctx, control, h),
      h.Role('radiogroup'),
      h.Class('panel-segmented'),
    ],
    Array.map(field.choices, option =>
      h.keyed('button')(
        option.value,
        [
          h.Type('button'),
          h.Role('radio'),
          h.AriaChecked(option.value === control.value),
          h.Class(
            option.value === control.value ? 'segment checked' : 'segment',
          ),
          ...(control.enabled
            ? [h.OnClick(control.onValue(option.value))]
            : [h.Disabled(true)]),
        ],
        [option.label(ctx.input.strings)],
      ),
    ),
  )

const checkControl = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  control: Control<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.input([
    ...controlAttributes(ctx, control, h),
    h.Type('checkbox'),
    h.Checked(isOn(control.value)),
    ...(control.enabled
      ? [h.OnClick(control.onValue(onOff(!isOn(control.value))))]
      : [h.Disabled(true)]),
  ])

const infoControl = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  control: Control<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.span(
    [
      h.Id(domId(ctx.tab, control.path)),
      h.Class('panel-value'),
      ...control.naming,
    ],
    [control.value === '' ? '—' : control.value],
  )

const controlView = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  field: ScalarField,
  control: Control<ParentMessage>,
  isInList: boolean,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  Match.valueTags(field, {
    Input: input => inputControl(ctx, input, control, h),
    Select: select => selectControl(ctx, select, control, h),
    Segmented: segmented =>
      isInList
        ? selectControl(ctx, segmented, control, h)
        : segmentedControl(ctx, segmented, control, h),
    Check: () => checkControl(ctx, control, h),
    Info: () => infoControl(ctx, control, h),
  })

const scalarFieldView = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  field: ScalarField,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const id = domId(ctx.tab, field.id)
  const label = field.label(ctx.input.strings)
  const control = (
    naming: ReadonlyArray<Attribute<ParentMessage>>,
  ): Control<ParentMessage> => ({
    path: field.id,
    value: fieldOf(ctx.shown, field.id),
    enabled: field._tag !== 'Info' && isEnabled(ctx, field),
    naming,
    onValue: value =>
      ctx.send(Message.UpdatedField({ field: field.id, value })),
  })
  const labelId = `${id}-label`
  return Match.valueTags(field, {
    Check: () =>
      h.div(
        [h.Class(fieldClass(ctx, field.id, 'panel-check'))],
        [
          h.label(
            [h.For(id)],
            [controlView(ctx, field, control([]), false, h), label],
          ),
          ...errorsView(ctx, field.id, h),
        ],
      ),
    Segmented: () =>
      h.div(
        [h.Class(fieldClass(ctx, field.id, ''))],
        [
          h.span([h.Id(labelId), h.Class('panel-label')], [label]),
          controlView(
            ctx,
            field,
            control([h.AriaLabelledBy(labelId)]),
            false,
            h,
          ),
          ...errorsView(ctx, field.id, h),
        ],
      ),
    Info: () =>
      h.div(
        [h.Class('panel-field panel-info')],
        [
          h.span([h.Id(labelId), h.Class('panel-label')], [label]),
          controlView(
            ctx,
            field,
            control([h.AriaLabelledBy(labelId)]),
            false,
            h,
          ),
        ],
      ),
    Input: input => labelledView(ctx, input, label, control([]), h),
    Select: select => labelledView(ctx, select, label, control([]), h),
  })
}

const labelledView = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  field: InputField | SelectField,
  label: string,
  control: Control<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.div(
    [h.Class(fieldClass(ctx, field.id, ''))],
    [
      h.label(
        [h.For(domId(ctx.tab, field.id)), h.Class('panel-label')],
        [label],
      ),
      controlView(ctx, field, control, false, h),
      ...errorsView(ctx, field.id, h),
    ],
  )

const listFieldView = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  field: ListField,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const labelId = `${domId(ctx.tab, field.id)}-label`
  const enabled = isEnabled(ctx, field)
  const isFixed = field.fixed === true
  const strings = ctx.input.strings
  return h.div(
    [h.Class(fieldClass(ctx, field.id, 'panel-list'))],
    [
      h.p(
        [
          h.Id(labelId),
          h.Class('panel-label'),
          ...ghostAttributes(ctx, field.id, h),
        ],
        [field.label(strings)],
      ),
      Array.match(rowsOf(ctx.shown, field.id), {
        onEmpty: () => h.p([h.Class('panel-empty')], [strings.emptyList]),
        onNonEmpty: rows =>
          h.table(
            [h.Class('panel-table'), h.AriaLabelledBy(labelId)],
            [
              h.thead(
                [],
                [
                  h.tr(
                    [],
                    [
                      ...Array.map(field.columns, column =>
                        h.keyed('th')(
                          column.id,
                          [h.Scope('col')],
                          [column.label(strings)],
                        ),
                      ),
                      ...(isFixed ? [] : [h.th([h.Scope('col')])]),
                    ],
                  ),
                ],
              ),
              h.tbody(
                [],
                Array.map(rows, (row, index) =>
                  h.keyed('tr')(
                    row.id,
                    [],
                    [
                      ...Array.map(field.columns, column => {
                        const path = cellPath(field.id, row.id, column.id)
                        const columnLabel = column.label(strings)
                        return h.keyed('td')(
                          column.id,
                          [h.DataAttribute('label', columnLabel)],
                          [
                            controlView(
                              ctx,
                              column,
                              {
                                path,
                                value: cellOf(row, column.id),
                                enabled:
                                  enabled &&
                                  column._tag !== 'Info' &&
                                  isEnabled(ctx, column),
                                naming: [
                                  h.AriaLabel(
                                    strings.cell(columnLabel, index + 1),
                                  ),
                                ],
                                onValue: value =>
                                  ctx.send(
                                    Message.UpdatedCell({
                                      list: field.id,
                                      row: row.id,
                                      column: column.id,
                                      value,
                                    }),
                                  ),
                              },
                              true,
                              h,
                            ),
                            ...errorsView(ctx, path, h),
                          ],
                        )
                      }),
                      ...(isFixed
                        ? []
                        : [
                            h.td(
                              [h.Class('panel-row-actions')],
                              [
                                h.button(
                                  [
                                    h.Type('button'),
                                    h.Class('btn link'),
                                    h.AriaLabel(strings.removeRow(index + 1)),
                                    ...(enabled
                                      ? [
                                          h.OnClick(
                                            ctx.send(
                                              Message.ClickedRemoveRow({
                                                list: field.id,
                                                row: row.id,
                                              }),
                                            ),
                                          ),
                                        ]
                                      : [h.Disabled(true)]),
                                  ],
                                  ['×'],
                                ),
                              ],
                            ),
                          ]),
                    ],
                  ),
                ),
              ),
            ],
          ),
      }),
      ...errorsView(ctx, field.id, h),
      ...(isFixed
        ? []
        : [
            h.button(
              [
                h.Type('button'),
                h.Class('btn panel-add'),
                ...(enabled
                  ? [
                      h.OnClick(
                        ctx.send(Message.ClickedAddRow({ list: field.id })),
                      ),
                    ]
                  : [h.Disabled(true)]),
              ],
              [strings.addRow],
            ),
          ]),
    ],
  )
}

const tableFieldView = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  field: TableField,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const labelId = `${domId(ctx.tab, field.id)}-label`
  const strings = ctx.input.strings
  return h.div(
    [h.Class('panel-field panel-list')],
    [
      h.p([h.Id(labelId), h.Class('panel-label')], [field.label(strings)]),
      Array.match(rowsOf(ctx.shown, field.id), {
        onEmpty: () => h.p([h.Class('panel-empty')], [field.empty(strings)]),
        onNonEmpty: rows =>
          h.table(
            [h.Class('panel-table readonly'), h.AriaLabelledBy(labelId)],
            [
              h.thead(
                [],
                [
                  h.tr(
                    [],
                    Array.map(field.columns, column =>
                      h.keyed('th')(
                        column.id,
                        [h.Scope('col')],
                        [column.label(strings)],
                      ),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                Array.map(rows, row =>
                  h.keyed('tr')(
                    row.id,
                    [],
                    Array.map(field.columns, column =>
                      h.keyed('td')(
                        column.id,
                        [h.DataAttribute('label', column.label(strings))],
                        [
                          Option.match(Option.fromNullishOr(column.format), {
                            onNone: () => cellOf(row, column.id),
                            onSome: format =>
                              format(strings, cellOf(row, column.id)),
                          }),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
      }),
    ],
  )
}

const fieldView = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  field: Field,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  Match.valueTags(field, {
    List: list => listFieldView(ctx, list, h),
    Table: table => tableFieldView(ctx, table, h),
    Note: note =>
      note.tone === 'section'
        ? h.h4([h.Class('panel-section')], [note.text(ctx.input.strings)])
        : h.p(
            [h.Class(`panel-note ${note.tone}`), h.Role('status')],
            [note.text(ctx.input.strings)],
          ),
    Input: scalar => scalarFieldView(ctx, scalar, h),
    Select: scalar => scalarFieldView(ctx, scalar, h),
    Segmented: scalar => scalarFieldView(ctx, scalar, h),
    Check: scalar => scalarFieldView(ctx, scalar, h),
    Info: scalar => scalarFieldView(ctx, scalar, h),
  })

const isEditableField = (field: Field): boolean =>
  field._tag !== 'Info' && field._tag !== 'Table' && field._tag !== 'Note'

/** Пути полей вкладки, у которых есть свой элемент: остальные проблемы
    показываются под формой. */
const fieldPaths = (
  fields: ReadonlyArray<Field>,
  shown: Values,
): ReadonlyArray<string> =>
  Array.flatMap(fields, field =>
    field._tag === 'List'
      ? [
          field.id,
          ...Array.flatMap(rowsOf(shown, field.id), row =>
            Array.map(field.columns, column =>
              cellPath(field.id, row.id, column.id),
            ),
          ),
        ]
      : isEditableField(field)
        ? [field.id]
        : [],
  )

const tabsView = <ParentMessage>(
  input: ViewInput,
  model: Model,
  context: PanelContext,
  tabs: ReadonlyArray<PanelTab>,
  active: PanelTab,
  send: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.div(
    [
      h.Class('panel-tabs'),
      h.Role('tablist'),
      h.AriaLabel(input.strings.tabsLabel),
      h.AriaOrientation('vertical'),
    ],
    Array.map(tabs, tab => {
      const isActive = tab.id === active.id
      const isNew = Array.contains(input.surface.newFeatures, tab.feature)
      const hasGhost = Array.isReadonlyArrayNonEmpty(
        ghostPaths(tab, context, input.surface.maybeGhost),
      )
      const isDirtyTab = Option.exists(
        currentDraft(tab, context, model),
        isDirty,
      )
      return h.keyed('button')(
        tab.id,
        [
          h.Type('button'),
          h.Role('tab'),
          h.Id(`panel-tab-${tab.id}`),
          h.AriaSelected(isActive),
          h.AriaControls('panel-tabpanel'),
          h.Class(
            ['panel-tab', isActive ? 'active' : '', hasGhost ? 'ghost' : '']
              .filter(part => part !== '')
              .join(' '),
          ),
          h.OnClick(send(Message.ClickedTab({ tab: tab.id }))),
        ],
        [
          h.span([], [tab.label(input.strings)]),
          ...(isDirtyTab
            ? [h.span([h.Class('panel-dirty'), h.AriaHidden(true)], ['•'])]
            : []),
          ...(isNew
            ? [' ', h.span([h.Class('badge-new')], [input.newBadge])]
            : []),
        ],
      )
    }),
  )

const formView = <ParentMessage>(
  ctx: Ctx<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const fields = ctx.tab.fields(ctx.context)
  const paths = fieldPaths(fields, ctx.shown)
  const looseProblems = Array.filter(
    ctx.problems,
    problem =>
      !Option.exists(problem.maybePath, path => Array.contains(paths, path)),
  )
  const maybeDraft = Option.filter(
    currentDraft(ctx.tab, ctx.context, ctx.model),
    isDirty,
  )
  const canAct = ctx.isEditable && Option.isSome(maybeDraft)
  const strings = ctx.input.strings
  return h.form(
    [
      h.Class('panel-form'),
      h.Id('panel-tabpanel'),
      h.Role('tabpanel'),
      h.AriaLabelledBy(`panel-tab-${ctx.tab.id}`),
      h.Novalidate(true),
      h.OnSubmit(ctx.send(Message.SubmittedPanel())),
    ],
    [
      ...(ctx.isEditable
        ? []
        : [h.p([h.Class('panel-note info')], [strings.readOnly])]),
      ...Array.map(fields, field => fieldView(ctx, field, h)),
      ...Array.map(looseProblems, problem =>
        h.p(
          [h.Class('panel-error'), h.Role('alert')],
          [
            problemText(
              ctx.input.locale,
              strings,
              ctx.context.name,
              problem.problem,
            ),
          ],
        ),
      ),
      ...(Array.some(fields, isEditableField)
        ? [
            h.div(
              [h.Class('panel-actions')],
              [
                ...(Option.exists(
                  ctx.model.maybeSavedTab,
                  saved => saved === ctx.tab.id,
                )
                  ? [
                      h.span(
                        [h.Class('panel-saved'), h.Role('status')],
                        [strings.saved],
                      ),
                    ]
                  : []),
                h.button(
                  [
                    h.Type('button'),
                    h.Class('btn'),
                    ...(canAct
                      ? [h.OnClick(ctx.send(Message.ClickedCancel()))]
                      : [h.Disabled(true)]),
                  ],
                  [strings.cancel],
                ),
                h.button(
                  [
                    h.Type('submit'),
                    h.Class('btn primary'),
                    ...(canAct ? [] : [h.Disabled(true)]),
                  ],
                  [
                    Option.match(Option.fromNullishOr(ctx.tab.saveLabel), {
                      onNone: () => strings.save,
                      onSome: label => label(strings),
                    }),
                  ],
                ),
              ],
            ),
          ]
        : []),
    ],
  )
}

export const view = <ParentMessage>(
  input: ViewInput,
  model: Model,
  send: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  Option.match(panelContext(input.definition, input.surface), {
    onNone: () =>
      h.div(
        [h.Class('panel')],
        [h.p([h.Class('panel-note info')], [input.strings.noDevice])],
      ),
    onSome: context => {
      const tabs = visibleTabs(input.definition, input.surface.unlocked)
      return Option.match(
        activeTab(input.definition, model, input.surface.unlocked),
        {
          onNone: () => h.empty,
          onSome: tab => {
            const shown = shownValues(tab, context, model)
            const ctx: Ctx<ParentMessage> = {
              input,
              context,
              model,
              tab,
              shown,
              ghost: Array.filter(
                ghostPaths(tab, context, input.surface.maybeGhost),
                path => !isInfoPath(tab.fields(context), path),
              ),
              problems: Option.match(currentDraft(tab, context, model), {
                onNone: () => [],
                onSome: draft => draft.problems,
              }),
              isEditable: input.surface.mode === 'Edit',
              send,
            }
            return h.div(
              [h.Class('panel')],
              [
                h.p(
                  [h.Class('panel-heading')],
                  [input.definition.heading(context, input.strings)],
                ),
                h.div(
                  [h.Class('panel-body')],
                  [
                    tabsView(input, model, context, tabs, tab, send, h),
                    formView(ctx, h),
                  ],
                ),
              ],
            )
          },
        },
      )
    },
  })

const isInfoPath = (fields: ReadonlyArray<Field>, path: string): boolean =>
  Array.some(
    fields,
    field =>
      field.id === path && !isEditableField(field) && field._tag !== 'Note',
  )
