import { Option, Schema, pipe } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { UiStrings } from '../../../../i18n/ui'
import { normalizeUrl, parseUrl } from '../../../../net/address'
import { type Browsed, BrowserError } from '../../../../net/browser'
import { findHost } from '../../../../net/doc'
import type { NetMessage } from '../../../../net/message'
import type { Cert } from '../../../../net/model'
import { isCertError, isCodeShown, isOpen } from '../unlocks'
import { errorIcon, lockIcon, openLockIcon, reloadIcon } from './icons'
import { Message } from './message'
import { currentPage } from './network'
import { type Parts, classes, isGhost } from './parts'

// Приложение «Браузер» экрана устройства. В уроке 1 — только страница; с
// урока 3 — адресная строка и настоящие экраны ошибок: код не переводится,
// заголовок и строка — как в браузере на языке интерфейса, а пояснение
// «почему» — текст кода модели (или свой текст урока).

/** Имя сайта в тексте экрана ошибки, как у браузера: без порта. */
const hostOf = (url: string): string =>
  Option.match(parseUrl(url), {
    onNone: () => url,
    onSome: parsed => parsed.host,
  })

/** Адрес в строке браузера без `http://`, как его показывают браузеры. */
const shownUrl = (url: string): string =>
  url.replace(/^http:\/\//, '').replace(/\/$/, '')

const isDevServer = <ParentMessage>(
  parts: Parts<ParentMessage>,
  browsed: Browsed,
): boolean =>
  browsed.trace.outcome._tag === 'Delivered' &&
  pipe(
    findHost(parts.context.doc.doc, browsed.trace.outcome.at),
    Option.exists(host => host.kind === 'laptop' || host.kind === 'pc'),
  )

const servedBy = <ParentMessage>(
  parts: Parts<ParentMessage>,
  browsed: Browsed,
  title: string,
): string =>
  browsed.trace.outcome._tag === 'Delivered'
    ? Option.match(parts.context.label(browsed.trace.outcome.at), {
        onNone: () => title,
        onSome: label => label.name,
      })
    : title

// ADDRESS BAR

const securityBadge = <ParentMessage>(
  parts: Parts<ParentMessage>,
  maybePage: Option.Option<Browsed>,
): ReadonlyArray<Html> => {
  const { h, ui, send, model } = parts
  return isOpen(parts.context.unlocked, 'browser.certificate')
    ? Option.match(maybePage, {
        onNone: () => [],
        onSome: page =>
          page.view._tag === 'Page' && page.view.secure
            ? [
                h.button(
                  [
                    h.Type('button'),
                    h.Class('browser-lock'),
                    h.AriaLabel(ui.device.secure),
                    h.AriaExpanded(model.isCertificateOpen),
                    h.OnClick(send(Message.ClickedPadlock())),
                  ],
                  [lockIcon(h)],
                ),
              ]
            : [
                h.span(
                  [h.Class('browser-unsafe'), h.Title(ui.device.notSecure)],
                  [
                    openLockIcon(h),
                    h.span(
                      [h.Class('browser-unsafe-text')],
                      [ui.device.notSecure],
                    ),
                  ],
                ),
              ],
      })
    : []
}

const addressBar = <ParentMessage>(
  parts: Parts<ParentMessage>,
  maybePage: Option.Option<Browsed>,
): Html => {
  const { h, ui, send, model, context, isEditable } = parts
  const canType = isEditable && isOpen(context.unlocked, 'browser.typeAddress')
  const url = Option.getOrElse(model.maybeUrlDraft, () =>
    Option.match(maybePage, {
      onNone: () => '',
      onSome: page => shownUrl(page.url),
    }),
  )
  return h.div(
    [h.Class('browser-bar')],
    [
      ...securityBadge(parts, maybePage),
      h.form(
        [
          h.Class(classes('browser-url', isGhost(parts, 'url') && 'ghost')),
          h.AriaLabel(ui.device.addressBar),
          h.OnSubmit(send(Message.SubmittedUrl())),
        ],
        [
          h.input([
            h.Type('text'),
            h.Value(url),
            h.AriaLabel(ui.device.addressBar),
            h.Autocomplete('off'),
            h.Spellcheck(false),
            h.InputMode('url'),
            ...(canType
              ? [h.OnInput(value => send(Message.UpdatedUrl({ value })))]
              : [h.Readonly(true)]),
          ]),
          ...(canType
            ? [
                h.button(
                  [h.Type('submit'), h.Class('browser-go')],
                  [ui.device.go],
                ),
              ]
            : []),
        ],
      ),
      ...(isEditable && Option.isSome(maybePage)
        ? [
            h.button(
              [
                h.Type('button'),
                h.Class(
                  classes(
                    'browser-reload',
                    isGhost(parts, 'reload') && 'ghost',
                  ),
                ),
                h.AriaLabel(ui.device.reload),
                h.Title(ui.device.reload),
                h.OnClick(send(Message.ClickedReload())),
              ],
              [reloadIcon(h)],
            ),
          ]
        : []),
    ],
  )
}

// CERTIFICATE

const certificateView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  cert: Cert,
): Html => {
  const { h, ui, send } = parts
  const row = (label: string, value: string) =>
    h.div([h.Class('screen-row')], [h.dt([], [label]), h.dd([], [value])])
  return h.div(
    [
      h.Class('browser-certificate'),
      h.Role('dialog'),
      h.AriaLabel(ui.device.certificate),
    ],
    [
      h.h4([], [ui.device.certificate]),
      h.dl(
        [h.Class('screen-rows')],
        [
          row(ui.device.certIssuedTo, cert.names.join(', ')),
          row(ui.device.certIssuedBy, cert.issuer),
          row(ui.device.certValidUntil, cert.notAfter),
        ],
      ),
      h.button(
        [
          h.Type('button'),
          h.Class('screen-button'),
          h.OnClick(send(Message.ClickedPadlock())),
        ],
        [ui.device.close],
      ),
    ],
  )
}

