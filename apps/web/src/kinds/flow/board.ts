import { Option, Schema } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import * as Board from '../../board/board'
import type { BoardDoc, BoardOp } from '../../domain/board'
import { Anim, initialAnim, tick } from '../../lesson/anim'
import { type BoardMode, BoardOutMessage } from '../contract'
import { Message } from './message'

// Подмодуль доски System Design: редактор схемы и анимация потоков с
// кнопками «Пауза» и «Скорость».

// MODEL

export const Model = Schema.Struct({ editor: Board.Model, anim: Anim })
export type Model = typeof Model.Type

export const initialModel: Model = {
  editor: Board.initialModel,
  anim: initialAnim,
}

export { Message } from './message'

export type OutMessage = BoardOutMessage<BoardOp>

// UPDATE

export type Input = Readonly<{
  doc: BoardDoc
  mode: BoardMode
  pickable: ReadonlyArray<string>
}>

export type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage
>

const editorInput = ({ doc, mode, pickable }: Input): Board.Input => ({
  doc,
  isEditable: mode === 'Edit',
  pickable: mode === 'Pick' ? pickable : [],
})

const editorAdapters = {
  read: (model: Model) => Option.some(model.editor),
  write: (model: Model, nextEditor: Board.Model) =>
    modifyFields(model, { editor: () => nextEditor }),
  toParentMessage: (message: Board.Message) =>
    Message.GotEditorMessage({ message }),
  toParentOutMessage: (outMessage: Board.OutMessage): OutMessage =>
    Board.OutMessage.match(outMessage, {
      ProposedOp: ({ op }) => BoardOutMessage.ProposedOps<BoardOp>([op]),
      PickedNode: ({ id }) => BoardOutMessage.PickedTarget<BoardOp>(id),
    }),
}

export const update =
  (input: Input) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      GotEditorMessage: ({ message: editorMessage }) =>
        Update.foldChild({
          update: Board.update(editorInput(input)),
          ...editorAdapters,
        })(model, editorMessage),
      ClickedPlayPause: () => ({
        model: modifyFields(model, {
          anim: anim =>
            modifyFields(anim, { isRunning: isRunning => !isRunning }),
        }),
      }),
      ClickedSpeed: ({ speed }) => ({
        model: modifyFields(model, {
          anim: anim => modifyFields(anim, { speed: () => speed }),
        }),
      }),
    })

export const pressDelete =
  (input: Input) =>
  (model: Model): UpdateReturn =>
    Update.foldChildStep({
      update: Board.pressDeleteKey(editorInput(input)),
      ...editorAdapters,
    })(model)

export const interrupt = (model: Model): Model =>
  modifyFields(model, { editor: () => Board.initialModel })

export const frame = (
  model: Model,
  deltaMs: number,
  input: Readonly<{ doc: BoardDoc; isReducedMotion: boolean }>,
): Model =>
  modifyFields(model, {
    anim: anim => tick(anim, deltaMs, input.doc, input.isReducedMotion),
  })
