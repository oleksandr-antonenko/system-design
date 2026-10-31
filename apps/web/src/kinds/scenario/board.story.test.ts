import { Option, Schema } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import sharedRoom from '../../courses/security/lessons/01-shared-room/lesson'
import phishing from '../../courses/security/lessons/05-phishing/lesson'
import * as Player from '../../lesson/player'
import { BoardMessage } from '../state'
import * as Board from './board'

// Доска вида «сценарий» через плеер: поля страницы-двойника знают только
// «заполнено», выбор места уходит в квиз, табличка открывается, а урок
// слайдами прокручивает к новому кадру.

const update = (
  playerModel: Player.Model,
  playerMessage: Player.Message,
): ReturnType<typeof Player.update> =>
  Player.updateWith(phishing)(playerModel, playerMessage)

const board = (boardMessage: Board.Message) =>
  message(
    Player.Message.GotBoardMessage({
      message: BoardMessage.GotScenarioBoardMessage({ message: boardMessage }),
    }),
  )

const updateRoom = (
  playerModel: Player.Model,
  playerMessage: Player.Message,
): ReturnType<typeof Player.update> =>
  Player.updateWith(sharedRoom)(playerModel, playerMessage)

const boardModel = (playerModel: Player.Model): Board.Model =>
  Option.getOrThrow(Player.boardModelOf(phishing, playerModel))

const start = Player.init('security', phishing, 0)

describe('the trap fields', () => {
  test('a field message has no room for the typed text', () => {
    const fields = Object.keys(
      Board.Message.UpdatedTrapField({ field: 'password', isFilled: true }),
    ).sort()
    expect(fields).toEqual(['_tag', 'field', 'isFilled'])
    expect(
      Schema.decodeUnknownOption(Board.Model)({
        ...Board.initialModel,
        password: 'secret',
      }),
    ).toEqual(Option.some(Board.initialModel))
  })

  test('Sign in with an empty field is no attempt; with both fields filled it answers the quiz wrong', () => {
    story(
      update,
      given(start),
      board(Board.Message.ClickedTrapLogin()),
      model(next => {
        expect(boardModel(next).maybeMissing).toEqual(Option.some('email'))
        expect(next.quizzes).toEqual({})
      }),
      board(Board.Message.UpdatedTrapField({ field: 'email', isFilled: true })),
      board(Board.Message.ClickedTrapLogin()),
      model(next => {
        expect(boardModel(next).maybeMissing).toEqual(Option.some('password'))
      }),
      board(
        Board.Message.UpdatedTrapField({ field: 'password', isFilled: true }),
      ),
      board(Board.Message.ClickedTrapLogin()),
      model(next => {
        expect(next.quizzes['prize']).toEqual({
          picked: 'login',
          isCorrect: false,
        })
        expect(boardModel(next).isEmailFilled).toBe(false)
        expect(boardModel(next).isPasswordFilled).toBe(false)
        expect(Player.maxAllowedStep(phishing, next)).toBeGreaterThan(0)
      }),
      Command.expectNone(),
    )
  })

  test('Skip answers right; a second choice changes nothing', () => {
    story(
      update,
      given(start),
      board(Board.Message.ClickedTrapSkip()),
      board(Board.Message.ClickedTrapLogin()),
      model(next => {
        expect(next.quizzes['prize']).toEqual({
          picked: 'skip',
          isCorrect: true,
        })
      }),
    )
  })
})

describe('spots and the sign', () => {
  test('a spot that is not a candidate is not an attempt', () => {
    story(
      update,
      given(start),
      board(Board.Message.ClickedSpot({ spot: 'url' })),
      model(next => {
        expect(next.quizzes).toEqual({})
      }),
    )
  })

  test('the sign opens and closes; a new step closes it', () => {
    const airport: Player.Model = {
      ...Player.init('security', sharedRoom, 0),
      quizzes: { 'client-wifi': { picked: 'guest-card', isCorrect: true } },
      step: 7,
    }
    const sign = (boardMessage: Board.Message) =>
      message(
        Player.Message.GotBoardMessage({
          message: BoardMessage.GotScenarioBoardMessage({
            message: boardMessage,
          }),
        }),
      )
    story(
      updateRoom,
      given(airport),
      sign(Board.Message.ClickedSign()),
      model(next => {
        expect(
          Option.getOrThrow(Player.boardModelOf(sharedRoom, next)).isSignOpen,
        ).toBe(true)
      }),
      message(Player.Message.ClickedPrevious()),
      model(next => {
        expect(
          Option.getOrThrow(Player.boardModelOf(sharedRoom, next)).isSignOpen,
        ).toBe(false)
      }),
      Command.expectExact(Player.ScrollSlideIntoView),
      Command.resolve(
        Player.ScrollSlideIntoView,
        Player.Message.CompletedScrollStepIntoView(),
      ),
    )
  })
})

describe('slides', () => {
  test('Next on a slides lesson scrolls the new frame into view', () => {
    story(
      updateRoom,
      given(Player.init('security', sharedRoom, 0)),
      message(Player.Message.ClickedNext()),
      model(next => {
        expect(next.step).toBe(1)
      }),
      Command.expectExact(Player.ScrollSlideIntoView),
      Command.resolve(
        Player.ScrollSlideIntoView,
        Player.Message.CompletedScrollStepIntoView(),
      ),
    )
  })
})
