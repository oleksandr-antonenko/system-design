import { Array, Match, Option, Schema, pipe } from 'effect'
import { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import type { UiStrings } from '../../../i18n/ui'
import type {
  SurfaceContext,
  SurfaceDefinition,
  SurfaceOutMessage,
} from '../../contract'
import { SurfaceMessage, SurfaceState } from '../../state'
import type { ScenarioTypes } from '../../types'
import { type Auth, isCode, isOn, isScanned } from '../auth'
import { ScenarioOp } from '../doc'
import { classes, ghostOps, nameOf, noteOf, produceOps } from './parts'

// Страница безопасности и телефон `auth:<владелец>` (урок 4): слева окно
// браузера с настройками 2FA сайта, справа телефон с приложением-
// аутентификатором. QR-код рисуется квадратиками, коды учебные. Набранные
// цифры кода хранятся здесь, пока ученик не нажал «Подтвердить»: это не
// секрет, а шесть цифр с экрана телефона урока.

type Context = SurfaceContext<ScenarioTypes>

// MODEL

export const CodeHint = Schema.Literals(['none', 'wrong', 'needsScan'])
export type CodeHint = typeof CodeHint.Type

export const Model = Schema.Struct({
  isQrShown: Schema.Boolean,
  typed: Schema.String,
  codeHint: CodeHint,
  isScanHintShown: Schema.Boolean,
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  isQrShown: false,
  typed: '',
  codeHint: 'none',
  isScanHintShown: false,
}

// MESSAGE

export const Message = defineMessageUnion({
  ClickedEnable: {},
  UpdatedCode: { value: Schema.String },
  ClickedConfirm: {},
  ClickedScan: {},
  ClickedSaveCodes: {},
  ClickedAllow: {},
  ClickedDecline: {},
  ClickedReport: {},
})
export type Message = typeof Message.Type

export type OutMessage = SurfaceOutMessage<ScenarioOp>

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

// UPDATE

const produce = (
  context: Context,
  model: Model,
  ops: ReadonlyArray<ScenarioOp>,
): UpdateReturn => produceOps<Model, Message>(context, model, ops)

const confirm = (context: Context, model: Model): UpdateReturn =>
  Option.match(context.doc.maybeAuth, {
    onNone: () => ({ model }),
    onSome: auth =>
      !isScanned(auth)
        ? {
            model: modifyFields(model, {
              codeHint: (): CodeHint => 'needsScan',
            }),
          }
        : !isCode(auth, model.typed)
          ? {
              model: modifyFields(model, { codeHint: (): CodeHint => 'wrong' }),
            }
          : produce(
              context,
              modifyFields(model, {
                codeHint: (): CodeHint => 'none',
                typed: () => '',
              }),
              [ScenarioOp.ConfirmCode({ code: model.typed })],
            ),
  })

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn =>
    Message.match<UpdateReturn>(message, {
      ClickedEnable: () => ({
        model: modifyFields(model, { isQrShown: () => true }),
      }),
      UpdatedCode: ({ value }) => ({
        model: modifyFields(model, {
          typed: () => value.replace(/[^\d ]/g, '').slice(0, 7),
          codeHint: (): CodeHint => 'none',
        }),
      }),
      ClickedConfirm: () => confirm(context, model),
      ClickedScan: () =>
        model.isQrShown
          ? produce(
              context,
              modifyFields(model, { isScanHintShown: () => false }),
              [ScenarioOp.ScanQr()],
            )
          : { model: modifyFields(model, { isScanHintShown: () => true }) },
      ClickedSaveCodes: () =>
        produce(context, model, [ScenarioOp.SaveBackupCodes()]),
      ClickedAllow: () => produce(context, model, [ScenarioOp.AllowSignIn()]),
      ClickedDecline: () =>
        produce(context, model, [ScenarioOp.DeclineSignIn()]),
      ClickedReport: () => produce(context, model, [ScenarioOp.ReportSignIn()]),
    })

// GHOST

const ghostKey = (model: Model, op: ScenarioOp): Option.Option<string> =>
  Match.value(op).pipe(
    Match.tag('ScanQr', () => Option.some(model.isQrShown ? 'scan' : 'enable')),
    Match.tag('ConfirmCode', () => Option.some('code')),
    Match.tag('SaveBackupCodes', () => Option.some('save-codes')),
    Match.tag('DeclineSignIn', () => Option.some('decline')),
    Match.tag('ReportSignIn', () => Option.some('report')),
    Match.orElse(() => Option.none()),
  )

const ghostOf = (context: Context, model: Model): Option.Option<string> =>
  pipe(
    ghostOps(context.maybeGhost, context.journal),
    Array.findFirst(op => ghostKey(model, op)),
  )

// VIEW

type Parts<ParentMessage> = Readonly<{
  model: Model
  auth: Auth
  context: Context
  ui: UiStrings
  maybeGhost: Option.Option<string>
  send: (message: Message) => ParentMessage
  h: HtmlBuilder<ParentMessage>
}>

const isGhost = <ParentMessage>(
  parts: Parts<ParentMessage>,
  key: string,
): boolean => Option.exists(parts.maybeGhost, ghost => ghost === key)

const button = <ParentMessage>(
  parts: Parts<ParentMessage>,
  label: string,
  message: Message,
  style: string,
  ghost: string,
): Html => {
  const { h, send, context } = parts
  return h.button(
    [
      h.Type('button'),
      h.Class(
        classes('screen-button', style, isGhost(parts, ghost) && 'ghost'),
      ),
      ...(context.mode === 'Edit'
        ? [h.OnClick(send(message))]
        : [h.Disabled(true)]),
    ],
    [label],
  )
}

/** Учебный QR-код: квадратики по адресу сайта и три опорных квадрата. */
const QR_SIZE = 21

const qrCells = (seed: string): ReadonlyArray<boolean> => {
  const start = Array.reduce(
    [...seed],
    7,
    (hash, letter) => (hash * 31 + letter.charCodeAt(0)) % 2147483647,
  )
  const isFinder = (row: number, column: number) => {
    const inBox = (top: number, left: number) =>
      row >= top && row < top + 7 && column >= left && column < left + 7
    const ring = (top: number, left: number) => {
      const r = row - top
      const c = column - left
      return (
        r === 0 ||
        r === 6 ||
        c === 0 ||
        c === 6 ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      )
    }
    return inBox(0, 0)
      ? Option.some(ring(0, 0))
      : inBox(0, QR_SIZE - 7)
        ? Option.some(ring(0, QR_SIZE - 7))
        : inBox(QR_SIZE - 7, 0)
          ? Option.some(ring(QR_SIZE - 7, 0))
          : Option.none()
  }
  return Array.makeBy(QR_SIZE * QR_SIZE, index => {
    const row = Math.floor(index / QR_SIZE)
    const column = index % QR_SIZE
    return Option.getOrElse(
      isFinder(row, column),
      () => ((start + index * 7919 + row * column * 104729) % 97) % 3 === 0,
    )
  })
}

const qrView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, auth } = parts
  return h.div(
    [
      h.Class('scenario-qr'),
      h.Role('img'),
      h.AriaLabel(ui.scenario.auth.qrLabel),
    ],
    Array.map(qrCells(auth.url), isDark =>
      h.span([h.Class(isDark ? 'on' : '')]),
    ),
  )
}

