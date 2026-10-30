import { Array, Option, pipe } from 'effect'

import { formatIp, macFromId, networkOf, parseCidr, parseIp } from './address'
import { NetOp, emptyHostFields } from './doc'
import { offFirewall } from './firewall'
import {
  Addressing,
  type Band,
  type Cert,
  type ComposeFile,
  type ComposeService,
  Device,
  type DeviceId,
  type DnsZone,
  type Fault,
  type Firewall,
  type FirewallAction,
  type FirewallProto,
  type FirewallRule,
  type Host,
  type HostKind,
  type Ip,
  type Listener,
  type Mac,
  type PortForward,
  type Proto,
  type RecordType,
  type Reservation,
  type Security,
  type StaticRoute,
  type TransitRoute,
  type Upstream,
  type VpnMode,
  type WifiBand,
  type WifiConfig,
} from './model'
import { type Intent } from './packet'
import { netRules } from './run'

// Помощники для уроков и тестов: собирают устройства с умолчаниями и
// операции короткими вызовами. Проверку значений делает `apply`.

const splitCidr = (cidr: string): Readonly<{ ip: Ip; prefix: number }> => {
  const [ip = '', prefix] = cidr.split('/')
  return {
    ip,
    prefix:
      prefix === undefined ? globalThis.Number.NaN : globalThis.Number(prefix),
  }
}

const firstHost = (cidr: string): Ip =>
  Option.match(parseCidr(cidr), {
    onNone: () => '',
    onSome: network =>
      formatIp(
        networkOf(
          Option.getOrElse(parseIp(network.ip), () => 0),
          network.prefix,
        ) + 1,
      ),
  })

export const staticAddress = (
  cidr: string,
  gateway?: Ip,
  dns?: Ip,
): Addressing => {
  const { ip, prefix } = splitCidr(cidr)
  return Addressing.Static({
    ip,
    prefix,
    maybeGateway: Option.fromNullishOr(gateway),
    maybeDns: Option.fromNullishOr(dns),
  })
}

const defaultBands: Readonly<Record<HostKind, ReadonlyArray<Band>>> = {
  pc: [],
  phone: ['2.4', '5'],
  laptop: ['2.4', '5'],
  server: [],
  printer: [],
  bulb: ['2.4'],
  container: [],
}

/** Запись DNS: короткая форма `{ name, ip }` — запись A на 300 секунд,
    полная — `{ name, type, value, ttl }`. */
export type RecordInput =
  | Readonly<{ name: string; ip: Ip; ttl?: number }>
  | Readonly<{ name: string; type: RecordType; value: string; ttl?: number }>

/** Каждое имя короткой формы — своя зона с записью `@`. */
export const zonesFrom = (
  records: ReadonlyArray<RecordInput>,
): ReadonlyArray<DnsZone> =>
  Array.map(records, record => ({
    name: record.name.toLowerCase(),
    records: [
      'ip' in record
        ? {
            name: '@',
            rtype: 'A',
            value: record.ip,
            ttl: record.ttl ?? netRules.dnsTtl,
          }
        : {
            name: '@',
            rtype: record.type,
            value: record.value,
            ttl: record.ttl ?? netRules.dnsTtl,
          },
    ],
  }))

export type HostOptions = Readonly<{
  mac?: Mac
  /** `192.168.1.50/24`; без адреса хост берёт его по DHCP. */
  address?: string
  gateway?: Ip
  dns?: Ip
  /** DNS «вручную» поверх любого адреса; пустой список — DNS нет. */
  manualDns?: ReadonlyArray<Ip>
  wifiBands?: ReadonlyArray<Band>
  wifi?: Readonly<{ ssid: string; password: string }>
  /** Стартовая страница браузера (`https://shop.example/`): экран
      устройства покажет её сам, как только она откроется. */
  homePage?: string
  listeners?: ReadonlyArray<Listener>
  records?: ReadonlyArray<RecordInput>
  zones?: ReadonlyArray<DnsZone>
  /** Справочная: спрашивает тех, кто отвечает за имя, и помнит ответы. */
  resolver?: boolean
  certs?: ReadonlyArray<Cert>
  redirect?: boolean
  firewall?: Firewall
  /** Веб-сервер передаёт запросы приложению (`127.0.0.1:3000`). */
  proxy?: Upstream
}>

