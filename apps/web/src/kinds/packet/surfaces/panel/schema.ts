import { Array, Option, Result, Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import type { PanelStrings } from '../../../../i18n/ui/panel/types'
import { NetMessage } from '../../../../net/message'
import type { DeviceId } from '../../../../net/model'
import type { PacketDoc, PacketOp, PacketRun } from '../../doc'

// «Панель по схеме» (план 3.2, изменение add-settings-panel): автор панели
// описывает вкладки и поля, чтение значений из документа и сохранение в
// операции `NetOp`. Компонент `panel.ts` по этому описанию рисует форму,
// держит черновик, проверяет ввод и отдаёт ходы в журнал задачи.

// VALUES

/** Строка списка: `id` — стабильный ключ строки (из модели или новый). */
export const Row = Schema.Struct({
  id: Schema.String,
  cells: Schema.Record(Schema.String, Schema.String),
})
export type Row = typeof Row.Type

/** Значения вкладки строками, как их видит форма: поле — строка, список —
    строки с ячейками. */
export const Values = Schema.Struct({
  fields: Schema.Record(Schema.String, Schema.String),
  lists: Schema.Record(Schema.String, Schema.Array(Row)),
})
export type Values = typeof Values.Type

export const sameValues = Schema.toEquivalence(Values)

export const values = (
  fields: Readonly<Record<string, string>>,
  lists: Readonly<Record<string, ReadonlyArray<Row>>> = {},
): Values => ({ fields, lists })

export const fieldOf = (current: Values, id: string): string =>
  current.fields[id] ?? ''

export const rowsOf = (current: Values, id: string): ReadonlyArray<Row> =>
  current.lists[id] ?? []

export const cellOf = (row: Row, column: string): string =>
  row.cells[column] ?? ''

// PROBLEMS

/** Почему ввод не сохранился. `Refused` — код модели пакетов (отказ
    операции или неверный адрес), остальное модель не проверяет. */
export const PanelProblem = defineTaggedUnion({
  Refused: { message: NetMessage },
  Required: {},
  NotANumber: { value: Schema.String },
})
export type PanelProblem = typeof PanelProblem.Type

/** Проблема у поля (`ssid`), у ячейки (`forwards/<строка>/port`) или у
    вкладки в целом. */
export const FieldProblem = Schema.Struct({
  maybePath: Schema.Option(Schema.String),
  problem: PanelProblem,
})
export type FieldProblem = typeof FieldProblem.Type

export const cellPath = (list: string, row: string, column: string): string =>
  `${list}/${row}/${column}`

export const problemAt = (
  path: string,
  problem: PanelProblem,
): FieldProblem => ({ maybePath: Option.some(path), problem })

export const refusedAt = (
  maybePath: Option.Option<string>,
  message: NetMessage,
): FieldProblem => ({
  maybePath,
  problem: PanelProblem.Refused({ message }),
})

/** Итог проверки поля или всей вкладки. */
export type Check<A> = Result.Result<A, ReadonlyArray<FieldProblem>>

/** Все проверки записи разом: ученик видит все ошибки, а не первую. */
export const gather = <
  const Checks extends Readonly<Record<string, Check<unknown>>>,
>(
  checks: Checks,
) => {
  const problems = Array.flatten(Array.getFailures(Object.values(checks)))
  return Array.isReadonlyArrayNonEmpty(problems)
    ? Result.fail(problems)
    : Result.all(checks)
}

export const gatherAll = <A>(
  checks: ReadonlyArray<Check<A>>,
): Check<ReadonlyArray<A>> => {
  const problems = Array.flatten(Array.getFailures(checks))
  return Array.isReadonlyArrayNonEmpty(problems)
    ? Result.fail(problems)
    : Result.succeed(Array.getSuccesses(checks))
}

// FIELDS

export type Text = (strings: PanelStrings) => string

export type Choice = Readonly<{ value: string; label: Text }>

/** Вид текстового поля: от него зависят клавиатура телефона и проверка. */
export type InputKind = 'text' | 'password' | 'ip' | 'cidr' | 'port' | 'number'

type Enabled = Readonly<{
  /** Поле доступно, только пока черновик это позволяет. */
  enabled?: (current: Values) => boolean
}>

export type InputField = Enabled &
  Readonly<{
    _tag: 'Input'
    id: string
    label: Text
    input: InputKind
    placeholder?: Text
  }>

export type SelectField = Enabled &
  Readonly<{
    _tag: 'Select'
    id: string
    label: Text
    choices: ReadonlyArray<Choice>
  }>

/** Переключатель из двух-трёх вариантов кнопками (`role=radio`). */
export type SegmentedField = Enabled &
  Readonly<{
    _tag: 'Segmented'
    id: string
    label: Text
    choices: ReadonlyArray<Choice>
  }>

/** Флажок: значение `on` или пустая строка. */
export type CheckField = Enabled &
  Readonly<{ _tag: 'Check'; id: string; label: Text }>

/** Значение только для чтения. */
/** Значение только для показа. `isDevice`: в значении id устройства, а
    показывается его имя с подписью урока — так `read` не зависит от языка
    и подписей, и черновик панели не сбрасывается. */
export type InfoField = Readonly<{
  _tag: 'Info'
  id: string
  label: Text
  isDevice?: boolean
}>

export type ScalarField =
  | InputField
  | SelectField
  | SegmentedField
  | CheckField
  | InfoField

/** Список строк с ячейками; `fixed` — строки задаёт модель, добавлять и
    удалять их нельзя. */
export type ListField = Enabled &
  Readonly<{
    _tag: 'List'
    id: string
    label: Text
    columns: ReadonlyArray<ScalarField>
    newRow: Readonly<Record<string, string>>
    fixed?: boolean
  }>

/** Таблица только для чтения: строки — `values.lists[id]`. */
export type TableField = Readonly<{
  _tag: 'Table'
  id: string
  label: Text
  columns: ReadonlyArray<TableColumn>
  empty: Text
}>

/** Колонка таблицы: `format` переводит код ячейки (`cable`) в текст. */
export type TableColumn = Readonly<{
  id: string
  label: Text
  format?: (strings: PanelStrings, value: string) => string
}>

/** Пояснение над полями: тон `warn` — что-то ждёт действия, `section` —
    заголовок группы полей (сервис compose). */
export type NoteField = Readonly<{
  _tag: 'Note'
  id: string
  text: Text
  tone: 'info' | 'warn' | 'section'
}>

export type Field = ScalarField | ListField | TableField | NoteField

export const choice = (value: string, label: Text): Choice => ({
  value,
  label,
})

export const ON = 'on'

export const isOn = (value: string): boolean => value === ON

export const onOff = (flag: boolean): string => (flag ? ON : '')

// PANEL

/** Что панель знает о доске: мир, расчёт, своё устройство и подписи. */
export type PanelContext = Readonly<{
  world: PacketDoc
  run: PacketRun
  device: DeviceId
  name: (id: DeviceId) => string
}>

export type PanelTab = Readonly<{
  id: string
  /** Элемент `UiFeature`: вкладка видна, только когда курс его открыл. */
  feature: string
  label: Text
  fields: (context: PanelContext) => ReadonlyArray<Field>
  /** Значения вкладки по документу. */
  read: (context: PanelContext) => Values
  /** Черновик → операции. `base` — значения, с которых начался черновик:
      по ним считается, что ученик поменял. */
  save: (
    context: PanelContext,
    draft: Values,
    base: Values,
  ) => Check<ReadonlyArray<PacketOp>>
  /** К какому полю отнести отказ модели при сохранении. */
  blame?: (message: NetMessage) => Option.Option<string>
  /** Подпись кнопки сохранения, если это не «Сохранить» («Выпустить»). */
  saveLabel?: Text
}>

export type PanelDefinition = Readonly<{
  /** Начало id поверхности: `router`, `server` у `server:vps`. */
  type: string
  /** Префикс `UiFeature`: поверхность видна, если открыта хоть одна вкладка. */
  feature: string
  /** Устройство панели по id поверхности (`vps` у `server:vps`) или по доске. */
  device: (world: PacketDoc, target: string) => Option.Option<DeviceId>
  /** Подпись вкладки поверхности; `target` — устройство из id поверхности,
      если его ещё нет на доске. */
  tabLabel: (
    maybeContext: Option.Option<PanelContext>,
    strings: PanelStrings,
    target: string,
  ) => string
  heading: (context: PanelContext, strings: PanelStrings) => string
  tabs: ReadonlyArray<PanelTab>
}>
