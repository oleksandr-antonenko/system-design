import { Array } from 'effect'

import { type ComponentKind, componentName } from '../../domain/catalog'
import { formatNumber } from '../format'
import { plural } from '../plural'
import { deviceEn } from './device/en'
import { packetBoardEn } from './packetBoard/en'
import { panelEn } from './panel/en'
import type { UiStrings } from './types'

const inLanguage: UiStrings['inLanguage'] = {
  uk: 'in Ukrainian',
  ru: 'in Russian',
  en: 'in English',
  lt: 'in Lithuanian',
}

const kindHint: UiStrings['kindHint'] = {
  client: 'People and apps that send requests',
  cdn: 'Content delivery network: serves static files from servers near the user',
  limiter: 'Rejects requests above the allowed rate',
  lb: 'Spreads requests across servers',
  server: 'Runs the application code and answers requests',
  cache: 'Keeps frequent answers in memory and takes load off the database',
  queue: 'Holds jobs until workers pick them up',
  events: 'Delivers each event to every subscriber',
  worker: 'Runs jobs from a queue in the background',
  db: 'Stores the system’s data',
  replica: 'A copy of the database that serves reads',
  search: 'Finds records by text quickly',
  storage:
    'Keeps files such as images, videos and backups and serves them by link',
}

const regionName: UiStrings['regionName'] = {
  eu: 'Europe',
  us: 'USA',
  asia: 'Asia',
}

