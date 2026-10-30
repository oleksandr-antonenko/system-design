import {
  Command,
  expectOutMessage,
  given,
  message,
  model,
  story,
} from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import loadBalancer from '../courses/system-design/lessons/03-load-balancer/lesson'
import * as Player from './player'

// Телефон: виден текст шага или доска, не оба. Шаг открывается текстом,
// кнопка в конце текста ведёт на доску, «← Текст» возвращает на то же место,
// а следующий шаг снова открывается текстом с начала.

const onPhone = (step: number): Player.Model => ({
  ...Player.init('system-design', loadBalancer, step),
  isStacked: true,
})

const measured = (scrollY: number) =>
  Command.resolve(
    Player.MeasureTextScroll,
    Player.Message.CompletedMeasureTextScroll({ scrollY }),
  )

const restored = Command.resolve(
  Player.RestoreTextScroll,
  Player.Message.CompletedRestoreTextScroll(),
)

describe('phone: one view at a time', () => {
  test('a step opens on its text', () => {
    story(
      Player.update,
      given(onPhone(0)),
      model(next => {
        expect(next.phoneView).toEqual(Player.PhoneView.Text())
      }),
    )
  })

  test('the button goes to the board, remembering where the text was', () => {
    story(
      Player.update,
      given(onPhone(0)),
      message(Player.Message.ClickedShowBoard()),
      Command.expectExact(Player.MeasureTextScroll()),
      measured(640),
      model(next => {
        expect(next.phoneView).toEqual(
          Player.PhoneView.Board({ textScrollY: 640 }),
        )
      }),
    )
  })

  test('«← Text» comes back to the same scroll position', () => {
    story(
      Player.update,
      given(onPhone(0)),
      message(Player.Message.ClickedShowBoard()),
      measured(640),
      message(Player.Message.ClickedShowText()),
      model(next => {
        expect(next.phoneView).toEqual(Player.PhoneView.Text())
      }),
      Command.expectExact(Player.RestoreTextScroll({ scrollY: 640 })),
      restored,
    )
  })

  test('Next from the board opens the next step on its text, from the top', () => {
    story(
      Player.update,
      given(onPhone(0)),
      message(Player.Message.ClickedShowBoard()),
      measured(640),
      message(Player.Message.ClickedNext()),
      expectOutMessage(Player.OutMessage.ChangedStep({ step: 1 })),
      model(next => {
        expect(next.step).toBe(1)
        expect(next.phoneView).toEqual(Player.PhoneView.Text())
      }),
      Command.expectExact(Player.RestoreTextScroll({ scrollY: 0 })),
      restored,
    )
  })

  test('on a wide screen the step change scrolls the text column as before', () => {
    story(
      Player.update,
      given(Player.init('system-design', loadBalancer, 0)),
      message(Player.Message.ClickedNext()),
      Command.expectExact(Player.ScrollStepIntoView({ step: 1 })),
      Command.resolve(
        Player.ScrollStepIntoView,
        Player.Message.CompletedScrollStepIntoView(),
      ),
    )
  })

  test('the screen width is followed by the media query', () => {
    story(
      Player.update,
      given(Player.init('system-design', loadBalancer, 0)),
      message(Player.Message.ChangedStackedScreen({ isStacked: true })),
      model(next => {
        expect(next.isStacked).toBe(true)
      }),
    )
  })
})
