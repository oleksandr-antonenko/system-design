import { Array, Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import ports from '../../../../courses/networks/lessons/06-ports-and-localhost/lesson'
import * as Player from '../../../../lesson/player'
import { run, send } from '../../../../net/build'
import { Intent } from '../../../../net/packet'
import { SurfaceMessage } from '../../../state'
import { packet } from '../../dsl'
import { momentsOf } from '../history'
import { devices, lockOut } from '../testing'
import { terminalFeatures } from '../unlocks'
import { Message } from './message'
import { FocusInput, type Model } from './terminal'
import { isConsole, sessionOf, transcriptOf } from './transcript'
import { terminalView } from './view'

// Терминал — тонкий вид над `runCommand`: выполненная строка — операция в
// журнале задачи, вывод считается по истории. Поэтому отмена, сброс и
// «Показать решение» меняют вывод вместе с журналом.

const TASK = 'phone-dev'
const TERMINAL = 'terminal:laptop'

/** Урок 6 на шаге задачи: вопрос перед ней уже отвечен. */
const atTask = (): Player.Model => ({
  ...Player.init('networks', ports, 0),
  quizzes: { 'phone-localhost': { picked: 'refused', isCorrect: true } },
  step: 4,
})

const update = (
  playerModel: Player.Model,
  playerMessage: Player.Message,
): ReturnType<typeof Player.update> =>
  Player.updateWith(ports)(playerModel, playerMessage)

const terminal = (terminalMessage: Message) =>
  message(
    Player.Message.GotSurfaceMessage({
      surfaceId: TERMINAL,
      message: SurfaceMessage.GotTerminalSurfaceMessage({
        message: terminalMessage,
      }),
    }),
  )

const typed = (line: string) => [
  terminal(Message.UpdatedDraft({ value: line })),
  terminal(Message.SubmittedLine()),
]

const logOf = (playerModel: Player.Model) =>
  Player.opsOf(packet, Player.taskStateOf(playerModel, TASK).log)

const shown = (playerModel: Player.Model) =>
  terminalView(Player.surfaceContext(ports, playerModel, 'laptop'))

const lines = (playerModel: Player.Model): ReadonlyArray<string> =>
  Array.flatMap(shown(playerModel).entries, entry =>
    entry._tag === 'Command'
      ? [`$ ${entry.line}`, ...entry.result.output]
      : [entry._tag],
  )

const terminalModel = (playerModel: Player.Model): Option.Option<Model> =>
  Option.flatMap(Option.fromNullishOr(playerModel.surfaces[TERMINAL]), state =>
    state._tag === 'TerminalSurface' ? Option.some(state.model) : Option.none(),
  )

const noticeOf = (playerModel: Player.Model) =>
  Option.flatMap(terminalModel(playerModel), current => current.maybeNotice)

describe('terminal surface', () => {
  test('the task starts with the dev server from step 2 holding the terminal', () => {
    const start = shown(atTask())
    expect(start.isRunning).toBe(true)
    expect(lines(atTask())).toContain('$ npm run dev')
    expect(lines(atTask())).toContain('  ➜  Network: use --host to expose')
  })

  test('a command while the server runs is not run: the terminal is busy', () => {
    story(
      update,
      given(atTask()),
      ...typed('ip a'),
      model(next => {
        expect(logOf(next)).toEqual([])
        expect(Option.map(noticeOf(next), notice => notice._tag)).toEqual(
          Option.some('Busy'),
        )
      }),
    )
  })

  test('Ctrl+C stops the server; the restart with -- --host prints the laptop address', () => {
    story(
      update,
      given(atTask()),
      terminal(Message.PressedInterrupt()),
      model(next => {
        expect(logOf(next)).toEqual([run('laptop', 'Ctrl+C')])
        expect(shown(next).isRunning).toBe(false)
        expect(lines(next)).toContain('^C')
      }),
      ...typed('npm run dev -- --host'),
      model(next => {
        expect(logOf(next)).toEqual([
          run('laptop', 'Ctrl+C'),
          run('laptop', 'npm run dev -- --host'),
        ])
        expect(lines(next)).toContain('  ➜  Network: http://192.168.1.42:5173/')
        expect(
          Option.map(Player.currentTask(ports, next), ({ spec }) =>
            Array.map(
              Player.goalChecks(ports, Player.currentDoc(ports, next), spec),
              check => check.met,
            ),
          ),
        ).toEqual(Option.some([true, false]))
      }),
    )
  })

  test('Ctrl+C at an idle prompt is not a move', () => {
    story(
      update,
      given(atTask()),
      terminal(Message.PressedInterrupt()),
      terminal(Message.PressedInterrupt()),
      model(next => {
        expect(logOf(next)).toEqual([run('laptop', 'Ctrl+C')])
      }),
    )
  })

  test('an unknown or locked command gets a hint and no move', () => {
    story(
      update,
      given(atTask()),
      terminal(Message.PressedInterrupt()),
      ...typed('ls -la'),
      model(next => {
        expect(logOf(next)).toHaveLength(1)
        expect(noticeOf(next)).toMatchObject(
          Option.some({
            _tag: 'Hint',
            line: 'ls -la',
            message: {
              _tag: 'UnknownCommand',
              available: ['ip a', 'ping', 'npm run dev'],
            },
          }),
        )
      }),
      ...typed('traceroute 198.51.100.10'),
      model(next => {
        expect(logOf(next)).toHaveLength(1)
        expect(noticeOf(next)).toMatchObject(
          Option.some({ message: { _tag: 'CommandLocked' } }),
        )
      }),
      ...typed('ip a'),
      model(next => {
        expect(logOf(next)).toEqual([
          run('laptop', 'Ctrl+C'),
          run('laptop', 'ip a'),
        ])
        expect(noticeOf(next)).toEqual(Option.none())
        expect(lines(next)).toContain('en0: inet 192.168.1.42/24')
      }),
    )
  })

  test('↑ and ↓ walk through typed lines', () => {
    story(
      update,
      given(atTask()),
      ...typed('ip a'),
      ...typed('ping 192.168.1.1'),
      terminal(Message.PressedRecall({ direction: 'Older' })),
      model(next => {
        expect(
          Option.map(terminalModel(next), current => current.draft),
        ).toEqual(Option.some('ping 192.168.1.1'))
      }),
      terminal(Message.PressedRecall({ direction: 'Older' })),
      terminal(Message.PressedRecall({ direction: 'Older' })),
      model(next => {
        expect(
          Option.map(terminalModel(next), current => current.draft),
        ).toEqual(Option.some('ip a'))
      }),
      terminal(Message.PressedRecall({ direction: 'Newer' })),
      terminal(Message.PressedRecall({ direction: 'Newer' })),
      model(next => {
        expect(
          Option.map(terminalModel(next), current => current.draft),
        ).toEqual(Option.some(''))
      }),
    )
  })

  test('a suggestion fills the line and focuses it', () => {
    story(
      update,
      given(atTask()),
      terminal(Message.ClickedSuggestion({ command: 'ip a' })),
      Command.expectHas(FocusInput({ device: 'laptop' })),
      Command.resolve(FocusInput, Message.CompletedFocusInput()),
      model(next => {
        expect(
          Option.map(terminalModel(next), current => current.draft),
        ).toEqual(Option.some('ip a'))
      }),
    )
  })

  test('undo takes the line back out of the output and the server runs again', () => {
    story(
      update,
      given(atTask()),
      terminal(Message.PressedInterrupt()),
      message(Player.Message.ClickedUndo()),
      model(next => {
        expect(logOf(next)).toEqual([])
        expect(shown(next).isRunning).toBe(true)
        expect(lines(next)).not.toContain('^C')
      }),
    )
  })

  test('the third hint ghosts the next command; show solution prints the same output', () => {
    const replayStep = Command.resolve(
      Player.WaitBeforeReplayStep,
      Player.Message.CompletedWaitBeforeReplayStep(),
    )
    story(
      update,
      given(atTask()),
      ...Array.makeBy(3, () => message(Player.Message.ClickedHint())),
      model(next => {
        expect(shown(next).maybeGhost).toEqual(Option.some('Ctrl+C'))
      }),
      terminal(Message.PressedInterrupt()),
      model(next => {
        expect(shown(next).maybeGhost).toEqual(
          Option.some('npm run dev -- --host'),
        )
      }),
      message(Player.Message.ClickedShowSolution()),
      replayStep,
      replayStep,
      replayStep,
      replayStep,
      model(next => {
        expect(logOf(next)).toEqual([
          run('laptop', 'Ctrl+C'),
          run('laptop', 'npm run dev -- --host'),
          send(
            Intent.Browse({ from: 'phone', url: 'http://192.168.1.42:5173/' }),
          ),
        ])
        expect(Player.taskStateOf(next, TASK).check).toEqual(
          Player.CheckState.Solved({ withHint: true }),
        )
        expect(lines(next)).toContain('  ➜  Network: http://192.168.1.42:5173/')
        expect(shown(next).maybeGhost).toEqual(Option.none())
      }),
    )
  })
})

describe('terminal on a server', () => {
  const atServer = (): Player.Model => ({
    ...Player.init('networks', devices, 0),
    tasks: Object.fromEntries(
      ['join', 'dns'].map(id => [
        id,
        {
          ...Player.taskStateOf(Player.init('networks', devices, 0), id),
          check: Player.CheckState.Solved({ withHint: false }),
        },
      ]),
    ),
    step: 3,
  })

  const transcript = (ops: ReadonlyArray<Parameters<typeof run>[1]>) => {
    const context = Player.surfaceContext(devices, atServer(), 'vps')
    const history = [
      ...context.history,
      ...Array.map(ops, line => run('vps', line)),
    ]
    const moments = momentsOf(history)
    const session = sessionOf(context.doc, 'vps')
    return {
      session,
      entries: transcriptOf(
        moments,
        'vps',
        terminalFeatures(context.unlocked),
        session,
      ),
    }
  }

  test('it is an ssh session from the laptop with the login banner', () => {
    const { session, entries } = transcript([])
    expect(session).toEqual(Option.some({ server: 'vps', from: 'laptop' }))
    expect(entries).toEqual([
      {
        _tag: 'Login',
        maybeBanner: Option.some(
          'Last login: Thu Oct 29 21:14:03 2026 from 203.0.113.7',
        ),
      },
    ])
    expect(isConsole(entries, session)).toBe(false)
  })

  test('enabling the firewall without port 22 drops the session: the hosting console takes over', () => {
    const { session, entries } = transcript(['sudo ufw enable'])
    expect(Array.map(entries, entry => entry._tag)).toEqual([
      'Login',
      'Command',
      'Disconnected',
    ])
    expect(isConsole(entries, session)).toBe(true)
    const fixed = transcript([
      'sudo ufw enable',
      'sudo ufw allow from 203.0.113.7 to any port 22 proto tcp',
    ])
    expect(Array.map(fixed.entries, entry => entry._tag)).toEqual([
      'Login',
      'Command',
      'Disconnected',
      'Command',
      'Login',
    ])
    expect(isConsole(fixed.entries, fixed.session)).toBe(false)
  })

  test('a lockout from another surface also switches the tab to the console', () => {
    const context = Player.surfaceContext(devices, atServer(), 'vps')
    const history = [...context.history, lockOut]
    const session = sessionOf(context.doc, 'vps')
    expect(
      isConsole(transcriptOf(momentsOf(history), 'vps', [], session), session),
    ).toBe(true)
  })
})
