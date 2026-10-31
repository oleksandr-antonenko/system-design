import { Array, Result, Schema } from 'effect'
import { modifyFields } from 'foldkit/struct'

import { type GoalResult, ScenarioMessage, goalResult } from './codes'

// Двухфакторная защита (урок 5 «2FA»): на странице безопасности сайта 2FA
// включают по QR-коду и шести цифрам из приложения-аутентификатора, потом
// сохраняют резервные коды. После этого на телефон приходит чужой запрос
// входа: его отклоняют и сообщают IT. «Да» на чужой запрос — ошибка, но
// вход можно тут же завершить, и задача решается дальше.

// MODEL

/** Сколько пройдено при включении 2FA. */
export const TwoFactor = Schema.Literals(['off', 'scanned', 'on', 'saved'])
export type TwoFactor = typeof TwoFactor.Type

/** Чужой запрос входа: ждёт включения 2FA, пришёл, пропущен «Да»,
    отклонён, IT в курсе. */
export const SignIn = Schema.Literals([
  'waiting',
  'pending',
  'allowed',
  'declined',
  'reported',
])
export type SignIn = typeof SignIn.Type

export const Auth = Schema.Struct({
  owner: Schema.String,
  /** Подпись урока: сайт, где включают 2FA. */
  site: Schema.String,
  url: Schema.String,
  account: Schema.String,
  /** Шесть цифр, которые показывает приложение после QR-кода. */
  code: Schema.String,
  /** Подпись урока чужого запроса входа: устройство и пояснение (место,
      время). */
  request: Schema.String,
  twoFactor: TwoFactor,
  signIn: SignIn,
})
export type Auth = typeof Auth.Type

export type AuthSetup = Omit<Auth, 'twoFactor' | 'signIn'>

// QUERIES

const digitsOf = (code: string): string => code.replace(/\D/g, '')

export const isCode = (auth: Auth, typed: string): boolean =>
  digitsOf(typed) === digitsOf(auth.code)

export const isOn = (auth: Auth): boolean =>
  auth.twoFactor === 'on' || auth.twoFactor === 'saved'

export const isScanned = (auth: Auth): boolean => auth.twoFactor !== 'off'

// CHANGES

type Changed = Result.Result<Auth, ScenarioMessage>

export const scanQr = (auth: Auth): Changed =>
  Result.succeed(
    auth.twoFactor === 'off'
      ? modifyFields(auth, { twoFactor: (): TwoFactor => 'scanned' })
      : auth,
  )

export const confirmCode = (auth: Auth, code: string): Changed =>
  !isScanned(auth)
    ? Result.fail(ScenarioMessage.NotScanned())
    : !isCode(auth, code)
      ? Result.fail(ScenarioMessage.WrongCode())
      : Result.succeed(
          auth.twoFactor === 'scanned'
            ? modifyFields(auth, { twoFactor: (): TwoFactor => 'on' })
            : auth,
        )

/** Коды сохранены: 2FA готова, и тут приходит чужой запрос входа. */
export const saveBackupCodes = (auth: Auth): Changed =>
  !isOn(auth)
    ? Result.fail(ScenarioMessage.TwoFactorOff())
    : Result.succeed(
        modifyFields(auth, {
          twoFactor: (): TwoFactor => 'saved',
          signIn: (signIn): SignIn =>
            signIn === 'waiting' ? 'pending' : signIn,
        }),
      )

const moveSignIn = (
  auth: Auth,
  from: ReadonlyArray<SignIn>,
  to: SignIn,
  failure: ScenarioMessage,
): Changed =>
  Array.contains(from, auth.signIn)
    ? Result.succeed(modifyFields(auth, { signIn: () => to }))
    : Result.fail(failure)

export const allowSignIn = (auth: Auth): Changed =>
  moveSignIn(auth, ['pending'], 'allowed', ScenarioMessage.NoSignIn())

export const declineSignIn = (auth: Auth): Changed =>
  moveSignIn(
    auth,
    ['pending', 'allowed'],
    'declined',
    ScenarioMessage.NoSignIn(),
  )

export const reportSignIn = (auth: Auth): Changed =>
  moveSignIn(auth, ['declined'], 'reported', ScenarioMessage.SignInPending())

// GOALS

export const twoFactorOn = (auth: Auth): GoalResult =>
  goalResult(isOn(auth), ScenarioMessage.TwoFactorOff())

export const codesSaved = (auth: Auth): GoalResult =>
  goalResult(auth.twoFactor === 'saved', ScenarioMessage.CodesNotSaved())

export const strangerStopped = (auth: Auth): GoalResult =>
  goalResult(
    auth.signIn === 'reported',
    auth.signIn === 'declined'
      ? ScenarioMessage.NotReported()
      : ScenarioMessage.SignInPending(),
  )

// TARGETS

export const authTargets = (auth: Auth): ReadonlyArray<string> => [
  auth.owner,
  auth.site,
  auth.request,
]