export const host = (
  id: DeviceId,
  kind: HostKind,
  x: number,
  y: number,
  options: HostOptions = {},
): Device => ({
  ...emptyHostFields,
  id,
  x,
  y,
  kind,
  mac: options.mac ?? macFromId(id),
  addressing:
    options.address === undefined
      ? Addressing.Dhcp()
      : staticAddress(options.address, options.gateway, options.dns),
  maybeDnsOverride: Option.fromNullishOr(options.manualDns),
  wifiBands: options.wifiBands ?? defaultBands[kind],
  maybeWifiProfile: Option.fromNullishOr(options.wifi),
  maybeHomePage: Option.fromNullishOr(options.homePage),
  listeners: options.listeners ?? [],
  zones: [...zonesFrom(options.records ?? []), ...(options.zones ?? [])],
  resolver: options.resolver ?? false,
  certs: options.certs ?? [],
  httpsRedirect: options.redirect ?? false,
  firewall: options.firewall ?? offFirewall,
  maybeProxy: Option.fromNullishOr(options.proxy),
})

export const tcp = (port: number, bind: Ip = '0.0.0.0'): Listener => ({
  proto: 'tcp',
  bind,
  port,
})

export const udp = (port: number, bind: Ip = '0.0.0.0'): Listener => ({
  proto: 'udp',
  bind,
  port,
})

export const wifi = (
  ssid: string,
  password: string,
  options: Readonly<{
    security?: Security
    band?: WifiBand
    channel?: number
  }> = {},
): WifiConfig => ({
  ssid,
  password,
  security: options.security ?? (password === '' ? 'open' : 'wpa2'),
  band: options.band ?? 'dual',
  channel: options.channel ?? 6,
})

export type RouterOptions = Readonly<{
  /** Адрес роутера в LAN с маской: `192.168.1.1/24`. */
  lan: string
  wan: Ip
  mac?: Mac
  wanMac?: Mac
  /** По умолчанию пул `.100–.199` сети LAN. */
  pool?: Readonly<{ start: Ip; end: Ip }>
  dhcp?: boolean
  dns?: Ip
  reservations?: ReadonlyArray<Reservation>
  wifi?: WifiConfig
  routes?: ReadonlyArray<StaticRoute>
  nat?: boolean
  forwards?: ReadonlyArray<PortForward>
  firewall?: Firewall
  records?: ReadonlyArray<RecordInput>
}>

const defaultPool = (
  lan: Readonly<{ ip: Ip; prefix: number }>,
): Readonly<{ start: Ip; end: Ip }> => {
  const network = networkOf(
    Option.getOrElse(parseIp(lan.ip), () => 0),
    globalThis.Number.isInteger(lan.prefix) ? lan.prefix : 24,
  )
  return { start: formatIp(network + 100), end: formatIp(network + 199) }
}

export const router = (
  id: DeviceId,
  x: number,
  y: number,
  options: RouterOptions,
): Device => {
  const lan = splitCidr(options.lan)
  const pool = options.pool ?? defaultPool(lan)
  return Device.Router({
    id,
    x,
    y,
    lan: { mac: options.mac ?? macFromId(id), ip: lan.ip, prefix: lan.prefix },
    wan: { mac: options.wanMac ?? macFromId(`${id}:wan`), ip: options.wan },
    dhcp: {
      enabled: options.dhcp ?? true,
      start: pool.start,
      end: pool.end,
      maybeDns: Option.fromNullishOr(options.dns),
      reservations: options.reservations ?? [],
    },
    maybeWifi: Option.fromNullishOr(options.wifi),
    routes: options.routes ?? [],
    nat: options.nat ?? true,
    forwards: options.forwards ?? [],
    firewall: options.firewall ?? { ...offFirewall, defaultIn: 'allow' },
    maybeVpnServer: Option.none(),
    zones: zonesFrom(options.records ?? []),
  })
}

/** Шлюз VPN офиса: снаружи `wan`, внутри LAN офиса, сеть туннеля `pool`
    (шлюз — её первый адрес), справочная офиса по `records`. */
export const vpnGateway = (
  id: DeviceId,
  x: number,
  y: number,
  options: Readonly<{
    wan: Ip
    lan: string
    pool: string
    records?: ReadonlyArray<RecordInput>
    port?: number
  }>,
): Device => {
  const pool = splitCidr(options.pool)
  const base = router(id, x, y, {
    lan: options.lan,
    wan: options.wan,
    dhcp: false,
    records: options.records ?? [],
  })
  return base._tag === 'Router'
    ? {
        ...base,
        maybeVpnServer: Option.some({
          network: pool.ip,
          prefix: pool.prefix,
          address: firstHost(options.pool),
          port: options.port ?? netRules.vpnPort,
        }),
      }
    : base
}

