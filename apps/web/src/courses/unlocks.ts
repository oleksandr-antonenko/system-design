import { Array, Order, pipe } from 'effect'

// Интерфейс растёт вместе с учеником (план, раздел 3.4): урок открывает
// элементы, и на уроке N видно всё, что открыли уроки курса 1..N.
// Считается так же, как палитра «Позже в курсе» (lesson/course.ts).

export type Unlocking<Feature extends string = string> = Readonly<{
  order: number
  unlocks: ReadonlyArray<Feature>
}>

const byOrder = Order.mapInput(
  Order.Number,
  (lesson: Unlocking<string>) => lesson.order,
)

/** Всё, что открыли уроки курса до урока `order` включительно, в порядке открытия. */
export const unlockedThrough = <Feature extends string>(
  lessons: ReadonlyArray<Unlocking<Feature>>,
  order: number,
): ReadonlyArray<Feature> =>
  pipe(
    lessons,
    Array.filter(lesson => lesson.order <= order),
    Array.sort(byOrder),
    Array.flatMap(lesson => lesson.unlocks),
    Array.dedupe,
  )

/** Что открывает сам урок: у этих элементов метка «новое». */
export const unlockedIn = <Feature extends string>(
  lessons: ReadonlyArray<Unlocking<Feature>>,
  order: number,
): ReadonlyArray<Feature> =>
  pipe(
    lessons,
    Array.filter(lesson => lesson.order === order),
    Array.flatMap(lesson => lesson.unlocks),
    Array.dedupe,
  )

export const isUnlockedThrough = <Feature extends string>(
  lessons: ReadonlyArray<Unlocking<Feature>>,
  order: number,
  feature: Feature,
): boolean =>
  Array.some(unlockedThrough(lessons, order), unlocked => unlocked === feature)

/** Поверхность (`terminal`, `router`, …) видна, если открыт хотя бы один её элемент. */
export const isSurfaceOpen = (
  unlocked: ReadonlyArray<string>,
  surface: string,
): boolean => Array.some(unlocked, feature => feature.startsWith(`${surface}.`))
