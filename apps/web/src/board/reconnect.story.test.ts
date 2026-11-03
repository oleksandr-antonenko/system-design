import { Option, Result } from 'effect'
import {
  expectNoOutMessage,
  expectOutMessage,
  given,
  message,
  model,
  story,
} from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import {
  type BoardDoc,
  BoardOp,
  applyOp,
  emptyBoard,
  foldOps,
} from '../domain/board'
import { addNode, connect } from '../kinds/flow/dsl'
import { flow } from '../kinds/flow/kind'
import * as Board from './board'

// Перенос конца связи (draggable links): тянуть ручку на конце выделенной
// связи к другому блоку или выбрать блок с клавиатуры. Одна операция
// `Reconnect` — одна строка журнала и одна отмена.

const doc: BoardDoc = foldOps(emptyBoard, [
  addNode('users', 'client', 100, 280),
  addNode('app1', 'server', 400, 160),
  addNode('app2', 'server', 400, 400),
  addNode('db', 'db', 790, 280),
  connect('users', 'app1'),
  connect('app1', 'db'),
])

const update = Board.update({ doc, isEditable: true })

const point = (x: number, y: number) => ({ x, y })

const selected = {
  ...Board.initialModel,
  maybeSelection: Option.some(
    Board.Selection.Edge({ from: 'users', to: 'app1' }),
  ),
}

const refusalOf = (op: BoardOp): string =>
  Result.match(applyOp(doc, op), {
    onSuccess: () => 'accepted',
    onFailure: refusal => refusal._tag,
  })

describe('dragging an end of a connection', () => {
  test('the end dropped on another block proposes one Reconnect', () => {
    story(
      update,
      given(selected),
      message(
        Board.Message.PressedPointer({
          target: Board.PointerTarget.EdgeEnd({
            from: 'users',
            to: 'app1',
            end: 'to',
          }),
          point: point(323, 160),
        }),
      ),
      model(next => {
        expect(next.gesture._tag).toBe('Reconnecting')
      }),
      message(
        Board.Message.MovedPointer({
          point: point(360, 400),
          isOverBoard: true,
        }),
      ),
      message(
        Board.Message.ReleasedPointer({
          target: Board.PointerTarget.Node({ id: 'app2' }),
          point: point(380, 400),
          isOverBoard: true,
        }),
      ),
      expectOutMessage(
        Board.OutMessage.ProposedOp({
          op: BoardOp.Reconnect({
            from: 'users',
            to: 'app1',
            nextFrom: 'users',
            nextTo: 'app2',
          }),
        }),
      ),
      model(next => {
        expect(next.gesture._tag).toBe('Idle')
        expect(next.maybeSelection).toEqual(Option.none())
      }),
    )
  })

  test('the start dropped on another block moves the source', () => {
    story(
      update,
      given({
        ...Board.initialModel,
        maybeSelection: Option.some(
          Board.Selection.Edge({ from: 'app1', to: 'db' }),
        ),
      }),
      message(
        Board.Message.PressedPointer({
          target: Board.PointerTarget.EdgeEnd({
            from: 'app1',
            to: 'db',
            end: 'from',
          }),
          point: point(474, 160),
        }),
      ),
      message(
        Board.Message.ReleasedPointer({
          target: Board.PointerTarget.Port({ id: 'app2' }),
          point: point(474, 400),
          isOverBoard: true,
        }),
      ),
      expectOutMessage(
        Board.OutMessage.ProposedOp({
          op: BoardOp.Reconnect({
            from: 'app1',
            to: 'db',
            nextFrom: 'app2',
            nextTo: 'db',
          }),
        }),
      ),
    )
  })

  test('released on the background or on the same block it changes nothing', () => {
    story(
      update,
      given(selected),
      message(
        Board.Message.PressedPointer({
          target: Board.PointerTarget.EdgeEnd({
            from: 'users',
            to: 'app1',
            end: 'to',
          }),
          point: point(323, 160),
        }),
      ),
      message(
        Board.Message.ReleasedPointer({
          target: Board.PointerTarget.Node({ id: 'app1' }),
          point: point(400, 160),
          isOverBoard: true,
        }),
      ),
      expectNoOutMessage(),
      model(next => {
        expect(next.gesture._tag).toBe('Idle')
      }),
      message(
        Board.Message.PressedPointer({
          target: Board.PointerTarget.EdgeEnd({
            from: 'users',
            to: 'app1',
            end: 'to',
          }),
          point: point(323, 160),
        }),
      ),
      message(
        Board.Message.ReleasedPointer({
          target: Board.PointerTarget.Background(),
          point: point(600, 500),
          isOverBoard: true,
        }),
      ),
      expectNoOutMessage(),
    )
  })
})

describe('reconnecting from the keyboard', () => {
  test('Enter on a connection selects it, Enter on its end and then on a block moves the end', () => {
    story(
      update,
      given(Board.initialModel),
      message(Board.Message.PressedEdgeKey({ from: 'users', to: 'app1' })),
      model(next => {
        expect(next.maybeSelection).toEqual(
          Option.some(Board.Selection.Edge({ from: 'users', to: 'app1' })),
        )
      }),
      message(
        Board.Message.PressedEdgeEndKey({
          from: 'users',
          to: 'app1',
          end: 'to',
        }),
      ),
      model(next => {
        expect(next.gesture._tag).toBe('ChoosingEnd')
      }),
      message(Board.Message.PressedPickKey({ id: 'app2' })),
      expectOutMessage(
        Board.OutMessage.ProposedOp({
          op: BoardOp.Reconnect({
            from: 'users',
            to: 'app1',
            nextFrom: 'users',
            nextTo: 'app2',
          }),
        }),
      ),
    )
  })

  test('Escape cancels the choice', () => {
    const choosing = {
      ...selected,
      gesture: Board.Gesture.ChoosingEnd({
        from: 'users',
        to: 'app1',
        end: 'to',
      }),
    }
    expect(Board.pressEscapeKey(choosing).model.gesture._tag).toBe('Idle')
  })
})

describe('the Reconnect operation', () => {
  test('moves the connection and keeps its place in the list', () => {
    const next = Result.getOrThrow(
      applyOp(
        doc,
        BoardOp.Reconnect({
          from: 'users',
          to: 'app1',
          nextFrom: 'users',
          nextTo: 'app2',
        }),
      ),
    )
    expect(next.edges).toEqual([
      { from: 'users', to: 'app2' },
      { from: 'app1', to: 'db' },
    ])
  })

  test('follows the same rules as a new connection', () => {
    expect(
      refusalOf(
        BoardOp.Reconnect({
          from: 'users',
          to: 'app1',
          nextFrom: 'users',
          nextTo: 'db',
        }),
      ),
    ).toBe('ConnectClientsToDatabase')
    expect(
      refusalOf(
        BoardOp.Reconnect({
          from: 'app1',
          to: 'db',
          nextFrom: 'app1',
          nextTo: 'app2',
        }),
      ),
    ).toBe('ConnectServerToServer')
    expect(
      refusalOf(
        BoardOp.Reconnect({
          from: 'users',
          to: 'app2',
          nextFrom: 'users',
          nextTo: 'app1',
        }),
      ),
    ).toBe('UnknownEdge')
  })

  test('is one line of the journal', () => {
    expect(
      flow.describeOp(
        BoardOp.Reconnect({
          from: 'users',
          to: 'app1',
          nextFrom: 'users',
          nextTo: 'app2',
        }),
      ),
    ).toBe('Reconnect users → app1 ⇒ users → app2')
  })
})