/** Точка доступа на доске; `onBoard: false` — сеть рядом, которую видит
    телефон (кафе, соседи), на доске её не рисуют. */
export const accessPoint = (
  id: DeviceId,
  x: number,
  y: number,
  config?: WifiConfig,
  onBoard = true,
): Device =>
  Device.AccessPoint({
    id,
    x,
    y,
    maybeWifi: Option.fromNullishOr(config),
    onBoard,
  })

export const nearbyAp = (
  id: DeviceId,
  x: number,
  y: number,
  config: WifiConfig,
): Device => accessPoint(id, x, y, config, false)

export const networkSwitch = (id: DeviceId, x: number, y: number): Device =>
  Device.Switch({ id, x, y })

export const internet = (
  id: DeviceId,
  x: number,
  y: number,
  mac?: Mac,
): Device => Device.Internet({ id, x, y, mac: mac ?? macFromId(id) })

/** Транзитный роутер провайдера: адрес, имя для traceroute, таблица
    маршрутов (без неё — кратчайший путь), CGNAT. */
export const transit = (
  id: DeviceId,
  x: number,
  y: number,
  options: Readonly<{
    ip: Ip
    name?: string
    routes?: ReadonlyArray<TransitRoute>
    cgnat?: Ip
    mac?: Mac
  }>,
): Device =>
  Device.Transit({
    id,
    x,
    y,
    mac: options.mac ?? macFromId(id),
    ip: options.ip,
    name: options.name ?? '',
    routes: options.routes ?? [],
    maybeCgnat: Option.fromNullishOr(options.cgnat),
  })

/** Строка таблицы транзита: сеть — соседу `via` или «прямо». */
export const transitRoute = (cidr: string, via?: DeviceId): TransitRoute => {
  const { ip, prefix } = splitCidr(cidr)
  return { network: ip, prefix, maybeVia: Option.fromNullishOr(via) }
}

/** Контейнер хоста Docker с адресом в его мосте. */
export const container = (
  id: DeviceId,
  dockerHost: DeviceId,
  x: number,
  y: number,
  options: Readonly<{
    image: string
    ip: Ip
    prefix?: number
    gateway?: Ip
    listeners?: ReadonlyArray<Listener>
    needs?: Upstream
    network?: string
  }>,
): Device => {
  const prefix = options.prefix ?? 16
  const gateway =
    options.gateway ?? firstHost(`${options.ip}/${String(prefix)}`)
  const base: Host = {
    ...emptyHostFields,
    id,
    x,
    y,
    mac: macFromId(`${dockerHost}/${id}`),
    addressing: staticAddress(`${options.ip}/${String(prefix)}`, gateway),
    listeners: options.listeners ?? [],
    maybeContainer: Option.some({
      host: dockerHost,
      network: options.network ?? 'default',
      image: options.image,
      maybeNeeds: Option.fromNullishOr(options.needs),
    }),
  }
  return base
}

/** Ретранслятор туннеля в интернете: домен, порт 443 и сертификат на имена
    туннелей. */
export const relay = (
  id: DeviceId,
  x: number,
  y: number,
  options: Readonly<{
    address: string
    domain: string
    certNames?: ReadonlyArray<string>
    /** Координатор mesh: слушает UDP 41641 вместо HTTPS. */
    mesh?: boolean
  }>,
): Device => {
  const base = host(id, 'server', x, y, {
    address: options.address,
    listeners:
      options.mesh === true
        ? [udp(netRules.meshPort)]
        : [tcp(netRules.relayPort)],
    certs: [
      {
        names: options.certNames ?? [`*.${options.domain}`],
        issuer: 'Example CA',
        notAfter: '2027-10-30',
      },
    ],
  })
  return base._tag === 'Host'
    ? { ...base, maybeRelayDomain: Option.some(options.domain) }
    : base
}

/** Центр сертификации: проверяет имена по HTTP-01, браузеры ему верят. */
export const certificateAuthority = (
  id: DeviceId,
  x: number,
  y: number,
  options: Readonly<{ address: string; issuer?: string; dns?: Ip }>,
): Device => {
  const base = host(
    id,
    'server',
    x,
    y,
    options.dns === undefined
      ? { address: options.address }
      : { address: options.address, dns: options.dns },
  )
  return base._tag === 'Host'
    ? { ...base, maybeCaIssuer: Option.some(options.issuer ?? 'Example CA') }
    : base
}

