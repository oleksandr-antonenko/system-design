import { Array, Option, Schema, pipe } from 'effect'
import type { Update } from 'foldkit'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'

import { normalizeUrl, parseUrl, urlText } from '../../../../net/address'
import {
  forgetWifi,
  joinWifi,
  send,
  setDns,
  setStatic,
  useDhcp,
} from '../../../../net/build'
import { NetMessage } from '../../../../net/message'
import { Intent } from '../../../../net/packet'
import { checkJoin, nearbyNetworks } from '../../../../net/topology'
import { type SurfaceContext, SurfaceOutMessage } from '../../../contract'
import type { PacketTypes } from '../../../types'
import type { PacketOp } from '../../doc'
import { AddressMode, App, Message, Page } from './message'
import { addressSettings, currentPage, dnsSettings } from './network'

// Экран устройства (`wifi:<устройство>` и `browser:<устройство>`, план 3.2):
// у телефона — экран телефона, у ноутбука — окно. В нём два приложения:
// «Настройки» (Wi-Fi, сведения о сети, DNS, адрес) и «Браузер». Действия
// ученика — операции модели пакетов в журнале задачи; сеть, адреса и
// открытая страница берутся из документа и истории, а не хранятся здесь.

// MODEL

/** Нижний лист поверх списка сетей: пароль или объяснение, почему эта сеть
    не ваша. */
export const Sheet = defineTaggedUnion({
  Closed: {},
  Password: {
    ssid: Schema.String,
    password: Schema.String,
    isPasswordShown: Schema.Boolean,
    maybeProblem: Schema.Option(NetMessage),
  },
  Explained: { ssid: Schema.String, problem: NetMessage },
})
export type Sheet = typeof Sheet.Type

/** DNS «вручную» во время правки: список и поле нового сервера. */
export const DnsDraft = Schema.Struct({
  servers: Schema.Array(Schema.String),
  server: Schema.String,
})
export type DnsDraft = typeof DnsDraft.Type

export const AddressDraft = Schema.Struct({
  mode: AddressMode,
  ip: Schema.String,
  mask: Schema.String,
  gateway: Schema.String,
  dns: Schema.String,
})
export type AddressDraft = typeof AddressDraft.Type

export const Model = Schema.Struct({
  app: App,
  page: Page,
  sheet: Sheet,
  maybeDnsDraft: Schema.Option(DnsDraft),
  maybeAddressDraft: Schema.Option(AddressDraft),
  /** Адрес, который ученик набирает; пока не набирает — адрес страницы. */
  maybeUrlDraft: Schema.Option(Schema.String),
  isCertificateOpen: Schema.Boolean,
  isAdvancedOpen: Schema.Boolean,
  login: Schema.String,
  password: Schema.String,
})
export type Model = typeof Model.Type

export const initialModel = (app: App): Model => ({
  app,
  page: 'wifi',
  sheet: Sheet.Closed(),
  maybeDnsDraft: Option.none(),
  maybeAddressDraft: Option.none(),
  maybeUrlDraft: Option.none(),
  isCertificateOpen: false,
  isAdvancedOpen: false,
  login: '',
  password: '',
})

export type OutMessage = SurfaceOutMessage<PacketOp>

// UPDATE

type Context = SurfaceContext<PacketTypes>

export type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage
>

/** Адрес из строки браузера: без схемы — `http://`, в каноническом виде,
    как его пишет браузер (`http://192.168.1.42:5173/`). */
export const canonicalUrl = (input: string): string => {
  const url = normalizeUrl(input)
  return Option.match(parseUrl(url), {
    onNone: () => url,
    onSome: urlText,
  })
}

const produce = (model: Model, ops: ReadonlyArray<PacketOp>): UpdateReturn =>
  Array.isReadonlyArrayEmpty(ops)
    ? { model }
    : { model, outMessage: SurfaceOutMessage.ProducedOps(ops) }

/** Нажатие на сеть: своя открытая — подключиться сразу; чужая открытая —
    объяснение; с замком — лист с паролем. */
const pickNetwork = (
  context: Context,
  model: Model,
  ssid: string,
): UpdateReturn =>
  Option.match(
    Array.findFirst(
      nearbyNetworks(context.doc.doc, context.target),
      network => network.ssid === ssid,
    ),
    {
      onNone: () => ({ model }),
      onSome: network =>
        network.security === 'open'
          ? Option.match(checkJoin(context.doc.doc, context.target, ssid, ''), {
              onNone: () =>
                produce(model, [joinWifi(context.target, ssid, '')]),
              onSome: problem => ({
                model: modifyFields(model, {
                  sheet: () => Sheet.Explained({ ssid, problem }),
                }),
              }),
            })
          : {
              model: modifyFields(model, {
                sheet: () =>
                  Sheet.Password({
                    ssid,
                    password: '',
                    isPasswordShown: false,
                    maybeProblem: Option.none(),
                  }),
              }),
            },
    },
  )

