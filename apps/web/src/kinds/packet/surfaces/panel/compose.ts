import { Array, Option, Result, Schema } from 'effect'

import { compose } from '../../../../net/build'
import { NetOp, findHost, parseMapping } from '../../../../net/doc'
import { NetMessage } from '../../../../net/message'
import {
  type ComposeFile,
  type DeviceId,
  type Host,
  NetDoc,
} from '../../../../net/model'
import { type PacketDoc, applyPacketOp } from '../../doc'
import * as Check from './fields'
import {
  type Field,
  type PanelContext,
  type PanelDefinition,
  PanelProblem,
  type PanelTab,
  fieldOf,
  gather,
  gatherAll,
  problemAt,
  rowsOf,
  values,
} from './schema'

// Редактор compose.yaml `compose:<устройство>` (урок 14): переменные
// окружения и порты сервисов. «Сохранить» меняет только файл (`SetCompose`);
// контейнеры работают по старому файлу, пока ученик не выполнит
// `docker compose up -d`. Пока файл и запущенное расходятся, панель это
// говорит.

const composeDevice = (
  world: PacketDoc,
  target: string,
): Option.Option<DeviceId> =>
  Option.map(findHost(world.doc, target), host => host.id)

const hostOf = (context: PanelContext): Option.Option<Host> =>
  findHost(context.world.doc, context.device)

const fileOf = (context: PanelContext): Option.Option<ComposeFile> =>
  Option.flatMap(hostOf(context), host => host.maybeCompose)

const sameDoc = Schema.toEquivalence(NetDoc)

/** Запущено ли то, что в файле: `docker compose up` ничего бы не поменял. */
export const isRunningFile = (context: PanelContext): boolean =>
  Result.match(
    applyPacketOp(context.world, NetOp.ComposeUp({ device: context.device })),
    {
      onFailure: () => false,
      onSuccess: next => sameDoc(next.doc, context.world.doc),
    },
  )

const envField = (service: string, key: string): string =>
  `env:${service}:${key}`

const portsList = (service: string): string => `ports:${service}`

const MAPPING = 'mapping'

const fileTab: PanelTab = {
  id: 'compose',
  feature: 'compose.file',
  label: strings => strings.compose.tab,
  fields: context =>
    Option.match(fileOf(context), {
      onNone: () => [
        {
          _tag: 'Note',
          id: 'status',
          tone: 'info',
          text: strings => strings.compose.noFile,
        },
      ],
      onSome: file => {
        const isRunning = isRunningFile(context)
        return [
          {
            _tag: 'Note',
            id: 'status',
            tone: isRunning ? 'info' : 'warn',
            text: strings =>
              isRunning ? strings.compose.inSync : strings.compose.changed,
          },
          ...Array.flatMap(file.services, (service): ReadonlyArray<Field> => [
            {
              _tag: 'Note',
              id: `service:${service.name}`,
              tone: 'section',
              text: strings =>
                strings.compose.service(service.name, service.image),
            },
            ...Array.map(service.environment, (variable): Field => ({
              _tag: 'Input',
              id: envField(service.name, variable.key),
              label: () => variable.key,
              input: 'text',
            })),
            {
              _tag: 'List',
              id: portsList(service.name),
              label: strings => strings.compose.ports(service.name),
              columns: [
                {
                  _tag: 'Input',
                  id: MAPPING,
                  label: strings => strings.compose.mapping,
                  input: 'text',
                  placeholder: strings => strings.compose.mappingPlaceholder,
                },
              ],
              newRow: { [MAPPING]: '' },
            },
          ]),
        ]
      },
    }),
  read: context =>
    Option.match(fileOf(context), {
      onNone: () => values({}),
      onSome: file =>
        values(
          Object.fromEntries(
            Array.flatMap(file.services, service =>
              Array.map(service.environment, variable => [
                envField(service.name, variable.key),
                variable.value,
              ]),
            ),
          ),
          Object.fromEntries(
            Array.map(file.services, service => [
              portsList(service.name),
              Array.map(service.ports, (mapping, index) => ({
                id: `p${index}`,
                cells: { [MAPPING]: mapping },
              })),
            ]),
          ),
        ),
    }),
  save: (context, draft) =>
    Option.match(fileOf(context), {
      onNone: () => Result.succeed([]),
      onSome: file =>
        Result.map(
          gatherAll(
            Array.map(file.services, service =>
              Result.map(
                gather({
                  ports: gatherAll(
                    Array.map(rowsOf(draft, portsList(service.name)), row =>
                      Check.cell<string>(portsList(service.name), row)(
                        MAPPING,
                        (path, value) =>
                          Result.flatMap(Check.text(path, value), mapping =>
                            Option.isSome(parseMapping(mapping))
                              ? Result.succeed(mapping)
                              : Result.fail([
                                  problemAt(
                                    path,
                                    PanelProblem.Refused({
                                      message: NetMessage.InvalidPortMapping({
                                        value: mapping,
                                      }),
                                    }),
                                  ),
                                ]),
                          ),
                      ),
                    ),
                  ),
                }),
                ({ ports }) => ({
                  ...service,
                  environment: Array.map(service.environment, variable => ({
                    key: variable.key,
                    value: fieldOf(draft, envField(service.name, variable.key)),
                  })),
                  ports,
                }),
              ),
            ),
          ),
          services => [compose(context.device, { services })],
        ),
    }),
}

export const composePanel: PanelDefinition = {
  type: 'compose',
  feature: 'compose',
  device: composeDevice,
  tabLabel: (maybeContext, strings, target) =>
    strings.compose.surfaceTab(
      Option.match(maybeContext, {
        onNone: () => target,
        onSome: context => context.name(context.device),
      }),
    ),
  heading: (context, strings) =>
    `${strings.compose.tab} · ${context.name(context.device)}`,
  tabs: [fileTab],
}
