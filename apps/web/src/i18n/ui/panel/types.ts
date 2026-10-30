// Тексты панелей настроек курса сетей (изменение add-settings-panel): общие
// кнопки панели и подписи полей каждой панели. Раздел `panel` словаря
// интерфейса; пропуск ключа на любом из четырёх языков не компилируется.

export type PanelStrings = Readonly<{
  // ОБЩЕЕ
  tabsLabel: string
  save: string
  cancel: string
  saved: string
  readOnly: string
  show: string
  hide: string
  addRow: string
  removeRow: (row: number) => string
  cell: (column: string, row: number) => string
  emptyList: string
  ghost: string
  required: string
  notANumber: (value: string) => string
  /** Подпись на поверхности, пока устройства панели нет на доске. */
  noDevice: string

  // РОУТЕР
  routerTab: string
  wifi: Readonly<{
    tab: string
    ssid: string
    password: string
    security: string
    secured: string
    open: string
    band: string
    band24: string
    band5: string
    bandDual: string
  }>
  devices: Readonly<{
    tab: string
    title: string
    device: string
    address: string
    mac: string
    connection: string
    cable: string
    radio: (band: string) => string
    noAddress: string
    empty: string
  }>
  addresses: Readonly<{
    tab: string
    poolStart: string
    poolEnd: string
    reservations: string
    device: string
    address: string
    otherMac: (mac: string) => string
  }>
  ports: Readonly<{
    tab: string
    rules: string
    proto: string
    outsidePort: string
    insideIp: string
    insidePort: string
  }>
  routes: Readonly<{
    tab: string
    rules: string
    network: string
    via: string
  }>

  // DNS-ПРОВАЙДЕР
  dns: Readonly<{
    surfaceTab: (zone: string) => string
    tab: string
    records: string
    type: string
    name: string
    namePlaceholder: string
    value: string
    ttl: string
    ttlAuto: string
    ttlHour: string
    ttlDay: string
    ttlSeconds: (seconds: number) => string
  }>

  // СЕРВЕР
  server: Readonly<{
    surfaceTab: (name: string) => string
    siteTab: string
    certTab: string
    firewallTab: string
    access: (program: string) => string
    web: (scheme: string, port: number) => string
    app: (port: number) => string
    database: (port: number) => string
    program: (port: number) => string
    closed: string
    local: string
    everyone: string
    redirect: string
    current: string
    certLine: (names: string, issuer: string, until: string) => string
    noCert: string
    names: string
    name: string
    issue: string
  }>
  firewall: Readonly<{
    enabled: string
    on: string
    off: string
    rules: string
    from: string
    fromPlaceholder: string
    port: string
    portPlaceholder: string
    proto: string
    anyProto: string
    action: string
    allow: string
    drop: string
    reject: string
    defaultIn: string
  }>

  // VPN
  vpn: Readonly<{
    surfaceTab: (device: string) => string
    tab: string
    connection: string
    connected: string
    disconnected: string
    gateway: string
    address: string
    mode: string
    full: string
    split: string
    networks: string
    network: string
    networkPlaceholder: string
    dns: string
    dnsLine: (zone: string, server: string) => string
    noDns: string
  }>

  // MESH
  mesh: Readonly<{
    surfaceTab: string
    tab: string
    members: string
    device: string
    member: string
    name: string
    address: string
  }>

  // COMPOSE
  compose: Readonly<{
    surfaceTab: (device: string) => string
    tab: string
    service: (name: string, image: string) => string
    ports: (service: string) => string
    mapping: string
    mappingPlaceholder: string
    changed: string
    inSync: string
    noFile: string
  }>
}>
