# Кадры урока 2 «Password attacks. Как подбирают пароли»

Кадры сгенерированы моделью Gemini для изображений (`gemini-3.1-flash-image`) с листом персонажей `docs/mockups/security/cast.webp` как образцом, по промптам ниже; кадры с текстом, логотипами, лишними героями или пустыми рамками исправлены правкой той же картинки. Чтобы перегенерировать кадр, возьмите общий блок и промпт кадра; после правки картинки проверьте альт-тексты в `text.<язык>.ts` и координаты реплик в `lesson.ts`.

## Общее для каждого промпта

> Flat vector cartoon illustration with dark outlines, warm cream background, pastel palette (mint, peach, mustard, indigo, coral for danger). Calm, friendly office tone for adult professionals, no scare tactics. Characters exactly as on the attached cast sheet: Marina (dark curly hair in a bun, round glasses, mustard cardigan, badge on a lanyard), Oleg (red hair, beard, mint sweater, always with a mug), Viktor (grey hair and beard, dark-blue blazer), Ira (purple bob, black hoodie, headset), Stripes the scammer (long nose, thin moustache, black beanie, black-and-white striped top; in any disguise the stripes still show). 4:3 frame. No text, letters, numbers or logos anywhere in the picture: no words on screens, doors, signs or papers; screens show only abstract shapes. Leave the top-left or top-right quarter and a strip along the bottom calm, for speech bubbles and a caption added later in HTML.

## Кадры

### `machine.webp` — шаги `by-machine` и `patterns`

> Stripes lounges in an office chair with his feet up, sipping coffee, not even looking. Beside him a big clunky key-trying machine with a funnel on top and a conveyor belt: a huge heap of ordinary keys pours into the funnel, and a mechanical arm at the end pushes key after key into the lock of a single closed door with an envelope pictogram, with little motion lines showing speed. A few rejected keys lie on the floor. The keys in the heap are simple, common shapes, many of them almost identical. Speech-bubble space top-right; the heap of keys is in the lower left.

Реплика Полосатого — справа сверху. На шаге `patterns` вместо реплики — лупа над кучей ключей (шаблоны паролей), HTML поверх кадра.

### `archive.webp` — шаги `leaks` и `stuffing` (вопрос)

> A vast archive hall that disappears into the distance: tall shelves packed with identical boxes and open drawers overflowing with keys and blank paper tags. Stripes stands on a rolling library ladder, pulling out a long drawer full of keys, holding up one golden key on a blank tag and grinning. On the floor below, a small box with a lunch-box pictogram is broken open, its keys spilling into a drawer. Speech-bubble space top-left.

Реплика Полосатого — слева сверху, красная рамка. Тот же кадр служит вопросу `stuffing`.

### `profile.webp` — шаг `personal`

> Stripes holds up a giant smartphone like a window, scrolling Oleg's public photo feed shown as three big picture tiles: a birthday cake with candles (no digits), a fluffy ginger cat on a sofa, and Oleg with his mug and the cat. With the other hand Stripes jots on a blank notepad. In the background, at a distant desk, Oleg happily posts another photo of his cat from his phone, unaware. Speech-bubble space top-right.

Реплика Полосатого — справа сверху.

### `phrase.webp` — шаг `phrase`

> Marina calmly holds up a long, unusual key whose bit is made of three unrelated little charms strung together: a coffee cup, a pair of skis and a small window with a flowerpot on its sill. Next to her the clunky key-trying machine from before has jammed: a puff of grey smoke, a spring popping out, its heap of keys untouched, and Stripes scratches his head beside it. The door behind Marina stays closed and safe, with a soft green glow around its lock. Speech-bubble space top-left.

Реплика Марины — слева сверху; справа сверху — карточка сравнения трёх паролей (`compare` в `lesson.ts`), HTML поверх кадра.

### `check.webp` — шаг `check`

> Marina sits at her desk with a laptop. On the laptop screen there is only a big envelope icon under a magnifying glass and a green check mark (abstract shapes, no writing). Next to the laptop lie her phone showing a large shield icon and a small friendly wall-safe icon on a sticker-free monitor stand. Oleg leans over her shoulder with his mug, curious. Calm, relieved mood. Speech-bubble space top-left.

Реплика Марины — слева сверху.

## Итог

Галерея итога берёт все пять кадров: `machine`, `archive`, `profile`, `phrase`, `check`.
