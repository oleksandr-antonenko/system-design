import { Array, Option, Result, Schema } from 'effect'
import { modifyFields } from 'foldkit/struct'

import { type GoalResult, ScenarioMessage, goalResult } from './codes'

// Разбор предметов (уроки 7–9): стол перед обедом, папка «Загрузки»,
// расширения браузера. Предмет — подпись урока `item:<id>` (имя и
// пояснение), его действия — подписи `action:<id>`, итог выбора — подпись
// `res:<предмет>:<действие>`, если урок её дал. У предмета одно верное
// действие и, может быть, одно опасное: его документ записывает ошибкой.
// Выбор можно поменять, ошибка остаётся.

// MODEL

/** Чем опасно действие: вставить найденную флешку, запустить файл, дать
    расширению все сайты, оставить экран открытым. */
export const Risk = Schema.Literals(['plug', 'run', 'grant', 'unlocked'])
export type Risk = typeof Risk.Type

export const ItemRisk = Schema.Struct({ action: Schema.String, risk: Risk })
export type ItemRisk = typeof ItemRisk.Type

/** Предмет — файл: его имя без последней части — подпись `item:<id>`
    (так его показывает система со скрытыми расширениями), `ext` —
    настоящее расширение. */
export const FileName = Schema.Struct({ ext: Schema.String })
export type FileName = typeof FileName.Type

/** Строка подробностей (разрешение расширения): подпись `detail:<id>`;
    `isWide` — доступ ко всем сайтам, рисуется красным. */
export const Detail = Schema.Struct({
  id: Schema.String,
  isWide: Schema.Boolean,
})
export type Detail = typeof Detail.Type

export const TrayItem = Schema.Struct({
  id: Schema.String,
  icon: Schema.String,
  /** Раздел экрана: подпись `group:<id>`. */
  group: Schema.String,
  maybeFile: Schema.Option(FileName),
  details: Schema.Array(Detail),
  actions: Schema.Array(Schema.String),
  right: Schema.String,
  maybeRisk: Schema.Option(ItemRisk),
  maybeChosen: Schema.Option(Schema.String),
})
export type TrayItem = typeof TrayItem.Type

/** Как выглядит экран: стол, папка с файлами или страница расширений. */
export const Look = Schema.Literals(['desk', 'downloads', 'extensions'])
export type Look = typeof Look.Type

export const Tray = Schema.Struct({
  owner: Schema.String,
  look: Look,
  /** Подпись урока с названием экрана. */
  app: Schema.String,
  items: Schema.Array(TrayItem),
})
export type Tray = typeof Tray.Type

// QUERIES

export const findItem = (tray: Tray, id: string): Option.Option<TrayItem> =>
  Array.findFirst(tray.items, item => item.id === id)

export const isRight = (item: TrayItem): boolean =>
  Option.exists(item.maybeChosen, chosen => chosen === item.right)

/** Опасное действие предмета, если выбрано именно оно. */
export const chosenRisk = (item: TrayItem): Option.Option<Risk> =>
  Option.flatMap(item.maybeRisk, risk =>
    Option.exists(item.maybeChosen, chosen => chosen === risk.action)
      ? Option.some(risk.risk)
      : Option.none(),
  )

/** Разделы экрана в порядке первых предметов. */
export const groupsOf = (tray: Tray): ReadonlyArray<string> =>
  Array.dedupe(Array.map(tray.items, item => item.group))

// CHANGES

export const choose = (
  tray: Tray,
  id: string,
  action: string,
): Result.Result<Tray, ScenarioMessage> =>
  Option.match(findItem(tray, id), {
    onNone: () => Result.fail(ScenarioMessage.ItemUnknown({ item: id })),
    onSome: item =>
      Array.contains(item.actions, action)
        ? Result.succeed(
            modifyFields(tray, {
              items: items =>
                Array.map(items, other =>
                  other.id === id
                    ? modifyFields(other, {
                        maybeChosen: () => Option.some(action),
                      })
                    : other,
                ),
            }),
          )
        : Result.fail(ScenarioMessage.ActionUnknown({ action })),
  })

// GOALS

/** У каждого из этих предметов выбрано верное действие. */
export const sorted = (tray: Tray, ids: ReadonlyArray<string>): GoalResult => {
  const left = Array.filter(
    ids,
    id => !Option.exists(findItem(tray, id), isRight),
  ).length
  return goalResult(left === 0, ScenarioMessage.ItemsLeft({ count: left }))
}

// TARGETS

export const trayTargets = (tray: Tray): ReadonlyArray<string> => [
  tray.owner,
  tray.app,
  ...Array.map(groupsOf(tray), group => `group:${group}`),
  ...Array.flatMap(tray.items, item => [
    `item:${item.id}`,
    ...Array.map(item.details, detail => `detail:${detail.id}`),
    ...Array.flatMap(item.actions, action => [
      `action:${action}`,
      `res:${item.id}:${action}`,
    ]),
  ]),
]