const BACKUP_CODES: ReadonlyArray<string> = [
  '4821-7730',
  '9054-1186',
  '3367-2049',
  '7712-5530',
  '6198-4401',
  '2205-8873',
]

const siteView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, auth, model, send, context } = parts
  const site = nameOf(context.label, auth.site)
  const isSetupShown = (model.isQrShown || isScanned(auth)) && !isOn(auth)
  const twoFactorBody = isOn(auth)
    ? [
        h.p(
          [h.Class('scenario-banner ok'), h.Role('status')],
          [ui.scenario.auth.onNote],
        ),
        h.div(
          [h.Class('scenario-backup')],
          [
            h.strong([], [ui.scenario.auth.backupTitle]),
            h.p([], [ui.scenario.auth.backupNote]),
            h.ul(
              [h.Class('scenario-backup-codes')],
              Array.map(BACKUP_CODES, code => h.li([], [code])),
            ),
            auth.twoFactor === 'saved'
              ? h.p(
                  [h.Class('scenario-banner ok'), h.Role('status')],
                  [ui.scenario.auth.codesSaved],
                )
              : button(
                  parts,
                  ui.scenario.auth.saveCodes,
                  Message.ClickedSaveCodes(),
                  'primary',
                  'save-codes',
                ),
          ],
        ),
      ]
    : isSetupShown
      ? [
          h.div(
            [h.Class('scenario-auth-setup')],
            [
              qrView(parts),
              h.div(
                [h.Class('scenario-auth-steps')],
                [
                  h.p([], [ui.scenario.auth.scanStep]),
                  h.p([], [ui.scenario.auth.codeStep]),
                  h.label(
                    [h.Class('screen-field')],
                    [
                      ui.scenario.auth.codeLabel,
                      h.input([
                        h.Type('text'),
                        h.InputMode('numeric'),
                        h.Autocomplete('one-time-code'),
                        h.Class(classes(isGhost(parts, 'code') && 'ghost')),
                        h.Value(model.typed),
                        ...(context.mode === 'Edit'
                          ? [
                              h.OnInput(value =>
                                send(Message.UpdatedCode({ value })),
                              ),
                            ]
                          : [h.Disabled(true)]),
                      ]),
                    ],
                  ),
                  ...(model.codeHint === 'none'
                    ? []
                    : [
                        h.p(
                          [h.Class('screen-problem'), h.Role('alert')],
                          [
                            model.codeHint === 'wrong'
                              ? ui.scenario.auth.wrongCode
                              : ui.scenario.auth.notScannedYet,
                          ],
                        ),
                      ]),
                  button(
                    parts,
                    ui.scenario.auth.confirm,
                    Message.ClickedConfirm(),
                    'primary',
                    'code',
                  ),
                ],
              ),
            ],
          ),
        ]
      : [
          h.p([], [ui.scenario.auth.offNote]),
          button(
            parts,
            ui.scenario.auth.enable,
            Message.ClickedEnable(),
            'primary',
            'enable',
          ),
        ]
  return h.div(
    [h.Class('scenario-window scenario-site')],
    [
      h.div(
        [h.Class('scenario-mailbar')],
        [
          h.span([h.Class('device-dots'), h.AriaHidden(true)]),
          h.span([h.Class('scenario-page-url')], [`🔒 https://${auth.url}`]),
        ],
      ),
      h.div(
        [h.Class('scenario-site-body')],
        [
          h.p([h.Class('scenario-site-name')], [site]),
          h.h3([], [ui.scenario.auth.security]),
          h.p([h.Class('scenario-site-account')], [auth.account]),
          h.section(
            [h.Class('scenario-site-section')],
            [h.h4([], [ui.scenario.auth.twoFactorTitle]), ...twoFactorBody],
          ),
        ],
      ),
    ],
  )
}

