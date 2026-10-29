import { Array, Option } from 'effect'
import {
  Command,
  expectNoOutMessage,
  expectOutMessage,
  given,
  message,
  model,
  steps,
  story,
} from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import * as Board from '../board/board'
import { type BoardOp, findNode } from '../domain/board'
import { simulate } from '../domain/simulate'
import lesson from '../lessons/03-load-balancer/lesson'
import { addNode, connect, disconnect } from './dsl'
import * as Player from './player'

const TASK_STEP = 3
const TASK_ID = 'place-lb'

const solution: ReadonlyArray<BoardOp> = [
  addNode('lb-1', 'lb', 300, 280, { locked: false }),
  connect('lb-1', 'app1'),
  connect('lb-1', 'app2'),
  connect('lb-1', 'app3'),
  connect('users', 'lb-1'),
  disconnect('users', 'app1'),
]

const atTask = (
  log: ReadonlyArray<BoardOp> = [],
  check: Player.CheckState = Player.CheckState.Unchecked(),
): Player.Model => ({
  ...Player.init(lesson, TASK_STEP),
  tasks: {
    [TASK_ID]: {
      log,
      redo: [],
      attempts: 0,
      hintsShown: 0,
      check,
      maybeReplayIndex: Option.none(),
    },
  },
})

const solvedTask = (log: ReadonlyArray<BoardOp>): Player.Model =>
  atTask(
    log,
    Player.CheckState.Solved({
      withHint: false,
      before: Player.outcomeOf(Player.docAt(lesson, atTask(), TASK_STEP)),
      after: Player.outcomeOf(Player.docAt(lesson, atTask(log), TASK_STEP)),
    }),
  )

const taskOf = (playerModel: Player.Model) =>
  Player.taskStateOf(playerModel, TASK_ID)

const board = (boardMessage: Board.Message) =>
  message(Player.Message.GotBoardMessage({ message: boardMessage }))

const scrolled = Command.resolve(
  Player.ScrollStepIntoView,
  Player.Message.CompletedScrollStepIntoView(),
)

const point = (x: number, y: number) => ({ x, y })

const dragFromPort = (from: string, to: string) =>
  steps(
    board(
      Board.Message.PressedPointer({
        target: Board.PointerTarget.Port({ id: from }),
        point: point(100, 100),
      }),
    ),
    board(
      Board.Message.MovedPointer({ point: point(200, 200), isOverBoard: true }),
    ),
    board(
      Board.Message.ReleasedPointer({
        target: Board.PointerTarget.Node({ id: to }),
        point: point(300, 300),
        isOverBoard: true,
      }),
    ),
  )

describe('navigation', () => {
  test('Next moves forward, reports the step and scrolls to it', () => {
    story(
      Player.update,
      given(Player.init(lesson, 0)),
      message(Player.Message.ClickedNext()),
      model(next => {
        expect(next.step).toBe(1)
      }),
      expectOutMessage(Player.OutMessage.ChangedStep({ step: 1 })),
      Command.expectExact(Player.ScrollStepIntoView),
      scrolled,
    )
  })

  test('an unsolved task blocks Next and the arrow key', () => {
    story(
      Player.update,
      given(atTask()),
      message(Player.Message.ClickedNext()),
      model(next => {
        expect(next.step).toBe(TASK_STEP)
      }),
      expectNoOutMessage(),
      Command.expectNone(),
      message(Player.Message.PressedArrowKey({ direction: 'Right' })),
      model(next => {
        expect(next.step).toBe(TASK_STEP)
      }),
    )
  })

  test('a past step can be revisited by click or arrow key', () => {
    story(
      Player.update,
      given(atTask()),
      message(Player.Message.ClickedStep({ step: 1 })),
      model(next => {
        expect(next.step).toBe(1)
      }),
      scrolled,
      message(Player.Message.PressedArrowKey({ direction: 'Left' })),
      model(next => {
        expect(next.step).toBe(0)
      }),
      scrolled,
    )
  })

  test('a requested step is clamped to the lesson and the open task', () => {
    expect(Player.init(lesson, -3).step).toBe(0)
    expect(Player.init(lesson, 99).step).toBe(TASK_STEP)
  })

  test('after solving, the following steps open up', () => {
    story(
      Player.update,
      given(solvedTask(solution)),
      message(Player.Message.ClickedStep({ step: 5 })),
      model(next => {
        expect(next.step).toBe(5)
      }),
      scrolled,
    )
  })
})

