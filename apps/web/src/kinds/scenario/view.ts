import { Array, Match, Option, Record } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { BoardQuiz, BoardSlot } from '../contract'
import type { ScenarioTypes } from '../types'
import { type FrameArt, Scene } from './doc'
import type { Caption, ScenarioStage } from './dsl'
import { Message, type TrapField } from './message'
import { classes, nameOf } from './surfaces/parts'

// Доска вида «сценарий»: кадр мультика с подписями поверх, галерея кадров
// итога, страница-двойник и письмо квиза. Подписи — тексты урока
// (`annotations`), координаты — проценты кадра 4:3.

type Slot<ParentMessage> = BoardSlot<ScenarioTypes, ParentMessage>

type Captioned = Readonly<{ text: string; caption: Caption }>

const captionsOf = <ParentMessage>(
  slot: Slot<ParentMessage>,
): ReadonlyArray<Captioned> =>
  Array.map(slot.context.stage, (item: ScenarioStage) => ({
    text: slot.context.annotationText(item.key),
    caption: item.caption,
  }))

const send =
  <ParentMessage>(slot: Slot<ParentMessage>) =>
  (message: Message): ParentMessage =>
    slot.toParentMessage(message)

const isHovered = <ParentMessage>(
  slot: Slot<ParentMessage>,
  spot: string,
): boolean => Option.exists(slot.context.maybeHoveredRef, ref => ref === spot)

const lines = (text: string): ReadonlyArray<string> => text.split('\n')

const percent = (value: number): string => `${value}%`

const verticalOf = (
  caption: Readonly<{ y: number; from: 'top' | 'bottom' }>,
): Readonly<Record<string, string>> =>
  caption.from === 'bottom'
    ? { bottom: percent(caption.y) }
    : { top: percent(caption.y) }

