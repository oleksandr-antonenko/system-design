import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { ComponentKind, Region } from '../domain/catalog'
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
  ConnectFromSink: { from: ComponentKind },
  ConnectNotAllowed: {
    from: ComponentKind,
    to: ComponentKind,
    allowed: Schema.Array(ComponentKind),
  },
  NodeIsPartOfTask: { id: Schema.String },
  UnknownNode: { id: Schema.String },
  DuplicateNodeId: { id: Schema.String },
  InvalidCapacity: { id: Schema.String },
  RegionHasNoBlocks: { region: Region },
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
  GoalSlowResponse: {
    load: Schema.Number,
    p95: Schema.Number,
    max: Schema.Number,
    hottest: Schema.Array(Schema.String),
  },
  GoalOverUtilized: {
    kind: ComponentKind,
    load: Schema.Number,
    utilization: Schema.Number,
    max: Schema.Number,
    nodes: Schema.Array(Schema.String),
  },
  GoalBacklogGrowing: {
    load: Schema.Number,
    backlog: Schema.Number,
    max: Schema.Number,
    nodes: Schema.Array(Schema.String),
  },
  GoalTooExpensive: { cost: Schema.Number, max: Schema.Number },
  GoalFailureNotSurvived: {
    id: Schema.String,
    kind: ComponentKind,
    load: Schema.Number,
    errorRate: Schema.Number,
    max: Schema.Number,
  },
  GoalRegionFailureNotSurvived: {
    region: Region,
    load: Schema.Number,
    errorRate: Schema.Number,
    max: Schema.Number,
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
    ConnectBalancerToDatabase: params =>
      texts.ConnectBalancerToDatabase(params),
    ConnectWrongDirection: params => texts.ConnectWrongDirection(params),
    ConnectFromSink: params => texts.ConnectFromSink(params),
    ConnectNotAllowed: params => texts.ConnectNotAllowed(params),
    NodeIsPartOfTask: params => texts.NodeIsPartOfTask(params),
    UnknownNode: params => texts.UnknownNode(params),
    DuplicateNodeId: params => texts.DuplicateNodeId(params),
    InvalidCapacity: params => texts.InvalidCapacity(params),
    RegionHasNoBlocks: params => texts.RegionHasNoBlocks(params),
    GoalMissingKind: params => texts.GoalMissingKind(params),
    GoalTooFewTargets: params => texts.GoalTooFewTargets(params),
    GoalDirectPath: params => texts.GoalDirectPath(params),
    GoalNotConnected: params => texts.GoalNotConnected(params),
    GoalTooManyErrors: params => texts.GoalTooManyErrors(params),
    GoalSlowResponse: params => texts.GoalSlowResponse(params),
    GoalOverUtilized: params => texts.GoalOverUtilized(params),
    GoalBacklogGrowing: params => texts.GoalBacklogGrowing(params),
    GoalTooExpensive: params => texts.GoalTooExpensive(params),
    GoalFailureNotSurvived: params => texts.GoalFailureNotSurvived(params),
    GoalRegionFailureNotSurvived: params =>
      texts.GoalRegionFailureNotSurvived(params),
  })