const requestCard = <ParentMessage>(
  parts: Parts<ParentMessage>,
): ReadonlyArray<Html> => {
  const { h, ui, auth, context } = parts
  const site = nameOf(context.label, auth.site)
  const device = nameOf(context.label, auth.request)
  const where = noteOf(context.label, auth.request)
  return Match.value(auth.signIn).pipe(
    Match.when('pending', () => [
      h.div(
        [
          h.Class('scenario-request'),
          h.Role('alertdialog'),
          h.AriaLabel(ui.scenario.auth.requestTitle),
        ],
        [
          h.strong([], [ui.scenario.auth.requestTitle]),
          h.p([], [site]),
          h.p([h.Class('scenario-request-where')], [device]),
          h.p([h.Class('scenario-request-where')], [where]),
          h.div(
            [h.Class('screen-actions')],
            [
              button(
                parts,
                ui.scenario.auth.deny,
                Message.ClickedDecline(),
                'primary',
                'decline',
              ),
              button(
                parts,
                ui.scenario.auth.approve,
                Message.ClickedAllow(),
                '',
                'allow',
              ),
            ],
          ),
        ],
      ),
    ]),
    Match.when('allowed', () => [
      h.div(
        [
          h.Class('scenario-request is-alert'),
          h.Role('alertdialog'),
          h.AriaLabel(ui.scenario.auth.allowedTitle),
        ],
        [
          h.strong([], [ui.scenario.auth.allowedTitle]),
          h.p([h.Class('screen-problem')], [ui.scenario.auth.allowedBody]),
          h.p([], [ui.scenario.auth.allowedNext]),
          button(
            parts,
            ui.scenario.auth.notMe,
            Message.ClickedDecline(),
            'primary',
            'decline',
          ),
        ],
      ),
    ]),
    Match.when('declined', () => [
      h.div(
        [h.Class('scenario-request'), h.Role('status')],
        [
          h.strong([], [ui.scenario.auth.declinedTitle]),
          h.p([], [ui.scenario.auth.declinedBody(site)]),
          button(
            parts,
            ui.scenario.auth.report,
            Message.ClickedReport(),
            'primary',
            'report',
          ),
        ],
      ),
    ]),
    Match.when('reported', () => [
      h.p(
        [h.Class('scenario-banner ok'), h.Role('status')],
        [ui.scenario.auth.reported],
      ),
    ]),
    Match.orElse(() => []),
  )
}