/** Сервис compose: `ports` — `снаружи:внутри`, `needsEnv` — переменная с
    адресом зависимости (`DATABASE_URL`). */
export const service = (
  name: string,
  options: Readonly<{
    image: string
    port: number
    environment?: Readonly<Record<string, string>>
    ports?: ReadonlyArray<string>
    needsEnv?: string
  }>,
): ComposeService => ({
  name,
  image: options.image,
  port: options.port,
  environment: Array.map(
    Object.entries(options.environment ?? {}),
    ([key, value]) => ({ key, value }),
  ),
  ports: options.ports ?? [],
  maybeNeedsEnv: Option.fromNullishOr(options.needsEnv),
})

export const composeFile = (
  services: ReadonlyArray<ComposeService>,
): ComposeFile => ({ services })

// OPERATIONS

export const add = (device: Device): NetOp => NetOp.AddDevice({ device })

export const cable = (a: DeviceId, b: DeviceId): NetOp =>
  NetOp.Connect({ a, b, medium: 'cable' })

export const radio = (a: DeviceId, b: DeviceId): NetOp =>
  NetOp.Connect({ a, b, medium: 'radio' })

export const cellular = (a: DeviceId, b: DeviceId): NetOp =>
  NetOp.Connect({ a, b, medium: 'cellular' })

export const virtual = (a: DeviceId, b: DeviceId): NetOp =>
  NetOp.Connect({ a, b, medium: 'virtual' })

export const move = (id: DeviceId, x: number, y: number): NetOp =>
  NetOp.MoveDevice({ id, x, y })

export const unplug = (a: DeviceId, b: DeviceId): NetOp =>
  NetOp.Disconnect({ a, b })

export const setLinkUp = (a: DeviceId, b: DeviceId, up: boolean): NetOp =>
  NetOp.SetLinkUp({ a, b, up })

export const wall = (x1: number, y1: number, x2: number, y2: number): NetOp =>
  NetOp.AddWall({ wall: { x1, y1, x2, y2 } })

export const setStatic = (
  device: DeviceId,
  cidr: string,
  gateway?: Ip,
  dns?: Ip,
): NetOp =>
  NetOp.SetAddressing({ device, addressing: staticAddress(cidr, gateway, dns) })

export const useDhcp = (device: DeviceId): NetOp =>
  NetOp.SetAddressing({ device, addressing: Addressing.Dhcp() })

/** DNS устройства: «автоматически» (от роутера) или «вручную» списком. */
export const setDns = (
  device: DeviceId,
  setting:
    | Readonly<{ mode: 'auto' }>
    | Readonly<{ mode: 'manual'; servers: ReadonlyArray<Ip> }>,
): NetOp =>
  NetOp.SetDns({
    device,
    maybeServers:
      setting.mode === 'auto' ? Option.none() : Option.some(setting.servers),
  })

export const joinWifi = (
  device: DeviceId,
  ssid: string,
  password: string,
): NetOp => NetOp.JoinWifi({ device, ssid, password })

export const forgetWifi = (device: DeviceId): NetOp =>
  NetOp.ForgetWifi({ device })

export const configureWifi = (device: DeviceId, config?: WifiConfig): NetOp =>
  NetOp.ConfigureWifi({ device, maybeWifi: Option.fromNullishOr(config) })

export const setDhcpPool = (router: DeviceId, start: Ip, end: Ip): NetOp =>
  NetOp.SetDhcpPool({ router, start, end })

export const reserve = (router: DeviceId, mac: Mac, ip: Ip): NetOp =>
  NetOp.ReserveAddress({ router, mac, ip })

export const addRoute = (router: DeviceId, cidr: string, via: Ip): NetOp => {
  const { ip, prefix } = splitCidr(cidr)
  return NetOp.AddRoute({ router, network: ip, prefix, via })
}

export const setNat = (router: DeviceId, enabled: boolean): NetOp =>
  NetOp.SetNat({ router, enabled })

export const forward = (router: DeviceId, rule: PortForward): NetOp =>
  NetOp.Forward({ router, forward: rule })

