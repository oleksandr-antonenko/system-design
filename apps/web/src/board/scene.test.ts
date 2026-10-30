import { Option } from 'effect'
import {
  Mount,
  all,
  expect,
  expectAll,
  expectOutMessage,
  given,
  keydown,
  role,
  scene,
  text,
  withViewInputs,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import { type BoardDoc, emptyBoard, foldOps } from '../domain/board'
import { simulate } from '../domain/simulate'
import { addNode, connect, failRegion, setLoad } from '../kinds/flow/dsl'
import * as Board from './board'
import { BoardPointer } from './pointer'
import { type BoardViewInputs, view } from './view'

const pointerReady = Mount.resolve(
  BoardPointer,
  Board.Message.CancelledPointer(),
)

const inputsFor = (doc: BoardDoc): BoardViewInputs => ({
  locale: 'en',
  doc,
  mode: 'Edit',
  palette: [],
  newKinds: [],
  later: [],
  halos: [],
  annotations: [],
  focusEdges: [],
  ghost: Option.none(),
  maybeHoveredRef: Option.none(),
  flows: { clock: 0, nodeUtil: {}, nodeIncoming: {}, edgeFlow: {} },
  sim: simulate(doc, doc.load),
  prefersDark: false,
  isReducedMotion: true,
})

const boardScene = (
  doc: BoardDoc,
  overrides: Partial<BoardViewInputs> = {},
) => ({
  update: Board.update({ doc, isEditable: true }),
  view: withViewInputs(view, inputsFor(doc))(overrides),
})

const pickScene = (doc: BoardDoc, overrides: Partial<BoardViewInputs>) => ({
  update: Board.update({ doc, isEditable: false, pickable: ['app1', 'db'] }),
  view: withViewInputs(view, inputsFor(doc))({ mode: 'Pick', ...overrides }),
})

const regional = foldOps(emptyBoard, [
  addNode('users-eu', 'client', 100, 200, { region: 'eu' }),
  addNode('app-eu', 'server', 400, 200, { region: 'eu' }),
  addNode('db', 'db', 760, 280),
  connect('users-eu', 'app-eu'),
  connect('app-eu', 'db'),
  setLoad(300),
])

describe('palette', () => {
  test('capacity tags come from the catalog; kinds new in the lesson get a badge', () => {
    scene(
      boardScene(emptyBoard, {
        palette: ['cache', 'worker', 'server'],
        newKinds: ['cache'],
      }),
      given(Board.initialModel),
      pointerReady,
      expect(role('button', { name: /Cache/ })).toContainText('new'),
      expect(role('button', { name: /Worker/ })).toContainText('up to 200 rps'),
      expect(role('button', { name: /Server/ })).toContainText('up to 400 rps'),
    )
  })

  test('“Later in the course” lists the kinds the course brings next', () => {
    scene(
      boardScene(emptyBoard, {
        palette: ['cache'],
        later: [
          { kind: 'cdn', lesson: 5 },
          { kind: 'replica', lesson: 6 },
        ],
      }),
      given(Board.initialModel),
      pointerReady,
      expect(text('Later in the course')).toExist(),
      expect(role('button', { name: /CDN/ })).toBeDisabled(),
      expect(role('button', { name: /CDN/ })).toContainText('lesson 5'),
      expect(role('button', { name: /Read replica/ })).toContainText(
        'lesson 6',
      ),
    )
  })

  test('with nothing new ahead, the section is not shown', () => {
    scene(
      boardScene(emptyBoard, { palette: ['server'] }),
      given(Board.initialModel),
      pointerReady,
      expect(text('Later in the course')).toBeAbsent(),
    )
  })
})

describe('regions', () => {
  test('blocks of a region stand on a labelled zone', () => {
    scene(
      boardScene(regional),
      given(Board.initialModel),
      pointerReady,
      expect(text('Europe')).toExist(),
      expectAll(all.selector('[data-region]')).toHaveCount(1),
    )
  })

  test('a failed region says so on its zone', () => {
    scene(
      boardScene(foldOps(regional, [failRegion('eu')])),
      given(Board.initialModel),
      pointerReady,
      expect(text('Europe · region down')).toExist(),
    )
  })
})

describe('blocks', () => {
  const queued = foldOps(emptyBoard, [
    addNode('users', 'client', 100, 280),
    addNode('app1', 'server', 400, 280),
    addNode('queue-1', 'queue', 600, 400),
    addNode('worker-1', 'worker', 790, 400),
    connect('users', 'app1'),
    connect('app1', 'queue-1'),
    connect('queue-1', 'worker-1'),
    setLoad(300),
  ])

  test('a growing queue shows its growth on the block', () => {
    scene(
      boardScene(queued),
      given(Board.initialModel),
      pointerReady,
      expect(role('img', { name: /^Queue queue-1/ })).toHaveAccessibleName(
        'Queue queue-1, grows +100/s',
      ),
    )
  })

  test('a limiter shows how much it rejects', () => {
    const limited = foldOps(emptyBoard, [
      addNode('users', 'client', 100, 280),
      addNode('limiter-1', 'limiter', 260, 280, { capacity: 1100 }),
      addNode('app1', 'server', 520, 280),
      connect('users', 'limiter-1'),
      connect('limiter-1', 'app1'),
      setLoad(2000),
    ])
    scene(
      boardScene(limited),
      given(Board.initialModel),
      pointerReady,
      expect(
        role('img', { name: /^Rate limiter limiter-1/ }),
      ).toHaveAccessibleName('Rate limiter limiter-1, rejected 900/s'),
    )
  })

  test('only blocks that pass requests on have a connection port', () => {
    scene(
      boardScene(regional),
      given(Board.initialModel),
      pointerReady,
      expectAll(all.selector('[data-port="app-eu"]')).toHaveCount(2),
      expectAll(all.selector('[data-port="db"]')).toHaveCount(0),
    )
  })
})

describe('pick a block (quiz)', () => {
  const shop = foldOps(emptyBoard, [
    addNode('users', 'client', 100, 280),
    addNode('app1', 'server', 520, 280),
    addNode('db', 'db', 790, 280),
    connect('users', 'app1'),
    connect('app1', 'db'),
    setLoad(300),
  ])
  const pick = {
    candidates: ['app1', 'db'],
    maybePicked: Option.none(),
    maybeAnswer: Option.none(),
    tags: { app1: 'gives up first', db: 'holds 1,500 rps' },
    hidden: ['load'],
  }

  test('candidates are buttons reachable by keyboard; Enter picks', () => {
    scene(
      pickScene(shop, { pick }),
      given(Board.initialModel),
      pointerReady,
      expect(text('Question · pick on the board')).toExist(),
      expect(role('button', { name: /^Server app1/ })).toExist(),
      expect(role('img', { name: /^Users users/ })).toExist(),
      keydown(role('button', { name: /^Database db/ }), 'Enter'),
      expectOutMessage(Board.OutMessage.PickedNode({ id: 'db' })),
    )
  })

  test('the load stays hidden until the answer', () => {
    scene(
      pickScene(shop, { pick }),
      given(Board.initialModel),
      pointerReady,
      expect(role('button', { name: /^Server app1/ })).toHaveAccessibleName(
        /load hidden until you answer/,
      ),
    )
  })

  test('after a wrong pick: red with its tag, the answer green with its tag', () => {
    scene(
      pickScene(shop, {
        mode: 'View',
        pick: {
          ...pick,
          hidden: [],
          maybePicked: Option.some('db'),
          maybeAnswer: Option.some('app1'),
        },
      }),
      given(Board.initialModel),
      pointerReady,
      expect(role('img', { name: /^Database db/ })).toHaveClass('pick-wrong'),
      expect(role('img', { name: /^Server app1/ })).toHaveClass('pick-right'),
      expect(text('holds 1,500 rps')).toExist(),
      expect(text('gives up first')).toExist(),
    )
  })
})
