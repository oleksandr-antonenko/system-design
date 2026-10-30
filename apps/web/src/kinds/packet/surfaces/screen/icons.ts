import { Array } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

// Значки экрана устройства: замок сети, полоски сигнала, Wi-Fi в строке
// состояния, глаз пароля, замок адресной строки. Только картинка: подпись
// у элемента своя.

const icon = <ParentMessage>(
  className: string,
  paths: ReadonlyArray<string>,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.svg(
    [
      h.Class(`device-icon ${className}`),
      h.ViewBox('0 0 24 24'),
      h.AriaHidden(true),
    ],
    Array.map(paths, d => h.path([h.D(d)])),
  )

export const lockIcon = <ParentMessage>(h: HtmlBuilder<ParentMessage>): Html =>
  icon(
    'icon-lock',
    ['M6.5 10.5h11v9h-11z', 'M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5'],
    h,
  )

export const openLockIcon = <ParentMessage>(
  h: HtmlBuilder<ParentMessage>,
): Html =>
  icon(
    'icon-lock open',
    ['M6.5 10.5h11v9h-11z', 'M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2'],
    h,
  )

export const wifiIcon = <ParentMessage>(h: HtmlBuilder<ParentMessage>): Html =>
  icon(
    'icon-wifi',
    [
      'M2.5 9a14 14 0 0 1 19 0',
      'M5.5 12.5a9.5 9.5 0 0 1 13 0',
      'M8.7 15.8a5 5 0 0 1 6.6 0',
      'M12 19.2h.01',
    ],
    h,
  )

export const eyeIcon = <ParentMessage>(
  isOpen: boolean,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  icon(
    'icon-eye',
    isOpen
      ? [
          'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z',
          'M12 9.2a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 1 1 0-5.6z',
        ]
      : [
          'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z',
          'M4 4l16 16',
        ],
    h,
  )

export const infoIcon = <ParentMessage>(h: HtmlBuilder<ParentMessage>): Html =>
  icon(
    'icon-info',
    ['M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z', 'M12 11v6', 'M12 7.5h.01'],
    h,
  )

export const reloadIcon = <ParentMessage>(
  h: HtmlBuilder<ParentMessage>,
): Html =>
  icon(
    'icon-reload',
    ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v4.2h-4.2'],
    h,
  )

export const errorIcon = <ParentMessage>(h: HtmlBuilder<ParentMessage>): Html =>
  icon(
    'icon-error',
    [
      'M6 2.5h8.5l4 4v15H6z',
      'M14.5 2.5v4h4',
      'M9.5 14.5l5 0',
      'M9.5 11h.01M14.5 11h.01',
    ],
    h,
  )

/** Полоски сигнала: 1–3. */
export const signalIcon = <ParentMessage>(
  bars: number,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.svg(
    [h.Class('device-signal'), h.ViewBox('0 0 18 14'), h.AriaHidden(true)],
    Array.map([0, 1, 2], index =>
      h.rect([
        h.Class(index < bars ? 'bar full' : 'bar'),
        h.Attribute('x', `${index * 6 + 1}`),
        h.Attribute('y', `${10 - index * 4}`),
        h.Attribute('width', '4'),
        h.Attribute('height', `${4 + index * 4}`),
        h.Attribute('rx', '1'),
      ]),
    ),
  )
