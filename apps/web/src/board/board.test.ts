import { Array, Option } from 'effect'
import { Canvas } from 'foldkit'
import {
  expectNoOutMessage,
  expectOutMessage,
  given,
  message,
  model,
  story,
} from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { type BoardDoc, BoardOp, edgeKey, foldOps } from '../domain/board'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GRID_STEP,
  NODE_HEIGHT,
  NODE_WIDTH,
  isSpotFree,
} from '../domain/geometry'
import { simulate } from '../domain/simulate'
import { addNode, connect, setLoad } from '../lesson/dsl'
import * as Board from './board'
import { type BoardViewInputs, particleColors, particleShapes } from './view'

const doc = foldOps({ nodes: [], edges: [], load: 0, failed: [] }, [
  addNode('users', 'client', 100, 280),
  addNode('app1', 'server', 520, 280),
  connect('users', 'app1'),
])

const update = Board.update({ doc, isEditable: true })

const point = (x: number, y: number) => ({ x, y })

describe('gestures', () => {
  test('dragging a block proposes its new position', () => {
    story(
      update,
      given(Board.initialModel),
      message(
        Board.Message.PressedPointer({
          target: Board.PointerTarget.Node({ id: 'app1' }),
          point: point(520, 280),
        }),
      ),
      message(
        Board.Message.MovedPointer({
          point: point(560, 330),
          isOverBoard: true,
        }),
      ),
      message(
        Board.Message.ReleasedPointer({
          target: Board.PointerTarget.Background(),
          point: point(560, 330),
          isOverBoard: true,
        }),
      ),
      expectOutMessage(
        Board.OutMessage.ProposedOp({
          op: BoardOp.MoveNode({ id: 'app1', x: 560, y: 330 }),
        }),
      ),
      model(next => {
        expect(next.gesture._tag).toBe('Idle')
      }),
    )
  })

  test('a click without movement selects the block instead', () => {
    story(
      update,
      given(Board.initialModel),
      message(
        Board.Message.PressedPointer({
          target: Board.PointerTarget.Node({ id: 'app1' }),
          point: point(520, 280),
        }),
      ),
      message(
        Board.Message.ReleasedPointer({
          target: Board.PointerTarget.Node({ id: 'app1' }),
          point: point(521, 280),
          isOverBoard: true,
        }),
      ),
      expectNoOutMessage(),
      model(next => {
        expect(next.maybeSelection).toEqual(
          Option.some(Board.Selection.Node({ id: 'app1' })),
        )
      }),
    )
  })

  test('dragging from the palette onto the board places a block', () => {
    story(
      update,
      given(Board.initialModel),
      message(
        Board.Message.PressedPointer({
          target: Board.PointerTarget.Palette({ kind: 'lb' }),
          point: point(-40, 100),
        }),
      ),
      message(
        Board.Message.MovedPointer({
          point: point(300, 400),
          isOverBoard: true,
        }),
      ),
      message(
        Board.Message.ReleasedPointer({
          target: Board.PointerTarget.Background(),
          point: point(300, 400),
          isOverBoard: true,
        }),
      ),
      expectOutMessage(
        Board.OutMessage.ProposedOp({
          op: BoardOp.AddNode({
            id: 'lb-1',
            kind: 'lb',
            x: 300,
            y: 400,
            locked: false,
            maybeCapacity: Option.none(),
            maybeRegion: Option.none(),
          }),
        }),
      ),
    )
  })

  test('a palette drag released outside the board places nothing', () => {
    story(
      update,
      given(Board.initialModel),
      message(
        Board.Message.PressedPointer({
          target: Board.PointerTarget.Palette({ kind: 'lb' }),
          point: point(-40, 100),
        }),
      ),
      message(
        Board.Message.MovedPointer({
          point: point(-60, 140),
          isOverBoard: false,
        }),
      ),
      message(
        Board.Message.ReleasedPointer({
          target: Board.PointerTarget.Outside(),
          point: point(-60, 140),
          isOverBoard: false,
        }),
      ),
      expectNoOutMessage(),
      model(next => {
        expect(next.gesture._tag).toBe('Idle')
      }),
    )
  })

  test('a read-only board drops any gesture', () => {
    story(
      Board.update({ doc, isEditable: false }),
      given(Board.initialModel),
      message(Board.Message.ClickedPaletteItem({ kind: 'lb' })),
      expectNoOutMessage(),
      model(next => {
        expect(next).toEqual(Board.initialModel)
      }),
    )
  })
})