describe('board editing', () => {
  test('a palette click adds a block to the task log', () => {
    story(
      Player.update,
      given(atTask()),
      board(Board.Message.ClickedPaletteItem({ kind: 'lb' })),
      model(next => {
        const log = taskOf(next).log
        expect(log).toHaveLength(1)
        expect(log[0]).toMatchObject({ _tag: 'AddNode', kind: 'lb' })
      }),
    )
  })

  test('outside a task the board stays read-only', () => {
    story(
      Player.update,
      given(Player.init(lesson, 0)),
      board(Board.Message.ClickedPaletteItem({ kind: 'lb' })),
      model(next => {
        expect(next.tasks).toEqual({})
      }),
    )
  })

  test('dragging from a port to a block connects them', () => {
    story(
      Player.update,
      given(atTask()),
      dragFromPort('users', 'app2'),
      model(next => {
        expect(taskOf(next).log).toEqual([connect('users', 'app2')])
        expect(next.board.gesture._tag).toBe('Idle')
      }),
    )
  })

  test('a refused connection shows a toast that hides itself', () => {
    story(
      Player.update,
      given(atTask()),
      dragFromPort('app2', 'users'),
      model(next => {
        expect(taskOf(next).log).toEqual([])
        expect(Option.map(next.maybeToast, toast => toast._tag)).toEqual(
          Option.some('ConnectIntoClients'),
        )
      }),
      Command.resolve(
        Player.WaitBeforeHidingToast,
        Player.Message.CompletedWaitBeforeHidingToast({ serial: 1 }),
      ),
      model(next => {
        expect(next.maybeToast).toEqual(Option.none())
      }),
    )
  })

  test('undo, redo and reset walk the task log', () => {
    const [placeLb, linkApp1] = solution
    story(
      Player.update,
      given(atTask(solution.slice(0, 2))),
      message(Player.Message.ClickedUndo()),
      model(next => {
        expect(taskOf(next).log).toEqual([placeLb])
        expect(taskOf(next).redo).toEqual([linkApp1])
      }),
      message(Player.Message.PressedRedoKey()),
      model(next => {
        expect(taskOf(next).log).toEqual([placeLb, linkApp1])
        expect(taskOf(next).redo).toEqual([])
      }),
      message(Player.Message.ClickedReset()),
      model(next => {
        expect(taskOf(next).log).toEqual([])
      }),
    )
  })

  test('Delete removes the selected connection', () => {
    story(
      Player.update,
      given(atTask()),
      board(
        Board.Message.PressedPointer({
          target: Board.PointerTarget.Edge({ from: 'users', to: 'app1' }),
          point: point(300, 280),
        }),
      ),
      message(Player.Message.PressedDeleteKey()),
      model(next => {
        expect(taskOf(next).log).toEqual([disconnect('users', 'app1')])
        expect(next.board.maybeSelection).toEqual(Option.none())
      }),
    )
  })
})

