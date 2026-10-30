## 1. Квиз в уроке и плеере

- [x] 1.1 `lesson/quiz.ts` (`QuizKind`, `QuizSpec` с ответом автора или движка, `QuizTexts`, `quizAnswer`, `quizFeature`), шаг с `quiz`, раздел `quizzes` в `LessonTexts` только при квизах. Проверка: `tsc --noEmit --pretty false`, `lesson/texts.test.ts`.
- [x] 1.2 Плеер: `Model.quizzes`, `ClickedChoice`, ответ с доски через `PickedTarget`, одна попытка, «Далее» и ссылка на шаг держатся до попытки, режим доски `Pick`. Проверка: `lesson/quiz.story.test.ts`.
- [x] 1.3 Карточка вопроса: вопрос, варианты `Choice` с картинкой вида, «Попытка одна», после попытки — почему неверно, верный ответ, объяснение; закрытая «Далее» под шагом и внизу с пояснением; строки на uk, ru, en, lt. Проверка: `scene.test.ts` (квиз урока «Кеширование»).

## 2. Выбор на доске System Design

- [x] 2.1 Контракт: `quizzes`, `picture`, `targetName`, `BoardInput.pickable`; у `flow` — `PickDevice`. Проверка: `tsc`.
- [x] 2.2 Доска: кандидаты с клавиатуры (`PressedPickKey`) и мышью (`ReleasedPointer`), `PickedNode`, классы `pickable`/`pick-wrong`/`pick-right`, метки, `hideUntilAnswered: ['load']`, режим «Вопрос · выберите на доске». Проверка: `board/scene.test.ts` (pick a block), `lesson/quiz.story.test.ts`.

## 3. Тексты шага

- [x] 3.1 Списки в разметке (`parseBlocks`). Проверка: `lesson/markup.test.ts`.
- [x] 3.2 «Подробнее» (`more`, `ClickedMore`) и «Как спросить ИИ» (`askAi`, `CopyAskAiTemplate`), стили. Проверка: тест контента «optional sections appear in every language alike», браузер.

## 4. Контент и курс сетей

- [x] 4.1 Тесты контента квизов и необязательных разделов. Проверка: `courses/content.test.ts`.
- [x] 4.2 Квиз `Choice` в уроке «Кеширование» на uk, ru, en, lt. Проверка: тест контента, `scene.test.ts`.
- [x] 4.3 `features.ts` и заглушки уроков 2, 3, 4, 6, 7, 8, 13: новые элементы, `router.routes` в уроке 13. Проверка: `courses/courses.test.ts` (каждый элемент открывает один урок).
- [x] 4.4 `CONTRIBUTING.md`: квизы, `more`, `askAi`, списки. Проверка: чтение раздела.

## 5. Проверка

- [x] 5.1 `pnpm check` зелёный; `openspec validate add-quiz-steps` проходит.
- [x] 5.2 Продакшен-сборка в браузере, 1440 и 390 px, ru и en: квиз урока «Кеширование» — неверный ответ, объяснение, «Далее» открылась; верный ответ; уроки «Балансировщик» и «Отказоустойчивость» решаются через «Показать решение»; в консоли нет ошибок.