// PAGE

const loginForm = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, send, model, isEditable } = parts
  const input = (
    field: 'login' | 'password',
    label: string,
    value: string,
  ): Html =>
    h.label(
      [h.Class('screen-field')],
      [
        h.span([], [label]),
        h.input([
          h.Type(field === 'password' ? 'password' : 'text'),
          h.Value(value),
          h.Autocomplete('off'),
          h.Spellcheck(false),
          ...(isEditable
            ? [
                h.OnInput(next =>
                  send(Message.UpdatedFormField({ field, value: next })),
                ),
              ]
            : [h.Disabled(true)]),
        ]),
      ],
    )
  return h.form(
    [
      h.Class(classes('browser-form', isGhost(parts, 'form') && 'ghost')),
      h.OnSubmit(send(Message.SubmittedForm())),
    ],
    [
      h.h4([], [ui.device.loginTitle]),
      input('login', ui.device.login, model.login),
      input('password', ui.device.password, model.password),
      h.button(
        [
          h.Type('submit'),
          h.Class('screen-button primary'),
          ...(isEditable ? [] : [h.Disabled(true)]),
        ],
        [ui.device.signIn],
      ),
    ],
  )
}

const isLoginPage = (url: string): boolean =>
  Option.exists(parseUrl(url), parsed => parsed.path === '/login')

const pageView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  browsed: Browsed,
  title: string,
): Html => {
  const { h, ui, context } = parts
  const isDev = isDevServer(parts, browsed)
  return h.div(
    [h.Class('browser-page')],
    [
      h.h4(
        [h.Class('browser-page-title')],
        [isDev ? ui.device.devPageTitle : servedBy(parts, browsed, title)],
      ),
      h.p(
        [],
        [
          isDev
            ? ui.device.devPageBody
            : ui.device.pageFrom(servedBy(parts, browsed, title)),
        ],
      ),
      h.div(
        [h.Class('browser-page-blocks'), h.AriaHidden(true)],
        [h.span([]), h.span([])],
      ),
      ...(isOpen(context.unlocked, 'browser.form') && isLoginPage(browsed.url)
        ? [loginForm(parts)]
        : []),
    ],
  )
}

/** Экран ошибки как в браузере: значок, заголовок, строка, код. */
export const errorScreen = <ParentMessage>(
  ui: UiStrings,
  code: BrowserError,
  url: string,
  isCodeVisible: boolean,
  h: HtmlBuilder<ParentMessage>,
): ReadonlyArray<Html> => {
  const text = ui.device.errorScreen(code, hostOf(url))
  return [
    h.div(
      [h.Class(classes('browser-error-icon', isCertError(code) && 'bad'))],
      [errorIcon(h)],
    ),
    h.h4([h.Class('browser-error-title')], [text.title]),
    h.p([h.Class('browser-error-line')], [text.line]),
    ...(isCodeVisible ? [h.code([h.Class('browser-code')], [code])] : []),
  ]
}

