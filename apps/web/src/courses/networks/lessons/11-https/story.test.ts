import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import type { PacketTypes } from '../../../../kinds/types'
import {
  type LessonDefinition,
  boardAt,
  foldDoc,
  taskOf,
  taskStartBoard,
  taskSurfaces,
} from '../../../../lesson/dsl'
import { quizAnswer, quizOf } from '../../../../lesson/quiz'
import { observerView } from '../../../../net/answers'
import { browse } from '../../../../net/browser'
import {
  issueCert,
  listen,
  setRedirect,
  stopListening,
} from '../../../../net/build'
import { findHost } from '../../../../net/doc'
import { checkGoal } from '../../../../net/goals'
import { NetMessage } from '../../../../net/message'
import { Intent, type Trace } from '../../../../net/packet'
import { certChecks, certFor } from '../../../../net/tls'
import { applyWorld, sendIntent } from '../../../../net/world'
import { unlockedFeatures } from '../../../registry'
import course from '../../course'
import https, { myappLogin, postcard, sealedLogin } from './lesson'

// Проверки урока 11 из сценария (раздел 8 «Проверки контента»): что видно
// в конверте на хопе телефон → кафе по http:// и по https://, паспорт
// shop.example, ответ квиза, старт задачи, эталон, типичные ошибки и то,
// что урок пользуется только открытым к нему.

const lesson: LessonDefinition<PacketTypes> = https

const kind = lesson.kind

const stepIndex = (id: string): number =>
  lesson.steps.findIndex(lessonStep => lessonStep.id === id)

const TASK = stepIndex('get-certificate')

const task = Option.getOrThrow(taskOf(lesson.steps[TASK]!))

const start = taskStartBoard(lesson, TASK, {})

/** Конверт запроса на первом хопе, телефон → Wi-Fi кафе. */
const cafeHop = (trace: Trace) =>
  Option.getOrThrow(
    Array.findFirst(
      trace.hops,
      hop =>
        hop.from === 'phone' &&
        hop.to === 'cafe' &&
        Array.some(hop.envelope, layer => layer._tag === 'Http'),
    ),
  )

const seenAt = (index: number, intent: Intent) =>
  observerView(cafeHop(sendIntent(boardAt(lesson, index, {}), intent)[0]))

const goalsAfter = (ops: ReadonlyArray<PacketTypes['Op']>) => {
  const world = foldDoc(kind, start, ops)
  const run = kind.run(world)
  return Array.map(task.goals, ({ id, goal }) => {
    const check = checkGoal(world.doc, run.settled, goal)
    return { id, met: check.met, failure: check.maybeFailure }
  })
}

const failureOf = (ops: ReadonlyArray<PacketTypes['Op']>, id: string) =>
  Option.flatMap(
    Array.findFirst(goalsAfter(ops), goal => goal.id === id),
    goal => goal.failure,
  )

const metIds = (ops: ReadonlyArray<PacketTypes['Op']>) =>
  Array.map(
    Array.filter(goalsAfter(ops), goal => goal.met),
    goal => goal.id,
  )

