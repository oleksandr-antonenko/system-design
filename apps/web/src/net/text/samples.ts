import { NetMessage } from '../message'
import { type NetMessageOf } from './types'

// Образец каждого кода для теста текстов: пропущенный код не компилируется.
// Устройства — `dev-a` и `dev-b`, в тексте вместо них должны стоять подписи.

const A = 'dev-a'
const B = 'dev-b'
const IP = '192.0.2.10'

export const samples: {
  readonly [Tag in keyof NetMessageOf]: NetMessageOf[Tag]
} = {
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

export const sampleNames: Readonly<Record<string, string>> = {
  [A]: 'Alpha',
  [B]: 'Beta',
}