/** `**…**` в строке лупы — красная пометка. */
const marked = <ParentMessage>(
  line: string,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html | string> =>
  Array.map(line.split('**'), (part, index) =>
    index % 2 === 1 ? h.mark([], [part]) : part,
  )

// FRAME

const bubbleView = <ParentMessage>(
  slot: Slot<ParentMessage>,
  captioned: Captioned,
  caption: Extract<Caption, Readonly<{ _tag: 'Bubble' }>>,
  order: number,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> =>
  captioned.text.trim() === ''
    ? []
    : [
        h.p(
          [
            h.Class(
              classes(
                'scenario-bubble',
                `tail-${caption.tail}`,
                caption.tone !== 'say' && caption.tone,
              ),
            ),
            h.Style({
              left: percent(caption.x),
              top: percent(caption.y),
              maxWidth: percent(caption.w),
              animationDelay: slot.context.isReducedMotion
                ? '0ms'
                : `${120 + order * 140}ms`,
            }),
          ],
          [
            h.span(
              [h.Class('scenario-speaker')],
              [nameOf(slot.context.label, caption.who)],
            ),
            captioned.text,
          ],
        ),
      ]

const signView = <ParentMessage>(
  slot: Slot<ParentMessage>,
  captioned: Captioned,
  caption: Extract<Caption, Readonly<{ _tag: 'Sign' }>>,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => {
  const [title = '', small = '', note = ''] = lines(captioned.text)
  const { ui } = slot.context
  return [
    h.button(
      [
        h.Type('button'),
        h.Class(
          classes(
            'scenario-sign',
            (slot.model.isSignOpen || isHovered(slot, 'sign')) && 'on',
          ),
        ),
        h.Style({ left: percent(caption.x), top: percent(caption.y) }),
        h.AriaExpanded(slot.model.isSignOpen),
        h.AriaLabel(`${ui.scenario.openSign}: ${title} ${caption.ssid}`),
        h.OnClick(send(slot)(Message.ClickedSign())),
      ],
      [
        h.small([], [title]),
        h.strong([], [caption.ssid]),
        h.small([], [small]),
      ],
    ),
    ...(slot.model.isSignOpen
      ? [
          h.div(
            [
              h.Class('scenario-sign-pop'),
              h.Role('dialog'),
              h.AriaLabel(`${title} ${caption.ssid}`),
            ],
            [
              h.div(
                [h.Class('scenario-sign-head')],
                [
                  ui.scenario.signHead,
                  h.button(
                    [
                      h.Type('button'),
                      h.Class('scenario-sign-close'),
                      h.AriaLabel(ui.scenario.closeSign),
                      h.OnClick(send(slot)(Message.ClickedCloseSign())),
                    ],
                    ['×'],
                  ),
                ],
              ),
              h.p([], [title]),
              h.strong([h.Class('scenario-ssid')], [caption.ssid]),
              h.p([], [small]),
              ...(note === '' ? [] : [h.p([], [note])]),
            ],
          ),
        ]
      : []),
  ]
}

/** Карточка сравнения адресов: заголовок, затем настоящий адрес и
    двойники, у каждого подпись, отличие помечено. */
const compareView = <ParentMessage>(
  slot: Slot<ParentMessage>,
  text: string,
  caption: Extract<Caption, Readonly<{ _tag: 'Compare' }>>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const rows = Array.filter(lines(text), line => line.includes('|'))
  const heading = Array.filter(lines(text), line => !line.includes('|'))
  return h.div(
    [
      h.Class(
        classes('scenario-compare', isHovered(slot, caption.spot) && 'on'),
      ),
      h.Style({
        left: percent(caption.x),
        ...verticalOf(caption),
        maxWidth: percent(caption.w),
      }),
    ],
    [
      ...Array.map(heading, line =>
        h.p([h.Class('scenario-compare-head')], [line]),
      ),
      h.ul(
        [h.Class('scenario-compare-rows')],
        Array.map(rows, (row, index) => {
          const [label = '', address = ''] = row.split('|')
          return h.li(
            [
              h.Class(
                classes('scenario-compare-row', index === 0 ? 'real' : 'twin'),
              ),
            ],
            [
              h.span([h.Class('scenario-compare-label')], [label]),
              h.span([h.Class('scenario-compare-address')], marked(address, h)),
            ],
          )
        }),
      ),
    ],
  )
}

const captionView = <ParentMessage>(
  slot: Slot<ParentMessage>,
  captioned: Captioned,
  order: number,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => {
  return Match.valueTags(captioned.caption, {
    Narration: caption => [
      h.p(
        [
          h.Class('scenario-narration'),
          h.Style({ left: percent(caption.x), ...verticalOf(caption) }),
        ],
        [captioned.text],
      ),
    ],
    Bubble: caption => bubbleView(slot, captioned, caption, order, h),
    Tag: caption => [
      h.span(
        [
          h.Class(
            classes('scenario-tag', isHovered(slot, caption.spot) && 'on'),
          ),
          h.Style({ left: percent(caption.x), top: percent(caption.y) }),
        ],
        [
          h.span([
            h.Class('scenario-tag-dot'),
            h.AriaHidden(true),
            h.Style({ backgroundColor: caption.color }),
          ]),
          captioned.text,
        ],
      ),
    ],
    Sign: caption => signView(slot, captioned, caption, h),
    Zoom: caption => [
      h.p(
        [
          h.Class(
            classes(
              'scenario-bubble scenario-zoom',
              `tail-${caption.tail}`,
              isHovered(slot, caption.spot) && 'on',
            ),
          ),
          h.Style({
            left: percent(caption.x),
            ...verticalOf(caption),
            maxWidth: percent(caption.w),
          }),
        ],
        Array.map(lines(captioned.text), line =>
          h.span([h.Class('scenario-zoom-line')], marked(line, h)),
        ),
      ),
    ],
    Compare: caption => [compareView(slot, captioned.text, caption, h)],
    Sketch: () => [h.p([h.Class('scenario-sketch')], [captioned.text])],
    Alt: () => [],
    Thumb: () => [],
  })
}

const altOf = (captions: ReadonlyArray<Captioned>): string =>
  Option.getOrElse(
    Option.map(
      Array.findFirst(captions, ({ caption }) => caption._tag === 'Alt'),
      ({ text }) => text,
    ),
    () => '',
  )

const frameView = <ParentMessage>(
  slot: Slot<ParentMessage>,
  scene: Extract<Scene, Readonly<{ _tag: 'Frame' }>>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const captions = captionsOf(slot)
  const bubbles = Array.filter(
    captions,
    ({ caption }) => caption._tag === 'Bubble',
  )
  return h.div(
    [h.Class('scenario-stage')],
    [
      h.keyed('figure')(
        scene.id,
        [h.Class('scenario-frame')],
        [
          h.img([
            h.Src(scene.art),
            h.Alt(altOf(captions)),
            h.Decoding('async'),
          ]),
          h.div(
            [h.Class('scenario-overlay')],
            Array.flatMap(captions, captioned =>
              captionView(
                slot,
                captioned,
                Option.getOrElse(
                  Array.findFirstIndex(bubbles, other => other === captioned),
                  () => 0,
                ),
                h,
              ),
            ),
          ),
        ],
      ),
    ],
  )
}

const galleryView = <ParentMessage>(
  slot: Slot<ParentMessage>,
  frames: ReadonlyArray<FrameArt>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const captions = captionsOf(slot)
  const captionOf = (id: string): string =>
    Option.getOrElse(
      Option.map(
        Array.findFirst(
          captions,
          ({ caption }) => caption._tag === 'Thumb' && caption.frame === id,
        ),
        ({ text }) => text,
      ),
      () => '',
    )
  return h.div(
    [h.Class('scenario-stage')],
    [
      h.div(
        [
          h.Class('scenario-gallery'),
          h.Role('list'),
          h.AriaLabel(slot.context.ui.scenario.galleryLabel),
        ],
        Array.map(frames, art =>
          h.keyed('figure')(
            art.id,
            [h.Class('scenario-thumb'), h.Role('listitem')],
            [
              h.img([h.Src(art.art), h.Alt(''), h.Decoding('async')]),
              h.figcaption([], [captionOf(art.id)]),
            ],
          ),
        ),
      ),
    ],
  )
}

// QUIZ ON THE SCREEN

type SpotState = 'pickable' | 'right' | 'wrong' | 'idle'

const spotState = (
  maybeQuiz: Option.Option<BoardQuiz>,
  spot: string,
): SpotState =>
  Option.match(maybeQuiz, {
    onNone: () => 'idle',
    onSome: quiz =>
      Option.match(quiz.maybeAnswer, {
        onNone: () =>
          Array.contains(quiz.candidates, spot) ? 'pickable' : 'idle',
        onSome: answer =>
          answer === spot
            ? 'right'
            : Option.exists(quiz.maybePicked, picked => picked === spot)
              ? 'wrong'
              : 'idle',
      }),
  })

const tagOf = (maybeQuiz: Option.Option<BoardQuiz>, spot: string): string =>
  Option.getOrElse(
    Option.flatMap(maybeQuiz, quiz =>
      Option.isSome(quiz.maybeAnswer)
        ? Record.get(quiz.tags, spot)
        : Option.none(),
    ),
    () => '',
  )

const isLivePick = <ParentMessage>(slot: Slot<ParentMessage>): boolean =>
  slot.context.mode === 'Pick' &&
  Option.exists(slot.context.maybeQuiz, quiz => Option.isNone(quiz.maybePicked))

// TRAP

const clockText = (ms: number): string => {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${`${seconds % 60}`.padStart(2, '0')}`
}

const brandLetters = <ParentMessage>(
  brand: string,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> =>
  Array.map([...brand], (letter, index) =>
    h.span([h.Class(`trap-letter-${index % 6}`)], [letter]),
  )

const trapField = <ParentMessage>(
  slot: Slot<ParentMessage>,
  field: TrapField,
  label: string,
  missing: string,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const id = `trap-${field}`
  const isMissing = Option.exists(
    slot.model.maybeMissing,
    wanted => wanted === field,
  )
  return h.div(
    [h.Class('trap-field')],
    [
      h.label([h.For(id)], [label]),
      // NOTE: в сообщение уходит только «поле не пустое»; сам текст остаётся
      // в DOM этого поля и стирается вместе с ним после выбора.
      h.input([
        h.Id(id),
        h.Type('text'),
        h.Class(field === 'password' ? 'masked' : ''),
        h.Autocomplete('off'),
        h.Autocapitalize('off'),
        h.Spellcheck(false),
        h.Attribute('data-1p-ignore', 'true'),
        h.Attribute('data-lpignore', 'true'),
        h.Attribute('data-form-type', 'other'),
        ...(field === 'email' ? [h.InputMode('email')] : []),
        ...(isMissing ? [h.AriaInvalid(true)] : []),
        h.OnInput(value =>
          send(slot)(
            Message.UpdatedTrapField({ field, isFilled: value.trim() !== '' }),
          ),
        ),
      ]),
      h.span(
        [h.Class('trap-error'), h.AriaLive('polite')],
        [isMissing ? missing : ''],
      ),
    ],
  )
}

const trapCard = <ParentMessage>(
  slot: Slot<ParentMessage>,
  brand: string,
  fields: ReadonlyArray<Html>,
  buttons: ReadonlyArray<Html>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { ui } = slot.context
  return h.div(
    [h.Class('trap-card')],
    [
      h.div([h.Class('trap-logo'), h.AriaLabel(brand)], brandLetters(brand, h)),
      h.h4([], [ui.scenario.trap.signIn]),
      h.p([h.Class('trap-sub')], [ui.scenario.trap.useAccount(brand)]),
      ...fields,
      h.div([h.Class('trap-row')], buttons),
    ],
  )
}

const trapWindow = <ParentMessage>(
  slot: Slot<ParentMessage>,
  scene: Extract<Scene, Readonly<{ _tag: 'Trap' }>>,
  card: Html,
  stamp: ReadonlyArray<Html>,
  isDecided: boolean,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { ui } = slot.context
  const [scheme, rest = ''] = scene.url.split('://')
  const [host = '', ...path] = rest.split('/')
  return h.div(
    [h.Class('scenario-stage is-screen')],
    [
      h.div(
        [
          h.Class(classes('trap', isDecided && 'decided')),
          h.Role('group'),
          h.AriaLabel(ui.scenario.trap.label),
        ],
        [
          h.div(
            [h.Class('trap-bar')],
            [
              h.span([h.Class('device-dots'), h.AriaHidden(true)]),
              h.span(
                [h.Class(classes('trap-url', isDecided && 'reveal'))],
                [
                  h.span([h.AriaHidden(true)], ['🔒 ']),
                  `${scheme}://`,
                  h.strong([], [host]),
                  path.length > 0 ? `/${path.join('/')}` : '',
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('trap-body')],
            [
              h.div(
                [h.Class('trap-prize')],
                [
                  h.p(
                    [h.Class('trap-confetti'), h.AriaHidden(true)],
                    ['🎉📱🎉'],
                  ),
                  h.h3([], [ui.scenario.trap.prize]),
                  h.p([], [ui.scenario.trap.visitor]),
                  h.p(
                    [],
                    [
                      `${ui.scenario.trap.burnsIn} `,
                      h.span(
                        [h.Class('trap-timer')],
                        [clockText(slot.model.trapClockMs)],
                      ),
                    ],
                  ),
                ],
              ),
              card,
              h.p([h.Class('trap-fine')], [ui.scenario.trap.fine]),
            ],
          ),
          ...stamp,
        ],
      ),
    ],
  )
}

