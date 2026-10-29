import { Option } from 'effect'
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

import { BoardOp, edgeKey, foldOps } from '../domain/board'
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
