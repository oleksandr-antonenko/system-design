import { Array } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'

import type { UiStrings } from '../../../../i18n/ui'
import type { NetMessage } from '../../../../net/message'
import type { SurfaceContext } from '../../../contract'
import type { PacketTypes } from '../../../types'
import type { Message } from './message'
import type { Model } from './screen'

/** Всё, что нужно частям экрана устройства для отрисовки. `ghost` — что
    обводит призрак третьей подсказки (`network:<ssid>`, `url`, `reload`…). */
export type Parts<ParentMessage> = Readonly<{
  model: Model
  context: SurfaceContext<PacketTypes>
  ui: UiStrings
  renderMessage: (message: NetMessage) => string
  send: (message: Message) => ParentMessage
  ghost: ReadonlyArray<string>
  isEditable: boolean
  h: HtmlBuilder<ParentMessage>
}>

export const classes = (...names: ReadonlyArray<string | false>): string =>
  Array.filter(names, (name): name is string => name !== false).join(' ')

export const isGhost = <ParentMessage>(
  parts: Parts<ParentMessage>,
  key: string,
): boolean => Array.contains(parts.ghost, key)