/** Страница до выбора: поля и кнопки живые. */
const liveTrap = <ParentMessage>(
  slot: Slot<ParentMessage>,
  scene: Extract<Scene, Readonly<{ _tag: 'Trap' }>>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { ui } = slot.context
  return trapWindow(
    slot,
    scene,
    trapCard(
      slot,
      scene.brand,
      [
        trapField(
          slot,
          'email',
          ui.scenario.trap.email,
          ui.scenario.trap.emailMissing,
          h,
        ),
        trapField(
          slot,
          'password',
          ui.scenario.trap.password,
          ui.scenario.trap.passwordMissing,
          h,
        ),
      ],
      [
        h.button(
          [
            h.Type('button'),
            h.Class('trap-skip pickable'),
            h.OnClick(send(slot)(Message.ClickedTrapSkip())),
          ],
          [ui.scenario.trap.skip],
        ),
        h.button(
          [
            h.Type('button'),
            h.Class('trap-login pickable'),
            h.OnClick(send(slot)(Message.ClickedTrapLogin())),
          ],
          [ui.scenario.trap.login],
        ),
      ],
      h,
    ),
    [],
    false,
    h,
  )
}

/** Страница после выбора: другая функция вида, поэтому поля создаются
    заново и пустыми; кнопки и поля недоступны, сверху штамп исхода. */
