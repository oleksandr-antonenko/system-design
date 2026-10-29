import { formatNumber } from '../format'
import { plural } from '../plural'
import type { UiStrings } from './types'

const inLanguage: UiStrings['inLanguage'] = {
  uk: 'in Ukrainian',
  ru: 'in Russian',
  en: 'in English',
  lt: 'in Lithuanian',
}

const kindName: UiStrings['kindName'] = {
  client: 'Users',
  lb: 'Load balancer',
  server: 'Server',
  db: 'Database',
}

const n = (value: number) => formatNumber('en', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`

export const en = {
  courseTitle: 'System Design',
  courseTagline:
    'An interactive course: theory on a live board and hands-on tasks',
  documentTitle: pageTitle => `${pageTitle} · System Design`,
  languageSwitcherLabel: 'Language',
  inLanguage,
  kindName,
  home: {
    heading: 'Course outline',
    lessonCount: count =>
      `${formatNumber('en', count)} ${plural('en', count, {
        one: 'lesson',
        other: 'lessons',
      })}`,
    lessonNumber: order => `Lesson ${formatNumber('en', order)}`,
    comingSoon: 'Coming soon',
    moduleTitle: {
      foundations: 'Foundations',
      scaling: 'Scaling',
      distributed: 'Reliability and distribution',
    },
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
  },
  board: {
    label: 'System diagram',
    paletteTitle: 'Palette',
    laterTitle: 'Later in the course',
    paletteClosed: 'Opens during a task',
    paletteHint: 'Drag onto the board or click to add',
    upcomingName: {
      cache: 'Cache',
      cdn: 'CDN',
      queue: 'Queue',
      shard: 'Shards',
    },
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
    edgeFlow: rps => `${n(rps)} rps`,
    ghost: kind => `${kindName[kind]} here`,
  },
  hud: {
    load: 'Load',
    errors: 'Errors',
    p95: 'p95 response',
    database: 'Database load',
    cost: 'Cost',
    rps: value => `${n(value)} rps`,
    ms: value => `${n(value)} ms`,
    percent,
    perHour: dollars => `$${dollars.toFixed(2)}/h`,
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
  },
  notFound: {
    title: 'Page not found',
    body: path => `There is nothing at “${path}”.`,
    backHome: 'Back to the course outline',
  },
  domain: {
    UnknownLesson: ({ slug }) => `There is no lesson “${slug}” in the course.`,
    LessonNotTranslated: ({ shownIn }) =>
      `This lesson hasn’t been translated into English yet, so it is shown ${inLanguage[shownIn]}.`,
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
      `There is no “${kindName[kind]}” block on the board yet. It is in the palette on the left.`,
    GoalTooFewTargets: ({ from, to, have, need }) =>
      `Connections from “${kindName[from]}” to “${kindName[to]}” blocks: ${n(have)} of ${n(need)}. Draw the missing ones.`,
    GoalDirectPath: ({ from, via, targets }) =>
      `“${kindName[from]}” reach ${targets.join(', ')} directly, bypassing the “${kindName[via]}” block. Click the highlighted connection and delete it.`,
    GoalNotConnected: ({ from, via }) =>
      `There is no connection from “${kindName[from]}” to the “${kindName[via]}” block, so requests have nowhere to go.`,
    GoalTooManyErrors: ({ load, errorRate, overloaded }) =>
      `At ${n(load)} rps, ${percent(errorRate)} of requests are lost. Losing requests: ${overloaded.join(', ')}.`,
  },
} satisfies UiStrings