const errorView = <ParentMessage>(
  parts: Parts<ParentMessage>,
  url: string,
  code: BrowserError,
  reason: NetMessage,
): Html => {
  const { h, ui, send, model, renderMessage, context } = parts
  const why = h.p(
    [h.Class('browser-why')],
    [
      h.span([h.Class('browser-why-label')], [`${ui.device.why}: `]),
      renderMessage(reason),
    ],
  )
  return h.div(
    [h.Class(classes('browser-error', isCertError(code) && 'unsafe'))],
    [
      ...errorScreen(ui, code, url, isCodeShown(context.unlocked, code), h),
      ...(isCertError(code)
        ? [
            h.button(
              [
                h.Type('button'),
                h.Class('screen-button'),
                h.AriaExpanded(model.isAdvancedOpen),
                h.OnClick(send(Message.ClickedAdvanced())),
              ],
              [
                model.isAdvancedOpen
                  ? ui.device.hideAdvanced
                  : ui.device.advanced,
              ],
            ),
            ...(model.isAdvancedOpen ? [why] : []),
          ]
        : [why]),
    ],
  )
}

/** Приложение «Браузер». */
export const browserView = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, context, model } = parts
  const maybePage = currentPage(context)
  const hasBar = isOpen(context.unlocked, 'browser.addressBar')
  const content = Option.match(maybePage, {
    onNone: () =>
      h.p(
        [h.Class('browser-start')],
        [
          isOpen(context.unlocked, 'browser.typeAddress')
            ? ui.device.startPage
            : ui.device.blankPage,
        ],
      ),
    onSome: browsed =>
      browsed.view._tag === 'Page'
        ? pageView(parts, browsed, browsed.view.title)
        : errorView(parts, browsed.url, browsed.view.code, browsed.view.reason),
  })
  const certificate = pipe(
    maybePage,
    Option.filter(() => model.isCertificateOpen),
    Option.flatMap(page =>
      page.view._tag === 'Page' ? page.view.maybeCert : Option.none(),
    ),
  )
  return [
    ...(hasBar ? [addressBar(parts, maybePage)] : []),
    h.div(
      [h.Class('browser-content')],
      [
        content,
        ...Option.match(certificate, {
          onNone: () => [],
          onSome: cert => [certificateView(parts, cert)],
        }),
      ],
    ),
  ]
}

// PICTURES

const isBrowserError = Schema.is(BrowserError)

/** Ключ картинки варианта квиза `Choice`: мини-экран браузера с адресом —
    страница (`'page'`) или экран ошибки с кодом. */
export const screenPicture = (
  screen: BrowserError | 'page',
  url: string,
): string => `browser ${screen} ${url}`

/** Мини-экран браузера по ключу `screenPicture`. */
export const browserPicture = <ParentMessage>(
  key: string,
  ui: UiStrings,
  h: HtmlBuilder<ParentMessage>,
): Option.Option<Html> => {
  const [kind, screen, url] = key.split(' ')
  return kind !== 'browser' || screen === undefined || url === undefined
    ? Option.none()
    : screen === 'page'
      ? Option.some(
          h.div(
            [h.Class('browser-picture'), h.AriaHidden(true)],
            [
              h.div([h.Class('browser-picture-bar')], [url]),
              h.div(
                [h.Class('browser-page')],
                [
                  h.h4(
                    [h.Class('browser-page-title')],
                    [ui.device.devPageTitle],
                  ),
                  h.div(
                    [h.Class('browser-page-blocks')],
                    [h.span([]), h.span([])],
                  ),
                ],
              ),
            ],
          ),
        )
      : isBrowserError(screen)
        ? Option.some(
            h.div(
              [h.Class('browser-picture'), h.AriaHidden(true)],
              [
                h.div([h.Class('browser-picture-bar')], [url]),
                h.div(
                  [h.Class('browser-error')],
                  errorScreen(ui, screen, normalizeUrl(url), true, h),
                ),
              ],
            ),
          )
        : Option.none()
}
