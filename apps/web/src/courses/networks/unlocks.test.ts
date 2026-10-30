import { Array, Option, Record } from 'effect'
import { describe, expect, test } from 'vitest'

import { type PacketDoc } from '../../kinds/packet/doc'
import { stageFeatures, targetFeatures } from '../../kinds/packet/targets'
import type { PacketTypes } from '../../kinds/types'
import {
  type LessonDefinition,
  type TaskLogs,
  boardAt,
  taskOf,
  taskStartBoard,
} from '../../lesson/dsl'
import { referencedIds } from '../../lesson/markup'
import { quizFeature, quizOf } from '../../lesson/quiz'
import {
  findLesson,
  loadedDefinitions,
  loadedLesson,
  unlockedFeatures,
} from '../registry'
import course from './course'

// Интерфейс растёт вместе с учеником (план, раздел 3.4): урок пользуется
// только тем, что открыли он сам и прошлые уроки. Тест проверяет элементы
// сцены, ссылки в текстах, квизы и команды терминала в текстах и подсказках
// каждого урока курса сетей.

/** Команда в `код` текста → элемент интерфейса, который её открывает. */
const commandFeatures: Readonly<Record<string, string>> = {
  ping: 'terminal.ping',
  traceroute: 'terminal.traceroute',
  tracert: 'terminal.traceroute',
  nslookup: 'terminal.nslookup',
  dig: 'terminal.dig',
  curl: 'terminal.curl',
  ss: 'terminal.ss',
  nc: 'terminal.nc',
  ufw: 'terminal.ufw',
  docker: 'terminal.docker',
  arp: 'terminal.arp',
  ip: 'terminal.ipAddr',
  ipconfig: 'terminal.ipAddr',
  ifconfig: 'terminal.ipAddr',
  npm: 'terminal.npmRunDev',
  npx: 'terminal.npmRunDev',
}

/** Команды терминала в тексте: первое слово кода `…` после `sudo`. */
export const commandsIn = (text: string): ReadonlyArray<string> =>
  Array.getSomes(
    Array.map(Array.fromIterable(text.matchAll(/`([^`]+)`/g)), match => {
      const words = (match[1] ?? '').trim().split(/\s+/)
      const program = words[0] === 'sudo' ? (words[1] ?? '') : (words[0] ?? '')
      return Option.fromNullishOr(commandFeatures[program])
    }),
  )

const solutionLogs = (
  lesson: LessonDefinition<PacketTypes>,
): TaskLogs<PacketTypes['Op']> =>
  Record.fromEntries(
    Array.getSomes(
      Array.map(lesson.steps, lessonStep =>
        Option.map(
          taskOf(lessonStep),
          (task): readonly [string, ReadonlyArray<PacketTypes['Op']>] => [
            task.id,
            task.solution,
          ],
        ),
      ),
    ),
  )

const shownBoard = (
  lesson: LessonDefinition<PacketTypes>,
  index: number,
): PacketDoc =>
  Option.match(Option.flatMap(Array.get(lesson.steps, index), taskOf), {
    onNone: () => boardAt(lesson, index, solutionLogs(lesson)),
    onSome: () => taskStartBoard(lesson, index, solutionLogs(lesson)),
  })

const networksLessons = Array.getSomes(
  Array.map(
    Array.filter(loadedDefinitions(), entry => entry.course === 'networks'),
    entry =>
      entry.definition.board === 'packet'
        ? Option.some(entry.definition)
        : Option.none(),
  ),
)

const unlockedIn = (slug: string): ReadonlyArray<string> =>
  Option.match(findLesson('networks', slug), {
    onNone: () => [],
    onSome: lesson => unlockedFeatures(course, lesson.meta.order),
  })

const missing = (
  unlocked: ReadonlyArray<string>,
  needed: ReadonlyArray<string>,
): ReadonlyArray<string> =>
  Array.filter(
    Array.dedupe(needed),
    feature =>
      Array.contains(course.features, feature) &&
      !Array.contains(unlocked, feature),
  )

describe('commands in texts', () => {
  test('a code span names its program; sudo is skipped', () => {
    expect(
      commandsIn('Run `ping 1.1.1.1`, then `sudo ufw status` and `ls`.'),
    ).toEqual(['terminal.ping', 'terminal.ufw'])
  })
})

describe.each(Array.map(networksLessons, lesson => [lesson.slug, lesson]))(
  'networks lesson %s uses only what is open by it',
  (slug, lesson) => {
    const unlocked = unlockedIn(slug)
    const texts = Option.match(loadedLesson('networks', slug), {
      onNone: () => [],
      onSome: found => found.texts,
    })

    test('stage elements', () => {
      lesson.steps.forEach(lessonStep =>
        lessonStep.stage.forEach(item =>
          expect(
            missing(unlocked, stageFeatures(item)),
            `step ${lessonStep.id}: ${item._tag}`,
          ).toEqual([]),
        ),
      )
    })

    test('quizzes', () => {
      lesson.steps.forEach(lessonStep =>
        Option.map(quizOf<PacketTypes>(lessonStep), quiz =>
          expect(
            missing(unlocked, [quizFeature(quiz.kind)]),
            `quiz ${quiz.id}`,
          ).toEqual([]),
        ),
      )
    })

    test.each(texts)('$locale: links in texts', ({ text }) => {
      lesson.steps.forEach((lessonStep, index) => {
        const doc = shownBoard(lesson, index)
        const body = text.steps?.[lessonStep.id]?.body
        const prose =
          typeof body === 'string'
            ? body
            : body === undefined
              ? ''
              : body({ doc, run: lesson.kind.run(doc) })
        referencedIds(prose).forEach(id =>
          expect(
            missing(unlocked, targetFeatures(doc.doc, id)),
            `step ${lessonStep.id}: [[${id}|…]]`,
          ).toEqual([]),
        )
      })
    })

    test.each(texts)(
      '$locale: terminal commands in texts and hints',
      ({ text }) => {
        const prose = [
          ...Object.values(text.steps ?? {}).flatMap(step => [
            typeof step.body === 'string' ? step.body : '',
            step.more?.body ?? '',
          ]),
          ...Object.values(text.tasks ?? {}).flatMap(task => [
            task.prompt,
            ...task.hints,
          ]),
          ...Object.values(text.quizzes ?? {}).flatMap(quiz => [
            quiz.question,
            quiz.explain,
          ]),
        ]
        prose.forEach(part =>
          expect(missing(unlocked, commandsIn(part)), part).toEqual([]),
        )
      },
    )
  },
)