describe('checking', () => {
  test('the starting board fails on the first goal', () => {
    story(
      Player.update,
      given(atTask()),
      message(Player.Message.ClickedCheck()),
      model(next => {
        const task = taskOf(next)
        expect(task.attempts).toBe(1)
        expect(task.check).toMatchObject({ _tag: 'Failed', goalIndex: 0 })
      }),
    )
  })

  test('a leftover bypass is named and highlighted', () => {
    story(
      Player.update,
      given(atTask(solution.slice(0, 5))),
      message(Player.Message.ClickedCheck()),
      model(next => {
        expect(taskOf(next).check).toMatchObject({
          _tag: 'Failed',
          goalIndex: 2,
          focusEdges: ['users>app1'],
        })
      }),
    )
  })

  test('the reference solution passes and shows before → after', () => {
    story(
      Player.update,
      given(atTask(solution)),
      message(Player.Message.ClickedCheck()),
      model(next => {
        const check = taskOf(next).check
        expect(check._tag).toBe('Solved')
        if (check._tag === 'Solved') {
          expect(check.withHint).toBe(false)
          expect(check.before.errorRate).toBeGreaterThan(0.5)
          expect(check.after.errorRate).toBe(0)
          expect(check.after.costPerHour).toBeCloseTo(2.3)
        }
        expect(Player.isEditable(lesson, next)).toBe(false)
      }),
    )
  })

  test('the board after the task follows the student’s own layout', () => {
    const [, ...links] = solution
    const ownLayout = [
      addNode('lb-1', 'lb', 320, 360, { locked: false }),
      ...links,
    ]
    const doc = Player.docAt(lesson, solvedTask(ownLayout), 4)

    expect(
      Option.map(findNode(doc, 'lb-1'), node => ({ x: node.x, y: node.y })),
    ).toEqual(Option.some({ x: 320, y: 360 }))
    expect(simulate(doc, doc.load).nodes['app2']?.isDown).toBe(true)
  })
})

describe('hints and replay', () => {
  test('hints open one by one up to three', () => {
    story(
      Player.update,
      given(atTask()),
      ...Array.makeBy(4, () => message(Player.Message.ClickedHint())),
      model(next => {
        expect(taskOf(next).hintsShown).toBe(3)
      }),
    )
  })

  test('show solution replays the reference and counts it as hinted', () => {
    const replayStep = Command.resolve(
      Player.WaitBeforeReplayStep,
      Player.Message.CompletedWaitBeforeReplayStep(),
    )
    story(
      Player.update,
      given(atTask([connect('users', 'app2')])),
      message(Player.Message.ClickedShowSolution()),
      model(next => {
        expect(taskOf(next).log).toEqual([])
        expect(taskOf(next).maybeReplayIndex).toEqual(Option.some(0))
        expect(Player.isEditable(lesson, next)).toBe(false)
      }),
      replayStep,
      model(next => {
        expect(taskOf(next).log).toEqual(solution.slice(0, 1))
      }),
      ...Array.makeBy(solution.length, () => replayStep),
      model(next => {
        const task = taskOf(next)
        expect(task.log).toEqual(solution)
        expect(task.maybeReplayIndex).toEqual(Option.none())
        expect(task.check).toMatchObject({ _tag: 'Solved', withHint: true })
      }),
      Command.expectNone(),
    )
  })
})

describe('animation', () => {
  const frames = (count: number, start: Player.Model) =>
    Array.reduce(
      Array.makeBy(count, () => 16),
      start,
      (current, deltaMs) => Player.advanceFrame(deltaMs)(current).model,
    )

  test('frames bring the instruments to the simulated values', () => {
    const overloaded = Player.init(lesson, 1)
    const target = simulate(Player.currentDoc(lesson, overloaded), 900)
    const settled = frames(400, overloaded)

    expect(settled.anim.shownLoad).toBeCloseTo(900, 0)
    expect(settled.anim.hudErrorRate).toBeCloseTo(target.errorRate, 2)
    expect(settled.anim.clock).toBeGreaterThan(0)
    expect(settled.anim.sparkErrors.length).toBeGreaterThan(0)
  })

  test('on pause the clock stands still', () => {
    const paused = Player.update(
      Player.init(lesson, 0),
      Player.Message.ClickedPlayPause(),
    ).model

    expect(frames(30, paused).anim.clock).toBe(paused.anim.clock)
  })

  test('the model holds only plain finite data on every step', () => {
    const nonFinite = (value: unknown, path: string): ReadonlyArray<string> =>
      value === undefined || typeof value === 'function'
        ? [`${path} is ${typeof value}`]
        : typeof value === 'number'
          ? globalThis.Number.isFinite(value)
            ? []
            : [`${path} = ${value}`]
          : typeof value === 'object' && value !== null
            ? Object.entries(value).flatMap(([key, inner]) =>
                nonFinite(inner, `${path}.${key}`),
              )
            : []

    lesson.steps.forEach((_lessonStep, index) => {
      const settled = frames(120, { ...solvedTask(solution), step: index })
      expect(nonFinite(settled, `step ${index}`)).toEqual([])
    })
  })
})
