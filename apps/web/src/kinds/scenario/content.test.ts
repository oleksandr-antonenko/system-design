import { Array, Option, Record } from 'effect'
import { describe, expect, test } from 'vitest'

import { loadedDefinitions } from '../../courses/registry'
import {
  type LessonDefinition,
  type TaskLogs,
  boardAt,
  taskOf,
  taskStartBoard,
} from '../../lesson/dsl'
import type { ScenarioTypes } from '../types'
import { scenario } from './kind'

// Тест контента вида «сценарий» (spec scenario-board, «Проверка контента
// сцен»): у каждого кадра есть альт-текст, у каждой миниатюры галереи —
// подпись. Остальное (говорящий есть на кадре, тексты на всех языках,
// эталон решает задачу) проверяют общие тесты контента через контракт вида.

const scenarioLessons = Array.getSomes(
  Array.map(
    loadedDefinitions(),
    ({
      course,
      definition,
    }): Option.Option<readonly [string, LessonDefinition<ScenarioTypes>]> =>
      definition.board === 'scenario'
        ? Option.some([`${course}/${definition.slug}`, definition])
        : Option.none(),
  ),
)

const solutionLogs = (
  lesson: LessonDefinition<ScenarioTypes>,
): TaskLogs<ScenarioTypes['Op']> =>
  Record.fromEntries(
    Array.getSomes(
      Array.map(lesson.steps, lessonStep =>
        Option.map(
          taskOf(lessonStep),
          (task): readonly [string, ReadonlyArray<ScenarioTypes['Op']>] => [
            task.id,
            task.solution,
          ],
        ),
      ),
    ),
  )

const shownScene = (lesson: LessonDefinition<ScenarioTypes>, index: number) =>
  Option.match(Option.flatMap(Array.get(lesson.steps, index), taskOf), {
    onNone: () => boardAt(lesson, index, solutionLogs(lesson)),
    onSome: () => taskStartBoard(lesson, index, solutionLogs(lesson)),
  }).scene

test('the security course has scenario lessons', () => {
  expect(scenarioLessons.length).toBeGreaterThan(0)
})

describe.each(scenarioLessons)('scenario lesson %s', (_name, lesson) => {
  test('it is a slides lesson of the scenario kind', () => {
    expect(lesson.kind).toBe(scenario)
    expect(scenario.presentation).toBe('slides')
  })

  test('every frame has an alt text; every gallery frame has a caption', () => {
    lesson.steps.forEach((lessonStep, index) => {
      const scene = shownScene(lesson, index)
      const captions = Array.map(lessonStep.stage, item => item.caption)
      if (scene._tag === 'Frame') {
        expect(
          Array.some(captions, caption => caption._tag === 'Alt'),
          `step ${lessonStep.id}: frame ${scene.id} has no alt text`,
        ).toBe(true)
      }
      if (scene._tag === 'Gallery') {
        scene.frames.forEach(frame =>
          expect(
            Array.some(
              captions,
              caption => caption._tag === 'Thumb' && caption.frame === frame.id,
            ),
            `step ${lessonStep.id}: thumb ${frame.id} has no caption`,
          ).toBe(true),
        )
      }
    })
  })
})
