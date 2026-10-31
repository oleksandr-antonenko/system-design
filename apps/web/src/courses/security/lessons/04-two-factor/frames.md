# Кадры урока 4 «2FA. Второй замок»

Кадры сгенерированы моделью Gemini для изображений (`gemini-3.1-flash-image`) с листом персонажей `docs/mockups/security/cast.webp` как образцом, по промптам ниже; кадры с текстом, логотипами, лишними героями или пустыми рамками исправлены правкой той же картинки. Чтобы перегенерировать кадр, возьмите общий блок и промпт кадра; после правки картинки проверьте альт-тексты в `text.<язык>.ts` и координаты реплик в `lesson.ts`.

## Общее для каждого промпта

> Flat vector cartoon illustration with dark outlines, warm cream background, pastel palette (mint, peach, mustard, indigo, coral for danger). Calm, friendly office tone for adult professionals, no scare tactics. Characters exactly as on the attached cast sheet: Marina (dark curly hair in a bun, round glasses, mustard cardigan, badge on a lanyard), Oleg (red hair, beard, mint sweater, always with a mug), Viktor (grey hair and beard, dark-blue blazer), Ira (purple bob, black hoodie, headset), Stripes the scammer (long nose, thin moustache, black beanie, black-and-white striped top; in any disguise the stripes still show). 4:3 frame. No text, letters, numbers or logos anywhere in the picture: no words on screens, doors, signs or papers; screens show only abstract shapes. Leave the top-left or top-right quarter and a strip along the bottom calm, for speech bubbles and a caption added later in HTML.

## Кадры

### `locks.webp` — шаг `second-lock`

> A sturdy office door (abstract shapes, no signs) with two locks one above the other: an ordinary keyhole lock and a second lock with a small blank screen and keypad. Marina stands beside it holding a golden key in one hand and her phone in the other; a soft dotted line links the phone to the second lock. Calm and confident. Speech-bubble space top-left.

Реплика Марины — слева сверху.

### `stolen.webp` — шаг `stolen`

> Night, dim corridor lit by a desk lamp glow. Stripes has turned a stolen golden key in the first lock of the same two-lock door, but the second lock with the small blank screen stays shut; he tugs the handle in frustration, one eyebrow raised. Stripes visible under a dark jacket. Speech-bubble space top-right.

Реплика Полосатого — справа сверху, красная рамка.

### `call.webp` — шаг `code-call` (вопрос)

> Split frame. Left: Marina at her desk holding the office phone receiver, her mobile phone lying face up with an abstract code on screen (dots, no digits). Right: Stripes in a cheap “IT support” disguise — headset, polo with a gear pictogram, badge — but striped sleeves showing, talking into the headset with a friendly fake smile. Speech-bubble space top-left (Marina's thought) and top-right (Stripes).

Мысль Марины — слева сверху, реплика Полосатого — справа сверху.

### `night.webp` — шаг `night`

> Night bedroom in soft indigo tones. On the bedside table Marina's phone glows with a stack of notification cards popping up one after another (abstract cards with a question mark icon, no text). Marina, sleepy, in pajamas and with her round glasses pushed up, reaches out to press a red “no” cross on the top card. Speech-bubble space top-left.

Мысль Марины — слева сверху.

## Итог

Галерея итога берёт те же четыре кадра: `locks`, `stolen`, `call`, `night`.
