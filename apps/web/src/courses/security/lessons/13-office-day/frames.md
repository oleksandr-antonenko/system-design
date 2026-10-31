# Кадры урока 12 «Practice. День в офисе»

Кадры сгенерированы моделью Gemini для изображений (`gemini-3.1-flash-image`) с листом персонажей `docs/mockups/security/cast.webp` как образцом, по промптам ниже; кадры с текстом, логотипами, лишними героями или пустыми рамками исправлены правкой той же картинки. Чтобы перегенерировать кадр, возьмите общий блок и промпт кадра; после правки картинки проверьте альт-тексты в `text.<язык>.ts` и координаты реплик в `lesson.ts`.

## Общее для каждого промпта

> Flat vector cartoon illustration with dark outlines, warm cream background, pastel palette (mint, peach, mustard, indigo, coral for danger). Calm, friendly office tone for adult professionals, no scare tactics. Characters exactly as on the attached cast sheet: Marina (dark curly hair in a bun, round glasses, mustard cardigan, badge on a lanyard), Oleg (red hair, beard, mint sweater, always with a mug), Viktor (grey hair and beard, dark-blue blazer), Ira (purple bob, black hoodie, headset), Stripes the scammer (long nose, thin moustache, black beanie, black-and-white striped top; in any disguise the stripes still show). 4:3 frame. No text, letters, numbers or logos anywhere in the picture: no words on screens, doors, signs or papers; screens show only abstract shapes. Leave the top-left or top-right quarter and a strip along the bottom calm, for speech bubbles and a caption added later in HTML.

## Кадры

### `morning.webp` — шаг `morning`

> Morning in a bright small office. Marina arrives with her bag and a coffee, smiling; Oleg waves from his desk with his mug, Ira adjusts her headset at the IT corner, Viktor walks past with a folder. Through the window, far away on the street, Stripes walks by with his beanie pulled low. Sunny, calm. Speech-bubble space top-left.

Реплика Марины — слева сверху.

### `guest.webp` — шаг `guest` (вопрос)

> Office reception desk. A visiting client in a peach jacket holds up a phone and asks something; Marina stands behind the desk, reaching for a small card on a stand (a guest Wi-Fi card with only a wave pictogram). Behind her, a mint dome outline over the office and a separate small peach dome over the waiting chairs. Speech-bubble space top-right.

Реплика гостя — справа сверху.

### `cafe.webp` — шаг `lunch` (задача)

> Lunch in a cosy café. Marina sits at a small table with a salad and her phone; on the table stands a little card with only a wave pictogram (the café Wi-Fi). At the next table Stripes, in a barista apron with stripes showing, holds a phone and peeks over at her with a sly look. Speech-bubble space top-left.

Табличка с сетью кафе — HTML поверх кадра.

### `evening.webp` — шаг `summary`

> Evening in the office, warm lamp light. Marina, bag on her shoulder, locks her laptop screen (padlock pictogram on a dark screen) and waves goodbye to Ira, who gives a thumbs-up. Outside the window, Stripes walks away into the dusk, empty-handed, shrugging. Calm, satisfied end of the day. Caption space along the bottom.

Кадр итога вместе с тремя другими.

## Итог

Галерея итога берёт четыре кадра: `morning`, `guest`, `cafe`, `evening`.
