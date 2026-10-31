import { Array, Option, Schema } from 'effect'
import type { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { type BoardInput, BoardOutMessage } from '../contract'
import type { ScenarioTypes } from '../types'
import type { ScenarioDoc, ScenarioOp } from './doc'
import { Message, TrapField } from './message'

export { Message, TrapField } from './message'

// Подмодуль доски вида «сценарий»: открытая табличка на кадре, поля
// страницы-двойника и выбор места на экране в квизе.
//
// Страница-двойник (design D8): Model знает о полях только «заполнено» или
// «пусто». Текст из полей превращается в флаг ещё в виде (`OnInput`), поэтому
// он не попадает ни в сообщения, ни в Model, ни в журнал, ни в команды.

// MODEL

/** Сколько «до сгорания приза» показывает таймер страницы-двойника. */
export const TRAP_CLOCK_MS = 5 * 60 * 1000

export const Model = Schema.Struct({
  isSignOpen: Schema.Boolean,
  isEmailFilled: Schema.Boolean,
  isPasswordFilled: Schema.Boolean,
  /** «Войти» с пустым полем: какое поле подсказать, как настоящая страница. */
  maybeMissing: Schema.Option(TrapField),
  trapClockMs: Schema.Number,
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  isSignOpen: false,
  isEmailFilled: false,
  isPasswordFilled: false,
  maybeMissing: Option.none(),
  trapClockMs: TRAP_CLOCK_MS,
}

export type OutMessage = BoardOutMessage<ScenarioOp>

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

// UPDATE

const forgetFields = (model: Model): Model =>
  modifyFields(model, {
    isEmailFilled: () => false,
    isPasswordFilled: () => false,
    maybeMissing: () => Option.none(),
  })

const isPickable = (input: BoardInput<ScenarioTypes>, spot: string): boolean =>
  input.mode === 'Pick' && Array.contains(input.pickable, spot)

const pick = (model: Model, spot: string): UpdateReturn => ({
  model: forgetFields(model),
  outMessage: BoardOutMessage.PickedTarget<ScenarioOp>(spot),
})

export const update =
  (input: BoardInput<ScenarioTypes>) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedSign: () => ({
        model: modifyFields(model, { isSignOpen: isOpen => !isOpen }),
      }),
      ClickedCloseSign: () => ({
        model: modifyFields(model, { isSignOpen: () => false }),
      }),
      UpdatedTrapField: ({ field, isFilled }) => ({
        model: modifyFields(model, {
          isEmailFilled: filled => (field === 'email' ? isFilled : filled),
          isPasswordFilled: filled =>
            field === 'password' ? isFilled : filled,
          maybeMissing: missing =>
            Option.exists(missing, wanted => wanted === field)
              ? Option.none()
              : missing,
        }),
      }),
      ClickedTrapSkip: () =>
        isPickable(input, 'skip') ? pick(model, 'skip') : { model },
      ClickedTrapLogin: () =>
        !isPickable(input, 'login')
          ? { model }
          : !model.isEmailFilled
            ? {
                model: modifyFields(model, {
                  maybeMissing: () => Option.some<TrapField>('email'),
                }),
              }
            : !model.isPasswordFilled
              ? {
                  model: modifyFields(model, {
                    maybeMissing: () => Option.some<TrapField>('password'),
                  }),
                }
              : pick(model, 'login'),
      ClickedSpot: ({ spot }) =>
        isPickable(input, spot) ? pick(model, spot) : { model },
    })

export const pressDelete =
  (_input: BoardInput<ScenarioTypes>) =>
  (model: Model): UpdateReturn => ({ model })

/** Шаг сменился: табличка закрыта, поля страницы забыты. */
export const interrupt = (model: Model): Model =>
  modifyFields(forgetFields(model), { isSignOpen: () => false })

/** Таймер приза на странице-двойнике: приманка «торопит». Идёт по кругу и
    ничего не листает. */
export const frame = (
  model: Model,
  deltaMs: number,
  input: Readonly<{ doc: ScenarioDoc; isReducedMotion: boolean }>,
): Model =>
  input.doc.scene._tag !== 'Trap'
    ? model
    : modifyFields(model, {
        trapClockMs: left =>
          left - deltaMs > 0 ? left - deltaMs : TRAP_CLOCK_MS,
      })
