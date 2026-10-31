import { Array, Option, Result, Schema } from 'effect'
import { modifyFields } from 'foldkit/struct'

import { type GoalResult, ScenarioMessage, goalResult } from './codes'

// Сейф-файл KeePass (урок 4 «KeePass»): база паролей — один файл на
// устройстве владельца. Облака нет, поэтому восстановить его некому:
// нужна надёжная мастер-фраза и свежая копия на другом устройстве. Фразы,
// места и записи — подписи урока (`phrase:<id>`, `place:<id>`, `kp:<id>`);
// в документе только их id, текстов паролей в нём нет.

// MODEL

/** Мастер-фраза на выбор: подпись `phrase:<id>` — сама фраза и почему
    она плохая (пояснение). */
export const Phrase = Schema.Struct({
  id: Schema.String,
  isStrong: Schema.Boolean,
})
export type Phrase = typeof Phrase.Type

/** Куда можно положить файл: подпись `place:<id>`; `device` — на каком
    устройстве это место. Копия на том же устройстве, что и база, погибнет
    вместе с ним. */
export const Place = Schema.Struct({
  id: Schema.String,
  device: Schema.String,
})
export type Place = typeof Place.Type

/** Запись, которую нужно перенести в базу: подпись `kp:<id>`. */
export const KeepassEntry = Schema.Struct({
  id: Schema.String,
  isAdded: Schema.Boolean,
})
export type KeepassEntry = typeof KeepassEntry.Type

/** Копия файла: где и сколько записей в ней было в момент копирования. */
export const BaseCopy = Schema.Struct({
  place: Schema.String,
  entries: Schema.Number,
})
export type BaseCopy = typeof BaseCopy.Type

export const Keepass = Schema.Struct({
  owner: Schema.String,
  /** Подпись урока с названием программы. */
  app: Schema.String,
  /** Имя файла базы, `marina.kdbx`. */
  file: Schema.String,
  /** Место, где создаётся база (одно из `places`). */
  home: Schema.String,
  phrases: Schema.Array(Phrase),
  places: Schema.Array(Place),
  entries: Schema.Array(KeepassEntry),
  isCreated: Schema.Boolean,
  maybePhrase: Schema.Option(Schema.String),
  copies: Schema.Array(BaseCopy),
})
export type Keepass = typeof Keepass.Type

export type KeepassSetup = Omit<
  Keepass,
  'isCreated' | 'maybePhrase' | 'copies' | 'entries'
> &
  Readonly<{ entries: ReadonlyArray<string> }>

// QUERIES

export const findPhrase = (
  keepass: Keepass,
  id: string,
): Option.Option<Phrase> =>
  Array.findFirst(keepass.phrases, phrase => phrase.id === id)

export const findPlace = (keepass: Keepass, id: string): Option.Option<Place> =>
  Array.findFirst(keepass.places, place => place.id === id)

export const chosenPhrase = (keepass: Keepass): Option.Option<Phrase> =>
  Option.flatMap(keepass.maybePhrase, id => findPhrase(keepass, id))

export const hasStrongPhrase = (keepass: Keepass): boolean =>
  Option.exists(chosenPhrase(keepass), phrase => phrase.isStrong)

export const addedCount = (keepass: Keepass): number =>
  Array.filter(keepass.entries, entry => entry.isAdded).length

const homeDevice = (keepass: Keepass): string =>
  Option.match(findPlace(keepass, keepass.home), {
    onNone: () => keepass.home,
    onSome: place => place.device,
  })

/** Копия лежит на другом устройстве, чем база. */
export const isElsewhere = (keepass: Keepass, copy: BaseCopy): boolean =>
  Option.exists(
    findPlace(keepass, copy.place),
    place => place.device !== homeDevice(keepass),
  )

/** В копии все записи, что сейчас есть в базе. */
export const isFresh = (keepass: Keepass, copy: BaseCopy): boolean =>
  copy.entries === addedCount(keepass)

// CHANGES

type Changed = Result.Result<Keepass, ScenarioMessage>

const needsBase = (keepass: Keepass, next: () => Changed): Changed =>
  !keepass.isCreated
    ? Result.fail(ScenarioMessage.NoBase())
    : Option.isNone(keepass.maybePhrase)
      ? Result.fail(ScenarioMessage.PhraseMissing())
      : next()

export const createBase = (keepass: Keepass): Changed =>
  Result.succeed(modifyFields(keepass, { isCreated: () => true }))

export const setPhrase = (keepass: Keepass, id: string): Changed =>
  !keepass.isCreated
    ? Result.fail(ScenarioMessage.NoBase())
    : Option.isNone(findPhrase(keepass, id))
      ? Result.fail(ScenarioMessage.PhraseUnknown({ phrase: id }))
      : Result.succeed(
          modifyFields(keepass, { maybePhrase: () => Option.some(id) }),
        )

export const addEntry = (keepass: Keepass, id: string): Changed =>
  needsBase(keepass, () =>
    Array.some(keepass.entries, entry => entry.id === id)
      ? Result.succeed(
          modifyFields(keepass, {
            entries: entries =>
              Array.map(entries, entry =>
                entry.id === id
                  ? modifyFields(entry, { isAdded: () => true })
                  : entry,
              ),
          }),
        )
      : Result.fail(ScenarioMessage.KeepassEntryUnknown({ entry: id })),
  )

/** Копия в то же место заменяет прежнюю. */
export const copyBase = (keepass: Keepass, id: string): Changed =>
  needsBase(keepass, () =>
    Option.isNone(findPlace(keepass, id)) || id === keepass.home
      ? Result.fail(ScenarioMessage.PlaceUnknown({ place: id }))
      : Result.succeed(
          modifyFields(keepass, {
            copies: copies => [
              ...Array.filter(copies, copy => copy.place !== id),
              { place: id, entries: addedCount(keepass) },
            ],
          }),
        ),
  )

// GOALS

export const strongPhrase = (keepass: Keepass): GoalResult =>
  goalResult(
    keepass.isCreated && hasStrongPhrase(keepass),
    !keepass.isCreated
      ? ScenarioMessage.NoBase()
      : Option.isNone(keepass.maybePhrase)
        ? ScenarioMessage.PhraseMissing()
        : ScenarioMessage.PhraseWeak(),
  )

export const entriesAdded = (keepass: Keepass): GoalResult => {
  const left = keepass.entries.length - addedCount(keepass)
  return goalResult(
    keepass.isCreated && left === 0,
    keepass.isCreated
      ? ScenarioMessage.EntriesLeft({ count: left })
      : ScenarioMessage.NoBase(),
  )
}

export const freshBackup = (keepass: Keepass): GoalResult => {
  const elsewhere = Array.filter(keepass.copies, copy =>
    isElsewhere(keepass, copy),
  )
  return goalResult(
    keepass.isCreated && Array.some(elsewhere, copy => isFresh(keepass, copy)),
    !keepass.isCreated
      ? ScenarioMessage.NoBase()
      : Array.isReadonlyArrayNonEmpty(elsewhere)
        ? ScenarioMessage.BackupStale()
        : Array.isReadonlyArrayNonEmpty(keepass.copies)
          ? ScenarioMessage.BackupSameDevice()
          : ScenarioMessage.NoBackup(),
  )
}

// TARGETS

export const keepassTargets = (keepass: Keepass): ReadonlyArray<string> => [
  keepass.owner,
  keepass.app,
  ...Array.map(keepass.phrases, phrase => `phrase:${phrase.id}`),
  ...Array.map(keepass.places, place => `place:${place.id}`),
  ...Array.map(keepass.entries, entry => `kp:${entry.id}`),
]
