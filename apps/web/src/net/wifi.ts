import { Array, Option, Schema, pipe } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { NetMessage } from './message'
import {
  Band,
  type DeviceId,
  type Host,
  type WifiBand,
  type WifiConfig,
} from './model'

/** Правила радио. Дальность — в единицах доски: 5 ГГц быстрее, но бьёт
    ближе, чем 2.4 ГГц. */
export const wifiRules = {
  range24: 450,
  range5: 280,
  minPasswordLength: 8,
  dualBand5Channel: 36,
  overlapDistance24: 5,
}

const CHANNELS_24: ReadonlyArray<number> = Array.range(1, 13)

const CHANNELS_5: ReadonlyArray<number> = [
  36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132,
  136, 140, 144, 149, 153, 157, 161, 165,
]

/** Диапазоны точки доступа в порядке предпочтения клиента. */
export const bandsOf = (band: WifiBand): ReadonlyArray<Band> =>
  band === 'dual' ? ['5', '2.4'] : [band]

export const rangeOf = (band: Band): number =>
  band === '5' ? wifiRules.range5 : wifiRules.range24

export const isValidChannel = (band: WifiBand, channel: number): boolean =>
  Array.contains(band === '5' ? CHANNELS_5 : CHANNELS_24, channel)

/** Каналы 2.4 ГГц шириной 20 МГц перекрываются, если ближе пяти номеров:
    поэтому без пересечений только 1, 6 и 11. В 5 ГГц мешает только тот же
    канал. */
export const channelsOverlap = (left: WifiConfig, right: WifiConfig): boolean =>
  (left.band !== '5' &&
    right.band !== '5' &&
    Math.abs(left.channel - right.channel) < wifiRules.overlapDistance24) ||
  (left.band === '5' && right.band === '5' && left.channel === right.channel)

export const wifiProblem = (wifi: WifiConfig): Option.Option<NetMessage> =>
  wifi.ssid.trim() === ''
    ? Option.some(NetMessage.EmptySsid())
    : wifi.security !== 'open' &&
        wifi.password.length < wifiRules.minPasswordLength
      ? Option.some(
          NetMessage.WifiPasswordTooShort({
            min: wifiRules.minPasswordLength,
          }),
        )
      : isValidChannel(wifi.band, wifi.channel)
        ? Option.none()
        : Option.some(
            NetMessage.InvalidChannel({
              band: wifi.band,
              channel: wifi.channel,
            }),
          )

export const Association = defineTaggedUnion({
  Associated: { band: Band, channel: Schema.Number },
  NotAssociated: { reason: NetMessage },
})
export type Association = typeof Association.Type

/** Подключится ли устройство к точке доступа: сеть включена, SSID и пароль
    совпадают, есть общий диапазон и устройство в его зоне. */
export const associate = (
  station: Host,
  ap: DeviceId,
  maybeWifi: Option.Option<WifiConfig>,
  distance: number,
): Association =>
  Option.match(maybeWifi, {
    onNone: () =>
      Association.NotAssociated({ reason: NetMessage.WifiOff({ ap }) }),
    onSome: wifi =>
      Option.match(station.maybeWifiProfile, {
        onNone: () =>
          Association.NotAssociated({
            reason: NetMessage.NoWifiProfile({ device: station.id }),
          }),
        onSome: profile => {
          if (profile.ssid !== wifi.ssid) {
            return Association.NotAssociated({
              reason: NetMessage.WrongSsid({
                device: station.id,
                ssid: profile.ssid,
                ap,
              }),
            })
          }
          if (wifi.security !== 'open' && profile.password !== wifi.password) {
            return Association.NotAssociated({
              reason: NetMessage.WrongPassword({
                device: station.id,
                ssid: wifi.ssid,
              }),
            })
          }
          const common = Array.filter(bandsOf(wifi.band), band =>
            Array.contains(station.wifiBands, band),
          )
          if (Array.isReadonlyArrayEmpty(common)) {
            return Association.NotAssociated({
              reason: NetMessage.BandUnsupported({
                device: station.id,
                band: wifi.band,
              }),
            })
          }
          return pipe(
            common,
            Array.findFirst(band => distance <= rangeOf(band)),
            Option.match({
              onNone: () =>
                Association.NotAssociated({
                  reason: NetMessage.OutOfRange({ device: station.id, ap }),
                }),
              onSome: band =>
                Association.Associated({
                  band,
                  channel:
                    band === '5' && wifi.band === 'dual'
                      ? wifiRules.dualBand5Channel
                      : wifi.channel,
                }),
            }),
          )
        },
      }),
  })
