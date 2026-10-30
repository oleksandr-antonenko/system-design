import { Option } from 'effect'

import { NetMessage } from '../message'
import { type NetMessageOf } from './types'

// Образец каждого кода для теста текстов: пропущенный код не компилируется.
// Устройства — `dev-a` и `dev-b`, в тексте вместо них должны стоять подписи.

const A = 'dev-a'
const B = 'dev-b'
const IP = '192.0.2.10'

const mvp = {
  UnknownDevice: NetMessage.UnknownDevice({ id: A }),
  DuplicateDeviceId: NetMessage.DuplicateDeviceId({ id: A }),
  InvalidMac: NetMessage.InvalidMac({ value: 'zz' }),
  DuplicateMac: NetMessage.DuplicateMac({
    mac: '02:00:00:00:00:01',
    owner: A,
  }),
  InvalidIp: NetMessage.InvalidIp({ value: '999.1.1.1' }),
  InvalidPrefix: NetMessage.InvalidPrefix({ value: 40 }),
  AddressNotUsable: NetMessage.AddressNotUsable({
    ip: '192.168.1.0',
    prefix: 24,
  }),
  GatewayOutsideSubnet: NetMessage.GatewayOutsideSubnet({
    gateway: '10.0.0.1',
    ip: '192.168.1.5',
    prefix: 24,
  }),
  OnlyOneInternet: NetMessage.OnlyOneInternet(),
  ConnectSelf: NetMessage.ConnectSelf({ id: A }),
  AlreadyLinked: NetMessage.AlreadyLinked({ a: A, b: B }),
  UnknownLink: NetMessage.UnknownLink({ a: A, b: B }),
  PortBusy: NetMessage.PortBusy({ device: A }),
  RadioNeedsAccessPoint: NetMessage.RadioNeedsAccessPoint({ a: A, b: B }),
  NoWifiOnDevice: NetMessage.NoWifiOnDevice({ device: A }),
  InternetNeedsRouter: NetMessage.InternetNeedsRouter({ device: A }),
  SecondWanLink: NetMessage.SecondWanLink({ router: A }),
  LinkMakesLoop: NetMessage.LinkMakesLoop({ a: A, b: B }),
  NotAHost: NetMessage.NotAHost({ id: A }),
  NotARouter: NetMessage.NotARouter({ id: A }),
  NotAnAccessPoint: NetMessage.NotAnAccessPoint({ id: A }),
  DhcpPoolOutsideSubnet: NetMessage.DhcpPoolOutsideSubnet({
    start: '10.0.0.100',
    end: '10.0.0.199',
    network: '192.168.1.0',
    prefix: 24,
  }),
  DhcpPoolReversed: NetMessage.DhcpPoolReversed({
    start: '192.168.1.199',
    end: '192.168.1.100',
  }),
  DhcpPoolIncludesRouter: NetMessage.DhcpPoolIncludesRouter({
    ip: '192.168.1.1',
  }),
  ReservationOutsideSubnet: NetMessage.ReservationOutsideSubnet({
    mac: '02:00:00:00:00:01',
    ip: '10.0.0.5',
  }),
  ReservationTaken: NetMessage.ReservationTaken({
    ip: '192.168.1.50',
    mac: '02:00:00:00:00:01',
  }),
  EmptySsid: NetMessage.EmptySsid(),
  WifiPasswordTooShort: NetMessage.WifiPasswordTooShort({ min: 8 }),
  InvalidChannel: NetMessage.InvalidChannel({ band: '5', channel: 7 }),
  InvalidPort: NetMessage.InvalidPort({ value: 70000 }),
  EmptyName: NetMessage.EmptyName(),

  WifiOff: NetMessage.WifiOff({ ap: A }),
  NoWifiProfile: NetMessage.NoWifiProfile({ device: A }),
  WrongSsid: NetMessage.WrongSsid({ device: A, ssid: 'Home', ap: B }),
  WrongPassword: NetMessage.WrongPassword({ device: A, ssid: 'Home' }),
  BandUnsupported: NetMessage.BandUnsupported({ device: A, band: '5' }),
  OutOfRange: NetMessage.OutOfRange({ device: A, ap: B }),

  FrameReceived: NetMessage.FrameReceived({ device: A }),
  FrameNotForMe: NetMessage.FrameNotForMe({ device: A }),
  FrameForwarded: NetMessage.FrameForwarded({ device: A, link: 'x-y' }),
  FrameFlooded: NetMessage.FrameFlooded({ device: A, links: ['x-y'] }),
  FrameBroadcast: NetMessage.FrameBroadcast({ device: A, links: ['x-y'] }),
  FrameFiltered: NetMessage.FrameFiltered({ device: A }),
  PacketRouted: NetMessage.PacketRouted({ device: A }),
  PacketIgnored: NetMessage.PacketIgnored({ device: A }),
  ArpIsMine: NetMessage.ArpIsMine({ device: A, ip: IP }),
  ArpNotMine: NetMessage.ArpNotMine({ device: A, ip: IP }),
  DhcpServerOff: NetMessage.DhcpServerOff({ router: A }),

  NoLink: NetMessage.NoLink({ device: A }),
  LinkDown: NetMessage.LinkDown({ device: A, link: 'x-y' }),
  NoAddress: NetMessage.NoAddress({ device: A }),
  UsesStaticAddress: NetMessage.UsesStaticAddress({ device: A }),
  NoGateway: NetMessage.NoGateway({ device: A, ip: IP }),
  NoDnsServer: NetMessage.NoDnsServer({ device: A }),
  ArpNoReply: NetMessage.ArpNoReply({ device: A, ip: IP }),
  NoDhcpServer: NetMessage.NoDhcpServer({ device: A }),
  DhcpPoolExhausted: NetMessage.DhcpPoolExhausted({ router: A }),
  TtlExpired: NetMessage.TtlExpired({ device: A }),
  NoRouteToHost: NetMessage.NoRouteToHost({ ip: IP }),
  PrivateAddressNotRoutable: NetMessage.PrivateAddressNotRoutable({
    ip: '192.168.1.42',
  }),
  NoWanLink: NetMessage.NoWanLink({ router: A }),
  NatNoMapping: NetMessage.NatNoMapping({
    router: A,
    proto: 'tcp',
    port: 5173,
  }),
  PortClosed: NetMessage.PortClosed({ device: A, proto: 'tcp', port: 80 }),
  ListensOnlyOnLoopback: NetMessage.ListensOnlyOnLoopback({
    device: A,
    port: 5173,
  }),
  NameNotFound: NetMessage.NameNotFound({ name: 'nowhere.example' }),
  InvalidUrl: NetMessage.InvalidUrl({ url: 'shop example' }),
  FrameLost: NetMessage.FrameLost({ device: A }),

  GoalNotLinked: NetMessage.GoalNotLinked({ a: A, b: B }),
  GoalWrongMedium: NetMessage.GoalWrongMedium({ a: A, b: B, want: 'cable' }),
  GoalLinkDown: NetMessage.GoalLinkDown({ a: A, b: B }),
  GoalNoRadioLink: NetMessage.GoalNoRadioLink({ device: A, ap: B }),
  GoalWrongAddress: NetMessage.GoalWrongAddress({
    device: A,
    have: '192.168.1.100',
    want: '192.168.1.50',
  }),
  AddressConflict: NetMessage.AddressConflict({
    ip: '192.168.1.50',
    devices: [A, B],
  }),
  GoalReachable: NetMessage.GoalReachable({ from: A, at: B }),
  GoalNotListening: NetMessage.GoalNotListening({
    device: A,
    proto: 'tcp',
    port: 5173,
  }),
  GoalListeningOnWrongAddress: NetMessage.GoalListeningOnWrongAddress({
    device: A,
    port: 5173,
    bind: '127.0.0.1',
    want: '0.0.0.0',
  }),
  GoalResolvesElsewhere: NetMessage.GoalResolvesElsewhere({
    name: 'myapp.example',
    have: '203.0.113.10',
    want: '203.0.113.20',
  }),
}

