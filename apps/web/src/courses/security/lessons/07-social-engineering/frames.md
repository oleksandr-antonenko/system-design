# Кадры урока 6 «Social engineering. Звонок «из IT»»

Кадры сгенерированы моделью Gemini для изображений (`gemini-3.1-flash-image`) с листом персонажей `docs/mockups/security/cast.webp` как образцом, по промптам ниже; кадры с текстом, логотипами, лишними героями или пустыми рамками исправлены правкой той же картинки. Чтобы перегенерировать кадр, возьмите общий блок и промпт кадра; после правки картинки проверьте альт-тексты в `text.<язык>.ts` и координаты реплик в `lesson.ts`.

## Общее для каждого промпта

> Flat vector cartoon illustration with dark outlines, warm cream background, pastel palette (mint, peach, mustard, indigo, coral for danger). Calm, friendly office tone for adult professionals, no scare tactics. Characters exactly as on the attached cast sheet: Marina (dark curly hair in a bun, round glasses, mustard cardigan, badge on a lanyard), Oleg (red hair, beard, mint sweater, always with a mug), Viktor (grey hair and beard, dark-blue blazer), Ira (purple bob, black hoodie, headset), Stripes the scammer (long nose, thin moustache, black beanie, black-and-white striped top; in any disguise the stripes still show). 4:3 frame. No text, letters, numbers or logos anywhere in the picture: no words on screens, doors, signs or papers; screens show only abstract shapes. Leave the top-left or top-right quarter and a strip along the bottom calm, for speech bubbles and a caption added later in HTML.

## Кадры

### `fake-ira.webp` — шаг `fake-ira`

> Split frame. Right: Stripes disguised as Ira — a cheap purple bob wig slightly askew, a headset, a black hoodie with striped sleeves peeking out — speaking into the headset with a fake friendly smile, a laptop showing an abstract "remote control" icon (two screens linked by an arrow). Left: Marina at her desk holding the office phone receiver, frowning thoughtfully. Speech-bubble space top-right (Stripes) and top-left (Marina's thought).

Реплика Полосатого — справа сверху, мысль Марины — слева сверху.

### `door.webp` — шаг `door`

> Office entrance with a glass door and a badge reader (blank, no text). Stripes in a courier outfit (cap, vest) carries a tall wobbly stack of cardboard boxes, stripes showing at the wrists, and nods at the door handle. Marina approaches with her badge in hand, polite but hesitant. Speech-bubble space top-right.

Реплика Полосатого — справа сверху.

### `requests.webp` — шаг `which` (вопрос)

> Marina at her desk at the end of the day, chin on hand, thinking. Above her float three soft thought clouds with pictograms only: a ringing phone with a bank-building icon, a chat bubble, and a small meeting table with people. No text. Calm composition, plenty of space at the top.

Только плашка рассказчика внизу; варианты ответа — в карточке вопроса.

### `new-account.webp` — шаг `new-account`

> Marina at her desk looks at her smartphone. From the phone screen Stripes leans out holding a cardboard mask of Viktor (grey hair and beard) on a stick in front of his face; behind the mask his beanie and striped sleeve are visible. Next to the chat on the phone, a small round avatar shows Viktor's real photo. A tiny clock icon and a money bag float next to him. Speech-bubble space top-right.

Реплика «Виктора» — справа сверху, красная рамка.

### `check.webp` — шаг `second-channel`

> Split frame. Left: Marina calls from the desk phone, an open company directory booklet next to her with a finger on a line (no readable text). Right: the real Viktor in a meeting room, answering his phone, raising an eyebrow in surprise. A cardboard mask lies discarded on the floor between the halves, Stripes tiptoeing away at the edge. Speech-bubble space top-left (Marina) and top-right (Viktor).

Реплика Марины — слева сверху, Виктора — справа сверху.

## Итог

Галерея итога берёт кадры `fake-ira`, `door`, `new-account`, `check`.
