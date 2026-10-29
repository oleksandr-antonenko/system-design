import { Array, Option, Order, pipe } from 'effect'

import type { ComponentKind } from '../domain/catalog'
import { type LessonDefinition, taskOf } from './dsl'

export type CourseLesson = Readonly<{
  order: number
  lesson: LessonDefinition
}>

/** Урок, в палитре задачи которого вид блока появляется впервые. */
export type KindDebut = Readonly<{ kind: ComponentKind; lesson: number }>

const LATER_LIMIT = 4

/** Все виды из палитр задач урока, в порядке палитр. */
export const lessonPalette = (
  lesson: LessonDefinition,
): ReadonlyArray<ComponentKind> =>
  Array.dedupe(
    Array.flatMap(lesson.steps, lessonStep =>
      Option.match(taskOf(lessonStep), {
        onNone: () => [],
        onSome: task => task.palette,
      }),
    ),
  )

export const kindDebuts = (
  course: ReadonlyArray<CourseLesson>,
): ReadonlyArray<KindDebut> =>
  pipe(
    course,
    Array.sort(
      Order.mapInput(Order.Number, (entry: CourseLesson) => entry.order),
    ),
    Array.flatMap(entry =>
      Array.map(lessonPalette(entry.lesson), kind => ({
        kind,
        lesson: entry.order,
      })),
    ),
    Array.dedupeWith((first, second) => first.kind === second.kind),
  )

/** «Позже в курсе» (D8): виды, которые впервые появятся в задачах следующих
    уроков, по порядку уроков, не больше четырёх. */
export const laterInCourse = (
  course: ReadonlyArray<CourseLesson>,
  order: number,
): ReadonlyArray<KindDebut> =>
  pipe(
    kindDebuts(course),
    Array.filter(debut => debut.lesson > order),
    Array.take(LATER_LIMIT),
  )

/** Виды, которые впервые появляются в этом уроке: в палитре у них метка «новое». */
export const newInLesson = (
  course: ReadonlyArray<CourseLesson>,
  order: number,
): ReadonlyArray<ComponentKind> =>
  pipe(
    kindDebuts(course),
    Array.filter(debut => debut.lesson === order),
    Array.map(debut => debut.kind),
  )