export const unforward = (
  router: DeviceId,
  proto: Proto,
  outsidePort: number,
): NetOp => NetOp.Unforward({ router, proto, outsidePort })

export const listen = (
  device: DeviceId,
  proto: Proto,
  bind: Ip,
  port: number,
): NetOp => NetOp.Listen({ device, proto, bind, port })

export const stopListening = (
  device: DeviceId,
  proto: Proto,
  port: number,
): NetOp => NetOp.StopListening({ device, proto, port })

export type RecordSpec = Readonly<{
  type: RecordType
  name: string
  value: string
  ttl?: number
}>

const toRecord = (spec: RecordSpec) => ({
  name: spec.name,
  rtype: spec.type,
  value: spec.value,
  ttl: spec.ttl ?? netRules.dnsTtl,
})

/** Запись зоны: заменяет записи того же имени и типа («Изменить»). */
export const setRecord = (
  device: DeviceId,
  zone: string,
  spec: RecordSpec,
): NetOp => NetOp.SetRecord({ device, zone, record: toRecord(spec) })

/** Ещё одна запись того же имени и типа (вторая A — частая ошибка). */
export const addRecord = (
  device: DeviceId,
  zone: string,
  spec: RecordSpec,
): NetOp => NetOp.AddRecord({ device, zone, record: toRecord(spec) })

export const removeRecord = (
  device: DeviceId,
  zone: string,
  name: string,
  type: RecordType,
): NetOp => NetOp.RemoveRecord({ device, zone, name, rtype: type })

export const rule = (
  options: Readonly<{
    action: FirewallAction
    proto?: FirewallProto
    port?: number
    from?: string
    direction?: 'in' | 'out'
  }>,
): FirewallRule => ({
  direction: options.direction ?? 'in',
  action: options.action,
  proto: options.proto ?? 'any',
  maybePort: Option.fromNullishOr(options.port),
  maybeFrom: pipe(
    Option.fromNullishOr(options.from),
    Option.map(from => (from.includes('/') ? from : `${from}/32`)),
  ),
})

export const firewall = (
  device: DeviceId,
  config: Readonly<{
    enabled: boolean
    defaultIn?: FirewallAction
    defaultOut?: FirewallAction
    rules?: ReadonlyArray<FirewallRule>
  }>,
): NetOp =>
  NetOp.SetFirewall({
    device,
    firewall: {
      enabled: config.enabled,
      defaultIn: config.defaultIn ?? 'drop',
      defaultOut: config.defaultOut ?? 'allow',
      rules: config.rules ?? [],
    },
  })

export const securityGroup = (
  device: DeviceId,
  config?: Readonly<{
    defaultIn?: FirewallAction
    rules?: ReadonlyArray<FirewallRule>
  }>,
): NetOp =>
  NetOp.SetSecurityGroup({
    device,
    maybeFirewall: Option.map(Option.fromNullishOr(config), current => ({
      enabled: true,
      defaultIn: current.defaultIn ?? 'drop',
      defaultOut: 'allow',
      rules: current.rules ?? [],
    })),
  })

export const setCert = (device: DeviceId, cert: Cert): NetOp =>
  NetOp.SetCert({ device, cert })

export const setRedirect = (device: DeviceId, enabled: boolean): NetOp =>
  NetOp.SetRedirect({ device, enabled })

export const vpnClient = (
  device: DeviceId,
  options: Readonly<{
    gateway: DeviceId
    address: Ip
    mode: VpnMode
    networks?: ReadonlyArray<string>
    dns?: Readonly<{ zone: string; server: Ip }>
    connected?: boolean
  }>,
): NetOp =>
  NetOp.SetVpn({
    device,
    maybeVpn: Option.some({
      connected: options.connected ?? true,
      gateway: options.gateway,
      address: options.address,
      mode: options.mode,
      networks: options.networks ?? [],
      maybeDns: Option.fromNullishOr(options.dns),
    }),
  })

export const vpnSettings = (
  device: DeviceId,
  options: Readonly<{
    connected?: boolean
    mode?: VpnMode
    networks?: ReadonlyArray<string>
  }>,
): NetOp =>
  NetOp.UpdateVpn({
    device,
    maybeConnected: Option.fromNullishOr(options.connected),
    maybeMode: Option.fromNullishOr(options.mode),
    maybeNetworks: Option.fromNullishOr(options.networks),
  })

export const vpnConnect = (device: DeviceId): NetOp =>
  vpnSettings(device, { connected: true })

