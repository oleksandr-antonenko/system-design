import { Array, Option } from 'effect'
import { given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { packet } from '../../../../kinds/packet/dsl'
import * as Screen from '../../../../kinds/packet/surfaces/screen/message'
import { SurfaceMessage } from '../../../../kinds/state'
import type { PacketTypes } from '../../../../kinds/types'
import { boardAt } from '../../../../lesson/dsl'
import * as Player from '../../../../lesson/player'
import { quizAnswer, quizOf } from '../../../../lesson/quiz'
import { browse } from '../../../../net/browser'
import { run, send } from '../../../../net/build'
import { Intent } from '../../../../net/packet'
import lesson from './lesson'

// Проверки сценария урока 6 (раздел 8): что видит телефон по localhost, по
// адресу ноутбука до --host, и что ходы задачи — один журнал с отменой.

const atTask = (): Player.Model => ({
  ...Player.init('networks', lesson, 0),
  quizzes: { 'phone-localhost': { picked: 'refused', isCorrect: true } },
  step: 4,
})

const update = (
  playerModel: Player.Model,
  playerMessage: Player.Message,
): ReturnType<typeof Player.update> =>
  Player.updateWith(lesson)(playerModel, playerMessage)

const logOf = (playerModel: Player.Model) =>
  Player.opsOf(packet, Player.taskStateOf(playerModel, 'phone-dev').log)

describe('lesson 6 script', () => {
  test('step 2: localhost opens on the laptop; step 4: the phone is refused by 127.0.0.1', () => {
    const atDev = boardAt(lesson, 1, {})
    expect(
      browse(atDev.doc, atDev.state, 'laptop', 'http://localhost:5173/').view,
    ).toMatchObject({ _tag: 'Page' })
    const atDoor = boardAt(lesson, 3, {})
    expect(
      browse(atDoor.doc, atDoor.state, 'phone', 'http://192.168.1.42:5173/')
        .view,
    ).toMatchObject({
      _tag: 'Error',
      code: 'ERR_CONNECTION_REFUSED',
      reason: { _tag: 'ListensOnlyOnLoopback' },
    })
  })

  test('the quiz answer is what the engine shows on the phone: the refusal', () => {
    const doc = boardAt(lesson, 2, {})
    expect(
      Option.map(quizOf<PacketTypes>(lesson.steps[2]), quiz =>
        quizAnswer(quiz, doc, packet.run(doc)),
      ),
    ).toEqual(Option.some('refused'))
  })

  test('a move on the phone plays its trace on the board; undo goes back to the step', () => {
    story(
      update,
      given(atTask()),
      message(
        Player.Message.GotSurfaceMessage({
          surfaceId: 'browser:phone',
          message: SurfaceMessage.GotScreenSurfaceMessage({
            message: Screen.Message.UpdatedUrl({ value: '192.168.1.42:5173' }),
          }),
        }),
      ),
      message(
        Player.Message.GotSurfaceMessage({
          surfaceId: 'browser:phone',
          message: SurfaceMessage.GotScreenSurfaceMessage({
            message: Screen.Message.SubmittedUrl(),
          }),
        }),
      ),
      model(next => {
        expect(logOf(next)).toEqual([
          send(
            Intent.Browse({ from: 'phone', url: 'http://192.168.1.42:5173/' }),
          ),
        ])
        expect(
          Array.map(Player.boardStage(lesson, next).stage, item => item._tag),
        ).toEqual(['Play'])
      }),
      message(Player.Message.ClickedUndo()),
      model(next => {
        expect(logOf(next)).toEqual([])
        expect(Player.boardStage(lesson, next).stage).toEqual([])
      }),
    )
  })

  test('the reference solution is three moves in the terminal and the browser', () => {
    expect(lesson.steps[4].task.solution).toEqual([
      run('laptop', 'Ctrl+C'),
      run('laptop', 'npm run dev -- --host'),
      send(Intent.Browse({ from: 'phone', url: 'http://192.168.1.42:5173/' })),
    ])
  })
})
