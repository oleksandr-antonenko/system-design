import { Array } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import phoneOnline from '../../courses/networks/lessons/01-phone-online/lesson'
import * as Player from '../../lesson/player'
import { joinWifi } from '../../net/build'
import { BoardMessage } from '../state'
import * as Board from './board'

// Урок 1 через плеер: вопрос на доске пишет ответ, «Показать решение»
// подключает телефон тем же журналом, что и ученик.

const update = (
  playerModel: Player.Model,
  playerMessage: Player.Message,
): ReturnType<typeof Player.update> =>
  Player.updateWith(phoneOnline)(playerModel, playerMessage)

const board = (boardMessage: Board.Message) =>
  message(
    Player.Message.GotBoardMessage({
      message: BoardMessage.GotPacketBoardMessage({ message: boardMessage }),
    }),
  )

describe('lesson 1 through the player', () => {
  test('the way-out question is answered on the board; Next opens after one attempt', () => {
    story(
      update,
      given(Player.init('networks', phoneOnline, 3)),
      board(Board.Message.ClickedCandidate({ id: 'shop', playTo: 0, total: 0 })),
      model(next => {
        expect(next.quizzes['way-out']).toEqual({
          picked: 'shop',
          isCorrect: false,
        })
        expect(Player.maxAllowedStep(phoneOnline, next)).toBe(4)
      }),
      board(Board.Message.ClickedCandidate({ id: 'router', playTo: 0, total: 0 })),
      model(next => {
        expect(next.quizzes['way-out']?.picked).toBe('shop')
      }),
    )
  })

  test('show solution joins the home network with the sticker password', () => {
    const replayStep = Command.resolve(
      Player.WaitBeforeReplayStep,
      Player.Message.CompletedWaitBeforeReplayStep(),
    )
    const atTask = {
      ...Player.init('networks', phoneOnline, 3),
      quizzes: { 'way-out': { picked: 'router', isCorrect: true } },
      step: 4,
    }
    story(
      update,
      given(atTask),
      ...Array.makeBy(3, () => message(Player.Message.ClickedHint())),
      message(Player.Message.ClickedShowSolution()),
      replayStep,
      replayStep,
      model(next => {
        const task = Player.taskStateOf(next, 'join-wifi')
        expect(Player.opsOf(phoneOnline.kind, task.log)).toEqual([
          joinWifi('phone', 'Router-7C21', '12345678'),
        ])
        expect(task.check).toEqual(Player.CheckState.Solved({ withHint: true }))
      }),
      Command.expectNone(),
    )
  })
})
