import type { ComponentKind, Region } from '../../domain/catalog'
import type { TrafficKnob } from '../../domain/traffic'
import type { DomainMessageTexts } from '../domainMessage'
import type { Locale } from '../locale'
import type { DeviceStrings } from './device/types'
import type { PacketBoardStrings } from './packetBoard/types'
import type { PanelStrings } from './panel/types'

export type UiStrings = Readonly<{
  siteTitle: string
  siteTagline: string
  courseSwitcherLabel: string
  languageSwitcherLabel: string
  /** Помечает текущий язык в меню языков для чтения с экрана. */
  currentLanguage: string
  inLanguage: Readonly<Record<Locale, string>>
  /** Родное название элемента и короткое объяснение; подпись — `componentName`. */
  kindHint: Readonly<Record<ComponentKind, string>>
  regionName: Readonly<Record<Region, string>>
  home: Readonly<{
    heading: string
    lessonCount: (count: number) => string
    lessonNumber: (order: number) => string
    comingSoon: string
  }>
  lesson: Readonly<{
    backToCourse: string
    theoryRegion: string
    boardRegion: string
    instrumentsRegion: string
    theoryPlaceholder: string
    boardPlaceholder: string
    instrumentsPlaceholder: string
    loading: string
    loadFailed: string
    retry: string
  }>
  board: Readonly<{
    label: string
    paletteTitle: string
    laterTitle: string
    paletteClosed: string
    paletteHint: string
    lockedUntilLesson: (order: number) => string
    newBadge: string
    capacityTag: (rps: number) => string
    modeView: string
    modeEdit: string
    modeReplay: string
    deleteEdge: string
    deleteNode: string
    connectHint: string
    nodeLoad: (rps: number, utilization: number) => string
    clientsLoad: (rps: number) => string
    nodeDown: string
    queueGrowing: (rps: number) => string
    rejecting: (rps: number) => string
    zoneDown: (region: Region) => string
    edgeFlow: (rps: number) => string
    ghost: (kind: ComponentKind) => string
    modePick: string
    loadHidden: string
  }>
  hud: Readonly<{
    load: string
    errors: string
    p95: string
    database: string
    rejected: string
    backlog: string
    cost: string
    rps: (value: number) => string
    growth: (value: number) => string
    ms: (value: number) => string
    percent: (ratio: number) => string
    perHour: (dollars: number) => string
    /** Подпись прибора с профилем трафика, когда он не по умолчанию. */
    trafficMix: string
    /** Ручка профиля и её значение: «writes 1%», «hit 95%». */
    trafficKnob: Readonly<Record<TrafficKnob, (value: number) => string>>
    pause: string
    play: string
    speed: string
    undo: string
    redo: string
    reset: string
    journal: string
    legendOk: string
    legendHot: string
    legendLost: string
    modelNote: string
  }>
  player: Readonly<{
    stepOf: (step: number, total: number) => string
    step: (step: number) => string
    prev: string
    next: string
    nextTo: (stepTitle: string) => string
    navHint: string
    solveFirst: string
    lessonEnd: string
    revisit: string
    journalScript: (stepTitle: string) => string
    journalMine: string
    journalScriptEmpty: string
    journalMineEmpty: string
    journalNote: string
    finishedTitle: string
    finishedBody: string
    nextLesson: (title: string) => string
    courseFinishedTitle: string
    courseFinishedBody: string
    answerFirst: string
    /** Phones show the step's text or the board, one at a time. The button
        at the end of the text opens the board: plain, on a task step, or on
        a question answered on the board. */
    toBoard: string
    toTask: string
    toQuestion: string
    /** The board's bottom bar: back to the step's text. */
    toText: string
    toTextLabel: string
    moreBadge: string
    askAiTitle: string
    copy: string
    copied: string
  }>
  /** Shown once on a phone in a course that recommends a computer. */
  desktopNotice: Readonly<{
    title: string
    body: string
    ok: string
  }>
  quiz: Readonly<{
    heading: string
    correct: string
    incorrect: string
    oneAttempt: string
    pickOnBoard: string
    choices: string
    answerWas: (answer: string) => string
  }>
  task: Readonly<{
    heading: string
    solved: string
    solvedWithHint: string
    attempts: (count: number) => string
    howTo: string
    hiddenGoal: string
    metricGoal: (load: number) => string
    metricGoalPassed: (load: number, errorRate: number) => string
    check: string
    hint: (shown: number, total: number) => string
    showSolution: string
    resultErrors: string
    resultP95: string
    resultServers: string
    resultCost: string
    continueLesson: string
    surfaces: string
  }>
  network: Readonly<{
    boardLabel: string
    placeholder: string
    run: string
  }>
  /** Экран устройства и терминал курса сетей. */
  device: DeviceStrings
  panel: PanelStrings
  packetBoard: PacketBoardStrings
  notFound: Readonly<{
    title: string
    body: (path: string) => string
    backHome: string
  }>
  domain: DomainMessageTexts
}>