const phoneView = <ParentMessage>(parts: Parts<ParentMessage>): Html => {
  const { h, ui, auth, model, context } = parts
  const site = nameOf(context.label, auth.site)
  const account = isScanned(auth)
    ? [
        h.div(
          [h.Class('scenario-otp')],
          [
            h.span([h.Class('scenario-otp-site')], [site]),
            h.span([h.Class('scenario-otp-account')], [auth.account]),
            h.strong(
              [h.Class('scenario-otp-code')],
              [`${auth.code.slice(0, 3)} ${auth.code.slice(3)}`],
            ),
            h.span([h.Class('scenario-otp-ring'), h.AriaHidden(true)]),
          ],
        ),
        h.p([h.Class('screen-note')], [ui.scenario.auth.codeNote]),
      ]
    : [
        h.p([h.Class('screen-note')], [ui.scenario.auth.noAccounts]),
        button(
          parts,
          ui.scenario.auth.scan,
          Message.ClickedScan(),
          'primary',
          'scan',
        ),
        ...(model.isScanHintShown
          ? [
              h.p(
                [h.Class('screen-problem'), h.Role('alert')],
                [ui.scenario.auth.needsQr],
              ),
            ]
          : []),
      ]
  return h.section(
    [
      h.Class('device is-phone scenario-auth-phone'),
      h.AriaLabel(ui.device.screenLabel(nameOf(context.label, auth.owner))),
    ],
    [
      h.div([h.Class('device-notch'), h.AriaHidden(true)]),
      h.div([h.Class('device-status')], [h.span([], ['02:47'])]),
      h.div(
        [h.Class('device-screen')],
        [
          h.div([h.Class('screen-head')], [h.h3([], [ui.scenario.auth.app])]),
          h.div([h.Class('screen-body')], [...account, ...requestCard(parts)]),
        ],
      ),
    ],
  )
}

export const view = <ParentMessage>(
  model: Model,
  context: Context,
  ui: UiStrings,
  send: (message: Message) => ParentMessage,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  Option.match(context.doc.maybeAuth, {
    onNone: () => h.empty,
    onSome: auth => {
      const parts: Parts<ParentMessage> = {
        model,
        auth,
        context,
        ui,
        maybeGhost: ghostOf(context, model),
        send,
        h,
      }
      return h.div(
        [h.Class('scenario-auth'), h.AriaLabel(ui.scenario.auth.label)],
        [siteView(parts), phoneView(parts)],
      )
    },
  })

// SURFACE

const read = (state: SurfaceState): Option.Option<Model> =>
  state._tag === 'ScenarioAuthSurface'
    ? Option.some(state.model)
    : Option.none()

const toSurfaceMessage = (message: Message): SurfaceMessage =>
  SurfaceMessage.GotScenarioAuthMessage({ message })

export const authSurface: SurfaceDefinition<ScenarioTypes> = {
  type: 'auth',
  feature: 'auth',
  init: () => SurfaceState.ScenarioAuthSurface({ model: initialModel }),
  update: context => (state, message) =>
    message._tag === 'GotScenarioAuthMessage'
      ? Update.foldChild({
          update: update(context),
          read,
          write: (_state: SurfaceState, nextAuth: Model): SurfaceState =>
            SurfaceState.ScenarioAuthSurface({ model: nextAuth }),
          toParentMessage: toSurfaceMessage,
          toParentOutMessage: (outMessage: OutMessage) => outMessage,
        })(state, message.message)
      : { model: state },
  tabLabel: (context, ui) =>
    ui.scenario.auth.tab(nameOf(context.label, context.target)),
  view: (slot, h) =>
    Option.match(read(slot.state), {
      onNone: () => h.empty,
      onSome: model =>
        view(
          model,
          slot.context,
          slot.ui,
          message => slot.toParentMessage(toSurfaceMessage(message)),
          h,
        ),
    }),
}