const n = (value: number) => formatNumber('en', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
/** Доля профиля трафика: до десятых процента, чтобы 0,5 % не стало 1 %. */
const share = (ratio: number) =>
  `${formatNumber('en', Math.round(ratio * 1000) / 10)}%`
const count = (value: number) => formatNumber('en', value)
const perHour = (dollars: number) => `$${dollars.toFixed(2)}/h`
const kindList = (kinds: ReadonlyArray<ComponentKind>) =>
  kinds.map(kind => componentName[kind]).join(', ')
const idList = (lead: string, ids: ReadonlyArray<string>) =>
  Array.isReadonlyArrayNonEmpty(ids) ? `${lead}${ids.join(', ')}.` : ''

export const en = {
  siteTitle: 'Interactive courses',
  siteTagline: 'Theory on a live board and hands-on tasks',
  courseSwitcherLabel: 'Courses',
  languageSwitcherLabel: 'Language',
  currentLanguage: 'current',
  inLanguage,
  kindHint,
  regionName,
  home: {
    heading: 'Course outline',
    lessonCount: count =>
      `${formatNumber('en', count)} ${plural('en', count, {
        one: 'lesson',
        other: 'lessons',
      })}`,
    lessonNumber: order => `Lesson ${formatNumber('en', order)}`,
    comingSoon: 'Coming soon',
  },
  lesson: {
    backToCourse: 'Back to the course outline',
    theoryRegion: 'Theory',
    boardRegion: 'Board',
    instrumentsRegion: 'Instruments',
    theoryPlaceholder:
      'This lesson is still in the works. Theory steps will appear here.',
    boardPlaceholder: 'The system diagram board will appear here.',
    instrumentsPlaceholder: 'Load, errors and response time will appear here.',
    loading: 'Loading the lesson…',
    loadFailed: 'The lesson did not load. Check your connection and try again.',
    retry: 'Try again',
  },
  board: {
    label: 'System diagram',
    paletteTitle: 'Palette',
    laterTitle: 'Later in the course',
    paletteClosed: 'Opens during a task',
    paletteHint: 'Drag onto the board or click to add',
    lockedUntilLesson: order => `lesson ${order}`,
    newBadge: 'new',
    capacityTag: rps => `up to ${n(rps)} rps`,
    modeView: 'The board follows the text',
    modeEdit: 'Task · the board is yours',
    modeReplay: 'Showing the solution…',
    deleteEdge: 'Delete connection',
    deleteNode: 'Delete block',
    connectHint: 'Drag to connect',
    nodeLoad: (rps, utilization) => `${n(rps)} rps · ${percent(utilization)}`,
    clientsLoad: rps => `${n(rps)} rps →`,
    nodeDown: 'down',
    queueGrowing: rps => `grows +${n(rps)}/s`,
    rejecting: rps => `rejected ${n(rps)}/s`,
    zoneDown: region => `${regionName[region]} · region down`,
    edgeFlow: rps => `${n(rps)} rps`,
    ghost: kind => `${componentName[kind]} here`,
    modePick: 'Question · pick on the board',
    loadHidden: 'load hidden until you answer',
  },
  hud: {
    load: 'Load',
    errors: 'Errors',
    p95: 'p95 response',
    database: 'Database load',
    rejected: 'Rejected',
    backlog: 'Queue growing',
    cost: 'Cost',
    rps: value => `${n(value)} rps`,
    growth: value => `+${n(value)} rps`,
    ms: value => `${n(value)} ms`,
    percent,
    perHour,
    trafficMix: 'Traffic mix',
    trafficKnob: {
      writeShare: value => `writes ${share(value)}`,
      deferredShare: value => `deferred writes ${share(value)}`,
      cacheHitShare: value => `hit ${share(value)}`,
      cdnStaticShare: value => `CDN static ${share(value)}`,
      jobsPerRequest: value => `jobs per request ×${count(value)}`,
      writesPerJob: value => `writes per job ×${count(value)}`,
    },
    pause: 'Pause',
    play: 'Traffic',
    speed: 'Speed',
    undo: 'Undo',
    redo: 'Redo',
    reset: 'Reset board',
    journal: 'Operation log',
    legendOk: 'request served',
    legendHot: 'block near its limit',
    legendLost: 'request lost',
    modelNote: 'A model; numbers are illustrative',
  },
  player: {
    stepOf: (step, total) => `Step ${step} of ${total}`,
    step: step => `Step ${step}`,
    prev: '← Back',
    next: 'Next →',
    nextTo: stepTitle => `Next: ${stepTitle} →`,
    navHint: 'The ← → keys work too',
    solveFirst: 'Solve the task on the board to continue',
    lessonEnd: 'End of the lesson',
    revisit: 'Go back to this step',
    journalScript: stepTitle => `Script of step “${stepTitle}”`,
    journalMine: 'Your moves in the task',
    journalScriptEmpty: 'The board does not change on this step.',
    journalMineEmpty: 'Nothing yet. Your moves appear once you start the task.',
    journalNote:
      'The board on any step is these operations applied from the start of the lesson. Demonstrations and your moves use one language, which is what makes rewinding, undo and “Show solution” work.',
    finishedTitle: 'Lesson complete',
    finishedBody: 'More lessons will appear in the course outline.',
    nextLesson: title => `Next lesson: ${title} →`,
    courseFinishedTitle: 'Course complete',
    courseFinishedBody: 'This was the last lesson of the course.',
    answerFirst: 'Answer the question first',
    toBoard: 'See it on the board →',
    toTask: 'To the task →',
    toQuestion: 'To the question →',
    toText: '← Text',
    toTextLabel: 'Back to the step text',
    moreBadge: 'for the curious',
    askAiTitle: 'How to ask an AI',
    copy: 'Copy',
    copied: 'Copied',
  },
  task: {
    heading: 'Task on the board',
    solved: 'Solved',
    solvedWithHint: 'Solved with a hint',
    attempts: count =>
      `${n(count)} ${plural('en', count, { one: 'attempt', other: 'attempts' })}`,
    howTo:
      'Drag a block from the palette onto the board. Draw a connection from the circle on the right edge of a block. To delete a connection, click it, then the red cross.',
    hiddenGoal: 'One more criterion is checked by running the load',
    metricGoal: load => `Handles ${n(load)} rps with less than 1% errors`,
    metricGoalPassed: (load, errorRate) =>
      `Handles ${n(load)} rps, errors ${percent(errorRate)}`,
    check: 'Check',
    hint: (shown, total) => `Hint · ${shown} of ${total}`,
    showSolution: 'Show solution',
    resultErrors: 'Errors',
    resultP95: 'p95 response',
    resultServers: 'Server load',
    resultCost: 'Cost',
    continueLesson: 'Next →',
    surfaces: 'Where to solve the task',
  },
  quiz: {
    heading: 'Question',
    correct: 'Right on the first try',
    incorrect: 'Not quite',
    oneAttempt: 'One attempt: then you see the answer and why.',
    pickOnBoard:
      'Click the answer on the board. Keyboard: Tab to it and press Enter.',
    choices: 'Answer options',
    answerWas: answer => `Correct answer: ${answer}`,
  },
  network: {
    boardLabel: 'Network diagram',
    placeholder:
      'The network board is in progress: for now it is just a list of devices.',
    run: 'Run',
  },
  device: deviceEn,
  panel: panelEn,
  packetBoard: packetBoardEn,
  notFound: {
    title: 'Page not found',
    body: path => `There is nothing at “${path}”.`,
    backHome: 'Back to all courses',
  },
  domain: {
    UnknownCourse: ({ course }) => `There is no course “${course}”.`,
    UnknownLesson: ({ slug }) => `There is no lesson “${slug}” in the course.`,
    LessonNotTranslated: ({ shownIn }) =>
      `This lesson hasn’t been translated into English yet, so it is shown ${inLanguage[shownIn]}.`,
    SendNeedsIp: () =>
      'Type an IP address: four numbers separated by dots, for example 192.168.1.10.',
    ConnectSelf: () => 'A block cannot connect to itself.',
    ConnectDuplicate: () => 'This connection already exists.',
    ConnectIntoClients: () =>
      'Nothing flows into users: they are where traffic comes from.',
    ConnectClientsToDatabase: () =>
      'Users do not talk to the database directly. A server has to sit between them.',
    ConnectServerToServer: () =>
      'Servers do not pass requests to each other. Spreading load is the load balancer’s job.',
    ConnectBalancerToDatabase: () =>
      'A load balancer hands requests to servers, not to the database.',
    ConnectWrongDirection: () =>
      'Requests flow left to right: users, load balancer, servers, database.',
    NodeIsPartOfTask: ({ id }) =>
      `Block ${id} is part of the task and cannot be deleted.`,
    UnknownNode: ({ id }) => `There is no block ${id} on the board.`,
    DuplicateNodeId: ({ id }) => `A block named ${id} already exists.`,
    GoalMissingKind: ({ kind }) =>
      `There is no “${componentName[kind]}” block on the board yet. It is in the palette on the left.`,
    GoalTooFewTargets: ({ from, to, have, need }) =>
      `Connections from “${componentName[from]}” to “${componentName[to]}” blocks: ${n(have)} of ${n(need)}. Draw the missing ones.`,
    GoalDirectPath: ({ from, via, targets }) =>
      `“${componentName[from]}” reach ${targets.join(', ')} directly, bypassing the “${componentName[via]}” block. Click the highlighted connection and delete it.`,
    GoalNotConnected: ({ from, via }) =>
      `There is no connection from “${componentName[from]}” to the “${componentName[via]}” block, so requests have nowhere to go.`,
    GoalTooManyErrors: ({ load, errorRate, overloaded }) =>
      `At ${n(load)} rps, ${percent(errorRate)} of requests are lost. Losing requests: ${overloaded.join(', ')}.`,
    ConnectFromSink: ({ from }) =>
      `Requests end at the “${componentName[from]}” block: it does not pass them any further.`,
    ConnectNotAllowed: ({ from, to, allowed }) =>
      `“${componentName[from]}” does not pass requests to “${componentName[to]}”. Allowed connections: ${kindList(allowed)}.`,
    InvalidCapacity: ({ id }) => `Block ${id} needs a capacity above zero.`,
    ShareNotForUsers: ({ id }) =>
      `Only a “Users” block has a share of the load, and ${id} is a different block.`,
    InvalidShare: ({ id }) =>
      `The load share of ${id} must be a number above zero.`,
    InvalidTraffic: ({ knob }) =>
      `The traffic setting ${knob} is out of range: shares go from 0 to 1, writes and deferred writes together up to 1, counts from 0.`,
    RegionHasNoBlocks: ({ region }) =>
      `There are no blocks in region “${regionName[region]}”.`,
    GoalSlowResponse: ({ load, p95, max, hottest }) =>
      `At ${n(load)} rps, p95 is ${n(p95)} ms, above the ${n(max)} ms limit.${idList(' The busiest block: ', hottest)}`,
    GoalOverUtilized: ({ kind, load, utilization, max, nodes }) =>
      `At ${n(load)} rps, “${componentName[kind]}” blocks are loaded up to ${percent(utilization)}, above the ${percent(max)} limit: ${nodes.join(', ')}.`,
    GoalBacklogGrowing: ({ load, backlog, max, nodes }) =>
      `At ${n(load)} rps, queues grow by ${n(backlog)} rps, the limit is ${n(max)} rps.${idList(' Falling behind: ', nodes)}`,
    GoalTooExpensive: ({ cost, max }) =>
      `The system costs ${perHour(cost)}, above the ${perHour(max)} budget.`,
    GoalFailureNotSurvived: ({ id, kind, load, errorRate, max }) =>
      `When ${id} (“${componentName[kind]}”) fails, ${percent(errorRate)} of requests are lost at ${n(load)} rps; at most ${percent(max)} is allowed.`,
    GoalRegionFailureNotSurvived: ({
      region,
      load,
      errorRate,
      max,
      overloaded,
    }) =>
      `When region “${regionName[region]}” goes down, ${percent(errorRate)} of requests are lost at ${n(load)} rps; at most ${percent(max)} is allowed.${idList(' Losing requests: ', overloaded)}`,
    GoalNotCarrying: ({ node, load, carried, min }) =>
      `At ${n(load)} rps, only ${n(carried)} rps flow through ${node}; it should carry at least ${n(min)} rps.`,
  },
} satisfies UiStrings
