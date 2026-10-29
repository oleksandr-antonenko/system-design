import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { ComponentKind } from '../domain/catalog'
import { Locale } from './locale'

export const DomainMessage = defineTaggedUnion({
  UnknownLesson: { slug: Schema.String },
  LessonNotTranslated: { shownIn: Locale },
  ConnectSelf: {},
  ConnectDuplicate: {},
  ConnectIntoClients: {},
  ConnectClientsToDatabase: {},
  ConnectServerToServer: {},
  ConnectBalancerToDatabase: {},
  ConnectWrongDirection: {},
  NodeIsPartOfTask: { id: Schema.String },
  UnknownNode: { id: Schema.String },
  DuplicateNodeId: { id: Schema.String },
  GoalMissingKind: { kind: ComponentKind },
  GoalTooFewTargets: {
    from: ComponentKind,
    to: ComponentKind,
    have: Schema.Number,
    need: Schema.Number,
  },
  GoalDirectPath: {
    from: ComponentKind,
    via: ComponentKind,
    targets: Schema.Array(Schema.String),
  },
  GoalNotConnected: { from: ComponentKind, via: ComponentKind },
  GoalTooManyErrors: {
    load: Schema.Number,
    errorRate: Schema.Number,
    overloaded: Schema.Array(Schema.String),
  },
})
export type DomainMessage = typeof DomainMessage.Type

type ParamsOf<Tag extends DomainMessage['_tag']> = Omit<
  Extract<DomainMessage, { _tag: Tag }>,
  '_tag'
>

export type DomainMessageTexts = Readonly<{
  [Tag in DomainMessage['_tag']]: (params: ParamsOf<Tag>) => string
}>

export const renderDomainMessage = (
  texts: DomainMessageTexts,
  message: DomainMessage,
): string =>
  DomainMessage.match(message, {
    UnknownLesson: params => texts.UnknownLesson(params),
    LessonNotTranslated: params => texts.LessonNotTranslated(params),
    ConnectSelf: params => texts.ConnectSelf(params),
    ConnectDuplicate: params => texts.ConnectDuplicate(params),
    ConnectIntoClients: params => texts.ConnectIntoClients(params),
    ConnectClientsToDatabase: params => texts.ConnectClientsToDatabase(params),
    ConnectServerToServer: params => texts.ConnectServerToServer(params),
    ConnectBalancerToDatabase: params => texts.ConnectBalancerToDatabase(params),
    ConnectWrongDirection: params => texts.ConnectWrongDirection(params),
    NodeIsPartOfTask: params => texts.NodeIsPartOfTask(params),
    UnknownNode: params => texts.UnknownNode(params),
    DuplicateNodeId: params => texts.DuplicateNodeId(params),
    GoalMissingKind: params => texts.GoalMissingKind(params),
    GoalTooFewTargets: params => texts.GoalTooFewTargets(params),
    GoalDirectPath: params => texts.GoalDirectPath(params),
    GoalNotConnected: params => texts.GoalNotConnected(params),
    GoalTooManyErrors: params => texts.GoalTooManyErrors(params),
  })
