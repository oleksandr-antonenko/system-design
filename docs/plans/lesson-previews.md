# Lesson previews

Every lesson has a preview image: a thumbnail on the course map, the `og:image` of the lesson page and the picture in its prerendered `<noscript>` summary. The lesson page itself does not show it: on a phone a picture between the board and the title only adds scrolling. The images of the technical courses form one series: serious, technical, calm. The `security` course is for office staff and has its own style, described in [its own section](#security-course-its-own-style). This file is the style guide and the shared part of the generation prompt; each lesson keeps its own subject in `preview.md` next to its texts, so any image can be regenerated.

## Files of a lesson

```
courses/<course>/lessons/NN-slug/
  preview.md          the subject of the image (the prompt for this lesson)
  preview.webp        1200 × 630, about 80–120 KB: og:image and prerendered page
  preview-600.webp    600 × 315: course map
  text.<locale>.ts    preview: { alt } — the alt text in that language
```

`pnpm check` fails when a lesson lacks either image or its alt text in a declared language.

## Style

- **Background:** deep graphite-navy (around `#0E1624`), darker towards the edges, with a barely visible blueprint grid. Never pure black, never a gradient sky.
- **Objects:** matte slate and gunmetal hardware modules (servers, databases, routers, devices) with soft bevels and thin cool-white edge highlights. Clean geometry, no wear, no clutter.
- **Accent:** one restrained colour per course, used only for what moves or matters: data flow, the active path, status lights. Everything else stays neutral grey-blue. A failure may use a muted red as a second, small signal.

| Course | Accent |
|---|---|
| `system-design` | electric azure blue |
| `networks` | warm amber |
| `security` | soft emerald green (own style, see below) |

A new course picks one accent hue that differs clearly from those already taken and adds a row here.

- **Composition:** one clear technical metaphor per lesson, drawn as an isometric technical diagram of the lesson's key idea: requests fanning out from a load balancer to servers, a packet travelling through a chain of routers. The idea sits in the centre with generous empty space around it and nothing cut off at the edges, so it still reads as a 300 px thumbnail.
- **Lighting:** subtle. Soft ambient light, a gentle rim light from the upper left, a faint glow on the accent paths. No lens flares, no bloom haze, no spotlight drama.

## Forbidden in every image

- Any text, letters, numbers, labels or glyphs that look like writing: the model garbles them, and the alt text and the page carry the words.
- Logos, recognisable brands and products (no fruit-shaped laptops, no cloud provider icons).
- People and faces, hands included. Users are shown as devices. (The `security` course allows hands and figures from behind, see its section.)
- Cartoon or cute style: no mascots, smiling devices, rounded toy shapes or pastel palettes.
- Stock-photo clichés: hooded hackers, binary-code rain, glowing globes, padlocks scattered around, handshakes, light bulbs.

## Format

- Generated at 16:9, cropped to 1.91:1 around the centre and exported as WebP: `preview.webp` 1200 × 630 (about 80–120 KB, also used as `og:image`) and `preview-600.webp` 600 × 315 for the course map.
- The page sets `width` and `height` on every image, so nothing jumps while it loads.

## Alt text

The alt text lives in `text.<locale>.ts` as `preview: { alt }` and is indexed together with the page, so it describes the image in terms of the lesson's subject:

- 100–160 characters; names the lesson's key term (the English term the lesson title starts with) and what the picture shows happening.
- Follows the English-terms rule of `CONTRIBUTING.md`: system elements and tool terms in English, no case endings on them, no English noun right after a native numeral or quantifier.
- Starts with what is shown («Схема: …», “Diagram: …”), never with «Картинка» or «Изображение», and is not a list of keywords.

Example: «Схема: load balancer распределяет запросы между servers и выводит из ротации упавший по health check».

## Shared prompt

The generator sends this text (or, for a course with its own style, that course's prompt below), then the course accent, then the subject from the lesson's `preview.md`:

```text
A wordless, unlabeled image.
A wide 16:9 illustration for a serious online engineering course, in the style of a premium infrastructure product illustration: a clean isometric technical diagram with precise geometry, flat-vector shading with soft depth, and thin luminous connection lines.
Background: deep graphite-navy, darker towards the edges, with a barely visible fine blueprint grid.
Objects: matte slate-grey and gunmetal hardware modules with soft bevels and thin cool-white edge highlights; clean, minimal, no clutter.
Colour: everything neutral grey-blue except one restrained accent colour, used only for data flow, the active path and small status lights.
Lighting: subtle soft ambient light, a gentle rim light from the upper left, a faint glow on the accent paths; no lens flares, no haze.
Composition: one clear technical idea in the centre with generous empty space around it; nothing cut off at the edges; it must read as a small thumbnail.
Strictly no text of any kind: no letters, no numbers, no labels, no captions, no screens with writing, no symbols that look like writing.
No logos, no brands, no recognisable products: devices are generic dark slabs and boxes. No people, no faces, no hands. No cartoon or cute style, no mascots. No hooded hackers, no binary code, no globes, no padlocks unless the subject asks for exactly one.
Paths, arrows and parts stay unlabeled: the picture must not contain a single word or letter.
```

## Security course: its own style

The course «Кибербезопасность для офиса» is for office staff with no technical background: accountants, managers, sales, HR. Server racks, cables and network diagrams read to them as "this is about networks, not about me". Its previews show instead the everyday objects they handle themselves, so the lesson is recognised at a glance.

- **Genre:** a calm editorial illustration, a semi-realistic still life of office objects: a laptop on a desk, a phone in a hand, an envelope, a sticky note, a USB stick. Painterly but not cartoon: no thick outlines, no characters, no mascots. The lesson frames inside the course are cartoons with characters; the previews deliberately are not.
- **Palette:** light and warm office tones (cream, light oak, warm grey, soft paper white) with one soft emerald green accent for what matters: the safe choice, the right button, the protected thing. A muted coral may mark the one risky object. The picture keeps a mid-tone background so it holds contrast on both the light and the dark site theme.
- **Composition:** one or two objects in the centre, shallow depth of field, soft daylight from a window on the left, generous calm space around. It must read as a 300 px thumbnail.
- **People:** hands, or a figure seen from behind or cut off at the shoulders, are allowed; faces are not.
- **Forbidden here as well:** any text, letters, numbers or writing-like marks (screens show blank bars and shapes); real logos and products; faces in close-up; hooded hackers, binary rain, glowing globes, padlocks scattered around; server racks, cables, network diagrams, isometric tech schemes, dark neon look.

Alt texts of this course start with «Иллюстрация: …» / “Illustration: …” and describe the scene, still naming the lesson's English term.

### Prompt of the `security` course

```text
A wordless, unlabeled image.
A wide 16:9 editorial illustration for an online course on everyday cybersecurity for office workers (accountants, managers, sales staff). Style: a calm, clear, semi-realistic still life with soft painterly shading, like an illustration in a quality business magazine. Not a cartoon: no thick outlines, no characters, no mascots, no cute or toy-like shapes. Not a technical diagram: no isometric schemes, no servers, no server racks, no cables, no network diagrams, no dark neon look.
Setting: an ordinary bright office: a light oak desk, cream and warm grey surfaces, soft paper white, a potted plant or a mug at most as quiet background props, soft daylight from a window on the left, shallow depth of field.
Colour: light, warm, muted office tones; one soft emerald green accent, used only for the safe choice or the protected thing; a muted coral may mark the one risky object. Keep a mid-tone background, not pure white, so the picture holds contrast on light and dark web pages.
Composition: one clear everyday scene with one or two main objects in the centre and generous calm space around them; nothing important cut off at the edges; it must read as a small thumbnail.
People: at most hands, or a person seen from behind; never a face.
Strictly no text of any kind: no letters, no numbers, no labels, no captions, no readable or pseudo-readable writing on screens, papers or notes; screens show only blank bars, simple shapes and icons.
No logos, no brands, no recognisable products: laptops and phones are generic, without logos. No hooded hackers, no binary code, no globes, no skulls, no padlocks unless the subject asks for exactly one.
```