export const vpnDisconnect = (device: DeviceId): NetOp =>
  vpnSettings(device, { connected: false })

/** Агент туннеля: публичное имя `<name>.<домен ретранслятора>` ведёт на
    локальный порт. Линию открывает `applyWorld` (и `settle`). */
export const tunnelUp = (
  device: DeviceId,
  options: Readonly<{ port: number; name: string; relay?: DeviceId }>,
): NetOp =>
  NetOp.SetTunnel({
    device,
    maybeTunnel: Option.some({
      relay: options.relay ?? 'relay',
      name: options.name,
      port: options.port,
    }),
  })

export const tunnelDown = (device: DeviceId): NetOp =>
  NetOp.SetTunnel({ device, maybeTunnel: Option.none() })

/** Включить устройство в свою сеть: адрес `100.100.0.x` по порядку и имя
    (по умолчанию id устройства). */
export const meshJoin = (
  device: DeviceId,
  options: Readonly<{ name?: string; relay?: DeviceId }> = {},
): NetOp =>
  NetOp.JoinMesh({
    device,
    relay: options.relay ?? 'meshhub',
    maybeName: Option.fromNullishOr(options.name),
  })

export const meshLeave = (device: DeviceId): NetOp =>
  NetOp.SetMesh({ device, maybeMesh: Option.none() })

/** Веб-сервер: слушает порты, передаёт запросы приложению (`127.0.0.1:3000`)
    и, если нужно, перенаправляет http на https. */
export const webServer = (
  device: DeviceId,
  options: Readonly<{
    listen: ReadonlyArray<number>
    upstream?: string
    redirect?: boolean
  }>,
): ReadonlyArray<NetOp> => {
  const [upstreamHost = '', upstreamPort = ''] = (options.upstream ?? '').split(
    ':',
  )
  return [
    ...Array.map(options.listen, port =>
      NetOp.Listen({ device, proto: 'tcp', bind: '0.0.0.0', port }),
    ),
    NetOp.SetProxy({
      device,
      maybeUpstream:
        options.upstream === undefined
          ? Option.none()
          : Option.some({
              host: upstreamHost,
              port: globalThis.Number(upstreamPort),
            }),
    }),
    NetOp.SetRedirect({ device, enabled: options.redirect ?? false }),
  ]
}

export const dockerHost = (
  device: DeviceId,
  options: Readonly<{ bridge: string; network: string }>,
): NetOp => {
  const { ip, prefix } = splitCidr(options.bridge)
  return NetOp.SetDocker({
    device,
    maybeBridge: Option.some({ ip, prefix, network: options.network }),
  })
}

export const publish = (
  device: DeviceId,
  container: DeviceId,
  hostPort: number,
  containerPort: number,
  bind: Ip = '0.0.0.0',
): NetOp =>
  NetOp.Publish({
    device,
    proto: 'tcp',
    bind,
    hostPort,
    container,
    containerPort,
  })

export const compose = (device: DeviceId, file: ComposeFile): NetOp =>
  NetOp.SetCompose({ device, file })

export const composeUp = (device: DeviceId): NetOp =>
  NetOp.ComposeUp({ device })

export const send = (intent: Intent): NetOp => NetOp.Send({ intent })

export const wait = (seconds: number): NetOp => NetOp.Wait({ seconds })

/** Часы вперёд до ближайшего истечения памяти DNS (устройства или любой). */
export const fastForward = (device?: DeviceId): NetOp =>
  NetOp.FastForward({ maybeDevice: Option.fromNullishOr(device) })

export const flushDns = (device: DeviceId): NetOp => NetOp.FlushDns({ device })

export const run = (device: DeviceId, line: string): NetOp =>
  NetOp.RunCommand({ device, line })

export const issueCert = (
  device: DeviceId,
  names: ReadonlyArray<string>,
): NetOp => NetOp.IssueCertificate({ device, names })

/** Начать с пустой доски: следующая сеть урока строится заново (урок 15). */
export const reset = (): NetOp => NetOp.Reset()

/** Отчёт для ИИ-ассистента: где поломка и строки вывода — доказательство
    (текст строки и её метка `LineTag`). */
export const report = (
  fault: Fault,
  evidence: ReadonlyArray<readonly [text: string, tag: string]>,
): NetOp =>
  NetOp.Report({
    fault,
    evidence: Array.map(evidence, ([text, tag]) => ({ text, tag })),
  })