describe('lesson 11: HTTP, HTTPS and certificates', () => {
  test('step 1: plain http is a postcard — the password is readable on the café hop', () => {
    const seen = seenAt(stepIndex('postcard'), postcard)
    expect(seen.sealed).toBe(false)
    expect(
      Option.map(seen.maybeHttp, layer => [
        layer.method,
        layer.host,
        layer.path,
        layer.fields,
      ]),
    ).toEqual(
      Option.some([
        'POST',
        'myapp.example',
        '/login',
        [
          { name: 'login', value: 'anna' },
          { name: 'password', value: 'kotik2024' },
        ],
      ]),
    )
  })

  test('step 2: https seals it — outside are only 198.51.100.10, port 443 and shop.example', () => {
    const seen = seenAt(stepIndex('sealed'), sealedLogin)
    expect([
      seen.dst,
      seen.dstPort,
      seen.maybeSni,
      seen.sealed,
      seen.maybeHttp,
    ]).toEqual([
      Option.some('198.51.100.10'),
      Option.some(443),
      Option.some('shop.example'),
      true,
      Option.none(),
    ])
  })

  test('steps 1–4: the phone already knows both names, so the run starts with the envelope to the site', () => {
    const world = boardAt(lesson, stepIndex('postcard'), {})
    Array.forEach([postcard, sealedLogin], intent =>
      expect(
        Array.some(sendIntent(world, intent)[0].hops, hop =>
          Array.some(hop.envelope, layer => layer._tag === 'Dns'),
        ),
      ).toBe(false),
    )
  })

  test('step 3: the shop.example passport passes all three checks', () => {
    const world = boardAt(lesson, stepIndex('passport'), {})
    const shop = Option.getOrThrow(findHost(world.doc, 'shop'))
    const cert = Option.getOrThrow(certFor(shop, 'shop.example'))
    expect(
      certChecks(world.doc, world.state.clock, 'shop.example', cert),
    ).toEqual({ name: true, date: true, issuer: true })
    expect(
      browse(world.doc, world.state, 'phone', 'https://shop.example/').view,
    ).toMatchObject({ _tag: 'Page', secure: true })
  })

  test('the quiz answer is what the engine leaves outside the seal on the café hop', () => {
    const index = stepIndex('cafe-sees')
    const world = boardAt(lesson, index, {})
    const seen = seenAt(index, sealedLogin)
    const visible =
      Option.isSome(seen.dst) &&
      Option.isSome(seen.dstPort) &&
      Option.isSome(seen.maybeSni) &&
      Option.isNone(seen.maybeHttp)
    expect(visible).toBe(true)
    expect(
      Option.map(quizOf<PacketTypes>(lesson.steps[index]!), quiz =>
        quizAnswer(quiz, world, kind.run(world)),
      ),
    ).toEqual(Option.some('address-port-name'))
  })

  test('task start: only only-web is met; the phone sees the name mismatch', () => {
    expect(metIds([])).toEqual(['only-web'])
    expect(failureOf([], 'lock')).toEqual(
      Option.some(
        NetMessage.CertNameMismatch({
          device: 'vps',
          name: 'myapp.example',
          names: ['vps-20.hosting.example'],
        }),
      ),
    )
    expect(
      browse(start.doc, start.state, 'phone', 'https://myapp.example/').view,
    ).toMatchObject({ code: 'NET::ERR_CERT_COMMON_NAME_INVALID' })
    expect(
      browse(start.doc, start.state, 'phone', 'http://myapp.example/').view,
    ).toMatchObject({ code: 'ERR_CONNECTION_REFUSED' })
  })

  test('the reference solution meets all four goals; the new passport is for 90 days', () => {
    expect(metIds(task.solution)).toEqual([
      'lock',
      'lock-www',
      'redirect',
      'only-web',
    ])
    const world = foldDoc(kind, start, task.solution)
    expect(
      Option.flatMap(findHost(world.doc, 'vps'), vps => Array.head(vps.certs)),
    ).toEqual(
      Option.some({
        names: ['myapp.example', 'www.myapp.example'],
        issuer: 'Example CA',
        notAfter: '2027-01-28',
      }),
    )
  })

  test('issuing before port 80 is open: the authority is refused', () => {
    expect(
      applyWorld(
        start,
        issueCert('vps', ['myapp.example', 'www.myapp.example']),
      ),
    ).toMatchObject({
      _tag: 'Failure',
      failure: NetMessage.AcmeChallengeFailed({
        name: 'myapp.example',
        problem: 'refused',
        maybeIp: Option.some('198.51.100.20'),
      }),
    })
  })

  test('typical mistakes from the script', () => {
    const open80 = listen('vps', 'tcp', '0.0.0.0', 80)
    const opened = foldDoc(kind, start, [open80])
    const failureOfIssue = (names: ReadonlyArray<string>) =>
      applyWorld(opened, issueCert('vps', names))
    expect(failureOfIssue(['myap.example'])).toMatchObject({
      failure: { _tag: 'AcmeChallengeFailed', problem: 'not-found' },
    })
    expect(failureOfIssue(['shop.example'])).toMatchObject({
      failure: { _tag: 'AcmeChallengeFailed', problem: 'wrong-server' },
    })
    expect(failureOfIssue(['198.51.100.20'])).toMatchObject({
      failure: { _tag: 'NameIsAddress' },
    })
    expect(
      failureOf([open80, issueCert('vps', ['myapp.example'])], 'lock-www'),
    ).toEqual(
      Option.some(
        NetMessage.CertNameMismatch({
          device: 'vps',
          name: 'www.myapp.example',
          names: ['myapp.example'],
        }),
      ),
    )
    const issued = [
      open80,
      issueCert('vps', ['myapp.example', 'www.myapp.example']),
    ]
    expect(failureOf(issued, 'redirect')).toEqual(
      Option.some(
        NetMessage.GoalNotRedirected({
          url: 'http://myapp.example/',
          status: 200,
        }),
      ),
    )
    expect(
      failureOf(
        [...task.solution, stopListening('vps', 'tcp', 80)],
        'redirect',
      ),
    ).toMatchObject(Option.some({ _tag: 'PortClosed', port: 80 }))
    expect(
      failureOf(
        [...task.solution, listen('vps', 'tcp', '0.0.0.0', 5432)],
        'only-web',
      ),
    ).toMatchObject(Option.some({ _tag: 'GoalExtraOpenPort', port: 5432 }))
    expect(
      failureOf(
        [...task.solution, listen('vps', 'tcp', '0.0.0.0', 3000)],
        'only-web',
      ),
    ).toMatchObject(Option.some({ _tag: 'GoalExtraOpenPort', port: 3000 }))
    expect(metIds([...issued, setRedirect('vps', true)])).toHaveLength(4)
  })

  test('the board captions say what the neighbour sees, as the engine does', () => {
    const solved = { 'get-certificate': task.solution }
    const summary = boardAt(lesson, stepIndex('summary'), solved)
    const seen = observerView(cafeHop(sendIntent(summary, myappLogin)[0]))
    expect([seen.maybeSni, seen.dstPort, seen.maybeHttp]).toEqual([
      Option.some('myapp.example'),
      Option.some(443),
      Option.none(),
    ])
    expect(sendIntent(summary, myappLogin)[0].outcome).toMatchObject({
      _tag: 'Delivered',
      answer: { secure: true },
    })
  })

  test('the task works through the board, the phone, the server panel and the laptop terminal — all open by lesson 11', () => {
    expect(taskSurfaces(task)).toEqual([
      'board',
      'browser:phone',
      'server:vps',
      'terminal:laptop',
    ])
    const open = unlockedFeatures(course, 11)
    Array.forEach(
      [
        'terminal.curl',
        'browser.certificate',
        'browser.errCert',
        'server.site',
        'server.cert',
        'board.sealedEnvelope',
      ],
      feature => expect(open).toContain(feature),
    )
  })
})
