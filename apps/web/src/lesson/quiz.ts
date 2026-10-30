import { Array, Option, Order, pipe } from 'effect'

import type { KindTypes } from '../kinds/contract'

// Квиз — вид шага (design D1 add-quiz-steps, план 3.3, 4.3). Попытка одна;
// после неё видны верный ответ и объяснение, и шаг открывает «Далее».

/** Виды квиза. `Choice` рисует карточка вопроса (2–4 варианта), остальные —
    доска вида: она объявляет, какие умеет (`BoardKind.quizzes`). */
export type QuizKind =
  | 'Choice'
  | 'PickDevice'
  | 'NextHop'
  | 'PickLinks'
  | 'PickLayer'
  | 'PlaceChips'
  | 'SpotFault'
  | 'PickRule'
  | 'Match'

/** Ответ, который считает движок по доске шага: автор его не пишет, и
    ошибиться в нём нельзя. */
export type ComputedAnswer<T extends KindTypes> = (
  doc: T['Doc'],
  run: T['Run'],
) => string

export type QuizSpec<
  T extends KindTypes,
  QuizId extends string = string,
  Candidate extends string = string,
> = Readonly<{
  id: QuizId
  kind: QuizKind
  /** Варианты `Choice` или то, что выбирают на доске: устройство, блок,
      связь (`link:…`), поле конверта (`env:…`). 2–5 штук. */
  candidates: ReadonlyArray<Candidate>
  answer: Candidate | ComputedAnswer<T>
  /** `Choice`: картинка варианта по ключу, которую рисует вид доски
      (например, экран ошибки браузера). */
  pictures?: Readonly<Partial<Record<Candidate, string>>>
  /** Что доска прячет до ответа: подсказка виду (у `flow` — `load`, нагрузка
      блоков). */
  hideUntilAnswered?: ReadonlyArray<string>
  /** Верных ответов несколько: ученик выделяет их и нажимает «Готово».
      Ответ — `allOf(…)`. У `PickLinks` всегда так. */
  multiple?: boolean
  /** `Match` и `PlaceChips`: места, на которые кладут варианты-чипы.
      Ответ — `matchOf({ место: чип })`. */
  slots?: ReadonlyArray<string>
}>

/** Тексты квиза на одном языке. */
export type QuizTexts<
  Candidate extends string,
  Kind extends QuizKind,
> = Readonly<{
  question: string
  explain: string
  /** Почему неверен выбранный вариант: в карточке после попытки. У квиза с
      несколькими ответами — и почему верен пропущенный вариант. */
  wrong?: Readonly<Partial<Record<Candidate, string>>>
  /** Короткая метка на доске у выбранного и у верного ответа. */
  tags?: Readonly<Partial<Record<Candidate, string>>>
  /** `Match`, `PlaceChips`: текст каждого места (карточки, куда кладут чип). */
  slots?: Readonly<Record<string, string>>
}> &
  (Kind extends 'Choice' | 'Match'
    ? Readonly<{ options: Readonly<Record<Candidate, string>> }>
    : Readonly<{
        /** Имена вариантов, которые доска не может назвать сама (строки
            черновика, чипы). */
        options?: Readonly<Partial<Record<Candidate, string>>>
      }>)

export type LooseQuizTexts = Readonly<{
  question: string
  explain: string
  wrong?: Readonly<Partial<Record<string, string>>>
  tags?: Readonly<Partial<Record<string, string>>>
  options?: Readonly<Partial<Record<string, string>>>
  slots?: Readonly<Record<string, string>>
}>

export const quizAnswer = <T extends KindTypes>(
  quiz: QuizSpec<T>,
  doc: T['Doc'],
  run: T['Run'],
): string =>
  typeof quiz.answer === 'string' ? quiz.answer : quiz.answer(doc, run)

// SEVERAL ANSWERS

const PART = '+'
const PAIR = '='

/** Части ответа: варианты квиза с несколькими ответами или пары
    «место=чип» у `Match`. */
export const pickParts = (pick: string): ReadonlyArray<string> =>
  pick === '' ? [] : pick.split(PART)

/** Ответ из нескольких вариантов, независимо от порядка: `allOf('a', 'b')`. */
export const allOf = (...ids: ReadonlyArray<string>): string =>
  pipe(ids, Array.dedupe, Array.sort(Order.String)).join(PART)

/** Ответ `Match`: какой чип на каком месте. */
export const matchOf = (pairs: Readonly<Record<string, string>>): string =>
  allOf(
    ...Array.map(
      Object.entries(pairs),
      ([slot, chip]) => `${slot}${PAIR}${chip}`,
    ),
  )

/** Пара «место=чип» ответа `Match`. */
export const pairOf = (part: string): readonly [string, string] => {
  const separator = part.indexOf(PAIR)
  return separator < 0
    ? [part, '']
    : [part.slice(0, separator), part.slice(separator + 1)]
}

const canonical = (pick: string): string => allOf(...pickParts(pick))

export const isMultiPick = <T extends KindTypes>(quiz: QuizSpec<T>): boolean =>
  quiz.multiple === true ||
  quiz.kind === 'PickLinks' ||
  quiz.slots !== undefined

/** Выбор ученика годится как ответ: один вариант, несколько разных
    вариантов или пары «место=чип» с каждым местом не больше одного раза. */
export const isValidPick = <T extends KindTypes>(
  quiz: QuizSpec<T>,
  pick: string,
): boolean => {
  const parts = pickParts(pick)
  const isDistinct = (values: ReadonlyArray<string>) =>
    Array.dedupe(values).length === values.length
  if (quiz.slots !== undefined) {
    const slots = quiz.slots
    const pairs = Array.map(parts, pairOf)
    return (
      Array.isReadonlyArrayNonEmpty(pairs) &&
      isDistinct(Array.map(pairs, ([slot]) => slot)) &&
      Array.every(
        pairs,
        ([slot, chip]) =>
          Array.contains(slots, slot) && Array.contains(quiz.candidates, chip),
      )
    )
  }
  return isMultiPick(quiz)
    ? Array.isReadonlyArrayNonEmpty(parts) &&
        isDistinct(parts) &&
        Array.every(parts, part => Array.contains(quiz.candidates, part))
    : Array.contains(quiz.candidates, pick)
}

/** Верен ли выбор: части совпадают с ответом без учёта порядка. */
export const isCorrectPick = (pick: string, answer: string): boolean =>
  canonical(pick) === canonical(answer)

/** Квиз выбирают на доске, а не в карточке. */
export const isBoardQuiz = <T extends KindTypes>(quiz: QuizSpec<T>): boolean =>
  quiz.kind !== 'Choice'

/** Элемент `quiz.<вид>` в наборе `UiFeature`: `quiz.pickDevice`. */
export const quizFeature = (kind: QuizKind): string =>
  `quiz.${kind.charAt(0).toLowerCase()}${kind.slice(1)}`

export const quizOf = <T extends KindTypes>(
  step: Readonly<{ quiz?: QuizSpec<T> }>,
): Option.Option<QuizSpec<T>> => Option.fromNullishOr(step.quiz)
