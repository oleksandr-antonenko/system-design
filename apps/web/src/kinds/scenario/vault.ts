import { Array, Option, Result, Schema } from 'effect'
import { modifyFields } from 'foldkit/struct'

import { type GoalResult, ScenarioMessage, goalResult } from './codes'

// Менеджер паролей (урок 2 «Password manager»): записи со стикеров
// переносят в сейф, повторяющийся пароль заменяют сгенерированным, общий
// доступ дают через общий сейф, а не сообщением. Пароль записи — учебная
// строка со стикера, по ней виден повтор; сгенерированный пароль не
// хранится нигде, у записи есть только отметка `isGenerated`.

// MODEL

/** Где запись: ещё на стикере, в личном или в общем сейфе. */
export const EntryPlace = Schema.Literals(['sticker', 'personal', 'shared'])
export type EntryPlace = typeof EntryPlace.Type

export const VaultEntry = Schema.Struct({
  /** Подпись урока `entry:<id>` — название сайта или сервиса. */
  id: Schema.String,
  url: Schema.String,
  login: Schema.String,
  password: Schema.String,
  place: EntryPlace,
  isGenerated: Schema.Boolean,
})
export type VaultEntry = typeof VaultEntry.Type

export const Vault = Schema.Struct({
  owner: Schema.String,
  /** Подписи урока: приложение, личный и общий сейф. */
  app: Schema.String,
  personal: Schema.String,
  shared: Schema.String,
  /** У кого ещё есть доступ к общему сейфу (подписи урока). */
  members: Schema.Array(Schema.String),
  /** Кто просит пароль сообщением; текст просьбы — подпись `vault:request`. */
  maybeAsker: Schema.Option(Schema.String),
  entries: Schema.Array(VaultEntry),
})
export type Vault = typeof Vault.Type

// QUERIES

export const findEntry = (
  vault: Vault,
  id: string,
): Option.Option<VaultEntry> =>
  Array.findFirst(vault.entries, entry => entry.id === id)

export const isInVault = (entry: VaultEntry): boolean =>
  entry.place !== 'sticker'

/** Другие записи с тем же паролем: сгенерированный пароль не повторяется. */
export const twinsOf = (
  vault: Vault,
  entry: VaultEntry,
): ReadonlyArray<VaultEntry> =>
  entry.isGenerated
    ? []
    : Array.filter(
        vault.entries,
        other =>
          other.id !== entry.id &&
          !other.isGenerated &&
          other.password === entry.password,
      )

export const reusedCount = (vault: Vault): number =>
  Array.filter(vault.entries, entry =>
    Array.isReadonlyArrayNonEmpty(twinsOf(vault, entry)),
  ).length

export const stickersLeft = (vault: Vault): number =>
  Array.filter(vault.entries, entry => entry.place === 'sticker').length

// CHANGES

const changeEntry = (
  vault: Vault,
  id: string,
  change: (entry: VaultEntry) => Result.Result<VaultEntry, ScenarioMessage>,
): Result.Result<Vault, ScenarioMessage> =>
  Option.match(findEntry(vault, id), {
    onNone: () => Result.fail(ScenarioMessage.EntryUnknown({ entry: id })),
    onSome: found =>
      Result.map(change(found), next =>
        modifyFields(vault, {
          entries: entries =>
            Array.map(entries, entry => (entry.id === id ? next : entry)),
        }),
      ),
  })

const inVault = (
  entry: VaultEntry,
  next: () => VaultEntry,
): Result.Result<VaultEntry, ScenarioMessage> =>
  isInVault(entry)
    ? Result.succeed(next())
    : Result.fail(ScenarioMessage.EntryOnSticker({ entry: entry.id }))

/** Стикер — в личный сейф; запись, которая уже в сейфе, не двигается. */
export const saveEntry = (vault: Vault, id: string) =>
  changeEntry(vault, id, entry =>
    Result.succeed(
      isInVault(entry)
        ? entry
        : modifyFields(entry, { place: (): EntryPlace => 'personal' }),
    ),
  )

export const generatePassword = (vault: Vault, id: string) =>
  changeEntry(vault, id, entry =>
    inVault(entry, () => modifyFields(entry, { isGenerated: () => true })),
  )

export const shareEntry = (vault: Vault, id: string) =>
  changeEntry(vault, id, entry =>
    inVault(entry, () =>
      modifyFields(entry, { place: (): EntryPlace => 'shared' }),
    ),
  )

// GOALS

export const allSaved = (vault: Vault): GoalResult =>
  goalResult(
    stickersLeft(vault) === 0,
    ScenarioMessage.StickersLeft({ count: stickersLeft(vault) }),
  )

export const noReuse = (vault: Vault): GoalResult =>
  goalResult(
    reusedCount(vault) === 0,
    ScenarioMessage.PasswordReused({ count: reusedCount(vault) }),
  )

export const inShared = (vault: Vault, id: string): GoalResult =>
  goalResult(
    Option.exists(findEntry(vault, id), entry => entry.place === 'shared'),
    ScenarioMessage.NotShared({ entry: id }),
  )

export const regenerated = (vault: Vault, id: string): GoalResult =>
  goalResult(
    Option.exists(findEntry(vault, id), entry => entry.isGenerated),
    ScenarioMessage.NotRegenerated({ entry: id }),
  )

// TARGETS

export const vaultTargets = (vault: Vault): ReadonlyArray<string> => [
  vault.owner,
  vault.app,
  vault.personal,
  vault.shared,
  ...vault.members,
  ...Option.match(vault.maybeAsker, {
    onNone: () => [],
    onSome: asker => [asker, 'vault:request'],
  }),
  ...Array.map(vault.entries, entry => `entry:${entry.id}`),
]
