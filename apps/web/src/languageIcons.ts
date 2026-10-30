import type { Html, HtmlBuilder } from 'foldkit/html'

// The language menu's icons: the globe on its button, the check next to the
// current language. The site header and the sign-in page share them.

export const globeIconView = <M>(h: HtmlBuilder<M>): Html =>
  h.svg(
    [
      h.ViewBox('0 0 24 24'),
      h.AriaHidden(true),
      h.Class('size-4 shrink-0'),
      h.Attribute('fill', 'none'),
      h.Attribute('stroke', 'currentColor'),
      h.Attribute('stroke-width', '1.8'),
      h.Attribute('stroke-linecap', 'round'),
    ],
    [
      h.circle([
        h.Attribute('cx', '12'),
        h.Attribute('cy', '12'),
        h.Attribute('r', '9'),
      ]),
      h.path([
        h.Attribute(
          'd',
          'M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
        ),
      ]),
    ],
  )

export const checkIconView = <M>(h: HtmlBuilder<M>): Html =>
  h.svg(
    [
      h.ViewBox('0 0 24 24'),
      h.AriaHidden(true),
      h.Class('size-4 shrink-0 text-accent'),
      h.Attribute('fill', 'none'),
      h.Attribute('stroke', 'currentColor'),
      h.Attribute('stroke-width', '2.2'),
      h.Attribute('stroke-linecap', 'round'),
      h.Attribute('stroke-linejoin', 'round'),
    ],
    [h.path([h.Attribute('d', 'M5 12.5l4.5 4.5L19 7.5')])],
  )
