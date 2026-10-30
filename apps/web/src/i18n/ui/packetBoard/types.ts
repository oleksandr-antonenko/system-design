import type { DeviceKind } from '../../../net/model'
import type { StackLevel } from '../../../net/packet'

/** Протокол конверта в легенде доски сетей (урок 7). */
export type ProtocolName =
  | 'arp'
  | 'dhcp'
  | 'dns'
  | 'icmp'
  | 'tcp'
  | 'tls'
  | 'http'
  | 'data'
  | 'tunnel'

export type CardTable =
  | 'mac'
  | 'arp'
  | 'routes'
  | 'leases'
  | 'nat'
  | 'dns'
  | 'contacts'
  | 'records'
  | 'ports'
  | 'rules'

/** Тексты доски сетей (add-network-board). */
export type PacketBoardStrings = Readonly<{
  /** Подсказка к виду устройства: родное название и короткое пояснение.
      Само имя на доске английское (`deviceKindName` в `net/model.ts`);
      подсказка — всплывающий текст и доступное описание устройства. */
  kindHint: Readonly<Record<DeviceKind, string>>
  transport: Readonly<{
    run: string
    again: string
    resume: string
    step: string
    back: string
    restart: string
    slow: string
    normal: string
    speed: string
    legend: string
    hopOf: (what: string, hop: number, total: number) => string
    /** Номер конверта в полной трассе (урок 7): «packet 3 из 11». */
    packetOf: (packet: number, total: number) => string
    request: string
    reply: string
  }>
  caption: Readonly<{
    idle: string
    walkIdle: string
    walking: (device: string) => string
    waiting: (from: string) => string
    flying: (from: string, to: string, how: string) => string
    resting: (at: string) => string
    paused: (at: string) => string
    delivered: (to: string) => string
    replied: (to: string) => string
    dropped: (reason: string) => string
    viaRadio: string
    viaCable: string
    viaCellular: string
    viaTunnel: string
    inside: string
    innerHop: string
  }>
  done: Readonly<{
    page: string
    delivered: string
    reply: string
  }>
  envelope: Readonly<{
    from: string
    to: string
    /** «Кому» у вопроса для всех в сети (кто выдаст мне адрес?). */
    everyone: string
    open: string
    title: (hop: number, total: number) => string
    close: string
    changed: string
    sealed: string
    levels: Readonly<Record<StackLevel, string>>
    layersHint: string
  }>
  legend: Readonly<{
    title: string
    request: string
    reply: string
    lost: string
    protocols: Readonly<Record<ProtocolName, string>>
  }>
  zone: Readonly<{
    home: string
    cafe: string
    office: string
    plan: string
    docker: (host: string) => string
    internet: string
    internetSub: string
    internetOpenSub: string
    innerNet: string
    expand: string
    collapse: string
    wall: string
  }>
  link: Readonly<{
    radio: string
    cable: string
    cellular: string
    virtual: string
    tunnel: string
    unplugged: string
    notConnected: string
    noWifi: string
    band: (band: string) => string
    hidden: string
  }>
  sticker: Readonly<{
    open: string
    title: string
    ssid: string
    password: string
    note: string
    close: string
    short: string
  }>
  card: Readonly<{
    close: string
    open: (device: string) => string
    address: string
    noAddress: string
    mac: string
    ports: string
    portOnlySelf: string
    noPorts: string
    empty: string
    expiresIn: (seconds: number) => string
    expired: string
    tables: Readonly<Record<CardTable, string>>
    defaultRule: string
    sendPhoto: string
    printDocument: string
    sendAddress: string
    send: string
  }>
  tools: Readonly<{
    cable: string
    cableHint: string
    cableFrom: (device: string) => string
    unplug: (link: string) => string
    move: string
    locked: string
    moveHint: string
  }>
  quiz: Readonly<{
    pick: string
    done: string
    selected: (count: number) => string
    dragEnvelope: string
    nextHop: (device: string) => string
    missed: string
    layerQuestion: string
    chips: string
    placeHint: string
    slotEmpty: string
    takeBack: string
    hiddenUntilAnswer: string
    rulesTitle: (device: string) => string
  }>
  printout: (device: string) => string
  scan: Readonly<{
    title: (from: string, target: string) => string
    open: string
    closed: string
    filtered: string
  }>
  runAll: Readonly<{
    title: string
    path: string
    result: string
    hops: string
    ms: string
    reach: string
    blocked: string
    expected: (what: string) => string
  }>
  fog: string
  draft: string
  builder: Readonly<{
    title: string
    hint: string
    send: string
    reset: string
    position: (position: number) => string
    outside: string
    inside: string
  }>
  signal: (bars: number, band: string) => string
  newBadge: string
  /** Как решать задачу сетей: строка в карточке задачи. */
  taskHowTo: string
  modeQuiz: string
  modeTask: string
}>