const decidedTrap = <ParentMessage>(
  slot: Slot<ParentMessage>,
  scene: Extract<Scene, Readonly<{ _tag: 'Trap' }>>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { ui } = slot.context
  const quiz = slot.context.maybeQuiz
  const picked = Option.getOrElse(
    Option.flatMap(quiz, found => found.maybePicked),
    () => '',
  )
  const emptyField = (label: string) =>
    h.div(
      [h.Class('trap-field')],
      [
        h.span([h.Class('trap-label')], [label]),
        h.span([h.Class('trap-input-empty')]),
      ],
    )
  const [title = '', note = ''] = tagOf(quiz, picked)
    .split('·')
    .map(part => part.trim())
  return trapWindow(
    slot,
    scene,
    trapCard(
      slot,
      scene.brand,
      [
        emptyField(ui.scenario.trap.email),
        emptyField(ui.scenario.trap.password),
      ],
      [
        h.span(
          [h.Class(classes('trap-skip', spotState(quiz, 'skip')))],
          [ui.scenario.trap.skip],
        ),
        h.span(
          [h.Class(classes('trap-login', spotState(quiz, 'login')))],
          [ui.scenario.trap.login],
        ),
      ],
      h,
    ),
    title === ''
      ? []
      : [
          h.p(
            [
              h.Class(`trap-stamp ${picked === 'skip' ? 'ok' : 'bad'}`),
              h.Role('status'),
            ],
            [title, ...(note === '' ? [] : [h.small([], [note])])],
          ),
        ],
    true,
    h,
  )
}

