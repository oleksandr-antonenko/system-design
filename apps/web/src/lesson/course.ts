import { Array, Order, pipe } from 'effect'

/** Урок курса глазами палитры: номер и всё, что ставят в его задачах. */
export type CourseLesson = Readonly<{
  order: number
  palette: ReadonlyArray<string>
}>

/** Урок, в палитре задачи которого вид блока или устройства появляется
    впервые. */
export type KindDebut = Readonly<{ kind: string; lesson: number }>

const LATER_LIMIT = 4

export const kindDebuts = (
  course: ReadonlyArray<CourseLesson>,
): ReadonlyArray<KindDebut> =>
  pipe(
    course,
    Array.sort(
      Order.mapInput(Order.Number, (entry: CourseLesson) => entry.order),
    ),
    Array.flatMap(entry =>
      Array.map(entry.palette, kind => ({ kind, lesson: entry.order })),
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
): ReadonlyArray<string> =>
  pipe(
    kindDebuts(course),
    Array.filter(debut => debut.lesson === order),
    Array.map(debut => debut.kind),
  )