describe('deleting', () => {
  test('the cross on a selected connection proposes to disconnect it', () => {
    story(
      update,
      given({
        ...Board.initialModel,
        maybeSelection: Option.some(
          Board.Selection.Edge({ from: 'users', to: 'app1' }),
        ),
      }),
      message(
        Board.Message.PressedPointer({
          target: Board.PointerTarget.DeleteEdge({ from: 'users', to: 'app1' }),
          point: point(310, 258),
        }),
      ),
      expectOutMessage(
        Board.OutMessage.ProposedOp({
          op: BoardOp.Disconnect({ from: 'users', to: 'app1' }),
        }),
      ),
      model(next => {
        expect(next.maybeSelection).toEqual(Option.none())
      }),
    )
  })

  test('the cross on a selected block proposes to remove it', () => {
    story(
      update,
      given({
        ...Board.initialModel,
        maybeSelection: Option.some(Board.Selection.Node({ id: 'app1' })),
      }),
      message(
        Board.Message.PressedPointer({
          target: Board.PointerTarget.DeleteNode({ id: 'app1' }),
          point: point(592, 252),
        }),
      ),
      expectOutMessage(
        Board.OutMessage.ProposedOp({ op: BoardOp.RemoveNode({ id: 'app1' }) }),
      ),
      model(next => {
        expect(next.maybeSelection).toEqual(Option.none())
      }),
    )
  })
})

const runUpdate = (
  input: Board.Input,
  messages: ReadonlyArray<Board.Message>,
): Board.UpdateReturn =>
  Array.reduce(
    messages,
    { model: Board.initialModel } satisfies Board.UpdateReturn,
    (previous: Board.UpdateReturn, boardMessage) =>
      Board.update(input)(previous.model, boardMessage),
  )

const proposedAddNode = (result: Board.UpdateReturn) => {
  const op = result.outMessage?.op
  if (op?._tag !== 'AddNode') {
    throw new Error(`expected AddNode, got ${op?._tag ?? 'nothing'}`)
  }
  return op
}

describe('palette click', () => {
  const taskBoard = foldOps(doc, [
    addNode('db', 'db', 790, 280),
    addNode('app2', 'server', 520, 130),
    addNode('app3', 'server', 520, 430),
    connect('app1', 'db'),
    connect('app2', 'db'),
    connect('app3', 'db'),
  ])

  const clickServer = (board: BoardDoc) =>
    proposedAddNode(
      runUpdate({ doc: board, isEditable: true }, [
        Board.Message.ClickedPaletteItem({ kind: 'server' }),
      ]),
    )

  test('a new server gets the next free name and a spot clear of other blocks', () => {
    const app4 = clickServer(taskBoard)

    expect(app4).toMatchObject({ id: 'app4', kind: 'server', locked: false })
    expect(isSpotFree(taskBoard.nodes, app4)).toBe(true)
  })

  test('the next server does not land on the previous one', () => {
    const withApp4 = foldOps(taskBoard, [clickServer(taskBoard)])
    const app5 = clickServer(withApp4)

    expect(app5.id).toBe('app5')
    expect(isSpotFree(withApp4.nodes, app5)).toBe(true)
  })
})

describe('regions', () => {
  const regional = foldOps(doc, [
    addNode('app-us', 'server', 520, 450, { region: 'us' }),
  ])

  const dropServerAt = (to: { x: number; y: number }) =>
    proposedAddNode(
      runUpdate({ doc: regional, isEditable: true }, [
        Board.Message.PressedPointer({
          target: Board.PointerTarget.Palette({ kind: 'server' }),
          point: point(-60, 100),
        }),
        Board.Message.MovedPointer({ point: to, isOverBoard: true }),
        Board.Message.ReleasedPointer({
          target: Board.PointerTarget.Background(),
          point: to,
          isOverBoard: true,
        }),
      ]),
    )

  test('a server placed into the us zone belongs to us', () => {
    expect(dropServerAt(point(470, 410)).maybeRegion).toEqual(Option.some('us'))
  })

  test('a block placed outside every zone has no region', () => {
    expect(dropServerAt(point(300, 130)).maybeRegion).toEqual(Option.none())
  })
})