// LETTER

const letterView = <ParentMessage>(
  slot: Slot<ParentMessage>,
  scene: Extract<Scene, Readonly<{ _tag: 'Letter' }>>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const { label, ui, maybeQuiz } = slot.context
  const isLive = isLivePick(slot)
  const name = nameOf(label, `letter:${scene.id}`)
  const subject = Option.getOrElse(
    Option.flatMap(label(`letter:${scene.id}`), found =>
      Option.fromNullishOr(found.note),
    ),
    () => '',
  )
  const hotspot = (spot: string, content: ReadonlyArray<Html | string>) => {
    const state = spotState(maybeQuiz, spot)
    const note = tagOf(maybeQuiz, spot)
    return h.button(
      [
        h.Type('button'),
        h.Class(
          classes('scenario-hot', `spot-${spot}`, isLive ? 'pickable' : state),
        ),
        ...(isLive
          ? [h.OnClick(send(slot)(Message.ClickedSpot({ spot })))]
          : [h.Disabled(true)]),
      ],
      [
        ...content,
        ...(note === '' || state === 'idle'
          ? []
          : [h.span([h.Class('scenario-hot-note')], [note])]),
      ],
    )
  }
  return h.div(
    [h.Class('scenario-stage is-screen')],
    [
      h.article(
        [h.Class('scenario-letter'), h.AriaLabel(ui.scenario.letter.label)],
        [
          hotspot('subj', [h.span([h.Class('scenario-subject')], [subject])]),
          h.div(
            [h.Class('scenario-from')],
            [
              h.span([h.Class('scenario-logo'), h.AriaHidden(true)], ['✿']),
              h.div(
                [h.Class('scenario-who')],
                [
                  hotspot('name', [h.strong([], [name])]),
                  hotspot('addr', [
                    h.span([h.Class('scenario-address')], [scene.address]),
                  ]),
                  h.span(
                    [h.Class('scenario-to')],
                    [ui.scenario.letter.to(scene.to)],
                  ),
                ],
              ),
              h.span([h.Class('scenario-time')], [scene.time]),
            ],
          ),
          h.div(
            [h.Class('scenario-body')],
            Array.map(
              Array.filter(
                nameOf(label, `letter:${scene.id}:body`).split(/\n\s*\n/),
                paragraph => paragraph.trim() !== '',
              ),
              paragraph => h.p([], [paragraph]),
            ),
          ),
          hotspot('btn', [
            h.span(
              [h.Class('scenario-link look-button')],
              [nameOf(label, `letter:${scene.id}:button`)],
            ),
          ]),
          hotspot('sign', [
            h.span(
              [h.Class('scenario-signature')],
              Array.map(
                nameOf(label, `letter:${scene.id}:sign`).split('\n'),
                line => h.span([], [line]),
              ),
            ),
          ]),
        ],
      ),
    ],
  )
}

// VIEW

const sceneView = <ParentMessage>(
  slot: Slot<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  return Scene.match(slot.context.doc.scene, {
    Blank: () => h.empty,
    Frame: scene => frameView(slot, scene, h),
    Gallery: scene => galleryView(slot, scene.frames, h),
    Trap: scene =>
      isLivePick(slot) ? liveTrap(slot, scene, h) : decidedTrap(slot, scene, h),
    Letter: scene => letterView(slot, scene, h),
  })
}

export const view = <ParentMessage>(
  slot: Slot<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.div(
    [
      h.Class(
        classes(
          'scenario-board',
          `scene-${slot.context.doc.scene._tag.toLowerCase()}`,
          slot.context.doc.scene._tag === 'Blank' && 'is-empty',
        ),
      ),
      h.AriaLabel(slot.context.ui.scenario.frameLabel),
    ],
    [sceneView(slot, h)],
  )

/** У вида нет приборов и кнопок отмены (design D3). */
export const instruments = <ParentMessage>(
  _slot: Slot<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => h.empty
