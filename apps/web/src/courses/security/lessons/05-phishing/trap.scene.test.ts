import { Array, Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import {
  click,
  expect,
  given,
  label,
  role,
  scene,
  selector,
  tap,
  text,
  type,
} from 'foldkit/scene'
import { describe, expect as expectValue, test } from 'vitest'

import * as Player from '../../../../lesson/player'
import { lessonView, loadedEntry } from '../../../../lesson/view'
import phishing from './lesson'

// Проверка «Вам повезло?» (spec phishing-trap): страница-двойник с призом и
// входом «Gooogle». Введённое в поля не попадает никуда: ни в сообщения, ни
// в Model плеера, ни в команды, а после выбора полей на странице нет.

const SECRET_EMAIL = 'trap-probe@victim.example'
const SECRET_PASSWORD = 'Sup3r-Secret-Probe!'

const entry = Option.getOrThrow(loadedEntry('security', 'phishing'))

/** Сцена урока, которая записывает каждое сообщение, каждую Model и каждую
    команду, прошедшие через `update`. */
const recordedScene = () => {
  const seen: Array<string> = []
  return {
    seen,
    sceneFor: {
      update: (playerModel: Player.Model, playerMessage: Player.Message) => {
        const result = Player.updateWith(phishing)(playerModel, playerMessage)
        seen.push(
          JSON.stringify(playerMessage),
          JSON.stringify(result.model),
          JSON.stringify(
            Array.map(result.commands ?? [], command => command.name),
          ),
        )
        return result
      },
      view: (playerModel: Player.Model, h: HtmlBuilder<Player.Message>) =>
        lessonView(
          phishing,
          entry,
          playerModel,
          { locale: 'ru', prefersDark: false },
          h,
        ),
    },
  }
}

const start = Player.init('security', phishing, 0)

describe('the prize trap', () => {
  test('typed email and password never reach a message, the Model or a command', () => {
    const { seen, sceneFor } = recordedScene()
    scene(
      sceneFor,
      given(start),
      expect(role('heading', { name: 'Выиграй iPhone Duo' })).toExist(),
      expect(label('Пароль')).toHaveAttr('type', 'text'),
      expect(label('Пароль')).toHaveAttr('autocomplete', 'off'),
      expect(role('form')).not.toExist(),
      type(label('Телефон или адрес эл. почты'), SECRET_EMAIL),
      type(label('Пароль'), SECRET_PASSWORD),
      click(role('button', { name: 'Войти' })),
      tap(simulation => {
        expectValue(simulation.commands).toEqual([])
      }),
      expect(selector('.trap-stamp')).toHaveText(/Это был фишинг/),
      expect(label('Пароль')).not.toExist(),
      expect(label('Телефон или адрес эл. почты')).not.toExist(),
      expect(
        text(/Мы ваш пароль никуда не сохраняли и не отправляли/),
      ).toExist(),
      expect(role('button', { name: /^Далее: / })).toExist(),
    )
    const everything = seen.join('\n')
    expectValue(everything).toContain('"UpdatedTrapField"')
    expectValue(everything).toContain('"isFilled":true')
    expectValue(everything).toContain('"picked":"login"')
    expectValue(everything).not.toContain(SECRET_EMAIL)
    expectValue(everything).not.toContain(SECRET_PASSWORD)
    expectValue(everything).not.toContain('victim')
    expectValue(everything).not.toContain('Sup3r')
  })

  test('an empty password gets a hint, like a real page, and is not an attempt yet', () => {
    const { seen, sceneFor } = recordedScene()
    scene(
      sceneFor,
      given(start),
      type(label('Телефон или адрес эл. почты'), SECRET_EMAIL),
      click(role('button', { name: 'Войти' })),
      expect(text('Введите пароль')).toExist(),
      expect(role('button', { name: /^Далее: / })).toHaveAttr(
        'disabled',
        'true',
      ),
    )
    expectValue(seen.join('\n')).not.toContain(SECRET_EMAIL)
  })

  test('Skip is the right answer and praises the student', () => {
    const { sceneFor } = recordedScene()
    scene(
      sceneFor,
      given(start),
      click(role('button', { name: 'Пропустить' })),
      expect(selector('.trap-stamp')).toHaveText(/молодец, вы не попались/),
      expect(text('Верно с первой попытки')).toExist(),
    )
  })
})