/** Неверный пароль своей сети — ход (телефон пробует и не подключается);
    чужая сеть — только объяснение: в документе до неё нет радиосвязи. */
const joinWith = (
  context: Context,
  model: Model,
  ssid: string,
  password: string,
): UpdateReturn => {
  const join = joinWifi(context.target, ssid, password)
  return Option.match(
    checkJoin(context.doc.doc, context.target, ssid, password),
    {
      onNone: () =>
        produce(modifyFields(model, { sheet: () => Sheet.Closed() }), [join]),
      onSome: problem => {
        const stay = modifyFields(model, {
          sheet: () =>
            Sheet.Password({
              ssid,
              password,
              isPasswordShown: false,
              maybeProblem: Option.some(problem),
            }),
        })
        return problem._tag === 'WrongPassword'
          ? produce(stay, [join])
          : { model: stay }
      },
    },
  )
}

/** Адрес вручную: маска — `255.255.255.0` или `24`. */
const prefixOf = (mask: string): number => {
  const trimmed = mask.trim().replace(/^\//, '')
  if (/^\d{1,2}$/.test(trimmed)) {
    return globalThis.Number(trimmed)
  }
  const octets = trimmed.split('.')
  const bits = Array.map(octets, octet =>
    globalThis.Number(octet).toString(2).padStart(8, '0'),
  ).join('')
  return octets.length === 4 && /^1*0*$/.test(bits)
    ? bits.indexOf('0') < 0
      ? 32
      : bits.indexOf('0')
    : globalThis.Number.NaN
}

const saveAddress = (context: Context, draft: AddressDraft): PacketOp =>
  draft.mode === 'dhcp'
    ? useDhcp(context.target)
    : setStatic(
        context.target,
        `${draft.ip.trim()}/${prefixOf(draft.mask)}`,
        draft.gateway.trim() === '' ? undefined : draft.gateway.trim(),
        draft.dns.trim() === '' ? undefined : draft.dns.trim(),
      )

const browseTo = (context: Context, url: string): PacketOp =>
  send(Intent.Browse({ from: context.target, url }))

const openPage = (model: Model, page: Page, context: Context): Model =>
  modifyFields(model, {
    page: () => page,
    sheet: () => Sheet.Closed(),
    maybeDnsDraft: () =>
      page === 'dns'
        ? pipe(
            dnsSettings(context),
            Option.flatMap(settings =>
              settings.isManual
                ? Option.some({ servers: settings.servers, server: '' })
                : Option.none(),
            ),
          )
        : Option.none(),
    maybeAddressDraft: () =>
      page === 'address' ? addressSettings(context) : Option.none(),
  })

export const update =
  (context: Context) =>
  (model: Model, message: Message): UpdateReturn => {
    const isEditable = context.mode === 'Edit'
    const editing = (next: () => UpdateReturn): UpdateReturn =>
      isEditable ? next() : { model }
    return Message.match<UpdateReturn>(message, {
      ClickedApp: ({ app }) => ({
        model: modifyFields(model, {
          app: () => app,
          sheet: () => Sheet.Closed(),
        }),
      }),
      ClickedPage: ({ page }) => ({ model: openPage(model, page, context) }),
      ClickedNetwork: ({ ssid }) =>
        editing(() => pickNetwork(context, model, ssid)),
      UpdatedWifiPassword: ({ value }) => ({
        model: modifyFields(model, {
          sheet: sheet =>
            sheet._tag === 'Password'
              ? Sheet.Password({
                  ssid: sheet.ssid,
                  password: value,
                  isPasswordShown: sheet.isPasswordShown,
                  maybeProblem: Option.none(),
                })
              : sheet,
        }),
      }),
      ClickedPasswordVisibility: () => ({
        model: modifyFields(model, {
          sheet: sheet =>
            sheet._tag === 'Password'
              ? Sheet.Password({
                  ssid: sheet.ssid,
                  password: sheet.password,
                  isPasswordShown: !sheet.isPasswordShown,
                  maybeProblem: sheet.maybeProblem,
                })
              : sheet,
        }),
      }),
      SubmittedWifiPassword: () =>
        editing(() =>
          model.sheet._tag === 'Password'
            ? joinWith(context, model, model.sheet.ssid, model.sheet.password)
            : { model },
        ),
      ClickedCloseSheet: () => ({
        model: modifyFields(model, { sheet: () => Sheet.Closed() }),
      }),
      ClickedForget: () =>
        editing(() =>
          produce(modifyFields(model, { page: () => 'wifi' }), [
            forgetWifi(context.target),
          ]),
        ),
      SelectedDnsMode: ({ mode }) =>
        editing(() =>
          mode === 'auto'
            ? produce(
                modifyFields(model, {
                  page: () => 'info',
                  maybeDnsDraft: () => Option.none(),
                }),
                Option.exists(
                  dnsSettings(context),
                  settings => settings.isManual,
                )
                  ? [setDns(context.target, { mode: 'auto' })]
                  : [],
              )
            : {
                model: modifyFields(model, {
                  maybeDnsDraft: draft =>
                    Option.orElse(draft, () =>
                      Option.some({
                        servers: Option.match(dnsSettings(context), {
                          onNone: () => [],
                          onSome: settings => settings.servers,
                        }),
                        server: '',
                      }),
                    ),
                }),
              },
        ),
      UpdatedDnsServer: ({ value }) => ({
        model: modifyFields(model, {
          maybeDnsDraft: draft =>
            Option.map(draft, current => ({ ...current, server: value })),
        }),
      }),
      SubmittedDnsServer: () => ({
        model: modifyFields(model, {
          maybeDnsDraft: draft =>
            Option.map(draft, current =>
              current.server.trim() === '' ||
              Array.contains(current.servers, current.server.trim())
                ? current
                : {
                    servers: [...current.servers, current.server.trim()],
                    server: '',
                  },
            ),
        }),
      }),
      ClickedRemoveDnsServer: ({ server }) => ({
        model: modifyFields(model, {
          maybeDnsDraft: draft =>
            Option.map(draft, current => ({
              ...current,
              servers: Array.filter(current.servers, each => each !== server),
            })),
        }),
      }),
      ClickedSaveDns: () =>
        editing(() =>
          Option.match(model.maybeDnsDraft, {
            onNone: () => ({ model }),
            onSome: draft =>
              produce(
                modifyFields(model, {
                  page: () => 'info',
                  maybeDnsDraft: () => Option.none(),
                }),
                [
                  setDns(context.target, {
                    mode: 'manual',
                    servers:
                      draft.server.trim() === ''
                        ? draft.servers
                        : [...draft.servers, draft.server.trim()],
                  }),
                ],
              ),
          }),
        ),
      SelectedAddressMode: ({ mode }) => ({
        model: modifyFields(model, {
          maybeAddressDraft: draft =>
            Option.map(draft, current => ({ ...current, mode })),
        }),
      }),
      UpdatedAddressField: ({ field, value }) => ({
        model: modifyFields(model, {
          maybeAddressDraft: draft =>
            Option.map(draft, current => ({
              mode: current.mode,
              ip: field === 'ip' ? value : current.ip,
              mask: field === 'mask' ? value : current.mask,
              gateway: field === 'gateway' ? value : current.gateway,
              dns: field === 'dns' ? value : current.dns,
            })),
        }),
      }),
      ClickedSaveAddress: () =>
        editing(() =>
          Option.match(model.maybeAddressDraft, {
            onNone: () => ({ model }),
            onSome: draft =>
              produce(
                modifyFields(model, {
                  page: () => 'info',
                  maybeAddressDraft: () => Option.none(),
                }),
                [saveAddress(context, draft)],
              ),
          }),
        ),
      UpdatedUrl: ({ value }) => ({
        model: modifyFields(model, { maybeUrlDraft: () => Option.some(value) }),
      }),
      SubmittedUrl: () =>
        editing(() =>
          Option.match(
            Option.filter(model.maybeUrlDraft, url => url.trim() !== ''),
            {
              onNone: () => ({ model }),
              onSome: url =>
                produce(
                  modifyFields(model, {
                    maybeUrlDraft: () => Option.none(),
                    isCertificateOpen: () => false,
                    isAdvancedOpen: () => false,
                  }),
                  [browseTo(context, canonicalUrl(url))],
                ),
            },
          ),
        ),
      ClickedReload: () =>
        editing(() =>
          Option.match(currentPage(context), {
            onNone: () => ({ model }),
            onSome: page =>
              produce(
                modifyFields(model, {
                  maybeUrlDraft: () => Option.none(),
                  isAdvancedOpen: () => false,
                }),
                [browseTo(context, page.url)],
              ),
          }),
        ),
      ClickedPadlock: () => ({
        model: modifyFields(model, {
          isCertificateOpen: isOpen => !isOpen,
        }),
      }),
      ClickedAdvanced: () => ({
        model: modifyFields(model, { isAdvancedOpen: isOpen => !isOpen }),
      }),
      UpdatedFormField: ({ field, value }) => ({
        model: modifyFields(model, {
          login: login => (field === 'login' ? value : login),
          password: password => (field === 'password' ? value : password),
        }),
      }),
      SubmittedForm: () =>
        editing(() =>
          Option.match(currentPage(context), {
            onNone: () => ({ model }),
            onSome: page =>
              produce(
                modifyFields(model, { login: () => '', password: () => '' }),
                [
                  send(
                    Intent.Submit({
                      from: context.target,
                      url: page.url,
                      fields: [
                        { name: 'login', value: model.login },
                        { name: 'password', value: model.password },
                      ],
                    }),
                  ),
                ],
              ),
          }),
        ),
    })
  }
