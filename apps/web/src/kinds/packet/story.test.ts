import { Array, Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import * as Player from '../../lesson/player'
import { joinWifi } from '../../net/build'
import { SurfaceMessage } from '../state'
import { packet } from './dsl'
import { phoneOnline } from './testing'
import * as Wifi from './wifi'

// Поверхность задачи пишет ходы в тот же журнал, что и доска (design D5):
// отмена, повтор, сброс, проверка и «Показать решение» работают без
// особых случаев.

const COURSE = 'networks'
const TASK_STEP = 1
const TASK_ID = 'join-home'
const WIFI = 'wifi:phone'

const update = (
  playerModel: Player.Model,
  playerMessage: Player.Message,
): ReturnType<typeof Player.update> =>
  Player.updateWith(phoneOnline)(playerModel, playerMessage)

const atTask = (): Player.Model => Player.init(COURSE, phoneOnline, TASK_STEP)

const wifi = (wifiMessage: Wifi.Message) =>
  message(
    Player.Message.GotSurfaceMessage({
      surfaceId: WIFI,
      message: SurfaceMessage.GotWifiSurfaceMessage({ message: wifiMessage }),
    }),
  )

const logOf = (playerModel: Player.Model) =>
  Player.opsOf(packet, Player.taskStateOf(playerModel, TASK_ID).log)

const joinHome = joinWifi('phone', 'Home', 'correct-horse')

const joinWith = (password: string) => [
  wifi(Wifi.Message.SelectedNetwork({ ssid: 'Home' })),
  wifi(Wifi.Message.UpdatedPassword({ value: password })),
  wifi(Wifi.Message.ClickedJoin()),
]

describe('surface host', () => {
  test('the task surfaces start with their own state', () => {
    expect(Object.keys(atTask().surfaces)).toEqual([WIFI])
  })

  test('a surface is visible once the course unlocked it', () => {
    expect(
      Array.map(Player.visibleSurfaces(phoneOnline, atTask()), ({ id }) => id),
    ).toEqual([WIFI])
    expect(
      Player.visibleSurfaces(phoneOnline, { ...atTask(), course: 'unknown' }),
    ).toEqual([])
  })

  test('joining on the surface writes the op into the task journal', () => {
    story(
      update,
      given(atTask()),
      ...joinWith('correct-horse'),
      model(next => {
        expect(logOf(next)).toEqual([joinHome])
      }),
      message(Player.Message.ClickedCheck()),
      model(next => {
        expect(Player.taskStateOf(next, TASK_ID).check).toEqual(
          Player.CheckState.Solved({ withHint: false }),
        )
      }),
    )
  })

  test('a wrong password fails the goal with the model’s reason; undo clears it', () => {
    story(
      update,
      given(atTask()),
      ...joinWith('12345678'),
      message(Player.Message.ClickedCheck()),
      model(next => {
        const check = Player.taskStateOf(next, TASK_ID).check
        expect(check._tag).toBe('Failed')
        if (check._tag === 'Failed') {
          expect(
            Option.map(
              packet.message.unwrap(check.failure),
              failure => failure._tag,
            ),
          ).toEqual(Option.some('WrongPassword'))
          expect(check.focusNodes).toContain('phone')
        }
      }),
      message(Player.Message.ClickedUndo()),
      model(next => {
        expect(logOf(next)).toEqual([])
        expect(Player.taskStateOf(next, TASK_ID).check).toEqual(
          Player.CheckState.Unchecked(),
        )
      }),
    )
  })

  test('outside the task the surface produces nothing', () => {
    story(
      update,
      given(Player.init(COURSE, phoneOnline, 0)),
      ...joinWith('correct-horse'),
      model(next => {
        expect(next.tasks).toEqual({})
      }),
    )
  })

  test('show solution replays the reference through the same journal', () => {
    const replayStep = Command.resolve(
      Player.WaitBeforeReplayStep,
      Player.Message.CompletedWaitBeforeReplayStep(),
    )
    story(
      update,
      given(atTask()),
      ...Array.makeBy(3, () => message(Player.Message.ClickedHint())),
      model(next => {
        expect(
          Player.surfaceContext(phoneOnline, next, 'phone').maybeGhost,
        ).toEqual(Option.some([joinHome]))
      }),
      message(Player.Message.ClickedShowSolution()),
      replayStep,
      replayStep,
      model(next => {
        expect(logOf(next)).toEqual([joinHome])
        expect(Player.taskStateOf(next, TASK_ID).check).toEqual(
          Player.CheckState.Solved({ withHint: true }),
        )
      }),
      Command.expectNone(),
    )
  })

  test('picking a tab is remembered', () => {
    story(
      update,
      given(atTask()),
      message(Player.Message.ClickedSurfaceTab({ surface: WIFI })),
      model(next => {
        expect(next.maybeSurfaceTab).toEqual(Option.some(WIFI))
        expect(
          Option.map(Player.activeSurface(phoneOnline, next), ({ id }) => id),
        ).toEqual(Option.some(WIFI))
      }),
    )
  })
})