const extended = {
  InvalidCidr: NetMessage.InvalidCidr({ value: '10.0.0.0/99' }),
  CellularNeedsOperator: NetMessage.CellularNeedsOperator({ a: A, b: B }),
  VirtualNeedsContainer: NetMessage.VirtualNeedsContainer({ a: A, b: B }),
  NotATransit: NetMessage.NotATransit({ id: A }),
  NotAVpnGateway: NetMessage.NotAVpnGateway({ id: A }),
  NotADockerHost: NetMessage.NotADockerHost({ id: A }),
  NoVpnClient: NetMessage.NoVpnClient({ device: A }),
  RouteViaOutsideLan: NetMessage.RouteViaOutsideLan({ via: '10.0.0.1' }),
  NotANeighbour: NetMessage.NotANeighbour({ device: A, via: B }),
  ForwardOutsideLan: NetMessage.ForwardOutsideLan({ ip: '10.0.0.5' }),
  ForwardPortTaken: NetMessage.ForwardPortTaken({ proto: 'tcp', port: 25565 }),
  UnknownForward: NetMessage.UnknownForward({ proto: 'udp', port: 25565 }),
  UnknownZone: NetMessage.UnknownZone({ zone: 'myapp.example' }),
  UnknownRecord: NetMessage.UnknownRecord({ name: 'www', rtype: 'CNAME' }),
  RecordNeedsAddress: NetMessage.RecordNeedsAddress({
    rtype: 'A',
    value: 'myapp.example',
  }),
  CnameNeedsName: NetMessage.CnameNeedsName({ value: '198.51.100.20' }),
  CnameAtApex: NetMessage.CnameAtApex({ zone: 'myapp.example' }),
  CnameConflict: NetMessage.CnameConflict({ name: 'www' }),
  SplitTunnelEmpty: NetMessage.SplitTunnelEmpty(),
  InvalidPortMapping: NetMessage.InvalidPortMapping({ value: '8080-3000' }),
  HostPortTaken: NetMessage.HostPortTaken({ port: 8080 }),
  NoRelay: NetMessage.NoRelay(),
  NoCertificateAuthority: NetMessage.NoCertificateAuthority(),
  NameIsAddress: NetMessage.NameIsAddress({ value: '198.51.100.20' }),
  AcmeChallengeFailed: NetMessage.AcmeChallengeFailed({
    name: 'myapp.example',
    problem: 'refused',
    maybeIp: Option.some('198.51.100.20'),
  }),
  ForeignOpenNetwork: NetMessage.ForeignOpenNetwork({
    device: A,
    ssid: 'Cafe',
  }),
  ForeignNetwork: NetMessage.ForeignNetwork({ device: A, ssid: 'Router-3A90' }),
  NetworkNotFound: NetMessage.NetworkNotFound({ device: A, ssid: 'Nowhere' }),
  FirewallAllowed: NetMessage.FirewallAllowed({
    device: A,
    scope: 'os',
    maybeRule: Option.some(1),
  }),
  TunnelUnwrapped: NetMessage.TunnelUnwrapped({ device: A }),
  RelayPassed: NetMessage.RelayPassed({ device: A }),
  PortPublished: NetMessage.PortPublished({
    device: A,
    port: 8080,
    container: B,
  }),
  GatewayUnreachable: NetMessage.GatewayUnreachable({
    device: A,
    gateway: '192.168.1.254',
  }),
  GatewayIsSelf: NetMessage.GatewayIsSelf({ device: A }),
  GatewayNotARouter: NetMessage.GatewayNotARouter({
    device: A,
    gateway: '192.168.1.101',
  }),
  PublishedPortClosed: NetMessage.PublishedPortClosed({
    device: A,
    port: 3000,
  }),
  AppDown: NetMessage.AppDown({ device: A, host: 'localhost', port: 5432 }),
  FirewallDropped: NetMessage.FirewallDropped({
    device: A,
    scope: 'cloud',
    maybeRule: Option.none(),
  }),
  FirewallRejected: NetMessage.FirewallRejected({
    device: A,
    scope: 'router',
    maybeRule: Option.some(2),
  }),
  TunnelNoRoute: NetMessage.TunnelNoRoute({ gateway: A, ip: '192.168.1.50' }),
  NotConnected: NetMessage.NotConnected({ device: A }),
  TunnelNotFound: NetMessage.TunnelNotFound({
    name: 'quiet-river-42.tunnel.example',
  }),
  UpstreamFailed: NetMessage.UpstreamFailed({ device: A, port: 3000 }),
  CertNameMismatch: NetMessage.CertNameMismatch({
    device: A,
    name: 'myapp.example',
    names: ['vps-20.hosting.example'],
  }),
  CertExpired: NetMessage.CertExpired({
    device: A,
    name: 'myapp.example',
    notAfter: '2026-01-01',
  }),
  CertUntrusted: NetMessage.CertUntrusted({
    device: A,
    name: 'myapp.example',
    issuer: 'self-signed',
  }),
  TlsNotConfigured: NetMessage.TlsNotConfigured({ device: A, port: 443 }),
  HttpError: NetMessage.HttpError({ device: A, status: 404 }),
  SeveralAddresses: NetMessage.SeveralAddresses({
    name: 'myapp.example',
    ips: ['198.51.100.200', '198.51.100.20'],
  }),
  GoalWifiTooWeak: NetMessage.GoalWifiTooWeak({
    ap: A,
    security: 'open',
    want: 'wpa2',
  }),
  GoalChannelBusy: NetMessage.GoalChannelBusy({ ap: A, others: [B] }),
  GoalNotPerformed: NetMessage.GoalNotPerformed({ from: A, at: B }),
  GoalNoRecord: NetMessage.GoalNoRecord({
    zone: 'myapp.example',
    name: 'www',
    rtype: 'CNAME',
  }),
  GoalRecordValue: NetMessage.GoalRecordValue({
    zone: 'myapp.example',
    name: '@',
    rtype: 'TXT',
    have: ['other'],
    want: 'myapp-verify=4f9c2a',
  }),
  GoalCommandNotRun: NetMessage.GoalCommandNotRun({
    device: A,
    commands: ['dig', 'nslookup'],
  }),
  GoalCommandSawOther: NetMessage.GoalCommandSawOther({
    device: A,
    name: 'myapp.example',
    saw: ['198.51.100.200'],
    want: '198.51.100.20',
  }),
  GoalExtraOpenPort: NetMessage.GoalExtraOpenPort({
    target: '203.0.113.7',
    port: 5432,
    device: A,
  }),
  GoalPortNotOpen: NetMessage.GoalPortNotOpen({ target: 'vps', port: 80 }),
  GoalNotRedirected: NetMessage.GoalNotRedirected({
    url: 'http://myapp.example/',
    status: 200,
  }),
  GoalNotThrough: NetMessage.GoalNotThrough({ device: A }),
  GoalThrough: NetMessage.GoalThrough({ device: A }),
  GoalNoDevice: NetMessage.GoalNoDevice({ id: A }),
  SshLockedOut: NetMessage.SshLockedOut({ device: A }),
  ReportMissing: NetMessage.ReportMissing(),
  ReportAfterFix: NetMessage.ReportAfterFix(),
  ReportNoEvidence: NetMessage.ReportNoEvidence(),
  ReportWrongFault: NetMessage.ReportWrongFault({
    picked: 'dns',
    expected: 'firewall',
    ran: false,
    host: 'myapp.example',
    port: 443,
  }),
  ReportTrap: NetMessage.ReportTrap({
    picked: 'dns',
    expected: 'gateway',
    ran: true,
    host: 'shop.example',
    port: 443,
  }),
  ReportEvidenceOk: NetMessage.ReportEvidenceOk(),
  ReportEvidenceSymptom: NetMessage.ReportEvidenceSymptom(),
  ReportEvidenceAbove: NetMessage.ReportEvidenceAbove(),
  ReportEvidenceOther: NetMessage.ReportEvidenceOther(),
  ReportAccepted: NetMessage.ReportAccepted({ fault: 'dns' }),
  ReportConfirmed: NetMessage.ReportConfirmed({ fault: 'loopback' }),
  UnknownCommand: NetMessage.UnknownCommand({
    command: 'ls',
    available: ['ping', 'ip a'],
  }),
  CommandLocked: NetMessage.CommandLocked({
    command: 'traceroute',
    available: ['ping'],
  }),
  CommandUsage: NetMessage.CommandUsage({
    command: 'ping',
    usage: 'ping [-c N] host',
  }),
  NoLinkLayer: NetMessage.NoLinkLayer({ device: A }),
  NoAddressLayer: NetMessage.NoAddressLayer({ device: A }),
  NoPortLayer: NetMessage.NoPortLayer({ device: A }),
  EnvelopeMisordered: NetMessage.EnvelopeMisordered({
    position: 2,
    expected: 'internet',
    found: 'transport',
  }),
}

export const samples: {
  readonly [Tag in keyof NetMessageOf]: NetMessageOf[Tag]
} = { ...mvp, ...extended }

export const sampleNames: Readonly<Record<string, string>> = {
  [A]: 'Alpha',
  [B]: 'Beta',
}
