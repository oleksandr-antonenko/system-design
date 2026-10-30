import { Option } from 'effect'
import {
  Command,
  expectNoOutMessage,
  given,
  message,
  model,
  story,
} from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import * as Board from '../board/board'
import caching from '../courses/system-design/lessons/04-caching/lesson'
import * as FlowBoard from '../kinds/flow/board'
import { addNode, connect, flow, setLoad } from '../kinds/flow/dsl'
import { BoardMessage } from '../kinds/state'
import type { FlowTypes } from '../kinds/types'
import { type LessonDefinition, defineLesson } from './dsl'
import * as Player from './player'

// Квиз — вид шага (design D1–D3 add-quiz-steps): попытка одна, после неё
// «Далее» открыта, даже если ответ неверный.

const COURSE = 'system-design'
const QUIZ_STEP = 2

const lesson: LessonDefinition<FlowTypes> = caching

const update = (
  playerModel: Player.Model,
  playerMessage: Player.Message,
): ReturnType<typeof Player.update> =>
  Player.updateWith(lesson)(playerModel, playerMessage)

const scrolled = Command.resolve(
  Player.ScrollStepIntoView,
  Player.Message.CompletedScrollStepIntoView(),
)

const atQuiz = () => Player.init(COURSE, lesson, QUIZ_STEP)

describe('choice quiz', () => {
  test('a link past an unanswered quiz opens the quiz step', () => {
    expect(Player.init(COURSE, lesson, 5).step).toBe(QUIZ_STEP)
  })

  test('Next is locked until the one attempt, then opens even after a wrong answer', () => {
    story(
      update,
      given(atQuiz()),
      message(Player.Message.ClickedNext()),
      model(next => {
        expect(next.step).toBe(QUIZ_STEP)
      }),
      expectNoOutMessage(),
      message(Player.Message.ClickedChoice({ candidate: 'misses' })),
      model(next => {
        expect(next.quizzes['db-after-cache']).toEqual({
          picked: 'misses',
          isCorrect: false,
        })
      }),
      message(Player.Message.ClickedChoice({ candidate: 'writes-and-misses' })),
      model(next => {
        expect(next.quizzes['db-after-cache']?.picked).toBe('misses')
      }),
      message(Player.Message.ClickedNext()),
      model(next => {
        expect(next.step).toBe(QUIZ_STEP + 1)
      }),
      scrolled,
    )
  })

  test('the right answer on the first try is remembered as such', () => {
    story(
      update,
      given(atQuiz()),
      message(Player.Message.ClickedChoice({ candidate: 'writes-and-misses' })),
      model(next => {
        expect(next.quizzes['db-after-cache']?.isCorrect).toBe(true)
      }),
    )
  })

  test('an unknown candidate is not an attempt', () => {
    story(
      update,
      given(atQuiz()),
      message(Player.Message.ClickedChoice({ candidate: 'lb' })),
      model(next => {
        expect(next.quizzes).toEqual({})
      }),
    )
  })
})

const pickLesson: LessonDefinition<FlowTypes> = defineLesson(flow, {
  slug: 'pick',
  steps: [
    {
      id: 'predict',
      ops: [
        addNode('users', 'client', 100, 280),
        addNode('app1', 'server', 520, 280),
        addNode('db', 'db', 790, 280),
        connect('users', 'app1'),
        connect('app1', 'db'),
        setLoad(300),
      ],
      stage: [],
      quiz: {
        id: 'first-to-fail',
        kind: 'PickDevice',
        candidates: ['app1', 'db'],
        answer: 'app1',
        hideUntilAnswered: ['load'],
      },
    },
    { id: 'overload', ops: [setLoad(900)], stage: [] },
  ],
})

const pickUpdate = (
  playerModel: Player.Model,
  playerMessage: Player.Message,
): ReturnType<typeof Player.update> =>
  Player.updateWith(pickLesson)(playerModel, playerMessage)

const editor = (editorMessage: Board.Message) =>
  message(
    Player.Message.GotBoardMessage({
      message: BoardMessage.GotFlowBoardMessage({
        message: FlowBoard.Message.GotEditorMessage({ message: editorMessage }),
      }),
    }),
  )

const releasedOn = (id: string) =>
  editor(
    Board.Message.ReleasedPointer({
      target: Board.PointerTarget.Node({ id }),
      point: { x: 0, y: 0 },
      isOverBoard: true,
    }),
  )

describe('pick a block on the board', () => {
  test('the board is in pick mode until the answer', () => {
    const start = Player.init(COURSE, pickLesson, 0)
    expect(Player.boardMode(pickLesson, start)).toBe('Pick')
  })

  test('a click on a block that is not a candidate does nothing', () => {
    story(
      pickUpdate,
      given(Player.init(COURSE, pickLesson, 0)),
      releasedOn('users'),
      model(next => {
        expect(next.quizzes).toEqual({})
      }),
    )
  })

  test('a click or Enter on a candidate is the attempt; the board leaves pick mode', () => {
    story(
      pickUpdate,
      given(Player.init(COURSE, pickLesson, 0)),
      releasedOn('db'),
      model(next => {
        expect(next.quizzes['first-to-fail']).toEqual({
          picked: 'db',
          isCorrect: false,
        })
        expect(Player.boardMode(pickLesson, next)).toBe('View')
        expect(Player.maxAllowedStep(pickLesson, next)).toBe(1)
      }),
    )
    story(
      pickUpdate,
      given(Player.init(COURSE, pickLesson, 0)),
      editor(Board.Message.PressedPickKey({ id: 'app1' })),
      model(next => {
        expect(next.quizzes['first-to-fail']?.isCorrect).toBe(true)
        expect(
          Option.map(
            Player.currentQuiz(pickLesson, next),
            quiz => quiz.maybeAnswer,
          ),
        ).toEqual(Option.some(Option.some({ picked: 'app1', isCorrect: true })))
      }),
    )
  })
})
