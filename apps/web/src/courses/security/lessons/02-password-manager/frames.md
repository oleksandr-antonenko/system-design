# Кадры урока 2 «Password manager. Один пароль — одна дверь»

Кадры сгенерированы моделью Gemini для изображений (`gemini-3.1-flash-image`) с листом персонажей `docs/mockups/security/cast.webp` как образцом, по промптам ниже; кадры с текстом, логотипами, лишними героями или пустыми рамками исправлены правкой той же картинки. Чтобы перегенерировать кадр, возьмите общий блок и промпт кадра; после правки картинки проверьте альт-тексты в `text.<язык>.ts` и координаты реплик в `lesson.ts`.

## Общее для каждого промпта

> Flat vector cartoon illustration with dark outlines, warm cream background, pastel palette (mint, peach, mustard, indigo, coral for danger). Calm, friendly office tone for adult professionals, no scare tactics. Characters exactly as on the attached cast sheet: Marina (dark curly hair in a bun, round glasses, mustard cardigan, badge on a lanyard), Oleg (red hair, beard, mint sweater, always with a mug), Viktor (grey hair and beard, dark-blue blazer), Ira (purple bob, black hoodie, headset), Stripes the scammer (long nose, thin moustache, black beanie, black-and-white striped top; in any disguise the stripes still show). 4:3 frame. No text, letters, numbers or logos anywhere in the picture: no words on screens, doors, signs or papers; screens show only abstract shapes. Leave the top-left or top-right quarter and a strip along the bottom calm, for speech bubbles and a caption added later in HTML.

## Кадры

### `keys.webp` — шаг `one-key`

> Oleg stands in a corridor holding up a big ring of identical golden keys, proud and relaxed, mug in the other hand. Behind him four doors in a row, each marked only by a simple pictogram: an envelope, a bar chart, a lunch box, a bank building. Every key on the ring is the same shape. Speech-bubble space top-left, the doors on the right.

Реплика Олега — слева сверху; подпись дверей — справа сверху.

### `leak.webp` — шаг `leak`

> A month later. Stripes walks out of a broken-open lunch-box door (a cracked box spilling paper slips — the hacked delivery site) holding one golden key just like Oleg's. He is already turning it in the envelope door, which swings open; the bar-chart door next to it is also ajar. Sly grin, stripes visible. Speech-bubble space top-right.

Реплика Полосатого — справа сверху, красная рамка.

### `vault.webp` — шаг `vault`

> Marina stands next to an open friendly wall safe. Inside, on little hooks, hang many different keys — each a different shape and colour, one per door. In her hand she holds a single small key (the key to the safe itself) on her lanyard. Behind her the same four doors, each now with its own differently shaped lock. Speech-bubble space top-left.

Реплика Марины — слева сверху.

Тот же кадр служит шагу `app` («Как он выглядит: 1Password»): реплика Марины слева сверху, метка «1Password в браузере» у монитора.

### `twin.webp` — шаг `no-autofill` (вопрос)

> Oleg at his desk looks at a laptop showing a sign-in page that looks like the company CRM (abstract shapes only, no letters). In the corner of the screen a small safe icon stays firmly closed, with a tiny "no" gesture (closed shutter), offering no key. Oleg scratches his head, puzzled. A dangling fishing hook is barely visible at the edge of the screen. Speech-bubble space top-right.

Мысль Олега — справа сверху.

Тот же кадр служит шагу `lookalike`: справа сверху вместо мысли — карточка сравнения адресов (`compare` в `lesson.ts`), HTML поверх кадра.

## Итог

Галерея итога берёт те же четыре кадра: `keys`, `leak`, `vault`, `twin`.