describe('moving a block', () => {
  const dragApp1To = (to: { x: number; y: number }) =>
    runUpdate({ doc, isEditable: true }, [
      Board.Message.PressedPointer({
        target: Board.PointerTarget.Node({ id: 'app1' }),
        point: point(520, 280),
      }),
      Board.Message.MovedPointer({ point: to, isOverBoard: true }),
      Board.Message.ReleasedPointer({
        target: Board.PointerTarget.Background(),
        point: to,
        isOverBoard: true,
      }),
    ]).outMessage?.op

  test('the drop point snaps to the 10-unit grid', () => {
    expect(dragApp1To(point(563, 337))).toEqual(
      BoardOp.MoveNode({ id: 'app1', x: 560, y: 340 }),
    )
  })

  test.each([
    ['top left', point(-400, -400)],
    ['bottom right', point(2000, 2000)],
  ])('a block dragged past the %s edge stays on the board', (_edge, to) => {
    const op = dragApp1To(to)

    expect(op?._tag).toBe('MoveNode')
    if (op?._tag === 'MoveNode') {
      expect(op.x - NODE_WIDTH / 2).toBeGreaterThanOrEqual(0)
      expect(op.x + NODE_WIDTH / 2).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(op.y - NODE_HEIGHT / 2).toBeGreaterThanOrEqual(0)
      expect(op.y + NODE_HEIGHT / 2).toBeLessThanOrEqual(BOARD_HEIGHT)
    }
  })

  test.each([
    ['top', point(520, -400)],
    ['bottom', point(520, 2000)],
  ])('a block clamped at the %s edge is still on the grid', (_edge, to) => {
    const op = dragApp1To(to)

    expect(op?._tag).toBe('MoveNode')
    if (op?._tag === 'MoveNode') {
      expect(op.x % GRID_STEP).toBe(0)
      expect(op.y % GRID_STEP).toBe(0)
    }
  })
})

describe('particles', () => {
  const colors = particleColors(false)

  const inputsFor = (load: number): BoardViewInputs => {
    const loaded = foldOps(doc, [setLoad(load)])
    const sim = simulate(loaded, load)
    return {
      locale: 'en',
      doc: loaded,
      mode: 'View',
      palette: [],
      newKinds: [],
      later: [],
      halos: [],
      annotations: [],
      focusEdges: [],
      ghost: Option.none(),
      maybeHoveredRef: Option.none(),
      flows: {
        clock: 0,
        nodeUtil: {},
        nodeIncoming: {},
        edgeFlow: { [edgeKey({ from: 'users', to: 'app1' })]: load },
      },
      sim,
      prefersDark: false,
      isReducedMotion: false,
    }
  }

  const fills = (shapes: ReadonlyArray<Canvas.Shape>) =>
    shapes.flatMap(shape =>
      shape._tag === 'Circle' && shape.fill !== undefined ? [shape.fill] : [],
    )

  test('more flow draws more particles', () => {
    expect(particleShapes(inputsFor(900)).length).toBeGreaterThan(
      particleShapes(inputsFor(100)).length,
    )
  })

  test('the share of red particles follows the share of lost requests', () => {
    const inputs = inputsFor(900)
    const app1 = inputs.sim.nodes['app1']
    const lostShare = (app1?.dropped ?? 0) / (app1?.incoming ?? 1)
    const onEdge = fills(particleShapes(inputs)).filter(
      fill => !fill.startsWith('rgba'),
    )
    const red = onEdge.filter(fill => fill === colors.bad).length

    expect(red / onEdge.length).toBeCloseTo(lostShare, 1)
  })

  test('reduced motion draws no particles', () => {
    expect(
      particleShapes({ ...inputsFor(900), isReducedMotion: true }),
    ).toEqual([])
  })
})
