import { Option } from 'effect'

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
}>

/** Тексты квиза на одном языке. */
export type QuizTexts<
  Candidate extends string,
  Kind extends QuizKind,
> = Readonly<{
  question: string
  explain: string
  /** Почему неверен выбранный вариант: в карточке после попытки. */
  wrong?: Readonly<Partial<Record<Candidate, string>>>
  /** Короткая метка на доске у выбранного и у верного ответа. */
  tags?: Readonly<Partial<Record<Candidate, string>>>
}> &
  (Kind extends 'Choice'
    ? Readonly<{ options: Readonly<Record<Candidate, string>> }>
    : Readonly<{ options?: never }>)

export type LooseQuizTexts = Readonly<{
  question: string
  explain: string
  wrong?: Readonly<Partial<Record<string, string>>>
  tags?: Readonly<Partial<Record<string, string>>>
  options?: Readonly<Record<string, string>>
}>

export const quizAnswer = <T extends KindTypes>(
  quiz: QuizSpec<T>,
  doc: T['Doc'],
  run: T['Run'],
): string =>
  typeof quiz.answer === 'string' ? quiz.answer : quiz.answer(doc, run)

/** Квиз выбирают на доске, а не в карточке. */
export const isBoardQuiz = <T extends KindTypes>(quiz: QuizSpec<T>): boolean =>
  quiz.kind !== 'Choice'

/** Элемент `quiz.<вид>` в наборе `UiFeature`: `quiz.pickDevice`. */
export const quizFeature = (kind: QuizKind): string =>
  `quiz.${kind.charAt(0).toLowerCase()}${kind.slice(1)}`

export const quizOf = <T extends KindTypes>(
  step: Readonly<{ quiz?: QuizSpec<T> }>,
): Option.Option<QuizSpec<T>> => Option.fromNullishOr(step.quiz)
