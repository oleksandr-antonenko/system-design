import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

// Сообщения экрана устройства и их значения: какое приложение, какая
// страница настроек, какое поле.

export const App = Schema.Literals(['settings', 'browser'])
export type App = typeof App.Type

/** Экран настроек: список Wi-Fi, сведения о сети, DNS, адрес. */
export const Page = Schema.Literals(['wifi', 'info', 'dns', 'address'])
export type Page = typeof Page.Type

export const AddressMode = Schema.Literals(['dhcp', 'static'])
export type AddressMode = typeof AddressMode.Type

export const AddressField = Schema.Literals(['ip', 'mask', 'gateway', 'dns'])
export type AddressField = typeof AddressField.Type

export const FormField = Schema.Literals(['login', 'password'])
export type FormField = typeof FormField.Type

// MESSAGE

export const Message = defineMessageUnion({
  ClickedApp: { app: App },
  ClickedPage: { page: Page },
  ClickedNetwork: { ssid: Schema.String },
  UpdatedWifiPassword: { value: Schema.String },
  ClickedPasswordVisibility: {},
  SubmittedWifiPassword: {},
  ClickedCloseSheet: {},
  ClickedForget: {},
  SelectedDnsMode: { mode: Schema.Literals(['auto', 'manual']) },
  UpdatedDnsServer: { value: Schema.String },
  SubmittedDnsServer: {},
  ClickedRemoveDnsServer: { server: Schema.String },
  ClickedSaveDns: {},
  SelectedAddressMode: { mode: AddressMode },
  UpdatedAddressField: { field: AddressField, value: Schema.String },
  ClickedSaveAddress: {},
  UpdatedUrl: { value: Schema.String },
  SubmittedUrl: {},
  ClickedReload: {},
  ClickedPadlock: {},
  ClickedAdvanced: {},
  UpdatedFormField: { field: FormField, value: Schema.String },
  SubmittedForm: {},
})
export type Message = typeof Message.Type
