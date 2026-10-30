# Lesson previews

Every lesson has a preview image: a thumbnail on the course map, the `og:image` of the lesson page and the picture in its prerendered `<noscript>` summary. The lesson page itself does not show it: on a phone a picture between the board and the title only adds scrolling. The images form one series across all courses: serious, technical, calm. This file is the style guide and the shared part of the generation prompt; each lesson keeps its own subject in `preview.md` next to its texts, so any image can be regenerated.

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

A new course picks one accent hue that differs clearly from those already taken and adds a row here.

- **Composition:** one clear technical metaphor per lesson, drawn as an isometric technical diagram of the lesson's key idea: requests fanning out from a load balancer to servers, a packet travelling through a chain of routers. The idea sits in the centre with generous empty space around it and nothing cut off at the edges, so it still reads as a 300 px thumbnail.
- **Lighting:** subtle. Soft ambient light, a gentle rim light from the upper left, a faint glow on the accent paths. No lens flares, no bloom haze, no spotlight drama.

## Forbidden in every image

- Any text, letters, numbers, labels or glyphs that look like writing: the model garbles them, and the alt text and the page carry the words.
- Logos, recognisable brands and products (no fruit-shaped laptops, no cloud provider icons).
- People and faces, hands included. Users are shown as devices.
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

The generator sends this text, then the course accent, then the subject from the lesson's `preview.md`:

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
